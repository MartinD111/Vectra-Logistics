# Phase 23: Record Detail Page - Research

**Researched:** 2026-07-14
**Domain:** Next.js/React frontend consuming an existing Express/Postgres records API; reuse of an existing block-based page editor for record bodies
**Confidence:** HIGH

## Summary

Phase 23 is a pure frontend consumer of the Phase 22 `/api/v1/records/*` domain and the Phase 21 block editor — no new backend endpoints, migrations, or npm packages are required. The codebase already contains a near-complete template for exactly this feature: `apps/workspaces/src/app/records/[clientId]/page.tsx` (the CRM client detail page) combines a property-panel sidebar (inline click-to-edit fields, a team-member dropdown picker) with `LivePageCanvas` for a block-editable body, using a seed-once + debounced-autosave React Query pattern. Phase 23 should clone this shape but make the property panel **schema-driven** (iterate `collection.schema`, switch on `property.type`) instead of hardcoded fields — `apps/workspaces/src/components/miniProgram/DynamicBlockSettings.tsx` is the canonical "type → input" switch pattern already in the codebase to copy for this.

Two load-bearing gaps exist in the Phase 22 data model that this research surfaces for planning: (1) `collection_records` has **no `title` column** — the record's displayed title must be sourced from a `props` value, and no property-type or ID convention for "the title property" exists yet in the schema or DTOs; this needs a decision (recommend: convention — the collection's first schema property, or a reserved property id, doubles as the title) before CARD-01 can render a title. (2) The existing route `/records/[clientId]` is already claimed by the CRM client detail page (`crm_clients` domain) — the new generic record detail route MUST use a different path (e.g. `/collections/[collectionId]/records/[recordId]`) to avoid a Next.js route collision.

**Primary recommendation:** Clone `apps/workspaces/src/app/records/[clientId]/page.tsx`'s structure (sidebar property panel + `LivePageCanvas` body, seed-once debounced autosave) at a new route, replace the hardcoded CRM fields with a schema-driven property list (`DynamicBlockSettings`-style type switch), and call `LivePageCanvas` with zero new props/context to satisfy "zero new editor code."

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Record detail page shell (title, layout, new-tab open) | Frontend Server (Next.js page/route) | — | Next.js App Router page under `apps/workspaces/src/app`, mirrors `records/[clientId]/page.tsx` and `projects/[id]/pages/[pageId]/page.tsx` |
| Property panel rendering + type-appropriate inline editors | Browser / Client | — | Client component (`'use client'`), local state per field, mirrors `ClientSidebar`/`DynamicBlockSettings` |
| Schema-driven prop validation (reject unknown/mistyped props) | API / Backend | — | Already implemented: `records.service.ts`'s `validateProps`/`validatePropValue`, invoked on every `PATCH /records/:id` |
| "Add property" → collection schema mutation | API / Backend | Browser / Client | `PATCH /collections/:id` (existing endpoint) owns the write; client triggers it and must re-fetch/refresh the collection before writing a prop value under the new id |
| Record body editor (slash menu, blocks) | Browser / Client | — | `LivePageCanvas` (existing, Phase 21), fed `record.body` as its `config` prop — zero new editor code per CARD-04 |
| Record body persistence | API / Backend | — | `PATCH /records/:id` with `{ body: PageConfig }` — existing endpoint, body passed through unmodified (REC-02) |
| Data persistence (collections/records schema + rows) | Database / Storage | — | Already shipped in migration `025_records_views.sql` (Phase 22) — no new migration expected in Phase 23 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.0.3 (existing) | New record detail route | Matches every other page in `apps/workspaces/src/app` |
| React 18 + `'use client'` | 18 (existing) | Property panel + body editor UI | Existing convention, all interactive components are client components |
| TanStack React Query | 5.99.2 (existing) | Server state for collection/record fetch+mutate | Existing convention (`useProjectPages.ts`, `useCrm.ts`) |
| Zod | 4.3.6 (existing, backend only) | Prop/schema validation | Already wired server-side in `records.service.ts` — no new frontend validation library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.294.0 (existing) | Icons for property-panel type affordances (checkbox, calendar, link, etc.) | Matches every existing panel (PageHeader, ClientSidebar) |
| `@vectra/api-client` (`apiFetch`) | workspace package (existing) | HTTP calls to `/api/v1/records/*` | Existing convention — `crmApi`/`projectsApi` both wrap this |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<input type="date">` for the date property editor | A date-picker library (e.g. `react-datepicker`) | No date-picker dependency exists anywhere in `apps/workspaces/package.json` today; native `<input type="date">` matches the "reuse over rebuild" project constraint and `DynamicBlockSettings`'s all-native-input precedent. Recommend native input; do not add a new dependency for this phase. |
| Building a generic "person picker" from scratch | Reuse the `EmployeeOverrideField`/`ResponsibleEmployeeField` dropdown-list pattern already in `records/[clientId]/page.tsx` (backed by `useTeam()`) | The existing pattern already resolves `person` values against `users`/`team` — clone it rather than inventing a new picker component. |

**Installation:** None — no new packages required for this phase.

**Version verification:** All libraries listed above are already installed and pinned in `apps/workspaces/package.json` / root `package.json` (confirmed via `CLAUDE.md`'s Technology Stack section and direct file reads of `client.ts`, `crm.api.ts`, `useCrm.ts`, `useProjectPages.ts` during this research session — no registry lookups needed since nothing new is being added).

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All dependencies used are already present in the repository's `package-lock.json` from prior phases.

## Architecture Patterns

### System Architecture Diagram

```
Browser click on a record row/card (Phase 24 board, or any future list view)
        │  <Link href="/collections/{collectionId}/records/{recordId}" target="_blank">
        ▼
Next.js page: apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx
        │
        ├─ useCollection(collectionId) ──► GET /api/v1/records/collections/:id ──► recordsService.getCollection
        │        (schema: CollectionPropertyDef[])
        │
        ├─ useRecord(recordId) ──► GET /api/v1/records/records/:id ──► recordsService.getRecord
        │        (props: Record<string, unknown>, body: PageConfig)
        │
        ▼
┌───────────────────────────────┬─────────────────────────────────────────┐
│ PropertyPanel (schema-driven) │ Record body                              │
│ - title (props[titlePropId])  │ LivePageCanvas config={record.body}      │
│ - for each schema property:   │   onChange={setBody} (debounced autosave)│
│   switch(property.type) →     │   — zero new props, reuses Phase 21      │
│   type-appropriate editor     │   block registry verbatim                │
│ - "+ Add property" button     │                                           │
└───────────────────────────────┴─────────────────────────────────────────┘
        │  on field edit                        │ on body edit (debounced)
        ▼                                        ▼
PATCH /api/v1/records/records/:id        PATCH /api/v1/records/records/:id
  { props: { [propId]: value } }           { body: PageConfig }
        │
        ▼ (CARD-03 only: adding a NEW property)
PATCH /api/v1/records/collections/:id
  { schema: [...existing, newPropertyDef] }   ← MUST complete before the
                                                 record's props PATCH that
                                                 sets a value under the new
                                                 property id (server 400s on
                                                 unknown prop id otherwise)
```

### Recommended Project Structure
```
apps/workspaces/src/
├── app/
│   └── collections/
│       └── [collectionId]/
│           └── records/
│               └── [recordId]/
│                   └── page.tsx          # new: record detail page (mirrors records/[clientId]/page.tsx)
├── components/
│   └── records/                          # new folder, parallel to components/projectPage
│       ├── PropertyPanel.tsx             # schema-driven property list + "+ Add property"
│       ├── PropertyField.tsx             # type → input switch (mirrors DynamicBlockSettings.tsx)
│       └── AddPropertyModal.tsx          # name + type (+ options, for select/multi-select) picker
├── lib/
│   ├── api/
│   │   └── records.api.ts                # new: apiFetch wrappers over /api/v1/records/*
│   └── hooks/
│       └── useRecords.ts                 # new: useCollection/useRecord/useUpdateRecord/useUpdateCollectionSchema
```

### Pattern 1: Seed-once + debounced autosave for the body editor
**What:** On first successful fetch, seed local `PageConfig` state once (`seeded` flag + a ref snapshot to distinguish the seeding render from a user edit); every subsequent change schedules a 1500ms debounced `PATCH`; an unmount-time effect flushes any pending dirty state.
**When to use:** Any `LivePageCanvas`-backed editor (project pages, client pages, and now record bodies) — this is the established, load-bearing pattern; do not re-derive it.
**Example:**
```typescript
// Source: apps/workspaces/src/app/records/[clientId]/page.tsx (existing, verbatim pattern to clone)
const [config, setConfig] = useState<PageConfig>(emptyPageConfig());
const [seeded, setSeeded] = useState(false);
const seededConfigRef = useRef<PageConfig | null>(null);
const dirtyRef = useRef(false);
const configRef = useRef(config);
configRef.current = config;

if (!seeded && record) {
  const initial = isPageConfig(record.body) ? record.body as PageConfig : emptyPageConfig();
  seededConfigRef.current = initial;
  setConfig(initial);
  setSeeded(true);
}

useEffect(() => {
  if (!seeded || config === seededConfigRef.current) return;
  dirtyRef.current = true;
  const t = setTimeout(() => {
    dirtyRef.current = false;
    updateRecord.mutate({ body: config as unknown as Record<string, unknown> });
  }, 1500);
  return () => clearTimeout(t);
}, [config, seeded]);
```

### Pattern 2: Type-driven property editor (mirrors `DynamicBlockSettings.tsx`)
**What:** A single component that switches on `CollectionPropertyDef['type']` and renders the matching input, bound to `record.props[property.id]`, committing via the same `PATCH /records/:id` mutation for every type.
**When to use:** CARD-02's "type-appropriate inline editors."
**Example:**
```typescript
// Source: apps/workspaces/src/components/miniProgram/DynamicBlockSettings.tsx (existing pattern, adapt property.type → input)
switch (property.type) {
  case 'checkbox': return <input type="checkbox" checked={!!value} onChange={(e) => setProp(property.id, e.target.checked)} />;
  case 'date': return <input type="date" value={String(value ?? '')} onChange={(e) => setProp(property.id, e.target.value)} />;
  case 'select': return <select value={String(value ?? '')} onChange={(e) => setProp(property.id, e.target.value)}>
      {(property.options as {id:string;label:string}[] ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>;
  case 'person': /* clone EmployeeOverrideField's team-dropdown pattern, store user id */
  // number/text/url/email/phone -> plain <input>; multi-select/files/relation -> string[] editors
}
```

### Pattern 3: Record body reuses `LivePageCanvas` with zero new props
**What:** `LivePageCanvas` already accepts `config`/`onChange` plus *optional* `projectId`/`clientId`/`pageId` context props that are only consumed by specific blocks (e.g. `SubPageBlock` needs `projectId`, and gracefully renders a disabled state without it — see `SubPageBlock.tsx` lines 34/72). Records have no project/page context by default, so the record body call site should be `<LivePageCanvas config={record.body} onChange={setBody} />` with no new props threaded through — any block that needs project/page context (sub-page links) will show its existing "not available here" fallback, which is expected, not a bug.
**When to use:** Satisfying CARD-04's "zero new editor code" literally.

### Anti-Patterns to Avoid
- **Building a second slash-menu/block-editor for record bodies:** `LivePageCanvas` + `PAGE_BLOCK_REGISTRY` already do this — the record body is just another `PageConfig` consumer per `workspace-blocks.md` §4's explicit design intent.
- **Client-side re-deriving of "is this prop valid for this type":** the backend already owns and enforces this (`records.service.ts`'s `validatePropValue`) — the frontend should surface the resulting `AppError(400, ...)` message on save failure, not duplicate the type-check logic pre-emptively (though light client-side guards for UX, e.g. disabling save on empty required fields, are fine).
- **Setting a new property's value in the same request as the schema-add:** the server validates `props` against the collection's *currently stored* schema (see Pitfall 1 below) — sequencing matters.
- **Reusing `/records/[clientId]` as the new record detail route:** already claimed by the CRM client detail page; a naming collision here would break either that route's matcher or the new one's.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slash-menu / rich block body editor | A new "card body" editor | `LivePageCanvas` + `PAGE_BLOCK_REGISTRY` (Phase 21) | Explicit CARD-04 requirement and `workspace-blocks.md` §4/§10 "Don't build a second editor for card detail" |
| Prop-type validation | Frontend Zod schemas duplicating the backend's type rules | Trust `records.service.ts`'s `validateProps`/`validatePropValue`; surface its 400 error message | Single source of truth already exists server-side; duplicating risks drift |
| Team-member / assignee picker for `person` properties | A new picker component | Clone `EmployeeOverrideField`'s dropdown pattern (backed by `useTeam()`) from `records/[clientId]/page.tsx` | Already resolves ids ↔ display names against the real `users`/team data |
| Debounced autosave plumbing | A new autosave hook/library | Clone the seed-once + `setTimeout`(1500) + unmount-flush pattern from `projects/[id]/pages/[pageId]/page.tsx` / `records/[clientId]/page.tsx` | Proven pattern, handles the "flush on navigate away" edge case already |

**Key insight:** Every structural piece Phase 23 needs (schema-driven settings UI, block-body editor, debounced autosave, person picker, inline click-to-edit fields) already exists in the codebase in a directly analogous form. This phase is almost entirely composition, not invention.

## Common Pitfalls

### Pitfall 1: Schema-add and prop-value-set must not be combined into one request
**What goes wrong:** If the client sends `PATCH /records/:id` with a `props` value for a property id that isn't yet in the collection's `schema`, `records.service.ts`'s `validateProps` throws `AppError(400, 'Unknown property: <id>')` — even if the client is "about to" add that property.
**Why it happens:** `updateRecord` re-fetches the *current* `collection.schema` from the DB on every call and validates strictly against it (`records.service.ts` lines 82-85); there is no single "create-property-and-set-value" endpoint.
**How to avoid:** CARD-03's "add a new property" flow must be two sequential calls: (1) `PATCH /collections/:id` with the schema array including the new `CollectionPropertyDef`, awaited to success; (2) only then `PATCH /records/:id` with `props: { [newPropId]: initialValue }`. Also invalidate/refetch the collection query after step 1 so other open records of the same collection pick up the new schema (per CARD-03's "appears on other records" requirement — this is a React Query cache-invalidation concern, not a new backend feature).
**Warning signs:** A 400 error immediately after clicking "Add property" and typing a value in the same interaction.

### Pitfall 2: No `title` field exists on `collection_records` — title source is undecided
**What goes wrong:** CARD-01 requires "showing its title," but `CollectionRecordRow` (`records.types.ts`) has only `props`/`body`/`sort_order` — no `title` column, and no DTO enforces a reserved title property id or type.
**Why it happens:** The Phase 22 schema (locked, per `workspace-blocks.md` §3.3) deliberately keeps everything generic — "status/carrier/shipment are tenant data, never platform types" — so a hardcoded `title` column was not added.
**How to avoid:** This is a decision Phase 23 planning must make explicitly (flag for `/gsd:discuss-phase` or lock as a Claude's-discretion call): recommend treating the collection's **first schema property** (by array order) as the title property by convention, rendered as a larger heading input above the rest of the panel, OR reserve a well-known property id (e.g. `"title"`) that `createCollectionWithDefaultView`-adjacent UI always creates first. Either approach requires zero backend changes (both fit inside the existing generic `schema`/`props` shape) but must be picked before implementation. Do not invent a third convention silently — surface it in `23-CONTEXT.md`/the plan's `## Assumptions Log`.
**Warning signs:** Ambiguity in the plan about which `props` key renders as `<h1>`.

### Pitfall 3: Route collision with the existing CRM `/records/[clientId]` page
**What goes wrong:** `apps/workspaces/src/app/records/[clientId]/page.tsx` already owns the `/records/:id` route for CRM clients (entirely unrelated to the new `data_collections`/`collection_records` engine, despite the similar name). A new record detail page must not be placed at `/records/[id]` — Next.js would either collide or silently ambiguate resolution against the existing dynamic segment.
**Why it happens:** Both features use the word "record(s)" — CRM "Records" (client list) predates and is unrelated to the new Records+Views engine (`data_collections`) from this milestone.
**How to avoid:** Use a distinct path segment, e.g. `/collections/[collectionId]/records/[recordId]` (recommended — mirrors `projects/[id]/pages/[pageId]`'s nested-resource shape and disambiguates which "records" is meant).
**Warning signs:** Next.js dev server warnings about duplicate/overlapping dynamic routes, or the CRM client page breaking after this phase ships.

### Pitfall 4: `select`/`multi-select` property `options` are not schema-enforced
**What goes wrong:** `CollectionPropertyDef` uses `.catchall(z.unknown())` in the Zod DTO, meaning a `select`/`multi-select` property's `options` (the actual dropdown choices) are never validated or required by the backend — a property could be created with `type: 'select'` and no `options` array at all.
**Why it happens:** Deliberate genericity per `workspace-blocks.md` — "generic JSON for anything variable."
**How to avoid:** The "+ Add property" UI (CARD-03) must itself collect and write an `options: [{id, label}]` array (or similar) into the property def's catchall fields when the chosen type is `select`/`multi-select`, since nothing else will. Document this as a UI-owned convention, not a backend contract.
**Warning signs:** A select property renders with an empty dropdown because `options` was never set.

## Code Examples

### Fetching a record + its collection (new `records.api.ts`, follow `crm.api.ts`'s shape)
```typescript
// Pattern source: apps/workspaces/src/lib/api/crm.api.ts
import { apiFetch } from './client';

export interface CollectionPropertyDef {
  id: string; name: string;
  type: 'text'|'number'|'date'|'select'|'multi-select'|'checkbox'|'person'|'url'|'email'|'phone'|'files'|'relation';
  options?: { id: string; label: string }[]; // UI-owned convention for select/multi-select
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
  getCollection: (id: string) => apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`).then(r => r.collection),
  updateCollection: (id: string, data: { schema?: CollectionPropertyDef[]; name?: string }) =>
    apiFetch<{ collection: DataCollection }>(`${BASE}/collections/${id}`, 'PATCH', data).then(r => r.collection),
  getRecord: (id: string) => apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`).then(r => r.record),
  updateRecord: (id: string, data: { props?: Record<string, unknown>; body?: Record<string, unknown> }) =>
    apiFetch<{ record: CollectionRecord }>(`${BASE}/records/${id}`, 'PATCH', data).then(r => r.record),
};
```

### React Query hooks (new `useRecords.ts`, follow `useCrm.ts`'s shape)
```typescript
// Pattern source: apps/workspaces/src/lib/hooks/useCrm.ts
const qk = {
  collection: (id: string) => ['records-collection', id] as const,
  record: (id: string) => ['records-record', id] as const,
};

export function useCollection(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.collection(id), queryFn: () => recordsApi.getCollection(id), enabled: !!user?.company_id && !!id });
}

export function useUpdateCollectionSchema(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schema: CollectionPropertyDef[]) => recordsApi.updateCollection(id, { schema }),
    onSuccess: (collection) => qc.setQueryData(qk.collection(id), collection), // other open records refetch via this cache entry
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Kanban cards as `{id, text}` strings in page JSON (`KanbanBlock`) | Records with typed `props` + `PageConfig` `body` in a dedicated `collection_records` table | Phase 22 (2026-07-14) | Phase 23 is the first UI to read/write this new table via `/api/v1/records/*` — nothing in the frontend consumes it yet |
| N/A — no prior "record detail" surface existed | This phase | — | Establishes the pattern Phase 24's board "click card" and later view types will reuse |

**Deprecated/outdated:** None — this is new-build, not a replacement of an existing UI surface.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The record's title should be sourced from a `props` value via a convention (first schema property, or a reserved `"title"` property id) rather than a new `title` column | Common Pitfalls #2 | If the actual decision is "add a `title` column to `collection_records`," that requires a new migration and DTO/service changes outside this phase's originally-scoped "pure frontend" footprint — must be confirmed with the user/CONTEXT before planning locks it in |
| A2 | The new record detail route should be `/collections/[collectionId]/records/[recordId]` | Common Pitfalls #3 | Low risk — any non-colliding path works; this is a naming recommendation, not a hard requirement, but *some* distinct path is mandatory |
| A3 | `select`/`multi-select` property `options` should be stored as `{id, label}[]` in the property def's catchall fields, written by the "+ Add property" UI | Common Pitfalls #4 | If a different shape is chosen (e.g. plain `string[]`), it only affects this phase's own new code (no existing consumer to conflict with) — low risk, but should be locked once so Phase 24/25/26 (which will also need to read `select` options for board columns) don't have to guess |
| A4 | No new npm packages (e.g. date-picker) are needed; native `<input type="date">`/`<select>` suffice for CARD-02 | Standard Stack | Low risk — purely a UX polish tradeoff, easily upgraded later without data-model impact |

## Open Questions (RESOLVED)

1. **What determines a record's title?**
   - What we know: `collection_records` has no `title` column (confirmed by reading `records.types.ts` and migration `025_records_views.sql`); `workspace-blocks.md` §4 says "Top: editable **title**" but does not specify the storage mechanism.
   - What's unclear: Whether the intended design is (a) a props-based convention (this research's recommendation, A1), or (b) an intentionally-deferred gap the user wants closed with a schema change in this phase.
   - Recommendation: Surface explicitly in `/gsd:discuss-phase 23` or as a locked decision in the plan before implementation; default to "first schema property is the title" if no user input is given, since it requires zero backend changes and matches Notion's actual behavior (title is just the first/primary text property).
   - **Resolved via CONTEXT.md D-01:** the collection's first schema property (by array order) is the title, rendered as the inline-editable `text-xl font-bold` heading. No backend changes.

2. **Side-peek panel vs. full page?**
   - What we know: `workspace-blocks.md` §4 says "Click a card → it opens (side-peek panel and/or full page). Same component for both; the peek is just a smaller frame." ROADMAP's Phase 23 success criteria says "detail page/panel" (either).
   - What's unclear: Whether Phase 23 should build only the full-page route (simpler, matches CLAUDE.md's "opened in a new tab" cross-app-link convention used for CRM clients) or also a side-peek modal variant.
   - Recommendation: Build the full-page route only for Phase 23 (matches CARD-01's literal wording "opens a record as a detail page/panel" — a page satisfies this) since it directly mirrors the proven `records/[clientId]` and `pages/[pageId]` patterns; a side-peek panel can be layered on later without any data-model change (it would just render the same component in a modal frame, per the spec's own note that "same component for both" is intended).
   - **Resolved via 23-UI-SPEC.md's Layout & Interaction Contract:** "Page shape: Full page only (not a side-peek modal) this phase." Full-page route locked, no modal variant this phase.

3. **Where does a record get its "click to open" entry point in Phase 23, given Phase 24 (board) doesn't exist yet?**
   - What we know: Phase 24 (board view) is what will actually render `collection_records` as clickable cards; Phase 23 has no collection-listing UI of its own (no requirement for one — CARD-01..04 only cover the detail page itself).
   - What's unclear: Whether Phase 23 needs a minimal temporary entry point (e.g. a bare list of records) purely to make the detail page reachable/testable before Phase 24 ships, or whether it's acceptable to verify the page by direct URL navigation only.
   - Recommendation: Treat this as a testability/verification concern, not a requirement gap — CARD-01..04 describe the detail page's own behavior, not how a user discovers it. Recommend the plan include a minimal "record list" scratch view or rely on direct-URL + automated test verification, and explicitly not scope-creep into building collection list/board UI (that's Phase 24+).
   - **Resolved via CONTEXT.md's Claude's Discretion note:** left to planner's discretion; Plan 02 relies on direct-URL navigation with test data created via `recordsApi.createRecord`/existing `POST /collections` endpoints (curl or scratch script) — no collection-list/board scratch UI built, per CONTEXT.md's explicit scope boundary.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (backend, existing) — no frontend test framework detected in `apps/workspaces` |
| Config file | none — backend uses `node --require ts-node/register --test` per `records.repository.test.ts`/`records.service.test.ts` (Phase 22 precedent) |
| Quick run command | `npm --prefix apps/api test` (backend only — confirms no regressions if any API changes are made, though none are expected this phase) |
| Full suite command | `npm --prefix apps/api test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD-01 | Opening a record shows title + property panel + body | manual/UI | — (no frontend test framework in this repo) | N/A — human/manual verification, consistent with Phase 21's UI-hint phases |
| CARD-02 | Editing a property persists | manual/UI + backend contract | `npm --prefix apps/api test` (confirms `PATCH /records/:id` prop validation still passes) | ✅ existing (`records.service.test.ts`) |
| CARD-03 | Adding a property updates collection schema, visible on other records | manual/UI + backend contract | `npm --prefix apps/api test` (confirms `PATCH /collections/:id` schema update still passes) | ✅ existing (`records.service.test.ts`) |
| CARD-04 | Record body uses the full existing editor | manual/UI (visual/functional check that slash menu, headings, checklists work inside a record body) | — | N/A — no frontend test framework |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit -p apps/api/tsconfig.json` if any backend file is touched (unlikely this phase); otherwise none — frontend has no `tsc`/test gate configured beyond Next.js's own build-time type-check.
- **Per wave merge:** `npm --prefix apps/api test` (only relevant if backend touched)
- **Phase gate:** Manual UI verification (per `workspace-blocks.md`'s own acceptance framing and this repo's established pattern of `UI hint: yes` phases relying on human verification for frontend-only work — see Phase 21's `21-VERIFICATION.md` for precedent) plus `npx tsc --noEmit -p apps/workspaces/tsconfig.json` if it exists, else Next.js build (`npm --prefix apps/workspaces run build`) as the closest automated gate.

### Wave 0 Gaps
- No frontend test framework (Jest/Vitest/Playwright) exists in `apps/workspaces` — this is a pre-existing gap across the whole app, not specific to this phase. Recommend the plan rely on `tsc`/Next.js build + manual verification, consistent with every prior frontend-only phase in this codebase (Phase 21, the CRM phases).
- None — existing backend test infrastructure (Phase 22's `records.service.test.ts`/`records.repository.test.ts`) already covers every backend contract this phase depends on; no new backend tests expected since no backend code changes are anticipated.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `authenticateToken` middleware already applied to all `/api/v1/records/*` routes (`records.routes.ts` line 10) — no new auth surface introduced |
| V3 Session Management | no | Unaffected — no new session handling in this phase |
| V4 Access Control | yes (inherited) | `requireCompany`/`company_id` scoping already enforced end-to-end in `records.repository.ts`/`records.service.ts` (verified in Phase 22 verification) — Phase 23 must not bypass this by, e.g., caching cross-company data client-side without re-validating on fetch |
| V5 Input Validation | yes | Server-side: existing Zod schemas (`UpdateRecordSchema`, `UpdateCollectionSchema`) already validate every write this phase will trigger; no new validation needed. Client-side: property-panel inputs should apply basic HTML5 input types (`type="date"`, `type="number"`, `type="email"`) as UX guards only — never the sole validation layer |
| V6 Cryptography | no | No new secrets/crypto surface in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant record access via a guessed/shared record ID in the new route's URL | Information Disclosure | Already mitigated server-side — `recordsRepository.findRecord`/`findCollection` filter by `company_id` (verified in Phase 22); the frontend must render the resulting 404 (record not found) rather than assume any ID it's given is valid, mirroring `ClientDetailPage`'s `clientError`/`!client` fallback UI |
| Reflected/stored XSS via record body rich text | Tampering | Already mitigated — `LivePageCanvas`/`EditableRichText` already run all HTML through DOMPurify on write and read (Phase 21 precedent); no new sanitization needed since the body is opaque `PageConfig` JSON reusing the same blocks |
| Prop-type confusion (client sends a string where a `checkbox` boolean is expected, etc.) | Tampering | Already mitigated server-side by `validatePropValue`'s switch-based type check; client should still send correctly-typed JS values (not stringified booleans/numbers) to avoid spurious 400s, not for security but for UX correctness |

## Sources

### Primary (HIGH confidence)
- Direct file reads (this session): `apps/api/src/domains/records/records.types.ts`, `records.service.ts`, `records.controller.ts`, `records.routes.ts`, `dto/*.dto.ts`, `database/migrations/025_records_views.sql` — full Phase 22 API contract
- Direct file reads: `apps/workspaces/src/app/records/[clientId]/page.tsx`, `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx`, `LivePageCanvas.tsx`, `PageHeader.tsx`, `SubPageBlock.tsx`, `PageView.tsx` — the existing detail-page and block-editor patterns to clone
- Direct file reads: `apps/workspaces/src/lib/hooks/useCrm.ts`, `useProjectPages.ts`, `apps/workspaces/src/lib/api/crm.api.ts`, `client.ts` — React Query + API client conventions
- Direct file read: `apps/workspaces/src/components/miniProgram/DynamicBlockSettings.tsx` — the generic type-switch settings-panel pattern
- `docs/specs/core/workspace-blocks.md` §3-4, §10 — the locked design spec this phase implements against (record = page, body reuses editor, generic property types)
- `.planning/phases/22-records-views-data-model/22-VERIFICATION.md` — confirms all REC-01..04 backend contracts this phase depends on are shipped and tested (4/4 verified, 102/102 API tests passing)
- `.planning/phases/21-missing-content-blocks/21-*-SUMMARY.md` (all 5 plans) — confirms the block registry Phase 23's body editor reuses is complete (checklist, toggle, quote, code, media, table, columns, sub-page, mention)

### Secondary (MEDIUM confidence)
None — all findings in this research were verified directly against source files in this repository during this session; no external/web sources were needed since this phase's entire scope is internal composition of already-shipped code.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies; every library cited is already pinned and in active use elsewhere in this exact app
- Architecture: HIGH - directly cloned from two working, shipped analogs (`records/[clientId]/page.tsx`, `projects/[id]/pages/[pageId]/page.tsx`) plus the locked `workspace-blocks.md` spec
- Pitfalls: HIGH - all four pitfalls derived from direct code-reading of the actual Phase 22 service/DTO logic (`validateProps` ordering, missing `title` column, existing `/records/[clientId]` route, catchall `options` gap), not speculation

**Research date:** 2026-07-14
**Valid until:** 30 days (stable internal codebase, no external API drift risk since this phase adds no new external dependencies)
