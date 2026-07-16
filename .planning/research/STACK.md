# Stack Research

**Domain:** Tree-based workspace hierarchy (folder/project/page nav) — Postgres data model + React tree UI
**Researched:** 2026-07-16
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Adjacency list in Postgres (`parent_id` + `sort_order`, recursive CTE reads) | Postgres 15 (already in stack), no extension | Folder/project tree storage | The codebase **already uses this exact pattern**: `database/migrations/012_page_hierarchy.sql` adds `parent_page_id UUID REFERENCES project_pages(id) ON DELETE CASCADE` + `sort_order` index on `project_pages`. Adjacency list is also the standard recommendation for *mutable* trees (frequent move/reparent) because moving a subtree is a single `UPDATE parent_id` — no path-rewrite, no extension. Reuse the proven convention rather than introducing a second hierarchy strategy. |
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (existing, ^6.3.1 / ^10.0.0 / ^9.0.0) | Already pinned | Tree expand/collapse + drag-to-reorder + drag-to-reparent | Sufficient. dnd-kit's own maintainers ship an official "sortable tree" pattern (flatten tree → sortable list → re-nest on drop, depth computed from pointer x-offset) built entirely on `core`+`sortable`+`modifiers` — no additional DnD engine needed. Confirmed no new base DnD library is required. |
| `dnd-kit-sortable-tree` ^0.1.73 | 0.1.73 | Thin, unopinionated wrapper implementing exactly that official dnd-kit tree pattern (indentation, collision detection tuned for nesting, collapse) | Peer-deps are `@dnd-kit/core >=6.0.5`, `@dnd-kit/sortable >=7.0.1`, `@dnd-kit/utilities >=3.2.0` — all already satisfied by the pinned versions in `apps/workspaces/package.json`. Adds ~2 tiny deps (`clsx`, `react-merge-refs`), zero new DnD engines. Saves reimplementing flatten/depth/indent math by hand while staying inside the existing dnd-kit ecosystem. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` (existing) | 4.3.6 | Validate create/rename/move/archive DTOs (`CreateFolderSchema`, `MoveNodeSchema`, etc.) | Every new hierarchy endpoint, per existing `dto/` convention |
| `@tanstack/react-query` (existing) | 5.99.2 | Cache the tree query, optimistic updates on drag-drop reorder/reparent | `useQuery(['workspace-tree', workspaceId])` + `useMutation` with `onMutate` optimistic tree patch, matches existing hooks pattern (`useProjects.ts` style) |
| `lucide-react` (existing) | 0.294.0 | Chevron/folder/file icons for tree rows | Already the icon lib used in `WorkspaceSidebar.tsx` |
| Recursive CTE (`WITH RECURSIVE`) — native Postgres, no library | n/a | Fetch full tree in one round trip, compute depth/breadcrumb path server-side | `tree.repository.ts` — one query returns all nodes with `depth`, ancestor `id[]`/`name[]` array for breadcrumbs; avoids N+1 or an ltree extension |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| None new | — | No new build/lint/test tooling needed; this is a data-model + UI-library addition on top of the existing Next.js/Express/Postgres toolchain |

## Installation

```bash
# In apps/workspaces
npm install dnd-kit-sortable-tree@^0.1.73

# No new backend packages — recursive CTE is native SQL, no ltree extension needed
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Adjacency list (`parent_id`) | `ltree` extension (materialized path) | Only if the hierarchy were read-heavy/write-rare (e.g. a static taxonomy) and you needed fast "all descendants of X" queries via GiST index. Folders/projects here are frequently renamed/moved/reordered by users — ltree requires rewriting the `path` column (and every descendant's path) on every move, which is exactly the mutation this milestone optimizes for. Reject for this use case. |
| Adjacency list (`parent_id`) | Nested Set Model (lft/rgt) | Never, for this milestone. Nested sets make reads for subtree fast but make *every* insert/move an O(n) renumbering of `lft`/`rgt` across sibling ranges — worst possible fit for a UI where users drag-reorder constantly. Only justified for trees that are built once and read many times (e.g. compiled category trees), not here. |
| `@dnd-kit` + `dnd-kit-sortable-tree` | `react-arborist` (v3.13.2) | Only if the team is willing to run **two parallel DnD engines**: `npm view react-arborist dependencies` shows it depends on `react-dnd`, `react-dnd-html5-backend`, `redux`, and `react-window` — none of which exist in this repo today. Adopting it means introducing an entirely separate drag-and-drop stack (react-dnd, not dnd-kit) plus Redux purely for one tree widget, duplicating state-management patterns the rest of the app deliberately avoids ("No Redux or Zustand observed" per architecture conventions). Only reconsider if the tree needs to virtualize 10,000+ nodes with zero custom code and the team accepts the extra dependency surface — unlikely for a per-workspace folder/project tree, which is small (tens to low hundreds of nodes). |
| `@dnd-kit` + `dnd-kit-sortable-tree` | `react-complex-tree` | If keyboard-accessibility-first tree UX (ARIA tree pattern, screen-reader-tested) becomes a hard requirement beyond what a custom dnd-kit build offers. It's dependency-light and doesn't conflict with dnd-kit, but it ships its own drag-and-drop implementation rather than using dnd-kit, so you'd still be running two DnD codepaths side by side. Prefer only if `dnd-kit-sortable-tree`'s accessibility falls short in evaluation. |
| Recursive CTE for tree fetch | `ltree` GiST-indexed queries | If tree fetch performance becomes a measured bottleneck at very large node counts (thousands per workspace) — not expected at folder/project scope; revisit only if profiling shows it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-arborist` | Pulls in `react-dnd` + `redux` + `react-window`, a second DnD engine and a state library the codebase explicitly avoids elsewhere; doubles the drag-and-drop surface area to maintain | `dnd-kit-sortable-tree` on top of the already-pinned `@dnd-kit/*` packages |
| Postgres `ltree` extension | Materialized-path rewrite cost on every folder/project move fights directly against this milestone's core UX (drag-to-move); also introduces a Postgres extension the on-prem installer/migration runner has never had to provision before | Adjacency list (`parent_id` + `sort_order`), consistent with `012_page_hierarchy.sql` |
| Nested Set Model | O(n) `lft`/`rgt` renumbering on every insert/move; actively hostile to a UI built around frequent reordering | Adjacency list + recursive CTE |
| A brand-new "hierarchy" table disconnected from `project_pages`/`data_collections` | Would create a second, parallel tree concept alongside the one already implied by `project_pages.parent_page_id` and the records/views model, contradicting the "reuse over rebuild" project constraint | Extend/generalize the existing adjacency-list pattern: a `workspace_nodes` (or similarly named) table with `node_type` discriminator (`folder`/`project`/`page`/`collection`), `parent_id`, `sort_order`, cross-referencing `project_pages.id` / `data_collections.id` by foreign key rather than re-modeling their content |
| New global state library (Redux/Zustand/Jotai) for tree expand/collapse UI state | Contradicts established convention ("No Redux or Zustand observed"); tree expand/collapse is local, ephemeral UI state | `useState`/`useReducer` in the sidebar tree component, persisted per-user via existing localStorage/idb-keyval pattern if "remember expanded folders" is desired |

## Stack Patterns by Variant

**If the tree needs to mix heterogeneous node types (folder, project, page, record/collection) in one nav tree:**
- Use a single `workspace_nodes` adjacency-list table with a `node_type` enum/text column and nullable FK columns (`project_page_id`, `data_collection_id`) pointing at existing tables
- Because this avoids duplicating page/collection metadata in a new tree table — the tree table only owns hierarchy + ordering + display concerns, matching the "cross-links to existing `data_collections`/records" requirement in `.planning/PROJECT.md`

**If drag-and-drop needs to support both reorder (same parent) and reparent (move to a different folder) in the same interaction:**
- Use `dnd-kit-sortable-tree`'s flatten-tree strategy: flatten the tree into a single sortable list with a `depth` field per item, use `@dnd-kit/modifiers` (`restrictToVerticalAxis` is not enough alone — the official dnd-kit tree example adds a custom horizontal-offset-to-depth calculation) to compute both new sibling position and new parent from one drag gesture
- Because this is exactly the dnd-kit team's own documented tree solution, avoids maintaining two separate interaction models (one for reorder, one for reparent)

**If breadcrumbs need ancestor names, not just IDs:**
- Compute them server-side in the recursive CTE using `array_append(ancestor_names, name)` per level, return as `text[]` alongside the tree rows
- Because this avoids N sidebar-to-breadcrumb round trips and keeps breadcrumb logic in the repository layer per the DDD convention (repository = data access, service = business rules)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `dnd-kit-sortable-tree@0.1.73` | `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2` | Peer-dep ranges (`>=6.0.5`, `>=7.0.1`, `>=3.2.0`) are all satisfied by versions already pinned in `apps/workspaces/package.json` — no version bump needed for existing dnd-kit packages |
| Postgres 15 (existing, per docker-compose) | Recursive CTEs (`WITH RECURSIVE`) | Native since Postgres 8.4; no extension install, no change to on-prem installer/migration runner needed |
| `zod@4.3.6` (existing) | New hierarchy DTOs | No version concern; follows existing `dto/` schema pattern |

## Sources

- Context7 `/clauderic/dnd-kit` — confirmed official dnd-kit maintains a documented sortable-tree pattern using only core+sortable+modifiers (HIGH confidence)
- Context7 `/jameskerr/react-arborist` (v3.13.2 resolved) and `npm view react-arborist dependencies` — confirmed `react-dnd`, `react-dnd-html5-backend`, `redux`, `react-window` as hard dependencies (HIGH confidence, verified directly against npm registry)
- `npm view dnd-kit-sortable-tree dependencies peerDependencies` — confirmed lightweight peer-dep-only integration with existing @dnd-kit versions (HIGH confidence)
- [Store Trees As Materialized Paths — sqlfordevs.com](https://sqlfordevs.com/tree-as-materialized-path) — materialized path tradeoffs (MEDIUM confidence, single-source pattern discussion, cross-checked against Ackee blog below)
- [Hierarchical models in PostgreSQL — Ackee blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql) — adjacency list vs materialized path vs nested set comparison, explicitly notes adjacency list preferred for frequently-changing hierarchies (MEDIUM confidence)
- [DAGs with materialized paths using postgres ltree — bustawin](https://www.bustawin.com/dags-with-materialized-paths-using-postgres-ltree/) — confirms ltree subtree-move cost (MEDIUM confidence)
- [React + dnd-kit tree-list drag and drop sortable — DEV Community](https://dev.to/fupeng_wang/react-dnd-kit-implement-tree-list-drag-and-drop-sortable-225l) — dnd-kit tree implementation pattern (MEDIUM confidence)
- [Top 5 Drag-and-Drop Libraries for React in 2026 — Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — ecosystem comparison (MEDIUM confidence)
- Direct repo inspection: `database/migrations/012_page_hierarchy.sql` (adjacency list already in production), `apps/workspaces/package.json` (existing @dnd-kit pins), `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` (current flat sidebar to replace) — HIGH confidence, primary source

---
*Stack research for: unified workspace hierarchy (folder/project/page tree nav), v6.0 milestone*
*Researched: 2026-07-16*
