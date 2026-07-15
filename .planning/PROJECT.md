# Vectra CRM Rework

## What This Is

A dedicated CRM module inside the Vectra workspaces app, replacing the never-built "Records" sidebar slot. Today the CRM exists as a full dashboard, client detail pages (opened in a new tab), bulk Excel import, per-project overrides, real email history synced from Outlook, and a credit-risk semaphore wired into the KPI engine that hard-blocks dispatchers from assigning loads to over-limit clients — shipped as v1.0.

Underneath the workspaces app, the Notion-like Project Pages and Mini Programs block systems now share one generic, plugin-driven `WorkspaceBlockRegistry` engine (shipped as v2.0) — "add a block = write one plugin entry, change nothing else." A third, demo-only automations WorkflowBuilder remains a separate, explicitly parked system for a future migration.

The same codebase is now also a first-class On-Premise deployment target (shipped as v3.0): a customer or their IT partner can install it via a one-shot installer (secrets generation, migrations, first company + admin, optional local Gemma/Ollama config), run it fully offline (backend-side local AI dispatch, not just the browser path), and upgrade it with a documented 5-step procedure — all gated by one `DEPLOYMENT_MODE=cloud|on-prem` toggle, not a fork. Deploy-hardening (CORS allowlist, auth rate limiting, live `/health` checks) applies to both Cloud and On-Premise.

## Core Value

Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.

## Current Milestone: v4.0 Workspace Records & Views

**Goal:** Elevate Kanban from a page-JSON placeholder into a real Records+Views database engine (`data_collections`/`collection_records`/`collection_views`), with cards that open as full pages reusing the existing editor.

**Target features:**
- Missing generic content blocks (checklist/to-do, toggle, quote, code, image/file/video/bookmark/embed, table, columns, sub-page, mention) so card bodies have a complete palette
- Records+Views schema (`data_collections`, `collection_records`, `collection_views`) as a new API domain
- Record detail page: title + property panel (schema-driven inline editors) + body reusing `LivePageCanvas`/`EditableRichText`/`SlashMenu`
- `collection-view` page block + real drag-and-drop board grouped by any property, with zero-data-loss auto-migration of legacy `kanban` blocks
- View-editing UX parity (sub-groups, filters/sorts, card preview properties, column aggregations, view switching)
- Additional view types (table/calendar/gallery/list/timeline) over the same collection
- Optional/stretch: realtime record sync via existing `emitToRoom` socket.io bus

**Scope note:** Deliberately narrow — only `docs/specs/core/workspace-blocks.md`'s gap. Other `core/` spec gaps (KPI scheduler, program-builder blocks, doc-AI/OCR, event-spine retention) are explicitly out of scope for this milestone; candidates for a future one.

## Requirements

### Validated

- ✓ `clients` and `invoices` tables exist with credit_limit/outstanding_balance tracking — existing (migration `019_crm_billing.sql`)
- ✓ Backend already 403s over-limit assignment attempts at the `pod_requests` level — existing
- ✓ CRM block renders client list with green/amber/red credit utilization bar — existing (`CrmClientsBlock.tsx`)
- ✓ Outlook OAuth integration with encrypted credential storage exists (calendar sync only, no message sync) — existing (`apps/api/src/domains/outlook/`)
- ✓ KPI engine exists with a pluggable evaluator pattern (activityVolume, outlookCalendar) — existing (`apps/api/src/domains/kpi/`)
- ✓ Notion-like project page canvas with a block registry (`PAGE_BLOCK_REGISTRY`) supports adding new block kinds — existing (`apps/workspaces/src/lib/projectPage/blocks.ts`)
- ✓ xlsx-based Excel parsing already used elsewhere in the app (`ExcelAutomationTool.tsx`) — existing, reusable
- ✓ Cross-app/new-tab link pattern (`target="_blank" rel="noopener noreferrer"`, `crossAppUrl` helper) — existing, reusable
- ✓ Schema foundation for the CRM rework exists: `clients.address`, `clients.responsible_employee_id`, `client_project_links` override table, `email_messages` table, `kpi_results.user_id` nullable + `client_id` column — Validated in Phase 1 (migration `021_crm_extensions.sql`)
- ✓ Dedicated `crm` API domain (controller/service/repository/routes/types/DTOs) exists at `apps/api/src/domains/crm/`, mounted at `/api/v1/crm`, separate from `billing` — Validated in Phase 1
- ✓ Frontend reads client data via `crm` domain (`useCrm.ts`/`crm.api.ts`) instead of `billing`; `CrmClientsBlock.tsx` behavior unchanged — Validated in Phase 1
- ✓ Sidebar "Records" renamed to "CRM" at `/records` as the CRM's dedicated home — v1.0 (Phase 2)
- ✓ CRM dashboard lists all clients; clicking a client opens its detail page in a new tab — v1.0 (Phase 2)
- ✓ Client detail page shows address, notes, current situation (last 10 emails sent), full timeline, settings — v1.0 (Phase 2)
- ✓ Clients support an `address` field and an assigned responsible employee — v1.0 (Phase 1/2)
- ✓ Clients attach to one or more projects with field-level per-project overrides (rate/employee/notes) over client defaults — v1.0 (Phase 3)
- ✓ Mass Excel import with downloadable template and system-default fallbacks — v1.0 (Phase 4)
- ✓ Client pages creatable from the Notion-like project page creator — v1.0 (Phase 2)
- ✓ Real Microsoft Graph sent-mail sync matched to clients, "last 10 emails" per client — v1.0 (Phase 5)
- ✓ Credit-limit/payment-history risk evaluated as a first-class KPI evaluator — v1.0 (Phase 6)
- ✓ Red "frosted glass" risk semaphore at load-assignment time for over-limit clients — v1.0 (Phase 6)
- ✓ Over-limit assignment remains a hard 403 block; semaphore only visualizes it — v1.0 (Phase 6)
- ✓ A single generic `WorkspaceBlockRegistry` + `render(block, ctx)` engine, parameterized by block type/context, instantiable by more than one domain — v2.0 (Phase 7)
- ✓ One `WorkspaceBlockPlugin` contract expressing both native (code) and manifest (sandboxed) plugins, dispatching to the correct flavor — v2.0 (Phase 7)
- ✓ Page block registry is compile-time-exhaustive over all `PageBlockKind`s (a missing kind fails `tsc`, not production) — v2.0 (Phase 7)
- ✓ Project page read + edit rendering dispatch through the registry — no `switch(block.kind)` in `PageBlockView` or `LivePageCanvas` — v2.0 (Phases 8-9)
- ✓ Persisted page/program JSON and autosave payloads unchanged (no data migration) — v2.0 (Phase 8, statically verified; live pre/post diff still recommended as a follow-up, see STATE.md → Deferred Items)
- ✓ Slash menu + both builders' palettes derive from the registry via a shared `buildPaletteItems` helper — v2.0 (Phases 9, 11)
- ✓ Mini Program rendering runs on the same engine (`miniProgramBlockRegistry`, same `WorkspaceBlockRegistry` class); manifest plugins render via `DynamicBlockView` — v2.0 (Phase 10, round-trip statically verified; live smoke test still recommended, see STATE.md → Deferred Items)
- ✓ A developer can add a native or manifest block via one plugin entry, no dispatch-file edits — v2.0 (Phase 12, proven via the `callout` native block + `rowCountCallout` manifest plugin)
- ✓ No `switch(block.kind)` remains in any page or mini-program render/edit path; an ADR documents the engine, native-vs-manifest split, `keyOf` seam, and package-promotion path; `WorkflowBuilder.tsx` compiles unchanged and is documented as an explicitly deferred future migration target — v2.0 (Phase 13, `docs/ARCHITECTURE-WORKSPACE-ENGINE.md`)
- ✓ SEC-01: No production-facing fallback for `ENCRYPTION_KEY`; server refuses to boot without it set — v3.0 (Phase 14)
- ✓ SEC-02: No production-facing fallback for `JWT_SECRET`; server refuses to boot without it set — v3.0 (Phase 14)
- ✓ SEC-03: `017_seed_admin_user.sql` (`admin@admin.com`/`admin`) never runs in any customer-facing install — v3.0 (Phase 14)
- ✓ DEP-01: `docker-compose.prod.yml` assembles all 5 production images (marketplace, workspaces, cmr, api, matching-engine) + Postgres + Redis, persistent volumes, no committed secret defaults (`${VAR:?required}` on every secret), no host ports on datastores — v3.0 (Phase 16)
- ✓ DEP-02: `DEPLOYMENT_MODE=cloud|on-prem` boot-validated (hard-fail on unset/invalid) and cached in `secrets.ts`, read once via `getDeploymentMode()`; gates `signup()` with an unconditional 403 on `on-prem` — v3.0 (Phase 16)
- ✓ MIG-01: `schema_migrations` tracking table + `npm run migrate` runner applies pending numbered migrations in order, idempotently, recording each — v3.0 (Phase 15)
- ✓ MIG-02: First-run and upgrade use the same migration path; production stack drops the `docker-entrypoint-initdb.d` mounts — v3.0 (Phase 15 + 16)
- ✓ INS-01: Installer/first-run flow generates `JWT_SECRET`+`ENCRYPTION_KEY`, creates one company + real admin, runs migrations, writes `DEPLOYMENT_MODE=on-prem` — v3.0 (Phase 17), including a re-run-safety guard (gap closure, plan 17-03) and a documented "Fresh install" walkthrough (added during the v3.0 milestone audit — the installer existed but was undiscoverable from shipped docs)
- ✓ INS-02: Installer can optionally write a reachable local Gemma/Ollama endpoint into `company_ai_config` (`provider:'local'`) — v3.0 (Phase 17)
- ✓ AIL-01: Backend can call a server-reachable `local` AI provider (not only the browser path) — v3.0 (Phase 18)
- ✓ REL-01: One whole-release version (`VERSION` file + git tag), stamped into images and reported by `/health` — v3.0 (Phase 19)
- ✓ REL-02: `CHANGELOG.md` at repo root, one section per release, migration list generated from filenames — v3.0 (Phase 19)
- ✓ REL-03: The 5-step upgrade procedure replaces the manual per-file `psql` instructions in `docs/DEPLOYMENT.md` — v3.0 (Phase 19)
- ✓ HRD-01: CORS + Socket.IO origins restricted to env-configured app origins (not `*`) — v3.0 (Phase 20); required a post-ship fix during the milestone audit — `docker-compose.prod.yml` never forwarded the allowlist env vars into the `api` container, so the allowlist resolved empty in the actual shipped production compose
- ✓ HRD-02: Rate limiting on `/api/auth/*` at minimum — v3.0 (Phase 20); code review found + fixed a Critical issue in-phase (rate limiter 500s without `trust proxy` configured behind a reverse proxy), and the milestone audit found + fixed a second-order gap (the fix's env var also wasn't forwarded by `docker-compose.prod.yml`)
- ✓ HRD-03: `/health` (or `/ready`) actually verifies Postgres + Redis reachability — v3.0 (Phase 20)
- ✓ DOC-01: Customer-facing doc of the inbound-connectivity posture (reverse proxy exposing only `/api/webhooks/*` + `/api/pod/*`) — v3.0 (Phase 20)

### Active

v4.0 Workspace Records & Views: all 6 phases (21-26) complete, all requirements satisfied per REQUIREMENTS.md — pending `/gsd:complete-milestone` to formally close and archive.

- ✓ VIEW-02: User can view a collection as a flat list — Phase 26 (`CollectionListView.tsx`)
- ✓ VIEW-03: User can view a collection as a calendar, plotted by a date property — Phase 26 (`CollectionCalendarView.tsx`)
- ✓ VIEW-04: User can view a collection as a gallery with optional cover image — Phase 26 (`CollectionGalleryView.tsx`)
- ✓ VIEW-05: User can view a collection as a timeline/Gantt over two date properties — Phase 26 (`CollectionTimelineView.tsx`)

### Out of Scope

- Inbound email reply tracking / two-way email threading — only outbound "sent to client" history requested
- Automated dunning / collections workflows — not requested, would need its own design pass
- Multi-currency invoicing — existing invoices are EUR-only; not part of this rework
- Manager override for over-limit assignment — explicitly rejected in favor of matching the existing hard 403 block

## Context

- Monorepo: `apps/workspaces` (Next.js, tenant-facing app), `apps/api` (backend domains), `apps/cmr` (separate CMR app). See `.planning/codebase/` for full architecture, stack, and conventions docs.
- No ORM — raw idempotent SQL migrations in `database/migrations/`.
- Outlook integration currently syncs calendar events only (`calendar_events` table via Graph categories); no message/email storage exists anywhere in the codebase today. This is genuinely new integration work, not an extension of an existing sync job.
- KPI engine evaluators are currently team/activity-focused (activity volume, calendar). A client-risk evaluator is a new evaluator *type*, following the established pattern but on a different subject (clients, not team members).
- Project pages (the Notion-like canvas) are currently scoped to `project_id` via the `project_pages` table. Making client pages creatable from this canvas requires either a client-scoped pages table or modeling clients so the existing canvas can attach to them — an open design question for the roadmap/planning phase.
- "Per-project client settings" means: a client has global defaults (address, default rate, notes, responsible employee), and each project the client is attached to can override specific fields for that project only.

## Constraints

- **Existing 403 behavior**: The backend already blocks over-limit assignments at the API level — the new semaphore must visually reflect this, not introduce a second enforcement path — Why: avoid duplicate/conflicting business logic between old and new code.
- **No ORM**: All schema changes go through new idempotent SQL migration files following the existing `NNN_description.sql` convention — Why: matches established project convention, no Prisma/ORM in use.
- **Reuse over rebuild**: Excel import should reuse the existing `xlsx` package/pattern from `ExcelAutomationTool.tsx`; new-tab navigation should reuse `crossAppUrl`/existing link patterns — Why: consistency, less new surface area.
- **No global block-union merge**: `PageBlock` and `Block` (Mini Program) stay two typed registries sharing one generic `WorkspaceBlockRegistry` class, reconciled per-domain via `keyOf(block)` — Why: merging would churn persisted JSON discriminants for no gain (v2.0, Phase 7).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Repurpose "Records" sidebar slot → "CRM" at `/records` | That nav slot was never built out; avoids adding a second nav item | ✓ Good (v1.0) |
| Client detail pages open in a new tab | Matches existing app-wide pattern for entity detail views | ✓ Good (v1.0) |
| Real Microsoft Graph email sync (not stubbed) | Outlook OAuth integration already exists; delivers real value now rather than a placeholder | ✓ Good (v1.0) |
| Credit-risk semaphore is a KPI evaluator, not an ad-hoc flag | Matches existing extensible KPI engine architecture; reusable/configurable later | ✓ Good (v1.0) |
| Over-limit block remains hard, no override | Matches existing enforced 403 behavior; user explicitly rejected a manager-override path | ✓ Good (v1.0) |
| Per-project client settings are field-level overrides over client-level defaults | Clients can serve multiple projects with different terms (e.g. different rate per project) | ✓ Good (v1.0) |
| Email matching is by recipient address/domain across any team member's mailbox | No per-user mailbox scoping model exists today; broadest match is simplest and most useful | ✓ Good (v1.0) |
| Excel import template includes credit limit & default rate as optional columns | Avoids a manual follow-up pass for every imported client; blank falls back to system default | ✓ Good (v1.0) |
| Generalize the existing Mini Program plugin model rather than invent a new engine | Mini Programs already had a real manifest/sandbox/`DynamicBlockView` architecture; reusing it avoided a second design | ✓ Good (v2.0) |
| Keep `PageBlock` and `Block` as two typed registries over one generic `WorkspaceBlockRegistry` class, not one merged union | Merging would churn persisted discriminants for no gain; a per-domain `keyOf(block)` resolver reconciles the two data models instead | ✓ Good (v2.0) |
| Page registry entries are an explicit `Record<PageBlockKind, …>` literal | Compile-time exhaustiveness (ENG-03) — a missing kind fails `tsc`, not production | ✓ Good (v2.0) |
| WorkflowBuilder explicitly parked/deferred rather than migrated onto the engine now | Demo-only, no persistence, out of tight v2.0 scope; documented in the ADR as a named future migration target instead of silently ignored | ✓ Good (v2.0) |
| Boot-time secret validation rejects unset/empty/known-bad values only, not general secret strength | Roadmap Phase 14 success criteria are scoped to "no fallback secret is used," not entropy/length; a min-length/entropy check was flagged by code review as a follow-up hardening item, not a phase-goal gap | ✓ Good (v3.0, Phase 14) |
| SEC-03 (no seed admin) and DEP-02 (registration gate) are two independent, non-overlapping safeguards, not one merged check | They target different attack surfaces (raw seed SQL vs. the signup API) — merging them into one gate would be a single point of failure for two distinct threats | ✓ Good (v3.0, Phases 14+16, confirmed non-conflicting by the milestone audit's integration check) |
| Installer re-run safety (`isAlreadyInstalled`/`shouldBlockInstall`) added as a gap-closure plan, not folded into the original install.ts plan | Discovered as a real risk (re-running the installer against a live system could corrupt secrets/data) only during verification of the first pass — closed via `--force`-gated hard-stop rather than silently allowing re-runs | ✓ Good (v3.0, Phase 17, plan 17-03) |
| `TRUST_PROXY_HOPS` defaults to unset/fail-closed rather than assuming 1 hop | A code-review-found bug (rate limiter 500s behind a reverse proxy without `trust proxy` set) could have been "fixed" by hardcoding `app.set('trust proxy', 1)`, but that would silently trust an arbitrary topology; requiring explicit operator configuration avoids trusting more hops than actually exist (which would let a client spoof `X-Forwarded-For` to bypass rate limiting) | ✓ Good (v3.0, Phase 20 code review + milestone audit) |
| Milestone audit fixes gaps inline rather than only reporting them | The v3.0 audit found 2 real blockers (compose env-var passthrough, undocumented installer) that no single phase's own verification could catch, since each phase only tests its own module in isolation — fixing them immediately (with re-verification) avoided shipping a "passed" milestone that was actually broken in the real deployment artifact | ✓ Good (v3.0 milestone close) |

**Note on v2.0 verification debt:** the `verify_phase_goal` step appears to have been skipped during execution of Phases 7-11 (no VERIFICATION.md written, REQUIREMENTS.md checkboxes left unchecked). The v2.0 milestone audit independently re-confirmed all affected requirements via direct code/git inspection before shipping, but the pattern is worth watching for in future milestones — an executor completing tasks and writing SUMMARY.md is not the same as a verifier confirming the phase goal.

**The same pattern recurred once in v3.0:** Phase 18 was executed, marked complete in ROADMAP.md/REQUIREMENTS.md, and had a SUMMARY.md — but no VERIFICATION.md was ever created. Caught and closed during the v3.0 milestone audit (retroactively verified, 4/4 must-haves, no gaps). Two milestones in a row losing exactly one phase's verification step suggests this may be a recurring gap in the execute-phase flow worth a structural fix (e.g., a hard check that blocks phase-complete on a missing VERIFICATION.md), not just a one-off to re-catch at audit time.

**v3.0 also surfaced a distinct class of gap: phase-level verification passing while the milestone as a whole was still broken.** Two blockers (docker-compose.prod.yml never forwarding new env vars into the `api` container; the installer being undocumented) existed entirely in the seams *between* correctly-verified phases — Phase 20's own tests passed because they test the CORS/rate-limit modules in isolation, not the actual shipped compose file wiring. The cross-phase integration check (spawned during `/gsd:audit-milestone`) is what caught both; per-phase verification structurally cannot.

## Current State

**Shipped:** v1.0 CRM Rework (2026-07-06) — 6 phases, 15 plans, 33 tasks, all 23 requirements. A dedicated CRM module: dashboard, client detail pages, per-project overrides, bulk Excel import, real Outlook email sync, and a KPI-driven credit-risk semaphore hard-blocking over-limit load assignment. Archived at `.planning/milestones/v1.0-{ROADMAP,REQUIREMENTS}.md`.

**Shipped:** v2.0 Workspace Engine — Engine Unification (2026-07-12) — 7 phases, 8 plans, 10 tasks, all 14 requirements. Project Pages and Mini Programs now render through one shared, plugin-driven `WorkspaceBlockRegistry`; both hand-maintained `switch(block.kind)` dispatch paths are gone; extensibility proven end-to-end (native + manifest block added via one plugin entry each); `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` documents the result; the automations `WorkflowBuilder.tsx` is explicitly parked, untouched, as a future migration target. Archived at `.planning/milestones/v2.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`; phase directories archived at `.planning/milestones/v2.0-phases/`.

**Shipped:** v3.0 On-Premise GA (2026-07-13) — 7 phases, 16 plans, 31 tasks, all 17 requirements. Vectra is now a first-class On-Premise deployment of the same codebase: boot-time secret/seed-admin hardening, an idempotent shared migration runner, a `docker-compose.prod.yml` + `DEPLOYMENT_MODE` toggle, a re-run-safe one-shot installer, backend-side local Gemma/Ollama AI dispatch, one-`VERSION` release/upgrade tooling, and deploy hardening (CORS allowlist, auth rate limiting, live `/health` checks). The milestone audit found and fixed 2 real blockers inline before shipping — see Key Decisions and STATE.md → Deferred Items. Archived at `.planning/milestones/v3.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`; phase directories archived at `.planning/milestones/v3.0-phases/`.

**Phase 26 complete** (2026-07-15) — the last phase of v4.0. `BoardBlock.tsx` now renders all 6 view types (Board, Table, List, Calendar, Gallery, Timeline) over the same `collection_records`, zero new block kind, zero data duplication. Verifier scored 10/10 must-haves (`human_needed`: 3 live-browser checks pending in `26-HUMAN-UAT.md` — full 6-view-type cycle smoke test, config persistence across refresh, and a Calendar duplicate-create risk from code review WR-04). Code review found 5 non-blocking warnings (Timeline bar clamp, a copy-paste empty-state string, a stale-config race in the new property pickers, Calendar's missing double-click guard, Gallery's cover-image field expecting URLs from a freeform text property) — see `26-REVIEW.md`.

Deferred at v1.0 close: 7 pending human-UAT scenarios (Phase 02/03) + 2 verification sign-offs — manual checks on shipped features, tracked in STATE.md → Deferred Items.

Deferred at v2.0 close (tech debt, no functional gaps — see `.planning/milestones/v2.0-MILESTONE-AUDIT.md`): Phases 7-11 are missing formal `VERIFICATION.md` (never run after execution; independently re-confirmed wired by the milestone audit's integration check via direct code inspection + fresh `tsc --noEmit`); REQUIREMENTS.md checkboxes were stale for 8/14 requirements as a result (now archived with corrected status in the audit report); a live pre/post diff of persisted page JSON (RND-03) and a live mini-program round-trip run (MPG-02) were only statically traced, not runtime-executed — recommend backfilling via `/gsd:validate-phase` per phase if the audit trail needs to be complete.

Deferred at v3.0 close (tech debt, no functional gaps — see `.planning/milestones/v3.0-MILESTONE-AUDIT.md`): Phase 20's `/health` has no timeout on its Postgres/Redis probes (a hung, not refused, connection could hang the endpoint); its auth rate limiter shares one bucket across all 5 endpoints (a locked-out attacker could also lock a legit user out of `/forgot-password`); CORS origin normalization/doc-comment/duplication cleanup. Phase 16's live `docker compose config` validation against real secrets remains a manual check, never automated. Phase 18 was missing a formal `VERIFICATION.md` (same class of gap as v2.0's Phases 7-11) — closed retroactively during the audit.

## Next Milestone Goals

v4.0 Workspace Records & Views is now the active milestone (see Current Milestone above).

Deferred from v3.0, not promoted into v4.0 (candidates for a future milestone): LIC-01 offline licensing/activation, SCALE-01/02 cloud multi-replica scaling, AIL-02 Vectra-hosted AI tier (all tracked in the archived `v3.0-REQUIREMENTS.md`). Also deferred: the remaining `docs/specs/core/` gaps not covered by v4.0 — KPI scheduler + `response_time` evaluator (`kpi-engine.md`), a few generic program-builder blocks (`program-builder.md`), Document AI/OCR real wiring (`ai-integration.md` §6.2), event-spine retention/partitioning strategy (`event-spine.md` §8). `task_completion`/`on_time_delivery` KPI evaluators specifically depend on v4.0's Records+Views model shipping first.

## Platform Vision & Architecture (North Star)

> Enduring product vision the current work builds toward — steering context, **not** the active build scope (tracked under Current Milestone above). Sourced from the Vectra business plan + the CLAUDE.md steering rules. Hardware, Vectra Academy, and the IT-Partner network are long-term business-plan items and are **explicitly out of current build scope** (see §"Ecosystem & Revenue").

### What Vectra Is

Vectra is a purpose-built **Workspace platform for logistics** — not another TMS, ERP, or AI product. It replaces the fragmented daily toolset (Excel, Outlook, WhatsApp, Teams, Notion, Google Drive, assorted TMS/ERP systems) with one modular, deeply customizable workspace the company fully owns. Target framing: the **operating system for a logistics company** — where dispatchers, drivers, warehouse staff, and management do their daily work.

**Core promise — data sovereignty:** Vectra is **On-Premise by default.** All data stays on the customer's own server; nothing is stored in Vectra's cloud unless the customer explicitly opts into the *Vectra AI* service or the *App Store*. AI is strictly a support tool, never the center of the product.

### Steering rule — platform-core vs. vertical modules

- **Generic core primitives** (workspace, program, record, template, automation, integration, metric, and generic page-block types: rich-text, heading, chart, kpi-grid, kanban, activity-timeline, etc.) stay generic. New generic capability goes here.
- **Named vertical blocks/domains** (fleet, ltl, yard, pod, crm, vat, marketplace, cmr) are an accepted, explicit product layer — the "Business Modules" / logistics smart blocks. New vertical features go into their own domain + block kind, not scattered into generic primitives.
- **No single-tenant logic** — nothing that only makes sense for one customer (vs. the vertical as a whole) belongs anywhere in `apps/*` or `packages/*`.
- **Do not port `blg_master` code** — it is a pattern reference only, never a source of literal code or copy.

### The Five Engines

The platform is five interconnected but independent systems:

1. **Workspace Engine** — the content/knowledge core. Projects, sub-pages, SOPs, knowledge base, operational instructions. Tree-structured pages (unlimited nesting: Projects → Client → Shipments → SOP → Finance → Notes), each built from modular blocks.
2. **Database Engine** — business objects (Shipment, Customer, Carrier, Driver, Vehicle, Trailer, Warehouse, Route, Invoice, CMR, Task, Port, Terminal, and user-defined) modeled as **rich records that are also full workspace pages**: properties + relations + files + comments/mentions + record-scoped automations + a live collaboration page. Same data, multiple views: **Table, Kanban, Calendar, Timeline (Gantt), Gallery.**
3. **Automation Engine** — no-code graphical **Workflow Builder** (drag-and-drop). Triggers: new email, new shipment, status change, date/time, QR scan, new document, OCR result, new CMR, HTTP request. Actions: Outlook/Gmail send, WhatsApp/SMS, OCR, PDF parse, HTTP request, in-app notification, approval, delay, conditions, loops, webhooks, database create/update/delete.
4. **Integration Engine** — connectivity to the outside world: Outlook, Gmail, WhatsApp, SMS; REST/SOAP/EDI/SFTP/Webhooks; ERP + accounting (e.g. Minimax, Zantheon) + customs systems; telematics/GPS (Geotab, Samsara); cloud storage (Drive, OneDrive, SharePoint — as source/consumer only, data stays under customer control).
5. **Business Modules** — the specialized logistics modules that plug onto the Workspace Engine (see Module Map).

### Navigation / Module Map (left sidebar)

Dashboard · Projects (tree) · CMR Customers · Programs · My Fleet · Procurement · LTL Marketplace · Storage Marketplace · Team · PWA Manager · Routes · CMR Manager · App Store · Settings.

### Block System (the `/` palette)

Pages are composed of blocks inserted via `/`, in categories:
- **Basic:** heading (to level 4), paragraph, bullet/numbered list, checklist, toggle, divider, quote, callout.
- **Media:** image, PDF embed, video, files, bookmarks, embeds.
- **Collaboration:** comments (threaded), mentions, assignments, status, dates, buttons (action triggers).
- **Database:** table, kanban, calendar, timeline/Gantt, gallery, charts.
- **Logistics smart blocks:** Shipment, Vehicle, Driver, Route, Warehouse, Container, Fleet, Marketplace, Storage, CMR — plus the already-shipped `crm-clients`, and existing vertical kinds (`fleet-telematics`, `spot-quote`, `railway-terminal`, `yard-map`, `pod-tracker`, `vat-matrix`, `ltl-matches`, `smart-inbox`).

### Programs

Under **Programs**: **Templates** (pre-built workspace pages: Shipment, Customer, Warehouse, Port, SOP, Driver Instructions — adaptable and re-savable), **Mini Programs** (no-code micro-apps built from blocks/forms: VIN Validator, Route Calculator, Cost/Fuel Calculator, Container Checker, etc.), and **Automations** (the Workflow Builder, with enable/disable + execution logs).

### Business Modules (detail)

- **Procurement** — digitized RFQ: dispatcher builds an RFQ, auto-distributes to a carrier group (email/API/WhatsApp/portal), system normalizes returned quotes into one format, dispatcher compares price/terms/ratings, one-click select → notifies all parties + creates a Shipment.
- **PWA Manager** — mobile driver instructions as a PWA link (QR check-in code, forwarder data, destination, load/unload locations, cargo/VINs, terminal PIN, contacts, special notes, interactive checklist). Smart location templates (e.g. "Luka Koper", "Port of Trieste", "MSC Terminal") auto-fill known instructions.
- **QR Check-In** — certified QR reader at gate scans the driver's PWA code; Vectra instantly shows driver, plate, company, shipment ref, destination, load/unload, PIN, container, VINs, notes.
- **CMR Digital Workflow** — dispatcher prepares CMR → sent to driver via PWA → optional Bluetooth print in cab → driver photographs signed CMR → OCR validates signatures/dates/numbers/missing fields (AI fallback when OCR fails) → auto-completes shipment, archives + links CMR, notifies dispatcher, triggers downstream automations (invoicing, accounting archive).
- **Marketplace** — LTL Marketplace (post/find partial loads) + Storage Marketplace (find/offer pallet/warehouse capacity).
- **Fleet** — vehicles, drivers (licenses, AETR hours), trailers, service/maintenance reminders + history, documentation, GPS/telematics live tracking.
- **Team** — users, groups, permissions (project/data-level), departments (dispo/forwarding/accounting), tasks + comments.

### AI — support tool only

Company-level AI config is deployment-mode-aware and supports three install modes (extend `company_ai_config`, don't fork):
1. **BYOK** — customer's own API key (OpenAI / Gemini / Grok); backend-proxied, key encrypted at rest.
2. **Local Gemma** — open-source model on the customer's server; nothing leaves the building.
3. **Vectra AI** (paid subscription) — Vectra-hosted secure server for customers without capable hardware.

**AI performs ONLY these functions** (a hard product constraint — the system deliberately contains no other AI features): help build Mini Programs (describe → AI assembles blocks); help build automations (suggest steps); analyze OCR documents when classic OCR fails; extract spot-quote data from emails; convert unstructured email inquiries into structured Procurement records.

### On-Premise & Deployment Mode (current strategic priority)

**Goal:** make Vectra deployable On-Premise at a customer site as a first-class target — **one codebase, one `DEPLOYMENT_MODE=cloud|on-prem` toggle** (env-driven, read once at boot), never a "lite" fork. Follow the `company_ai_config` pattern (a config value selects behavior, not a code branch).

Known cloud-only assumptions to make optional: **auth/SSO** (must work without wildcard-subdomain cookie sharing — on-prem may be a single internal domain or bare IP); **secrets** (installer must generate `ENCRYPTION_KEY` & friends on first run, no call-home); **inbound webhooks** (need outbound/polling fallback behind firewalls); **multi-tenancy** (schema already `company_id`-scoped → on-prem = seed one company, no schema fork).

New work this phase requires: licensing/activation (seat/module gating without a permanent cloud link); an on-prem release/update pipeline (versioned tagged Docker images + the existing idempotent numbered migrations — reuse, don't reinvent); an installer/first-run flow (seed company, generate secrets, pick mode, configure local AI).

### Build-sequence discipline

Tenant isolation (`company_id` scoping) and the `activity_events` event spine are the foundation everything reads from. **Do not introduce KPI/statistics logic that bypasses `activity_events` in favor of ad-hoc counters** — even under on-prem time pressure.

### When in doubt

If a change only makes sense for Cloud *or* only for On-Premise, stop and make it a **config toggle**, not a fork. If a specific subsystem genuinely can't be toggled, flag it explicitly rather than quietly building single-mode behavior into shared code.

### Ecosystem & Revenue (business context — out of current build scope)

Long-term business-plan layers, tracked here for context but **not** part of the current build sequence:
- **App Store** — installable third-party extensions (ERP/customs integrations, calculators, dashboard widgets, mini programs, workflow templates, block plugins); 20–30% revenue share.
- **Hardware (HaaS)** — Standard Server + AI Server (GPU, local Gemma), certified QR readers, certified Bluetooth CMR printers; sale or leasing.
- **Vectra Academy** — training + certification (Operator, Builder, Architect); paid courses/exams.
- **IT Partner Network** — certified implementers/developers; annual membership or deal commission.
- **Revenue pillars:** (A) software/subscriptions — core license, per-seat, paid modules, Vectra AI, App Store commission; (B) hardware — servers/readers/printers, one-time + leasing; (C) services/ecosystem — Academy, partner program, premium templates/mini-programs.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-15 — Phase 26 (Additional View Types) complete, closing out v4.0 Workspace Records & Views; milestone pending formal close via `/gsd:complete-milestone`.*
