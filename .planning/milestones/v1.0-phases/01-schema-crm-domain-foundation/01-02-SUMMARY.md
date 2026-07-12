---
phase: 01-schema-crm-domain-foundation
plan: 02
subsystem: api
tags: [express, zod, postgresql, crm, domain-driven-design]

# Dependency graph
requires:
  - phase: 01-schema-crm-domain-foundation (plan 01)
    provides: "clients.address/responsible_employee_id columns, client_project_links table, email_messages table, kpi_results nullable-subject fix (migration 021, live in dev DB)"
provides:
  - "Dedicated crm API domain at apps/api/src/domains/crm/, mounted at /api/v1/crm/*"
  - "Client CRUD endpoints backed by the extended clients table"
  - "Client-project override endpoints backed by client_project_links, with override ?? global resolution in the service layer (D-02)"
  - "Non-throwing stub endpoints for import (501), email history (empty array), and risk (unavailable status) for Phases 4/5/6 to implement into"
affects: [02-crm-domain, 04-excel-import, 05-email-sync, 06-kpi-risk-evaluator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain scaffold: controller (thin, 1-3 lines) → service (Zod validation + AppError + business logic) → repository (raw SQL, company_id-scoped) → types → dto/"
    - "requireCompany(req) helper derives company_id from JWT only, never from request body/params (T-01-04 mitigation)"
    - "Numeric coercion helper (numClient/numProjectLink) converts pg NUMERIC-as-string fields back to number, mirroring billing.repository.ts's numClient pattern"
    - "Non-throwing stub methods (getClientEmails returns [], getClientRisk returns unavailable status) so consuming UI can render empty states instead of erroring, while importClients throws 501 as an explicit not-yet-built signal"

key-files:
  created:
    - apps/api/src/domains/crm/crm.types.ts
    - apps/api/src/domains/crm/crm.repository.ts
    - apps/api/src/domains/crm/crm.service.ts
    - apps/api/src/domains/crm/crm.controller.ts
    - apps/api/src/domains/crm/crm.routes.ts
    - apps/api/src/domains/crm/dto/create-client.dto.ts
    - apps/api/src/domains/crm/dto/update-client.dto.ts
    - apps/api/src/domains/crm/dto/link-project.dto.ts
  modified:
    - apps/api/src/domains/index.ts

key-decisions:
  - "billing domain left completely untouched — crm is net-new, not a move/refactor of billing's existing client endpoints, so nothing currently depending on billing/clients breaks (Plan 03 swaps the frontend, not the backend)"
  - "Project-link upsert always returns the resolved (override ?? global) view, never the raw override-only row, so the API contract matches D-02 in both list and upsert code paths"

patterns-established:
  - "Client-project link merge: rate_eur/responsible_employee_id/notes each independently resolve via nullish-coalescing (override field ?? client global default), with an is_overridden flag map so the frontend can visually distinguish overridden vs. inherited fields"

requirements-completed: [API-01, API-02]

# Metrics
duration: 6min
completed: 2026-07-05
---

# Phase 01 Plan 02: CRM API Domain Scaffold Summary

**Dedicated `crm` Express domain (controller/service/repository/types/dto) mounted at `/api/v1/crm/*`, exposing client CRUD, project-link override resolution (override ?? global), and non-throwing stubs for import/email/risk that Phases 4-6 build directly into — `billing` left fully untouched.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-05T08:42:43Z
- **Completed:** 2026-07-05T08:48:11Z
- **Tasks:** 3/3 complete
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments
- Scaffolded `apps/api/src/domains/crm/` structurally identical to `billing`/`pod`/`kpi` (controller → service → repository → types → dto)
- Client CRUD endpoints (`GET/POST /clients`, `GET/PATCH /clients/:id`) reading/writing the extended `clients` table (address, responsible_employee_id, notes)
- Client-project override endpoints (`GET/POST /clients/:id/projects`) backed by `client_project_links`, using `ON CONFLICT (client_id, project_id)` upsert and always returning the D-02-resolved (`override ?? global`) view
- Stub endpoints for `POST /clients/import` (501), `GET /clients/:id/emails` (empty array), `GET /clients/:id/risk` (unavailable status) — natural homes for Phases 4/5/6
- Mounted `crmRouter` at `/api/v1/crm` in `domains/index.ts`, alongside the unmodified `billingRouter` mount
- Zero new TypeScript compilation errors across `apps/api` (2 pre-existing, unrelated `redis.ts` errors confirmed out of scope)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define crm domain types, DTOs, and repository** - `9ed22f0` (feat)
2. **Task 2: Build crm.service.ts (business logic + override merge)** - `dde8faf` (feat)
3. **Task 3: Build crm.controller.ts, crm.routes.ts, and mount in domains/index.ts** - `9f2313e` (feat)

**Plan metadata:** (this commit, made by orchestrator per plan instructions — STATE.md/ROADMAP.md not touched by this executor)

## Files Created/Modified
- `apps/api/src/domains/crm/crm.types.ts` - `ClientRecord`, `ClientProjectLinkRecord`, `ResolvedClientProjectView` interfaces
- `apps/api/src/domains/crm/crm.repository.ts` - Raw SQL queries for `clients` and `client_project_links`, all scoped by `company_id`, numeric coercion for NUMERIC columns
- `apps/api/src/domains/crm/crm.service.ts` - Business logic: client CRUD with Zod validation, override-merge resolution for project links, non-throwing stubs for import/email/risk
- `apps/api/src/domains/crm/crm.controller.ts` - 9 thin Express handlers delegating to `crmService`, `requireCompany(req)` derives tenant scope from JWT only
- `apps/api/src/domains/crm/crm.routes.ts` - Router mounted at `/api/v1/crm`, all routes behind `authenticateToken`
- `apps/api/src/domains/crm/dto/create-client.dto.ts` - `CreateClientSchema` Zod validator (name, country, vat_id, email, credit_limit, default_rate_eur, notes, address, responsible_employee_id)
- `apps/api/src/domains/crm/dto/update-client.dto.ts` - `UpdateClientSchema` as `.partial()` of create schema
- `apps/api/src/domains/crm/dto/link-project.dto.ts` - `LinkProjectSchema` Zod validator (project_id, override_rate_eur, override_responsible_employee_id, override_notes)
- `apps/api/src/domains/index.ts` - Added `crmRouter` import and `router.use('/crm', crmRouter)` mount, immediately after the existing `billing` mount

## Decisions Made
- Kept `billing` domain completely unmodified — CRM logic is net-new in `crm`, matching the plan's confirmed CONCERNS.md approach; no client-related billing endpoints were moved or deleted
- Project-link upsert (`upsertClientProjectLink`) re-merges with client global defaults before returning, rather than returning the raw upserted row, so both `GET` and `POST` project-link endpoints have identical response shapes (always the resolved view, never raw override-only data)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid Zod internal property access in update-client.dto.ts**
- **Found during:** Task 3 (full `apps/api` compile check)
- **Issue:** `UpdateClientDto` was typed as `typeof UpdateClientSchema._type`, but Zod 4's public type-inference property is `.type`, not `._type` — this produced a TypeScript compile error (`TS2551: Property '_type' does not exist... Did you mean 'type'?`)
- **Fix:** Changed `typeof UpdateClientSchema._type` to `typeof UpdateClientSchema.type`
- **Files modified:** `apps/api/src/domains/crm/dto/update-client.dto.ts`
- **Verification:** `npx tsc --noEmit -p apps/api` produces zero errors referencing the crm domain after the fix
- **Committed in:** `9f2313e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Single-line type-inference fix required for the whole `apps/api` project to compile cleanly per the plan's stated success criteria. No scope creep.

## Issues Encountered
- Two pre-existing, unrelated TypeScript errors in `apps/api/src/core/db/redis.ts` (missing `redis` module type declarations, implicit `any` on a callback parameter) were observed during the Task 3 full-project compile check. Confirmed via `git log`/`git diff` that this file was last touched in the original monorepo restructure commit (`b9965bd`) and is untouched by this plan — logged as out-of-scope per the deviation rules' scope boundary, not fixed.

## User Setup Required

None - no external service configuration required. The `crm` domain reads/writes against the schema applied in Plan 01 (migration 021), already live in the dev database.

## Next Phase Readiness
- The `crm` API domain is fully scaffolded and mounted at `/api/v1/crm/*`, structurally matching `billing`/`pod`/`kpi`.
- Plan 03 (frontend swap) can now point the CRM UI at `crm` endpoints instead of `billing`'s client endpoints.
- Phase 4 (Excel import) has `POST /api/v1/crm/clients/import` as its implementation target (currently 501).
- Phase 5 (email sync) has `GET /api/v1/crm/clients/:id/emails` as its implementation target (currently returns `[]`).
- Phase 6 (KPI risk evaluator) has `GET /api/v1/crm/clients/:id/risk` as its implementation target (currently returns `{ status: 'unavailable', utilization_pct: null }`).
- No blockers carried forward from this plan.

---
*Phase: 01-schema-crm-domain-foundation*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: apps/api/src/domains/crm/crm.types.ts
- FOUND: apps/api/src/domains/crm/crm.repository.ts
- FOUND: apps/api/src/domains/crm/crm.service.ts
- FOUND: apps/api/src/domains/crm/crm.controller.ts
- FOUND: apps/api/src/domains/crm/crm.routes.ts
- FOUND: apps/api/src/domains/crm/dto/create-client.dto.ts
- FOUND: apps/api/src/domains/crm/dto/update-client.dto.ts
- FOUND: apps/api/src/domains/crm/dto/link-project.dto.ts
- FOUND: 9ed22f0 (Task 1 commit)
- FOUND: dde8faf (Task 2 commit)
- FOUND: 9f2313e (Task 3 commit)
