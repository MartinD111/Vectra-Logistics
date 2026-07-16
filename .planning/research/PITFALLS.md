# Pitfalls Research

**Domain:** Unified workspace hierarchy (folder → project → page/record tree) added to an existing multi-tenant, capability-gated workspace platform
**Researched:** 2026-07-16
**Confidence:** HIGH (architectural/data-model pitfalls, verified against current Vectra v5 patterns) / MEDIUM (dnd-kit + React Query specifics, verified against community reports)

## Critical Pitfalls

### Pitfall 1: Cross-tenant leakage via recursive tree traversal that only checks the root node

**What goes wrong:**
A folder/tree API checks `companyId` on the *root* node of a request (e.g. "does this folder belong to this company?") and then recursively walks children using `parent_id` joins or a recursive CTE without re-applying the `company_id` filter at every level. If a node's `parent_id` ever points cross-tenant (bad data, bug, or an admin/import tool), the traversal silently returns another tenant's rows. This is worse than a normal N+1 leak because tree endpoints (`GET /folders/:id/tree`, breadcrumb resolution, "move to folder" pickers) are exactly the code paths that recurse without the per-row scoping the rest of the codebase relies on.

**Why it happens:**
Vectra's whole tenancy model is row-level (`WHERE company_id = $1` on every query, no schema-level isolation). Every other domain in the codebase does this per-query. A tree is the first structure where a single logical request needs *N* rows joined by parent/child links rather than a flat list — engineers reach for a recursive CTE or in-memory graph walk and treat "I already validated the root belongs to this tenant" as sufficient, forgetting that a recursive CTE has no implicit tenant filter unless it's added to *every* recursive step.

**How to avoid:**
- In the recursive CTE, add `AND company_id = $1` in both the base case and the recursive step — not just the base case.
- Never resolve a node purely by its own PK; always resolve `(id, company_id)` as a compound lookup, including for parent_id foreign key checks during writes.
- Add a DB-level invariant: `parent_id` FK should reference a `(id, company_id)` composite unique key (not just `id`), so a child row physically cannot point to a parent in a different company_id. This turns a runtime bug into an impossible state.
- Route every read (tree fetch, breadcrumb, ancestor/descendant lookup) through one repository method, not ad hoc queries, so the tenant filter is enforced in one place.

**Warning signs:**
- Any raw SQL or query builder call inside the folders/projects domain that references `parent_id` or `WITH RECURSIVE` without `company_id` on the same line.
- Tree endpoints that accept a bare `folderId` param with no separate company scoping in the controller (relying on "the join will handle it").
- Integration/QA tests only ever create trees within a single tenant — no test asserts that a node in tenant A can't be reached by an authenticated user in tenant B even by ID guessing.

**Phase to address:**
Data model + API phase (folder/project/page tree data model + API). This must be caught before the UI phase builds against the API, since fixing it later means changing the FK schema.

---

### Pitfall 2: Cycle creation on move/re-parent (A → B → A, or node becomes its own ancestor)

**What goes wrong:**
A "move folder" or "move project into folder" operation sets `parent_id = targetFolderId` without checking whether `targetFolderId` is a descendant of the node being moved. This creates a cycle: recursive queries (breadcrumbs, tree render, cascade delete) either infinite-loop, blow the stack, or in Postgres recursive CTEs hit `ERROR: recursion terminated because of a cyclical loop` at read time — potentially discovered by an end user loading their sidebar, not by the person who made the bad move.

**Why it happens:**
The naive "move" implementation is a single `UPDATE folders SET parent_id = $new WHERE id = $moved AND company_id = $tenant`, which is correct for the leaf case but has no idea whether `$new` sits underneath `$moved` in the tree. Drag-and-drop UIs make this worse because the drop target is often computed client-side and only round-trips an ID, with no ancestry check unless the API enforces it.

**How to avoid:**
- On every re-parent write, walk from the proposed new parent up to the root (or check `new_parent_id`'s ancestor path against `moved_id`) inside the same transaction, and reject with a 400 if `moved_id` appears in that ancestor chain (including `new_parent_id === moved_id` itself).
- This check is cheapest if the tree already stores a materialized ancestor path (see Pitfall 4) — ancestry check becomes `new_parent.path LIKE moved.path || '%'` instead of a recursive walk.
- Add a DB constraint or trigger as defense-in-depth (Postgres doesn't have native cycle-prevention for adjacency lists, but a `BEFORE UPDATE` trigger that raises on cycle detection is standard practice) so an API bug can't corrupt data even if the app-layer check is skipped.
- Reject self-parenting (`parent_id = id`) and same-parent no-op moves cleanly and idempotently — these are the two edge cases manual QA misses first.

**Warning signs:**
- Move/re-parent endpoint has no query or check referencing the node being moved *and* the destination together — only validates each independently.
- No test case for "drag a folder onto one of its own children" in the DnD sidebar.
- Tree render logic (breadcrumbs, recursive expand) has no max-depth guard — if a cycle ever gets in, this is what will hang the browser tab rather than fail gracefully.

**Phase to address:**
Data model + API phase for the DB-level guard; the create/rename/move/delete/archive flows phase for the app-level validation and the corresponding 400 error surfaced to the drag-and-drop UI.

---

### Pitfall 3: Orphaned or "zombie visible" children on delete/archive

**What goes wrong:**
Deleting or archiving a folder either (a) hard-deletes the row and leaves children with a dangling `parent_id` pointing at nothing (breaks tree render, breadcrumb resolution, and any `data_collections`/record cross-links that reference the folder), or (b) soft-archives the folder but leaves children `active` and still visible in the sidebar — so a user sees a project floating with no folder context, or worse, still fully editable and creating new content under an "archived" location that no longer appears anywhere in navigation.

**Why it happens:**
Vectra's own conventions (SQL migrations, `ON DELETE CASCADE/SET NULL`) make cascade behavior a per-migration decision, and folders are exactly the case where the "obviously correct" cascade direction is not obvious: hard-delete-cascade destroys projects/pages/records nobody asked to delete; `SET NULL` orphans them into a tenant's root with no folder; and simple archive-the-row-only leaves an inconsistent tree. Records/pages under a folder are also referenced by the existing `data_collections`/records domain — a naive folder delete has no idea it needs to cascade an *archived* state (not deleted) into an unrelated domain's tables.

**How to avoid:**
- Treat "archive" as the only default supported action for non-empty folders/projects: recursively mark all descendants `archived_at = now()` in the same transaction as the parent, and hide archived subtrees from default tree queries (`WHERE archived_at IS NULL`) rather than deleting rows.
- Require an explicit, separate "delete permanently" action (with a confirmation that lists what will be destroyed, including cross-linked `data_collections`/records) that only operates on already-archived, empty subtrees — never allow permanent delete of a folder with active (non-archived) descendants.
- For any node that is a project/page also referenced from `data_collections` or another domain, add an explicit repository check: does anything outside the tree reference this node? If yes, either block delete or cascade the archive into that reference (e.g. mark linked collection view as "source archived") rather than silently detaching it.
- Never allow `parent_id` to dangle: either the whole subtree cascades to the same state as its parent, or the move/delete is rejected.

**Warning signs:**
- Delete endpoint operates on a single row without a preceding "list all descendants" query.
- No `archived_at`/`deleted_at` column distinction — only a hard DELETE statement in the migration.
- Sidebar tree query filters `WHERE parent_id = X` per level without also filtering `archived_at IS NULL` at every level (a folder can be archived while a child project underneath still shows active, because the child query never checks ancestor archived state).

**Phase to address:**
Data model phase (schema for `archived_at` + cascade rules) and the create/rename/move/delete/archive flows phase (transactional cascade logic + confirmation UX).

---

### Pitfall 4: N+1 query storms when rendering deep trees (adjacency-list-only model)

**What goes wrong:**
The simplest tree schema is `folders(id, parent_id, company_id, ...)`. Rendering a sidebar tree, a breadcrumb trail, or "move to..." picker with only this schema tempts one of two N+1 patterns: (a) fetch root folders, then one query per folder to fetch its children, recursively, per expand — turns a 4-level-deep tree into dozens of round trips; or (b) fetch the whole tenant's folder rows to build the tree client-side, which works at small scale but becomes a full-table-per-render problem as tenants accumulate hundreds of folders/projects (and this endpoint gets hit on every page load, not just once).

**Why it happens:**
Adjacency list is genuinely the simplest model to reason about and matches how `parent_id` foreign keys are usually introduced first. It's also what the "reuse over rebuild" constraint nudges toward, since it looks the most like existing tables. The N+1 cost is invisible in dev/demo data (a handful of folders) and only shows up once a real tenant has a deep or wide tree.

**How to avoid:**
- Fetch the full tenant folder/project tree (or a bounded expanded-subtree) in a single query and build the tree in application code, rather than one query per level. A single `SELECT * FROM folders WHERE company_id = $1 AND archived_at IS NULL` (bounded by tenant size, which is already the isolation boundary) plus in-memory tree assembly is the correct default — trees at workspace scale are not "big data."
- If ancestor/descendant queries are common (breadcrumbs, "move into" validation, subtree archive), add a materialized path or closure table alongside the adjacency list rather than relying purely on recursive CTEs at request time. Materialized path (e.g. Postgres `ltree` or a simple `/root-id/child-id/` text column) makes "give me this node's ancestors" and "give me this node's whole subtree" both single indexed queries, at the cost of updating the path column for the moved subtree on re-parent — an acceptable tradeoff since folder moves are far rarer than folder reads.
- For breadcrumbs specifically, do not walk `parent_id` one row at a time from the page one query per hop — resolve breadcrumbs from the materialized path or from the already-fetched full tree, not a fresh query per ancestor.
- Cache the tenant's tree client-side (React Query) keyed by `companyId`, with a reasonably long `staleTime`, since folder structure changes far less often than the content inside it.

**Warning signs:**
- Any loop (server or client) that issues a query/fetch per tree node rather than per tree.
- Sidebar network tab shows request count scaling with number of expanded folders rather than being constant.
- No index on `(company_id, parent_id)` — a sign the tree queries weren't designed for this access pattern.

**Phase to address:**
Data model phase (choose adjacency list + materialized path/ancestor index, not adjacency-list-only) and API phase (single tree-fetch endpoint, not per-node endpoints).

---

### Pitfall 5: Drag-and-drop reorder race conditions and optimistic-update flicker/data-loss with React Query

**What goes wrong:**
Two distinct failure modes compound here. First, "sort flicker": setting the React Query cache directly on drop, then having a background refetch land while `@dnd-kit`'s drop animation is still resolving, causes the item to visibly snap back to its old position for a moment or duplicate itself in the list — because dnd-kit's `SortableContext` derives order from the array identity/order it's given, and a refetch mid-drag replaces that array out from under an in-flight optimistic update. Second, and more serious for a tenant-facing tree: two overlapping mutations (e.g. reordering siblings while another tab or the same session's autosave also mutates the tree) can race on the "compute new order/position values" step — if reordering assigns fractional/integer `position` values computed from a client-held snapshot, two concurrent moves can both compute overlapping positions, and the loser's optimistic update is silently discarded on refetch without any user-visible conflict message.

**Why it happens:**
Vectra already uses `@dnd-kit` and React Query elsewhere, so this pattern will likely be copy-pasted into the tree sidebar without adapting it for the tree's specific realtime characteristics: unlike a single flat sortable list scoped to one query key, a tree reorder mutation can affect multiple query keys at once (moved node's old parent's children list, new parent's children list, and the moved node itself) and this is also a domain with an existing WebSocket/event-outbox mechanism (Socket.io rooms, `event_outbox`) that can push a server-driven refetch mid-drag — a hazard flat lists elsewhere in the codebase don't have.

**How to avoid:**
- Keep local component state as the source of truth for the in-progress drag (per dnd-kit's own guidance), and only reconcile that local state with the React Query cache in `onDragEnd`'s `onMutate`/optimistic step — never let a background refetch (including a websocket-triggered invalidation) replace the sortable list's array while a drag gesture is active. Gate cache-driven re-renders of the sortable list behind an `isDragging` flag.
- Use `onMutate` to snapshot the previous tree state and return a rollback function passed to both `onError` and `onSettled`, per TanStack Query's documented optimistic update pattern — don't rely on a bare refetch-on-error, since a stale refetch can race with a second in-flight mutation and "fix" the UI to the wrong intermediate state.
- Compute ordering server-side as the source of truth (e.g. sparse integer `position` reassigned transactionally on move, or a fractional-index scheme), and treat the client's drop position purely as a hint. On write, take a row lock (`SELECT ... FOR UPDATE`) on the affected sibling set within the transaction so two concurrent reorders in the same folder serialize instead of interleaving.
- Emit exactly one `event_outbox` event per completed reorder/move (not one per intermediate drag position), and make sure the corresponding realtime invalidation on other connected clients doesn't fire mid-drag on the *originating* client's own session (standard "ignore my own echo" websocket pattern already likely used elsewhere for page edits).

**Warning signs:**
- Sortable folder items visibly jump/flicker back to old position after drop, especially on slower networks.
- Reordering the same folder from two open tabs (or two users) produces a final order that matches neither user's intent.
- The reorder mutation touches `position` as a plain sequential integer recalculated from the full sibling array on every move — a sure sign of an eventual "off by one" or duplicate-position bug under concurrency.

**Phase to address:**
UI phase (tree-based sidebar navigation with drag-to-reorder) for the dnd-kit/React Query integration; API phase must first deliver a transactional, lock-safe move/reorder endpoint for the UI to call.

---

### Pitfall 6: Breaking existing bookmarked/deep-linked URLs when the tree replaces the flat sidebar

**What goes wrong:**
Today's navigation is a flat, module-keyed sidebar (`WorkspaceSidebar.tsx` `ITEMS` array) and project/page/record URLs presumably encode IDs directly (e.g. `/projects/:id`, `/records/:id`) without any folder segment. Introducing a tree changes the *conceptual* location of a project/page but must not change its *URL* — if the new hierarchy is implemented by encoding the folder path into the URL (e.g. `/folders/:folderId/projects/:id`), every existing bookmark, shared link, email-embedded link (the CRM domain already syncs real email history from Outlook and links back into the app), and any hardcoded `crossAppUrl` new-tab link from CMR/Marketplace into Workspaces breaks the moment a project is moved into a different folder, because the folder segment of the URL is now stale.

**Why it happens:**
It's natural to want URLs to "reflect" the tree for readability/breadcrumbs, but folder location is mutable (users will reorganize) while a deep link needs to be stable. Teams frequently conflate "the tree is how you navigate" with "the tree is how you address," and bake the current folder path into the canonical URL, only to discover months later that every stored/shared link silently 404s or resolves to the wrong node after a single reorganization.

**How to avoid:**
- Keep canonical URLs keyed by stable entity ID only (`/projects/:id`, `/records/:id`), exactly as today — never require or embed the folder path as the addressing mechanism. The tree is a navigation affordance, not a routing scheme.
- If folder context is desired in the URL for readability/shareability, treat it as a non-authoritative query param or trailing breadcrumb slug that the server ignores for lookup and only uses to render breadcrumbs, redirecting to the canonical path if it's stale/wrong rather than 404ing.
- Audit and explicitly test every existing deep-link entry point before shipping: `crossAppUrl` new-tab links (CMR/Marketplace → Workspaces), Outlook-synced email bodies with embedded links (CRM), and any previously bookmarked module-level sidebar routes (e.g. `/workspace/fleet`) that the flat `ITEMS` list generated — confirm none of them assume the old flat sidebar's route shape.
- Since `enabled_modules`-based visibility currently drives which flat items show, make sure the tree's module-aware visibility (explicitly called out as a v6 requirement) filters *tree rendering*, not the underlying entity's addressability — a project inside a folder for a disabled module should still resolve by direct URL for a user who already has the link and appropriate capability, even if it doesn't appear in their tree.

**Warning signs:**
- Any new route definition that includes `folderId` as a required path segment for a project/page/record detail view.
- No regression test/checklist item for "does an existing bookmarked URL from before v6 still resolve after this ships."
- Breadcrumb component that derives the *current* location by parsing the URL path rather than by looking up the entity's live parent chain from the DB.

**Phase to address:**
UI phase (tree-based sidebar navigation and breadcrumbs) — but the constraint ("URLs are ID-keyed, not path-keyed") must be a stated invariant from the data model/API phase onward so the UI phase doesn't have to retrofit it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Adjacency-list-only schema, no materialized path/closure table | Simpler migration, matches existing FK conventions | Every ancestor/descendant/breadcrumb query needs a recursive CTE or N+1 walk; expensive to retrofit path column onto a live, populated tree | Only if the tenant tree depth/breadth is proven small (e.g. <4 levels, <200 nodes) and breadcrumbs are the only ancestor query needed — otherwise add the path column at data-model time, not later |
| Hard delete instead of archive-cascade | Less schema/UI to build initially | Orphaned children, broken cross-links to `data_collections`, no undo | Never for folders/projects containing user data; acceptable only for empty, never-populated nodes |
| Client-computed sibling order recalculated as full-array on every drop | Fast to implement with dnd-kit's default example | Concurrency bugs, no partial-move efficiency, races under multi-tab/multi-user reorder | Prototype/demo only; must move to server-authoritative locked reorder before real usage |
| Folder path embedded in canonical URL | Nice-looking, human-readable URLs immediately | Every reorganization breaks bookmarks/shared links/CRM email links | Never for canonical routing; acceptable only as a cosmetic trailing slug ignored by the router |
| Skipping the cycle-prevention check on move because "the UI won't let you drop there" | Faster initial API shipped | Any non-UI caller (import tool, API client, future admin action, race condition) can create an unrecoverable cycle | Never — cycle check belongs in the API/DB layer regardless of UI affordances |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| `event_outbox` (v5 durable events) | Emitting one event per intermediate drag position or per row touched during a bulk archive cascade, flooding the outbox and downstream consumers | Emit one coarse-grained event per completed user action (e.g. `folder.moved`, `folder.archived` with descendant count), let consumers fetch current state rather than replay every intermediate step |
| Request/capability spine (v5) | Checking capability only at the tree root (e.g. "can view this workspace") and assuming it implies permission on every descendant node reached via traversal | Re-check the relevant capability at the specific node being acted on (move/delete/rename), especially once per-folder or per-project sharing/visibility is possible; don't let root-level capability implicitly grant subtree-wide access if finer-grained capabilities exist |
| `data_collections`/records domain | Treating "folder" as a new top-level concept disconnected from existing collections/records, leading to duplicate parent/ownership concepts (a record has both a `collection_id` and now a `folder_id` that can disagree) | Treat folder as a pure navigational/organizational parent that *references* existing `data_collections`/project/page IDs rather than duplicating their identity or ownership fields; a single source of truth for "what is this record's collection" stays in the records domain |
| `@dnd-kit` (already used elsewhere for flat lists/kanban) | Reusing a flat `SortableContext` example verbatim for a nested tree, where drop targets must disambiguate "reorder among siblings" vs "reparent into a folder" (e.g. dropping onto vs. between items) | Use distinct drop zones/hit-testing for "insert between siblings" vs "drop onto folder to reparent," and disable illegal drop targets (self, descendants) at the DnD layer as a UX nicety — while still enforcing the same rule server-side |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Per-level query on sidebar expand | Network tab request count grows with number of expanded folders; slow expand-all | Fetch full tenant tree (or bounded subtree) in one query, assemble in memory | Noticeable once a tenant has 3+ levels or 50+ nodes |
| Recursive CTE without ancestor index on every breadcrumb render | Page navigation feels sluggish specifically on deeply nested pages | Materialized path or cached ancestor chain from already-fetched tree | Breaks down past ~5-6 levels deep or high request volume |
| Full-tree refetch on every single node rename/create | Sidebar flickers/re-renders entirely for a one-node change; wasted bandwidth for large tenants | Server returns just the changed node(s); React Query cache patched surgically (updateQueryData) rather than full invalidate+refetch | Noticeable once tree exceeds a few hundred nodes or on slower connections |
| Recomputing all sibling `position` values on every reorder | Write amplification (every sibling row touched) under moderate reorder frequency; lock contention across concurrent users reordering the same folder | Use fractional/sparse position values so a single move only touches the moved row (occasionally rebalance) | Breaks down as reorder frequency or sibling count grows, and under concurrent multi-user reordering of the same folder |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-supplied `parentId`/`companyId` on tree writes without server-side re-derivation of tenant from the authenticated session | Cross-tenant folder creation or re-parenting via forged request body | Always derive `company_id` from `req.companyId` (authenticated context), never accept it from the request body, on every folder/project write |
| Allowing a "move" between folders without checking the *destination* folder's tenant/capability, only the moved node's | A malicious or buggy client could move a node into another tenant's folder, or into a folder outside the user's capability scope, if only the source is validated | Validate both source and destination node belong to the same `company_id` and the acting user has write capability on both, inside the same transaction |
| Recursive descendant queries used for authorization decisions (e.g. "user has access to this folder therefore access to all descendants") without accounting for archived/soft-deleted or capability-overridden descendants | Users might retain or gain access to content that should be more restricted, or lose access to content that should inherit differently once folder-level sharing overrides exist | Keep capability checks explicit per-node via the v5 request/capability spine rather than inferring transitively from tree position, unless inheritance is an explicit, tested design decision |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Silent failure on illegal move (cycle, cross-tenant, no-op) — the UI just snaps back with no explanation | User doesn't understand why drag-and-drop "didn't work," repeats the same failing action | Surface a specific inline error/toast ("Can't move a folder into its own subfolder") distinguishing cycle vs permission vs no-op cases |
| Archiving a folder with children with no preview of what's inside | User accidentally hides an entire subtree of active projects, discovers it days later | Show a confirmation listing descendant count/types before archive, with an easy "undo"/unarchive path |
| Tree expand/collapse state not persisted across navigation or reload | User re-expands the same folders every session, workspace feels like it "forgets" | Persist expand/collapse state (per user, per workspace) client-side (e.g. localStorage) or server-side alongside other UI preferences |
| Breadcrumbs that don't match sidebar tree state (e.g. breadcrumb shows a path but sidebar collapses back to flat view) | Users lose the mental model of "where am I," undermining the whole point of adding a tree | Drive both breadcrumbs and sidebar highlight/expand state from the same single source (the entity's live ancestor chain), not independently computed |

## "Looks Done But Isn't" Checklist

- [ ] **Tree API tenant isolation:** Often missing per-level `company_id` re-check in recursive CTEs — verify with a test that attempts cross-tenant traversal by ID guessing, not just by listing.
- [ ] **Move/reparent endpoint:** Often missing cycle detection — verify by attempting to drag a folder onto its own descendant in a test, and by directly calling the API with a crafted cyclic move.
- [ ] **Delete/archive flow:** Often missing cascade to descendants and to cross-linked `data_collections`/records — verify an archived folder's projects/pages disappear from default tree views and any linked collection views reflect the archived state.
- [ ] **Sidebar tree fetch:** Often missing single-query tree assembly — verify network tab shows a constant (not per-node) number of requests when expanding a multi-level tree.
- [ ] **Drag-to-reorder:** Often missing server-side lock/transaction on the sibling set — verify with a concurrent-move test (two near-simultaneous reorders in the same folder) that the final order is deterministic and no position collides.
- [ ] **Existing deep links:** Often missing regression coverage for pre-v6 bookmarked URLs — verify that `/projects/:id`, `/records/:id`, and any `crossAppUrl` links generated before this milestone still resolve correctly after a project is moved to a different folder.
- [ ] **Module-aware visibility on the tree:** Often missing enforcement at the tree level even though flat sidebar enforced it — verify a folder containing only disabled-module content is hidden/filtered, not just the flat items that used to represent it.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| Cross-tenant leakage discovered post-launch | HIGH | Immediately patch the missing filter, audit `event_outbox`/logs for evidence of cross-tenant reads, add the composite FK constraint retroactively (requires a data audit/cleanup migration first if any bad rows exist), notify affected tenants per incident policy |
| Cycle got created despite prevention (e.g. via a bulk import bug) | MEDIUM | Add a one-off detection query (recursive CTE with a depth cap that flags rows exceeding expected max depth or revisiting an ancestor) to find affected trees, manually break the cycle by nulling/reassigning the offending `parent_id`, then ship the missing app/DB-level guard |
| Orphaned children found in production data | MEDIUM | Write a repair migration: for rows with `parent_id` referencing a nonexistent or already-archived folder, either re-parent to the workspace root or mark them archived to match their (former) parent's state; add the missing cascade logic going forward |
| N+1 tree rendering shipped and now slow at scale | LOW–MEDIUM | Swap the per-node fetch endpoint for a single tenant-tree endpoint behind a feature flag, keep the old endpoint temporarily for backward compatibility during rollout, monitor query counts before fully cutting over |
| Broken deep links reported by users after tree ships | LOW if URLs were always ID-keyed (just fix the specific resolver bug); HIGH if folder path was baked into canonical routing (requires a redirect/alias layer for all previously-shared URLs) | Add a redirect table mapping old path-based routes to canonical ID-based routes if the mistake already shipped; going forward, never re-introduce path-based canonical routing |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| Cross-tenant leakage via tree traversal | Data model + API phase | Automated test: authenticated user from tenant A cannot fetch/traverse into tenant B's folder tree by ID, including via recursive/descendant endpoints |
| Cycle creation on move/re-parent | Data model + API phase (DB guard) and create/rename/move/delete/archive flows phase (app validation + error UX) | Test: attempt to move a folder into its own descendant returns 400, not a hang or corrupted tree; DB-level trigger/constraint rejects it even bypassing the app layer |
| Orphaned children on delete/archive | Data model phase (archived_at + cascade schema) and create/rename/move/delete/archive flows phase (transactional cascade) | Test: archiving a folder with nested children and cross-linked records leaves no active, unreachable descendant; hard delete is blocked unless subtree is fully archived and empty |
| N+1 query patterns on deep trees | Data model phase (ancestor index/materialized path) and API phase (single tree-fetch endpoint) | Load test: request count and latency for tree fetch stay flat as node count/depth grows within expected tenant scale |
| Drag-and-drop reorder races / optimistic update bugs | API phase (locked, transactional move/reorder endpoint) and UI phase (dnd-kit + React Query integration) | Test: two concurrent reorder mutations on the same folder's siblings converge to a consistent, non-colliding order; UI shows no flicker/snap-back on normal single-user drop |
| Breaking existing deep links | Data model/API phase (state the ID-keyed routing invariant) and UI phase (breadcrumbs/sidebar built without path-based routing) | Regression test: pre-v6 bookmarked `/projects/:id` and `crossAppUrl` links resolve correctly after the referenced project is moved to a different folder |

## Sources

- [Hierarchical models in PostgreSQL — Ackee blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
- [Storing Hierarchical Data in Relational Databases with SQL](https://adamdjellouli.com/articles/databases_notes/03_sql/09_hierarchical_data)
- [From Trees to Tables: Storing Hierarchical Data in Relational Databases — Medium](https://medium.com/@rishabhdevmanu/from-trees-to-tables-storing-hierarchical-data-in-relational-databases-a5e5e6e1bd64)
- [DAGs with materialized paths using postgres ltree — bustawin](https://www.bustawin.com/dags-with-materialized-paths-using-postgres-ltree/)
- [What are the options for storing hierarchical data in a relational database?](https://www.techgrind.io/explain/what-are-the-options-for-storing-hierarchical-data-in-a-relational-database)
- [Multi-tenant data isolation with PostgreSQL Row Level Security — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Strict Data Isolation in Multi-tenant Systems with PostgreSQL — Medium](https://medium.com/@moyo.sore.oluwa/strict-data-isolation-in-multitenant-systems-with-postgresql-aa615052fe80)
- [Designing Your Postgres Database for Multi-tenancy — Crunchy Data Blog](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy)
- [React Query with DnD Kit: Item Goes Back to Original Position for a Split Second on Drop — dnd-kit GitHub Discussion #1522](https://github.com/clauderic/dnd-kit/discussions/1522)
- [Managing Sortable State — React | dnd kit](https://dndkit.com/react/guides/sortable-state-management/)
- [Sorting is not working as expected with react-query — dnd-kit GitHub Issue #921](https://github.com/clauderic/dnd-kit/issues/921)
- [Optimistic Updates | TanStack Query React Docs](https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates)
- Internal: `.planning/PROJECT.md` (v6.0 milestone scope, v5 request/capability/event contract, existing domain boundaries)

---
*Pitfalls research for: Unified workspace hierarchy (v6.0 milestone) — Vectra Platform*
*Researched: 2026-07-16*
