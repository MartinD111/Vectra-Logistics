# Phase 25: View UX Parity - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 10 (7 new, 3 modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/workspaces/src/lib/api/records.api.ts` (ADD `updateView`) | service (API client fn) | request-response | same file, `updateCollection` (lines 78-79) | exact |
| `apps/workspaces/src/lib/hooks/useRecords.ts` (ADD `useUpdateView`) | hook | CRUD | same file, `useUpdateCollectionSchema` (lines 37-43) | exact |
| `apps/workspaces/src/lib/projectPage/viewFilters.ts` (NEW) | utility | transform | `apps/workspaces/src/components/projectPage/BoardBlock.tsx` `groupRecordsByColumn` (lines 26-41) | role-match (closest pure-function-over-records precedent) |
| `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (EXTEND) | component (container) | CRUD + transform | itself (existing) | exact — same file, additive changes |
| `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` (EXTEND) | component | request-response | itself (existing); property rendering from `PropertyPanel.tsx` (lines 46-55) | exact / role-match |
| `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` (EXTEND) | component | transform (aggregation) | itself (existing) | exact |
| `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx` (NEW) | component (popover) | request-response | `apps/workspaces/src/components/records/PropertyField.tsx` `PersonField` (lines 99-147) + `apps/workspaces/src/components/projectPage/board/AddColumnControl.tsx` (whole file) | role-match |
| `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` (NEW) | component (popover) | request-response | `PropertyField.tsx` `PersonField` popover (lines 111-146) + `PropertyPanel.tsx` schema-iteration (lines 46-55) | role-match |
| `apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx` (NEW) | component | transform | `BoardColumn.tsx` column-level render structure (lines 77-151) | role-match |
| `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` (NEW) | component (popover/control) | request-response + CRUD | `PersonField` popover (lines 111-146) for UI shell; `BoardBlock.tsx`'s `recordsApi.createView` provisioning call (lines 97-100) for the create-or-retype logic | role-match |
| `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` (NEW) | component | CRUD (read + cell edit) | `PropertyPanel.tsx` (whole file, esp. lines 46-55 cell-render loop) for schema-driven cell rendering; `apps/workspaces/src/components/projectPage/TableBlock.tsx` (whole file) for table markup shape ONLY — do not copy its non-schema-driven contentEditable cell pattern | role-match (rendering shape from TableBlock, cell semantics from PropertyPanel) |
| `apps/workspaces/src/lib/projectPage/registry.tsx` (possibly EXTEND, `'collection-view'` entry, lines 247-250) | config/registry | request-response | itself (existing) | exact |

## Pattern Assignments

### `apps/workspaces/src/lib/api/records.api.ts` (service, request-response)

**Analog:** same file, `updateCollection` (lines 78-79)

```typescript
// Source: apps/workspaces/src/lib/api/records.api.ts, lines 78-79
updateCollection: (id: string, data: UpdateCollectionInput) =>
  apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`, 'PATCH', data).then((r) => r.collection),
```

**Copy as (new function, same object literal, same file):**
```typescript
// ADD near getView (line 96-97), following the exact updateCollection shape:
export interface UpdateViewInput {
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
}
// inside recordsApi object:
updateView: (id: string, data: UpdateViewInput) =>
  apiFetch<{ view: CollectionView }>(`${BASE}/views/${id}`, 'PATCH', data).then((r) => r.view),
```
The backend endpoint already exists and is confirmed: `router.patch('/views/:id', updateView)` in `apps/api/src/domains/records/records.routes.ts:28`, wired through `records.controller.ts:67-69` → `records.service.ts:122-...` → `records.repository.ts:145`. `UpdateViewSchema` (Zod, `apps/api/src/domains/records/dto/update-view.dto.ts`) already accepts `{ name?, type?, config? }` with `config: z.record(z.string(), z.unknown())` — no backend changes needed.

---

### `apps/workspaces/src/lib/hooks/useRecords.ts` (hook, CRUD)

**Analog:** same file, `useUpdateCollectionSchema` (lines 37-43)

```typescript
// Source: apps/workspaces/src/lib/hooks/useRecords.ts, lines 37-43
export function useUpdateCollectionSchema(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schema: CollectionPropertyDef[]) => recordsApi.updateCollection(id, { schema }),
    onSuccess: (collection) => qc.setQueryData(qk.collection(id), collection),
  });
}
```

**Copy as:**
```typescript
export function useUpdateView(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateViewInput) => recordsApi.updateView(id, data),
    onSuccess: (view) => qc.setQueryData(qk.view(id), view),
  });
}
```
Also note the existing `qk.view(id)` key (line 16) is already correct — no query-key changes needed. If `ViewSwitcher` needs to enumerate sibling views (board vs. table `viewId` for the same collection), reuse `useViews(collectionId)` (lines 81-88) unmodified — do not add a new query key for this.

**Create-view pattern to clone for "create table view on first switch":**
```typescript
// Source: apps/workspaces/src/lib/hooks/useRecords.ts, lines 105-111
export function useCreateView(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateViewInput) => recordsApi.createView(collectionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.views(collectionId) }),
  });
}
```
This hook already exists and is unmodified — `ViewSwitcher` should call it directly, not duplicate it.

---

### `apps/workspaces/src/lib/projectPage/viewFilters.ts` (NEW, utility, transform)

**Analog:** `groupRecordsByColumn` in `BoardBlock.tsx` (lines 26-41) — the only existing precedent for a pure function that transforms the `records` array before board rendering.

```typescript
// Source: apps/workspaces/src/components/projectPage/BoardBlock.tsx, lines 24-41
/** Groups records into board columns from the live option values of the
 *  groupBy select property — never hand-authored (BOARD-01). */
function groupRecordsByColumn(
  records: CollectionRecord[],
  schema: CollectionPropertyDef[],
  groupByPropId: string,
) {
  const groupByProp = schema.find((p) => p.id === groupByPropId);
  const options = (groupByProp?.options ?? []) as { id: string; label: string }[];

  return options.map((opt) => ({
    id: opt.id,
    title: opt.label,
    cards: records
      .filter((r) => r.props[groupByPropId] === opt.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}
```

**Pattern to follow for `applyFilters`/`applySorts`/`aggregateColumn`:** same signature shape — `(records: CollectionRecord[], config, schema: CollectionPropertyDef[]) => CollectionRecord[]` (or a number for aggregation) — pure, no side effects, called inline in `BoardBlock`'s render body before `groupRecordsByColumn`. Follow CONTEXT.md D-02: filters combine with `Array.every` (AND-only), matching the codebase's existing `Array.filter`/`.find` idioms already used in this same function.

**Property-type-aware branching to model filter operators on:** `PropertyField.tsx`'s `switch (property.type)` (lines 27-94) — the same 12-branch switch is the template for filter operator sets per type (text: equals/contains; select: is/is not; number/date: >/</between), per CONTEXT.md's discretion note.

---

### `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (EXTEND)

**Analog:** itself. Extend, do not restructure, the existing data flow:

```typescript
// Source: apps/workspaces/src/components/projectPage/BoardBlock.tsx, lines 122-127
const collection = collectionQuery.data;
const view = viewQuery.data;
const records = recordsQuery.data;
const groupByPropId = String(view.config.groupBy ?? '');
const titlePropId = collection.schema[0]?.id ?? '';
const columns = groupRecordsByColumn(records, collection.schema, groupByPropId);
```

**Extension pattern:** insert `applyFilters`/`applySorts` calls between `records` and `groupRecordsByColumn`:
```typescript
const filtered = applyFilters(records, (view.config.filters as FilterCondition[]) ?? [], collection.schema);
const sorted = applySorts(filtered, (view.config.sorts as SortCondition[]) ?? [], collection.schema);
const columns = groupRecordsByColumn(sorted, collection.schema, groupByPropId);
```
Branch on `view.type` per Assumption A1 (confirmed): `registry.tsx` lines 247-250 hardcode `<BoardBlock ... />` for both view and edit contexts of `'collection-view'` — `entry()` takes exactly one component per block kind (confirmed by reading the surrounding registry entries, e.g. `'kanban'` at lines 243-246 which also uses a single view-renderer + a separate migration-gate edit-renderer, not a type-conditional one). Therefore `BoardBlock` (or a thin wrapper) must internally branch: `view.type === 'table' ? <CollectionTableView .../> : <BoardColumn/AddColumnControl board rendering>`. Do not touch `registry.tsx`'s entry signature.

**Toolbar mount point:** add the `FilterSortToolbar`, `ViewSettingsMenu`, and `ViewSwitcher` controls in the `<div className="saas-card !p-4">` header area, alongside the existing `{block.title && <h3>...}` line (line 161), following the same flat-JSX-in-header convention.

---

### `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` (EXTEND)

**Analog:** itself (title-only rendering, lines 89-101) + `PropertyPanel.tsx`'s property-loop for the *pattern* to render `cardProperties[]`:

```typescript
// Source: apps/workspaces/src/components/projectPage/board/BoardCard.tsx, lines 89-101
return (
  <div ref={setNodeRef} {...attributes} {...listeners} onClick={...} style={...} className="rounded-md ...">
    <span className={title ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 italic'}>
      {title || 'Untitled'}
    </span>
  </div>
);
```

```typescript
// Source: apps/workspaces/src/components/records/PropertyPanel.tsx, lines 46-55 (pattern for rendering cardProperties list below title)
{otherProperties.map((property) => (
  <div key={property.id} className="mb-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{property.name}</p>
    <PropertyField
      property={property}
      value={record.props[property.id]}
      onCommit={(v) => onUpdateRecord.mutate({ props: { ...record.props, [property.id]: v } })}
    />
  </div>
))}
```
**Divergence per D-03/D-decision:** cards render `cardProperties[]` **read-only** below the title (click-through to record detail remains the edit path per CONTEXT.md's "do not turn every card-face property into an inline editor") — do not wire `PropertyField`'s `onCommit` into a live mutation on the card face; either render a lightweight read-only value display per property type, or pass a no-op `onCommit` and rely on the card's existing `onClick` (line 94, opens `/collections/:id/records/:id` in a new tab) as the sole edit path.

---

### `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` (EXTEND)

**Analog:** itself — existing header structure (lines 77-112) is the mount point for the new aggregation footer.

```typescript
// Source: apps/workspaces/src/components/projectPage/board/BoardColumn.tsx, lines 77-112 (existing header, count badge at line 102)
<div className="w-56 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2 group/column">
  <div className="flex items-center justify-between px-1 mb-2 gap-1">
    {/* title / rename */}
    <span className="text-[10px] text-gray-400 flex-shrink-0">{column.cards.length}</span>
    {/* delete button */}
  </div>
  {/* ...cards... */}
</div>
```
The existing `{column.cards.length}` (line 102) IS already a count aggregation — extend this same line's sibling area (or add a footer `<div>` after the `<SortableContext>` block, before the "+ New" button at line 142) to host `ColumnAggregation`, which computes count always + optional sum/avg via `viewFilters.ts`'s `aggregateColumn` function.

---

### `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx` (NEW)

**Analog (popover shell):** `PersonField` in `PropertyField.tsx` (lines 99-147)

```typescript
// Source: apps/workspaces/src/components/records/PropertyField.tsx, lines 111-146
<div className="relative">
  <button
    type="button"
    onClick={() => setEditing((o) => !o)}
    className="w-full flex items-center justify-between gap-2 text-left min-h-[32px] saas-input !py-2 text-sm mt-1"
  >
    <span>...</span>
    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
  </button>
  {editing && (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
      <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
        {/* condition rows here */}
      </div>
    </>
  )}
</div>
```

**Analog (condition-row add/remove + commit pattern):** `AddColumnControl.tsx` (whole file, lines 15-73) — local `useState` draft + `useState` open/close + a mutation `.mutate()`/`.mutateAsync()` call on commit, following the same `submitting` guard pattern (lines 24, 30, 36-41).

**Persistence pattern:** every condition-row add/remove/edit calls `useUpdateView(view.id).mutate({ config: { ...view.config, filters: nextFilters } })` (mirrors `AddColumnControl`'s `updateSchema.mutate(nextSchema)` at line 36, and `BoardColumn`'s `commitRename`/`commitDelete` mutate-on-schema-diff pattern at lines 45-66).

---

### `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` (NEW)

**Analog:** `PersonField` popover shell (same as above, lines 111-146) + `PropertyPanel.tsx`'s schema-iteration loop (lines 46-55) for listing `collection.schema` entries as checklist rows.

**Checkbox toggle pattern (closest analog: `PropertyField.tsx`'s `checkbox` case, lines 28-36):**
```typescript
// Source: apps/workspaces/src/components/records/PropertyField.tsx, lines 28-36
case 'checkbox':
  return (
    <input
      type="checkbox"
      checked={!!value}
      onChange={(e) => onCommit(e.target.checked)}
      className="rounded border-gray-300 text-primary-600"
    />
  );
```
Per D-03/CONTEXT.md explicit note ("no existing analog for a property-picker checklist scoped to a view") — do not reuse `PropertyField` itself; build a simple `collection.schema.map(property => <label><input type="checkbox" checked={cardProperties.includes(property.id)} onChange={...toggle...}/>{property.name}</label>)` list inside the popover panel, writing the toggled array to `useUpdateView(view.id).mutate({ config: { ...view.config, cardProperties: next } })`.

---

### `apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx` (NEW)

**Analog:** `BoardColumn.tsx`'s existing count badge (`{column.cards.length}`, line 102) for placement; the "no analog, discretion" note from RESEARCH.md's Pitfall 3 for the type-filtering logic.

**Pattern:** a pure function `aggregateColumn(records, aggType, propId)` in `viewFilters.ts`, called from `BoardColumn`'s render body — `count` always available (no property needed, `= records.length`), `sum`/`avg` require filtering `collection.schema.filter(p => p.type === 'number')` before offering as picker options (per Pitfall 3). Aggregation config storage location is Claude's discretion per D-04 — RESEARCH.md's Open Question 2 recommends a view-wide (not per-column) `view.config.columnAggregations: { type: 'count'|'sum'|'avg', propId?: string }` shape for simplicity; if the planner instead goes per-column, extend `column` data with an aggregation config field.

---

### `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` (NEW)

**Analog (popover UI shell):** `PersonField` (lines 111-146), rendering a Board/Table two-item list instead of team members.

**Analog (create-or-retype logic):** `BoardBlock.tsx`'s existing view-provisioning call (lines 97-100):
```typescript
// Source: apps/workspaces/src/components/projectPage/BoardBlock.tsx, lines 97-100
recordsApi.createView(collection.id, { name: 'Board', type: 'board', config: { groupBy: statusId } })
  .then((view) => onChange?.({ ...block, collectionId: collection.id, viewId: view.id }))
```
**Extension pattern:** on switch, call `useViews(collectionId)` (existing hook, `useRecords.ts` lines 81-88) to find an existing view of the target `type`; if found, `onChange?.({ ...block, viewId: found.id })` (no API call); if not found, call `useCreateView(collectionId).mutateAsync({ name: 'Table', type: 'table', config: {} })` then `onChange?.({ ...block, viewId: created.id })` — per RESEARCH.md's Open Question 1 recommendation (create-once-then-remember, avoid duplicate view rows on repeated toggling). This never calls `createRecord`/`updateRecord` — no `collection_records` duplication risk by construction.

---

### `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` (NEW)

**Analog (schema-driven cell rendering):** `PropertyPanel.tsx` (lines 46-55, the `otherProperties.map` loop) — reuse `PropertyField` unchanged per cell:
```typescript
// Source: apps/workspaces/src/components/records/PropertyPanel.tsx, lines 46-55
{otherProperties.map((property) => (
  <div key={property.id} className="mb-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{property.name}</p>
    <PropertyField
      property={property}
      value={record.props[property.id]}
      onCommit={(v) => onUpdateRecord.mutate({ props: { ...record.props, [property.id]: v } })}
    />
  </div>
))}
```

**Analog (table markup shape ONLY — not cell editing semantics):** `apps/workspaces/src/components/projectPage/TableBlock.tsx` (whole file, esp. lines 55-80) for the `<table><thead><tbody>` DOM structure and Tailwind class conventions (`CONTAINER_CLASS`, `HEADER_ROW_CLASS`, `CELL_CLASS`). **Do not** copy `TableBlock.tsx`'s `Cell` component's raw-contentEditable-with-manual-textContent-sync pattern (lines 18-53) — that is for the unrelated static page-body table block; `CollectionTableView`'s cells must use `PropertyField` (schema-typed inputs), not contentEditable divs.

**Naming/placement (Pitfall 2, explicit anti-pattern):** name the component `CollectionTableView`, place it in a new `apps/workspaces/src/components/projectPage/collectionTable/` subfolder — never `TableView`/`TableBlock`, which are already exported from `TableBlock.tsx` and would collide/shadow.

**Data flow:** rows = `applyFilters`/`applySorts`(`recordsQuery.data`, view.config, collection.schema) (same derived pipeline as board, shared with `BoardBlock` via `viewFilters.ts`); columns = `collection.schema` (all properties, default order, per D-05's "reasonable default" note); each cell's `onCommit` wired to the existing `useUpdateAnyRecord(collectionId)` hook (`BoardBlock.tsx` line 107) — same hook `BoardBlock`/`BoardCard` already use, do not create a second update-record hook.

---

### `apps/workspaces/src/lib/projectPage/registry.tsx` (possibly EXTEND)

**Analog:** itself, `'collection-view'` entry (lines 247-250):
```typescript
// Source: apps/workspaces/src/lib/projectPage/registry.tsx, lines 247-250
'collection-view': entry('collection-view',
  ({ block, ctx }) => <BoardBlock block={block as CollectionViewBlock} onChange={ctx.onChange} />,
  ({ block, onUpdate }) => <BoardBlock block={block as CollectionViewBlock} onChange={onUpdate} />,
),
```
No change expected here per Assumption A1 (confirmed) — `entry()` takes exactly one component per block kind/context, so `BoardBlock` must internally branch on `view.type`, not the registry. Only touch this file if the planner decides to rename `BoardBlock` to a more neutral `CollectionViewBlock` wrapper component (optional refactor, not required).

## Shared Patterns

### Hand-rolled popover convention
**Source:** `apps/workspaces/src/components/records/PropertyField.tsx` (`PersonField`, lines 111-146)
**Apply to:** `FilterSortToolbar.tsx`, `ViewSettingsMenu.tsx`, `ViewSwitcher.tsx` — every new popover this phase introduces.
```typescript
<div className="relative">
  <button type="button" onClick={() => setEditing((o) => !o)} className="...">...</button>
  {editing && (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
      <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
        {/* content */}
      </div>
    </>
  )}
</div>
```
No `Popover`/`DropdownMenu` primitive exists in `@vectra/ui` (confirmed: `packages/ui/src` only has `AppSwitcher`, `Navbar`, `AppProviders`) — do not introduce one.

### View-config mutation hook
**Source:** `apps/workspaces/src/lib/hooks/useRecords.ts` (`useUpdateCollectionSchema`, lines 37-43)
**Apply to:** All new config writes (filters, sorts, cardProperties, aggregation, type/viewId switch) — clone into a single `useUpdateView(id)` hook and reuse it everywhere; do not write bespoke mutation hooks per feature.
```typescript
export function useUpdateView(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateViewInput) => recordsApi.updateView(id, data),
    onSuccess: (view) => qc.setQueryData(qk.view(id), view),
  });
}
```

### Schema-driven property rendering
**Source:** `apps/workspaces/src/components/records/PropertyField.tsx` (whole file, 12-branch switch on `property.type`)
**Apply to:** Table view cells, filter condition value inputs. Reuse as-is — do not build a second property-type switch.

### Client-side derived state over already-fetched records
**Source:** `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (`groupRecordsByColumn`, lines 26-41)
**Apply to:** `applyFilters`, `applySorts`, `aggregateColumn` in the new `viewFilters.ts` — same "pure function over the full `recordsQuery.data` array, called inline in the render body" pattern. No new backend query-param endpoint (explicit anti-pattern per RESEARCH.md).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/workspaces/src/lib/projectPage/viewFilters.ts` (filter/sort/aggregate logic itself) | utility | transform | No existing filter/sort/aggregation evaluator anywhere in the codebase — `groupRecordsByColumn` is the closest structural precedent (pure function, records array in, transformed array out) but implements grouping, not filtering/sorting/aggregating; the operator-matching logic (equals/contains/is/between) and reduce-based aggregation math are net-new |
| Filter operator dropdown (inside `FilterSortToolbar.tsx`) | component (sub-control) | request-response | No existing operator-picker UI in the codebase; must be built new, informed by `PropertyField`'s type switch for *which* operators are valid per type, but the operator `<select>` itself has no analog |
| Card-face property-picker checklist (inside `ViewSettingsMenu.tsx`) | component (sub-control) | request-response | CONTEXT.md D-03 explicitly states no existing analog for a property-picker checklist scoped to a view; closest precedent (`PropertyPanel`) informs rendering, not the picker UI |

## Metadata

**Analog search scope:** `apps/workspaces/src/components/projectPage/`, `apps/workspaces/src/components/projectPage/board/`, `apps/workspaces/src/components/records/`, `apps/workspaces/src/lib/api/records.api.ts`, `apps/workspaces/src/lib/hooks/useRecords.ts`, `apps/workspaces/src/lib/projectPage/registry.tsx`, `apps/api/src/domains/records/` (routes/controller/service/repository/dto, confirmed backend endpoint already exists — no backend files listed above since none require changes)
**Files scanned:** 12 read in full (no file >2000 lines; all single-pass reads, no re-reads)
**Pattern extraction date:** 2026-07-14
