---
phase: 25-view-ux-parity
plan: 03
status: complete
---

# 25-03 Summary: Card-face properties + column aggregation (VIEWX-02, VIEWX-03)

## What was built

**Task 1 — `ViewSettingsMenu.tsx`**
- New file `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx`, a `'use client'` component accepting `{ collection: DataCollection; view: CollectionView }`.
- Icon-only trigger (`MoreHorizontal` from lucide-react, `aria-label="View settings"`, `min-h-[32px] min-w-[32px]`, no visible text), popover shell cloned from `PersonField`'s pattern but right-aligned (`right-0` instead of `left-0`) since it sits at the end of the toolbar row.
- "Card properties" section: one checkbox row per `collection.schema` entry, checked = `cardProperties.includes(property.id)`, toggling calls `useUpdateView(view.id).mutate({ config: { ...view.config, cardProperties: next } })` immediately.
- "Column aggregation" section: a `count`/`sum`/`avg` type select, plus — only when sum/avg is selected — a second select populated exclusively from `collection.schema.filter(p => p.type === 'number')` (Pitfall 3 mitigation). Both selects autosave via `columnAggregation: { type, propId }`.

**Task 2 — `ColumnAggregation.tsx` + `BoardCard.tsx` extension**
- New file `apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx` exporting `ColumnAggregation({ records, schema, aggregation })`. Delegates the actual math to `aggregateColumn` (Plan 25-01); renders `Count: N` for count, `Sum: X`/`Avg: X` for sum/avg (`.toLocaleString()` when the property resolves), and renders nothing (`<></>`) when sum/avg has no `propId` chosen yet.
- `BoardCard.tsx` gained an optional `cardProperties?: CollectionPropertyDef[]` prop, rendered as plain read-only `<div>` text below the title. Added a local `formatCardPropertyValue` helper: `checkbox` → Yes/No; `select`/`person` → resolved option label (falls back to raw id when unmatched); `multi-select`/`files`/`relation` → comma-joined array; everything else → `String(value)`. No `onCommit`/mutation wired to these new elements — the card's existing new-tab `onClick` remains the sole edit path.

**Task 3 — Wiring through `BoardColumn.tsx` and `BoardBlock.tsx`**
- `BoardColumn.tsx`: added optional `cardProperties`/`aggregation` props, forwarded `cardProperties` to every `BoardCard`, and mounted `<ColumnAggregation records={column.cards} schema={collection.schema} aggregation={aggregation} />` right after the droppable region, before the "+ New" button.
- `BoardBlock.tsx`: mounted `<ViewSettingsMenu collection={collection} view={view} />` alongside `FilterSortToolbar` in the header row (switched the row's className to `justify-between` so it right-aligns). Computed `cardProperties` (resolved `CollectionPropertyDef[]`, not raw ids, via `collection.schema.filter(...)`) and `aggregation` (`view.config.columnAggregation as AggregationConfig | undefined`) before the `columns.map(...)` render, and passed both down to every `BoardColumn`.

## Verification

- `cd apps/workspaces && npx tsc --noEmit` — no errors in any of the five touched/created files (`ViewSettingsMenu.tsx`, `ColumnAggregation.tsx`, `BoardCard.tsx`, `BoardColumn.tsx`, `BoardBlock.tsx`), confirmed both per-task and in one final combined grep across all five.
- No FE test runner exists in this repo (per 25-RESEARCH.md's established Wave 0 gap, consistent with 25-01/25-02) — verification was static (tsc) + code-path tracing: confirmed the number-property filter expression in `ViewSettingsMenu.tsx`, confirmed `ColumnAggregation` calls `aggregateColumn` and short-circuits to an empty fragment when sum/avg has no `propId`, confirmed no `onCommit`/mutation call exists anywhere in `BoardCard.tsx`'s new card-face render branch, and confirmed `BoardBlock.tsx` resolves `cardProperties` to full property objects (not raw id strings) before passing them down.
- Live smoke test (open the "..." menu, toggle a card property, confirm it renders on every card; set aggregation to Sum + a number property, confirm each column footer sums correctly) was not run in this environment — flagged as a manual follow-up, consistent with this phase's established testing precedent from 25-01/25-02.

## Files modified

- `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` (new)
- `apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx` (new)
- `apps/workspaces/src/components/projectPage/board/BoardCard.tsx`
- `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx`
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx`

## Commits

1. `feat(25-03): add ViewSettingsMenu with card-property checklist + aggregation picker`
2. `feat(25-03): add ColumnAggregation footer, extend BoardCard with read-only card-face properties`
3. `feat(25-03): wire ViewSettingsMenu, cardProperties, and aggregation footer through BoardColumn/BoardBlock`

## Notes for downstream plans (25-04)

- `view.config.cardProperties` (string[] of property ids) and `view.config.columnAggregation` (`AggregationConfig`) are now live config keys, alongside 25-02's `filters`/`sorts` and the pre-existing `groupBy`. Any future view-settings work reading/writing `view.config` should keep following the `{ ...view.config, <key>: next }` spread-merge pattern to avoid clobbering sibling keys.
- `ViewSettingsMenu` and `FilterSortToolbar` are both mounted as siblings in `BoardBlock`'s own header row (`flex items-center justify-between gap-2 mb-3`) — Plan 25-04's table view will need its own equivalent header row rather than a shared component, since neither toolbar was extracted out of `BoardBlock` this phase.
- `ColumnAggregation`'s empty-render path returns `<></>` (not `null`) to satisfy its `JSX.Element` return type signature — functionally equivalent to rendering nothing.
