# Feature Research

**Domain:** Unified workspace hierarchy (folder/project/page tree navigation) for a B2B logistics workspace platform
**Researched:** 2026-07-16
**Confidence:** MEDIUM (WebSearch-verified against multiple comparable products; no Context7-indexed library for this — it's a UX/data-model pattern, not an SDK)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any product with nested navigation. Missing these makes the sidebar feel broken, not "simple."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Expand/collapse tree nodes with per-user persisted state | Every comparable product (Notion, ClickUp, Linear sub-teams) persists which nodes are open across reloads — re-collapsing on every page load reads as a bug | LOW | Vectra already has a `WorkspaceSidebar.tsx` mounted per session; persist expand-state in `localStorage` keyed by `workspaceId + userId`, not global. Do NOT wait on async children to decide default-open state — read persisted set first, then lazy-load children only for open nodes. |
| Drag-to-reorder siblings | ClickUp and Notion both support dragging a folder/page to a new position within the same parent; users expect manual ordering, not just alpha/date sort | LOW–MEDIUM | Vectra's `folders`, `project_pages`, and `collection_records` tables **already have `sort_order` columns**. This is a UI (`@dnd-kit`, already a dependency) + PATCH-reorder-endpoint problem, not a schema problem. |
| Drag-to-re-parent (move into a folder/project) | Notion's core interaction is "drop onto a page to nest it"; ClickUp lets you drag a Folder/List between parents | MEDIUM | `folders.parent_id`, `projects.folder_id`, `project_pages.parent_page_id`, `collection_records.parent_record_id` already model this. New work is validating cross-entity drop targets (e.g., can a project be dropped on a folder? can a page be dropped on a project?) and preventing invalid drops (record into folder, page into unrelated project). |
| Breadcrumbs that reflect the live tree path | Notion updates breadcrumbs "in real time to reflect new parent/ancestor pages" after a move; users rely on breadcrumbs to both orient and navigate up | LOW–MEDIUM | Requires a path-resolution query (walk `parent_id`/`folder_id`/`parent_page_id` chain) exposed as one API shape usable for folder, project, and page nodes alike — the differentiator is doing this generically across 4 different parent-pointer columns rather than one breadcrumb component per entity type. |
| Rename in place (inline edit, no modal) | Standard in every hierarchy tool; double-click or menu → rename with no page reload | LOW | Straightforward CRUD; reuse existing rename patterns from CRM/project rename flows. |
| Create new folder/project/page from a context menu at any tree level | Users expect "+ " affordance at any node, not just at root | LOW | Notion shows a `+` on hover at any sidebar row. |
| Confirm-before-destroy on delete, with clear scope of what's affected | ClickUp/Notion both gate hard delete behind a trash/confirmation step because deletes are rarely truly wanted immediately | LOW–MEDIUM | Vectra's existing `folders` migration comment already establishes non-cascading delete semantics for folders (contents fall back to unfiled) — this precedent should extend to the unified tree, not be silently overridden by a new "cascade delete" behavior. |
| Empty states for empty folders/projects | Every list/tree UI needs a "this is empty — create your first X" state, otherwise looks broken/loading forever | LOW | Standard empty-state component; likely already exists for records/board views (v4) and should be reused, not reinvented. |
| Module-aware visibility preserved in the tree | This is a hard **regression constraint**, not a nice-to-have: today's sidebar filters items by `workspace.enabled_modules`; the tree must not leak items from disabled modules (e.g., a fleet-disabled workspace must not show a fleet folder just because rows exist) | MEDIUM | This is the primary integration risk of the milestone — tree rendering must intersect two axes (hierarchy position AND module-enablement) instead of the current flat filter. |

### Differentiators (Competitive Advantage)

Features that set Vectra apart for its actual audience (logistics dispatchers/ops, not knowledge workers). Should reinforce the core value (credit-risk block, deterministic operational surfaces), not chase general PKM parity with Notion.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-links from tree nodes directly into `data_collections`/records (not just pages) | Competitors (Notion) treat "databases" as a special embedded block; Vectra can let a folder/project node link straight to a collection view (e.g., "Loads" board) as a first-class tree leaf, collapsing "go find the block on a page" into "click the collection in the tree" | MEDIUM | Depends on the records/views engine shipped in v4 (`data_collections`/`collection_views`) — the tree becomes a navigation index over that engine, not a replacement for it. |
| Single generic path-resolution/breadcrumb service across folders, projects, pages, and records | Notion/ClickUp/Asana each hard-code breadcrumbs per object type; a platform with 4 distinct hierarchical entities benefits from one generic ancestor-walk contract other engines (mini programs, automations) can also consume later | MEDIUM | Directly serves the "Platform Core owns workspace/folder/project/page ... primitives" vision in PROJECT.md — pays for itself in v7 (Mini Program v3) and v8 (logistics vertical) reuse. |
| Archive (not delete) as the default "get it out of my way" action for folders/projects | B2B ops teams routinely need to hide completed jobs/projects without losing audit trail (invoices, CMR/POD, KPI history reference them) — unlike a PKM tool where "delete" is low-stakes, in logistics every project may be tied to billing/compliance records | LOW–MEDIUM | No `archived_at`/`is_archived` column exists yet anywhere in the schema — this is new, and it should be added consistently (folders, projects, pages) rather than ad hoc per table. Ties into the KPI/CRM credit-risk audit requirements already in the product (never lose data tied to compliance). |
| Sidebar respects `enabled_modules` at every tree depth, not just top-level nav items | This is unique to Vectra's multi-tenant module-licensing model — no comparable product (Notion/ClickUp/Linear) has a "workspace type" concept that hides whole subtrees | MEDIUM | Genuine product differentiator vs. generic PKM sidebars, and the reason this can't be a drop-in open-source tree component. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look attractive because Notion/ClickUp/Coda have them, but don't fit a B2B logistics ops tool or would bloat this milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Unlimited-depth arbitrary nesting (Notion-style infinite sub-pages) | "Notion lets you nest forever, feels powerful" | Logistics ops don't need 8-levels-deep folder trees; deep nesting makes breadcrumbs unreadable and permission/module-visibility logic combinatorially harder to reason about; existing schema (`folders.parent_id`) technically allows infinite depth already | Allow the schema to support recursion (already does), but cap **UI-encouraged** depth at folder → project → page/record (3 levels) in this milestone; revisit deeper nesting only if a real logistics workflow demands it |
| Portfolios-of-portfolios / cross-cutting saved "views" over the tree (Asana-style) | Asana users ask for this because flat sidebar + multiple orgs creates real pain | Out of scope for v6 — Vectra already has `collection_views` (board/table/calendar/etc.) solving cross-cutting views over records; adding a second, parallel "portfolio" concept over folders/projects duplicates that engine and creates two ways to build the same kind of saved view | Point users at collection views for cross-cutting slices; keep the tree as pure hierarchical navigation |
| Real-time multi-cursor collaborative drag-and-reorder (see other users move things live) | "Feels premium," Notion/Coda invest here | High complexity (conflict resolution on `sort_order`, socket broadcast storms) for a navigation feature that's edited far less frequently than document content; v6 has no requirement tied to this, and it would compete with the socket.io realtime budget already used for page edits/activity feed | Ship optimistic-UI reorder with last-write-wins on `sort_order`; broadcast a simple "tree changed, refetch" event over the existing `companyId` room rather than granular cursor sync |
| Hard delete cascades everything underneath immediately | "Delete means delete, keep it simple" | For logistics data tied to billing/CRM/compliance (invoices, CMR/POD referencing a project), an accidental cascade delete is a business-risk event, not just an annoyance; the existing `folders` migration already deliberately chose non-cascading, unfile-on-delete semantics for exactly this reason | Default action is archive; hard delete only for genuinely empty nodes or via an explicit "permanently delete" confirmation that lists affected descendants |
| Custom per-user tree layout (each user reorders folders differently) | "Personalization," seen in some PKM tools | `sort_order` today is a column on the shared row (per-company), not per-user; introducing per-user ordering means either duplicating order data per user or a separate preference table — meaningfully more schema/API surface for a B2B tool where teams expect one shared, agreed-upon structure | Shared, company-wide ordering (matches ClickUp/Asana team-shared hierarchy model); per-user "starred/pinned" shortcuts can be a much smaller future feature if needed, without touching canonical `sort_order` |

## Feature Dependencies

```
[Tree data model + API (folder/project/page/record parent pointers)]
    └──requires──> [Existing: folders.parent_id, projects.folder_id,
                     project_pages.parent_page_id, collection_records.parent_record_id]
                       (all four already exist in migrations 004/006/012/025 — no new tables needed,
                        only a unifying read-model/API and possibly archived_at columns)

[Tree-based sidebar nav (expand/collapse, drag-reorder)]
    └──requires──> [Tree data model + API]
    └──requires──> [Sort_order columns already present]

[Breadcrumbs]
    └──requires──> [Generic ancestor-path resolution service]
                       └──requires──> [Tree data model + API]

[Cross-links from tree into data_collections/collection_views]
    └──requires──> [v4 Records & Views engine — already shipped]

[Archive/delete flows]
    └──requires──> [New archived_at / is_archived columns — do not exist yet, must be added]
    └──enhances──> [Non-cascading delete precedent already set by folders migration 006]

[Module-aware visibility in tree] ──conflicts-if-done-naively-with──> [Flat ITEMS filter in WorkspaceSidebar.tsx]
    (must be re-architected together, not layered on top of the old flat filter)
```

### Dependency Notes

- **Tree-based sidebar nav requires the tree data model + API:** the parent-pointer columns already exist across four tables (`folders`, `projects`, `project_pages`, `collection_records`) from prior migrations (006, 004, 012, 025) — this milestone's real net-new backend work is a **unifying read API** (one tree/breadcrumb shape across four physically distinct tables), not new schema for parent/child relationships themselves.
- **Breadcrumbs require a generic ancestor-path resolution service:** because Vectra's hierarchy is spread across four separate parent-pointer columns (not one polymorphic `nodes` table), the breadcrumb feature is the forcing function to decide whether v6 introduces a lightweight generic "hierarchy service" abstraction over these four tables, or keeps per-type breadcrumb logic. Given the "Platform Core" vision in PROJECT.md, the generic-service route is recommended and should be flagged for architecture research.
- **Archive/delete flows require new `archived_at` columns:** confirmed via migration search — no table in the current schema has `archived_at`, `is_archived`, or `deleted_at`. This is unambiguously new schema work (one or more `NNN_description.sql` migrations), not a reuse of existing columns.
- **Module-aware visibility in tree conflicts with the current flat `ITEMS` filter if done naively:** `WorkspaceSidebar.tsx`'s existing `enabled_modules` intersection logic operates on a flat array; the tree replacement must fold module-gating into every tree-node-visibility check (folder can contain projects from a disabled module and must hide them), which is a genuine redesign of that filter, not an additive change.
- **Cross-links into `data_collections`/`collection_views` enhance the tree but depend on v4 already being shipped:** confirmed shipped per PROJECT.md ("v4.0 Workspace Records & Views ... Archived"). No new schema needed for this dependency, only new UI wiring from tree nodes to existing collection routes.

## MVP Definition

### Launch With (v1 — this milestone, v6.0)

- [ ] Unified tree read API across folders/projects/pages, returning parent-child + breadcrumb path in one generic shape — foundation everything else depends on
- [ ] Tree-based sidebar replacing flat `ITEMS`: expand/collapse with persisted per-user state, module-aware visibility preserved
- [ ] Drag-to-reorder siblings and drag-to-re-parent (folder ↔ folder, project ↔ folder) using existing `sort_order` and parent-pointer columns
- [ ] Create/rename/move flows for folders and projects (menu-driven, inline rename)
- [ ] Breadcrumbs on project/page/record detail views, driven by the generic ancestor-path resolution
- [ ] Archive (soft-hide) for folders and projects — new `archived_at` column(s) + non-cascading semantics matching the existing folder-delete precedent
- [ ] Empty-state UI for empty folders/projects in the tree

### Add After Validation (v1.x)

- [ ] Drag-to-re-parent extended to pages and collection records into projects (deeper cross-entity drop validation)
- [ ] "Recently viewed" / pinned shortcuts above the tree — add once real usage shows the tree gets deep enough that jumping straight to a frequent item saves time
- [ ] Bulk archive/move (multi-select in tree) — add once single-item flows are validated and users ask for batch operations

### Future Consideration (v2+)

- [ ] Per-user custom ordering/starring — defer until there's evidence teams actually disagree on canonical order (unlikely for shared logistics ops structure)
- [ ] Cross-cutting saved "portfolio" views spanning multiple projects — defer; `collection_views` already covers cross-cutting data views, revisit only if a real workflow can't be expressed that way
- [ ] Real-time collaborative drag/reorder cursors — defer indefinitely unless multi-user concurrent reorganization becomes a measured pain point

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unified tree read API + breadcrumb resolution | HIGH | MEDIUM | P1 |
| Tree sidebar (expand/collapse, module-aware) | HIGH | MEDIUM | P1 |
| Drag-to-reorder (siblings) | HIGH | LOW | P1 |
| Drag-to-re-parent (folder/project) | MEDIUM | MEDIUM | P1 |
| Create/rename/move flows | HIGH | LOW | P1 |
| Archive vs delete semantics + `archived_at` schema | HIGH | MEDIUM | P1 |
| Empty states | MEDIUM | LOW | P1 |
| Cross-links into `data_collections`/views from tree | MEDIUM | MEDIUM | P2 |
| Bulk operations (multi-select archive/move) | LOW–MEDIUM | MEDIUM | P2 |
| Pinned/starred shortcuts | LOW | LOW | P3 |
| Per-user custom ordering | LOW | MEDIUM | P3 |
| Portfolios-of-portfolios cross-cutting views | LOW | HIGH | P3 (anti-feature, not recommended) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration (some flagged above are anti-features, not recommended at all)

## Competitor Feature Analysis

| Feature | Notion | ClickUp | Linear | Our Approach |
|---------|--------|---------|--------|--------------|
| Hierarchy depth | Unlimited page nesting | Space → Folder → List → Task (roughly 3–4 fixed levels) | Team → Sub-team → Project → Issue (recently added sub-teams) | Fixed 3-level model (folder → project → page/record) matching ClickUp/Linear's bounded depth, not Notion's unlimited depth — better fit for ops teams |
| Reorder | Drag pages in sidebar, drop-to-nest | Drag folders within a space | Minimal — flat list, drag not emphasized | Drag-to-reorder siblings + drag-to-re-parent, using existing `sort_order` columns |
| Breadcrumbs | Real-time updating breadcrumb trail per page, clickable ancestors | Less emphasized; relies on sidebar highlighting | Minimal breadcrumbs; relies on top command palette | Generic ancestor-path service producing consistent breadcrumbs across folder/project/page/record |
| Archive vs delete | Trash with recovery window | Explicit Archive action (hidden from sidebar, fully searchable/restorable) + separate Delete with 30-day recovery | N/A (issues use "Cancelled"/"Done" states, not archive) | Archive as default hide action (new `archived_at`), preserving existing non-cascading delete precedent from `folders` migration — closer to ClickUp's model than Notion's trash-everything model |
| Module/tenant-scoped visibility | N/A (no module licensing concept) | N/A | N/A | Unique to Vectra: tree visibility must intersect with `workspace.enabled_modules` at every depth — no direct precedent in any competitor studied |

## Sources

- [Notion Help Center: Navigate with the sidebar](https://www.notion.com/help/navigate-with-the-sidebar)
- [Notion Academy: Pages, breadcrumbs and sidebar](https://www.notion.com/help/notion-academy/lesson/pages-breadcrumbs-and-sidebar)
- [Bardeen: Nesting Pages in Notion](https://www.bardeen.ai/answers/how-do-you-nest-pages-in-notion)
- [ClickUp Help: Archive or restore Folders and Lists](https://help.clickup.com/hc/en-us/articles/6308811160599-Archive-or-restore-Folders-and-Lists)
- [ClickUp Help: Intro to the Hierarchy](https://help.clickup.com/hc/en-us/articles/13856392825367-Intro-to-the-Hierarchy)
- [ClickUp Help: Space, Folder, Subfolder, and List settings](https://help.clickup.com/hc/en-us/articles/33777837994775-Space-Folder-Subfolder-and-List-settings)
- [Linear Docs: Sub-teams](https://linear.app/docs/sub-teams)
- [Linear Docs: Teams](https://linear.app/docs/teams)
- [Linear: How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Asana Forum: Hierarchical Navigation in left sidebar](https://forum.asana.com/t/hierarchical-navigation-in-left-sidebar-view-projects-within-nested-portfolios/1093427)
- [Asana Help Center: Portfolios overview](https://help.asana.com/hc/en-us/articles/14212495456539-Portfolios-overview)
- Internal: `database/migrations/004_projects_and_programs.sql`, `006_folders.sql`, `012_page_hierarchy.sql`, `025_records_views.sql` (existing Vectra schema, MEDIUM–HIGH confidence, read directly)
- Internal: `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` (current flat `ITEMS`/`enabled_modules` filter, read directly)

---
*Feature research for: Unified workspace hierarchy (folder/project/page tree navigation), Vectra v6.0*
*Researched: 2026-07-16*
