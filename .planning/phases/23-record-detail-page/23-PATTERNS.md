# Phase 23: Record Detail Page - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` | route (page) | request-response + seed-once autosave | `apps/workspaces/src/app/records/[clientId]/page.tsx` | exact |
| `apps/workspaces/src/lib/api/records.api.ts` | utility (api client module) | request-response (CRUD) | `apps/workspaces/src/lib/api/crm.api.ts` | exact |
| `apps/workspaces/src/lib/hooks/useRecords.ts` | hook | CRUD (React Query) | `apps/workspaces/src/lib/hooks/useCrm.ts` | exact |
| `apps/workspaces/src/components/records/PropertyPanel.tsx` | component | request-response | `ClientSidebar` (in `records/[clientId]/page.tsx`, lines 150-180) | exact |
| `apps/workspaces/src/components/records/PropertyField.tsx` | component | request-response (type-switch editor) | `apps/workspaces/src/components/miniProgram/DynamicBlockSettings.tsx` | exact (structure) + `InlineTextField`/`EmployeeOverrideField` for specific input behaviors |
| `apps/workspaces/src/components/records/AddPropertyModal.tsx` | component | request-response (form → two sequential PATCH calls) | `UnlinkConfirmDialog` (modal shell, `records/[clientId]/page.tsx` lines 357-389) + `LinkedProjectsSection`'s picker popover (lines 236-290) | role-match |
| Record title heading (inline, inside `PropertyPanel.tsx`) | component (sub-pattern) | request-response | `EditableTitle` (`apps/workspaces/src/components/projectPage/PageHeader.tsx` lines 215-239) | exact |
| Multi-select chip toggle (new UI pattern, inside `PropertyField.tsx`) | component | request-response | none — new pattern per CONTEXT.md D-02 | no analog (build new, small) |

## Pattern Assignments

### `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` (route, request-response + autosave)

**Analog:** `apps/workspaces/src/app/records/[clientId]/page.tsx`

**Imports pattern** (lines 1-24 of analog):
```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Loader2, Search, Check, Unlink as UnlinkIcon } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  useClient, useUpdateClient, useClientPage, useUpdateClientPage,
} from '@/lib/hooks/useCrm';
import { useTeam } from '@/lib/hooks/useTeam';
import { isPageConfig, emptyPageConfig, uid, type PageConfig } from '@/lib/projectPage/blocks';
import LivePageCanvas from '@/components/projectPage/LivePageCanvas';
```
For the new page: replace `useClient`/`useClientPage` with `useCollection(collectionId)` / `useRecord(recordId)` from the new `useRecords.ts`; params become `useParams<{ collectionId: string; recordId: string }>()`.

**Seed-once + debounced autosave pattern (body editor)** (lines 38-106, verbatim structure to clone):
```typescript
const [config, setConfig] = useState<PageConfig>(emptyPageConfig());
const [seeded, setSeeded] = useState(false);
const [canvasSaveError, setCanvasSaveError] = useState(false);
const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const dirtyRef = useRef(false);
const configRef = useRef(config);
const updateRecordRef = useRef(updateRecord);
const seededConfigRef = useRef<PageConfig | null>(null);
configRef.current = config;
updateRecordRef.current = updateRecord;

if (!seeded && record) {
  const initial = isPageConfig(record.body) ? record.body as PageConfig : emptyPageConfig();
  seededConfigRef.current = initial;
  setConfig(initial);
  setSeeded(true);
}

useEffect(() => {
  if (!seeded || config === seededConfigRef.current) return;
  dirtyRef.current = true;
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    const pending = config;
    updateRecordRef.current.mutate(
      { body: pending as unknown as Record<string, unknown> },
      {
        onSuccess: () => { if (configRef.current === pending) dirtyRef.current = false; setCanvasSaveError(false); },
        onError: () => setCanvasSaveError(true),
      },
    );
  }, 1500);
  return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
}, [config, seeded]);

useEffect(() => {
  return () => {
    if (dirtyRef.current) {
      updateRecordRef.current.mutate({ body: configRef.current as unknown as Record<string, unknown> });
    }
  };
}, []);
```
Note: unlike `ClientDetailPage`, records have no "seed default blocks on first empty visit" requirement (CARD-04 doesn't call for it) — omit the `defaultsSeeded` block-seeding effect (lines 57-74 of analog), keep everything else.

**Loading / error state pattern** (lines 108-128):
```typescript
if (collectionLoading || recordLoading) {
  return (
    <div className="flex items-center gap-2 text-gray-400 py-20 justify-center">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading…
    </div>
  );
}

if (recordError || !record) {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Couldn&apos;t load this record.</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Check your connection and try again, or return to the collection.
      </p>
    </div>
  );
}
```
(Copy per UI-SPEC's exact error copy — "Couldn't load this record." / "Check your connection and try again, or return to the collection.")

**Page shell layout** (lines 130-144):
```typescript
return (
  <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 flex gap-6 items-start">
      <PropertyPanel collection={collection} record={record} onUpdateRecord={updateRecord} onUpdateSchema={updateSchema} />
      <div className="flex-1 min-w-0">
        {canvasSaveError && (
          <p className="text-[11px] text-red-500 mb-2">Couldn&apos;t save your changes — try again.</p>
        )}
        <LivePageCanvas config={config} onChange={setConfig} />
      </div>
    </div>
  </div>
);
```
Per UI-SPEC/RESEARCH Pattern 3: `LivePageCanvas` gets **zero extra props** (no `clientId`/`projectId`/`pageId`) — records have no such context.

---

### `apps/workspaces/src/lib/api/records.api.ts` (utility, CRUD)

**Analog:** `apps/workspaces/src/lib/api/crm.api.ts`

**Full shape to follow** (imports + interface + BASE + object-of-functions convention, lines 1, 90-120 of analog):
```typescript
import { apiFetch } from './client';

export interface CollectionPropertyDef {
  id: string; name: string;
  type: 'text'|'number'|'date'|'select'|'multi-select'|'checkbox'|'person'|'url'|'email'|'phone'|'files'|'relation';
  options?: { id: string; label: string }[];
  [key: string]: unknown;
}
export interface DataCollection {
  id: string; company_id: string; project_id: string | null; name: string;
  schema: CollectionPropertyDef[]; created_by: string | null; created_at: string; updated_at: string;
}
export interface CollectionRecord {
  id: string; company_id: string; collection_id: string; parent_record_id: string | null;
  props: Record<string, unknown>; body: Record<string, unknown>; sort_order: number;
  created_by: string | null; created_at: string; updated_at: string;
}

const BASE = '/api/v1/records';
export const recordsApi = {
  getCollection: (id: string) => apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`).then((r) => r.collection),
  updateCollection: (id: string, data: { schema?: CollectionPropertyDef[]; name?: string }) =>
    apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`, 'PATCH', data).then((r) => r.collection),
  getRecord: (id: string) => apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`).then((r) => r.record),
  updateRecord: (id: string, data: { props?: Record<string, unknown>; body?: Record<string, unknown> }) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`, 'PATCH', data).then((r) => r.record),
};
```
Note: `apiFetch` is re-exported from `@vectra/api-client` via `apps/workspaces/src/lib/api/client.ts` line 4 (`export { apiFetch, ApiError } from '@vectra/api-client';`) — import from `./client`, not the package directly, matching `crm.api.ts`'s own import.

Verified against backend routes (`apps/api/src/domains/records/records.routes.ts`): `GET/PATCH /collections/:id`, `GET/PATCH /records/:id` all exist and match RESEARCH.md's documented contract exactly — no path corrections needed.

---

### `apps/workspaces/src/lib/hooks/useRecords.ts` (hook, CRUD)

**Analog:** `apps/workspaces/src/lib/hooks/useCrm.ts`

**Query key + hook pattern** (lines 1-21, 32-63, 90-105 of analog):
```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  recordsApi, type DataCollection, type CollectionRecord, type CollectionPropertyDef,
} from '@/lib/api/records.api';

const qk = {
  collection: (id: string) => ['records-collection', id] as const,
  record: (id: string) => ['records-record', id] as const,
};

export function useCollection(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.collection(id),
    queryFn: () => recordsApi.getCollection(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useRecord(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.record(id),
    queryFn: () => recordsApi.getRecord(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useUpdateCollectionSchema(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schema: CollectionPropertyDef[]) => recordsApi.updateCollection(id, { schema }),
    onSuccess: (collection) => qc.setQueryData(qk.collection(id), collection),
  });
}

export function useUpdateRecord(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { props?: Record<string, unknown>; body?: Record<string, unknown> }) => recordsApi.updateRecord(id, data),
    onSuccess: (record) => qc.setQueryData(qk.record(id), record),
  });
}
```
Use `qc.setQueryData` (not `invalidateQueries`) for both mutations — matches `useUpdateClientPage`'s convention (immediate cache write, no refetch round-trip) rather than `useUpdateClient`'s `invalidateQueries` (which is for the list view, not applicable here). This also satisfies CARD-03's "other open records of the same collection pick up the new schema" requirement per RESEARCH.md's note on `useUpdateCollectionSchema`.

---

### `apps/workspaces/src/components/records/PropertyPanel.tsx` (component, request-response)

**Analog:** `ClientSidebar` function in `apps/workspaces/src/app/records/[clientId]/page.tsx` (lines 150-180)

**Shell + title pattern:**
```typescript
function ClientSidebar({ client, team, onUpdateClient }: { ... }) {
  return (
    <div className="w-80 flex-shrink-0 saas-card !p-4 dark:bg-slate-800">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 truncate">{client.name}</h1>
      <InlineTextField label="Address" value={client.address ?? ''} ... />
      ...
    </div>
  );
}
```
For `PropertyPanel`: per UI-SPEC, the wrapper is identical (`w-80 flex-shrink-0 saas-card ... dark:bg-slate-800`) but the title must be `text-xl font-bold` (not `font-semibold` — explicit UI-SPEC divergence, see Typography section) and must be **inline-editable** (clone `EditableTitle` from `PageHeader.tsx`, see below) rather than a static `<h1>{client.name}</h1>`, since the title here is a `props` value, not a fixed DB column. Below the title: iterate `collection.schema.slice(1)` (first property is the title, rendered separately) and render one `PropertyField` per property, then the "+ Add property" link-button (style matches "Attach project" link, lines 240-246 of analog: `text-sm font-semibold text-primary-600 hover:text-primary-700 min-h-[48px] px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors`).

**Inline-editable title (clone verbatim, adapt prop name):** `apps/workspaces/src/components/projectPage/PageHeader.tsx` lines 215-239 (`EditableTitle`) — uncontrolled contentEditable `<h1>`, syncs only while unfocused, commits on blur, Enter blurs, empty commit reverts to previous value. Apply UI-SPEC's placeholder behavior on top: when the title prop value is empty, show "Untitled" in italic/grey (matches `InlineTextField`'s placeholder treatment, `text-gray-400 italic` — see `records/[clientId]/page.tsx` line 749).

---

### `apps/workspaces/src/components/records/PropertyField.tsx` (component, type-switch editor)

**Analog:** `apps/workspaces/src/components/miniProgram/DynamicBlockSettings.tsx` (whole file, 87 lines — structural pattern) + `InlineTextField`/`EmployeeOverrideField` from `records/[clientId]/page.tsx` for behavior details.

**Type-switch structure to clone** (`DynamicBlockSettings.tsx` lines 28-84):
```typescript
switch (property.type) {
  case 'checkbox':
    return <input type="checkbox" checked={!!value} onChange={(e) => setProp(property.id, e.target.checked)}
      className="rounded border-gray-300 text-primary-600" />; // immediate commit, per UI-SPEC
  case 'select':
    return (
      <select className="saas-input !py-2 text-sm mt-1" value={String(value ?? '')} onChange={(e) => setProp(property.id, e.target.value)}>
        <option value="">—</option>
        {(property.options ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    ); // immediate commit
  case 'date':
    return <input type="date" className="saas-input !py-2 text-sm mt-1" value={String(value ?? '')}
      onChange={(e) => setProp(property.id, e.target.value)} />; // immediate commit
  case 'number':
    return <input type="number" className="saas-input !py-2 text-sm mt-1" value={String(value ?? '')}
      onChange={(e) => setProp(property.id, e.target.value === '' ? '' : Number(e.target.value))} />; // blur-commit + 800ms debounce, per UI-SPEC (like InlineTextField)
  // text/url/email/phone -> plain <input type={property.type === 'text' ? 'text' : property.type}>, blur-commit + 800ms debounce
  // person -> clone EmployeeOverrideField's dropdown pattern
  // multi-select -> new chip-toggle component (D-02, no analog — see below)
}
```

**Label row pattern** (`DynamicBlockSettings.tsx` uses `<span className="label-xs">{f.label}</span>` — this maps directly to `records/[clientId]/page.tsx`'s `<p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>` used in `InlineTextField`/`OverrideFieldShell`. Either is valid since `.label-xs` (globals.css) bakes in the same values per UI-SPEC's Typography section — prefer the explicit `<p>` form to match the sibling `records/[clientId]` page exactly, since UI-SPEC says match that page over `DynamicBlockSettings`.

**Blur-commit + 800ms debounce (text-type properties):** clone `InlineTextField` verbatim from `records/[clientId]/page.tsx` lines 672-758 — `draft` state, `lastSavedRef`, `debounceTimer`, `flush()`/`handleChange()`, edit-mode toggle on click, error state `text-[11px] text-red-500`.

**Person property picker:** clone `EmployeeOverrideField` (lines 538-608 of analog) — dropdown popover backed by `useTeam()`, `fixed inset-0 z-20` backdrop-close pattern, `Unassigned` option first, immediate commit on pick (no debounce).

**New pattern — multi-select chip toggle (no existing analog, per CONTEXT.md D-02):** Build as a small new component. Follow the project's existing pill/chip visual conventions (rounded-full, `text-xs font-semibold`, filled `bg-primary-600 text-white` when selected vs. outline `border border-gray-300 text-gray-600` when unselected — inferred from the `primary-*` scale and `saas-*` conventions used everywhere else in this codebase; no literal chip component exists to copy verbatim). Commit immediately on toggle (matches UI-SPEC's "no debounce for discrete value change" rule), value is `string[]` of selected option ids.

---

### `apps/workspaces/src/components/records/AddPropertyModal.tsx` (component, form → two sequential PATCH)

**Analog (modal shell):** `UnlinkConfirmDialog` in `records/[clientId]/page.tsx` (lines 357-389)
```typescript
function UnlinkConfirmDialog({ projectName, onCancel, onConfirm }: {...}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">...</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">...</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="min-h-[48px] px-4 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}
```
Adapt: form fields (name text input, type `<select>` of the 12 supported types, conditional options-list-builder for select/multi-select), submit button uses `primary-600` not `red-600` (non-destructive action).

**Two-sequential-request submit logic (RESEARCH.md Pitfall 1 / UI-SPEC Add-property flow row — CRITICAL, must not be combined):**
```typescript
const handleSubmit = async () => {
  const newProperty: CollectionPropertyDef = { id: uid(), name, type, ...(needsOptions ? { options } : {}) };
  const nextSchema = [...collection.schema, newProperty];
  await updateSchema.mutateAsync(nextSchema); // (1) PATCH /collections/:id — MUST complete first
  await updateRecord.mutateAsync({ props: { ...record.props, [newProperty.id]: initialValueFor(type) } }); // (2) PATCH /records/:id — only after (1) succeeds
};
```
`uid()` import: reuse `apps/workspaces/src/lib/projectPage/blocks.ts`'s existing `uid()` helper (already imported by `records/[clientId]/page.tsx` line 20) rather than adding a new id-generation utility.

---

## Shared Patterns

### Debounce/commit timing convention
**Source:** `InlineTextField` (`records/[clientId]/page.tsx` lines 672-758)
**Apply to:** All text/number/url/email/phone `PropertyField` editors — blur-commit + 800ms debounce-while-typing.
**Apply to (contrast):** checkbox/select/date/person/multi-select `PropertyField` editors — immediate commit on change, no debounce (see `RateOverrideField`/`EmployeeOverrideField` for the immediate-commit reference).

### Error-state copy convention
**Source:** `records/[clientId]/page.tsx` (`text-[11px] text-red-500` inline error, appears after multiple field types) and UI-SPEC Copywriting Contract.
**Apply to:** Every `PropertyField` save failure ("Couldn't save — try again"), body autosave failure ("Couldn't save your changes — try again."), record load failure ("Couldn't load this record." / two-line variant).

### `saas-card` / `saas-input` / `label-xs` utility classes
**Source:** `apps/workspaces/src/app/globals.css` (`.saas-card`, `.saas-input`, `.label-xs`), used throughout `records/[clientId]/page.tsx` and `DynamicBlockSettings.tsx`.
**Apply to:** `PropertyPanel` wrapper (`saas-card`), every `PropertyField` input (`saas-input`), every property label (`label-xs` or the equivalent explicit `<p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">`).

### React Query cache-write convention (no refetch round-trip)
**Source:** `useUpdateClientPage` (`useCrm.ts` lines 99-105) — `onSuccess: (page) => qc.setQueryData(...)`.
**Apply to:** `useUpdateRecord` and `useUpdateCollectionSchema` in the new `useRecords.ts` — critical for CARD-03's "other open records pick up the new schema" requirement (cache write on the shared `qk.collection(id)` key, not an invalidate-and-refetch).

### Auth-gated query enablement
**Source:** every hook in `useCrm.ts` (`enabled: !!user?.company_id && !!id`).
**Apply to:** `useCollection`/`useRecord` in `useRecords.ts` — identical guard clause.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Multi-select chip-toggle sub-component (inside `PropertyField.tsx`) | component | request-response | Confirmed by CONTEXT.md D-02: "no existing analog in the codebase (no chip-toggle component exists yet in `apps/workspaces`)" — build new, following existing `primary-*`/`saas-*` visual conventions inferred from sibling components, not copied verbatim from any one file. |

## Metadata

**Analog search scope:** `apps/workspaces/src/app/records/`, `apps/workspaces/src/app/projects/[id]/pages/[pageId]/`, `apps/workspaces/src/components/miniProgram/`, `apps/workspaces/src/components/projectPage/`, `apps/workspaces/src/lib/api/`, `apps/workspaces/src/lib/hooks/`, `apps/api/src/domains/records/`
**Files scanned:** `records/[clientId]/page.tsx`, `crm.api.ts`, `useCrm.ts`, `DynamicBlockSettings.tsx`, `PageHeader.tsx`, `LivePageCanvas.tsx`, `records.types.ts`, `records.routes.ts`, `client.ts`
**Pattern extraction date:** 2026-07-14
