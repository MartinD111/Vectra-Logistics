---
phase: 22-records-views-data-model
plan: 03
subsystem: api
tags: [zod, records, business-logic, tdd, service-layer]

requires:
  - phase: 22-records-views-data-model (plan 22-02)
    provides: recordsRepository (createCollectionWithDefaultView, findCollection, createRecord, createView, etc.) and records.types.ts row shapes
provides:
  - recordsService business-logic singleton (createCollection/getCollection/listCollections/updateCollection, createRecord/getRecord/listRecords/listRecordChildren/updateRecord, createView/getView/listViews/updateView)
  - D-02 dynamic prop-type validator (validateProps/validatePropValue) enforced on every write that touches props
  - D-03 atomic default-view guarantee surfaced through createCollection
  - UpdateViewSchema DTO (new — closes a gap left by Plan 22-01)
affects: [23-record-detail-page, controller/routes work for the records domain]

tech-stack:
  added: []
  patterns:
    - "Service-layer Zod safeParse -> AppError(400) on every write, matching crmService's convention"
    - "404-before-400 ordering: getCollection/getRecord/getView always re-fetch scoped to companyId before trusting cross-entity data (mirrors crmService.assertOwnedProject)"
    - "D-02 switch-based prop-type validator, first-party (no existing analog) per 22-PATTERNS.md"

key-files:
  created:
    - apps/api/src/domains/records/records.service.ts
    - apps/api/src/domains/records/records.service.test.ts
    - apps/api/src/domains/records/dto/update-view.dto.ts
  modified: []

key-decisions:
  - "createCollection returns the repository's { collection, view } result unchanged rather than only the collection row — the actual records.repository.ts (Plan 22-02, on disk) returns both from one atomic transaction, which differs from the plan's Interfaces block description (DataCollectionRow only). Adapting the service (and its tests) to the real repository contract, not the stale interface note, keeps D-03's one-call atomicity property intact."
  - "Added dto/update-view.dto.ts (UpdateViewSchema) — no such file existed from Plan 22-01, but the plan's Task 2 action explicitly requires an updateView service method with Zod validation. Followed the UpdateCollectionSchema/CreateViewSchema pattern (all fields optional, config stays opaque per REC-03)."

requirements-completed: [REC-01, REC-02, REC-03]

duration: 25min
completed: 2026-07-14
---

# Phase 22 Plan 03: Records Service Business-Logic Layer Summary

**recordsService singleton with Zod envelope validation, a D-02 dynamic prop-type validator checked against each collection's declared schema, and D-03's atomic default-view guarantee — all enforced before any write reaches recordsRepository.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-14T05:55:00Z
- **Completed:** 2026-07-14T06:04:00Z
- **Tasks:** 2 (TDD RED/GREEN)
- **Files modified:** 3 (2 created, 1 new DTO)

## Accomplishments
- `records.service.ts` exports `recordsService` with full CRUD surface over collections, records, and views, matching `crmService`'s singleton export style
- D-02: `validateProps`/`validatePropValue` reject any prop whose id isn't declared in the collection's schema, or whose value's runtime type doesn't match the schema-declared type — `AppError(400)` before any repository write
- D-03: `createCollection` calls `recordsRepository.createCollectionWithDefaultView` exactly once (one atomic DB transaction, no separate service-level default-view insert)
- 404-before-400 ordering enforced: `createRecord`/`updateRecord`/`createView` always re-fetch the parent collection scoped to `companyId` before trusting its schema (T-22-08 cross-tenant mitigation)
- REC-02/REC-03: `body` and view `config` pass through the service layer completely unmodified — no block-kind filtering, no field renaming/defaulting
- Full TDD cycle: 7-test RED commit confirmed failing (module didn't exist), then GREEN commit with all 7 passing plus 5 pre-existing repository tests (12/12 total in the records domain), `tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Write records.service.test.ts (RED)** - `dc9dbd2` (test)
2. **Task 2: Implement records.service.ts (GREEN)** - `ecd6860` (feat)

_Note: TDD task — RED confirmed via `TSError: Cannot find module './records.service'` before Task 2, GREEN confirmed via all 7 tests passing after._

## Files Created/Modified
- `apps/api/src/domains/records/records.service.ts` - Business-logic layer: Zod validation, D-02 prop-type validator, D-03 default-view wiring, 404-before-400 ownership checks
- `apps/api/src/domains/records/records.service.test.ts` - 7 unit tests covering REC-01/REC-02/REC-03, D-02, D-03, and 404-ordering, using `node:test`'s `mock.method` against `recordsRepository`
- `apps/api/src/domains/records/dto/update-view.dto.ts` - New `UpdateViewSchema` (see Deviations)

## Decisions Made
- Adapted `createCollection`'s return shape to the real `recordsRepository.createCollectionWithDefaultView` contract (`{ collection, view }`), not the plan's Interfaces-block description (`DataCollectionRow` only) — the actual Plan 22-02 repository code is the source of truth.
- Test UUIDs needed valid RFC4122 version/variant nibbles (`11111111-1111-4111-8111-...`, not all-1s) to satisfy Zod v4's `.uuid()` validator — discovered and fixed during GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing update-view.dto.ts**
- **Found during:** Task 2 (implementing `updateView`)
- **Issue:** The plan's Task 2 action requires an `updateView(id, companyId, body)` method "same pattern as `updateCollection`" (i.e., Zod-validated), but no `UpdateViewSchema` existed anywhere in `dto/` — Plan 22-01 only produced `create-view.dto.ts`, no update variant.
- **Fix:** Created `apps/api/src/domains/records/dto/update-view.dto.ts` following the established `UpdateCollectionSchema` pattern (all fields optional, `config` stays opaque per REC-03/`create-view.dto.ts`'s existing stance).
- **Files modified:** `apps/api/src/domains/records/dto/update-view.dto.ts`
- **Verification:** `tsc --noEmit` clean; `updateView` compiles and is exported on `recordsService`.
- **Committed in:** `dc9dbd2` (Task 1 commit, alongside the test file since it's a prerequisite for the service to compile)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the plan's own Task 2 action (`updateView` must validate via Zod). No scope creep — followed the exact same DTO shape convention already established by sibling files in this domain.

## Issues Encountered
- Initial test draft used non-RFC4122-compliant UUIDs (`11111111-1111-1111-1111-111111111111`) which Zod v4's `.uuid()` validator rejects (invalid variant nibble). Fixed by using a valid v4 UUID pattern (`11111111-1111-4111-8111-111111111111`) across the test file before GREEN.
- No `node_modules` present in this worktree (consistent with prior plan 22-02's environment); resolved via the documented symlink workaround to the main checkout's `node_modules` (both root and `apps/api`), which is gitignored and not committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `recordsService` is ready to be wired into a controller/routes layer (not part of this plan's scope — `records.controller.ts`/`records.routes.ts` remain to be built, likely a later wave/plan in this phase or Phase 23).
- All D-02/D-03/REC-01/REC-02/REC-03 behaviors are verified by automated tests against the real `recordsRepository` contract on disk (Plan 22-02), not a stale interface description — future plans building the controller layer can trust this service's method signatures as accurate.
- No blockers identified.

## Self-Check: PASSED

All created files verified present (records.service.ts, records.service.test.ts, dto/update-view.dto.ts, this SUMMARY.md). All 3 commit hashes (dc9dbd2, ecd6860, df465d3) verified in git log.

---
*Phase: 22-records-views-data-model*
*Completed: 2026-07-14*
