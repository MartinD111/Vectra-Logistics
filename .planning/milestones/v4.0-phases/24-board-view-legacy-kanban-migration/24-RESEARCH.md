# Phase 24: Board View & Legacy Kanban Migration - Research

**Researched:** 2026-07-14
**Domain:** React drag-and-drop (`@dnd-kit/sortable`), Notion-style board-over-database rendering, legacy-JSON-to-relational-data migration
**Confidence:** HIGH

## Summary

This phase turns the config-local `kanban` block into a real database view (`collection-view`, type `board`) over Phase 22's `data_collections`/`collection_records`/`collection_views` tables, and auto-migrates any existing `kanban` block to that shape on first edit. All backend pieces this phase needs already exist and are verified working: `PATCH /records/:id` accepts `props` and `sort_order` in the same call (BOARD-02's column-move + reorder is one request), `PATCH /collections/:id` updates the schema (BOARD-01's "+ Add column" = append a `select` option), `POST /collections/:id/records` creates cards, and `POST /collections/:id/views` creates the `board` view row with an opaque `config` JSON (`groupBy` etc., never individually validated server-side). No new backend endpoint, migration, or npm package is required — `@dnd-kit/sortable ^10.0.0` is already a `workspaces` dependency, just unused.

The frontend has two real gaps to fill. First, `apps/workspaces/src/lib/api/records.api.ts` and `apps/workspaces/src/lib/hooks/useRecords.ts` only cover single-collection/single-record reads — there is **no** `listRecords`, `listCollections`, `createCollection`, `listViews`, or `createView` API function/hook today. This phase must add them (mirroring the existing `recordsApi`/`useRecords.ts` shape exactly) before the board can even fetch its column data. Second, `@dnd-kit/sortable`'s `SortableContext`/`useSortable` pattern has zero usage anywhere in the codebase — the only DnD precedent (`apps/workspaces/src/app/(routes)/dispatch/page.tsx`) uses bare `@dnd-kit/core` (`useDraggable`/`useDroppable`), which handles cross-container drops fine but has no concept of within-list reordering. This phase needs both: cross-column moves (groupBy change) AND within-column reordering (`sort_order` change), which is exactly what `@dnd-kit/sortable`'s multi-container recipe solves — each column is its own `SortableContext`, cards are `useSortable` items, and a single `DndContext` at the board root handles both `onDragOver` (cross-column preview) and `onDragEnd` (commit).

**Primary recommendation:** Use `@dnd-kit/sortable`'s multi-container sortable pattern (one `SortableContext` per column, `useSortable` per card, single board-level `DndContext`) — not the bare `useDraggable`/`useDroppable` pattern from `dispatch/page.tsx`, since that pattern has no reordering support and would require hand-rolling insertion-index logic that `@dnd-kit/sortable` already provides. Wire migration as a pure client-side transform run once, on the first `onChange` call the `KanbanBoardView`'s editor path receives, gated by a `migratingRef` to prevent double-fire, calling `createCollection` → `updateCollection` (add cards' text as record props isn't needed — schema is created with the collection) → `createView` → N×`createRecord`, then swapping the page block from `kind: 'kanban'` to `kind: 'collection-view'` in the same `onUpdate` call site.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board column derivation (live select options) | Browser/Client | API/Backend (schema source) | Columns are a pure function of `collection.schema[groupByPropId].options` + `records` fetched from API; no new backend logic needed, just correct client-side grouping |
| Drag-and-drop interaction (card move, reorder) | Browser/Client | — | `@dnd-kit` is a client-only library; drag state, drop-zone detection, and optimistic reordering all happen in the browser |
| Card move persistence (`groupBy` value + `sort_order`) | API/Backend | Browser/Client (optimistic) | `PATCH /records/:id` is the single source of truth; client optimistically updates React Query cache then reconciles on response/error |
| Column add/rename (schema mutation) | API/Backend | Browser/Client | `PATCH /collections/:id` owns the schema; client sends the full next `schema` array (same two-sequential-PATCH convention Phase 23 established) |
| Inline card creation | API/Backend | Browser/Client | `POST /collections/:id/records` creates the row; client shows an optimistic/inline-editable card face immediately after creation resolves |
| Legacy kanban → collection-view migration | Browser/Client (orchestration) | API/Backend (writes) | The transform (reading `KanbanBlock` JSON, deciding schema shape) is pure client logic; every persisted artifact (collection, view, records) is created via existing API calls — no new backend migration endpoint |
| Page block registry entry (`collection-view` kind) | Browser/Client | — | Pure frontend registry/type-system change (`blocks.ts` + `registry.tsx`), matches every other block kind |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | `^6.3.1` [VERIFIED: apps/workspaces/package.json] | `DndContext`, sensors, collision detection | Already used in `dispatch/page.tsx`; board `DndContext` wraps the whole board exactly the same way |
| `@dnd-kit/sortable` | `^10.0.0` [VERIFIED: apps/workspaces/package.json] | `SortableContext`, `useSortable`, `arrayMove` | Purpose-built for list reordering; zero current usage but installed and the correct tool for BOARD-02's dual requirement (cross-column move + within-column reorder) |
| `@dnd-kit/utilities` | `^3.2.2` [VERIFIED: apps/workspaces/package.json] | `CSS.Transform`/`CSS.Translate` string helpers | Already used in `dispatch/page.tsx` for drag transform styling; same usage for sortable cards |
| `@dnd-kit/modifiers` | `^9.0.0` [VERIFIED: apps/workspaces/package.json] | `restrictToWindowEdges` (optional) | Already used for the dispatch `DragOverlay`; reuse if board drag overlay needs the same edge clamp |
| `@tanstack/react-query` | `^5.99.2` [ASSUMED — matches CLAUDE.md tech stack doc] | Server state for collection/records/views | Established convention (`useRecords.ts`, all Phase 23 hooks) |

No new packages are required for this phase — all four `@dnd-kit/*` packages are already declared in `apps/workspaces/package.json`.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^0.294.0` | Icons (`Plus`, `X`, `GripVertical` for drag handles) | Column header controls, add-card button, migration toast icon |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit/sortable` multi-container pattern | Hand-rolled `useDraggable`/`useDroppable` (dispatch/page.tsx style) + manual index math | Rejected: dispatch's pattern has no reordering primitive; would require reimplementing `arrayMove`/insertion-index detection that `@dnd-kit/sortable` already ships, for no benefit since the library is already a dependency |
| `@dnd-kit` entirely | `react-beautiful-dnd`, `react-dnd`, native HTML5 DnD | Rejected: CONTEXT.md D-locked via STATE.md roadmap decision ("Phase 24 explicitly reuses `@dnd-kit`... rather than adding a new library") — not open for reconsideration |

## Package Legitimacy Audit

No new external packages are installed by this phase. All `@dnd-kit/*` packages are pre-existing dependencies of `apps/workspaces/package.json`, already vetted and in production use (`@dnd-kit/core` in `dispatch/page.tsx`). The Package Legitimacy Gate is not applicable — skip slopcheck/registry verification for this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages installed)
**Packages flagged as suspicious [SUS]:** none (no packages installed)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Page canvas (LivePageCanvas / registry.tsx)                        │
│                                                                       │
│   block.kind === 'kanban'         block.kind === 'collection-view'  │
│         │                                    │                       │
│   KanbanBoardView (legacy,             BoardView (new)               │
│   read/edit JSON-in-block)             ┌──────────────────────────┐ │
│         │                              │ useCollection(id)        │ │
│   onChange(next) fires                 │ useRecords(collectionId) │ │
│         │                              │ useView(viewId)          │ │
│         ▼                              └───────────┬──────────────┘ │
│   migrateKanbanToCollectionView()                   │                │
│   (client orchestration, first edit only)           ▼                │
│         │                              Group records by              │
│         │                              props[view.config.groupBy]    │
│         ▼                                           │                │
│   1. createCollection({schema:                      ▼                │
│      [text title, select Status]})     ┌──────────────────────────┐ │
│   2. createView({type:'board',         │ DndContext (board root)  │ │
│      config:{groupBy: statusPropId}})  │  SortableContext per col │ │
│   3. createRecord × N (per card)       │   useSortable per card   │ │
│   4. swap block.kind → 'collection-    │  onDragOver: preview     │ │
│      view', pointing at new IDs        │  onDragEnd: commit       │ │
│   5. show one-time toast                └───────────┬──────────────┘ │
│                                                       │                │
└───────────────────────────────────────────────────────┼────────────────┘
                                                          ▼
                              PATCH /api/v1/records/:id { props, sort_order }
                              PATCH /api/v1/records/collections/:id { schema }
                              POST  /api/v1/records/collections/:id/records
                              POST  /api/v1/records/collections/:id/views
                                                          │
                                                          ▼
                              PostgreSQL: data_collections / collection_records
                                          / collection_views (migration 025)
```

### Recommended Project Structure
```
apps/workspaces/src/
├── lib/
│   ├── api/records.api.ts          # ADD: listRecords, listCollections, createCollection, listViews, createView
│   ├── hooks/useRecords.ts         # ADD: useRecords(collectionId), useCollections(), useCreateCollection, useViews, useCreateView
│   └── projectPage/
│       ├── blocks.ts               # ADD: 'collection-view' to PageBlockKind, CollectionViewBlock interface, PAGE_BLOCK_REGISTRY entry
│       └── kanbanMigration.ts       # NEW: pure transform fn (KanbanBlock -> {collection, view, records}) — testable in isolation
├── components/
│   └── projectPage/
│       ├── KanbanBlock.tsx          # UNCHANGED renderer for any block still kind:'kanban' pre-migration
│       └── BoardBlock.tsx           # NEW: BoardView — fetches collection/records/view, renders columns, wires DndContext
│       └── board/
│           ├── BoardColumn.tsx      # NEW: single column, SortableContext wrapper, +Add column / rename UI
│           ├── BoardCard.tsx        # NEW: useSortable card, click-to-open (window.open new tab), inline-edit-on-create
│           └── AddColumnControl.tsx # NEW: appends a select option via PATCH /collections/:id
└── registry.tsx                     # ADD: 'collection-view' entry() call, mirroring 'kanban''s pattern
```

### Pattern 1: Multi-container sortable board (drag between columns + reorder within column)

**What:** One `DndContext` at the board root, one `SortableContext` per column (`items` = that column's card IDs in `sort_order`), each card wrapped in `useSortable`. `onDragOver` detects cross-column hover and updates local optimistic state (which column a card visually belongs to); `onDragEnd` computes the final column + index and fires a single `PATCH /records/:id` with both `props` (groupBy value) and `sort_order`.

**When to use:** Any board/kanban-style view where cards move both between and within lists — this is the canonical `@dnd-kit/sortable` "Multiple Containers" example shape.

**Example:**
```typescript
// Source: dnd-kit official docs pattern (Sortable > Multiple Containers), adapted
// to this codebase's existing DndContext/sensors setup from dispatch/page.tsx
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Board-level state: columns keyed by select-option id, each holding an
// ordered array of record ids. Derived from `records` + `view.config.groupBy`
// on load, then mutated optimistically during drag.
function BoardView({ collection, records, groupByPropId }: BoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const updateRecord = useUpdateRecord(); // existing hook, PATCH /records/:id

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeRecordId = String(active.id);
    const targetColumnId = String(over.data.current?.columnId ?? over.id);
    const targetIndex = over.data.current?.sortIndex ?? 0;

    updateRecord.mutate({
      id: activeRecordId,
      props: { [groupByPropId]: targetColumnId },
      sort_order: targetIndex,
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {columns.map((col) => (
          <SortableContext key={col.id} items={col.cardIds} strategy={verticalListSortingStrategy}>
            <BoardColumn column={col} />
          </SortableContext>
        ))}
      </div>
    </DndContext>
  );
}

function BoardCard({ record }: { record: CollectionRecord }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: record.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="saas-card !p-2.5 cursor-grab active:cursor-grabbing touch-none"
    >
      {/* card title, opens on click via window.open(..., '_blank', 'noopener,noreferrer') */}
    </div>
  );
}
```

### Pattern 2: Legacy migration as a pure transform, triggered on first edit

**What:** A pure function `buildMigrationPlan(kanban: KanbanBlock): { collectionSchema, records, groupByOptionByColumnId }` that reads `KanbanBlock.columns[].title`/`cards[].text` and produces the exact payloads `createCollection`/`createRecord` expect — with zero API calls inside it, so it is unit-testable. The calling component (`registry.tsx`'s `'kanban'` editor entry, or a thin wrapper) intercepts the first `onUpdate` call, runs the plan through the mutations in sequence, then replaces the block.

**When to use:** Any "legacy JSON block auto-upgrades to database-backed block on first edit" migration — this is the general shape for BOARD-04.

**Example:**
```typescript
// Source: derived from KanbanBlock/KanbanColumn/KanbanCard types in
// apps/workspaces/src/lib/projectPage/blocks.ts (lines 227-244) + the
// existing AddPropertyModal two-sequential-request convention
// (schema before record) from Phase 23.
import { uid } from '@/lib/projectPage/blocks';
import type { KanbanBlock, CollectionViewBlock } from '@/lib/projectPage/blocks';

export function buildMigrationPlan(kanban: KanbanBlock) {
  const titlePropId = uid();
  const statusPropId = uid();
  const statusOptions = kanban.columns.map((col) => ({ id: col.id, label: col.title }));

  const schema = [
    { id: titlePropId, name: 'Title', type: 'text' as const },
    { id: statusPropId, name: 'Status', type: 'select' as const, options: statusOptions },
  ];

  // One record per KanbanCard, preserving column membership + intra-column order.
  const records = kanban.columns.flatMap((col, colIdx) =>
    col.cards.map((card, cardIdx) => ({
      props: { [titlePropId]: card.text, [statusPropId]: col.id },
      sort_order: cardIdx,
    })));

  return { titlePropId, statusPropId, schema, records };
}

// Orchestration (inside the migration-aware editor wrapper):
async function migrateOnFirstEdit(kanban: KanbanBlock, onSwap: (next: CollectionViewBlock) => void) {
  const plan = buildMigrationPlan(kanban);
  const { collection, view } = await recordsApi.createCollection({ name: kanban.title ?? 'Board', schema: plan.schema });
  // createCollectionWithDefaultView already returns a default 'table' view (D-03,
  // records.service.ts) — this phase needs a *board* view, so either PATCH that
  // default view's type/config, or explicitly createView() a second board view
  // and ignore/delete the auto-created table view. Confirm approach with planner —
  // see Open Questions.
  const boardView = await recordsApi.createView(collection.id, {
    name: 'Board', type: 'board', config: { groupBy: plan.statusPropId },
  });
  await Promise.all(plan.records.map((r) => recordsApi.createRecord(collection.id, r)));

  onSwap({
    id: kanban.id, kind: 'collection-view', span: kanban.span,
    collectionId: collection.id, viewId: boardView.id,
  });
}
```

### Anti-Patterns to Avoid
- **Migrating on page load/view instead of first edit:** D-01 explicitly requires migration to be lazy (first edit only), not eager — do not add a `useEffect` that migrates on mount, that would violate the "no user-visible flag day beyond the notice" decision and could migrate blocks a user never even opens.
- **Touching `drafts-kanban`:** `DraftsKanbanBlock`/`'drafts-kanban'` is a structurally distinct `PageBlockKind` (columns derived live from shipment data, no `columns`/`cards` fields at all) — do not add it to any migration matching logic; only `kind === 'kanban'` migrates.
- **Building a second orphan-reassignment path for column deletion:** D-06 explicitly blocks deleting a non-empty column rather than reassigning its cards — do not build "move to no-value" logic in this phase, that's out of scope.
- **Re-validating `groupBy`/view `config` shape server-side:** `CreateViewSchema`'s `config` is intentionally opaque (`z.record(z.string(), z.unknown())`) per REC-03 — don't add new backend validation for `groupBy`, that's a deliberate design choice already shipped in Phase 22.
- **Skipping the two-sequential-PATCH order for "+ Add column":** column add = schema PATCH (`PATCH /collections/:id`) must resolve before any card is moved into the new column, exactly like Phase 23's `AddPropertyModal` (schema PATCH → then record PATCH), or a record can end up referencing an option id the collection's schema never persisted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-column + within-column drag reordering | Manual index math on `useDraggable`/`useDroppable` (dispatch/page.tsx style) | `@dnd-kit/sortable`'s `SortableContext` + `useSortable` + `arrayMove` | Already solves insertion-index detection, animated reflow, and multi-container collision — reinventing it duplicates a library already installed |
| Board column grouping | Custom groupBy engine | Simple `Array.prototype.reduce` over `records` keyed by `props[groupByPropId]`, ordered by `collection.schema` option order then `record.sort_order` | REC-03's `groupBy` config is just a property id — grouping is a one-line reduce, no library needed |
| Debounced inline title editing on new cards | New debounce hook | Reuse Phase 23's `DebouncedTextField`/blur-commit pattern from `PropertyField.tsx` (800ms debounce + blur flush) | D-07 explicitly says follow the same blur/Enter-commit conventions Phase 23 established |
| Schema-driven property editors elsewhere on the card | New editors | `PropertyField.tsx`'s type-switch (already handles `select`, `text`, etc.) | Board cards showing more than the title (future VIEWX-02) should reuse this component, not fork it |

**Key insight:** This phase is almost entirely a client-side rendering/interaction problem sitting on an already-shipped, already-tested backend — the only genuinely new engineering is the `@dnd-kit/sortable` wiring (no prior art in this codebase) and the migration transform (well-scoped, pure-function-testable).

## Common Pitfalls

### Pitfall 1: `validatePropValue` rejects untyped/missing groupBy values
**What goes wrong:** `records.service.ts`'s `validateProps` throws 400 `Unknown property: X` if a `props` key isn't in the collection's schema, and `validatePropValue('select', ...)` requires `typeof value === 'string'`. If migration creates records referencing a `statusPropId` before the collection's schema PATCH/create has actually persisted that property id, or if a card is moved to a column whose option was just added via a still-in-flight schema PATCH, the record PATCH will 400.
**Why it happens:** Two round-trips (schema write, then record write) with no transaction — this is the same "Pitfall 2" class Phase 22/23 already documented (see `AddPropertyModal.tsx`'s comment referencing "RESEARCH.md Pitfall 1").
**How to avoid:** Always `await` the schema-defining call (createCollection or updateCollection) before any record create/update that references property ids from that schema — exactly the two-sequential-request pattern already established.
**Warning signs:** 400 errors with message `Unknown property: <uuid>` during migration or column-add flows.

### Pitfall 2: Migration double-fires on rapid edits
**What goes wrong:** If migration is triggered inside the `onChange`/`onUpdate` handler itself (fired on every keystroke-level edit to the legacy block, e.g. typing in `AddCardInput`), a fast typist could trigger `createCollection` twice before the first swap-to-`collection-view` re-render lands, creating duplicate collections.
**Why it happens:** `KanbanBoardView`'s `onChange` fires per-edit (add card, remove card, move card), not once per "session" — there's no existing debounce/guard at that call site.
**How to avoid:** Gate migration with a ref-based in-flight flag (`migratingRef.current`) checked and set synchronously before the first async call, and/or only wire the migration trigger at the point the block is first identified as `kind === 'kanban'` on the editor path (not inside `KanbanBoardView` itself) so it fires exactly once per block before any further edits are possible (block swaps to `collection-view` immediately, so all subsequent edits go through the new renderer).
**Warning signs:** Multiple `data_collections` rows with the same `name` and near-identical `created_at` timestamps for one legacy board.

### Pitfall 3: `createCollectionWithDefaultView` already creates a `table` view — board migration needs a `board` view, not the default
**What goes wrong:** `recordsService.createCollection` (per D-03 in `records.service.ts`) atomically creates the collection **and** a default `'table'` view in one repo call. Migration/new-board-creation flows need a `board` view specifically — naively using the auto-created view will point the new `collection-view` block at a `table`-typed view with no `groupBy` config, breaking BOARD-01.
**Why it happens:** The default-view behavior was designed for the generic "create a collection" case (Phase 22), not board-specific provisioning — this phase is the first caller that needs a non-table default.
**How to avoid:** After `createCollection`, either (a) call `createView` again explicitly for a `type: 'board'` view and treat the auto-created table view as an unused-but-harmless byproduct, or (b) `PATCH /views/:id` (via `updateView`) to convert the auto-created view's `type`/`config` to `board`. Confirm with the planner which approach — (a) is simpler (no need to guess the auto-created view's id reliably) but leaves an orphan `table` view row per board; (b) is cleaner but depends on the `createCollection` response actually returning the created view's `id` (it does — controller returns `{ collection, view }`).
**Warning signs:** Board renders with no columns (groupBy config missing) even though records exist.

### Pitfall 4: Column identity — select option `id` vs `label`
**What goes wrong:** `PropertyField.tsx`'s `select` case stores/reads the option's `id` (not `label`) as the record's prop value (`<option value={o.id}>{o.label}</option>`). If the board's grouping logic or the migration transform accidentally groups/matches by `label` instead of `id`, renaming a column (D-05, "column headers are renamable inline") would silently orphan every card in that column (their stored value no longer matches any option).
**Why it happens:** Both `id` and `label` are visually similar strings during migration (kanban column `id` is a random `uid()`, `title` is user text) — easy to swap which one becomes the option's `id` vs the stored record value.
**How to avoid:** Migration must set `statusOptions[i].id = kanban.columns[i].id` (reuse the existing kanban column id as the new select option id) and each migrated record's status prop value to that same `col.id` — never `col.title`. This also means renaming a column later is free (label changes, id/grouping stays stable), matching D-05's requirement.
**Warning signs:** Cards vanish from the board (fall into an unmatched/"no value" bucket) immediately after a column rename.

### Pitfall 5: Missing `listRecords`/`listCollections`/`createCollection`/`createView` client functions
**What goes wrong:** Planning tasks that assume `recordsApi.listRecords(collectionId)` or `recordsApi.createCollection(...)` already exist (because the backend routes do) will fail — `apps/workspaces/src/lib/api/records.api.ts` currently only exports `getCollection`, `updateCollection`, `getRecord`, `updateRecord`, `createRecord`. There is no client-side function for `GET /collections`, `GET /collections/:id/records`, `POST /collections`, `GET /collections/:id/views`, or `POST /collections/:id/views`.
**Why it happens:** Phase 23 only needed single-record/single-collection reads (record detail page); it never needed to list records in a collection or create new collections/views.
**How to avoid:** Add these functions to `records.api.ts` and corresponding hooks to `useRecords.ts` as an early task in this phase's plan, before any board-rendering task — everything else depends on them.
**Warning signs:** TypeScript errors referencing non-existent `recordsApi.listRecords`/`createCollection`/`createView`.

## Code Examples

### Grouping records into board columns (client-side)
```typescript
// Source: derived from CollectionPropertyDef/CollectionRecord shapes in
// apps/workspaces/src/lib/api/records.api.ts — no library needed.
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

### New-card creation, pre-set to a column (BOARD-03 / D-07)
```typescript
// Source: composes existing recordsApi.createRecord (records.api.ts) +
// Phase 23's blur-commit convention (PropertyField.tsx's DebouncedTextField).
async function createCardInColumn(
  collectionId: string, titlePropId: string, groupByPropId: string, columnId: string,
) {
  // Card enters inline-editable state immediately after create resolves —
  // do NOT navigate to the record detail page (D-07 explicit).
  return recordsApi.createRecord(collectionId, {
    props: { [titlePropId]: '', [groupByPropId]: columnId },
  });
}
```

### Opening a card in a new tab (reuses existing same-app pattern, not crossAppUrl)
```typescript
// Source: apps/workspaces/src/app/records/page.tsx line 125 — same-app
// new-tab navigation uses plain window.open, NOT @vectra/ui's crossAppUrl
// (crossAppUrl is reserved for cross-subdomain links, e.g. workspaces →
// cmr/marketplace; the record detail route lives inside workspaces itself).
onClick={() => window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `kanban` block: columns/cards stored as JSON directly in `project_pages.config` | `collection-view` block: pointer (`collectionId`, `viewId`) to rows in `data_collections`/`collection_records`/`collection_views` | This phase (24) | Cards become real records openable as full pages (Phase 23), shareable across views (Phase 25/26), and no longer duplicated per-page-config |

**Deprecated/outdated:**
- `KanbanBlock`/`KanbanColumn`/`KanbanCard` types (`blocks.ts` lines 227-244): not deleted this phase (existing pages still reference `kind: 'kanban'` until their first edit triggers migration), but no longer the recommended pattern for new boards — the slash-menu entry for inserting a *new* kanban should be repointed to create a `collection-view` block instead (D-04), while the `kanban` registry entry stays only to render/migrate legacy blocks.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tanstack/react-query` version `^5.99.2` (from CLAUDE.md's tech stack doc, not independently re-verified via `npm view` in this session) | Standard Stack | Low — already in use throughout the codebase (Phase 23's own hooks), version mismatch would already be visibly breaking existing features if wrong |
| A2 | The recommended approach for Pitfall 3 (explicit `createView` call for `board` type, treating the auto-created `table` view as an unused byproduct) is the simpler of two viable options — not confirmed with the user/planner which is preferred | Common Pitfalls / Pattern 2 | Low-medium — either approach works functionally; choosing (a) leaves one orphan `table` view row per migrated/new board, which is cosmetic only (never rendered, no cleanup endpoint exists yet either way) |
| A3 | Migration is triggered from the `'kanban'` editor entry point in `registry.tsx` (wrapping `KanbanBoardView`'s `onUpdate`), not from inside `KanbanBoardView.tsx` itself | Pitfall 2 / Pattern 2 | Low — this is an implementation-detail choice for the planner; either location works as long as the migration fires exactly once and the block swaps kind immediately afterward |

## Open Questions (RESOLVED)

1. **RESOLVED: Which of the two Pitfall-3 approaches should the plan implement — explicit second `createView` call, or PATCH the auto-created default view?**
   - What we know: `createCollection`'s controller response includes both `{ collection, view }`, so the auto-created view's `id` is available without a second fetch.
   - What's unclear: Whether leaving an orphan `table`-type view row per board (approach a) is acceptable, vs. the extra complexity of repurposing it via `updateView` (approach b).
   - RESOLVED: Approach (a) — explicit second `createView({ type: 'board', ... })` — is simpler, has no failure mode tied to guessing the auto-view's shape, and the orphan row has zero UI/functional impact (Phase 25/26's "switch view type" UI will just show two views, one of which is blank/table with no records displayed differently — actually cosmetic risk is low since it's the same collection/records either way). Plans 24-01/24-02/24-03 implement approach (a) throughout (`createCollection` then an explicit `createView({ type: 'board', ... })`).

2. **RESOLVED: Should the `'kanban'` slash-menu entry be removed/hidden once `collection-view` exists, or kept available for inserting new legacy boards?**
   - What we know: D-04 says a *new* board insertion (not a migration) should provision a `collection-view` directly with sensible defaults — implying the slash menu's "Kanban board" entry should now create a `collection-view`, not a `kanban` block.
   - What's unclear: Whether `PAGE_BLOCK_REGISTRY`'s existing `kind: 'kanban'` entry (title "Kanban board") should be repointed to `create: () => ({ kind: 'collection-view', ... })` — which would be a mismatch (`kind: 'kanban'` in the registry entry's `create()` returning a different kind is not how the registry is typed) — or whether a brand new `'collection-view'` registry entry should replace `'kanban'` in the palette while `'kanban'`'s entry stays registered-but-hidden purely so any already-inserted legacy blocks keep rendering via `entries['kanban']` lookup.
   - RESOLVED: Add `'collection-view'` as a fully separate `PageBlockKind` + registry entry with its own palette title ("Board"), and mark the existing `'kanban'` `PAGE_BLOCK_REGISTRY` entry's `available: false` (or remove it from the palette list while keeping the `entries['kanban']` renderer/editor registration so already-existing legacy blocks still render/migrate). This matches the "coming soon"/hidden-but-registered convention `available: false` already establishes elsewhere in `blocks.ts`. Plan 24-02 Task 1 implements exactly this: `kanban` entry's `available: false`, new `collection-view` entry with `available: true`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in `apps/workspaces` (no `jest.config.*`/`vitest.config.*`/`__tests__` found under `apps/workspaces/src`) — `apps/api` has `*.test.ts` files (e.g. `records.repository.test.ts`, `records.service.test.ts`) using an unconfirmed runner |
| Config file | none — see Wave 0 |
| Quick run command | n/a — no frontend test runner configured |
| Full suite command | n/a |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-01 | Board renders columns from live select options | manual-only (no frontend test runner) | — | N/A |
| BOARD-02 | Drag card between columns / reorder within column updates `props`/`sort_order` | manual-only | — | N/A |
| BOARD-03 | Inline new-card creation pre-set to column | manual-only | — | N/A |
| BOARD-04 | Legacy kanban migrates on first edit, no data loss | unit (pure function) | none configured — `buildMigrationPlan()` is written pure/testable but no runner exists to execute a test file | ❌ Wave 0 |

**Justification for manual-only on BOARD-01..03:** No frontend test framework (Jest/Vitest/Playwright) is configured anywhere in `apps/workspaces`. Backend-only `*.test.ts` files exist in `apps/api` for a different domain. Introducing a frontend test runner is a cross-cutting infrastructure decision outside this phase's scope (board rendering + DnD + migration) — recommend flagging to the user as tech debt rather than silently adding a new devDependency mid-phase.

### Sampling Rate
- **Per task commit:** manual verification via dev server (drag a card, confirm column/order persists on reload; edit a legacy kanban board, confirm toast + collection-view swap + record count matches original card count)
- **Per wave merge:** full manual pass through BOARD-01..04's success criteria
- **Phase gate:** Human verification of `/gsd:verify-work`'s checklist; no automated full suite exists for this app

### Wave 0 Gaps
- [ ] No frontend test runner exists in `apps/workspaces` — if the planner wants `buildMigrationPlan()` unit-tested, a minimal Vitest/Jest setup would need to be introduced as an explicit, called-out task (not silently bundled into a board task)
- [ ] `apps/api` backend already has 100% coverage of the endpoints this phase depends on (Phase 22's 102/102 passing tests per `22-VERIFICATION.md`) — no backend test gaps

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `authenticateToken` middleware already applied to all `/api/v1/records/*` routes (`records.routes.ts` line 10) — no new auth surface this phase |
| V3 Session Management | no | No new session logic introduced |
| V4 Access Control | yes (inherited) | Every records/collections/views endpoint scopes by `req.user.company_id` via `requireCompany()` — this phase adds no new endpoints, so no new access-control surface; client-side `listRecords`/`listCollections` additions just call existing company-scoped routes |
| V5 Input Validation | yes (inherited) | Zod schemas (`CreateRecordSchema`, `UpdateRecordSchema`, `CreateViewSchema`, `UpdateCollectionSchema`) already validate all payloads this phase's new client calls will send — no new backend validation needed since no new endpoints are added |
| V6 Cryptography | no | Not applicable — no secrets/crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leakage via collection/record id guessing | Information Disclosure | Already mitigated server-side — every `records.repository` query is scoped by `company_id` (verified in Phase 22); this phase's new client list-calls inherit that scoping automatically since they hit the same endpoints |
| Migration creating records with a company_id mismatch | Tampering | Not possible — `createRecord`/`createCollection`/`createView` all derive `company_id` server-side from the authenticated JWT (`requireCompany(req)`), never from client-supplied input |

## Sources

### Primary (HIGH confidence)
- `apps/api/src/domains/records/records.routes.ts`, `records.controller.ts`, `records.service.ts`, `records.types.ts` — full backend contract read directly, confirms PATCH accepts `props`+`sort_order` together, `config` is opaque, `createCollection` auto-creates a default view
- `database/migrations/025_records_views.sql` — confirms `collection_views` table exists with `type`/`config` columns, already shipped
- `apps/workspaces/src/lib/projectPage/blocks.ts` — `KanbanBlock`/`KanbanColumn`/`KanbanCard`/`DraftsKanbanBlock`/`PageBlockKind` union read directly (lines 13-68, 227-244, 370-399)
- `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` — full current renderer/editor read directly
- `apps/workspaces/src/lib/projectPage/registry.tsx` — `entry()` factory and `'kanban'` registration read directly (lines 90-114, 241-244)
- `apps/workspaces/src/app/(routes)/dispatch/page.tsx` — existing `@dnd-kit/core` usage pattern read directly (DndContext, useDraggable, useDroppable, sensors, DragOverlay)
- `apps/workspaces/src/components/records/PropertyField.tsx`, `AddPropertyModal.tsx` — Phase 23 conventions (select `options` shape, debounce/blur commit, two-sequential-PATCH) read directly
- `apps/workspaces/src/lib/api/records.api.ts`, `apps/workspaces/src/lib/hooks/useRecords.ts` — confirmed exact current client surface (and its gaps) by direct read
- `apps/workspaces/package.json` — confirmed `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`, `@dnd-kit/modifiers@^9.0.0` already declared
- `apps/workspaces/src/app/globals.css` — `saas-card`/`saas-input`/`saas-button`/`label-xs` utility classes read directly
- `apps/workspaces/src/app/records/page.tsx` — confirmed same-app new-tab pattern is `window.open(url, '_blank', 'noopener,noreferrer')`, not `crossAppUrl`
- `.planning/phases/24-board-view-legacy-kanban-migration/24-CONTEXT.md` — D-01 through D-07 locked decisions
- `.planning/phases/23-record-detail-page/23-CONTEXT.md` — D-01 (title = first schema property) governs board card titles too, per that phase's own note

### Secondary (MEDIUM confidence)
- `@dnd-kit/sortable`'s multi-container recipe (`SortableContext` per column + `onDragOver`/`onDragEnd` split) — based on well-established `@dnd-kit` documentation patterns (training knowledge), not independently re-fetched via Context7/WebFetch in this session since the package is well-known and the wiring shown mirrors the existing codebase's `dispatch/page.tsx` sensor/DndContext setup exactly; recommend the planner or executor do a final signature check against `@dnd-kit/sortable`'s actual TS types during implementation (`node_modules/@dnd-kit/sortable` was not present in this sandbox environment to inspect directly).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions confirmed directly from `package.json`
- Architecture: HIGH — every API contract and existing block/registry pattern was read directly from source, not inferred
- Pitfalls: HIGH — all five pitfalls trace to specific lines of already-shipped code (`validateProps`, `createCollectionWithDefaultView`, `PropertyField.tsx`'s select-by-id convention, the current `records.api.ts` surface)
- Migration transform: MEDIUM — the exact shape of `buildMigrationPlan()` is a recommendation, not something verified against a real execution (no test runner available to prove it end-to-end in this research session)

**Research date:** 2026-07-14
**Valid until:** 2026-07-21 (7 days — fast-moving phase within an actively executing milestone; re-verify against Phase 22/23 code if either phase's SUMMARY.md changes before this phase starts)
