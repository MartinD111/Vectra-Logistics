---
phase: 22-records-views-data-model
plan: 02
subsystem: database
tags: [postgres, pg, records, repository, sql, transactions]

# Dependency graph
requires:
  - phase: 22-01
    provides: records.types.ts row interfaces, records DTOs, 025_records_views.sql schema
provides:
  - "recordsRepository singleton exporting company_id-scoped CRUD over data_collections, collection_records, collection_views"
  - "createCollectionWithDefaultView: atomic D-03 transaction (BEGIN/INSERT collection/INSERT default 'table' view/COMMIT, ROLLBACK on failure)"
  - "listChildren: REC-04 parent/child query scoped by parent_record_id + company_id, ordered by sort_order then created_at"
affects: [22-03, records-service-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.connect() + BEGIN/COMMIT/ROLLBACK/finally-release for multi-statement atomic writes (mirrors authController.ts signup transaction)"
    - "Dynamic-SET partial update pattern for updateCollection/updateRecord/updateView (mirrors crm.repository.ts updateClient)"
    - "JSON.stringify(...) always passed as a bound query parameter for JSONB columns (schema/props/body/config), never string-concatenated"

key-files:
  created:
    - apps/api/src/domains/records/records.repository.ts
    - apps/api/src/domains/records/records.repository.test.ts
  modified: []

key-decisions:
  - "Symlinked apps/api/node_modules and root node_modules from the main repo into the worktree (gitignored, not committed) to make node --require ts-node/register --test runnable in this isolated worktree, since no package manager install step was part of this plan."

patterns-established:
  - "records.repository.ts is the sole SQL access point for the records domain; all 13 methods are company_id-scoped; the service layer (Plan 22-03) will call this repository exclusively rather than touching db.query directly."

requirements-completed: [REC-01, REC-02, REC-03, REC-04]

# Metrics
duration: 15min
completed: 2026-07-14
---

# Phase 22 Plan 02: Records Repository Summary

**Company_id-scoped CRUD data-access layer (`recordsRepository`) over `data_collections`/`collection_records`/`collection_views`, with an atomic `db.connect()` transaction for D-03's collection+default-view creation and the REC-04 parent/child query, fully unit-tested against a mocked `pg` client.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-14T05:53:00Z
- **Completed:** 2026-07-14T05:58:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `records.repository.test.ts` written first (RED), covering D-03 transaction sequencing/rollback, REC-04 scoping/ordering, and JSONB parameterized-write safety — confirmed failing (module not found) before implementation existed
- `records.repository.ts` implemented (GREEN): 13 methods (`createCollectionWithDefaultView`, `findCollection`, `listCollections`, `updateCollection`, `createRecord`, `findRecord`, `listRecords`, `updateRecord`, `listChildren`, `createView`, `findView`, `listViews`, `updateView`), every read/write scoped by `company_id`
- All 5 repository tests pass; full `apps/api` test suite (95 tests) passes; `tsc --noEmit` exits clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Write records.repository.test.ts (RED)** - `b783e03` (test)
2. **Task 2: Implement records.repository.ts (GREEN)** - `df77c27` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/api/src/domains/records/records.repository.ts` - `recordsRepository` singleton: company_id-scoped CRUD over collections/records/views, D-03 atomic transaction, JSONB parameterized writes
- `apps/api/src/domains/records/records.repository.test.ts` - 5 unit tests against a mocked `db.connect`/`db.query`

## Decisions Made
- Used `db.connect()` + manual `BEGIN`/`COMMIT`/`ROLLBACK` (mirroring `authController.ts`'s signup transaction) for `createCollectionWithDefaultView`, since no shared transaction helper exists in the codebase, per the plan's Interfaces block.
- Default view created by `createCollectionWithDefaultView` is named `'Table'` with `type = 'table'` and empty `config`, matching the plan's D-03 sketch.
- `updateCollection`/`updateRecord`/`updateView` reuse the dynamic-SET pattern from `crm.repository.ts`, JSON.stringify-ing only the JSONB columns (`schema`/`props`/`body`/`config`) when present in the patch.

## Deviations from Plan

None — plan executed exactly as written. The `node_modules` symlinking to run tests in this isolated worktree is an environment-setup step, not a code deviation (git-ignored, not committed, no source files affected).

## Issues Encountered
- This worktree had no `node_modules` installed anywhere (root or `apps/api`), so `node --require ts-node/register --test` initially failed with `MODULE_NOT_FOUND`. Resolved by symlinking `apps/api/node_modules` and the repo-root `node_modules` from the main repo checkout into the worktree (both already gitignored) — no `npm install` was needed since dependencies were already present in the main checkout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `recordsRepository` is ready for Plan 22-03 (service layer) to consume exclusively — no raw SQL should appear outside this file for the records domain going forward.
- No blockers identified.

---
*Phase: 22-records-views-data-model*
*Completed: 2026-07-14*
