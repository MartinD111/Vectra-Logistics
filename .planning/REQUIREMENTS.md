# Requirements: Vectra Platform — v6.0 Unified Workspace Hierarchy

**Defined:** 2026-07-16
**Core Value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history. The risk semaphore is a hard, visible block, not a suggestion.

## v1 Requirements

Requirements for the v6.0 milestone. Each maps to a roadmap phase.

### Data Model & Folders Domain (HIER)

- [ ] **HIER-01**: `data_collections` can attach to a folder via `folder_id`, mirroring the existing `projects.folder_id`/`programs.folder_id` pattern
- [ ] **HIER-02**: A composite `(id, company_id)` FK invariant prevents any folder/project/program/collection/page row from being reparented cross-tenant, enforced at the database level
- [ ] **HIER-03**: A move/reparent that would create a cycle (moving a node into its own descendant) is rejected at both the database level and the API level
- [ ] **HIER-04**: Folders, projects, and programs support `archived_at`; archiving a node cascades `archived_at` to its descendant folders/projects/programs/collections/pages in the same transaction
- [ ] **HIER-05**: All folder domain mutations use the v5 `RequestContext` + capability assertion pattern instead of the pre-v5 `(companyId, actorId, body)` signature
- [ ] **HIER-06**: All folder domain mutations write durable events through the v5 `event_outbox` instead of the legacy `recordEvent()`/`activityLog` path
- [ ] **HIER-07**: Tree traversal and breadcrumb queries use an ancestor-index (materialized path or ancestor array) rather than a recursive CTE per request, so lookup cost doesn't grow with tree depth

### Aggregated Tree API (TREEAPI)

- [ ] **TREEAPI-01**: A single tenant-scoped endpoint (`GET /folders/tree/full`) returns the full workspace tree (folders + projects + programs + collections + pages) in one request, without per-node fan-out queries
- [ ] **TREEAPI-02**: A reorder endpoint updates sibling order for a moved node using server-authoritative, lock-safe positions, with no lost updates under concurrent reorder
- [ ] **TREEAPI-03**: A move/reparent endpoint validates tenant ownership on both source and destination and rejects illegal moves (cycles, cross-tenant targets) with a specific error distinguishing the reason
- [ ] **TREEAPI-04**: All tree mutation endpoints are gated by the `workspace.admin` capability, consistent with the existing folders domain

### Tree Sidebar UI (TREEUI)

- [ ] **TREEUI-01**: The workspace sidebar renders folders/projects/programs as a real expand/collapse tree instead of the flat, hardcoded `ITEMS` list
- [ ] **TREEUI-02**: A user's expand/collapse state persists per-user across sessions (local, not global)
- [ ] **TREEUI-03**: Module-aware visibility (`enabled_modules`) is evaluated at every tree node/depth, not only at the top level
- [ ] **TREEUI-04**: Breadcrumbs on any page/record/project reflect the live tree ancestor path
- [ ] **TREEUI-05**: Canonical URLs remain ID-keyed; the tree is a navigation aid, not a routing scheme — existing deep links and cross-app links (`crossAppUrl`, Outlook-synced CRM links) keep working unchanged

### Organize: Create/Rename/Move/Archive + Drag (TREEOPS)

- [ ] **TREEOPS-01**: A user can create a new folder or project at any level of the tree via a context menu
- [ ] **TREEOPS-02**: A user can rename a folder or project inline from the tree
- [ ] **TREEOPS-03**: A user can drag-to-reorder siblings within the same parent
- [ ] **TREEOPS-04**: A user can drag-to-reparent a folder or project into a different folder; illegal drops (cycles, permission) are rejected with a clear inline reason rather than a silent snap-back
- [ ] **TREEOPS-05**: A user can archive a folder or project; the confirmation shows the count of descendant nodes that will also be archived
- [ ] **TREEOPS-06**: Archived folders/projects are hidden from the default tree view but not permanently deleted

## v2 Requirements

Deferred beyond v6, tracked but not in current roadmap.

### Organize (deferred)

- **TREEOPS2-01**: Drag-reparent pages/records directly into projects (deeper cross-entity drag)
- **TREEOPS2-02**: Bulk multi-select archive/move

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-user custom ordering separate from the shared tree order | Anti-feature — conflicts with a single team-visible hierarchy |
| Pinned/starred shortcuts | Anti-feature for this milestone — not core to hierarchy navigation |
| Cross-cutting "portfolio" views spanning multiple folders | Already covered by the existing `collection_views` engine; would duplicate it |
| Real-time collaborative drag cursors | High complexity, not core to the hierarchy MVP |
| Unlimited nesting depth | Comparable products converge on 3-4 bounded levels; unbounded nesting adds UI/perf complexity with no user-validated need |
| New `workspace_nodes` generalized tree table | Would duplicate the existing `folders`/`projects`/`programs`/`project_pages`/`collection_records` parent-pointer hierarchies — violates reuse-over-rebuild |
| Finer-grained tree capability beyond `workspace.admin` (e.g. `tree.organize`) | No confirmed need for non-admin project-lead reordering in this milestone; revisit if requested |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIER-01 | Phase 31 | Pending |
| HIER-02 | Phase 31 | Pending |
| HIER-03 | Phase 31 | Pending |
| HIER-04 | Phase 31 | Pending |
| HIER-05 | Phase 31 | Pending |
| HIER-06 | Phase 31 | Pending |
| HIER-07 | Phase 31 | Pending |
| TREEAPI-01 | Phase 32 | Pending |
| TREEAPI-02 | Phase 32 | Pending |
| TREEAPI-03 | Phase 32 | Pending |
| TREEAPI-04 | Phase 32 | Pending |
| TREEUI-01 | Phase 33 | Pending |
| TREEUI-02 | Phase 33 | Pending |
| TREEUI-03 | Phase 33 | Pending |
| TREEUI-04 | Phase 33 | Pending |
| TREEUI-05 | Phase 33 | Pending |
| TREEOPS-01 | Phase 34 | Pending |
| TREEOPS-02 | Phase 34 | Pending |
| TREEOPS-03 | Phase 34 | Pending |
| TREEOPS-04 | Phase 34 | Pending |
| TREEOPS-05 | Phase 34 | Pending |
| TREEOPS-06 | Phase 34 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22 (Phase 31: 7, Phase 32: 4, Phase 33: 5, Phase 34: 6)
- Unmapped: 0

---
*Requirements defined: 2026-07-16*
*Last updated: 2026-07-16 after v6.0 roadmap creation (Phases 31-34)*
