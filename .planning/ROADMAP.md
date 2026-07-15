# Roadmap: Vectra

## Milestones

- ✅ **v1.0 CRM Rework** — Phases 1-6 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Workspace Engine — Engine Unification** — Phases 7-13 (shipped 2026-07-12) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 On-Premise GA** — Phases 14-20 (shipped 2026-07-13) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Workspace Records & Views** — Phases 21-26 (shipped 2026-07-15) — [archive](milestones/v4.0-ROADMAP.md)
- 🚧 **v5.0 Platform Foundation & Durable Execution** — Phases 27-30 (active)

## Phases

<details>
<summary>✅ v1.0 CRM Rework (Phases 1-6) — SHIPPED 2026-07-06</summary>

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Workspace Engine — Engine Unification (Phases 7-13) — SHIPPED 2026-07-12</summary>

Full detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Milestone audit: [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v3.0 On-Premise GA (Phases 14-20) — SHIPPED 2026-07-13</summary>

Full detail: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)
Milestone audit: [milestones/v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v4.0 Workspace Records & Views (Phases 21-26) — SHIPPED 2026-07-15</summary>

- [x] Phase 21: Missing Content Blocks (5/5 plans)
- [x] Phase 22: Records + Views Data Model (4/4 plans)
- [x] Phase 23: Record Detail Page (2/2 plans)
- [x] Phase 24: Board View & Legacy Kanban Migration (4/4 plans)
- [x] Phase 25: View UX Parity (4/4 plans)
- [x] Phase 26: Additional View Types (5/5 plans)

Full detail: [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)
Requirements archive: [milestones/v4.0-REQUIREMENTS.md](milestones/v4.0-REQUIREMENTS.md)
Milestone audit: [milestones/v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md) — status: tech_debt, 30/30 requirements satisfied; manual UAT and warning-level UI follow-ups deferred.

</details>

<details open>
<summary>🚧 v5.0 Platform Foundation & Durable Execution (Phases 27-30) — ACTIVE</summary>

- [x] **Phase 27: Baseline Truth & Roadmap Reconciliation** — Inventory current apps/packages/services/routes/migrations, map imported roadmap phases to shipped/partial/demo/absent/deferred, document baseline build/test/local boot status, and identify ADR gaps. (completed 2026-07-15)
- [ ] **Phase 28: Security, Tenancy & Capabilities Foundation** — Introduce typed `RequestContext`, a capability service, pilot cross-tenant test harness, signed public endpoint pattern, and explicit production/demo capability behavior.
- [ ] **Phase 29: Event Spine & Durable Outbox** — Define versioned event envelope, add durable outbox migration, convert one service mutation to transactional state+event write, and add dispatcher retry/idempotency behavior.
- [ ] **Phase 30: Workflow MVP Persistence & Manual Trigger** — Persist workflow drafts, wire builder save/load, run a manual trigger with notification action, and show durable run/step logs with validation and duplicate protection.

</details>

## Phase Details

### Phase 27: Baseline Truth & Roadmap Reconciliation

**Goal:** Maintainers can see exactly what exists, what is demo/stubbed, what still needs ADRs, and how the imported roadmap maps onto the shipped platform.
**Depends on:** v4.0 closeout
**Requirements:** BASE-01, BASE-02, BASE-03, BASE-04

**Success Criteria:**

1. `docs/architecture/current-state-truth-matrix.md` maps every imported roadmap phase to shipped, partial, demo, absent, or deferred status.
2. Inventory covers apps, packages, services, migrations/tables, queues/workers, route domains, and public endpoints.
3. Baseline commands for lint, typecheck, tests, builds, migrations, and local boot are documented with pass/fail status and not mass-fixed opportunistically.
4. ADR gap list names the decisions required before architecture-changing PRs.

**Agent owner:** Repo Auditor Agent with Lead Architect Agent review.

### Phase 28: Security, Tenancy & Capabilities Foundation

**Goal:** API requests and future actions share one typed identity/capability model, and pilot domains prove tenant isolation through tests.
**Depends on:** Phase 27
**Requirements:** SECCTX-01, SECCTX-02, SECCTX-03, SECCTX-04, SECCTX-05

**Success Criteria:**

1. One typed request context is available to pilot route handlers without duplicating auth parsing.
2. Capability checks cover workspace admin, page edit, record read/write, program build/run, workflow build/run, integration admin, and module permissions.
3. Cross-tenant negative tests fail if pilot repositories omit company scope in SQL.
4. Public/integration endpoint pattern uses signed token/API key/HMAC validation and documents migration path for existing public endpoints.
5. Demo mode/capability response is explicit, and production mode never silently synthesizes operational data.

**Agent owner:** Backend Security Agent with QA/Release Agent.

### Phase 29: Event Spine & Durable Outbox

**Goal:** Meaningful service mutations can emit durable, versioned events without depending on best-effort UI calls.
**Depends on:** Phase 28
**Requirements:** EVENT-01, EVENT-02, EVENT-03, EVENT-04, EVENT-05

**Success Criteria:**

1. Event envelope is versioned and includes tenant, actor, object, project, causation, correlation, payload version, and payload.
2. The next verified SQL migration after `025_records_views.sql` adds an idempotent, tenant-aware outbox table with useful indexes.
3. One pilot service mutation writes domain state and outbox event in the same database transaction.
4. Dispatcher marks events published/failed with retry counts and protects against duplicate publication.
5. Event catalog documentation lists the pilot event and expected consumer contract.

**Agent owner:** Data/Event Agent with Backend Security Agent.

### Phase 30: Workflow MVP Persistence & Manual Trigger

**Goal:** The existing automation UI stops being a mock-only surface and can save, reload, validate, manually run, and inspect a simple workflow.
**Depends on:** Phase 29
**Requirements:** WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-04, WFLOW-05, WFLOW-06

**Success Criteria:**

1. Workflow drafts persist server-side with tenant scope, version/status, graph JSON, and audit metadata.
2. Automation list/builder reads real workflows and can save draft edits.
3. Manual trigger runs a workflow containing a notification action and creates one persisted run.
4. Run detail shows durable step logs, attempts, timestamps, errors, and correlation/event ids.
5. Duplicate manual triggers are protected by idempotency, and retries obey limits.
6. Unsupported or capability-denied triggers/actions are rejected before publish/run.

**Agent owner:** Programs/Automation Agent with Data/Event Agent.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 21. Missing Content Blocks | v4.0 | 5/5 | Complete | 2026-07-13 |
| 22. Records + Views Data Model | v4.0 | 4/4 | Complete | 2026-07-14 |
| 23. Record Detail Page | v4.0 | 2/2 | Complete | 2026-07-14 |
| 24. Board View & Legacy Kanban Migration | v4.0 | 4/4 | Complete | 2026-07-14 |
| 25. View UX Parity | v4.0 | 4/4 | Complete | 2026-07-15 |
| 26. Additional View Types | v4.0 | 5/5 | Complete | 2026-07-15 |
| 27. Baseline Truth & Roadmap Reconciliation | v5.0 | 1/1 | Complete    | 2026-07-15 |
| 28. Security, Tenancy & Capabilities Foundation | v5.0 | 0/1 | Not started | - |
| 29. Event Spine & Durable Outbox | v5.0 | 0/1 | Not started | - |
| 30. Workflow MVP Persistence & Manual Trigger | v5.0 | 0/1 | Not started | - |

---
*Roadmap updated: 2026-07-15 — v4.0 archived, v5.0 Platform Foundation & Durable Execution started.*
