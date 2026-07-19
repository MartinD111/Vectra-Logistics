# Phase 26: Additional View Types - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 9 (4 new view renderers + 1 replaced ViewSwitcher + 1 extended ViewSettingsMenu + 1 extended BoardBlock branch + 2 shared read-only imports)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` (rewrite in place) | component (menu/dropdown) | request-response (view CRUD) | itself (prior version) | exact — same file, same hooks, UI shape changes only |
| `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` (extend in place) | component (popover form) | CRUD (view.config writes) | itself (prior version) | exact — additive per-view-type sections |
| `apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx` (new) | component (view renderer) | request-response (read + click-through) | `collectionTable/CollectionTableView.tsx` | role-match (sibling view-type component in its own subfolder) |
| `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx` (new) | component (view renderer) | CRUD (click-to-create) + request-response | `board/BoardCard.tsx` (card/chip + inline-edit) + `collectionTable/CollectionTableView.tsx` (container/empty-state shell) | role-match |
| `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx` (new) | component (view renderer) | request-response | `board/BoardCard.tsx` (card body/cardProperties/formatCardPropertyValue) | exact for card-face logic, role-match for grid layout |
| `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx` (new) | component (view renderer) | request-response (derived layout, no mutation) | `collectionTable/CollectionTableView.tsx` (container/empty-state) + `board/BoardCard.tsx` (click-through) | partial match — no direct Gantt analog exists, composed from two |
| `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (extend `view.type` branch) | controller (block orchestrator) | request-response | itself (existing `view.type === 'table'` branch) | exact |
| `apps/workspaces/src/lib/hooks/useRecords.ts` (no changes expected; reused as-is) | hook | CRUD | n/a (shared, unchanged) | exact — `useCreateRecord`, `useUpdateAnyRecord`, `useUpdateView` cover all 4 new views' data needs |
| `apps/workspaces/src/lib/projectPage/viewFilters.ts` (no changes expected; reused as-is) | utility | transform | n/a (shared, unchanged) | exact — `applyFilters`/`applySorts` apply uniformly |

## Pattern Assignments

### `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` (component, request-response) — REWRITE

**Analog:** itself, prior version (full file read, 85 lines)

**Current imports/hooks pattern** (lines 1-18):
```typescript
'use client';
import { useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import { useViews, useCreateView } from '@/lib/hooks/useRecords';
import type { CollectionView } from '@/lib/api/records.api';

const VIEW_TYPES: { type: 'board' | 'table'; label: string; icon: typeof LayoutGrid }[] = [
  { type: 'board', label: 'Board', icon: LayoutGrid },
  { type: 'table', label: 'Table', icon: Table2 },
];
```
Extend to (per D-10 / UI-SPEC): `List`, `Calendar`, `Image`, `GanttChartSquare` (fallback `BarChart3`), `ChevronDown` added to the lucide import; `VIEW_TYPES` array grows to 6 entries; the `type` union widens to `'board' | 'table' | 'list' | 'calendar' | 'gallery' | 'timeline'` everywhere it appears (state type, prop type, switchTo param type).

**Create-once-then-remember + pendingType guard pattern to preserve verbatim** (lines 38-60):
```typescript
const [pendingType, setPendingType] = useState<'board' | 'table' | null>(null);

const switchTo = (type: 'board' | 'table') => {
  if (type === currentView.type) return;
  if (createView.isPending || pendingType === type) return;

  const existing = viewsQuery.data?.find((v) => v.type === type);
  if (existing) {
    onSwitch(existing.id);
    return;
  }

  setPendingType(type);
  createView
    .mutateAsync({
      name: type === 'board' ? 'Board' : 'Table',
      type,
      config: {},
    })
    .then((created) => onSwitch(created.id))
    .catch((err) => console.error('Failed to create sibling view:', err))
    .finally(() => setPendingType(null));
};
```
Only the `pendingType` union and the `name:` label lookup need widening to 6 types (e.g. a `VIEW_TYPES.find((v) => v.type === type)?.label` lookup instead of the inline ternary). The guard logic (existing-sibling lookup, in-flight dedup) is untouched — this is the exact mechanism CONTEXT.md's D-10 says "carries over unchanged."

**UI shape — replace segmented-control markup (lines 62-84) with dropdown**, following `ViewSettingsMenu.tsx`'s popover shell exactly (see below) but left-aligned (`left-0` not `right-0`, since ViewSwitcher is first in the toolbar row per UI-SPEC's Interaction Contract): trigger button shows current view's icon + label + `ChevronDown`, `min-h-[32px]`; open state renders `fixed inset-0 z-20` backdrop + `absolute left-0 top-full mt-1 z-30` panel with 6 stacked rows (`min-h-[32px] px-2 py-1.5`, hover `bg-gray-100 dark:hover:bg-slate-800`, selected row `text-primary-600` + `bg-primary-50 dark:bg-primary-900/20`), closing the menu on select (`switchTo(type)` then `setEditing(false)`).

---

### `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` (component, CRUD) — EXTEND

**Analog:** itself, prior version (full file read, 131 lines)

**Popover shell pattern to replicate for ViewSwitcher's dropdown and to extend here** (lines 71-84):
```typescript
<div className="relative">
  <button
    type="button"
    aria-label="View settings"
    onClick={() => setEditing((o) => !o)}
    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
  >
    <MoreHorizontal className="w-4 h-4" />
  </button>
  {editing && (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
      <div className="absolute right-0 top-full mt-1 z-30 w-72 max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-4">
```

**Property-picker-conditional-on-view.type pattern** (this is the direct precedent for Calendar's date-property picker D-01, Gallery's cover picker D-04, Timeline's start/end pickers D-06) — the existing aggregation section already demonstrates "filter schema by property type, render a `<select>`, autosave on change" (lines 102-124):
```typescript
<select
  className="saas-input !py-1.5 text-xs w-full mb-1.5"
  value={aggType}
  onChange={(e) => setAggregationType(e.target.value as AggregationConfig['type'])}
>
  <option value="count">Count</option>
  <option value="sum">Sum</option>
  <option value="avg">Average</option>
</select>
{(aggType === 'sum' || aggType === 'avg') && (
  <select
    className="saas-input !py-1.5 text-xs w-full"
    value={aggregation?.propId ?? ''}
    onChange={(e) => setAggregationProp(e.target.value)}
  >
    <option value="">Select a number property…</option>
    {numberProperties.map((property) => (
      <option key={property.id} value={property.id}>{property.name}</option>
    ))}
  </select>
)}
```
New sections wrap this same shape gated on `view.type === 'calendar' | 'gallery' | 'timeline'`, filtering `collection.schema` by `p.type === 'date'` (Calendar/Timeline) or `p.type === 'files'` (Gallery) instead of `p.type === 'number'`, writing to `view.config.calendarDateProperty` / `view.config.galleryCoverProperty` / `view.config.timelineStartProperty` + `view.config.timelineEndProperty` respectively via the **same `updateView.mutate({ config: { ...view.config, <key>: value } })` call** used by `setAggregationProp`/`toggleCardProperty` (lines 56-69). Follow the same local-state buffering pattern (WR-04 comment, lines 26-44) if adding new local state — `useState` synced via `useEffect(() => {...}, [view.id])` — though for single-select `<select>` fields (unlike checkbox toggles) buffering may be unnecessary; use judgment but stay consistent with existing card-properties/aggregation buffering if adding multiple rapid-fire fields.

**D-06 per-field independent autosave note:** Timeline's start/end pickers persist as **two separate `updateView.mutate` calls**, not a combined object — mirrors `setAggregationType`/`setAggregationProp`'s existing split (type and propId are two independent mutate calls in the current code, not merged), so this is a zero-new-pattern extension.

---

### `apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx` (component, request-response) — NEW

**Analog:** `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` (full file, 87 lines)

**Container + empty-state pattern to copy verbatim** (lines 21-52):
```typescript
const CONTAINER_CLASS =
  'border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden';

function CollectionTableEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">No records match these filters</p>
      <p className="text-xs text-gray-400">Try removing a filter condition or adjusting a value to see more records.</p>
    </div>
  );
}

export function CollectionTableView({ collection, records, updateRecord }: {...}) {
  if (records.length === 0) {
    return (
      <div className={CONTAINER_CLASS}>
        <CollectionTableEmptyState />
      </div>
    );
  }
  return ( ... );
}
```
List view reuses this exact container/empty-state shell (rename component + copy text verbatim per UI-SPEC's Copywriting Contract), but replaces the `<table>` body with stacked rows per D-09: `flex items-center justify-between gap-3 px-2.5 py-2 border-t border-gray-100 dark:border-slate-800` (first row no top border).

**Row content — reuse `formatCardPropertyValue` and title-rendering convention from `BoardCard.tsx`** (see below) rather than Table's per-column `<td>` grid — do not copy `CollectionTableView`'s `<table>`/`<PropertyField>` cell-editing pattern, since List's card-face properties are **read-only previews** like Board, not directly-editable cells like Table.

**Props signature to follow** (matches `CollectionTableView`'s signature shape, lines 37-45):
```typescript
export function CollectionListView({
  collection, records, collectionId, titlePropId, cardProperties,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  collectionId: string;
  titlePropId: string;
  cardProperties: CollectionPropertyDef[];
}) {
```
(No `updateRecord` mutation prop needed — List, like Board's card face, has no inline cell-editing; click-through is the only interaction per UI-SPEC.)

---

### `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx` (component, CRUD + request-response) — NEW

**Analog 1 — card/chip rendering + inline-edit-on-create, from `BoardCard.tsx`:**

**`formatCardPropertyValue` to import and reuse verbatim** (lines 24-56) — do not reimplement person/multi-select label resolution:
```typescript
function formatCardPropertyValue(
  value: unknown,
  property: CollectionPropertyDef,
  personNames: Map<string, string>,
): string {
  switch (property.type) {
    case 'checkbox': return value ? 'Yes' : 'No';
    case 'person': { ... }
    case 'select': { ... }
    case 'multi-select': { ... }
    case 'files':
    case 'relation':
      return Array.isArray(value) ? value.join(', ') : '';
    default:
      return value == null ? '' : String(value);
  }
}
```
This function is currently module-private to `BoardCard.tsx` — either export it from `BoardCard.tsx` (preferred, avoids duplication across List/Calendar/Gallery/Timeline) or duplicate verbatim; planner should decide export vs. duplicate, but the logic itself must not be reimplemented.

**Inline-editable title on creation pattern (D-03's "click day → create → inline-edit title")** — directly modeled on `BoardCard`'s `autoFocusEdit`/`onExitEdit` props and debounced-commit logic (lines 79-134):
```typescript
const [editing, setEditing] = useState(autoFocusEdit);
const [draft, setDraft] = useState(title);
const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastCommittedRef = useRef(title);

const flush = (next: string) => {
  if (debounceTimer.current) clearTimeout(debounceTimer.current);
  if (next !== lastCommittedRef.current) {
    lastCommittedRef.current = next;
    updateRecord.mutate({ id: record.id, data: { props: { ...record.props, [titlePropId]: next } } });
  }
};
const handleChange = (next: string) => {
  setDraft(next);
  if (debounceTimer.current) clearTimeout(debounceTimer.current);
  debounceTimer.current = setTimeout(() => flush(next), 800);
};
const commitAndExit = () => { flush(draft); setEditing(false); onExitEdit?.(); };
```
```jsx
<input
  autoFocus type="text" value={draft} placeholder="Untitled"
  onChange={(e) => handleChange(e.target.value)}
  onBlur={commitAndExit}
  onKeyDown={(e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitAndExit(); }
    if (e.key === 'Escape') { setDraft(lastCommittedRef.current); setEditing(false); onExitEdit?.(); }
  }}
  className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-sm text-sm text-gray-800 dark:text-gray-200"
/>
```
Calendar's day-cell chips reuse this same `editing`/`draft`/debounce-flush shape — either compose `<BoardCard>` directly inside day cells (simplest, matches D-03's "mirrors Phase 24's D-07 inline + New pattern" instruction) or extract a shared `RecordTitleInlineEdit` — planner's call, but the debounce/flush/escape logic must not be reimplemented from scratch.

**Click-through pattern to copy verbatim** (line 142):
```typescript
onClick={() => window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
```

**Click-to-create wiring** — new `useCreateRecord(collectionId)` hook call (see `useRecords.ts` lines 53-61) on empty-day-cell click:
```typescript
const createRecord = useCreateRecord(collectionId);
// on day-cell click (not on an existing chip):
createRecord.mutate({ props: { [titlePropId]: '', [calendarDateProperty]: dayIso } });
```

**Analog 2 — container/empty-state shell, from `CollectionTableView.tsx`** (lines 21-35): reuse `CONTAINER_CLASS`-equivalent border/rounded wrapper and the exact empty-state JSX shape for both the "no calendarDateProperty chosen" state and the "no records match filters" state (copy per UI-SPEC's Copywriting Contract table).

**Props signature:**
```typescript
export function CollectionCalendarView({
  collection, records, collectionId, titlePropId, view, updateView, cardProperties,
}: {
  collection: DataCollection;
  records: CollectionRecord[];
  collectionId: string;
  titlePropId: string;
  view: CollectionView;
  cardProperties: CollectionPropertyDef[];
}) {
```
Month-navigation state (`currentMonth`) is local `useState`, not persisted to `view.config` (D-03 scopes to single month view with local prev/next nav only — UI-SPEC doesn't specify month persisting across sessions).

---

### `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx` (component, request-response) — NEW

**Analog:** `board/BoardCard.tsx` for card-face body (title + `cardProperties[]` + `formatCardPropertyValue`), reused near-verbatim per UI-SPEC's explicit instruction: "identical to today's BoardCard body layout."

**Card body pattern to copy** (lines 146-157, non-editing branch):
```jsx
<span className={title ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 italic'}>
  {title || 'Untitled'}
</span>
{(cardProperties ?? []).length > 0 && (
  <div className="mt-1.5 space-y-1">
    {cardProperties!.map((property) => (
      <div key={property.id} className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {formatCardPropertyValue(record.props[property.id], property, personNames)}
      </div>
    ))}
  </div>
)}
```
Gallery prepends a cover block above this same body (per D-04/D-05 and UI-SPEC's Gallery card grid section): `h-32` fixed height, `object-cover` `<img>` when `galleryCoverProperty` is set and non-empty for the record, else a plain `bg-gray-100 dark:bg-slate-800` placeholder block (no icon).

**Card surface classes to reuse** (line 144, border/shadow/radius convention, extend with grid sizing):
```typescript
'rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden'
```
(Gallery drops `cursor-grab`/`touch-none`/`{...attributes} {...listeners}` since Gallery cards are not draggable — no `useSortable`, no dnd-kit import needed.)

**Click-through** — same `window.open` pattern as `BoardCard.tsx` line 142, verbatim.

**Grid container** (new, no direct analog — compose from Tailwind conventions declared in UI-SPEC): `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`.

---

### `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx` (component, transform + request-response) — NEW

**No direct Gantt-chart analog exists in the codebase** — compose from two:

**Analog 1 — container/empty-state shell + month-nav pairing with Calendar** (from `CollectionTableView.tsx` lines 21-35, and reuse the same month-nav `ChevronLeft`/`ChevronRight` header built for Calendar per D-08 "mirrors D-03's nav pattern exactly").

**Analog 2 — click-through, from `BoardCard.tsx`** line 142 verbatim.

**Bar layout — no existing analog; derive proportional positioning as pure transform logic** (new, small, isolated function — recommend co-locating in the same file or a tiny helper):
```typescript
// Given month day-count and a record's start/end date values (already
// filtered to only records where BOTH timelineStartProperty and
// timelineEndProperty are set — D-07), compute left/width percentages
// for inline style={{ left: `${leftPct}%`, width: `${widthPct}%` }}.
function computeBarPosition(startIso: string, endIso: string, monthStart: Date, daysInMonth: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const clampedStart = Math.max(0, (new Date(startIso).getTime() - monthStart.getTime()) / dayMs);
  const clampedEnd = Math.min(daysInMonth, (new Date(endIso).getTime() - monthStart.getTime()) / dayMs + 1);
  const leftPct = (clampedStart / daysInMonth) * 100;
  const widthPct = ((clampedEnd - clampedStart) / daysInMonth) * 100;
  return { leftPct, widthPct };
}
```
This mirrors `viewFilters.ts`'s `compareValues`/`aggregateColumn` style (small pure functions, no side effects, called before render) — same code-organization convention, not a literal copy (no existing date-range math exists to copy from).

**D-07 filter-out-incomplete-records logic** — apply as an additional `.filter()` before rendering lanes, composed the same way `applyFilters`/`applySorts` already compose (call order: `applyFilters` → `applySorts` → new `.filter(r => r.props[startPropId] && r.props[endPropId])` → map to lanes). Do not fold this into `viewFilters.ts` itself (it's timeline-specific, not a generic filter condition the user configures).

---

## Shared Patterns

### View data pipeline (filters/sorts, unchanged)
**Source:** `apps/workspaces/src/lib/projectPage/viewFilters.ts` (`applyFilters`, `applySorts`)
**Apply to:** All 4 new view components — call in `BoardBlock.tsx` exactly as already done for Board/Table (lines 143-145):
```typescript
const activeFilters = (view.config.filters as FilterCondition[]) ?? [];
const filtered = applyFilters(records, activeFilters, collection.schema);
const sorted = applySorts(filtered, (view.config.sorts as SortCondition[]) ?? [], collection.schema);
```
No new file, no new logic — this happens once in `BoardBlock.tsx` before branching into any view renderer.

### Record mutation hooks (unchanged)
**Source:** `apps/workspaces/src/lib/hooks/useRecords.ts`
**Apply to:** Calendar (`useCreateRecord` for click-to-create, `useUpdateAnyRecord` for inline title commit — same instance `BoardBlock.tsx` already constructs at line 123, do not construct a second instance per view)
```typescript
export function useCreateRecord(collectionId: string) { ... }
export function useUpdateAnyRecord(collectionId: string) { ... }
export function useUpdateView(id: string) { ... }
```

### View-type branch point (extend, not duplicate)
**Source:** `apps/workspaces/src/components/projectPage/BoardBlock.tsx` lines 196-218
```typescript
{view.type === 'table' ? (
  <CollectionTableView collection={collection} records={sorted} updateRecord={updateRecord} />
) : isFilteredEmpty ? (
  <BoardEmptyFilterState />
) : (
  <DndContext ...>{/* board columns */}</DndContext>
)}
```
**Apply to:** Extend this ternary chain into a small switch/if-chain covering `'table' | 'list' | 'calendar' | 'gallery' | 'timeline'` before falling through to the board (default) branch — each new view component receives `collection`, `records={sorted}`, `updateRecord` (Calendar only additionally needs `collectionId`, `titlePropId`, `view` for its config-driven property, plus a `useCreateRecord` instance for click-to-create).

### View settings popover shell (auth-equivalent: the hand-rolled "popover" idiom)
**Source:** `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` lines 81-84 (`fixed inset-0 z-20` backdrop + `absolute z-30` panel)
**Apply to:** Both the extended `ViewSettingsMenu.tsx` (new per-view-type sections) and the rewritten `ViewSwitcher.tsx` (dropdown menu) — identical shell, differing only in `left-0` vs `right-0` alignment per UI-SPEC's Interaction Contract.

### Empty-state copy (verbatim reuse)
**Source:** `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` lines 28-35 (`CollectionTableEmptyState`)
**Apply to:** All 4 new views' "no records match filters" case — copy text and JSX shape verbatim (`flex flex-col items-center justify-center py-10 text-center`, heading `text-sm text-gray-700 dark:text-gray-300`, body `text-xs text-gray-400`). View-specific "choose a property" empty states (Calendar/Timeline unset config) use the same shell with copy from UI-SPEC's Copywriting Contract table.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Gantt bar proportional-positioning logic (inside `CollectionTimelineView.tsx`) | utility (transform) | transform | No date-range/Gantt math exists anywhere in the codebase (`viewFilters.ts` only compares single date values, never a range-to-percentage layout) — new pure-function logic, styled after `viewFilters.ts`'s small-pure-function convention but with no literal precedent to copy |
| Calendar month-grid cell layout (day-of-month iteration, weekday headers) | component (layout) | transform | No existing month-grid component in the codebase — compose fresh from Tailwind grid utilities per UI-SPEC's spacing/color tables; no analog beyond generic CSS grid conventions already used elsewhere (e.g. Gallery's `grid-cols-*`) |

## Metadata

**Analog search scope:** `apps/workspaces/src/components/projectPage/board/`, `apps/workspaces/src/components/projectPage/collectionTable/`, `apps/workspaces/src/components/projectPage/BoardBlock.tsx`, `apps/workspaces/src/lib/projectPage/viewFilters.ts`, `apps/workspaces/src/lib/hooks/useRecords.ts`
**Files scanned:** 7 read in full (all ≤ 222 lines, single-pass reads, no re-reads)
**Pattern extraction date:** 2026-07-15
