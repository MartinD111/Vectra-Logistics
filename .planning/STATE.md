---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Workspace Engine — Engine Unification
status: planning
last_updated: "2026-07-06T16:09:17.208Z"
last_activity: 2026-07-06
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-05)

**Core value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.
**Current focus:** v1.0 CRM Rework archived. Next milestone: **Workspace Engine v2.0 — Engine Unification** (unify the three block/node systems into one plugin-driven registry). Start via `/gsd-new-milestone`.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-07-06 — Milestone v2.0 started

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: N/A
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 04 | 2 | - | - |
| 05 | 2 | 55min | 27.5min |
| 06 | 2 | 60min | 30min |

**Recent Trend:**

- Last 5 plans: N/A
- Trend: N/A

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Phase 1 must resolve `kpi_results.user_id NOT NULL` schema issue before Phase 6 (risk evaluator) can be built — treated as explicit early decision, not discovered mid-implementation
- Roadmap: Dedicated `crm` API domain (Phase 1) precedes all frontend/feature work — CRM logic currently fragmented in `billing`
- Roadmap: `email_messages` table lands in Phase 1 alongside other schema so Phase 5 (email sync) has no missing-table blocker
- Phase 3: Linked Projects UI placed in the main column above LivePageCanvas (not the 320px sidebar); per-field override toggle uses explicit "Override"/"Reset to default" text buttons per D-04; unlink requires confirm dialog, per-field reset does not
- Phase 5: First node:test-based test suite in apps/api (ts-node --require register), pinned to ts-node-dev's resolved ^10.4.0; syncEmails() mirrors syncCalendar()'s exact silent-skip contract; email.worker.ts mirrors telematics.worker.ts's single-job-sweeps-all-companies + Promise.allSettled design (15-min interval vs telematics' 5-min)
- Phase 6: credit_risk KPI evaluator targets a single client (target_client_id) or company-wide (null), mirroring target_project_id/target_user_id; "bad payment history" = any invoice with status='approved' and due_at passed (no new schema); computeCreditRiskDetail() is a shared pure function used by both the evaluator and crmService.getClientRisk() to avoid duplicated risk logic; the frosted-glass semaphore reads live client data directly (not KPI results) so it has zero dependency on evaluator cadence; no new BullMQ scheduler for KPI evaluation — stays on-demand like all existing evaluators

### Pending Todos

None yet.

## Deferred Items

Items acknowledged and deferred at v1.0 milestone close on 2026-07-06:

| Category | Item | Status |
|----------|------|--------|
| uat | Phase 02 human-UAT (02-HUMAN-UAT.md) — 5 pending scenarios | partial |
| uat | Phase 03 human-UAT (03-HUMAN-UAT.md) — 2 pending scenarios | partial |
| verification | Phase 02 verification (02-VERIFICATION.md) | human_needed |
| verification | Phase 03 verification (03-VERIFICATION.md) | human_needed |

These are manual sign-offs on already-shipped CRM features (incl. the credit-risk semaphore). Run before/during production rollout; not blocking the v2.0 engine work.

### Blockers/Concerns

- [Phase 1] `kpi_results.user_id` is NOT NULL today — needs schema resolution (nullable + `client_id` column, or equivalent) before Phase 6's client-subject risk evaluator can write results (already resolved via migration 021 — nullable + client_id column added; Phase 6 unblocked)
- [Phase 5] Migration 023's idempotency was verified by manual SQL inspection only — no live PostgreSQL container was available in the execution environment to run it twice against a real DB. Worth a real dry-run before/during deployment.
- [Phase 5] `integration_credentials` table has no formal migration (schema drift risk) — not fixed incidentally during Phase 5 since no Outlook credentials-table changes were needed (only last_sync_at, which is a pre-existing column)
- [Phase 6] Migration 024's idempotency also verified by manual SQL inspection only, same reason (no live DB in this environment) — worth a real dry-run before/during deployment, same as migration 023.
- [Phase 6] `crmService.getClientEmails()` (separate from the timeline's real email read path) still returns a hardcoded empty array — a pre-existing stub noticed but out of this phase's RSK-01/02/03 scope; worth fixing in a future cleanup pass since Phase 5 already made real email data available via `crmRepository.listClientEmails()`.

## Session Continuity

Last session: 2026-07-06T16:30:00.000Z
Stopped at: Phase 06 complete — v1.0 milestone complete, all 6 phases and 23 requirements shipped
Resume file: .planning/phases/06-credit-risk-kpi-evaluator-semaphore/06-02-SUMMARY.md

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
