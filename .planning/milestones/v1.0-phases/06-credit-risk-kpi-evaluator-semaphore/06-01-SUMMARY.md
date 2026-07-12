---
phase: 06-credit-risk-kpi-evaluator-semaphore
plan: 01
subsystem: api
tags: [kpi, credit-risk, postgresql, node:test]

requires:
  - phase: 01-schema-crm-domain-foundation
    provides: kpi_results.client_id + nullable user_id, kpi_results_subject_check CHECK constraint
provides:
  - credit_risk KPI evaluator (utilization + overdue-invoice risk), registered in the evaluator registry
  - kpi_rules.target_client_id column, mirroring target_project_id/target_user_id
  - client-shaped kpi_results writes (upsertResult accepts client_id) and reads (listResults/getSummary clientId filter)
  - crmService.getClientRisk() returns real computed risk instead of a hardcoded stub
affects: []

tech-stack:
  added: []
  patterns: ["client-subject KPI evaluator following the existing pluggable evaluator interface"]

key-files:
  created:
    - database/migrations/024_kpi_target_client.sql
    - apps/api/src/domains/kpi/evaluators/creditRisk.evaluator.ts
    - apps/api/src/domains/kpi/evaluators/creditRisk.evaluator.test.ts
  modified:
    - apps/api/src/domains/kpi/kpi.types.ts
    - apps/api/src/domains/kpi/kpi.repository.ts
    - apps/api/src/domains/kpi/kpi.service.ts
    - apps/api/src/domains/kpi/kpi.controller.ts
    - apps/api/src/domains/kpi/dto/kpiRule.dto.ts
    - apps/api/src/domains/kpi/evaluators/index.ts
    - apps/api/src/domains/kpi/evaluators/outlookCalendar.evaluator.ts
    - apps/api/src/domains/kpi/evaluators/activityVolume.evaluator.ts
    - apps/api/src/domains/crm/crm.service.ts

key-decisions:
  - "computeCreditRiskDetail() is a standalone exported pure function so both the evaluator and crmService.getClientRisk() share identical risk logic with zero duplication"
  - "over_limit uses the exact same outstanding_balance >= credit_limit comparison as CreditBar (frontend) and assertCreditOk (billing) so all three surfaces agree"
  - "'Bad payment history' = any invoice with status='approved' (unpaid) and due_at in the past — no new schema, matches CONTEXT.md D-01"
  - "KpiResult.user_id and KpiEvaluatorOutput.user_id changed from string to string | null to match the DB schema already made nullable in migration 021 — this was a latent type/schema mismatch fixed incidentally"

patterns-established:
  - "Client-subject KPI evaluators resolve targets via a private resolveTargetClients() method mirroring the existing resolveTargetUsers() pattern in activityVolume.evaluator.ts"

requirements-completed: [RSK-01]

duration: 45min
completed: 2026-07-06
---

# Phase 6 Plan 1: Credit-risk KPI evaluator and client-subject schema Summary

**credit_risk KPI evaluator computing utilization + overdue-invoice risk per client, with kpi_rules.target_client_id and a real (non-stub) GET /crm/clients/:id/risk response**

## Performance

- **Duration:** 45 min
- **Tasks:** 3 completed
- **Files modified:** 12

## Accomplishments
- New `credit_risk` KPI evaluator follows the exact `KpiEvaluator` interface used by `activityVolume`/`outlookCalendar`, targeting either one client (`target_client_id`) or every client in the company (null)
- Fixed a latent type/schema mismatch: `KpiResult.user_id`/`KpiEvaluatorOutput.user_id` were typed `string` even though the DB column has been nullable since migration 021 — now correctly `string | null`, with `client_id: string | null` added to both
- `kpi_rules.target_client_id` added via migration 024, validated the same way `target_project_id`/`target_user_id` already are (`assertOwnedClient`)
- `crmService.getClientRisk()` — previously a hardcoded `{status:'unavailable'}` stub despite being wired end-to-end to `GET /crm/clients/:id/risk` from a prior phase — now returns real computed risk, reusing the evaluator's exact `computeCreditRiskDetail()` logic
- 18 total unit tests pass (6 new for the evaluator/pure function, 12 pre-existing from Phase 5 unaffected)

## Task Commits

1. **Task 1: Migration + kpi.types.ts fixes + creditRisk evaluator** - `93564ee` (feat)
2. **Task 2: kpi.repository/service wiring + evaluator registration** - `e63675c` (feat)
3. **Task 3: crmService.getClientRisk() real computation** - `87240f9` (feat)

## Files Created/Modified
- `database/migrations/024_kpi_target_client.sql` - Adds kpi_rules.target_client_id (nullable UUID FK)
- `apps/api/src/domains/kpi/evaluators/creditRisk.evaluator.ts` - New evaluator + exported computeCreditRiskDetail() pure function
- `apps/api/src/domains/kpi/evaluators/creditRisk.evaluator.test.ts` - 6 unit tests
- `apps/api/src/domains/kpi/kpi.types.ts` - target_client_id, nullable user_id, client_id fields
- `apps/api/src/domains/kpi/kpi.repository.ts` - client-shaped upsertResult, clientId filters, 4 new evaluator-support lookups
- `apps/api/src/domains/kpi/kpi.service.ts` - assertOwnedClient, client_id passthrough in runEvaluation
- `apps/api/src/domains/kpi/kpi.controller.ts` - client_id query param on listResults/getSummary
- `apps/api/src/domains/kpi/dto/kpiRule.dto.ts` - credit_risk source type, target_client_id schema field
- `apps/api/src/domains/kpi/evaluators/index.ts` - creditRiskEvaluator registered
- `apps/api/src/domains/kpi/evaluators/outlookCalendar.evaluator.ts`, `activityVolume.evaluator.ts` - client_id: null added to outputs (type-fix propagation)
- `apps/api/src/domains/crm/crm.service.ts` - getClientRisk() real computation

## Decisions Made
- Followed CONTEXT.md D-01 through D-05 exactly as discussed — no deviations on payment-history definition, targeting mechanism, or evaluation cadence (on-demand only, no new scheduler).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript rejected passing the named `CreditRiskDetail` interface directly as a `Record<string, unknown>` detail field (structural typing gap with excess-property-style index signature checks). Fixed by spreading into a plain object (`{ ...detail }`) at the evaluator's return site — no behavior change, purely a type-level fix.

## Next Phase Readiness

06-02 (frontend semaphore) can proceed independently — it reads live client data directly, not this evaluator's results, per CONTEXT.md D-05/D-07. No blockers.

---
*Phase: 06-credit-risk-kpi-evaluator-semaphore*
*Completed: 2026-07-06*
