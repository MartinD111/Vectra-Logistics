# Project Research Summary

**Project:** Vectra v6.0 — Unified Workspace Hierarchy
**Domain:** Tree-based workspace navigation (folder → project → page/record) inside an existing DDD, multi-tenant, capability-gated monorepo
**Researched:** 2026-07-16
**Confidence:** HIGH

## Executive Summary

This milestone is far more of an integration and consistency project than a greenfield data-model project. Direct repo inspection confirms a working `folders` domain already exists (`database/migrations/006_folders.sql`), complete with a nestable `parent_id` tree, cycle-guarded `moveFolder`, non-cascading delete semantics, a full CRUD API mounted at `/api/v1/folders`, and even unused frontend hooks (`useFolders.ts`, `foldersApi`). Three more parent-pointer hierarchies already exist independently: `projects.folder_id`/`programs.folder_id`, `project_pages.parent_page_id`, and `collection_records.parent_record_id`. The real gap is not "build a tree" — it is (1) no UI renders any of this (`WorkspaceSidebar.tsx` is still a flat, hardcoded, module-filtered list), (2) `data_collections` has no `folder_id` attachment, (3) the `folders` domain predates v5's `RequestContext`/capability/event-outbox conventions and needs modernizing, and (4) there is no unifying read/breadcrumb contract across the four separate hierarchies, and no ancestor-index to make that contract cheap at scale.

The recommended approach is to extend, not duplicate. Add a `folder_id` FK to `data_collections` (mirroring the existing `projects`/`programs` pattern), refactor `folders.service.ts` to v5 conventions (RequestContext, `assertCapability`, durable `event_outbox` events instead of `recordEvent()`), and build one aggregated, tenant-scoped tree-read endpoint on the existing `folders` domain that assembles folders + projects + programs + collections + pages into a single response shape. Pair this with a lightweight ancestor-index (materialized path or per-row ancestor array) to avoid recursive-CTE/N+1 costs at breadcrumb- and tree-fetch time. On top of this backend, add a `@dnd-kit`-based recursive tree UI (no new DnD library — `dnd-kit-sortable-tree` is a thin, dependency-compatible wrapper already validated against pinned versions), reusing existing `sort_order` columns and existing mutation hooks.

Key risks: cross-tenant leakage through a recursive CTE that only checks the root node, cycle creation on drag-reparent, orphaned/zombie children on delete-vs-archive, and N+1 query storms on deep-tree render are all realistic, high-cost-to-retrofit failure modes that must be designed against at the data-model/API phase, not discovered post-launch. A second, quieter risk is process, not code: three researchers converged on three different framings of "what the data model should be" (extend `folders` directly vs. a new generalized `workspace_nodes` node-type table vs. "no new schema, just a read API") — this is resolved explicitly below in favor of the first option, because introducing a second competing hierarchy table alongside `folders` would violate the "one contract" principle the project has followed since v5.

## Key Findings

### Recommended Stack

Postgres adjacency-list (`parent_id` + `sort_order`, recursive CTE reads) is both the existing convention (`012_page_hierarchy.sql`) and the correct choice for a mutable, frequently-reordered/re-parented tree — reject `ltree`/materialized-path-as-primary-storage and Nested Set Model, both of which fight directly against drag-to-move UX. On the frontend, no new DnD engine is needed: the already-pinned `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (with the thin `dnd-kit-sortable-tree@^0.1.73` wrapper, whose peer-deps are already satisfied) implement the official dnd-kit flatten-tree drag pattern. `react-arborist` is explicitly rejected — it pulls in `react-dnd`, `redux`, and `react-window`, none of which exist in this repo, and would fork both the DnD stack and the state-management convention.

**Core technologies:**
- Adjacency list (`parent_id` + `sort_order`) in Postgres — already the established convention; supports cheap single-row reparenting
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (existing) + `dnd-kit-sortable-tree@^0.1.73` — tree drag/reorder/reparent without a second DnD engine
- Recursive CTE (`WITH RECURSIVE`, native Postgres) for tree fetch and breadcrumb assembly — no new extension
- `zod` + `@tanstack/react-query` (existing) — DTO validation and tree-query caching, per established patterns

Note: the stack researcher's "brand-new `workspace_nodes` table with a `node_type` discriminator" idea is superseded by the architecture researcher's direct-code finding (see below) and is explicitly not carried into the roadmap.

### Expected Features

**Must have (table stakes):**
- Expand/collapse tree nodes with per-user persisted state (localStorage, not global)
- Drag-to-reorder siblings and drag-to-reparent (existing `sort_order`/parent-pointer columns already support this — UI + validated endpoint problem, not schema)
- Breadcrumbs reflecting the live tree path, generically across folder/project/page/record
- Inline rename, create-from-context-menu at any level, confirm-before-destroy
- Empty states for empty folders/projects
- Module-aware visibility preserved at every tree depth — the primary regression risk: today's flat `enabled_modules` filter must be re-architected to intersect hierarchy position with module-enablement, not layered on top of the old flat filter

**Should have (competitive differentiators):**
- Cross-links from tree nodes directly into `data_collections`/collection views (first-class tree leaf, not "find the block on a page")
- Single generic ancestor-path/breadcrumb service across all four hierarchies — pays for itself in later milestones (Mini Programs v3, logistics vertical)
- Archive (not delete) as the default hide action for folders/projects, consistent with existing non-cascading folder-delete precedent — `archived_at` does not exist anywhere in the schema yet and must be added net-new

**Defer (v1.x / v2+):**
- Deeper cross-entity drag-reparent (pages/records directly into projects) — v1.x
- Bulk multi-select archive/move — v1.x
- Per-user custom ordering, pinned/starred shortcuts, cross-cutting "portfolio" views (already covered by existing `collection_views`), real-time collaborative drag cursors — all explicitly deferred/anti-features

### Architecture Approach

Resolved data-model direction: extend the existing `folders` domain plus existing parent-pointer columns on `projects`/`programs`/`project_pages`/`collection_records`, add the one missing FK (`data_collections.folder_id`), and add a thin ancestor-index for cheap traversal — do not introduce a new tree-owning table. The tree is not a new bounded context; it is `folders` (parent/child structure) composed with four other domains' existing tables.

**Major components:**
1. `folders` domain (existing, to be modernized) — owns folder CRUD, cycle-guarded move, and gains a new aggregated `GET /folders/tree/full` read endpoint that assembles folders + projects + programs + data_collections + pages into one tenant-scoped shape
2. `data_collections.folder_id` (new column, migration `028_...`) — closes the one genuine data-model gap; mirrors the exact pattern already used for `projects.folder_id`
3. `WorkspaceSidebar.tsx` → new `WorkspaceTree` component — replaces only the flat `ITEMS.map()` middle section, preserving `ALWAYS_BOTTOM`/fixed top items and `enabled_modules` gating, consuming a new `useWorkspaceTree` hook that composes existing `useFolders`/`useProjects` query-key invalidation rather than forking mutation logic
4. Breadcrumbs — frontend-only, client-side ancestor walk over the already-cached tree query; no new "get ancestors" endpoint

### Critical Pitfalls

1. **Cross-tenant leakage via recursive tree traversal that only checks the root node** — every recursive CTE step (not just the base case) must re-apply `company_id = $1`; add a composite `(id, company_id)` FK invariant so a child physically cannot point cross-tenant. Must be caught at the data-model/API phase.
2. **Cycle creation on move/re-parent** — naive `UPDATE parent_id` with no ancestor check on the target. Reject with 400 if `moved_id` appears in the new parent's ancestor chain; add a DB-level trigger as defense-in-depth, not just a UI-level "won't let you drop there."
3. **Orphaned or "zombie visible" children on delete/archive** — treat archive as the only default action for non-empty nodes, recursively marking descendants `archived_at` in the same transaction; never allow `parent_id` to dangle; permanent delete only for already-archived, empty subtrees.
4. **N+1 query storms on deep-tree render** — adjacency-list-only schema tempts per-level fetch loops. Fetch the full tenant tree in one query and assemble in memory; add a materialized path/ancestor-index alongside the adjacency list specifically for breadcrumb/subtree queries, since folder moves are far rarer than folder reads.
5. **Drag-and-drop reorder races / optimistic-update flicker with React Query** — gate cache-driven re-renders behind an `isDragging` flag, compute ordering server-side with row locks (`SELECT ... FOR UPDATE`) on the affected sibling set, and use fractional/sparse positions rather than full-array recompute on every drop.
6. **Breaking existing bookmarked/deep-linked URLs** — canonical routes must stay ID-keyed (`/projects/:id`), never folder-path-keyed; folder context in a URL is cosmetic only. This must be a stated invariant from the data-model phase onward, including Outlook-synced CRM email links and `crossAppUrl` links from CMR/Marketplace.

## Reconciling the Three Research Framings (Explicit Data-Model Direction)

The three researchers converged on the same underlying facts (folders domain exists, four parent-pointer hierarchies already exist) but proposed three different-sounding "fixes." This is resolved as follows, and the roadmapper should treat this as the settled data-model direction:

- **ARCHITECTURE.md's recommendation is adopted as the primary direction:** extend the existing `folders` table/domain, add the single missing FK (`data_collections.folder_id`), and build the unifying tree/breadcrumb read as a new aggregated endpoint inside the `folders` domain — not a new sibling domain, not a new table.
- **STACK.md's "brand-new generalized `workspace_nodes` table with a `node_type` discriminator" is explicitly rejected as a competing hierarchy.** It was proposed without the benefit of having read the existing `folders` domain in depth. Building it alongside `folders` would create two parallel tree-storage mechanisms for the same concept — a direct violation of the "reuse over rebuild" project constraint and the "one contract" principle the codebase has followed since the v5 request/capability/event spine was established. STACK.md's DnD-library and adjacency-list-vs-ltree-vs-nested-set analysis remains fully valid and is retained.
- **FEATURES.md's framing — "the real gap is a unifying read/breadcrumb API across four parent-pointer hierarchies, not new write-side schema" — is correct and is folded into the ARCHITECTURE.md direction**, with one refinement from PITFALLS.md: a pure recursive-CTE-per-request read API is not sufficient at scale. The roadmap should include a lightweight ancestor-index (materialized path column, or a per-row ancestor-ID array populated on write) added to the existing tables as part of the same data-model phase that adds `data_collections.folder_id`, so breadcrumb and "move-into" validation queries stay single-indexed-lookup rather than N-hop recursive walks. This index is additive to the adjacency-list `parent_id` model, not a replacement for it, and is not a new competing tree — it is a query-performance cache derived from the one canonical parent-pointer structure.

**Net data-model instruction for the roadmap:** one new migration adds `data_collections.folder_id` (FK to `folders.id`, `ON DELETE SET NULL`) plus an ancestor-index/materialized-path mechanism for cheap traversal across the existing `folders`, `projects`, `programs`, `project_pages`, and (now) `data_collections` parent-pointer columns. No new tree-owning table is created. The `folders` domain is modernized to v5 conventions (`RequestContext`, `assertCapability`, durable `event_outbox` events) as part of the same phase, since new endpoints should not be built against the domain's pre-v5 pattern.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Model + Modernize `folders` Domain
**Rationale:** Everything downstream (aggregated read API, drag-reorder, breadcrumbs) depends on the schema being complete and the domain's authorization/event pattern being correct before new endpoints are layered on top of a stale pattern.
**Delivers:** Migration adding `data_collections.folder_id` (+ index) and an ancestor-index/materialized-path mechanism; `folders.service.ts`/`folders.controller.ts` refactored to `RequestContext` + `assertCapability`; `folders` event writes switched from `recordEvent()` to durable `event_outbox` inserts; DB-level cycle-prevention guard (trigger or composite-key check) added.
**Addresses:** Data-model gap (collections have no folder attachment); consistency debt in the `folders` domain.
**Avoids:** Pitfall 1 (cross-tenant leakage — composite `(id, company_id)` FK invariant), Pitfall 2 (cycle creation — DB-level guard before any UI exists to rely on), Pitfall 3 (orphaned children — `archived_at` schema decided here, not retrofitted later), Pitfall 4 (N+1 — ancestor-index added at schema time, not after a live tree is populated).

### Phase 2: Aggregated Tree Read API + Reorder/Move Endpoints
**Rationale:** UI work should not start until there is one tenant-scoped, single-query tree shape and transactional, lock-safe mutation endpoints to build against.
**Delivers:** `GET /folders/tree/full` (folders + projects + programs + collections + pages assembled server-side, single tenant-scoped query per node type, not per-node fan-out); `PATCH .../reorder` per node type with server-authoritative fractional/locked positions; move/reparent endpoint enforcing both source and destination tenant/capability checks plus cycle rejection.
**Uses:** Recursive CTE / ancestor-index from Phase 1; existing `workspace.admin` capability (or new `tree.organize` capability if finer granularity is required); `event_outbox` for `folder.moved`/`folder.archived` etc.
**Implements:** `folders` domain aggregation endpoint pattern.

### Phase 3: Tree-Based Sidebar UI (Read + Navigate)
**Rationale:** With a stable, cheap-to-fetch read API in place, the highest-value/lowest-risk UI slice is read-only tree rendering with correct module-aware visibility, before adding the riskier drag-and-drop write path.
**Delivers:** `useWorkspaceTree` hook; `WorkspaceTree` component replacing the flat `ITEMS` middle section of `WorkspaceSidebar.tsx`, with expand/collapse (persisted per-user via localStorage) and `enabled_modules` visibility folded into every tree-node check, not just top-level items; breadcrumbs component driven by the same cached tree query.
**Addresses:** Table-stakes features (expand/collapse persistence, breadcrumbs, module-aware visibility at depth) and the differentiator (generic ancestor-path breadcrumb service).
**Avoids:** Pitfall 6 (URLs stay ID-keyed; tree is navigation, not routing) and the UX pitfall of breadcrumbs/sidebar state drifting out of sync (drive both from the same source).

### Phase 4: Drag-to-Reorder / Drag-to-Reparent + Create/Rename/Archive Flows
**Rationale:** The riskiest, most stateful UI work (concurrent mutation, optimistic updates, illegal-drop handling) should come last, once the read path and endpoints are proven stable, so drag interactions can be validated against a known-good API rather than co-developed with it.
**Delivers:** `dnd-kit-sortable-tree`-based recursive drag UI supporting both reorder (siblings) and reparent (cross-folder) in one gesture; create/rename/move/archive modals and menus wired to existing `useCreateFolder`/`useUpdateFolder`/`useMoveFolder`/`useDeleteFolder` and equivalent project/program mutations; illegal-drop UX (specific inline errors distinguishing cycle vs. permission vs. no-op) rather than silent snap-back; archive confirmation showing descendant count before hiding a subtree. Delivers the full v1 feature set per the MVP definition.

### Phase Ordering Rationale

- Data model and domain modernization must come first because every other phase either queries the new schema or calls into the `folders` service's authorization/event pattern — retrofitting the ancestor-index or the capability refactor after live data exists is materially more expensive.
- The aggregated read API is separated from the sidebar UI so that performance/tenancy correctness (N+1, cross-tenant leakage) can be tested against the API directly before any UI consumes it, and so the UI phase is not blocked on API design decisions.
- Read-only tree UI is deliberately sequenced before drag-and-drop because module-aware visibility (a hard regression constraint) and breadcrumb correctness are lower-risk to validate first; drag-and-drop introduces concurrency/race conditions that are easier to debug against an already-correct read model.
- Archive/delete flows are grouped with the drag/create/rename phase for the UX/transaction logic, but the underlying `archived_at` schema and cascade rules are decided in Phase 1, per the "decide schema early, don't retrofit" principle.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (ancestor-index/materialized-path mechanism):** the exact implementation choice (materialized path column vs. per-row ancestor-ID array vs. closure table) needs a `--research-phase` pass to pick the specific technique and write the migration correctly against Vectra's actual expected tree depth/breadth.
- **Phase 4 (drag-and-drop reorder concurrency):** the server-side locking/position-scheme (fractional index vs. sparse integer with rebalance) and its interaction with `event_outbox`/websocket echo-suppression is non-trivial and codebase-specific; flag for research during phase planning.

Phases with standard patterns (skip research-phase):
- **Phase 2 (aggregated read API):** well-documented pattern already partially implemented (`folders.service.ts`'s `buildTree`); mostly composition of existing repositories.
- **Phase 3 (read-only tree UI):** standard React Query + recursive component rendering, matches existing hook/component conventions closely enough to plan directly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified directly against pinned `package.json` versions, Context7 dnd-kit docs, and `npm view` dependency inspection; adjacency-list-vs-ltree-vs-nested-set tradeoffs cross-checked against multiple sources |
| Features | MEDIUM | WebSearch-verified against Notion/ClickUp/Linear/Asana docs (no Context7-indexed SDK for this UX pattern), combined with direct repo inspection of existing migrations — feature landscape is well-grounded but competitor-comparison portion is inherently softer than an SDK research task |
| Architecture | HIGH | Based entirely on direct inspection of the current repo (folders domain, projects/records types, v5 capability/event conventions) — this is an integration question answered from primary source, not inference |
| Pitfalls | HIGH (architectural/tenancy/cycle pitfalls) / MEDIUM (dnd-kit + React Query race-condition specifics) | Tenancy and data-model pitfalls verified against current Vectra v5 patterns directly; dnd-kit/React Query optimistic-update pitfalls verified against community GitHub discussions and TanStack docs, a lower-confidence source class than direct repo inspection |

**Overall confidence:** HIGH

### Gaps to Address

- **Ancestor-index technique choice** (materialized path vs. ancestor-array vs. closure table) is not fully resolved — pick during Phase 1 planning based on actual expected tenant tree depth/breadth (research suggests it's small — tens to low hundreds of nodes — which may mean a simpler ancestor-array-on-write is sufficient rather than a full materialized-path rewrite scheme).
- **Whether v6 needs finer-grained tree capabilities beyond `workspace.admin`** (e.g., a `tree.organize` capability for non-admin project leads) is unresolved — confirm actual v6 requirements before deciding whether to extend the `CapabilityName` union or ship with `workspace.admin` everywhere.
- **Whether `projects`/`programs` need a `sort_order` column** for reorder-within-folder was flagged as "check before assuming" — verify against current schema before Phase 1 migration is finalized.
- **Exact scope of "archive" cascade into cross-linked `data_collections`/records** (e.g., does an archived project's linked collection view need its own archived-source indicator?) needs a decision during Phase 1/4 planning, not left implicit.

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: `database/migrations/006_folders.sql`, `009_project_pages.sql`, `012_page_hierarchy.sql`, `025_records_views.sql`, `026_event_outbox.sql`, `027_workflows.sql`
- Direct repo inspection: `apps/api/src/domains/folders/*`, `projects/projects.types.ts`, `records/records.types.ts`, `records.repository.ts`, `workflows/*`, `core/auth/request-context.ts`, `core/capabilities/index.ts`, `core/events/outbox.ts`, `activityLog.ts`
- Direct repo inspection: `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx`, `lib/hooks/useFolders.ts`, `lib/api/folders.api.ts`, `projects.api.ts`, `packages/ui/src/appUrls.ts`, `apps/workspaces/package.json`
- Context7 `/clauderic/dnd-kit` — confirmed official sortable-tree pattern using core+sortable+modifiers
- `npm view react-arborist dependencies` / `npm view dnd-kit-sortable-tree dependencies peerDependencies` — confirmed dependency surface directly against npm registry

### Secondary (MEDIUM confidence)
- Notion Help Center / Notion Academy — sidebar navigation, breadcrumb, page-nesting behavior
- ClickUp Help Center — hierarchy model, archive/restore semantics
- Linear Docs — teams/sub-teams flat-list hierarchy comparison
- Ackee blog, sqlfordevs.com, bustawin.com — adjacency list vs. materialized path vs. nested set tradeoffs
- TanStack Query optimistic-updates docs, dnd-kit GitHub discussions #1522/#921 — React Query + dnd-kit race-condition patterns
- AWS/Crunchy Data blogs — multi-tenant Postgres isolation patterns (cross-checked against Vectra's existing row-level model)

### Tertiary (LOW confidence)
- Asana Forum/Help Center on portfolios — used only to support the anti-feature ("portfolios-of-portfolios") recommendation, not a core finding

---
*Research completed: 2026-07-16*
*Ready for roadmap: yes*
