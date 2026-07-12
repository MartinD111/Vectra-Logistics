---
phase: 02-crm-dashboard-navigation-client-detail
plan: 01
subsystem: api
tags: [postgres, express, zod, crm, notion-canvas]

# Dependency graph
requires:
  - phase: 01-schema-crm-domain-foundation
    provides: crm API domain (controller/service/repository/routes), clients/email_messages/kpi_results schema
provides:
  - client_pages table (Notion-style block canvas, one row per client)
  - get-or-create client page endpoint (idempotent, dedupe-safe under concurrency)
  - update client page endpoint (envelope-validated config/title/icon/header_settings)
  - unified client timeline endpoint (merged emails + invoices + kpi_results, date-sorted)
affects: [02-02 (frontend client detail page), 03-excel-import, 05-email-sync, 06-risk-semaphore]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ON CONFLICT (client_id) DO UPDATE for idempotent get-or-create, mirroring upsertProjectLink"
    - "CASE WHEN $n::boolean THEN ... ELSE ... END for nullable-field updates, mirroring projects.repository.ts updatePage"
    - "Envelope-only Zod validation for frontend-owned JSONB config/header_settings, mirroring page.dto.ts"
    - "Timeline aggregation: repository owns per-source SQL (listClientEmails/listClientInvoices/listClientKpiResults), service merges+sorts+maps to a common shape"

key-files:
  created:
    - database/migrations/022_client_pages.sql
    - apps/api/src/domains/crm/dto/create-client-page.dto.ts
    - apps/api/src/domains/crm/dto/update-client-page.dto.ts
  modified:
    - apps/api/src/domains/crm/crm.types.ts
    - apps/api/src/domains/crm/crm.repository.ts
    - apps/api/src/domains/crm/crm.service.ts
    - apps/api/src/domains/crm/crm.controller.ts
    - apps/api/src/domains/crm/crm.routes.ts

key-decisions:
  - "client_pages has no parent_page_id/is_default/sort_order — no hierarchy, one page per client, enforced by a unique index on client_id (D-05/D-06)"
  - "GET and POST /clients/:id/page both route to the same idempotent getOrCreateClientPage handler so either HTTP verb from the frontend behaves identically (D-07/D-08)"
  - "kpi_results timeline entries are ordered by period_start (the only date-like column confirmed on that table); rule_name comes from a join with kpi_rules"

patterns-established:
  - "Timeline/feed aggregation across multiple tables: repository returns narrow per-source shapes, service layer maps to a common discriminated-union entry type and sorts"

requirements-completed: [DET-01, DET-02, DET-03, DET-04]

# Metrics
duration: ~35min
completed: 2026-07-06
---

# Phase 02 Plan 01: CRM Client Pages Backend Summary

**client_pages table + get-or-create/update endpoints and a merged emails/invoices/kpi timeline endpoint added to the existing `crm` API domain, all scoped by company_id and dedupe-safe under concurrent requests.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-06T08:30:00Z (approx)
- **Completed:** 2026-07-06T09:06:50Z
- **Tasks:** 2 completed
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- New idempotent `022_client_pages.sql` migration: `client_pages` table mirroring `project_pages` minus hierarchy columns, unique index on `client_id`
- `getOrCreateClientPage` service method backed by an `ON CONFLICT (client_id) DO UPDATE` repository insert — guarantees exactly one row per client even under concurrent "open client page" requests
- `updateClientPage` with envelope-only Zod validation (`config`/`header_settings` stay frontend-owned) and nullable-field CASE/WHEN semantics matching the existing `projects.repository.ts` convention
- `getClientTimeline` merges `email_messages`, `invoices`, and `kpi_results` into a single date-descending feed, safe on all-empty inputs
- All new routes mounted under `/api/v1/crm`, inheriting the existing `authenticateToken` middleware — no new auth surface

## Task Commits

Each task was committed atomically:

1. **Task 1: client_pages migration + repository/types/dto layer** - `6b1dfed` (feat)
2. **Task 2: crm.service.ts get-or-create + timeline aggregation, controller, routes** - `ecef2a5` (feat)

_No TDD tasks in this plan (autonomous, type=execute)._

## Files Created/Modified
- `database/migrations/022_client_pages.sql` - New `client_pages` table (idempotent), unique on `client_id`, indexed on `company_id`
- `apps/api/src/domains/crm/dto/create-client-page.dto.ts` - `CreateClientPageSchema`, envelope-only validation for `config`/`header_settings`, no hierarchy fields
- `apps/api/src/domains/crm/dto/update-client-page.dto.ts` - `UpdateClientPageSchema` re-exports create schema (all fields already optional)
- `apps/api/src/domains/crm/crm.types.ts` - Added `ClientPageRecord`, `ClientTimelineEntry`
- `apps/api/src/domains/crm/crm.repository.ts` - Added `findClientPage`, `createClientPage` (ON CONFLICT dedupe), `updateClientPage`, `listClientEmails`, `listClientInvoices`, `listClientKpiResults`
- `apps/api/src/domains/crm/crm.service.ts` - Added `getOrCreateClientPage`, `updateClientPage`, `getClientTimeline`
- `apps/api/src/domains/crm/crm.controller.ts` - Added `getClientPage`, `updateClientPage`, `getClientTimeline` handlers
- `apps/api/src/domains/crm/crm.routes.ts` - Registered `GET/POST /clients/:id/page`, `PATCH /client-pages/:pageId`, `GET /clients/:id/timeline`

## Decisions Made
- Chose the repository-method approach for the three timeline data sources (rather than raw SQL in the service layer) to keep the controller→service→repository layering consistent with the rest of the domain (plan explicitly allowed either, recommended this one)
- `kpi_results` timeline entries sort by `period_start` since that's the only confirmed date column on that table (inspected `kpi.repository.ts` per the plan's instruction rather than guessing)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Migration not applied to a live dev database.** No Docker/Postgres daemon was reachable in this execution sandbox (`docker ps` returned no output, no containers running). The migration file `022_client_pages.sql` was written and verified idempotent by inspection (follows the exact `CREATE TABLE IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` pattern used by `009_project_pages.sql` and `021_crm_extensions.sql`), and the SQL was manually reviewed for correctness against those two reference migrations, but the plan's verification step ("run the migration file twice against the dev DB and confirm no error on the second run") could not be executed live in this environment. **This must be run against the actual dev Postgres container before Plan 02-02 (frontend) or any manual QA depends on `client_pages` existing.** TypeScript compilation of all new/modified files was verified via `tsc --noEmit` (no errors attributable to any crm domain file; the only tsc errors present were pre-existing, unrelated to this plan — `node_modules` is not installed in this sandbox, so the `redis` package's type declarations cannot resolve).

## User Setup Required

None - no external service configuration required. However, see "Issues Encountered" above: run `database/migrations/022_client_pages.sql` against the dev Postgres instance (same mechanism used for `021_crm_extensions.sql`) before relying on the new endpoints.

## Next Phase Readiness
- Backend data layer for DET-01 through DET-04 is complete and ready for Plan 02-02 (frontend client detail page) to consume via `crm.api.ts`/`useCrm.ts` hooks
- Blocker: `022_client_pages.sql` needs to be applied to the running dev database (see Issues Encountered) before frontend integration testing can succeed end-to-end

---
*Phase: 02-crm-dashboard-navigation-client-detail*
*Completed: 2026-07-06*
