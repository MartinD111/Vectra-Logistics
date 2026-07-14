---
phase: 25-view-ux-parity
plan: 04
status: complete
---

# 25-04 Summary: View switching + Table view (VIEWX-04)

## What was built

**Task 1 — `CollectionTableView.tsx`**
- New file `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` (new `collectionTable/` subfolder, deliberately not `TableView`/`TableBlock` to avoid the naming collision with the pre-existing, unrelated `TableBlock.tsx`).
- Accepts `{ collection, records, updateRecord }` — `records` is the already-filtered-and-sorted array; this component does not call `applyFilters`/`applySorts` itself.
- `<table>` with one `<th>` per `collection.schema` entry (schema order, no reordering UI) and one `<tr>` per record, each `<td>` rendering an editable `<PropertyField property={...} value={record.props[property.id]} onCommit={...} />` wired to the passed-in `updateRecord` mutation (no second mutation hook created).
- Header row uses the Label typography tier (`text-xs font-semibold uppercase tracking-wider`) per 25-UI-SPEC.md, not TableBlock's slightly different `text-[11px] font-bold`.
- Zero records renders the shared board empty-state copy pair ("No records match these filters" / "Try removing a filter condition or adjusting a value to see more records."), centered, instead of a blank table.

**Task 2 — `ViewSwitcher.tsx`**
- New file `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx`, accepting `{ collectionId, currentView, onSwitch }`.
- Segmented Board/Table control (`LayoutGrid`/`Table2` icons from lucide-react), selected type shown with the `primary-600` accent, the other plain gray.
- Switching to a type: looks up `useViews(collectionId).data?.find(v => v.type === t)` first — if found, calls `onSwitch(found.id)` directly, no API call. If not found, calls `useCreateView(collectionId).mutateAsync({ name, type: t, config: {} })` and calls `onSwitch(created.id)` on resolution — "create-once," then every later switch hits the found-branch ("then-remember").
- No record-mutation hook/import anywhere in the file (verified via `grep -c "createRecord"` returning 0) — switching a view type only ever creates a `collection_views` row.

**Task 3 — Wire into `BoardBlock.tsx`**
- Imported `ViewSwitcher` and `CollectionTableView`.
- Mounted `<ViewSwitcher collectionId={block.collectionId as string} currentView={view} onSwitch={(viewId) => onChange?.({ ...block, viewId })} />` leftmost in the toolbar header row, ahead of `FilterSortToolbar` (both now grouped in a `flex items-center gap-2` sub-row on the left; `ViewSettingsMenu` stays right-aligned via the existing `justify-between` row).
- Body render now branches on `view.type`: `view.type === 'table'` renders `<CollectionTableView collection={collection} records={sorted} updateRecord={updateRecord} />` (same `sorted` array and same `useUpdateAnyRecord` instance already computed for the board path — no second mutation hook); every other type keeps the existing `DndContext`/`BoardColumn`/`AddColumnControl` JSX unchanged, including its own filtered-empty-state branch.
- `registry.tsx` untouched (confirmed via `git diff --stat`); `BoardBlock`'s export name and `{ block, onChange }` props signature unchanged.

## Verification

- `cd apps/workspaces && npx tsc --noEmit` — no errors in any of the three touched/created files (`CollectionTableView.tsx`, `ViewSwitcher.tsx`, `BoardBlock.tsx`), confirmed per-task via targeted grep.
- `grep -c "createRecord" ViewSwitcher.tsx` returns `0` — confirmed no record-mutation import/call exists in the view-switching logic (an initial draft's *comment* happened to contain the literal string "createRecord" and was reworded to keep the grep check meaningful, not just passing on a technicality).
- `git diff --stat -- apps/workspaces/src/lib/projectPage/registry.tsx` returns empty — registry unmodified, confirming `entry()` still takes exactly one component per block kind and `BoardBlock` branches internally as required.
- No FE test runner exists in this repo (per 25-RESEARCH.md's established Wave 0 gap, consistent with 25-01/25-02/25-03) — verification was static (tsc + targeted grep) + code-path tracing: confirmed `CollectionTableView` receives the pre-filtered/sorted `sorted` array (not raw `records`) and the board's existing `updateRecord` instance; confirmed `ViewSwitcher`'s found-branch short-circuits before any `createView` call; confirmed `BoardBlock`'s `view.type === 'table'` branch is checked before the `isFilteredEmpty` board-only branch, so table view never renders the board's empty-filter copy (it has its own, inside `CollectionTableView`).
- Live smoke test (switch a board to Table, confirm same records render as editable rows; switch back to Board, confirm no new `collection_records`/duplicate `collection_views` rows were created; toggle Board→Table→Board repeatedly and confirm no growth in `listViews` count) was not run in this environment — flagged as a manual follow-up, consistent with this phase's established testing precedent from 25-01/25-02/25-03.

## Files modified

- `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` (new)
- `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` (new)
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx`

## Commits

1. `feat(25-04): add CollectionTableView schema-driven table render path`
2. `feat(25-04): add ViewSwitcher create-once-then-remember board/table toggle`
3. `feat(25-04): branch BoardBlock render on view.type, mount ViewSwitcher`

## Notes for phase close

- All four VIEWX-01..04 requirements are now fully shipped across Plans 25-01 through 25-04: data-layer foundation (25-01), filter/sort toolbar (25-02), card-face properties + column aggregation (25-03), and view switching + table view (25-04, this plan).
- `view.config` remains a JSONB blob with `groupBy`/`filters`/`sorts`/`cardProperties`/`columnAggregation` keys, all following the same `{ ...view.config, <key>: next }` spread-merge convention established across 25-01..25-03 — no schema changes were needed this plan (D-05 confirmed no new migration required).
- Per 25-UI-SPEC.md and 25-RESEARCH.md's Pitfall 4, filters/sorts/cardProperties/columnAggregation intentionally do NOT carry over automatically between a collection's Board and Table views — each `collection_views` row keeps its own independent `config`. This is expected behavior, not a gap.
- Live/manual smoke testing of the full view-switching + table-editing flow (recommended verification step above) remains an open follow-up for whoever signs off this phase, consistent with the precedent set by every prior plan in this phase.
