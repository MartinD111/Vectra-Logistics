# Phase 25: View UX Parity - Research

**Researched:** 2026-07-14
**Domain:** Next.js/React client-side view-layer UX (filters, sorts, card-face config, aggregations, view switching) over an existing Express/Postgres Records+Views API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Filters & Sorts (VIEWX-01)
- **D-01:** Filter/sort UI is a toolbar dropdown builder — a "Filter" button and a "Sort" button above the board open a popover where the user adds condition rows (property + operator + value for filters; property + direction for sorts), Notion-style. Multiple conditions are supported, not a single-row-only builder.
- **D-02:** Multiple filter conditions combine with **AND only** — every condition must match. No OR/mixed logic in this phase; keep the evaluation model simple.
- Config persists to `view.config.filters[]` / `view.config.sorts[]` per the Phase 22 schema; no new migration expected for this alone.

### Card Face Properties (VIEWX-02)
- **D-03:** A view settings entry point (e.g. a "•••"/settings icon on the board) opens a checklist of the collection's schema properties, toggle on/off which ones render on the card face below the title. Selection persists to `view.config.cardProperties[]`. This is a new UI surface — no existing analog for a property-picker checklist scoped to a view (the closest precedent is Phase 23's schema-driven property panel, which can inform rendering but not the picker UI itself).

### Column Aggregations (VIEWX-03)
- **D-04:** Placement and interaction (e.g. column-header footer showing "Count: N" or "Sum: $X", with a way to pick aggregation type + which number property) are Claude's discretion. Hard requirement: count is always available per column; sum and avg must work for a user-chosen number property. No other aggregation types (median, min/max, date range, % not empty) required this phase.

### View Switching (VIEWX-04)
- **D-05:** Board and Table are the two view types this phase must support switching between on the same `collection-view` block, without creating duplicate `collection_records` rows — switching changes which saved `collection_views` row (and its `type`) the block points at (or creates a new view row for the target type against the same `collection_id`), it never re-materializes data. Table view reuses the schema-driven property rendering built for Phase 23's record-detail property panel (read-across, not a new editor) rather than inventing a second property-rendering convention.
- Calendar/gallery/list/timeline view types remain explicitly out of scope for this phase — do not build UI entry points for them beyond acknowledging they exist as future `type` values.

### Claude's Discretion
- Exact filter operator set per property type (e.g. `equals`/`contains` for text, `is`/`is not` for select, `>`/`<`/`between` for number/date) — follow what's natural for each property type from Phase 23's schema, not re-litigated here.
- Column aggregation placement/interaction details (see D-04).
- Whether view switching is a dropdown/tab control on the `collection-view` block chrome or another UI location — follow whatever's consistent with the block's existing toolbar (filter/sort buttons, view settings icon) from D-01/D-03.
- Table view's exact column set/ordering when first created (e.g. default to all schema properties) — reasonable default, not a hard requirement.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Sub-groups/swimlanes (`subGroupBy`) and additional view types beyond table (calendar/gallery/list/timeline) were correctly recognized as out of scope for this phase and not re-discussed here; they remain candidates for a future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| VIEWX-01 | User can filter and sort a view's records | Toolbar dropdown builder (D-01/D-02), client-side `applyFilters`/`applySorts` over `useRecords` data, persisted via new `useUpdateView` hook → existing `PATCH /views/:id` |
| VIEWX-02 | User can choose which properties preview on a card face | New view-settings checklist popover (D-03) writing `view.config.cardProperties[]`; `BoardCard` extended to render them via existing `PropertyField` |
| VIEWX-03 | User can see column aggregations (count, sum/avg of a number property) on a board | New per-column aggregation footer in `BoardColumn`, client-side reduce over already-grouped records (D-04) |
| VIEWX-04 | User can switch between view types on the same collection without duplicating records | New `ViewSwitcher` control changes the block's `viewId` via existing `POST /collections/:id/views` (create) or `PATCH /views/:id` (retype); new `CollectionTableView` render path for `type: 'table'` (D-05) |
</phase_requirements>

## Summary

This phase is almost entirely frontend work. The backend already has everything needed: `collection_views.config` is an opaque JSONB blob (`PATCH /api/v1/records/views/:id` accepts `{ name?, type?, config? }` via `UpdateViewSchema`), and `records.service.test.ts` already encodes the target config shape `{ groupBy, filters: [], sorts: [], cardProperties: [] }`. No migration is needed — migration `025_records_views.sql` (the latest, applied) already defines `collection_views.type` and `collection_views.config` exactly as the spec requires. The only backend gap is the **frontend API client**: `apps/workspaces/src/lib/api/records.api.ts` has no `updateView` function and `useRecords.ts` has no `useUpdateView` mutation hook — both must be added (`createView`/`useCreateView` already exist as the pattern to clone).

On the frontend, `BoardBlock.tsx` today reads only `view.config.groupBy` and delegates 100% of rendering to `BoardColumn`/`BoardCard`, which render only the title property. This phase must: (1) add filter/sort evaluation logic that runs client-side over the already-fetched `records` array before grouping into columns, (2) extend `BoardCard` to render `view.config.cardProperties[]` below the title using the existing `PropertyField` component (already schema-driven, already handles all 12 property types read-only-safe), (3) add a column aggregation footer to `BoardColumn`, and (4) add a new `type: 'table'` render path (a new `CollectionTableView` component — **not** to be confused with the existing unrelated `apps/workspaces/src/components/projectPage/TableBlock.tsx`, which is a static inline table block for page bodies, explicitly called out as distinct in the spec §5.7) plus a view-switcher control on the block chrome that either creates a second `collection_views` row (`type: 'table'`) or updates the current row's `type` — per CONTEXT.md D-05, the block's `viewId` is what changes, records are never re-materialized.

**Primary recommendation:** Do this as pure client-side derived state (filter/sort/aggregate the already-fetched `recordsQuery.data` array in the render path of `BoardBlock`/new `CollectionTableView`, no new list/query endpoints), reuse `PropertyField` for every property-typed control (card-face checklist rendering, table cell rendering, filter value inputs), and follow the codebase's existing "local `useState` open/close + `fixed inset-0 z-20` backdrop + `absolute z-30` panel" popover convention (seen in `PersonField`, `AddColumnControl`, `AddPropertyModal`, `SlashMenu`) for the Filter/Sort toolbar and view-settings picker — there is no shared `Popover`/`DropdownMenu` primitive in `@vectra/ui` to import instead.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filter/sort evaluation | Frontend Server (client component) | — | Runs entirely in `BoardBlock`/new table view's render logic over already-fetched `collection_records`; no new backend endpoint — records API already returns the full unfiltered list per collection, same pattern Phase 24 established |
| Filter/sort config persistence | API / Backend | Database | `PATCH /views/:id` with `config: {...filters, sorts}` — endpoint exists, opaque JSONB pass-through, no schema change |
| Card-face property picker UI | Browser / Client | — | Pure client UI (checklist popover), writes `cardProperties[]` via the same `PATCH /views/:id` |
| Card-face rendering | Browser / Client | — | `BoardCard` renders `cardProperties[]` via `PropertyField` (already exists, Phase 23) |
| Column aggregation computation | Browser / Client | — | Client-side reduce over already-loaded records per column; no backend aggregation endpoint needed at this scale |
| View switching (board↔table) | Browser / Client | API / Backend | Client swaps which `viewId` the `collection-view` block points at; may call `POST /collections/:id/views` (create) or `PATCH /views/:id` (retype) — both exist |
| Table view rendering | Browser / Client | — | New render path reusing `PropertyField` per cell, same collection/records data Board already fetches |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 + Next.js 14.0.3 | existing | Client components (`'use client'`) for all new UI | Matches every other file touched this phase |
| @tanstack/react-query 5.99.2 | existing | `useView`, new `useUpdateView` mutation, cache updates | Already the sole server-state layer in `useRecords.ts` |
| Zod 4.3.6 | existing | Backend `UpdateViewSchema`/`CreateViewSchema` (already opaque-config, no change needed) | Existing convention, `config: z.record(...)` already permissive |
| lucide-react 0.294.0 | existing | Icons for filter/sort/settings/view-switch buttons (`Filter`, `ArrowUpDown`, `Settings`/`MoreHorizontal`, `Table`, `Kanban` already used elsewhere) | Already the icon library across `BoardColumn.tsx`, `KanbanBlock`, sidebar |

**Version verification:** No new packages required this phase — confirmed by inspecting `apps/workspaces/package.json` (dnd-kit, react-query, lucide-react, Next 14 already present) and `apps/api/package.json` (Zod already present). `npm view` verification was skipped because zero new dependencies are being introduced.

### Supporting
None — this phase is pure application code on top of the existing stack. No new supporting libraries identified or needed (e.g., no date-range picker library needed since `date` filter operators can use native `<input type="date">`, matching `PropertyField`'s existing `date` case).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side filter/sort/aggregate over already-fetched records | Server-side `GET /collections/:id/records?filter=...` query params | Server-side would scale better for large collections, but requires new backend query-building code, contradicts "no new migration/endpoint" framing in CONTEXT.md, and Phase 24's board already fetches the full unfiltered record set client-side — staying consistent with that established pattern is lower risk for this phase's scope |
| Hand-rolled popover convention (`fixed inset-0` backdrop + local state) | A new shared `Popover`/`DropdownMenu` primitive in `@vectra/ui` | No such primitive exists today (confirmed: `packages/ui/src` only has `AppSwitcher`, `Navbar`, `AppProviders`) — introducing one is a larger cross-cutting change than this phase needs; every reviewed popover in this codebase (`PersonField`, `AddColumnControl`, `AddPropertyModal`, `SlashMenu`) hand-rolls the same convention, so continuing it is the "reuse over rebuild" choice, not a shortcut |

**Installation:** None — no new packages.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new external packages. `Package Legitimacy Gate` protocol skipped per its own scope (no packages to install).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ BoardBlock.tsx (collection-view block, registry-driven)         │
│                                                                   │
│  view.type === 'board'          view.type === 'table'           │
│         │                              │                         │
│         ▼                              ▼                         │
│  ┌──────────────┐              ┌──────────────────┐             │
│  │ applyFilters  │◄─recordsQuery.data (all records, unfiltered) │
│  │ applySorts    │              │  CollectionTableView (new)     │
│  └──────┬───────┘              │  - rows = filtered+sorted recs  │
│         ▼                       │  - cols = collection.schema    │
│  groupRecordsByColumn           │  - cell = <PropertyField/>      │
│  (existing, unchanged)          └──────────────────┘             │
│         ▼                                                         │
│  BoardColumn (per column)                                        │
│    ├─ aggregation footer (new: count / sum / avg over records)   │
│    └─ BoardCard (per record)                                     │
│         ├─ title (existing)                                      │
│         └─ cardProperties[].map(propId => <PropertyField .../>)  │  (new)
│                                                                     │
│  Toolbar (new, block chrome, above columns/table):                │
│    [Filter ▾] [Sort ▾] [••• view settings] [Board|Table switch]  │
│         │         │              │                    │           │
│         ▼         ▼              ▼                    ▼           │
│    popover:    popover:     popover: checklist    creates/patches │
│    condition   condition    of collection.schema   collection_views│
│    rows        rows         properties → toggles   row via        │
│    (AND-only)  (multi)      view.config            recordsApi     │
│         │         │         .cardProperties[]            │        │
│         └────┬────┘                │                     │        │
│              ▼                     ▼                     ▼        │
│      useUpdateView(view.id).mutate({ config: {...} })  (new hook) │
│              │                                                    │
│              ▼                                                    │
│      PATCH /api/v1/records/views/:id  (existing endpoint)        │
│              │                                                    │
│              ▼                                                    │
│      collection_views.config JSONB (existing column, no migration)│
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/workspaces/src/
├── lib/
│   ├── api/records.api.ts          # ADD: updateView(id, data) function + UpdateViewInput type
│   ├── hooks/useRecords.ts         # ADD: useUpdateView(id) mutation hook (mirrors useCreateView)
│   └── projectPage/
│       └── viewFilters.ts          # NEW: pure functions — applyFilters(records, filters, schema), applySorts(records, sorts, schema), aggregateColumn(records, agg, propId)
├── components/
│   ├── records/
│   │   └── PropertyField.tsx       # REUSE unchanged — cell renderer for table + card-face
│   └── projectPage/
│       ├── BoardBlock.tsx          # EXTEND: branch on view.type, wire filters/sorts through groupRecordsByColumn, render toolbar
│       ├── board/
│       │   ├── BoardCard.tsx       # EXTEND: render cardProperties[] below title via PropertyField
│       │   ├── BoardColumn.tsx     # EXTEND: aggregation footer
│       │   ├── FilterSortToolbar.tsx   # NEW: Filter/Sort buttons + popovers (D-01, D-02)
│       │   ├── ViewSettingsMenu.tsx    # NEW: "•••" card-face property checklist (D-03)
│       │   ├── ColumnAggregation.tsx   # NEW: per-column footer, count always + sum/avg picker (D-04)
│       │   └── ViewSwitcher.tsx        # NEW: board/table toggle on block chrome (D-05)
│       └── collectionTable/
│           └── CollectionTableView.tsx # NEW: type:'table' render path, reuses PropertyField per cell
```

### Pattern 1: Hand-rolled popover (existing convention — reuse, don't invent)
**What:** Local `useState` for open/close, a full-screen `fixed inset-0 z-20` transparent backdrop `<div>` with `onClick` to close, and an `absolute ... z-30` panel positioned relative to the trigger.
**When to use:** Filter builder popover, Sort builder popover, card-face property checklist, view-switcher dropdown — every new popover this phase introduces.
**Example:**
```typescript
// Source: apps/workspaces/src/components/records/PropertyField.tsx (PersonField), lines 111-146
{editing && (
  <>
    <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
    <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
      {/* content */}
    </div>
  </>
)}
```

### Pattern 2: Schema-driven property rendering (Phase 23, reuse for cells/checklist/filter controls)
**What:** `<PropertyField property={CollectionPropertyDef} value={unknown} onCommit={(v) => void} />` — a switch on `property.type` (12 branches: text, number, date, select, multi-select, checkbox, person, url, email, phone, files, relation) rendering the correct control.
**When to use:**
- Table view cells: pass `property={collection.schema[i]}`, `value={record.props[property.id]}`, `onCommit` wired to `useUpdateAnyRecord`.
- Card-face property picker checklist: **do not reuse `PropertyField` itself** here — the picker is a list of `collection.schema` entries with a toggle-on/off checkbox per property (closer to `MultiSelectChips`'s pattern than `PropertyField`), per CONTEXT.md D-03 ("no existing analog for a property-picker checklist scoped to a view").
- Filter operator/value controls: reuse `PropertyField`'s per-type value input for the *value* half of a filter condition row, but the *operator* dropdown (equals/contains/is/is not/>/</between) is new — no existing analog.
**Example:**
```typescript
// Source: apps/workspaces/src/components/records/PropertyPanel.tsx, lines 46-55
<PropertyField
  property={property}
  value={record.props[property.id]}
  onCommit={(v) => onUpdateRecord.mutate({ props: { ...record.props, [property.id]: v } })}
/>
```

### Pattern 3: React Query mutation hook for view config writes
**What:** A `useUpdateView(id)` hook mirroring the existing `useUpdateCollectionSchema`/`useCreateView` pattern — `useMutation` wrapping `recordsApi.updateView(id, data)`, `onSuccess` writes into the `qk.view(id)` cache (and optionally `qk.views(collectionId)` if the block also lists views for the switcher).
**When to use:** Every filter/sort/cardProperties/type change this phase makes.
**Example:**
```typescript
// Source: apps/workspaces/src/lib/hooks/useRecords.ts, lines 37-43 (useUpdateCollectionSchema, the pattern to clone)
export function useUpdateCollectionSchema(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schema: CollectionPropertyDef[]) => recordsApi.updateCollection(id, { schema }),
    onSuccess: (collection) => qc.setQueryData(qk.collection(id), collection),
  });
}
// NEW, to add — same shape:
export function useUpdateView(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; type?: string; config?: Record<string, unknown> }) =>
      recordsApi.updateView(id, data),
    onSuccess: (view) => qc.setQueryData(qk.view(id), view),
  });
}
```

### Anti-Patterns to Avoid
- **Do not add a `GET /collections/:id/records?filters=...` query-param endpoint.** Filtering/sorting is explicitly a view-layer (client) concern per the spec's "views are lenses over one dataset" framing, and Phase 24 already established the full-fetch-then-render-client-side pattern (`useRecords(collectionId)` fetches everything). Introducing server-side filtering here duplicates logic and creates two sources of truth for "what does this view show."
- **Do not name the new table-view component `TableBlock` or `TableView`.** Both names are already taken by the unrelated static inline-table page block (`apps/workspaces/src/components/projectPage/TableBlock.tsx`, exporting `TableView`/`TableEditor`). Name the new component `CollectionTableView` (or similar) to avoid an import collision and, more importantly, avoid confusing the two concepts the spec explicitly distinguishes (§5.7 "table (simple)" vs. §3.2 collection-view table).
- **Do not re-materialize records when switching view type.** D-05 is explicit: switching changes which `collection_views` row (`viewId`) the block points at, via either `PATCH /views/:id` (retype in place) or `POST /collections/:id/views` (create a second view row) — never copy/duplicate `collection_records`.
- **Do not build a second property-rendering convention for table cells.** Reuse `PropertyField` as-is; it already handles all 12 types and is proven in `PropertyPanel`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-property-type value editor (table cells, card-face checklist scope, filter value input) | A new switch-on-type component | `PropertyField` (`apps/workspaces/src/components/records/PropertyField.tsx`) | Already exists, already handles all 12 property types, already used in the analogous `PropertyPanel` context |
| View config persistence | A new "views" mutation abstraction | Existing `PATCH /views/:id` (`records.routes.ts` → `records.controller.ts:updateView` → `records.service.ts:updateView` → `records.repository.ts:updateView`) via a new thin `useUpdateView` hook cloned from `useUpdateCollectionSchema`/`useCreateView` | Endpoint, Zod schema, and repo dynamic-SET-builder all already exist and already accept `type`/`config` partial patches |
| Popover/dropdown positioning | A new floating-UI/positioning library | The existing `fixed inset-0 z-20` backdrop + `absolute z-30` panel convention | Zero new dependencies; matches four existing call sites exactly; introducing e.g. `@floating-ui/react` for this phase would be scope creep with no precedent in the codebase |

**Key insight:** Nothing in this phase requires new backend surface area or new dependencies — it is exclusively new client components/hooks composing four already-proven patterns (schema-driven property rendering, hand-rolled popovers, React Query mutation-hook cloning, and client-side derived-state computation over an already-fetched array).

## Common Pitfalls

### Pitfall 1: Forgetting `useUpdateView` doesn't exist yet
**What goes wrong:** A plan/task assumes `recordsApi.updateView` and `useUpdateView` already exist (since `useView`/`getView` do) and skips creating them, causing a compile error partway through.
**Why it happens:** `records.api.ts` has `getView` but no `updateView`; `useRecords.ts` has `useView`/`useCreateView` but no `useUpdateView`. Easy to assume symmetry that isn't there yet.
**How to avoid:** First task in the plan should explicitly add `recordsApi.updateView(id, data)` (mirroring `updateCollection`'s shape) and `useUpdateView(id)` (mirroring `useUpdateCollectionSchema`) before any UI wires into it.
**Warning signs:** TypeScript error "Property 'updateView' does not exist on type..." during any FilterSortToolbar/ViewSettingsMenu/ViewSwitcher implementation task.

### Pitfall 2: Naming collision with the unrelated `TableBlock`/`TableView`
**What goes wrong:** A new table-view component is named `TableView` or imported alongside the existing `TableView` from `projectPage/TableBlock.tsx`, causing either a silent shadow-import bug or genuine confusion about which "table" is being edited.
**Why it happens:** Both concepts are legitimately called "table" in the spec (§5.7 simple inline table vs. §3.2 collection-view table), and both live under `components/projectPage/`.
**How to avoid:** Name the new component distinctly (`CollectionTableView`, `RecordsTableView`, etc.) and place it in its own subfolder (e.g. `board/` sibling `collectionTable/`) rather than `projectPage/` root.
**Warning signs:** Two exports named `TableView` in the same barrel/registry file; grep for `TableView` before starting to confirm the existing one.

### Pitfall 3: Aggregation footer breaking on non-number properties
**What goes wrong:** Sum/avg aggregation is wired to whichever property is currently selected without checking `property.type === 'number'`, producing `NaN` or string concatenation when a non-number property is picked.
**Why it happens:** The `cardProperties`/aggregation-target picker UI is new and needs its own type filter — `PropertyField`'s number branch already assumes numeric values are validated on write (backend `validatePropValue` enforces `typeof value === 'number'` for `number` type), but the aggregation *picker* must independently filter `collection.schema` to `type === 'number'` before offering sum/avg as options.
**How to avoid:** In the aggregation-type/property picker, filter `collection.schema.filter(p => p.type === 'number')` for the sum/avg property dropdown; count has no such restriction (works on any property, or just row count).
**Warning signs:** Aggregation footer shows "Sum: NaN" or string-concatenated numbers.

### Pitfall 4: Filter/sort state lost between board and table view
**What goes wrong:** Filters/sorts are stored per-view (`view.config.filters`/`.sorts`), which is correct per D-05 (switching view type points the block at a *different* `collection_views` row) — but if a plan assumes filters should carry over automatically when creating the second (table) view row, it will silently not, since each view has independent config.
**Why it happens:** Natural UX expectation ("I filtered the board, now I switch to table, shouldn't it stay filtered?") conflicts with the data model (each view row has its own `config`).
**How to avoid:** This is expected/correct behavior per the spec and CONTEXT.md — document it as intentional (each view is an independently-configured lens), not a bug. If the planner wants filter/sort carry-over on first table-view creation, that's a deliberate UX choice to make explicit in the plan (e.g., seed the new view's `config.filters`/`sorts` from the board view's config at creation time), not a default assumption.
**Warning signs:** None — this is a design decision point, not a defect; flagging it here so the planner makes the choice consciously.

### Pitfall 5: `collection_views` row has no `updated_at` column
**What goes wrong:** Code that assumes `view.updated_at` exists (the frontend `CollectionView` TypeScript interface in `records.api.ts` declares `updated_at: string`) will get `undefined` at runtime, since migration `025_records_views.sql`'s `collection_views` table has no `updated_at` column (only `created_at`).
**Why it happens:** Pre-existing type/schema mismatch inherited from Phase 22, not introduced by this phase — the frontend interface is simply wrong/aspirational.
**How to avoid:** Don't rely on `view.updated_at` for any new UI (e.g., a "last edited" indicator on the view switcher). If genuinely needed, that's a migration + repository change outside this phase's stated no-migration-expected scope — flag to the user rather than silently adding a column.
**Warning signs:** `view.updated_at` renders as `undefined`/`Invalid Date` in the UI.

## Code Examples

### Filter evaluation (new, to be written — pattern, not existing code)
```typescript
// Suggested shape for apps/workspaces/src/lib/projectPage/viewFilters.ts
// Filters are AND-only per CONTEXT.md D-02 — no OR/mixed logic.
interface FilterCondition { propId: string; operator: string; value: unknown }
interface SortCondition { propId: string; direction: 'asc' | 'desc' }

function applyFilters(
  records: CollectionRecord[],
  filters: FilterCondition[],
  schema: CollectionPropertyDef[],
): CollectionRecord[] {
  if (!filters.length) return records;
  return records.filter((r) => filters.every((f) => evaluateCondition(r, f, schema)));
}
```

### Existing endpoint this phase writes to (confirmed exact shape)
```typescript
// Source: apps/api/src/domains/records/dto/update-view.dto.ts (existing, unmodified)
export const UpdateViewSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  type: z.enum(['board', 'table', 'calendar', 'gallery', 'list', 'timeline']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
// PATCH /api/v1/records/views/:id  → 200 { view: CollectionViewRow }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Board reads `view.config.groupBy` only | Board must read `groupBy` + `filters` + `sorts` + `cardProperties` | This phase | `BoardBlock.tsx`'s `columns = groupRecordsByColumn(records, ...)` call must be preceded by `applyFilters`/`applySorts` |
| Card renders only `record.props[titlePropId]` | Card renders title + `cardProperties[].map(...)` | This phase | `BoardCard.tsx` needs a new props list below the title `<span>` |
| `collection-view` block always renders `BoardBlock` regardless of `view.type` | Registry/`BoardBlock` must branch on `view.type` to pick Board vs. Table render path | This phase | `apps/workspaces/src/lib/projectPage/registry.tsx`'s `'collection-view'` entry currently hardcodes `<BoardBlock .../>` for both view and edit contexts — either `BoardBlock` internally branches (simpler, one entry point) or the registry gains a second branch. Internal branching inside a renamed/kept `BoardBlock` (or a new umbrella `CollectionViewBlock` component) is simpler since the registry `entry()` helper takes a single component per block kind. |

**Deprecated/outdated:** None — this is additive work on a freshly-shipped (Phase 24, same day) feature; nothing to deprecate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `collection-view` registry entry point (`registry.tsx`) will need to branch on `view.type` inside `BoardBlock` (or a renamed wrapper) rather than the registry itself branching, since `entry()` takes one component per block kind — not independently verified by reading `entry()`'s full implementation | Architecture Patterns / State of the Art | Low — if `entry()` actually supports type-conditional rendering already, the planner just has one fewer file to touch; doesn't change the overall approach |
| A2 | No live PostgreSQL was available to confirm `collection_views` migration 025 has actually been applied to a running database (only static SQL file inspection was possible, consistent with prior phases' noted limitation) | Data model gaps (Standard Stack / migration note) | Low — migration file is idempotent (`CREATE TABLE IF NOT EXISTS`) and was already used successfully by Phase 22-24's shipped features per STATE.md, so this is a very safe assumption, just noting it wasn't re-verified against a live DB in this research pass |

**If this table is empty:** N/A — two low-risk assumptions logged above; neither blocks planning.

## Open Questions (RESOLVED)

1. **Should switching view type reuse an existing same-type view or always create a new one?** (RESOLVED — see Plan 25-04)
   - What we know: D-05 permits either "update the current row's `type`" or "create a new view row for the target type" — both are valid per CONTEXT.md's explicit wording ("or creates a new view row for the target type against the same `collection_id`").
   - What's unclear: Whether the block should remember/reuse a previously-created table view when switching back to board then back to table again (avoiding creating a third+ view row each toggle), or whether a fresh view is fine each time.
   - Recommendation: Create-once-then-remember is the better UX (avoids orphaned view rows accumulating) — on first switch to table, call `POST /collections/:id/views` with `type: 'table'` and store that `viewId`; on subsequent switches back and forth, if the block/UI can track "the board viewId" and "the table viewId" for this collection (e.g. via `listViews(collectionId)` filtered by `type`), reuse rather than recreate. Left as a planner decision since it affects whether `ViewSwitcher` needs a `useViews(collectionId)` lookup or just two persisted `viewId`s on the block config itself — CONTEXT.md's `CollectionViewBlock` shape only carries one `viewId`, so this likely means calling `listViews` to find-or-create the sibling-type view at switch time.
   - RESOLVED: Plan 25-04's `ViewSwitcher` implements create-once-then-remember via a `useViews(collectionId)` lookup, matching the recommendation exactly.

2. **Exact aggregation footer placement/interaction (D-04 explicitly Claude's discretion)** (RESOLVED — see Plan 25-03)
   - What we know: Count always available; sum/avg must work for a chosen number property; no other aggregation types required.
   - What's unclear: Whether the aggregation picker is per-column (each column independently configurable) or per-view (one aggregation setting applied uniformly across all columns) — the spec's Notion-parity framing (§6 "Column aggregations") implies per-column, matching real Notion behavior.
   - Recommendation: Per-column footer with its own "count / sum / avg + property" picker (stored as e.g. `view.config.columnAggregations: { [columnAggType]: string, [columnAggProp]: string }` or similar, view-wide since Notion actually applies one aggregation setting across all columns of a board, not per-individual-column — verify against Notion's real behavior if uncertain, but the simpler view-wide single-aggregation-setting is lower complexity and still satisfies the hard requirement "count always available, sum/avg for a chosen property" literally).
   - RESOLVED: Plan 25-03's `ViewSettingsMenu`/`ColumnAggregation` implement the view-wide single-aggregation-setting recommendation.

## Environment Availability

Skipped — no external tools, services, runtimes, or CLIs beyond what's already running in this monorepo (Node/npm/PostgreSQL, all already in use by Phases 21-24). This phase adds no new environment dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`), backend only |
| Config file | none — invoked directly via `apps/api/package.json`'s `"test": "node --require ts-node/register --test src/**/*.test.ts"` |
| Quick run command | `cd apps/api && npm test -- src/domains/records/records.service.test.ts` |
| Full suite command | `cd apps/api && npm test` |

**Frontend note:** `apps/workspaces` has **no test framework configured** (confirmed: `package.json` scripts are only `dev`/`build`/`start`/`lint`; zero `*.test.ts*` files exist anywhere under `apps/workspaces/src`). This phase is overwhelmingly frontend work, so most new logic (filter/sort evaluation, aggregation math, popover UI) will have **no automated test coverage** unless the planner explicitly stands up a frontend test framework in Wave 0 — flagged as a gap below rather than silently skipped.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEWX-01 | Filter/sort evaluation logic (`applyFilters`/`applySorts` pure functions) | unit | none available (no FE test framework) | ❌ Wave 0 (or manual-only) |
| VIEWX-01 | `PATCH /views/:id` persists `filters`/`sorts` config | integration (backend, already covered) | `npm test -- src/domains/records/records.service.test.ts` | ✅ (existing `updateView` coverage — extend if the planner adds new service-level assertions) |
| VIEWX-02 | Card-face property picker persists `cardProperties[]`, `BoardCard` renders them | unit/manual | none available (no FE test framework) | ❌ Wave 0 (or manual-only) |
| VIEWX-03 | Column aggregation math (count/sum/avg) | unit | none available (no FE test framework) | ❌ Wave 0 (or manual-only, high-value candidate for a pure-function unit test given it's arithmetic) |
| VIEWX-04 | View switching creates/points at correct `viewId` without duplicating `collection_records` | integration/manual | Backend: existing `createView`/`updateView` service tests cover the API surface; the "no duplicate records" guarantee is a frontend behavioral guarantee (no new record-creation call path is introduced) | ❌ Wave 0 for FE, ✅ backend API surface already tested |

### Sampling Rate
- **Per task commit:** `cd apps/api && npm test -- src/domains/records/records.service.test.ts` (only if a task touches backend view logic — most tasks this phase are frontend-only and have no automated quick-run)
- **Per wave merge:** `cd apps/api && npm test` (full backend suite; frontend has nothing to run)
- **Phase gate:** Full backend suite green + manual/live smoke test of filter/sort/card-face/aggregation/view-switch UI (per the pattern already established in Phase 24's SUMMARY files, which repeatedly note "not runnable in this sandboxed executor environment — recommend a live smoke test")

### Wave 0 Gaps
- [ ] No frontend test framework exists in `apps/workspaces` — the pure-logic pieces of this phase (`applyFilters`, `applySorts`, aggregation math in `viewFilters.ts`) are the highest-value candidates for unit tests since they're framework-free pure functions, but there is nowhere to run them today. **Recommendation to planner:** either (a) accept manual-only verification for this phase, consistent with Phase 21-24's precedent of "not runnable in this sandboxed executor environment," or (b) stand up a minimal test runner (e.g. `node --test` also works for plain `.ts` pure-function modules via the same `ts-node/register` pattern already used in `apps/api`, without needing a full React Testing Library setup) scoped just to `viewFilters.ts`'s pure functions. Given the codebase precedent of deferring FE verification to manual/live smoke tests, (a) is more consistent with existing project conventions unless the user requests otherwise.
- [ ] `apps/api/src/domains/records/records.service.test.ts` — no new backend endpoints are added this phase, so no new backend test files are strictly required, but if the planner adds any backend-side aggregation/filter validation (not currently planned — this phase is client-side per the Architectural Responsibility Map), corresponding service test cases would be needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unchanged — existing `authenticateToken` middleware already gates all `records.routes.ts` endpoints this phase uses (no new routes added) |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Existing `requireCompany`/`company_id`-scoped queries in `records.repository.ts` already enforce tenant isolation on `updateView`/`createView`/`findView` — this phase adds no new data-access paths, only new UI over existing scoped endpoints |
| V5 Input Validation | yes | Existing `UpdateViewSchema`/`CreateViewSchema` Zod validation already covers all writes this phase performs (`config` is opaque `z.record(...)`, `type` is a closed enum) — no new validation needed since no new endpoint is introduced |
| V6 Cryptography | no | Not applicable — no secrets/crypto involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant view access (fetching/patching another company's `collection_views` row by guessing/enumerating a UUID) | Tampering / Information Disclosure | Already mitigated — `records.repository.ts`'s `findView`/`updateView` both filter `WHERE id = $1 AND company_id = $2`; this phase's new `useUpdateView` hook calls the same existing `PATCH /views/:id` endpoint, inheriting this protection automatically. No new work needed, but worth confirming the planner doesn't accidentally introduce a client-only "is this view mine" check as the sole guard (server-side `company_id` filter is the real control) |
| Filter/sort config XSS via unsanitized property values rendered in the UI | Tampering | `filters[]`/`sorts[]` values are rendered as form inputs (`PropertyField`-style controls), not `dangerouslySetInnerHTML` — no injection vector introduced as long as new filter-condition-row UI follows the same input-based rendering convention as `PropertyField`, not raw HTML interpolation |

## Sources

### Primary (HIGH confidence)
- `docs/specs/core/workspace-blocks.md` §3.1-3.3, §6 — canonical spec for property types, `CollectionViewBlock`, `collection_views.config` shape, board interactions checklist (read in full)
- `apps/api/src/domains/records/records.routes.ts`, `records.controller.ts`, `records.service.ts`, `records.repository.ts`, `records.types.ts` — exact route/service/repository/type shapes (read in full)
- `apps/api/src/domains/records/dto/update-view.dto.ts`, `create-view.dto.ts` — exact Zod schemas confirming opaque `config` pass-through and `type` enum (read in full)
- `apps/api/src/domains/records/records.service.test.ts` line 110 — confirms `{ groupBy, filters: [], sorts: [], cardProperties: [] }` config shape (grepped and read)
- `database/migrations/025_records_views.sql` — confirms exact `collection_views` table columns, including the missing `updated_at` (Pitfall 5) (read in full)
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx`, `board/BoardCard.tsx`, `board/BoardColumn.tsx`, `board/AddColumnControl.tsx` — current board renderer and popover convention (read in full)
- `apps/workspaces/src/components/records/PropertyField.tsx`, `PropertyPanel.tsx` — Phase 23's schema-driven property rendering, confirmed reusable as-is (read in full)
- `apps/workspaces/src/lib/api/records.api.ts`, `lib/hooks/useRecords.ts` — confirmed `updateView`/`useUpdateView` do not yet exist (read in full)
- `apps/workspaces/src/components/projectPage/TableBlock.tsx` — confirmed unrelated existing "simple table" block, naming collision risk identified (read in full)
- `apps/workspaces/src/lib/projectPage/registry.tsx` (grep + surrounding lines) — confirmed `'collection-view'` entry hardcodes `BoardBlock` for both view/edit contexts
- `.planning/phases/24-board-view-legacy-kanban-migration/24-04-SUMMARY.md` — confirms Phase 24's exact shipped state and established patterns (read in full)
- `.planning/phases/25-view-ux-parity/25-CONTEXT.md` — locked decisions D-01 through D-05 (read in full)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement definitions and project history (read in full)

### Secondary (MEDIUM confidence)
None — all findings were verified directly against source files in this repository; no external/web sources were needed since this phase builds entirely on already-shipped, already-inspectable code.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all findings verified by reading actual `package.json`/source files
- Architecture: HIGH — every claim about existing component shapes, hooks, routes, and schemas was verified by direct file reads, not inferred
- Pitfalls: HIGH for Pitfalls 1, 2, 5 (directly observed gaps/mismatches in code); MEDIUM for Pitfalls 3, 4 (reasoned from data model + established patterns, not yet-implemented code to observe)

**Research date:** 2026-07-14
**Valid until:** Effectively unbounded for this milestone (internal-codebase research, not external library/API research) — re-verify only if Phase 24's deliverables change before Phase 25 executes, or if `.planning/phases/24-board-view-legacy-kanban-migration/` gains new commits after this research date.
