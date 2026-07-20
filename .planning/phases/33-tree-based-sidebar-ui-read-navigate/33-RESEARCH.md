# Phase 33: Tree-Based Sidebar UI (Read + Navigate) - Research

**Researched:** 2026-07-20
**Domain:** Recursive React tree UI, client-side state persistence, breadcrumb derivation from a cached tree — no new libraries, no backend changes.
**Confidence:** HIGH (all findings verified directly against this repo's code — no external framework/library research was required, this phase is pure application of existing in-repo patterns)

## Summary

This phase adds a read-only, recursive tree UI to `WorkspaceSidebar.tsx`, sourced from the already-shipped `GET /folders/tree/full` endpoint (Phase 32), plus a new breadcrumb component reused across project/page/record detail views. No new npm packages are needed — everything reuses patterns already present in the codebase (`localStorage` for tiny synchronous flags as used in `apps/cmr`, React Query for server-state caching, existing `enabled_modules` Set-filtering logic).

The most important finding is a **gap in Phase 32's archived-node filtering** (relevant to D-12): `folders`, `projects`, and `programs` rows are filtered `WHERE archived_at IS NULL` at the repository level and therefore never appear in `GET /folders/tree/full`. However `data_collections` (`listCollections`) and `project_pages` (`listAllPages`) — the two other node types the aggregated tree includes — are **not** filtered by `archived_at` in their repository queries, even though both tables gained an `archived_at` column in migration `028_folder_hierarchy_invariants.sql`. This means the read-only tree UI **must** filter `raw.archived_at != null` client-side for `data_collection` and `project_page` nodes specifically (folders/projects/programs need no client-side filtering — already excluded server-side). Per D-03/D-12 and the CLAUDE.md "existing 403 behavior" spirit ("must not introduce a second enforcement path"), do not silently rely on this being fixed elsewhere — this is a real, verified gap that must be handled in Phase 33's client-side filter function, not deferred.

The second major finding is that **no frontend code today consumes `GET /folders/tree/full`.** A different, pre-existing hook (`useFolderTree` / `foldersApi.tree()` in `apps/workspaces/src/lib/hooks/useFolders.ts` and `folders.api.ts`) calls the **folders-only** `GET /folders/` endpoint (`listFolderTree`, not `getFullTree`) and is consumed only by `Navbar.tsx`'s dropdown mega-menu (a separate component from `WorkspaceSidebar.tsx`, built by manually assembling 4 separate hooks — `useProjects`, `usePrograms`, `useAllProjectPages`, `useFolderTree`). Phase 33 must add a **new** API function and hook (e.g. `folders.api.ts` → `getFullTree()`, `useFolders.ts` → `useFullTree()`) targeting `/api/v1/folders/tree/full`, returning the discriminated-union `TreeNode[]` shape, not reuse or overload the existing `useFolderTree`/`FolderTree` names (those stay wired to the old endpoint for Navbar.tsx, out of scope to touch).

**Primary recommendation:** Add a new `folders.api.ts` function + `useFullTree()` hook hitting `/folders/tree/full`; build a recursive `TreeSection` component inserted into `WorkspaceSidebar.tsx` between the fixed `ITEMS` nav and `ALWAYS_BOTTOM`; persist expand/collapse state as a single JSON object in `localStorage` (not `idb-keyval`) keyed per-user; build one new `Breadcrumbs` component that walks the same cached tree client-side (no new backend endpoint) and insert it into the three existing detail pages, replacing/augmenting their current single-level "← Back" links.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tree data fetch + caching | Frontend Server (Next.js client component via React Query) | API (`GET /folders/tree/full`, already shipped) | Single aggregated read, cached client-side; no new backend work this phase |
| Recursive tree rendering | Browser / Client | — | Pure UI concern — expand/collapse, icons, links |
| Module-aware node visibility | Browser / Client | — | D-03: client-side filter over already-fetched tree, mirrors existing `ITEMS` filtering pattern |
| Archived-node filtering | Browser / Client | — | D-12 finding: folders/projects/programs pre-filtered server-side; `data_collection`/`project_page` are NOT — client must filter these two node types |
| Expand/collapse persistence | Browser / Client (`localStorage`) | — | Small, synchronous-read state; no cross-device sync requirement (TREEUI-02 says "local, not global") |
| Breadcrumb ancestor derivation | Browser / Client | — | D-08: walk already-cached tree via shared React Query cache, no new endpoint |
| Canonical navigation URLs | API / Backend (existing routes) | — | TREEUI-05: tree is navigation only; all links point at existing ID-keyed routes, unchanged |

## Standard Stack

### Core
No new packages required. This phase is 100% composition of already-installed dependencies.

| Library | Version (installed) | Purpose | Why Standard (in this repo) |
|---------|---------|---------|--------------|
| React 18 / Next.js 14.0.3 | existing | Recursive client components | Already the app's framework |
| `@tanstack/react-query` 5.99.2 | existing | Cache `GET /folders/tree/full`, share across sidebar + breadcrumbs | Already the app's server-state layer (see `useCurrentWorkspace`, `useFolderTree`) |
| `lucide-react` 0.294.0 | existing | Chevron/folder/file icons for tree nodes | Already used throughout `WorkspaceSidebar.tsx`, `Navbar.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser `localStorage` (built-in, no package) | n/a | Expand/collapse state persistence | Synchronous read on mount avoids a "tree flashes collapsed then expands" frame; matches `apps/cmr/src/app/page.tsx`'s `hide_cmr_onboarding` flag pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `localStorage` | `idb-keyval` (already a workspaces dependency per `package.json`, unused in this app) | `idb-keyval` is async (`get`/`set` return Promises) — its only current use (`apps/cmr/src/components/cmr/CmrWorkspace.tsx`) stores large state (PDF blobs, full app history) where async is fine. Expand/collapse state is small (a set of node IDs) and needs to be readable synchronously on first paint to avoid a layout flash. `localStorage.getItem` in a `useState(() => ...)` initializer gives that; `idb-keyval` would require a loading/hydration state for what is a trivial affordance. **Recommendation: `localStorage`.** |
| Recursive component | A tree UI library (e.g. `react-arborist`, `rc-tree`) | Adding a new tree-rendering dependency for a read-only, 3-level-max tree (per Phase 31's depth limit) is unjustified complexity — a plain recursive component with `useState`/`localStorage` fully covers TREEUI-01..05. No drag/virtualization requirement in this phase (that's TREEOPS in Phase 34). Reuse-over-rebuild and YAGNI both favor hand-rolling the ~60-line recursive renderer. |

**Installation:** None — no `npm install` needed for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All work composes existing dependencies already present in `apps/workspaces/package.json` and `packages/ui`.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│  RootLayout (layout.tsx)    │   mounted on EVERY authenticated page
│  ┌────────────┐ ┌─────────┐ │
│  │  Navbar    │ │AppShell │ │
│  │ (existing, │ │ ┌─────┐ │ │
│  │  untouched)│ │ │Sidebar│││  <- NEW: TreeSection added here
│  └────────────┘ │ └─────┘ │ │
│                  │ children│ │  <- page content (breadcrumbs added here)
│                  └─────────┘ │
└─────────────────────────────┘
        │                  │
        ▼                  ▼
useFullTree() ──shared React Query cache (qk: ['folders','tree','full'])──▶ Breadcrumbs component
        │
        ▼
GET /api/v1/folders/tree/full  (Phase 32, already shipped — DO NOT MODIFY)
        │
        ▼
FoldersService.getFullTree() → assembleTree(folders, projects, programs, pages, collections)
   - folders/projects/programs: pre-filtered archived_at IS NULL (server-side)
   - data_collections/project_pages: NOT filtered — client must filter raw.archived_at
```

Data flow for a cold direct deep link (e.g. `/projects/abc/pages/xyz`):
1. `RootLayout` mounts `Navbar` + `AppShell` (which mounts `WorkspaceSidebar`) and the page's own component tree simultaneously.
2. `WorkspaceSidebar`'s `useFullTree()` call and the page's own `Breadcrumbs` (if it also calls `useFullTree()`) both register against the **same** React Query key — only one network request fires; both components re-render together when it resolves.
3. Until resolved, `Breadcrumbs` renders a lightweight loading/skeleton state (or nothing) rather than blocking the page.

### Recommended Project Structure
```
apps/workspaces/src/
├── lib/
│   ├── api/
│   │   └── folders.api.ts          # ADD: getFullTree(), TreeNode type (keep existing tree()/FolderTree untouched — Navbar still uses it)
│   └── hooks/
│       ├── useFolders.ts           # ADD: useFullTree() hook (new query key, separate from useFolderTree)
│       └── useExpandedTreeNodes.ts # NEW: localStorage-backed expand/collapse state hook
├── components/
│   ├── layout/
│   │   └── WorkspaceSidebar.tsx    # MODIFY: insert <TreeSection /> between ITEMS and ALWAYS_BOTTOM
│   └── tree/
│       ├── TreeSection.tsx         # NEW: section heading + root-level TreeNodeRow list
│       ├── TreeNodeRow.tsx         # NEW: recursive row (expand/collapse chevron, icon, name, Link)
│       ├── treeFilters.ts          # NEW: pruneByModule(), pruneArchived() — pure functions, unit-testable
│       └── treeNodeUrl.ts          # NEW: node_type → href mapping (single source of truth, avoid inline switch duplication)
│   └── shared/
│       └── Breadcrumbs.tsx         # NEW: walks cached tree to build ancestor chain for a given node id + node_type
```

### Pattern 1: Client-side recursive filter (module visibility + archive)
**What:** A pure function that recursively prunes a `TreeNode[]` tree by two independent predicates: (1) module-enabled check per D-04's mapping, (2) `archived_at` check for `data_collection`/`project_page` nodes only.
**When to use:** Applied once, at the top of `TreeSection`, to the raw `useFullTree()` result before rendering — never mutate the React Query cache itself.
**Example:**
```typescript
// apps/workspaces/src/components/tree/treeFilters.ts
import type { TreeNode } from '@/lib/api/folders.api';

// D-04: 1:1 node_type -> enabled_modules key mapping. 'folder' and 'project'
// are never gated (folders are containers, projects are always visible today).
const MODULE_KEY: Partial<Record<TreeNode['node_type'], string>> = {
  data_collection: 'records',
  project_page: 'records',
  program: 'programs',
};

function isArchived(node: TreeNode): boolean {
  // D-12: folders/projects/programs are already archived_at-filtered
  // server-side (folders.repository.ts, projects.repository.ts). Only
  // data_collections/project_pages need a client-side check — their list
  // queries (listCollections, listAllPages) do not filter archived_at.
  if (node.node_type !== 'data_collection' && node.node_type !== 'project_page') return false;
  const raw = node.raw as { archived_at: string | null };
  return raw.archived_at != null;
}

// D-01/D-02: pruning a node removes its entire subtree. A folder with zero
// surviving children after filtering is itself dropped (no dead-end empty
// branches in the nav).
export function pruneTree(nodes: TreeNode[], enabledModules: Set<string>): TreeNode[] {
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (isArchived(node)) return acc;
    const moduleKey = MODULE_KEY[node.node_type];
    if (moduleKey && !enabledModules.has(moduleKey)) return acc;

    const children = pruneTree(node.children, enabledModules);
    // Folders are module-agnostic; if every child was filtered out, hide the
    // now-empty folder too (D-02). Non-folder leaf nodes with no children
    // (project, program, data_collection, project_page) are unaffected —
    // they were never gated on "having children" to begin with.
    if (node.node_type === 'folder' && node.children.length > 0 && children.length === 0) {
      return acc;
    }
    acc.push({ ...node, children });
    return acc;
  }, []);
}
```

### Pattern 2: `localStorage`-backed expand/collapse state (TREEUI-02)
**What:** A small hook mirroring the `apps/cmr` `hide_cmr_onboarding` flag pattern — synchronous read on mount, write-through on toggle.
**When to use:** Once per sidebar tree instance; keyed per-user so switching accounts doesn't leak another user's expand state.
**Example:**
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
Note: `useState` re-runs its initializer on every `key` change (e.g. user switch) only on remount, not automatically — since `AuthContext`'s `user` is stable per session and a user switch implies a full page reload/re-auth in this app's SSO flow, this is acceptable. Confirm during planning if a same-session user switch (impersonation feature, if any) exists; none was found in the codebase.

### Pattern 3: Breadcrumb derivation by walking the cached tree (D-08)
**What:** Given a `node_type` + `id` (e.g. current project id, current page id, current record's collection id), find that node inside the already-fetched `TreeNode[]` tree via DFS, and return the chain of ancestor names from root to that node.
**When to use:** In the new `Breadcrumbs` component, called with the current page's own identifiers.
**Example:**
```typescript
// apps/workspaces/src/components/shared/Breadcrumbs.tsx (core logic excerpt)
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
No new backend ancestor-path endpoint is needed (resolves D-08) — `GET /folders/tree/full` is a single small aggregated payload (5 flat queries assembled in memory per `folders.service.ts`), cheap enough to walk client-side, and the tree fetch is already in flight from the moment `AppShell`/`WorkspaceSidebar` mounts on every authenticated page (see System Architecture Diagram above) since `AppShell.tsx` unconditionally renders `<WorkspaceSidebar />`.

### Anti-Patterns to Avoid
- **Re-implementing archived/module filtering in more than one place:** `pruneTree` must be the single source of truth; don't duplicate `enabled_modules` checks inline in `TreeNodeRow` — mirrors the existing single-filter-pass pattern in `WorkspaceSidebar.tsx`'s current `ITEMS.filter(...)`.
- **Mutating the React Query cache to "hide" archived/disabled nodes:** Always derive a new filtered array in the render path; never call `queryClient.setQueryData` to strip nodes — that would corrupt the cache for other consumers (e.g. a future Phase 34 drag-tree that needs the unfiltered data).
- **Building a second ancestor-path fetch when the full tree is already cached:** Would duplicate TREEAPI-01's aggregated-read intent and add an unnecessary API surface Phase 32 explicitly avoided (D-08 resolved against this).
- **Hardcoding tree-node hrefs inline in multiple components:** Centralize `node_type` → route mapping in one `treeNodeUrl.ts` file (folder → `/projects?folder=<id>` or similar per planning decision, project → `/projects/<id>`, program → `/programs/<id>`, project_page → `/projects/<project_id>/pages/<id>`, data_collection → `/collections/<id>`) so a future URL-scheme change touches one file, consistent with TREEUI-05's "canonical URLs stay ID-keyed" requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree data fetching/caching | A custom fetch+state-management layer | `@tanstack/react-query` `useQuery`, same as every other data hook in this app | Automatic caching, dedup, staleTime control already the app-wide pattern (see `useCurrentWorkspace`, `useFolderTree`) |
| Cross-app / external links | New link-building logic for the CMR Manager item | `crossAppUrl()` from `packages/ui/src/appUrls.ts` | Already handles dev vs. prod base URLs; D-11 confirms no relocation needed, just reuse unchanged |
| Excel import (out of scope for this phase, but noted since CLAUDE.md flags it) | N/A — not part of Phase 33 | N/A | Phase 33 is read/navigate only; Excel import is CRM-specific and unrelated to the tree UI |

**Key insight:** Every "don't hand-roll" concern in this phase is already solved elsewhere in the repo (React Query for fetching, `crossAppUrl` for external links); the only genuinely new code is the recursive render + two small pure filter/derivation functions.

## Common Pitfalls

### Pitfall 1: Assuming `GET /folders/tree/full` excludes all archived nodes
**What goes wrong:** A developer assumes "Phase 32 already handles archiving" and skips client-side filtering entirely, causing archived data-collection records and archived pages to appear in the read-only tree with no way to distinguish or act on them.
**Why it happens:** `folders`, `projects`, `programs` repository queries DO filter `archived_at IS NULL` — a quick spot-check on one node type gives a false sense that all five do.
**How to avoid:** Use the verified `pruneTree`/`isArchived` pattern above; explicitly filter `data_collection` and `project_page` nodes by `raw.archived_at`.
**Warning signs:** An archived record or page still shows up in the sidebar tree after being archived via direct API call/DB update.

### Pitfall 2: Sidebar tree section not re-collapsing on new user session
**What goes wrong:** Expand/collapse state persists across different users on a shared machine because the `localStorage` key isn't namespaced by user id.
**Why it happens:** Copy-pasting a simpler `localStorage.getItem('tree_expanded')` pattern without the per-user key, unlike `apps/cmr`'s single-tenant desktop-tool assumption (CMR is typically one user per browser profile; workspaces is multi-user SSO).
**How to avoid:** Always key by `user?.id` as shown in Pattern 2.
**Warning signs:** QA finds User B's tree pre-expanded to User A's folder structure after switching accounts in the same browser.

### Pitfall 3: Mixed root-level node types breaking a "folders-first" assumption
**What goes wrong:** A renderer assumes the tree root array only contains folders (matching the *other*, pre-existing `useFolderTree`/`FolderTree` type) and crashes or mis-renders when `GET /folders/tree/full`'s root array also contains root-level projects/programs/collections.
**Why it happens:** The existing `Folder`/`FolderTree` client types in `folders.api.ts` (used by `Navbar.tsx`) look superficially identical in name to the new aggregated `TreeNode` type, but represent different endpoints with different root-array shapes.
**How to avoid:** Use a distinct `TreeNode` type (matching the backend's discriminated union in `folders.types.ts`) for the new hook — do not reuse or extend the existing `FolderTree` interface. Root-level render logic must switch on `node_type`, not assume `folder`.
**Warning signs:** A root-level project or program silently fails to render, or throws `Cannot read property 'children' of undefined`.

### Pitfall 4: `enabled_modules` mapping omitted for a node type that doesn't need gating
**What goes wrong:** A developer adds a spurious module-key entry for `folder` or `project`, hiding all folders/projects when a workspace's preset happens not to include some unrelated key.
**Why it happens:** Over-generalizing the D-04 mapping table into "every node type must have a module key."
**How to avoid:** Per D-04, only `data_collection`/`project_page` → `records` and `program` → `programs` are gated; `folder` and `project` are always visible (matches current behavior — projects have no module gate today per `WorkspaceSidebar.tsx`'s `ITEMS` array, where there is no project-level module key at all).
**Warning signs:** Projects/folders vanish from the tree for workspace presets that don't include an unrelated module.

## Code Examples

### Verified: server-side archived_at filtering per node type (confirms D-12 finding)
```typescript
// Source: apps/api/src/domains/folders/folders.repository.ts:7-13 (folders — filtered)
async listFolders(companyId: string): Promise<Folder[]> {
  const { rows } = await db.query<Folder>(
    `SELECT * FROM folders WHERE company_id = $1 AND archived_at IS NULL ORDER BY sort_order ASC, created_at ASC`,
    [companyId],
  );
  return rows;
}

// Source: apps/api/src/domains/projects/projects.repository.ts:11-19 (projects — filtered)
// WHERE p.company_id = $1 AND p.archived_at IS NULL

// Source: apps/api/src/domains/projects/projects.repository.ts:422-428 (project_pages — NOT filtered)
async listAllPages(companyId: string): Promise<ProjectPage[]> {
  const { rows } = await db.query<ProjectPage>(
    `SELECT * FROM project_pages WHERE company_id = $1 ORDER BY project_id, sort_order ASC, created_at ASC`,
    [companyId],
  );
  return rows;
}

// Source: apps/api/src/domains/records/records.repository.ts:69-73 (data_collections — NOT filtered)
async listCollections(companyId: string): Promise<DataCollectionRow[]> {
  const { rows } = await db.query<DataCollectionRow>(
    `SELECT * FROM data_collections WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
  return rows;
}
```

### Verified: existing module-visibility filtering pattern to mirror
```typescript
// Source: apps/workspaces/src/components/layout/WorkspaceSidebar.tsx:48-58
const enabled = new Set(workspace?.enabled_modules ?? []);
const seen = new Set<string>();
const visible = ITEMS.filter((it) => {
  if (it.module && !enabled.has(it.module)) return false;
  if (seen.has(it.href + it.name)) return false;
  seen.add(it.href + it.name);
  return true;
});
```

### Verified: `TreeNode` backend shape to mirror on the client
```typescript
// Source: apps/api/src/domains/folders/folders.types.ts:31-38
export interface TreeNode {
  node_type: 'folder' | 'project' | 'program' | 'data_collection' | 'project_page';
  id: string;
  company_id: string;
  name: string;
  children: TreeNode[];
  raw: Folder | Project | Program | ProjectPage | DataCollectionRow;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `WorkspaceSidebar.tsx`'s flat, hardcoded `ITEMS` array (module-level nav only, no org content) | Fixed `ITEMS` (unchanged, D-09) + new recursive `TreeSection` for org content | Phase 33 | First time the sidebar reflects actual folder/project/program/collection hierarchy instead of only fixed app-level nav |
| `Navbar.tsx`'s manual 4-hook assembly (`useProjects` + `usePrograms` + `useAllProjectPages` + `useFolderTree`, folders-only tree) | Available but out of scope: could later be refactored onto `useFullTree()` too | Not this phase | Documented as an **Open Question** below — do not touch `Navbar.tsx` in Phase 33 unless explicitly asked; it works today via a different, folders-only endpoint |

**Deprecated/outdated:** None — no libraries or APIs used here are deprecated; this is a first-time feature build, not a migration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A same-session user switch (e.g. impersonation) does not exist in this app, so a stable `useState` initializer keyed by `user?.id` is sufficient for `localStorage` read | Pattern 2 (Common Pitfalls #2) | If an impersonation/switch-user-without-reload feature is added later, stale expand-state could leak between users within one SPA session — low risk, easy follow-up fix (swap `useState` init for a `useEffect` keyed on `user?.id`) |
| A2 | Folders (`node_type: 'folder'`) and projects (`node_type: 'project'`) should render with no module gate at all, matching current `ITEMS` behavior where projects have no module key | Pattern 1, D-04 confirmation | If wrong, an already-user-confirmed decision (D-04) would need revisiting — but D-04 is explicitly "confirmed by user" in CONTEXT.md, so this is LOW risk, included only as a cross-check note |

**If this table is empty:** N/A — see above; both entries are low-risk clarifying notes on already-user-confirmed decisions, not open compliance/security gaps.

## Open Questions

1. **Should `Navbar.tsx`'s existing folder-aware dropdown be refactored onto the new `useFullTree()` hook for consistency, or left alone?**
   - What we know: `Navbar.tsx` currently builds its own folder/project/program/page nav tree by combining 4 separate hooks against the folders-only `GET /folders/` endpoint — a different, older pattern than what Phase 33 introduces for the sidebar.
   - What's unclear: Whether leaving two different "tree assembly" approaches live side-by-side (Navbar's manual multi-hook version vs. Sidebar's new aggregated-endpoint version) is acceptable tech debt for this phase, or whether the planner should unify them.
   - Recommendation: Leave `Navbar.tsx` untouched in Phase 33 — it is out of the stated phase boundary (sidebar + breadcrumbs only) and touching it risks regressing its working dropdown mega-menu. Flag as a candidate follow-up cleanup, not a Phase 33 task.

2. **Exact URL scheme for a folder-node click in the sidebar tree.**
   - What we know: Projects/programs/collections/pages all have existing, unambiguous detail routes (`/projects/:id`, `/programs/:id`, `/collections/:id`, `/projects/:id/pages/:pageId`). Folders themselves have no dedicated detail page today — `Navbar.tsx`'s `folderNavItem` currently just points every folder link at the static `/projects` list page.
   - What's unclear: Whether clicking a folder in the new tree should (a) navigate to `/projects` (matching today's Navbar behavior, simplest, TREEUI-05-compliant since it's an existing route) or (b) just toggle expand/collapse with no navigation at all (arguably more correct for a "folder = container, not a page" mental model).
   - Recommendation: Default to (b) — clicking a folder row toggles expand/collapse only (no navigation); the chevron and the row label are the same click target. This avoids inventing a scheme and keeps behavior obviously correct without a new route. Planner should confirm this against D-09's framing of folders as "organizational content" rather than a page destination.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond what's already running in this monorepo (Node.js, npm workspace, existing Postgres-backed API already live from Phase 31/32). No new environment probing needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in `apps/workspaces` (no `jest.config.*`, `vitest.config.*`, or `__tests__`/`*.test.*` files found under `apps/workspaces/src`) |
| Config file | none — see Wave 0 |
| Quick run command | n/a — no test runner configured for this app |
| Full suite command | n/a |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREEUI-01 | Sidebar renders real tree instead of flat `ITEMS` | manual-only | — | ❌ Wave 0 (no test infra) |
| TREEUI-02 | Expand/collapse persists per-user across sessions | manual-only | — | ❌ Wave 0 |
| TREEUI-03 | Module visibility correct at every depth | unit (pure `pruneTree` function is test-worthy even without a runner — see Wave 0 gap) | `n/a — no runner` | ❌ Wave 0 |
| TREEUI-04 | Breadcrumbs reflect live ancestor path | manual-only | — | ❌ Wave 0 |
| TREEUI-05 | Deep links/cross-app links unchanged | manual-only (regression check against existing links) | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual verification in dev server (no automated quick-run available)
- **Per wave merge:** Manual click-through of sidebar + breadcrumbs across at least one project, one page, one record, one archived item
- **Phase gate:** Manual QA pass before `/gsd:verify-work` — no automated full suite exists for `apps/workspaces`

### Wave 0 Gaps
- [ ] No test framework configured in `apps/workspaces` at all — installing one (e.g. Vitest + React Testing Library) is out of scope for this phase unless the planner decides `pruneTree`/`isArchived`/`findPath` (all pure, dependency-free functions) are valuable enough to justify introducing a minimal test setup just for them.
- [ ] If a test framework is introduced: `treeFilters.test.ts` covering TREEUI-03 (module + archive pruning) and `Breadcrumbs`'s `findPath` covering TREEUI-04, since both are pure functions well-suited to unit tests without any DOM/network mocking.

*(If the planner decides not to introduce a test framework this phase: "None — manual QA covers all phase requirements, consistent with the rest of `apps/workspaces` having no existing automated frontend test suite.")*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — existing `authenticateToken` middleware already gates `GET /folders/tree/full` (Phase 32, `folders.routes.ts:10`) |
| V3 Session Management | no | No session changes in this phase |
| V4 Access Control | no (read-only) | `GET /folders/tree/full` has no capability gate beyond authentication (any authenticated tenant user can read their own tree) — matches existing `GET /folders/` behavior; this phase adds no new privilege boundary |
| V5 Input Validation | no | No new user input this phase — pure rendering/navigation of already-validated server data |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leakage via a mis-scoped tree query | Information Disclosure | Not a new risk — `getFullTree` already scopes all 5 underlying queries by `tenantId` (`requireCompanyId(ctx)`), verified in `folders.service.ts:28-38`. Phase 33 only renders already-tenant-scoped data; no new cross-tenant surface introduced. |
| `localStorage` key collision leaking one user's UI state to another on a shared browser profile | Information Disclosure (low severity — UI state only, not data) | Namespace the `localStorage` key by `user?.id` (Pattern 2) — expand/collapse state carries no sensitive data itself, but node IDs could hint at org structure across users on a shared machine; namespacing avoids this entirely. |

## Sources

### Primary (HIGH confidence — verified directly in this repo)
- `apps/api/src/domains/folders/folders.routes.ts` — route registration order, `/tree/full` endpoint
- `apps/api/src/domains/folders/folders.controller.ts` — `getFullTree` handler
- `apps/api/src/domains/folders/folders.service.ts` — `getFullTree`/`assembleTree` implementation (lines 26-38, 382-474)
- `apps/api/src/domains/folders/folders.types.ts` — `TreeNode` discriminated union shape
- `apps/api/src/domains/folders/folders.repository.ts` — confirmed `archived_at IS NULL` filtering on `listFolders`
- `apps/api/src/domains/projects/projects.repository.ts` — confirmed filtering on `listProjects`/`listPrograms`, confirmed absence of filtering on `listAllPages`
- `apps/api/src/domains/records/records.repository.ts` — confirmed absence of filtering on `listCollections`
- `database/migrations/028_folder_hierarchy_invariants.sql` — confirms `archived_at` column exists on all 5 tables including `data_collections`/`project_pages`
- `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` — current `ITEMS`, `enabled_modules` filtering, `renderItem`, `ALWAYS_BOTTOM`
- `apps/workspaces/src/components/layout/Navbar.tsx` — confirmed the OTHER, pre-existing folder-tree consumption pattern (different endpoint, different type)
- `apps/workspaces/src/lib/api/folders.api.ts`, `apps/workspaces/src/lib/hooks/useFolders.ts` — confirmed existing `useFolderTree`/`foldersApi.tree()` targets `GET /folders/` (folders-only), not `/tree/full`
- `apps/workspaces/src/app/layout.tsx`, `AppShell.tsx` (grep-confirmed `<WorkspaceSidebar />` render) — confirmed sidebar mounts on every authenticated page
- `apps/workspaces/src/app/projects/[id]/page.tsx`, `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx`, `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` — confirmed current back-link/no-breadcrumb state of the three detail views TREEUI-04 targets
- `apps/cmr/src/components/cmr/CmrWorkspace.tsx`, `apps/cmr/src/app/page.tsx` — confirmed the two existing local-persistence patterns (`idb-keyval` for blobs, `localStorage` for a boolean flag)
- `packages/ui/src/appUrls.ts` — `crossAppUrl` definition
- `packages/types/src/index.ts` — `WorkspacePreset.enabled_modules: string[]` shape

### Secondary (MEDIUM confidence)
None — no external web sources were needed; this phase is entirely an application of existing, verified in-repo patterns.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every recommendation traces to an already-installed, already-used dependency in this exact repo
- Architecture: HIGH — component structure directly mirrors existing patterns (`WorkspaceSidebar.tsx`'s filter-then-render, `useCurrentWorkspace`'s React Query hook shape)
- Pitfalls: HIGH — the archived-node filtering gap (Pitfall 1 / D-12) was verified by reading the actual repository query SQL, not inferred

**Research date:** 2026-07-20
**Valid until:** 30 days (stable, in-repo findings; only invalidated if Phase 32's API or the folders/projects/programs schema changes before Phase 33 executes)
