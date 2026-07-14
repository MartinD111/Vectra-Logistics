---
phase: 25-view-ux-parity
plan: 02
status: complete
---

# 25-02 Summary: Filter/Sort toolbar (VIEWX-01)

## What was built

**Task 1 — `FilterSortToolbar.tsx`**
- New file `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx`, a `'use client'` component accepting `{ collection: DataCollection; view: CollectionView }`.
- Two sibling popover controls (`FilterPopover`, `SortPopover`), each cloning `PersonField`'s exact popover shell (`fixed inset-0 z-20` backdrop + `absolute ... top-full mt-1 z-30` panel).
- **Filter records** button: stacked condition rows built from `view.config.filters` — a property `<select>`, an operator `<select>` sourced from `FILTER_OPERATORS[property.type]`, and a value input rendered via `PropertyField`. Changing the property resets the operator to that type's first valid operator and clears the value. "+ Add condition" appends a new row; "×" removes a row. Every add/remove/edit calls `useUpdateView(view.id).mutate({ config: { ...view.config, filters: next } })` immediately — no Apply button.
- **Sort records** button: stacked rows (property `<select>` + asc/desc `<select>`) built from `view.config.sorts`, same autosave-on-change pattern via `sorts: next`.
- Both trigger buttons switch to `text-primary-600` when their respective config array is non-empty, gray otherwise, per the UI-SPEC Color contract.

**Task 2 — Wire filters/sorts into `BoardBlock.tsx`**
- Imported `applyFilters`, `applySorts`, `FilterCondition`, `SortCondition` from `@/lib/projectPage/viewFilters`, and `FilterSortToolbar`.
- Inserted `filtered = applyFilters(records, ...)` then `sorted = applySorts(filtered, ...)` before `groupRecordsByColumn`, which now receives `sorted` instead of raw `records`.
- `handleDragEnd`'s `records.find(...)` lookup was left untouched — it still reads the unfiltered `records` array, so drag-and-drop is unaffected by filter state (filtered-out cards are simply not rendered as draggable in the first place).
- Mounted `<FilterSortToolbar collection={collection} view={view} />` in the board header, right below the title, with adjusted `mb-2`/`mb-3` spacing to keep vertical rhythm consistent.
- Added `BoardEmptyFilterState`, rendered in place of the column row when `filtered.length === 0 && activeFilters.length > 0`, using the exact UI-SPEC copy ("No records match these filters" / "Try removing a filter condition or adjusting a value to see more records.") and `BoardShellError`'s text styling conventions.

## Verification

- `cd apps/workspaces && npx tsc --noEmit` — no new errors in `FilterSortToolbar.tsx` or `BoardBlock.tsx` (confirmed via targeted grep on both files, per each task's `<verify>` block).
- No FE test runner exists in this repo (per 25-RESEARCH.md's Wave 0 Gaps note) — verification was static (tsc) + code-path tracing: confirmed `applyFilters`/`applySorts` are called in the correct order before `groupRecordsByColumn`, confirmed the popover markup matches the `PersonField` convention (`fixed inset-0 z-20` present in both `FilterPopover` and `SortPopover`), and confirmed no separate "Apply"/"Save" button exists in the JSX (every mutation call sits directly in the add/remove/edit handlers).
- Live smoke test (open a board, add a filter/sort, refresh to confirm persistence) was not run in this environment — flagged as a manual follow-up, consistent with this phase's established testing precedent from 25-01.

## Files modified

- `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx` (new)
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx`

## Commits

1. `feat(25-02): add FilterSortToolbar with filter/sort popover builders`
2. `feat(25-02): wire filters/sorts into BoardBlock, mount FilterSortToolbar`

## Notes for downstream plans (25-03..25-04)

- `FilterSortToolbar` is mounted directly inside `BoardBlock`'s own header row (not a separate shared toolbar component) — if Plan 25-04's view switcher or Plan 25-03's "•••" view-settings control need to sit alongside it, they should be added as additional siblings inside the same `flex items-center gap-2` row rather than a new wrapping div, to avoid doubled vertical spacing.
- `view.config.filters`/`view.config.sorts` are read directly off `view.config` (cast via `as FilterCondition[] | undefined ?? []`) in both `FilterSortToolbar` and `BoardBlock` — any future view-settings work reading/writing `view.config` should follow the same `{ ...view.config, <key>: next }` spread-merge pattern to avoid clobbering sibling config keys (e.g. `groupBy`, future `cardProperties`/`aggregation`).
- `BoardEmptyFilterState` is board-block-local (not exported) — Plan 25-04's table view will need its own copy of the same empty-state pair per the UI-SPEC's "Empty states" row, since no shared component was extracted this plan (kept scope narrow per the plan's file list).
