# Phase 5: Email History Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 5-email-history-sync
**Areas discussed:** Sync scheduling & trigger, Sync window & Graph query scope, Client matching logic, Failure & edge-case handling

---

## Sync Scheduling & Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| BullMQ repeatable job | Matches telematics.worker.ts's `repeat: { every: N }` pattern; runs automatically in background | ✓ |
| Manual-only, like calendar sync | POST /sync-emails endpoint, simplest but doesn't satisfy "recurring basis" without an external caller | |
| Both: scheduled + manual refresh | BullMQ job plus an on-demand endpoint mirroring /sync-calendar | |

**User's choice:** BullMQ repeatable job (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Every 15 minutes | Balance between freshness and Graph rate limits | ✓ |
| Every hour | Lower Graph load, acceptable staleness | |
| Every 5 minutes | Matches telematics's exact cadence | |

**User's choice:** Every 15 minutes (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| One repeatable job, iterates all connected companies | Matches telematics.worker.ts's single-job-iterates-all-subjects design | ✓ |
| Per-company repeatable jobs | More granular but more bookkeeping | |

**User's choice:** One repeatable job, iterates all connected companies (Recommended)

---

## Sync Window & Graph Query Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded window, e.g. last 90 days | Avoids pulling years of history on first connect | ✓ |
| All history (no lower bound) | More complete but slow/expensive | |
| Last 30 days | Tighter window, faster first sync | |

**User's choice:** Bounded window, last 90 days (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Since last successful sync timestamp | Per-mailbox watermark, minimal Graph load | ✓ |
| Always re-query a rolling window (e.g. last 7 days) | Simpler, no watermark tracking, relies on UNIQUE constraint to dedupe | |

**User's choice:** Since last successful sync timestamp (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| /me/mailfolders/sentitems/messages | Directly scoped to sent mail | ✓ |
| /me/messages with a sender filter | More flexible but redundant | |

**User's choice:** /me/mailfolders/sentitems/messages (Recommended)

---

## Client Matching Logic

| Option | Description | Selected |
|--------|-------------|----------|
| Link to every matching client | One email_messages row per matched client (same outlook_id, different client_id) | ✓ |
| Link to the first/primary matching client only | Simpler, one row per email | |

**User's choice:** Link to every matching client (Recommended)
**Notes:** Requires relaxing the existing `UNIQUE (company_id, outlook_id)` constraint on `email_messages` to `UNIQUE (company_id, outlook_id, client_id)` via a new migration.

| Option | Description | Selected |
|--------|-------------|----------|
| Domain match is sufficient | Any recipient @{client's domain} counts, domain derived from clients.email | ✓ |
| Exact email match only, no domain fallback | Stricter, avoids false positives from shared domains | |

**User's choice:** Domain match is sufficient (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, exclude common free providers | Denylist (gmail.com, outlook.com, hotmail.com, yahoo.com, etc.) — exact-match-only for these domains | ✓ |
| No, domain match applies universally | Simpler, accepts occasional cross-client false positives | |

**User's choice:** Yes, exclude common free providers (Recommended)
**Notes:** Raised proactively by Claude as a realistic data-quality risk (two clients sharing a free email domain) before locking the domain-match decision.

---

## Failure & Edge-Case Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Silent skip, like calendar sync | Matches syncCalendar()'s existing { synced: 0, skipped: reason } pattern | ✓ |
| Skip but flag for user visibility | Same silent skip plus a persistent UI warning | |

**User's choice:** Silent skip, like calendar sync (Recommended)

**Mailbox model gap (surfaced during discussion, not a pre-set option):** Claude checked `outlook.repository.ts` and found `integration_credentials` has `UNIQUE(company_id, provider_id)` — one shared Outlook connection per company today, not one per team member, despite the roadmap's "any team member's connected mailbox" wording.

| Option | Description | Selected |
|--------|-------------|----------|
| Sync from the single company-level mailbox as-is | No schema change; treats "any team member" loosely as "whichever mailbox is connected" | ✓ |
| Extend to true multi-mailbox now (per-user Outlook connections) | Matches roadmap wording literally but is a much larger schema/OAuth change | |

**User's choice:** Sync from the single company-level mailbox as-is (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Not synced — sync only reaches back to the 90-day window from connection time | Consistent with the already-decided 90-day window | ✓ |
| No special handling needed — same as above | Confirms it's the same decision, not a new one | |

**User's choice:** Not synced — consistent with 90-day window (Recommended)

---

## Claude's Discretion

- Exact column/table design for the per-mailbox sync watermark (new column vs. dedicated sync-state table)
- Exact free-domain denylist contents beyond gmail.com, outlook.com, hotmail.com, yahoo.com
- Pagination handling for Graph's `/sentitems/messages` `@odata.nextLink` during the 90-day backfill
- Exact BullMQ queue/job naming convention (following telematics.worker.ts's style)

## Deferred Ideas

- True multi-mailbox support (per-team-member Outlook connections) — future phase if needed
- Manual "sync now" endpoint for email sync (calendar sync has one, email sync doesn't this phase)
- User-facing warning banner for expired/revoked mailbox tokens
- Inbound email / reply tracking / two-way threading (already out of scope per PROJECT.md)
