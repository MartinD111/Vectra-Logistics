---
phase: 24-board-view-legacy-kanban-migration
plan: 01
subsystem: api
tags: [react-query, records, collections, board, data-layer]

# Dependency graph
requires:
  - phase: 22-records-views-data-model
    provides: "recordsApi (getCollection/updateCollection/getRecord/updateRecord/createRecord) and useRecords.ts hooks (useCollection/useRecord/useUpdateCollectionSchema/useUpdateRecord/useCreateRecord), backed by the shipped records domain API (collections/records/views endpoints, CreateRecordSchema/CreateViewSchema/CreateCollectionSchema/UpdateRecordSchema)"
provides:
  - "recordsApi.listCollections/createCollection/listRecords/listViews/createView/getView — 6 new client functions covering the full Phase 22 backend contract"
  - "createRecord bug fix: request body now always includes collection_id, matching the backend's required CreateRecordSchema field"
  - "UpdateRecordInput.sort_order?: number — client type now matches backend's UpdateRecordSchema"
  - "useCollections/useRecords/useViews/useView/useCreateCollection/useCreateView/useUpdateAnyRecord — 7 new hooks, with useUpdateAnyRecord supporting updates to arbitrary record ids (not fixed at hook construction) plus dual cache reconciliation (single-record cache + collection's records-list cache)"
affects: [24-02-board-drag-and-drop, 24-03-legacy-kanban-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recordsApi functions follow apiFetch<{...}>(url, method, body).then((r) => r.field) unwrap style; createCollection intentionally returns the raw { collection, view } object since callers need both pieces"
    - "useUpdateAnyRecord(collectionId) mutation pattern: mutationFn takes { id, data } so one hook instance can update any record id in the collection, with onSuccess writing both qk.record(id) and splicing into qk.records(collectionId) list cache"

key-files:
  created: []
  modified:
    - apps/workspaces/src/lib/api/records.api.ts
    - apps/workspaces/src/lib/hooks/useRecords.ts

key-decisions:
  - "createRecord's collection_id in the POST body is sourced from the function's collectionId parameter (server-trusted, not raw client-supplied text) per threat T-24-02 mitigation"
  - "createCollection is intentionally NOT unwrapped to just the collection — callers need both { collection, view } since collection creation implicitly creates a default view"

patterns-established:
  - "Generic 'update any record by id' hook pattern (useUpdateAnyRecord) for multi-record UI surfaces like boards, distinct from the single-id-bound useUpdateRecord(id) pattern from Phase 22/23"

requirements-completed: [BOARD-01, BOARD-02, BOARD-03]

# Metrics
duration: 12min
completed: 2026-07-14
---

# Phase 24 Plan 01: Records API Client + Hooks Extension Summary

**Extended recordsApi/useRecords.ts with 6 new client functions and 7 new hooks (collections/views listing, collection/view creation, generic record update by id), plus fixed a latent createRecord 400 bug and widened UpdateRecordInput with sort_order for board drag-and-drop.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-14T12:26:00Z
- **Completed:** 2026-07-14T12:38:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `recordsApi` now exposes all 11 functions needed by board view/legacy migration work: `getCollection`, `updateCollection`, `getRecord`, `updateRecord`, `createRecord`, `listCollections`, `createCollection`, `listRecords`, `listViews`, `createView`, `getView`
- Fixed `createRecord`'s latent bug where `collection_id` was never sent in the POST body, which would have 400'd on first real use (backend's `CreateRecordSchema` requires it)
- `UpdateRecordInput` now carries `sort_order?: number`, unblocking Plan 24-02's single-call `{ props, sort_order }` drag-and-drop PATCH
- `useRecords.ts` now exposes 7 new hooks: `useCollections`, `useRecords`, `useViews`, `useView`, `useCreateCollection`, `useCreateView`, `useUpdateAnyRecord`
- `useUpdateAnyRecord(collectionId)` reconciles both the single-record cache entry and the collection's records-list cache entry on success, so board column groupings re-render from the mutation response without an extra fetch

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend records.api.ts — list/create/get functions + createRecord bug fix + UpdateRecordInput.sort_order** - `7ee2320` (feat)
2. **Task 2: Extend useRecords.ts — list/create hooks + generic record-update mutation** - `0534c2a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/workspaces/src/lib/api/records.api.ts` - Added `CollectionView`, `CreateCollectionInput`, `CreateViewInput` interfaces; widened `UpdateRecordInput` with `sort_order`; added `listCollections`, `createCollection`, `listRecords`, `listViews`, `createView`, `getView` to `recordsApi`; fixed `createRecord` to send `collection_id` in body
- `apps/workspaces/src/lib/hooks/useRecords.ts` - Added `collections`/`records`/`views`/`view` query-key factories; added `useCollections`, `useRecords`, `useViews`, `useView`, `useCreateCollection`, `useCreateView`, `useUpdateAnyRecord` hooks

## Decisions Made
None beyond what the plan specified - followed the interface contract exactly as documented against the already-shipped Phase 22 backend routes/DTOs.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their acceptance criteria on first implementation; `npx tsc --noEmit -p apps/workspaces/tsconfig.json` passed with zero errors after each task.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 24-02 (board rendering + drag-and-drop) and 24-03 (legacy kanban migration) can now consume `recordsApi`/`useRecords.ts` directly for all collection/record/view operations, including the `useUpdateAnyRecord` hook needed for drag-and-drop PATCHes that combine `props` and `sort_order` in one call. No hand-rolled `apiFetch` calls should be needed in later Phase 24 plans for these operations.

---
*Phase: 24-board-view-legacy-kanban-migration*
*Completed: 2026-07-14*

## Self-Check: PASSED
