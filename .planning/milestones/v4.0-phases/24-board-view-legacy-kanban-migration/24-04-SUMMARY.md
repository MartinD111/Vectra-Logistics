---
phase: 24-board-view-legacy-kanban-migration
plan: 04
subsystem: ui
tags: [react-query, board, kanban, collection-view, records]

# Dependency graph
requires:
  - phase: 24-board-view-legacy-kanban-migration (plans 01-03)
    provides: Board view (collection-view block), BoardColumn "+ New" inline card creation, D-04 zero-picker provisioning flow
provides:
  - BoardBlock's D-04 provisioning effect now calls recordsApi.createView(collection.id, ...) directly with a call-time-resolved collection id, instead of through a stale-bound useCreateView hook
  - useCreateRecord writes newly created records into the qk.records(collectionId) query cache on success
affects: [24-board-view-legacy-kanban-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct API-client calls (not React Query mutation hooks) inside effect .then chains when the target id is only known at call time, not hook-construction time — avoids stale closures over hook-scoped ids."

key-files:
  created: []
  modified:
    - apps/workspaces/src/components/projectPage/BoardBlock.tsx
    - apps/workspaces/src/lib/hooks/useRecords.ts

key-decisions:
  - "Routed board-view creation around useCreateView entirely (direct recordsApi.createView call) rather than trying to make the hook re-bind at call time — matches the already-correct reference pattern in kanbanMigration.ts and avoids adding a second hook-construction-order workaround."

patterns-established: []

requirements-completed: [BOARD-01, BOARD-03]

# Metrics
duration: 15min
completed: 2026-07-14
---

# Phase 24 Plan 04: Board Provisioning + Inline Card Cache Fix Summary

**Fixed two confirmed wiring bugs that permanently stuck new board creation on "Creating board..." (404 from a stale empty collection id) and made new inline cards invisible for up to 5 minutes (missing query-cache write).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-14
- **Completed:** 2026-07-14
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- BoardBlock's D-04 provisioning effect calls `recordsApi.createView(collection.id, ...)` directly, using the real collection id resolved from `createCollection.mutateAsync`'s response at call time — no more stale `''` binding from `useCreateView(block.collectionId ?? '')`, no more 404 on `/collections//views`.
- `useCreateRecord` now writes the newly created record into `qk.records(collectionId)`'s query cache via `setQueryData` on success, so cards created via BoardColumn's "+ New" button render immediately with autofocus instead of waiting up to the 5-minute `staleTime`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix BoardBlock D-04 provisioning to call recordsApi.createView directly** - `c746056` (fix)
2. **Task 2: Add cache write to useCreateRecord so new cards render immediately** - `320b7d9` (fix)

## Files Created/Modified
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx` - Removed `useCreateView` hook construction/import; provisioning effect now calls `recordsApi.createView(collection.id, {...})` directly inside its `.then` chain, passing the real just-resolved collection id.
- `apps/workspaces/src/lib/hooks/useRecords.ts` - `useCreateRecord(collectionId)` now obtains a `useQueryClient()` instance and adds an `onSuccess` handler that appends the created record into `qk.records(collectionId)`'s cached array, mirroring `useUpdateAnyRecord`'s existing splice pattern.

## Decisions Made
- Routed around `useCreateView` entirely for the D-04 provisioning path rather than patching the hook to accept a call-time id — this exactly mirrors the already-correct, already-shipped reference pattern in `kanbanMigration.ts` (direct `recordsApi.createView(collection.id, ...)` call after `createCollection` resolves), keeping one consistent pattern for "provision then create view" flows in the codebase.

## Deviations from Plan

None - plan executed exactly as written. The known pitfall flagged in the executor's task context (splitting the type-only import at `records.api.ts` line 17 into a value+type import) was handled as specified: `import { recordsApi, type CollectionPropertyDef, type CollectionRecord } from '@/lib/api/records.api';`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both previously-failed must-haves (BOARD-01 D-04 provisioning completing without a 404, BOARD-03 inline card visibility without cache-staleness delay) are now fixed and `tsc --noEmit` is clean for both touched files. `git diff` for this plan is scoped exclusively to `BoardBlock.tsx`'s `createView` call site and `useRecords.ts`'s `useCreateRecord` function — BOARD-02 (drag-and-drop) and BOARD-04 (legacy kanban migration) code paths are untouched, matching the plan's verification requirement #4.

Manual/live verification (inserting a board from the slash menu, clicking "+ New" in a column) was not runnable in this sandboxed executor environment (no dev server) — recommend a live smoke test during phase verification.

---
*Phase: 24-board-view-legacy-kanban-migration*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: apps/workspaces/src/components/projectPage/BoardBlock.tsx
- FOUND: apps/workspaces/src/lib/hooks/useRecords.ts
- FOUND: .planning/phases/24-board-view-legacy-kanban-migration/24-04-SUMMARY.md
- FOUND: c746056 (Task 1 commit)
- FOUND: 320b7d9 (Task 2 commit)
