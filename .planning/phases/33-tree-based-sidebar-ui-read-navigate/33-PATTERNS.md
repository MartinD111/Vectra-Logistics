# Phase 33: Tree-Based Sidebar UI (Read + Navigate) - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 9 (new: 7, modified: 2)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/workspaces/src/lib/api/folders.api.ts` (MODIFY — add `getFullTree`) | service (API client module) | request-response | same file, `foldersApi.tree()` (lines 21-22) | exact |
| `apps/workspaces/src/lib/hooks/useFolders.ts` (MODIFY — add `useFullTree`) | hook | request-response (cached read) | same file, `useFolderTree()` (lines 11-19) | exact |
| `apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts` (NEW) | hook | event-driven (local UI state) | `apps/cmr/src/app/page.tsx` localStorage boolean flag pattern | role-match (different domain, same persistence idiom) |
| `apps/workspaces/src/components/tree/treeFilters.ts` (NEW) | utility (pure transform) | transform | `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` `ITEMS.filter(...)` (lines 48-58) | role-match |
| `apps/workspaces/src/components/tree/treeNodeUrl.ts` (NEW) | utility | transform | none directly; inferred from existing route conventions (`/projects/:id`, `/programs/:id`, `/collections/:id`, `/projects/:id/pages/:pageId`) | no-analog (routing table is new but routes themselves are existing) |
| `apps/workspaces/src/components/tree/TreeNodeRow.tsx` (NEW) | component (recursive) | request-response (navigation) | `WorkspaceSidebar.tsx` `renderItem` (lines 63-83) | role-match |
| `apps/workspaces/src/components/tree/TreeSection.tsx` (NEW) | component | request-response | `WorkspaceSidebar.tsx` full component structure (lines 44-104), esp. `ALWAYS_BOTTOM` section wrapper (lines 97-99) | role-match |
| `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` (MODIFY — insert `<TreeSection />`) | component | request-response | itself (baseline) | exact |
| `apps/workspaces/src/components/shared/Breadcrumbs.tsx` (NEW) | component | transform (derive ancestor chain from cached tree) | back-link blocks in `projects/[id]/page.tsx` (lines 117-119) and `projects/[id]/pages/[pageId]/page.tsx` (lines 108-121) | role-match (closest existing "ancestor nav" idiom, single-level only) |
| `apps/workspaces/src/app/projects/[id]/page.tsx` (MODIFY — insert Breadcrumbs) | component (page) | request-response | itself (baseline) | exact |
| `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` (MODIFY — insert Breadcrumbs) | component (page) | request-response | itself (baseline) | exact |
| `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` (MODIFY — insert Breadcrumbs, no back-link exists today) | component (page) | request-response | `projects/[id]/pages/[pageId]/page.tsx`'s breadcrumb-style header block (lines 108-121) — closest "insert new ancestor nav where none exists" precedent | role-match |

## Pattern Assignments

### `apps/workspaces/src/lib/api/folders.api.ts` (service, request-response)

**Analog:** same file — extend existing `foldersApi` object, do not create a parallel module (CLAUDE.md: "API module files export interfaces + fetch functions").

**Existing pattern to copy from (full file, `apps/workspaces/src/lib/api/folders.api.ts` lines 1-31):**
```typescript
import { apiFetch } from './client';

export interface Folder {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FolderTree extends Folder {
  children: FolderTree[];
}

const BASE = '/api/v1/folders';

export const foldersApi = {
  tree: () => apiFetch<{ folders: FolderTree[] }>(BASE).then((r) => r.folders),
  get: (id: string) => apiFetch<{ folder: Folder }>(`${BASE}/${id}`).then((r) => r.folder),
  create: (data: { name: string; parent_id?: string | null; icon?: string | null; color?: string | null }) =>
    apiFetch<{ folder: Folder }>(BASE, 'POST', data).then((r) => r.folder),
  update: (id: string, data: Partial<{ name: string; icon: string | null; color: string | null }>) =>
    apiFetch<{ folder: Folder }>(`${BASE}/${id}`, 'PATCH', data).then((r) => r.folder),
  move: (id: string, parentId: string | null) =>
    apiFetch<{ folder: Folder }>(`${BASE}/${id}/move`, 'PATCH', { parent_id: parentId }).then((r) => r.folder),
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),
};
```

**Apply as:** Add a `TreeNode` interface (must mirror the backend discriminated union in `apps/api/src/domains/folders/folders.types.ts` lines 31-38 exactly — do NOT reuse/extend `FolderTree`, per RESEARCH.md Pitfall 3) and a `getFullTree` fetch function using the same `apiFetch<...>(url).then((r) => r.X)` idiom, targeting `/api/v1/folders/tree/full`:
```typescript
export interface TreeNode {
  node_type: 'folder' | 'project' | 'program' | 'data_collection' | 'project_page';
  id: string;
  company_id: string;
  name: string;
  children: TreeNode[];
  raw: Record<string, unknown>; // narrow further per node_type if needed at call sites
}

export const foldersApi = {
  // ...existing entries unchanged...
  getFullTree: () => apiFetch<{ tree: TreeNode[] }>(`${BASE}/tree/full`).then((r) => r.tree),
};
```
(Confirm the actual response envelope key by checking `apps/api/src/domains/folders/folders.controller.ts`'s `getFullTree` handler response shape before finalizing — the wrapper key may be `tree` or `nodes`; do not guess without checking.)

---

### `apps/workspaces/src/lib/hooks/useFolders.ts` (hook, request-response)

**Analog:** same file, `useFolderTree()` (lines 11-19).

**Existing pattern to copy from:**
```typescript
const qk = {
  folders: ['folders'] as const,
};

export function useFolderTree() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.folders,
    queryFn: foldersApi.tree,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
  });
}
```

**Apply as:** Add a **new**, separate query key and hook — do not reuse `qk.folders` (RESEARCH.md is explicit: `useFullTree()` must be a distinct hook/key from `useFolderTree()`, which stays wired to `Navbar.tsx`'s folders-only endpoint):
```typescript
const qk = {
  folders: ['folders'] as const,
  fullTree: ['folders', 'tree', 'full'] as const,
};

export function useFullTree() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.fullTree,
    queryFn: foldersApi.getFullTree,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
  });
}
```
This query key (`['folders','tree','full']`) is the shared cache key referenced by both `TreeSection` and `Breadcrumbs` per RESEARCH.md's architecture diagram — both consumers must call `useFullTree()` (not duplicate the `useQuery` call inline) so React Query dedupes the network request.

---

### `apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts` (hook, event-driven local state)

**Analog:** `apps/cmr/src/app/page.tsx` line 11 — `localStorage.getItem('hide_cmr_onboarding')`, the only other localStorage-flag idiom in the monorepo's frontend apps. No per-user-keyed localStorage precedent exists yet; RESEARCH.md's Pattern 2 (already fully worked out, safe to use verbatim) is the concrete implementation:

```typescript
// apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts
'use client';
import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

function storageKey(userId: string | undefined) {
  return `vectra_tree_expanded_${userId ?? 'anon'}`;
}

export function useExpandedTreeNodes() {
  const { user } = useAuth();
  const key = storageKey(user?.id);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { window.localStorage.setItem(key, JSON.stringify([...next])); } catch { /* quota/SSR — ignore */ }
      return next;
    });
  }, [key]);

  return { expanded, toggle };
}
```
Note: confirm `useAuth()`'s `user` object actually exposes `.id` (re-exported from `@vectra/auth`'s `AuthContext.tsx` — verify field name against `packages/auth/src/AuthContext.tsx` at implementation time; other hooks in this codebase reference `user?.company_id`, so the exact id field name should be double-checked, not assumed).

---

### `apps/workspaces/src/components/tree/treeFilters.ts` (utility, transform)

**Analog:** `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` lines 48-58 — the existing single-pass `enabled_modules` Set-filter is the direct precedent for "filter once at the top, before render, never duplicate the check inline."

**Existing pattern to copy from:**
```typescript
const enabled = new Set(workspace?.enabled_modules ?? []);
const seen = new Set<string>();
const visible = ITEMS.filter((it) => {
  if (it.module && !enabled.has(it.module)) return false;
  if (seen.has(it.href + it.name)) return false;
  seen.add(it.href + it.name);
  return true;
});
```

**Apply as:** RESEARCH.md's `pruneTree`/`isArchived` implementation (Pattern 1) is the fully-specified recursive extension of this same idiom — reproduce it verbatim:
```typescript
// apps/workspaces/src/components/tree/treeFilters.ts
import type { TreeNode } from '@/lib/api/folders.api';

const MODULE_KEY: Partial<Record<TreeNode['node_type'], string>> = {
  data_collection: 'records',
  project_page: 'records',
  program: 'programs',
};

function isArchived(node: TreeNode): boolean {
  if (node.node_type !== 'data_collection' && node.node_type !== 'project_page') return false;
  const raw = node.raw as { archived_at: string | null };
  return raw.archived_at != null;
}

export function pruneTree(nodes: TreeNode[], enabledModules: Set<string>): TreeNode[] {
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (isArchived(node)) return acc;
    const moduleKey = MODULE_KEY[node.node_type];
    if (moduleKey && !enabledModules.has(moduleKey)) return acc;

    const children = pruneTree(node.children, enabledModules);
    if (node.node_type === 'folder' && node.children.length > 0 && children.length === 0) {
      return acc;
    }
    acc.push({ ...node, children });
    return acc;
  }, []);
}
```

---

### `apps/workspaces/src/components/tree/treeNodeUrl.ts` (utility, transform)

**No direct analog file** — this is a new small routing table. Base it on the existing, already-live route paths referenced across the codebase (verified, not invented):
- Project detail: `/projects/${id}` (used in `WorkspaceSidebar.tsx` is N/A, but confirmed in `projects/[id]/page.tsx` itself and `pages/[pageId]/page.tsx` line 110's `Link href={\`/projects/${projectId}\`}`)
- Project page detail: `/projects/${projectId}/pages/${pageId}` (confirmed `pages/[pageId]/page.tsx` line 116)
- Record/collection: `/collections/${collectionId}/records/${recordId}` (confirmed by the file path itself, `app/collections/[collectionId]/records/[recordId]/page.tsx`)
- Program: `/programs/${id}` (per RESEARCH.md's Anti-Patterns section; verify existence of a `programs/[id]/page.tsx` route at implementation time)
- Folder: no navigation (RESEARCH.md Open Question 2, recommendation (b) — folder rows toggle expand/collapse only, no href)

```typescript
// apps/workspaces/src/components/tree/treeNodeUrl.ts
import type { TreeNode } from '@/lib/api/folders.api';

export function treeNodeUrl(node: TreeNode): string | null {
  switch (node.node_type) {
    case 'project':
      return `/projects/${node.id}`;
    case 'program':
      return `/programs/${node.id}`;
    case 'project_page': {
      const raw = node.raw as { project_id: string };
      return `/projects/${raw.project_id}/pages/${node.id}`;
    }
    case 'data_collection':
      return `/collections/${node.id}`;
    case 'folder':
      return null; // folders have no detail page — expand/collapse only
  }
}
```

---

### `apps/workspaces/src/components/tree/TreeNodeRow.tsx` (component, recursive)

**Analog:** `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` `renderItem` (lines 63-83) — the exact `active` class-toggle idiom and `Link` vs `a`-tag branching pattern to reuse.

**Existing pattern to copy from:**
```typescript
const renderItem = (it: SidebarItem) => {
  const Icon = it.icon;
  const active = !it.external && isActive(it.href);
  const cls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
  }`;
  if (it.external) {
    return (
      <a key={it.name} href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>
        <Icon className="w-4 h-4 flex-shrink-0" /> {it.name}
      </a>
    );
  }
  return (
    <Link key={it.name} href={it.href} className={cls}>
      <Icon className="w-4 h-4 flex-shrink-0" /> {it.name}
    </Link>
  );
};
```

**Apply as:** `TreeNodeRow` extends this with (a) recursive self-render for `node.children`, (b) a `ChevronRight` toggle button (per UI-SPEC: `transition-transform duration-150`, rotated 90° when expanded — not a `ChevronDown` swap) as a separate click target from the label/Link when the node has children, (c) cumulative `pl-4` per depth level (per UI-SPEC spacing contract), (d) icon selection by `node_type` per UI-SPEC's table (`Folder`, `FolderKanban`, `Zap`, `Boxes`, `FileText` from `lucide-react` — same import source already used in `WorkspaceSidebar.tsx`), (e) icon color `text-gray-400 dark:text-gray-500` at rest (deliberately subtler than fixed-nav icons per UI-SPEC). Active-row and hover classes are copied verbatim from the `cls` template above — do not introduce new color values.

---

### `apps/workspaces/src/components/tree/TreeSection.tsx` (component)

**Analog:** `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` lines 44-104 — the whole component's structure (state derivation → filter → render) and specifically the `ALWAYS_BOTTOM` wrapper's border-separator idiom (lines 97-99), reused per D-10 for the new section heading:

```typescript
<div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border space-y-1">
  {ALWAYS_BOTTOM.map(renderItem)}
</div>
```

**Apply as:** `TreeSection` fetches `useFullTree()`, runs `pruneTree(data, enabled)`, and if the pruned result is empty renders nothing (UI-SPEC's empty-state contract: "Hide the entire `TreeSection` including its heading"). On query error, render the inline text row spec'd in UI-SPEC ("Couldn't load workspace folders." in `text-sm text-gray-400 dark:text-gray-500`, no retry button). Section heading label "Workspace" uses the `text-xs font-semibold uppercase tracking-wider` idiom confirmed live at `apps/workspaces/src/app/company/[id]/page.tsx:164` (`<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>`).

---

### `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` (MODIFY)

**Analog:** itself. Insert `<TreeSection />` between `<nav className="space-y-1">{visible.map(renderItem)}</nav>` and the `<div className="flex-1" />` spacer (i.e. directly after line 95, before line 96), per D-09/RESEARCH.md's system architecture diagram (tree section sits between fixed `ITEMS` and `ALWAYS_BOTTOM`). `ITEMS`, `ALWAYS_BOTTOM`, `renderItem`, and the `enabled`/`visible` filtering logic (lines 26-58) stay untouched — do not restructure existing code, only add the new import and JSX insertion point.

---

### `apps/workspaces/src/components/shared/Breadcrumbs.tsx` (component, transform)

**Analog:** the two existing single-level ancestor-link blocks — `projects/[id]/page.tsx` lines 117-119 (single `← Projects` link) and `pages/[pageId]/page.tsx` lines 108-121 (two-level: `Project` link + conditional `parent.title` link, using a plain `<span className="text-gray-300">/</span>` separator). These are the closest existing "breadcrumb-shaped" code in the repo, though neither is a generic/reusable component.

**Existing pattern to copy from (`pages/[pageId]/page.tsx` lines 108-121):**
```typescript
<div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
  <div className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
    <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
      <ArrowLeft className="w-4 h-4" /> Project
    </Link>
    {parent && (
      <>
        <span className="text-gray-300">/</span>
        <Link href={`/projects/${projectId}/pages/${parent.id}`} className="hover:text-gray-700 dark:hover:text-gray-200">
          {parent.title}
        </Link>
      </>
    )}
  </div>
  ...
</div>
```

**Apply as:** Generalize this into a reusable component that (a) calls `useFullTree()` (shared cache — no new fetch), (b) does the RESEARCH.md Pattern 3 DFS `findPath` walk to build the ancestor chain for a given `(node_type, id)`, (c) renders each ancestor as a clickable `Link` via `treeNodeUrl()`, using `ChevronRight` (not `/`) as the separator per UI-SPEC (`w-3.5 h-3.5 text-gray-300 dark:text-gray-600`), (d) renders the final/current segment as plain semibold non-link text, (e) renders nothing while the tree query is loading (no skeleton, per UI-SPEC), (f) uses `flex flex-wrap items-center gap-1.5` (no ellipsis-collapse, per UI-SPEC/D-07).

```typescript
// apps/workspaces/src/components/shared/Breadcrumbs.tsx (core logic excerpt, from RESEARCH.md Pattern 3)
function findPath(nodes: TreeNode[], targetId: string, trail: TreeNode[] = []): TreeNode[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node];
    if (node.id === targetId) return nextTrail;
    const found = findPath(node.children, targetId, nextTrail);
    if (found) return found;
  }
  return null;
}
```

---

### Detail pages: insert `<Breadcrumbs />`

**`apps/workspaces/src/app/projects/[id]/page.tsx`** — replace the existing single-level back-link block (lines 117-119) with `<Breadcrumbs nodeType="project" id={id} />`, placed at the same position (line 117, inside `<div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">`, before the title block at line 121).

**`apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx`** — replace the existing two-level ancestor block (lines 108-121) with `<Breadcrumbs nodeType="project_page" id={pageId} />` in the same position.

**`apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx`** — no existing back-link/breadcrumb (confirmed: file currently has no `Link`/`ArrowLeft` import at all, per grep). Insert a new `<Breadcrumbs nodeType="data_collection" id={recordId} />` (or `collectionId`, depending on how record ancestry is modeled in the tree — records themselves are NOT tree nodes per `folders.types.ts`'s `TreeNode['node_type']` union, which has no `record` variant; the breadcrumb should resolve to the record's parent `data_collection` node and the record's own title is the trailing/current segment, appended manually rather than looked up via `findPath`). Place directly above the page's main content wrapper, following the same `max-w-* mx-auto px-4 lg:px-8 py-8` container idiom used by the other two pages (this page's current top-level container structure should be checked at implementation time — not yet read in full here, only lines 1-60 were inspected).

## Shared Patterns

### `enabled_modules` filtering
**Source:** `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` lines 48-58
**Apply to:** `treeFilters.ts`'s `pruneTree` — same Set-membership check, extended recursively (D-03/D-04).

### localStorage synchronous-read persistence
**Source:** `apps/cmr/src/app/page.tsx` line 11 (`localStorage.getItem('hide_cmr_onboarding')`)
**Apply to:** `useExpandedTreeNodes.ts` — same idiom, extended to a per-user-namespaced JSON array of node ids (RESEARCH.md Pattern 2, Pitfall 2).

### `crossAppUrl` for external links
**Source:** `packages/ui/src/appUrls.ts` lines 33-36
**Apply to:** No new call sites needed this phase (D-11: CMR Manager link stays as-is in `WorkspaceSidebar.tsx` line 36); noted only because CLAUDE.md flags reuse-over-rebuild and RESEARCH.md's "Don't Hand-Roll" table calls this out explicitly — do not add new URL-building logic anywhere in the tree/breadcrumb code.

### React Query hook shape
**Source:** `apps/workspaces/src/lib/hooks/useFolders.ts` `useFolderTree()` (lines 11-19)
**Apply to:** `useFullTree()` — identical `useQuery({ queryKey, queryFn, enabled: !!user?.company_id, staleTime: 1000 * 60 })` shape, new query key.

### Section-label typography (`text-xs font-semibold uppercase tracking-wider`)
**Source:** `apps/workspaces/src/app/company/[id]/page.tsx` line 164
**Apply to:** `TreeSection`'s "Workspace" heading (D-10, UI-SPEC Typography table).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/workspaces/src/components/tree/treeNodeUrl.ts` | utility | transform | No existing centralized node-type-to-route mapping exists anywhere in the codebase — routes it references are individually confirmed live, but no prior file consolidates them into one lookup table. Build fresh per RESEARCH.md's Anti-Patterns guidance ("centralize in one file"). |

## Metadata

**Analog search scope:** `apps/workspaces/src/components/layout/`, `apps/workspaces/src/lib/api/`, `apps/workspaces/src/lib/hooks/`, `apps/workspaces/src/app/projects/`, `apps/workspaces/src/app/collections/`, `apps/cmr/src/app/`, `apps/api/src/domains/folders/`, `packages/ui/src/`
**Files scanned:** 12 (read in full or targeted ranges)
**Pattern extraction date:** 2026-07-20
