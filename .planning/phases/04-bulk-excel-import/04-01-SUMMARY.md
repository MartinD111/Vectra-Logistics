---
phase: 04-bulk-excel-import
plan: 01
subsystem: api
tags: [zod, postgres, crm, express, bulk-import]

# Dependency graph
requires:
  - phase: 01-schema-crm-domain-foundation
    provides: crm API domain (controller/service/repository/routes/types/DTOs), clients table with vat_id/responsible_employee_id/address columns
provides:
  - "Real POST /api/v1/crm/clients/import backend logic (replaces 501 stub)"
  - "Company-scoped findClientByVatId and findMemberByEmail repository lookups"
  - "ImportRowResult / ImportClientsResult report types for the frontend import modal (Plan 02)"
affects: [04-02-frontend-import-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-row batch validate/insert loop with per-row try/catch instead of a batch-wide throw, so one bad row never aborts the rest (D-03)"
    - "Server-side email-to-id resolution before Zod validation: raw responsible_employee_email is swapped for a resolved responsible_employee_id (or null) before CreateClientSchema.safeParse runs, preventing a row from smuggling an arbitrary employee UUID (T-04-04)"

key-files:
  created: []
  modified:
    - apps/api/src/domains/crm/crm.repository.ts
    - apps/api/src/domains/team/team.repository.ts
    - apps/api/src/domains/crm/crm.service.ts
    - apps/api/src/domains/crm/crm.types.ts

key-decisions:
  - "Per-row commit, not all-or-nothing — a batch with 3 bad rows out of 200 still creates the other 197 (D-03)"
  - "Duplicate VAT ID and non-matching employee email are both company-scoped lookups, never global (T-04-02)"
  - "Blank credit_limit defaults to 10000, blank default_rate_eur stays null, matching the existing single-add createClient convention (D-06)"

patterns-established:
  - "Cross-domain company-scoped lookup helper (resolveResponsibleEmployee) mirrors the existing assertOwnedProject private-method style in the same service class"

requirements-completed: [IMP-02, IMP-03, IMP-04]

duration: 12min
completed: 2026-07-06
---

# Phase 4 Plan 1: Bulk Excel Import Backend Summary

**Real per-row batch import logic for `POST /api/v1/crm/clients/import`, replacing the 501 stub with company-scoped duplicate-VAT and responsible-employee-email validation that never aborts the whole batch on a single bad row.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-06T11:07:00Z
- **Completed:** 2026-07-06T11:19:47Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `crmService.importClients` now iterates an array of row objects, resolving `responsible_employee_email` to a company-scoped `responsible_employee_id`, rejecting duplicate VAT IDs within the same company, validating each row via the existing `CreateClientSchema`, and inserting valid rows via the existing `crmRepository.createClient`
- Added `crmRepository.findClientByVatId(vatId, companyId)` and `teamRepository.findMemberByEmail(email, companyId)` — both explicitly company-scoped, unlike the existing global `emailExists`
- Added `ImportRowResult` / `ImportClientsResult` types to `crm.types.ts` for a structured per-row report (`{ created, failed, results: [{ row, status, client?, reason? }] }`)
- No changes needed to `crm.controller.ts` or `crm.routes.ts` — both were already correctly wired per Phase 4 context/patterns

## Task Commits

1. **Task 1: Add company-scoped lookup methods to crm.repository.ts and team.repository.ts** - `096e275` (feat)
2. **Task 2: Implement importClients batch loop in crm.service.ts + report types in crm.types.ts** - `60d70b2` (feat)

**Plan metadata:** (this commit, SUMMARY.md)

_Note: `tdd="true"` was set on both tasks in the plan, but no test runner (jest/vitest) is configured in `apps/api` — verification fell back to `npx tsc --noEmit` plus manual code-path tracing per the plan's own fallback instruction. No RED/GREEN test commits exist; see "TDD Gate Compliance" below._

## Files Created/Modified
- `apps/api/src/domains/crm/crm.repository.ts` - added `findClientByVatId(vatId, companyId)`, company-scoped duplicate-VAT lookup
- `apps/api/src/domains/team/team.repository.ts` - added `findMemberByEmail(email, companyId)`, company-scoped email lookup (existing global `emailExists` left untouched)
- `apps/api/src/domains/crm/crm.service.ts` - replaced the `importClients` 501 stub with a real per-row batch loop; added private `resolveResponsibleEmployee` helper
- `apps/api/src/domains/crm/crm.types.ts` - added `ImportRowResult` and `ImportClientsResult` interfaces

## Decisions Made
- Followed the plan's exact field-mapping and defaulting convention from the existing `createClient` method (no new validation rules introduced) — plan executed as written, no deviation in behavior.

## Deviations from Plan

None - plan executed exactly as written. Repository methods, service loop, and types match the plan's `<action>` blocks field-for-field.

## TDD Gate Compliance

Both tasks were marked `tdd="true"` in the plan, but `apps/api/package.json` has no test script and no jest/vitest devDependency — there is no test runner configured for this workspace. The plan's own acceptance criteria anticipated this ("verify via `npx tsc --noEmit` plus a manual smoke test... since no existing crm.service test file exists yet"). No `test(...)` (RED) or separate `feat(...)` (GREEN) gate commits were created; each task was committed once as a single `feat` commit after implementation, verified via `npx tsc --noEmit` (no new errors in `crm`/`team` files) and manual trace of the 3-row example (valid / duplicate-VAT / bad-employee-email) against the implemented control flow.

## Issues Encountered

- `npx tsc --noEmit` in `apps/api` reports two pre-existing errors in `src/core/db/redis.ts` (missing `redis` type declarations) unrelated to this plan's files — out of scope per the deviation rules' scope boundary; not fixed, not modified.
- No live PostgreSQL instance was available in this execution environment to run the plan's suggested `curl -X POST` smoke test against a seeded company. Verification was done via `tsc --noEmit` (compiles cleanly against the existing `ClientRecord`/`TeamMember`/`CreateClientSchema` types) and manual control-flow tracing of the 3-scenario acceptance criteria (valid row creates + returns `status: 'created'`; duplicate VAT row short-circuits before Zod parse with the exact reason string `Client with this VAT ID already exists`; non-matching employee email short-circuits with the exact reason string `No team member found with this email`; both failure paths `continue` the loop rather than throwing, so the valid row is unaffected). This is a documented gap for whoever performs live QA/staging verification of Plan 02 (the frontend modal) — the backend contract is implemented as specified but was not exercised against a live database in this session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `POST /api/v1/crm/clients/import` is ready for Plan 02 (frontend `ImportClientsModal.tsx`) to call directly — accepts `Record<string, unknown>[]`, returns `ImportClientsResult`.
- Frontend Plan 02 should be aware the request body key for the employee lookup column is `responsible_employee_email` (not `responsible_employee_id`) — this is the field name the backend reads off each raw row object.
- Recommend a live smoke test against a seeded dev database before considering IMP-02/IMP-03/IMP-04 fully closed out, since this session had no DB connectivity to exercise the endpoint end-to-end.

---
*Phase: 04-bulk-excel-import*
*Completed: 2026-07-06*
