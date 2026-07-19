# Phase 24: Board View & Legacy Kanban Migration - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `apps/workspaces/src/lib/api/records.api.ts` (ADD functions) | service (API client) | CRUD | same file, existing `recordsApi` object | exact (extend in place) |
| `apps/workspaces/src/lib/hooks/useRecords.ts` (ADD hooks) | hook | CRUD / request-response | same file, existing `useCollection`/`useCreateRecord` | exact (extend in place) |
| `apps/workspaces/src/lib/projectPage/blocks.ts` (ADD `CollectionViewBlock`) | model/type | transform | `KanbanBlock`/`KanbanColumn`/`KanbanCard` (lines 227-244) + `PAGE_BLOCK_REGISTRY` kanban entry (lines 561-572) | exact |
| `apps/workspaces/src/lib/projectPage/registry.tsx` (ADD `'collection-view'` entry) | provider/registry | request-response | `'kanban'` entry (lines 241-244) | exact |
| `apps/workspaces/src/lib/projectPage/kanbanMigration.ts` (NEW) | utility (pure transform) | transform / batch | `AddPropertyModal.tsx`'s two-sequential-mutation `handleSubmit` (lines 77-98) | role-match |
| `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (NEW) | component | request-response / event-driven | `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` (whole file) | exact (structural analog) |
| `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` (NEW) | component | event-driven | `KanbanBlock.tsx`'s inline column markup (lines 46-82) + `AddPropertyModal.tsx`'s option-add UI | role-match |
| `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` (NEW) | component | event-driven | `dispatch/page.tsx`'s `DraggableShipmentCard` (lines 158-181) for drag mechanics; `PropertyField.tsx`'s `DebouncedTextField` (lines 242-293) for inline title edit | role-match (composite) |
| `apps/workspaces/src/components/projectPage/board/AddColumnControl.tsx` (NEW) | component | request-response | `AddPropertyModal.tsx`'s option list UI + schema-PATCH submit flow (lines 58-98) | role-match |
| `apps/api` (no new files) | — | — | n/a — all backend endpoints (`records.routes.ts`, `records.controller.ts`) already exist and ship unchanged this phase | exact (no-op) |

## Pattern Assignments

### `apps/workspaces/src/lib/api/records.api.ts` (service, CRUD) — ADD functions

**Analog:** same file, existing `recordsApi` object (lines 53-64)

**Current shape to extend** (lines 51-64):
```typescript
const BASE = '/api/v1/records';

export const recordsApi = {
  getCollection: (id: string) =>
    apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`).then((r) => r.collection),
  updateCollection: (id: string, data: UpdateCollectionInput) =>
    apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`, 'PATCH', data).then((r) => r.collection),
  getRecord: (id: string) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`).then((r) => r.record),
  updateRecord: (id: string, data: UpdateRecordInput) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`, 'PATCH', data).then((r) => r.record),
  createRecord: (collectionId: string, data: CreateRecordInput) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/collections/${collectionId}/records`, 'POST', data).then((r) => r.record),
};
```

**Backend contract confirmed** (`apps/api/src/domains/records/records.controller.ts` lines 14-61 and `records.routes.ts` lines 12-28) — these five new client functions map 1:1 to already-shipped, already-tested endpoints, no backend change needed:
```typescript
router.get('/collections', listCollections);
router.post('/collections', createCollection);           // returns { collection, view } (default table view)
router.get('/collections/:id/records', listRecords);      // returns { records: [] }
router.get('/collections/:id/views', listViews);          // returns { views: [] }
router.post('/collections/:id/views', createView);        // returns { view }
```

**New functions to add** (same object-literal style, same `apiFetch<...>().then((r) => r.X)` shape):
```typescript
export interface CollectionView {
  id: string;
  collection_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionInput {
  name: string;
  schema: CollectionPropertyDef[];
  project_id?: string | null;
}

export interface CreateViewInput {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

// add inside recordsApi = { ... }:
listCollections: () =>
  apiFetch<{ collections: DataCollection[] }>(`${BASE}/collections`).then((r) => r.collections),
createCollection: (data: CreateCollectionInput) =>
  apiFetch<{ collection: DataCollection; view: CollectionView }>(`${BASE}/collections`, 'POST', data),
listRecords: (collectionId: string) =>
  apiFetch<{ records: CollectionRecord[] }>(`${BASE}/collections/${collectionId}/records`).then((r) => r.records),
listViews: (collectionId: string) =>
  apiFetch<{ views: CollectionView[] }>(`${BASE}/collections/${collectionId}/views`).then((r) => r.views),
createView: (collectionId: string, data: CreateViewInput) =>
  apiFetch<{ view: CollectionView }>(`${BASE}/collections/${collectionId}/views`, 'POST', data).then((r) => r.view),
```

Note: `createCollection` intentionally returns the raw `{ collection, view }` object (not unwrapped) — the caller (migration/new-board flow) needs both pieces, matching how the controller already surfaces them (see Pitfall 3 in RESEARCH.md).

---

### `apps/workspaces/src/lib/hooks/useRecords.ts` (hook, CRUD) — ADD hooks

**Analog:** same file, existing `useCollection`/`useUpdateRecord`/`useCreateRecord` (lines 14-52)

**Query key convention to extend** (lines 9-12):
```typescript
const qk = {
  collection: (id: string) => ['records-collection', id] as const,
  record: (id: string) => ['records-record', id] as const,
};
```

**Existing hook shapes to clone:**
```typescript
export function useCollection(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.collection(id),
    queryFn: () => recordsApi.getCollection(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useCreateRecord(collectionId: string) {
  return useMutation({
    mutationFn: (data: CreateRecordInput) => recordsApi.createRecord(collectionId, data),
  });
}
```

**New hooks to add** (add `collections`, `records`, `views` keys to `qk`, follow the exact `enabled: !!user?.company_id && !!id` guard convention):
```typescript
qk.collections = () => ['records-collections'] as const,
qk.records = (collectionId: string) => ['records-list', collectionId] as const,
qk.views = (collectionId: string) => ['records-views', collectionId] as const,

export function useCollections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.collections(),
    queryFn: () => recordsApi.listCollections(),
    enabled: !!user?.company_id,
  });
}

export function useRecords(collectionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.records(collectionId),
    queryFn: () => recordsApi.listRecords(collectionId),
    enabled: !!user?.company_id && !!collectionId,
  });
}

export function useViews(collectionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.views(collectionId),
    queryFn: () => recordsApi.listViews(collectionId),
    enabled: !!user?.company_id && !!collectionId,
  });
}

export function useCreateCollection() {
  return useMutation({
    mutationFn: (data: CreateCollectionInput) => recordsApi.createCollection(data),
  });
}

export function useCreateView(collectionId: string) {
  return useMutation({
    mutationFn: (data: CreateViewInput) => recordsApi.createView(collectionId, data),
  });
}
```

**Important — `useUpdateRecord` currently takes `id` at hook-construction time** (line 40: `useUpdateRecord(id: string)`), but the board needs to update *many different* record ids from one component (drag-and-drop across cards). Follow `useCreateRecord`'s pattern instead — accept the id inside `mutationFn`'s payload, or construct one mutation per-card the same way `BoardCard` would call `useMutation` directly with `recordsApi.updateRecord(record.id, data)`. Board's optimistic cache update should mirror `onSuccess: (record) => qc.setQueryData(qk.record(id), record)` but additionally patch the `qk.records(collectionId)` list cache entry for the moved record (list query is new this phase, no existing analog for updating a list cache — implement directly).

---

### `apps/workspaces/src/lib/projectPage/blocks.ts` (model/type, transform) — ADD `CollectionViewBlock`

**Analog:** `KanbanBlock`/`KanbanColumn`/`KanbanCard` (lines 227-244) + `PageBlockKind` union (lines 13-68) + registry def entry (lines 561-572)

**Existing kanban shape (do not modify — legacy, still rendered until migrated):**
```typescript
export interface KanbanCard {
  id: string;
  text: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBlock extends PageBlockBase {
  kind: 'kanban';
  title?: string;
  columns: KanbanColumn[];
}
```

**`PageBlockKind` union — add `'collection-view'` member** (insert after `'kanban'`, line 40):
```typescript
| 'mini-program'
| 'kanban'
| 'collection-view'   // NEW — Phase 24
```

**New `CollectionViewBlock` interface (pointer-shaped, not JSON-embedded like Kanban):**
```typescript
export interface CollectionViewBlock extends PageBlockBase {
  kind: 'collection-view';
  title?: string;
  collectionId: string;
  viewId: string;
}
```
Add to the `PageBlock` union (near line 381, alongside `KanbanBlock`).

**`PAGE_BLOCK_REGISTRY` entry pattern to clone** (existing kanban entry, lines 561-572):
```typescript
{
  kind: 'kanban', group: 'widget', title: 'Kanban board', icon: 'Kanban',
  description: 'A simple board with columns and cards, stored on this page.', available: true,
  create: () => ({
    id: uid(), kind: 'kanban', span: 'full', title: 'Board',
    columns: [
      { id: uid(), title: 'To do', cards: [] },
      { id: uid(), title: 'In progress', cards: [] },
      { id: uid(), title: 'Done', cards: [] },
    ],
  }),
},
```

**New `collection-view` entry** — per RESEARCH.md's Open Question 2 recommendation, this becomes the palette-visible "Board" entry; the old `'kanban'` entry is kept registered (for migration/legacy rendering) but flagged `available: false` so it disappears from the slash menu:
```typescript
{
  kind: 'kanban', group: 'widget', title: 'Kanban board', icon: 'Kanban',
  description: 'A simple board with columns and cards, stored on this page.', available: false, // hidden — legacy, kept for existing pages
  create: () => ({ /* unchanged */ }),
},
{
  kind: 'collection-view', group: 'widget', title: 'Board', icon: 'Kanban',
  description: 'A drag-and-drop board grouped by a select property, backed by a real data collection.', available: true,
  create: () => ({ id: uid(), kind: 'collection-view', span: 'full', title: 'Board', collectionId: '', viewId: '' }),
  // NOTE: collectionId/viewId are placeholders here — the actual provisioning
  // (createCollection + createView, per D-04) must happen async at insert time,
  // not inside this synchronous create() factory. Follow the same async-provision-
  // then-swap-block pattern as kanbanMigration.ts (see below), triggered from
  // wherever the slash menu calls create() and inserts the block (planner to confirm
  // exact call site — likely needs create() to return a stub block immediately,
  // then an effect/handler fires the provisioning calls and PATCHes the block in place).
},
```

---

### `apps/workspaces/src/lib/projectPage/registry.tsx` (provider/registry, request-response) — ADD `'collection-view'` entry

**Analog:** `'kanban'` entry (lines 241-244)

```typescript
'kanban': entry('kanban',
  ({ block, ctx }) => <KanbanBoardView block={block as KanbanBlock} onChange={ctx.onChange} />,
  ({ block, onUpdate }) => <KanbanBoardView block={block as KanbanBlock} onChange={onUpdate} />,
),
```

**Migration wiring point** — per RESEARCH.md Pattern 2/Pitfall 2, wrap the `'kanban'` editor arrow (not `KanbanBoardView` itself) so migration fires exactly once, gated by a ref, before any further edit reaches the legacy renderer:
```typescript
'kanban': entry('kanban',
  ({ block, ctx }) => <KanbanBoardView block={block as KanbanBlock} onChange={ctx.onChange} />,
  ({ block, onUpdate }) => <KanbanMigrationGate block={block as KanbanBlock} onUpdate={onUpdate} />,
),
'collection-view': entry('collection-view',
  ({ block, ctx }) => <BoardBlock block={block as CollectionViewBlock} onChange={ctx.onChange} />,
  ({ block, onUpdate }) => <BoardBlock block={block as CollectionViewBlock} onChange={onUpdate} />,
),
```
`entry()` factory itself (lines 100-114) requires no changes — it is generic over `PageBlockKind` already.

---

### `apps/workspaces/src/lib/projectPage/kanbanMigration.ts` (NEW, utility, transform/batch)

**Analog:** `AddPropertyModal.tsx`'s two-sequential-mutation `handleSubmit` (lines 77-98) for the "schema write must resolve before dependent write" ordering convention; `KanbanBlock`/`KanbanColumn`/`KanbanCard` types (blocks.ts lines 227-244) for the source shape being read.

**Two-sequential-request convention to clone** (`AddPropertyModal.tsx` lines 77-98):
```typescript
const handleSubmit = async () => {
  if (!canSubmit) return;
  setSubmitting(true);
  setSubmitError(false);
  const newProperty: CollectionPropertyDef = { id: uid(), name: name.trim(), type, ...(needsOptions ? { options } : {}) };
  try {
    const nextSchema = [...collection.schema, newProperty];
    await onUpdateSchema.mutateAsync(nextSchema);          // schema PATCH — must resolve first
    await onUpdateRecord.mutateAsync({                      // dependent record write — only after schema persisted
      props: { ...record.props, [newProperty.id]: initialValueFor(type) },
    });
    onClose();
  } catch {
    setSubmitError(true);
    setSubmitting(false);
  }
};
```

**Pure transform function (build the plan, no API calls inside — testable in isolation per RESEARCH.md Pattern 2):**
```typescript
import { uid } from '@/lib/projectPage/blocks';
import type { KanbanBlock } from '@/lib/projectPage/blocks';
import type { CollectionPropertyDef } from '@/lib/api/records.api';

export function buildMigrationPlan(kanban: KanbanBlock) {
  const titlePropId = uid();
  const statusPropId = uid();
  // Pitfall 4: option id MUST reuse the existing kanban column id — never
  // derive a new id from col.title — or a later column rename orphans cards.
  const statusOptions = kanban.columns.map((col) => ({ id: col.id, label: col.title }));

  const schema: CollectionPropertyDef[] = [
    { id: titlePropId, name: 'Title', type: 'text' },
    { id: statusPropId, name: 'Status', type: 'select', options: statusOptions },
  ];

  const records = kanban.columns.flatMap((col) =>
    col.cards.map((card, cardIdx) => ({
      props: { [titlePropId]: card.text, [statusPropId]: col.id },
      sort_order: cardIdx,
    })));

  return { titlePropId, statusPropId, schema, records };
}
```

**Orchestration — sequential await, ref-gated at the call site (registry.tsx wrapper), following the same `await X; await Y` ordering as `AddPropertyModal`:**
```typescript
export async function migrateOnFirstEdit(kanban: KanbanBlock) {
  const plan = buildMigrationPlan(kanban);
  const { collection } = await recordsApi.createCollection({ name: kanban.title ?? 'Board', schema: plan.schema });
  const boardView = await recordsApi.createView(collection.id, {
    name: 'Board', type: 'board', config: { groupBy: plan.statusPropId },
  });
  await Promise.all(plan.records.map((r) => recordsApi.createRecord(collection.id, r)));

  return {
    id: kanban.id, kind: 'collection-view' as const, span: kanban.span,
    title: kanban.title, collectionId: collection.id, viewId: boardView.id,
  };
}
```

---

### `apps/workspaces/src/components/projectPage/BoardBlock.tsx` (NEW, component, request-response/event-driven)

**Analog:** `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` (whole file, 117 lines)

**Full existing renderer to mirror structurally** (wrapper chrome, column loop, empty state):
```typescript
'use client';

import { useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { uid, type KanbanBlock as KanbanBlockType, type KanbanColumn } from '@/lib/projectPage/blocks';

export function KanbanBoardView({ block, onChange }: { block: KanbanBlockType; onChange?: (block: KanbanBlockType) => void }) {
  const editable = !!onChange;
  // ... setColumns/addCard/removeCard/moveCard local mutators ...
  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {block.columns.map((col) => ( /* column markup */ ))}
      </div>
    </div>
  );
}
```

**BoardBlock replaces the local `columns` array with `useCollection`/`useRecords`/`useViews` reads** (per RESEARCH.md's `groupRecordsByColumn` code example) and wraps the same `.saas-card !p-4` wrapper + `flex gap-3 overflow-x-auto pb-1` column row in a `DndContext` (see BoardCard analog below). Loading/error states follow `dispatch/page.tsx`'s `ErrorBlock`/skeleton convention (lines 649-653) rather than `KanbanBlock.tsx`'s (which has none, since it's config-local and never fails to load).

---

### `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` (NEW, component, event-driven)

**Analog:** `KanbanBlock.tsx`'s inline column markup (lines 46-82) + `AddPropertyModal.tsx`'s option-list-building UI (lines 58-75, 108-... for add/remove option rows)

**Column shell to clone verbatim** (`KanbanBlock.tsx` lines 46-50):
```typescript
<div key={col.id} className="w-56 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
  <div className="flex items-center justify-between px-1 mb-2">
    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{col.title}</span>
    <span className="text-[10px] text-gray-400">{col.cards.length}</span>
  </div>
  {/* ...card list... */}
</div>
```
BoardColumn wraps this shell in a `SortableContext` (per RESEARCH.md Pattern 1) and adds: inline-editable header (click title → `<input>`, blur/Enter commits rename via schema PATCH, matching `AddPropertyModal`'s option-add flow but on an existing option's `label`), and a disabled-when-non-empty delete affordance (D-06) styled per UI-SPEC's `opacity-40 cursor-not-allowed` contract.

**Option-add/remove pattern to clone from `AddPropertyModal.tsx`** (lines 66-75):
```typescript
const addOption = () => {
  const trimmed = optionDraft.trim();
  if (!trimmed) return;
  setOptions((prev) => [...prev, { id: uid(), label: trimmed }]);
  setOptionDraft('');
};

const removeOption = (id: string) => {
  setOptions((prev) => prev.filter((o) => o.id !== id));
};
```
`AddColumnControl.tsx` (see below) reuses this exact id/label-append shape but PATCHes the *live* collection schema directly (`updateCollection(collectionId, { schema: [...collection.schema, newOption-bearing-property-update] })`) rather than building up local component state before a single submit.

---

### `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` (NEW, component, event-driven)

**Analog 1 — drag mechanics:** `apps/workspaces/src/app/(routes)/dispatch/page.tsx`'s `DraggableShipmentCard` (lines 158-181)
```typescript
function DraggableShipmentCard({ shipment }: { shipment: Shipment }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shipment.id,
    data: { shipment },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing touch-none"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        transition: isDragging ? 'none' : 'opacity 0.15s',
      }}
    >
      <ShipmentCardContent shipment={shipment} isDragging={false} />
    </div>
  );
}
```
BoardCard swaps `useDraggable` for `useSortable` (per RESEARCH.md Pattern 1 — cards need within-column reordering, not just cross-container drop, so `@dnd-kit/sortable`'s hook is required instead of bare `@dnd-kit/core`):
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function BoardCard({ record }: { record: CollectionRecord }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: record.id });
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 text-sm shadow-sm cursor-grab active:cursor-grabbing touch-none"
    >
      {/* title / inline-edit-on-create below */}
    </div>
  );
}
```

**Analog 2 — inline-editable title (new-card creation, D-07):** `apps/workspaces/src/components/records/PropertyField.tsx`'s `DebouncedTextField` (lines 242-293)
```typescript
function DebouncedTextField({ property, value, onCommit }: { property: CollectionPropertyDef; value: unknown; onCommit: (value: unknown) => void }) {
  const initial = value == null ? '' : String(value);
  const [draft, setDraft] = useState(initial);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(initial);

  useEffect(() => {
    const next = value == null ? '' : String(value);
    setDraft(next);
    lastCommittedRef.current = next;
  }, [value]);

  const flush = (next: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (next === lastCommittedRef.current) return;
    lastCommittedRef.current = next;
    onCommit(next);
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flush(next), 800);
  };

  return (
    <input
      type="text"
      className="saas-input !py-2 text-sm mt-1"
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => flush(draft)}
    />
  );
}
```
BoardCard's new-card title input clones this 800ms-debounce/blur-flush shape exactly (per D-07 and UI-SPEC's explicit instruction to reuse Phase 23's blur/Enter-commit conventions), but auto-focuses immediately after creation and renders full-width inside the card shell rather than in a property-panel row.

**Analog 3 — click-to-open in new tab:** `apps/workspaces/src/app/records/page.tsx` line 125
```typescript
onClick={() => window.open(`/records/${client.id}`, '_blank', 'noopener,noreferrer')}
```
BoardCard clones this exact call shape, pointed at the Phase 23 record detail route:
```typescript
onClick={() => window.open(`/collections/${collectionId}/records/${record.id}`, '_blank', 'noopener,noreferrer')}
```
Per UI-SPEC, this must NOT be `crossAppUrl` (reserved for cross-subdomain links) since the route lives inside `workspaces` itself — and must be disambiguated from drag-start via `@dnd-kit`'s own `listeners` (no extra pointer-distance logic needed, matches `PointerSensor`'s `activationConstraint: { distance: 8 }` from `dispatch/page.tsx`).

---

### `apps/workspaces/src/components/projectPage/board/AddColumnControl.tsx` (NEW, component, request-response)

**Analog:** `AddPropertyModal.tsx`'s option-list state + schema-PATCH submit (lines 58-98), condensed to a single "append one option" action instead of a full add-property form.

```typescript
// Simplified single-purpose version of AddPropertyModal's flow: no property
// type selection needed (always appending to the existing select property),
// just append { id: uid(), label } to that property's options array and PATCH.
const handleAddColumn = async (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) return;
  const nextSchema = collection.schema.map((prop) =>
    prop.id === groupByPropId
      ? { ...prop, options: [...(prop.options ?? []), { id: uid(), label: trimmed }] }
      : prop);
  await updateCollectionSchema.mutateAsync(nextSchema); // schema PATCH resolves before any card can move into it
};
```
This follows the exact "schema PATCH must fully resolve before dependent write" rule documented in `AddPropertyModal.tsx`'s header comment (lines 3-7) and RESEARCH.md's "Skipping the two-sequential-PATCH order" anti-pattern warning.

---

## Shared Patterns

### Two-sequential-request rule (schema PATCH before dependent record write)
**Source:** `apps/workspaces/src/components/records/AddPropertyModal.tsx` lines 3-7, 77-98
**Apply to:** `kanbanMigration.ts` (createCollection → createView → createRecord × N), `AddColumnControl.tsx` (schema PATCH before any card moves into the new column), new-board-from-scratch provisioning (D-04)
```typescript
await onUpdateSchema.mutateAsync(nextSchema);
await onUpdateRecord.mutateAsync({ props: { ...record.props, [newProperty.id]: initialValueFor(type) } });
```

### Select option identity — id vs label (Pitfall 4)
**Source:** `apps/workspaces/src/components/records/PropertyField.tsx` line 58 (`<option key={o.id} value={o.id}>{o.label}</option>`)
**Apply to:** `kanbanMigration.ts`'s `buildMigrationPlan` (reuse `kanban.columns[i].id` as the new option's `id`, never derive from `title`), `BoardColumn.tsx`'s rename flow (mutate `label` only, never `id`), `groupRecordsByColumn` grouping logic (match on `props[groupByPropId] === option.id`)

### `@dnd-kit` sensor/DndContext wiring
**Source:** `apps/workspaces/src/app/(routes)/dispatch/page.tsx` lines 553-555, 596-601
```typescript
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
// ...
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={...} onDragEnd={...}>
```
**Apply to:** `BoardBlock.tsx`'s root `DndContext` — same sensor config, same `closestCenter` collision detection, but with `SortableContext` per column added (new for this phase, `dispatch/page.tsx` has no `SortableContext` precedent).

### Same-app new-tab navigation (not `crossAppUrl`)
**Source:** `apps/workspaces/src/app/records/page.tsx` line 125
```typescript
onClick={() => window.open(`/records/${client.id}`, '_blank', 'noopener,noreferrer')}
```
**Apply to:** `BoardCard.tsx`'s click-to-open handler, pointed at `/collections/${collectionId}/records/${record.id}`.

### Success/status toast styling
**Source:** `apps/workspaces/src/app/profile/page.tsx` lines 281-288
```typescript
<div className={`flex items-center gap-3 p-4 rounded-xl mb-6 text-sm border ${msg.type === 'success'
  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
  {msg.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
  {msg.text}
</div>
```
**Apply to:** D-02's one-time migration toast ("Board upgraded to the new view engine.") — per UI-SPEC, positioned `fixed bottom-6 right-6 z-50` instead of inline, auto-dismissing after 4000ms with no manual dismiss control.

### Registry `entry()` factory (block kind registration)
**Source:** `apps/workspaces/src/lib/projectPage/registry.tsx` lines 100-114, 241-244
```typescript
function entry(kind: PageBlockKind, renderer: Renderer, editor?: Editor): WorkspaceBlockPlugin<PageBlock, PageCtx> {
  const def = pageBlockDef(kind)!;
  return { key: kind, source: 'native', group: def.group, title: def.title, description: def.description, icon: def.icon, available: def.available, create: def.create, renderer, editor };
}
```
**Apply to:** `'collection-view'`'s new `entries` map entry — no changes needed to `entry()` itself, it is already generic over any `PageBlockKind`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `@dnd-kit/sortable` multi-container wiring (`SortableContext`/`useSortable`/`arrayMove` combined with cross-column `onDragOver`) inside `BoardBlock.tsx` | component | event-driven | Confirmed by RESEARCH.md: zero existing usage of `@dnd-kit/sortable` anywhere in the codebase; `dispatch/page.tsx` only uses bare `useDraggable`/`useDroppable` with no reordering concept. Build directly from the official multi-container recipe cited in RESEARCH.md Pattern 1. |
| List-cache reconciliation for `qk.records(collectionId)` after an optimistic card move | hook | CRUD | No existing hook in `useRecords.ts` updates a *list* query's cache (`useUpdateRecord` only patches the single-record cache key). This is new plumbing this phase must add; follow React Query's standard `setQueryData` list-splice pattern, no in-repo precedent to clone verbatim. |

## Metadata

**Analog search scope:** `apps/workspaces/src/lib/api/`, `apps/workspaces/src/lib/hooks/`, `apps/workspaces/src/lib/projectPage/`, `apps/workspaces/src/components/projectPage/`, `apps/workspaces/src/components/records/`, `apps/workspaces/src/app/(routes)/dispatch/`, `apps/workspaces/src/app/records/`, `apps/workspaces/src/app/profile/`, `apps/api/src/domains/records/`
**Files scanned:** ~14 (records.api.ts, useRecords.ts, records.routes.ts, records.controller.ts, KanbanBlock.tsx, registry.tsx, blocks.ts, dispatch/page.tsx, PropertyField.tsx, AddPropertyModal.tsx, records/page.tsx, profile/page.tsx, 24-CONTEXT.md, 24-RESEARCH.md, 24-UI-SPEC.md)
**Pattern extraction date:** 2026-07-14
