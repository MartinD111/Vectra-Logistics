# Phase 5: Email History Sync - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Sync sent-mail metadata from the company's connected Outlook mailbox via Microsoft Graph, match each email to the client(s) whose address/domain appears among the recipients, and store the metadata so client detail pages can render "last 10 emails sent" instantly from the database — no live Graph call on page view. Outbound sent-mail only; no inbound/reply tracking, no two-way threading (explicitly out of scope per PROJECT.md).

</domain>

<decisions>
## Implementation Decisions

### Sync Scheduling & Trigger
- **D-01:** Sync runs as a BullMQ repeatable job (`repeat: { every: N }` with a deduped `jobId`), matching the existing pattern in `telematics.worker.ts`. No manual "sync now" endpoint is in scope for this phase (unlike calendar sync's manual `/sync-calendar`) — recurring background sync only.
- **D-02:** Job interval is **every 15 minutes**.
- **D-03:** One repeatable job iterates all companies with a connected, non-demo Outlook mailbox in a single tick (mirrors `telematics.worker.ts`'s single-job-iterates-all-subjects design) — not one repeatable job per company.

### Sync Window & Graph Query Scope
- **D-04:** First sync for a newly-connected mailbox reaches back **90 days** from connection time. Emails older than that are never synced (accepted limitation — a sparse/old client relationship may show fewer than 10 emails or none).
- **D-05:** Incremental (subsequent) syncs are bounded by a **per-mailbox watermark** — track "last successfully synced at" (new column, likely on `integration_credentials` or a new sync-state row) and query Graph for messages sent after that timestamp on each run. Not a rolling re-scan window.
- **D-06:** Query the Graph endpoint **`/me/mailfolders/sentitems/messages`** (scoped directly to sent mail), not `/me/messages` with a sender filter.

### Client Matching Logic
- **D-07:** When an email's recipients match multiple distinct clients, insert **one `email_messages` row per matched client** (same `outlook_id`, different `client_id`) so the email appears in "last 10 sent" for every client it was actually sent to.
  - **Schema implication:** the existing `email_messages` table has `UNIQUE (company_id, outlook_id)` (from `021_crm_extensions.sql`) — this MUST be relaxed to `UNIQUE (company_id, outlook_id, client_id)` via a new idempotent migration so one Graph message can map to N client-scoped rows.
- **D-08:** Matching is by **domain**, not just exact email — a client matches if any recipient address ends in `@{domain}`, where `{domain}` is derived by splitting the client's stored `clients.email` field at `@`. Clients have only one `email` field today (no separate domain field); domain is derived at match time, not stored separately.
- **D-09:** Common free/consumer email providers are **excluded from domain-matching** (denylist: `gmail.com`, `outlook.com`, `hotmail.com`, `yahoo.com`, and similar). For a client whose stored email is on one of these domains, only an **exact recipient-email match** counts. For all other (presumably company-owned) domains, a domain match is sufficient. This prevents cross-client false positives when two unrelated clients both use, e.g., `gmail.com`.

### Failure & Edge-Case Handling
- **D-10:** Token expired/revoked mid-sync → **silent skip** for that company, exactly like `syncCalendar()`'s existing `{ synced: 0, skipped: reason }` pattern — the job loop must never throw and must continue to the next company. No new user-facing warning banner is in scope this phase (the existing Outlook connection-status UI already surfaces connection health separately).
- **D-11 (schema gap surfaced during discussion):** The roadmap phrase "any team member's connected Outlook mailbox" does **not** match the current data model — `integration_credentials` has `UNIQUE(company_id, provider_id)`, meaning there is exactly **one shared Outlook connection per company today**, not one per team member. Decision: **build against the single company-level mailbox as-is**. Do not add per-user OAuth/token storage this phase — that would be a materially larger change (new schema, new OAuth flow per user) and belongs in its own future phase if true multi-mailbox support is ever needed.
- **D-12:** Emails sent before Outlook was ever connected are **not synced** — this is a direct consequence of D-04's 90-day-from-connection-time window, not separate new behavior.

### Claude's Discretion
- Exact column/table design for the per-mailbox sync watermark (D-05) — e.g., a new `last_synced_at` column on `integration_credentials`, or a small dedicated sync-state table. Either is acceptable as long as it's queryable per-company before each job tick.
- Exact free-domain denylist contents beyond the four named examples (gmail.com, outlook.com, hotmail.com, yahoo.com) — reasonable additions (e.g., icloud.com, aol.com, protonmail.com) are fine; this isn't an exhaustive user-specified list.
- Pagination handling for Graph's `/sentitems/messages` responses (`@odata.nextLink`) during the 90-day backfill — follow whatever the existing calendar sync does if it already paginates, otherwise implement standard Graph pagination.
- Exact BullMQ queue name and job naming convention — follow `telematics.worker.ts`'s naming style (e.g., `email-sync-repeatable` mirroring `telematics-sync-repeatable`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recurring job pattern (direct analog)
- `apps/api/src/workers/telematics.worker.ts` (lines ~274-298) — `scheduleTelematicsSync()`: BullMQ repeatable job registration (`repeat: { every: 5 * 60 * 1000 }`, deduped `jobId: 'telematics-sync-repeatable'`). This phase's email sync scheduler should mirror this exact shape at a 15-minute interval.
- `apps/api/src/core/queue/index.ts` — `getQueue(name)` singleton registry; reuse this for the new email-sync queue rather than constructing a new `Queue` instance directly.

### Outlook integration (existing, to extend)
- `apps/api/src/domains/outlook/outlook.service.ts` — `syncCalendar()` (lines ~164-211) is the direct sibling method to model `syncEmails()` on: same demo-mode no-op pattern, same `ensureFreshToken()` call before querying Graph, same silent-skip-with-reason return shape (`{ synced, skipped? }`) for the failure cases in D-10.
- `apps/api/src/domains/outlook/outlook.repository.ts` — `find(companyId)` / `upsert(companyId, creds)`; confirms the one-connection-per-company model behind D-11 (`UNIQUE(company_id, provider_id)` on `integration_credentials`).
- `apps/api/src/domains/outlook/outlook.types.ts` — `OutlookCredentials` shape (`access_token`, `refresh_token`, `expires_at`, `demo`, `email`); the new sync watermark (D-05) will likely extend this or live alongside it.
- `apps/api/src/domains/outlook/calendar.repository.ts` — `upsertEvents()` pattern (`ON CONFLICT` upsert per external_id) — a reference for how `email_messages` inserts should structure conflict handling given D-07's multi-row-per-outlook_id design.
- `apps/api/src/domains/outlook/outlook.routes.ts` — existing route registration pattern (`authenticateToken` middleware, no new route needed for the scheduled job itself — only the job registration/bootstrap wiring is new).

### Schema (existing, needs one new migration)
- `database/migrations/021_crm_extensions.sql` — `email_messages` table already exists (Phase 1) with `UNIQUE (company_id, outlook_id)`. Per D-07, this phase must add a new idempotent migration (`NNN_description.sql`) that relaxes this to `UNIQUE (company_id, outlook_id, client_id)`.
- `database/migrations/019_crm_billing.sql` — `clients.email` column (nullable `TEXT`) — the single source for domain derivation in D-08/D-09; no separate domain field exists or is being added.

### Project Requirements
- `.planning/REQUIREMENTS.md` — EML-01 (Graph sync from connected mailbox), EML-02 (match by recipient address/domain), EML-03 (store metadata for instant "last 10 emails sent" render)
- `.planning/ROADMAP.md` §"Phase 5: Email History Sync" — 3 success criteria this phase must satisfy exactly
- `.planning/PROJECT.md` — confirms outbound-only scope (no inbound/threading), broadest-match-is-simplest philosophy for D-08

No external ADRs/PRDs beyond the above — requirements fully captured in REQUIREMENTS.md and this document.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- BullMQ (`bullmq` package, already a dependency) — `getQueue()` registry and the repeatable-job pattern from `telematics.worker.ts` apply directly.
- `ensureFreshToken()` in `outlook.service.ts` — token refresh logic already exists and is reusable as-is for the email sync path (same `OutlookCredentials` shape, same refresh flow).
- `recordEvent()` (`core/events/activityLog.ts`) — `syncCalendar()` already calls this after a successful sync (`verb: 'integration.calendar_synced'`); the email sync should follow the same audit-trail convention with a new verb (e.g., `integration.emails_synced`).
- `email_messages` table — already created in Phase 1, just needs population and the one schema tweak from D-07.

### Established Patterns
- DDD domain layering: new sync logic stays within `apps/api/src/domains/outlook/` (service + repository), consistent with how calendar sync lives there rather than in a separate domain.
- No ORM — the D-07 schema change goes in a new idempotent `NNN_description.sql` migration, following the existing convention.
- Demo mode: `conn.creds.demo === true` short-circuits calendar sync to a no-op; email sync must respect the same flag.
- Multi-tenancy: all sync operations scoped to `company_id`; the BullMQ job loop iterates companies, never touches cross-tenant data.

### Integration Points
- New/extended: `outlook.service.ts` gains `syncEmails(companyId, actorId)`, mirroring `syncCalendar()`'s signature and return shape.
- New: a repository method (likely on a new `email.repository.ts` or extending an existing one) for matching + upserting `email_messages` rows, following `calendar.repository.ts`'s `upsertEvents()` shape.
- New: `apps/api/src/workers/` gains an email-sync scheduler function (e.g., `scheduleEmailSync()`) mirroring `scheduleTelematicsSync()`, called once at API server bootstrap.
- Consumer (not this phase's job to build, but the reason `email_messages` exists): client detail page's "last 10 emails sent" section, which reads directly from the table — no live Graph call, satisfying EML-03/the phase goal.

</code_context>

<specifics>
## Specific Ideas

- The "silent skip, never throw" philosophy from `syncCalendar()` is the single most important behavioral pattern to carry over — a background job touching many companies' mailboxes must be resilient to any one company's connection being broken.
- The free-email-domain denylist (D-09) is a deliberate, discussion-surfaced data-quality safeguard, not an assumption — it directly prevents a realistic cross-client data leak (two clients both using gmail.com).

</specifics>

<deferred>
## Deferred Ideas

- **True multi-mailbox support (per-team-member Outlook connections)** — the roadmap's "any team member's connected mailbox" wording implies this, but the current schema only supports one connection per company (D-11). Deferred to a future phase if genuinely needed; this phase builds against the single company-level mailbox as-is.
- **Manual "sync now" endpoint** — calendar sync has one (`/sync-calendar`); email sync in this phase is scheduled-only (D-01). Could be added later as a small follow-up if users want on-demand refresh.
- **User-facing warning when a mailbox's token is expired/revoked** — currently silent-skip only (D-10); a persistent UI banner for this was considered and explicitly deferred as extra surface area beyond this phase's scope.
- **Inbound email / reply tracking / two-way threading** — explicitly out of scope per PROJECT.md, not reconsidered in this discussion.

### Reviewed Todos (not folded)
None — no todos matched this phase (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 5-email-history-sync*
*Context gathered: 2026-07-06*
