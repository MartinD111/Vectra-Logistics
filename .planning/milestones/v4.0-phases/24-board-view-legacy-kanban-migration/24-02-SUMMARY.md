---
phase: 24-board-view-legacy-kanban-migration
plan: 02
subsystem: frontend
tags: [dnd-kit, sortable, board, collection-view, kanban]

# Dependency graph
requires:
  - phase: 24-board-view-legacy-kanban-migration
    plan: 01
    provides: "recordsApi/useRecords.ts extensions (listRecords, createCollection, createView, useUpdateAnyRecord, sort_order support)"
provides:
  - "'collection-view' PageBlockKind + CollectionViewBlock type, registered end-to-end (blocks.ts, registry.tsx, slashMenu.ts)"
  - "BoardBlock.tsx: D-04 auto-provisioning (Title text + Status select property, board view), live column grouping, board-root DndContext"
  - "board/BoardColumn.tsx, board/BoardCard.tsx, board/AddColumnControl.tsx: drag-and-drop (cross-column + within-column + empty-column drop target), column add/rename/blocked-delete, inline card creation"
affects: [24-03-legacy-kanban-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@dnd-kit/sortable multi-container pattern: one DndContext at board root, one SortableContext per column, useDroppable on the column container distinct from each card's useSortable — first usage of @dnd-kit/sortable anywhere in the codebase"
    - "Select-option identity: rename mutates only the option's label field, never its id, so grouping/matching stays stable across renames"

key-files:
  created:
    - apps/workspaces/src/components/projectPage/BoardBlock.tsx
    - apps/workspaces/src/components/projectPage/board/BoardColumn.tsx
    - apps/workspaces/src/components/projectPage/board/BoardCard.tsx
    - apps/workspaces/src/components/projectPage/board/AddColumnControl.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/lib/projectPage/registry.tsx
    - apps/workspaces/src/lib/projectPage/slashMenu.ts

key-decisions:
  - "kanban registry entry kept registered but available:false — hides it from the slash menu palette while still rendering/migrating any already-inserted legacy blocks"
  - "Empty-column drop target implemented via a column-level useDroppable({id: column.id}) region on the same container div wrapping SortableContext, independent of per-card useSortable registrations — required because an empty SortableContext has no items to hit-test"
  - "handleDragEnd resolves the target column via either a matching card id inside a column's cards array, or a direct match against column.id (the empty-column path), and always commits exactly one useUpdateAnyRecord PATCH combining props (groupBy) and sort_order"

patterns-established:
  - "Inline-editable card title pattern (BoardCard's autoFocusEdit/onExitEdit) reusable by any future card-creation flow that needs immediate on-card-face title entry"

requirements-completed: [BOARD-01, BOARD-02, BOARD-03]

# Metrics
duration: 24min
completed: 2026-07-14
---

# Phase 24 Plan 02: Board View Drag-and-Drop Summary

**New `collection-view` page block renders live columns from a select property's option values and supports full `@dnd-kit/sortable` drag-and-drop (cross-column move, within-column reorder, empty-column drop targets) plus in-board column add/rename/blocked-delete and inline card creation — all backed by Phase 22's data_collections/collection_records/collection_views API, with zero picker UI on insert (D-04).**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-14T13:05:00Z
- **Completed:** 2026-07-14T13:29:00Z
- **Tasks:** 3
- **Files modified:** 7 (3 modified, 4 created)

## Accomplishments
- `collection-view` is a fully registered `PageBlockKind`: `CollectionViewBlock` type in `blocks.ts`, `PAGE_BLOCK_REGISTRY` entry ("Board", `available: true`), `registry.tsx` renderer/editor wired to `BoardBlock`, slash-menu keywords added. The legacy `kanban` registry entry is now `available: false` (hidden from the palette) but stays registered so existing pages keep rendering.
- `BoardBlock.tsx` implements D-04's zero-picker auto-provisioning: on first insert (`collectionId === null`), a ref-gated effect sequences `createCollection` (Title text property + Status select property with To Do/In Progress/Done options) then `createView` (type `board`, `config.groupBy` pointing at the Status property id) before swapping the block to point at the real ids.
- First `@dnd-kit/sortable` usage anywhere in the codebase: `BoardColumn.tsx` wraps its card list in `SortableContext`/`verticalListSortingStrategy` for within-column reordering, and additionally registers the column container itself as a `useDroppable` region so cards can be dropped into columns with zero cards (every brand-new board's default 3 columns) — an empty `SortableContext` alone would have no sortable target to hit-test against.
- `BoardBlock.tsx`'s `handleDragEnd` commits exactly one `useUpdateAnyRecord` PATCH per drag end, combining the new `groupBy` prop value and `sort_order` in a single call, resolving the target column via either a matching card id or a direct `column.id` match (the empty-column path).
- Column management: `AddColumnControl.tsx` appends a new select option via a schema PATCH; `BoardColumn.tsx` supports inline column-title rename (mutating only the option's `label`, never its `id`, per the Phase 24 Pitfall 4 convention) and blocks deleting non-empty columns (`opacity-40 cursor-not-allowed`, destructive confirm copy when empty).
- `BoardCard.tsx` supports inline-editable title on creation (`autoFocusEdit`/`onExitEdit`): "+ New" in a column creates a record pre-set to that column's groupBy value and immediately enters inline-edit-on-card-face state, no navigation; Escape exits edit mode without deleting the already-persisted record.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register collection-view block kind + provisioning + static board rendering** - `f879b7f` (feat)
2. **Task 2: Drag-and-drop — cross-column move + within-column reorder + empty-column drop target** - `90574ef` (feat)
3. **Task 3: Column management (add/rename/blocked-delete) + inline card creation** - `1f6dbf7` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/workspaces/src/lib/projectPage/blocks.ts` - Added `'collection-view'` to `PageBlockKind`, `CollectionViewBlock` interface, `PAGE_BLOCK_REGISTRY` entry; `kanban` entry set `available: false`
- `apps/workspaces/src/lib/projectPage/registry.tsx` - Wired `'collection-view'` entry to `BoardBlock`
- `apps/workspaces/src/lib/projectPage/slashMenu.ts` - Added keywords for `collection-view`
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (new) - D-04 provisioning effect, `groupRecordsByColumn` helper, board-root `DndContext`/`handleDragEnd`, renders `BoardColumn`/`AddColumnControl`
- `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` (new) - `useDroppable` column drop target, `SortableContext`, inline rename, blocked delete, "+ New" card control
- `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` (new) - `useSortable` whole-card drag surface, inline-editable title on creation, click-to-open
- `apps/workspaces/src/components/projectPage/board/AddColumnControl.tsx` (new) - "+ Add column" ghost control, appends a select option via schema PATCH

## Decisions Made
None beyond what the plan specified — followed the RESEARCH.md/PATTERNS.md/UI-SPEC.md contract exactly, including the exact `@dnd-kit` sensor config cloned from `dispatch/page.tsx` and the column-level `useDroppable` requirement for empty-column drops.

## Deviations from Plan

None — plan executed exactly as written. `npx tsc --noEmit -p apps/workspaces/tsconfig.json` passed with zero errors after every task.

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required. Manual dev-server verification (drag between/within columns, empty-column drop, add/rename/delete columns, inline card creation) was not run in this session per the plan's "manual-only, no frontend test runner" note in RESEARCH.md; recommend a manual pass before merge per the plan's `<verification>` section.

## Next Phase Readiness

Plan 24-03 (legacy kanban migration) can now build `kanbanMigration.ts`'s `buildMigrationPlan`/`migrateOnFirstEdit` against a `collection-view` block shape that is fully wired end-to-end and already renders/drags correctly for boards created from scratch — migration only needs to produce the same `{ collectionId, viewId }` pointer shape this plan's `BoardBlock` already consumes.

---
*Phase: 24-board-view-legacy-kanban-migration*
*Completed: 2026-07-14*

## Self-Check: PASSED
