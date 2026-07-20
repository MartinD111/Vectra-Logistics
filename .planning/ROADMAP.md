# Roadmap: Vectra

## Milestones

- ✅ **v1.0 CRM Rework** — Phases 1-6 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Workspace Engine — Engine Unification** — Phases 7-13 (shipped 2026-07-12) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 On-Premise GA** — Phases 14-20 (shipped 2026-07-13) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Workspace Records & Views** — Phases 21-26 (shipped 2026-07-15) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v5.0 Platform Foundation & Durable Execution** — Phases 27-30 (shipped 2026-07-15) — [archive](milestones/v5.0-ROADMAP.md)
- 🚧 **v6.0 Unified Workspace Hierarchy** — Phases 31-34 (in progress)

## Phases

<details>
<summary>✅ v1.0 CRM Rework (Phases 1-6) — SHIPPED 2026-07-06</summary>

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Workspace Engine — Engine Unification (Phases 7-13) — SHIPPED 2026-07-12</summary>

Full detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Milestone audit: [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v3.0 On-Premise GA (Phases 14-20) — SHIPPED 2026-07-13</summary>

Full detail: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)
Milestone audit: [milestones/v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v4.0 Workspace Records & Views (Phases 21-26) — SHIPPED 2026-07-15</summary>

Full detail: [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)
Requirements archive: [milestones/v4.0-REQUIREMENTS.md](milestones/v4.0-REQUIREMENTS.md)
Milestone audit: [milestones/v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v5.0 Platform Foundation & Durable Execution (Phases 27-30) — SHIPPED 2026-07-15</summary>

- [x] Phase 27: Baseline Truth & Roadmap Reconciliation (1/1 plans)
- [x] Phase 28: Security, Tenancy & Capabilities Foundation (4/4 plans)
- [x] Phase 29: Event Spine & Durable Outbox (2/2 plans)
- [x] Phase 30: Workflow MVP Persistence & Manual Trigger (1/1 plans)

Full detail: [milestones/v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md)
Requirements archive: [milestones/v5.0-REQUIREMENTS.md](milestones/v5.0-REQUIREMENTS.md)
Milestone audit: [milestones/v5.0-MILESTONE-AUDIT.md](milestones/v5.0-MILESTONE-AUDIT.md)

</details>

### 🚧 v6.0 Unified Workspace Hierarchy (In Progress)

**Milestone Goal:** Replace the flat, module-keyed sidebar and disconnected records/pages with a real folder → project → page/record tree, so users can organize and navigate the workspace the way the platform's data model already supports.

- [x] **Phase 31: Data Model + Modernize Folders Domain** - Close the `data_collections.folder_id` gap, add an ancestor-index, enforce tenant/cycle invariants at the DB level, and modernize the `folders` domain to v5 `RequestContext`/capability/`event_outbox` conventions.
 (completed 2026-07-17)
- [x] **Phase 32: Aggregated Tree Read API + Reorder/Move Endpoints** - One tenant-scoped `GET /folders/tree/full` endpoint plus lock-safe reorder and cycle/tenant-checked move endpoints, gated by `workspace.admin`.
 (completed 2026-07-19)
- [x] **Phase 33: Tree-Based Sidebar UI (Read + Navigate)** - Replace the flat `ITEMS` list with a real expand/collapse tree, per-user persisted expand state, depth-aware module visibility, and live-tree breadcrumbs. (completed 2026-07-20)
- [ ] **Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows** - Drag-and-drop reorder/reparent, context-menu create, inline rename, and archive-with-descendant-count flows.

## Phase Details

### Phase 31: Data Model + Modernize Folders Domain
**Goal**: The folder/project/program/collection hierarchy has a complete, tenant-safe, cycle-safe schema, and the `folders` domain's mutation/authorization/event pattern matches the rest of the v5 platform, so every downstream phase builds on a correct foundation instead of a stale one.
**Depends on**: Phase 30 (v5 `RequestContext`/capability/`event_outbox` foundation)
**Requirements**: HIER-01, HIER-02, HIER-03, HIER-04, HIER-05, HIER-06, HIER-07
**Success Criteria** (what must be TRUE):
  1. A `data_collections` row can be attached to a folder via `folder_id`, mirroring the existing `projects.folder_id`/`programs.folder_id` pattern
  2. Attempting to reparent any folder/project/program/collection/page row to a different tenant's node is rejected at the database level by a composite `(id, company_id)` FK invariant
  3. Attempting to move a node into its own descendant (a cycle) is rejected at both the database level and the API level
  4. Archiving a folder/project/program cascades `archived_at` to all descendant folders/projects/programs/collections/pages in a single transaction
  5. Every folder domain mutation runs through the v5 `RequestContext` + capability assertion pattern and writes durable events via `event_outbox` (no `recordEvent()`/`activityLog` calls remain in the domain), and ancestor/breadcrumb lookups use an ancestor-index instead of a recursive CTE per request
**Plans**: 6 plans

Plans:
- [x] 31-01-PLAN.md — Folder hierarchy invariants migration (archived_at, ancestor_ids, data_collections.folder_id, composite FK invariants, cycle/depth trigger)
- [x] 31-02-PLAN.md — Records domain: data_collections.folder_id + bulk archive/unarchive methods
- [x] 31-03-PLAN.md — Projects/programs: replace hard-delete with archive/unarchive + bulk cascade methods
- [x] 31-04-PLAN.md — Folders domain foundation: types/DTOs/repository (ancestor-index, archive/unarchive)
- [x] 31-05-PLAN.md — Folders domain: RequestContext/capability/event_outbox modernization + cascade archive
- [x] 31-06-PLAN.md — Integration tests: cross-tenant/cycle/depth DB rejection, cascade transaction, HIER-06 static gate

### Phase 32: Aggregated Tree Read API + Reorder/Move Endpoints
**Goal**: There is one tenant-scoped, single-request way to read the whole workspace tree and one transactional, lock-safe way to reorder or reparent any node, so UI work in later phases has a stable, correct API to build against.
**Depends on**: Phase 31
**Requirements**: TREEAPI-01, TREEAPI-02, TREEAPI-03, TREEAPI-04
**Success Criteria** (what must be TRUE):
  1. `GET /folders/tree/full` returns the entire tenant's folder/project/program/collection/page tree in one request, with no per-node fan-out queries
  2. Reordering siblings via the reorder endpoint uses server-authoritative, lock-safe positions and produces no lost updates when two reorders happen concurrently
  3. The move/reparent endpoint validates tenant ownership on both source and destination and rejects illegal moves (cycles, cross-tenant targets) with a specific error distinguishing the reason
  4. Every tree mutation endpoint (reorder, move/reparent) is gated by the `workspace.admin` capability
**Plans**: 5 plans

Plans:
- [x] 32-01-PLAN.md — Foundation: sort_order migration, tree DTOs, TreeNode type, concurrency race harness
- [x] 32-02-PLAN.md — Repository layer: lock-safe reorderFolders/reorderProjects/reorderPrograms/reorderCollections
- [x] 32-03-PLAN.md — GET /folders/tree/full aggregated read endpoint
- [x] 32-04-PLAN.md — POST /folders/tree/reorder (capability-gated, transactional, live concurrency-proven)
- [x] 32-05-PLAN.md — POST /folders/tree/move (capability-gated, cross-tenant/cycle rejection)

### Phase 33: Tree-Based Sidebar UI (Read + Navigate)
**Goal**: Users can see and navigate the real folder → project → page/record hierarchy in the sidebar, with correct module-aware visibility and breadcrumbs, before any write/drag interactions are introduced.
**Depends on**: Phase 32
**Requirements**: TREEUI-01, TREEUI-02, TREEUI-03, TREEUI-04, TREEUI-05
**Success Criteria** (what must be TRUE):
  1. The workspace sidebar renders folders/projects/programs as a real expand/collapse tree instead of the flat, hardcoded `ITEMS` list
  2. A user's expand/collapse state persists per-user (locally) across browser sessions
  3. Module-aware visibility (`enabled_modules`) is correctly evaluated at every tree node/depth, not only at the top level
  4. Breadcrumbs on any page/record/project reflect the live tree ancestor path
  5. Existing deep links and cross-app links (`crossAppUrl`, Outlook-synced CRM links) continue to work unchanged, because canonical URLs remain ID-keyed and the tree is navigation only
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 33.1-PLAN.md — Tree data layer: getFullTree/useFullTree, pruneTree/treeNodeUrl, useExpandedTreeNodes
- [x] 33.2-PLAN.md — Recursive TreeNodeRow/TreeSection components wired into WorkspaceSidebar
- [x] 33.3-PLAN.md — Breadcrumbs component (findPath DFS over cached tree)
- [x] 33.4-PLAN.md — Wire Breadcrumbs into project/page/record detail pages

### Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows
**Goal**: Users can fully organize the workspace tree — creating, renaming, reordering, reparenting, and archiving folders/projects — with safe, clearly-communicated handling of illegal actions.
**Depends on**: Phase 33
**Requirements**: TREEOPS-01, TREEOPS-02, TREEOPS-03, TREEOPS-04, TREEOPS-05, TREEOPS-06
**Success Criteria** (what must be TRUE):
  1. A user can create a new folder or project at any level of the tree via a context menu
  2. A user can rename a folder or project inline from the tree
  3. A user can drag-to-reorder siblings within the same parent
  4. A user can drag-to-reparent a folder or project into a different folder, and illegal drops (cycles, permission) are rejected with a clear inline reason rather than a silent snap-back
  5. A user can archive a folder or project, with the confirmation showing the count of descendant nodes that will also be archived, and archived folders/projects are hidden from the default tree view but not permanently deleted
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [ ] 34-01-PLAN.md — Frontend API/hook foundation: archive/unarchive/reorder/moveNode wrappers + fullTree invalidation fix + treeDragUtils/treeArchiveCount pure utilities
- [ ] 34-02-PLAN.md — TreeContextMenu component (kebab + right-click anchor modes)
- [ ] 34-03-PLAN.md — ArchiveConfirmDialog (descendant-count breakdown) + TreeUndoToast
- [ ] 34-04-PLAN.md — Wire context menu, create (New Folder/New Project), and inline rename into TreeNodeRow/TreeSection
- [ ] 34-05-PLAN.md — Wire ArchiveConfirmDialog + Undo toast into TreeSection
- [ ] 34-06-PLAN.md — Wire drag-to-reorder/reparent (dnd-kit) + illegal-drop error surfacing into TreeNodeRow/TreeSection

## Progress

**Execution Order:**
Phases execute in numeric order: 31 → 32 → 33 → 34

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 21. Missing Content Blocks | v4.0 | 5/5 | Complete | 2026-07-13 |
| 22. Records + Views Data Model | v4.0 | 4/4 | Complete | 2026-07-14 |
| 23. Record Detail Page | v4.0 | 2/2 | Complete | 2026-07-14 |
| 24. Board View & Legacy Kanban Migration | v4.0 | 4/4 | Complete | 2026-07-14 |
| 25. View UX Parity | v4.0 | 4/4 | Complete | 2026-07-15 |
| 26. Additional View Types | v4.0 | 5/5 | Complete | 2026-07-15 |
| 27. Baseline Truth & Roadmap Reconciliation | v5.0 | 1/1 | Complete | 2026-07-15 |
| 28. Security, Tenancy & Capabilities Foundation | v5.0 | 4/4 | Complete | 2026-07-15 |
| 29. Event Spine & Durable Outbox | v5.0 | 2/2 | Complete | 2026-07-15 |
| 30. Workflow MVP Persistence & Manual Trigger | v5.0 | 1/1 | Complete | 2026-07-15 |
| 31. Data Model + Modernize Folders Domain | v6.0 | 6/6 | Complete   | 2026-07-17 |
| 32. Aggregated Tree Read API + Reorder/Move Endpoints | v6.0 | 5/5 | Complete   | 2026-07-19 |
| 33. Tree-Based Sidebar UI (Read + Navigate) | v6.0 | 4/4 | Complete    | 2026-07-20 |
| 34. Drag-to-Reorder/Reparent + Create/Rename/Archive Flows | v6.0 | 0/6 | Planned | - |

---
*Roadmap updated: 2026-07-20 — Phase 34 planned (6 plans, 4 waves). Next: `/gsd:execute-phase 34`.*
