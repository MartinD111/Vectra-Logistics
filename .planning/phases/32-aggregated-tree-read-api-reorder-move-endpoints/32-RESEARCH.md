# Phase 32: Aggregated Tree Read API + Reorder/Move Endpoints - Research

**Researched:** 2026-07-17
**Domain:** Internal Express/TypeScript DDD API extension — multi-domain read aggregation + transactional, lock-safe write endpoints on top of the Phase 31 folders/projects/programs/records schema. No new external library.
**Confidence:** MEDIUM-HIGH — the v5 pattern to extend is fully present and read in full this session (HIGH); the reorder/lock-safety design has **no existing precedent anywhere in this codebase** (no `sort_order` column on `projects`/`programs`/`data_collections`, no fractional-position scheme, no `SELECT ... FOR UPDATE` outside the outbox worker), so that portion is standard-PostgreSQL-technique reasoning, not a verified in-repo pattern (MEDIUM).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREEAPI-01 | A single tenant-scoped endpoint (`GET /folders/tree/full`) returns the full workspace tree (folders + projects + programs + collections + pages) in one request, without per-node fan-out queries | Pattern 1 (5 parallel flat queries + in-memory assembly, reusing existing `listFolders`/`listProjects`/`listPrograms`/`listAllPages`/`listCollections`) |
| TREEAPI-02 | A reorder endpoint updates sibling order for a moved node using server-authoritative, lock-safe positions, with no lost updates under concurrent reorder | Pattern 2 (`FOR UPDATE` + single renumber `UPDATE ... FROM VALUES`), plus the new `029_tree_sort_order.sql` migration adding `sort_order` to `projects`/`programs`/`data_collections` (Common Pitfalls #2) |
| TREEAPI-03 | A move/reparent endpoint validates tenant ownership on both source and destination and rejects illegal moves (cycles, cross-tenant targets) with a specific error distinguishing the reason | Pattern 3 (dispatch-by-node_type, reusing existing `assertOwned*`/`findXForCompany` 404-on-cross-tenant checks and Phase 31's folder cycle/depth check via `foldersService.moveFolder()`) |
| TREEAPI-04 | All tree mutation endpoints are gated by the `workspace.admin` capability, consistent with the existing folders domain | Existing `assertCapability`/`requireCapability('workspace.admin')` machinery (`core/capabilities/index.ts`) — no new capability needed, wire both new routes exactly like existing `move`/`archive`/`unarchive` routes |

## Summary

Phase 31 shipped a fully modernized `folders` domain: `ancestor_ids` GIN-indexed array for O(1) descendant/depth lookups, composite `(id, company_id)` FK invariants across folders/projects/programs/data_collections/project_pages, a DB-level cycle+depth trigger on `folders`, and the v5 `RequestContext` + `assertCapability` + `event_outbox` pattern. Phase 32 does **not** need new schema-invariant work — it needs to (1) aggregate five already-existing flat, company-scoped repository list queries into one HTTP response shaped as a tree, and (2) add two genuinely new capabilities the codebase has never had before: a concurrency-safe sibling-reorder primitive, and a single move/reparent endpoint that works across five different node types (folder, project, program, data_collection, project_page), each of which currently reparents through its own domain's `PATCH` endpoint with a different foreign key (`parent_id`, `folder_id`, `project_id`, `parent_page_id`).

The read side (TREEAPI-01) is low-risk: `foldersRepository.listFolders`, `projectsRepository.listProjects`, `projectsRepository.listPrograms()` (no `projectId` arg → all programs), `projectsRepository.listAllPages`, and `recordsRepository.listCollections` already exist as single-query, company-scoped, non-fan-out reads. `GET /folders/tree/full` should call these five in parallel (`Promise.all`) and assemble the tree in application memory — no recursive CTE, no per-node query, matching the exact technique `folders.service.ts`'s existing `buildTree()` already uses for the folders-only tree today.

The write side is where real design work is needed. Two hard gaps were found:
1. **No `sort_order` column exists on `projects`, `programs`, or `data_collections`.** Only `folders`, `project_pages`, `collection_records`, and `collection_views` have one. TREEAPI-02 ("reordering siblings ... for any node") cannot be built for project/program/collection siblings without a new additive migration.
2. **No lock-safe write pattern exists anywhere in this codebase.** The only `SELECT ... FOR UPDATE` in the entire `apps/api/src` tree is the outbox worker's `FOR UPDATE SKIP LOCKED` claim query — not applicable to reorder. Every other mutation (including Phase 31's own `moveFolder`) is a plain last-write-wins `UPDATE`. The reorder endpoint must introduce a new (but standard) technique: a single transaction that locks the sibling row set and rewrites all affected `sort_order` values in one statement, so two concurrent reorders serialize instead of losing an update.

**Primary recommendation:** Build `GET /folders/tree/full`, `POST /folders/tree/reorder`, and `POST /folders/tree/move` as new endpoints in the existing `folders` domain (not a new domain) — exactly mirroring how Phase 31's `archiveFolder` already orchestrates cross-domain repository calls (`foldersRepository` + `projectsRepository` + `recordsRepository`) inside one transaction. Add `sort_order INTEGER NOT NULL DEFAULT 0` to `projects`, `programs`, and `data_collections` in a new additive migration (`029_...sql`). Implement reorder via `SELECT id FROM <table> WHERE <parent-scope> FOR UPDATE` (locks the sibling set) followed by a single `UPDATE ... FROM (VALUES ...) AS v(id, pos)` rewrite of `sort_order` in the same transaction — no advisory locks, no fractional/gap positions needed at this scale (typical sibling counts are small; a full renumber per reorder is cheap and avoids fractional-position float-precision edge cases).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregated tree read (`GET /folders/tree/full`) | API / Backend | Database / Storage (5 flat queries) | Assembly logic (nesting five entity types into one tree) belongs in the service layer, matching the existing `buildTree()` precedent; the DB only needs to serve 5 already-indexed, company-scoped flat SELECTs |
| Lock-safe reorder (`POST /folders/tree/reorder`) | Database / Storage (transaction + row lock) | API / Backend (validation, capability) | Row-level locking (`SELECT ... FOR UPDATE`) is the only mechanism that guarantees no lost update under concurrent reorders — must happen inside a DB transaction, not in application memory |
| Move/reparent validation (cycle, cross-tenant) | API / Backend | Database / Storage (existing folders cycle trigger, composite FKs as backstop) | For folder-to-folder moves, the Phase 31 trigger + composite FK are already the DB-level backstop; for project/program/collection/page reparenting (no self-nesting, so no cycle risk), the API layer's own tenant-ownership check via composite-FK-protected repository writes is sufficient |
| `workspace.admin` capability gate | API / Backend | — | Existing `assertCapability`/`requireCapability` machinery, no new capability needed |
| Durable event emission on reorder/move | API / Backend (same transaction) | — | Matches Phase 31's `insertDurableEvent` per-row pattern inside the same `db.connect()`/`BEGIN`/`COMMIT` block |

## Package Legitimacy Audit

Not applicable — this phase introduces no new external packages. All work uses `pg`, `zod`, `express` (already in `package.json`) and native PostgreSQL features (`FOR UPDATE`, `UPDATE ... FROM (VALUES ...)`). `slopcheck`/registry verification steps are skipped.

## Standard Stack

### Core
No new packages.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | 8.11.3 (existing) `[VERIFIED: codebase — apps/api/package.json]` | Transactional multi-statement reorder/move via `db.connect()` + `client.query('BEGIN'...)` | Already the project's only DB client; Phase 31's `archiveFolder`/`moveFolder` are the canonical transaction examples in this exact domain |
| `zod` | existing | DTO validation for new `ReorderSchema`/`MoveNodeSchema` | Matches `folders/dto/folder.dto.ts` convention |

### Supporting
None needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Integer `sort_order` + `FOR UPDATE` + full-renumber-on-reorder | Fractional/gap-based positions (e.g. `sort_order` as `NUMERIC`, insert-between via averaging) | Fractional positions avoid a full-table renumber on every reorder, but introduce float-precision exhaustion after many inserts-between-two-items, need periodic rebalancing, and — critically — **this codebase has zero precedent for fractional ordering** (every existing `sort_order` column is `INTEGER`). A full-renumber-per-reorder is O(n) in sibling count, which is small (bounded by UI-visible tree fan-out), so the simpler integer scheme is the better fit here. Flagged as Claude's discretion if CONTEXT.md later specifies large sibling counts (hundreds+ per parent). |
| `SELECT ... FOR UPDATE` row locks inside one transaction | Postgres advisory locks (`pg_advisory_xact_lock`) keyed on parent id | Advisory locks avoid touching row visibility, but this codebase has **zero precedent** for `pg_advisory_lock` anywhere; `FOR UPDATE` is the existing lock idiom (used by the outbox worker) and ties the lock directly to the rows being mutated, which is easier to reason about and test | 
| One `folders` domain endpoint dispatching into `projectsRepository`/`recordsRepository`/`foldersRepository` directly | A new cross-cutting `tree` domain | Phase 31's `archiveFolder` already established the precedent of the `folders` domain orchestrating writes across `projectsRepository`/`recordsRepository` inside one transaction. A new `tree` domain would duplicate that orchestration surface for no benefit — "reuse over rebuild" per project CLAUDE.md constraint |

**Installation:** None — no new packages.

**Version verification:** N/A (no external packages).

## Architecture Patterns

### System Architecture Diagram

```
Client (Phase 33/34 UI — not this phase)
        │
        ▼
Express routes (folders.routes.ts — extended)
  authenticateToken → requireCapability('workspace.admin') [reorder, move only]
        │
        ▼
folders.controller.ts (extended)
  requireRequestContext(req) → ctx: RequestContext
        │
        ├──▶ GET /tree/full ─────────────────────────────────────────┐
        │                                                             │
        ▼                                                             ▼
folders.service.ts                                          Promise.all([
  getFullTree(ctx)                                            foldersRepository.listFolders(tenantId),
    5 parallel flat queries, no per-node fan-out               projectsRepository.listProjects(tenantId),
    assemble in memory (extends existing buildTree() shape)    projectsRepository.listPrograms(tenantId),
                                                                 projectsRepository.listAllPages(tenantId),
                                                                 recordsRepository.listCollections(tenantId),
                                                               ])
        │
        ├──▶ POST /tree/reorder ──────────────────────────────────────┐
        │      assertCapability('workspace.admin')                    │
        │      Zod parse: { node_type, parent_id, ordered_ids[] }     ▼
        │      BEGIN                                          SELECT id FROM <table>
        │        SELECT id FROM <table>                        WHERE company_id=$1 AND <parent-scope>=$2
        │          WHERE company_id=$1 AND <parent-scope>=$2   FOR UPDATE
        │          FOR UPDATE                       ── locks sibling set, serializes concurrent reorders
        │        validate ordered_ids is exactly the locked set (else 409 — stale client state)
        │        UPDATE <table> SET sort_order = v.pos
        │          FROM (VALUES ($id1,0),($id2,1),...) AS v(id,pos)
        │          WHERE <table>.id = v.id
        │        insertDurableEvent(...) — one event per reordered node OR one batch event (see Open Questions)
        │      COMMIT
        │
        └──▶ POST /tree/move ─────────────────────────────────────────┐
               assertCapability('workspace.admin')                    │
               Zod parse: { node_type, node_id, new_parent_id }       ▼
               dispatch by node_type:                        folder   → foldersService.moveFolder() [existing, Phase 31]
                                                               project  → projectsRepository.updateProject(folder_id) [existing update path]
                                                               program  → projectsRepository.updateProgram(folder_id/project_id)
                                                               collection → recordsRepository.updateCollection(folder_id) [existing assertOwnedFolder 404 pattern]
                                                               page     → projectsRepository.updatePage(parent_page_id) [existing, same-project only]
               Validate destination tenant ownership BEFORE dispatch (assertOwnedFolder / assertOwnedProject, all 404-on-cross-tenant already)
               Reject folder→folder cycles via existing ancestor_ids check (Phase 31, reused, not reimplemented)
        │
        ▼  (single DB transaction via db.connect() for move + event, matching archiveFolder's shape)
event_outbox (existing table, existing dispatch worker) — no change needed this phase
```

### Recommended Project Structure

No new domain — extend the existing `folders` domain, since it already owns cross-domain orchestration (Phase 31's `archiveFolder`):

```
apps/api/src/domains/folders/
├── folders.controller.ts   # add: getFullTree, reorderNodes, moveNode handlers
├── folders.repository.ts   # unchanged (folder-only queries stay here)
├── folders.service.ts      # add: getFullTree() (aggregation), reorderSiblings(), moveNode() (dispatch by node_type)
├── folders.routes.ts       # add: GET /tree/full, POST /tree/reorder, POST /tree/move (all under existing router, workspace.admin gate on mutations)
├── folders.types.ts        # add: TreeNode discriminated union type (folder|project|program|collection|page) if the response needs a uniform shape
└── dto/
    └── tree.dto.ts         # new: ReorderNodesSchema, MoveNodeSchema (node_type enum + per-type payload)

apps/api/src/domains/projects/
└── projects.repository.ts  # add: sort_order-aware reorderProjects/reorderPrograms/reorderPages helpers (FOR UPDATE + renumber), used by folders.service.ts's dispatch

apps/api/src/domains/records/
└── records.repository.ts   # add: sort_order-aware reorderCollections helper, same shape

database/migrations/
└── 029_tree_sort_order.sql # new — additive sort_order columns on projects/programs/data_collections (see Code Examples)
```

### Pattern 1: Aggregated read — 5 flat queries + in-memory assembly (no per-node fan-out)

**What:** `GET /folders/tree/full` issues exactly 5 queries (one per entity type), each already `company_id`-scoped and indexed, run via `Promise.all`. The tree shape is built in application memory by grouping each entity list on its parent-reference field (`folders.parent_id`, `projects.folder_id`, `programs.folder_id`/`programs.project_id`, `data_collections.folder_id`, `project_pages.project_id`/`project_pages.parent_page_id`).

**When to use:** The single new `GET /folders/tree/full` endpoint. This satisfies TREEAPI-01's "no per-node fan-out" requirement because query count is constant (5) regardless of tree size/depth — it does not grow per node, per level, or per request the way a naive per-node child-fetch loop would.

**Example:**
```typescript
// Source: existing repository methods, apps/api/src/domains/{folders,projects,records}
async getFullTree(ctx: RequestContext) {
  const tenantId = requireCompanyId(ctx);
  const [folders, projects, programs, pages, collections] = await Promise.all([
    foldersRepository.listFolders(tenantId),
    projectsRepository.listProjects(tenantId),
    projectsRepository.listPrograms(tenantId),   // no projectId arg = all programs for tenant
    projectsRepository.listAllPages(tenantId),
    recordsRepository.listCollections(tenantId),
  ]);
  // group + nest in memory — same technique as folders.service.ts's existing buildTree()
  return assembleTree(folders, projects, programs, pages, collections);
}
```

### Pattern 2: Lock-safe reorder — `FOR UPDATE` + single renumber statement

**What:** Inside one transaction, lock the exact sibling row set with `SELECT id FROM <table> WHERE company_id=$1 AND <parent_scope>=$2 FOR UPDATE`, then rewrite every locked row's `sort_order` in a single `UPDATE ... FROM (VALUES ...) AS v(id, pos) WHERE <table>.id = v.id` statement. A second concurrent reorder request against the same parent blocks on the `FOR UPDATE` until the first transaction commits, then re-reads the now-current row set — no lost update, no silent overwrite.

**When to use:** `POST /folders/tree/reorder`, for whichever node type (`folders`, `projects`, `programs`, `data_collections`, `project_pages`) the request targets.

**Example:**
```sql
-- Source: standard PostgreSQL pessimistic-locking idiom; FOR UPDATE precedent
-- already exists in this codebase at apps/api/src/core/events/outbox.ts:125
BEGIN;

SELECT id FROM projects
  WHERE company_id = $1 AND folder_id = $2 AND archived_at IS NULL
  FOR UPDATE;
  -- ^ blocks a concurrent reorder of the SAME sibling set; does not block
  --   reorders of a different parent's siblings (different row set)

-- Client-supplied ordered_ids must be validated (server-side) to be exactly
-- the set of ids just locked — reject with 409 if the client's snapshot is
-- stale (a sibling was added/removed/moved since the client last read the tree).

UPDATE projects AS p
SET sort_order = v.pos, updated_at = NOW()
FROM (VALUES ($3::uuid, 0), ($4::uuid, 1), ($5::uuid, 2)) AS v(id, pos)
WHERE p.id = v.id;

COMMIT;
```

### Pattern 3: Generic move/reparent — dispatch to existing per-domain update paths, not a new write path

**What:** Every node type already has a working reparent mechanism through its own domain's existing `update*` repository method (`updateProject({folder_id})`, `updateProgram({project_id, folder_id})`, `updateCollection({folder_id})`, `updatePage({parent_page_id})`) or, for folders, the Phase 31 `foldersService.moveFolder()`. The new `POST /folders/tree/move` endpoint should be a thin dispatcher by `node_type` that (1) validates destination tenant ownership using each domain's existing `assertOwned*` helper (all already return 404 on cross-tenant, established in Phase 31/pre-31), (2) for `node_type: 'folder'`, delegates straight to `foldersService.moveFolder()` (reusing the existing ancestor_ids cycle/depth check, not reimplementing it), and (3) for all other node types, calls the existing repository update method with only the parent-pointer field set. For `node_type: 'program'`, since `programs` rows carry both `folder_id` and `project_id`, the dispatcher must accept an explicit scope disambiguator (see 32-01's `MoveNodeSchema.project_id` field) so a program can be reparented to either a folder or a project destination — not just folder destinations.

**When to use:** `POST /folders/tree/move`.

**Example:**
```typescript
// Source: dispatch pattern derived from existing per-domain update methods
// (apps/api/src/domains/{folders,projects,records}/*.service.ts)
async moveNode(ctx: RequestContext, body: unknown) {
  assertCapability(ctx, 'workspace.admin');
  const tenantId = requireCompanyId(ctx);
  const parsed = MoveNodeSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  const { node_type, node_id, new_parent_id, project_id } = parsed.data;

  switch (node_type) {
    case 'folder':
      // Reuses Phase 31's cycle/depth/tenant checks verbatim — do not reimplement.
      return foldersService.moveFolder(ctx, node_id, { parent_id: new_parent_id });
    case 'project': {
      if (new_parent_id) await this.assertOwnedFolder(new_parent_id, tenantId); // 404 on cross-tenant
      const updated = await projectsRepository.updateProject(node_id, { folder_id: new_parent_id });
      if (!updated) throw new AppError(404, 'Project not found');
      return updated;
    }
    case 'program': {
      // project_id set → project-scoped destination; omitted/null → folder-scoped destination.
      if (project_id) {
        await projectsRepository.findProjectForCompany(project_id, tenantId).then((p) => {
          if (!p) throw new AppError(404, 'Project not found');
        });
        return projectsRepository.updateProgram(node_id, { project_id, folder_id: null });
      }
      if (new_parent_id) await this.assertOwnedFolder(new_parent_id, tenantId);
      return projectsRepository.updateProgram(node_id, { folder_id: new_parent_id, project_id: null });
    }
    // ...collection follows the same shape
  }
}
```

### Anti-Patterns to Avoid

- **Recursive CTE for the full-tree read:** Explicitly what Phase 31's HIER-07 already replaced for folders; do not reintroduce it for the aggregated cross-entity tree either. Five flat queries + in-memory join is both simpler and faster at this scale (bounded depth 3, no unlimited nesting per REQUIREMENTS.md Out of Scope).
- **Per-node fan-out loop for the tree read:** e.g. "for each folder, query its projects" — this is exactly the anti-pattern TREEAPI-01 forbids. Always batch by entity type, never by parent node.
- **Fractional/`NUMERIC` sort_order "insert between" scheme:** No precedent in this codebase (every `sort_order` is `INTEGER`), adds float-precision exhaustion risk, and is unnecessary at expected sibling-count scale. Use full-renumber-on-reorder instead (Pattern 2).
- **Advisory locks (`pg_advisory_xact_lock`):** No precedent in this codebase. `FOR UPDATE` (already used by the outbox worker) is the established idiom and ties the lock to the actual rows being mutated.
- **Reimplementing folder cycle detection inside the new move endpoint:** `foldersService.moveFolder()` already has the Phase 31 ancestor_ids cycle/depth check plus the DB trigger backstop — the move dispatcher must call it, not duplicate its logic.
- **Treating `programs` as if it only ever has one parent-pointer column:** `programs` rows carry both `folder_id` and `project_id` — a reorder/move implementation that hardcodes `projectId: null` (or its `folder_id` equivalent) silently drops project-filed programs from "any node" coverage. Both scopes must be dispatchable through the same endpoint via the `project_id` disambiguator.
- **A generic `workspace_nodes` polymorphic table to unify the 5 entity types:** Explicitly out of scope per REQUIREMENTS.md's "Out of Scope" table — "would duplicate the existing `folders`/`projects`/`programs`/`project_pages`/`collection_records` parent-pointer hierarchies."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent reorder safety | An application-level "check version number matches" optimistic-lock scheme, or in-memory mutex | `SELECT ... FOR UPDATE` inside a DB transaction (Pattern 2) | Postgres already guarantees serialization for the locked row set; a hand-rolled version-check adds a second failure mode (forgetting to increment the version) for no benefit over the DB's native mechanism |
| Cross-tenant move validation | A new bespoke ownership-check function per node type | Reuse each domain's **existing** `assertOwned*`/`findXForCompany` helpers (`assertOwnedFolder`, `findProjectForCompany`, etc.) — all already scoped by `company_id` and already return a clean 404 on cross-tenant, per Phase 31/pre-31 precedent | These helpers already exist and are already tested; writing new ones risks a subtly different (and untested) tenant-check semantics |
| Folder cycle detection for the move endpoint | A second cycle-check implementation inside `folders.service.ts`'s new move dispatcher | Delegate to the **existing** `foldersService.moveFolder()` for `node_type: 'folder'` | Phase 31 already built and DB-trigger-backstopped this; duplicating it risks drift between two cycle-check implementations |
| Full-tree aggregation | A new SQL view or materialized view unioning all 5 tables | 5 parallel repository calls + in-memory assembly (Pattern 1) | The existing repository methods are already correct, tested, and indexed; a UNION view adds a new schema object to maintain for no query-count benefit (still same effective query cost) |

**Key insight:** Almost everything this phase needs already exists in the codebase in some form — the folders-domain orchestration pattern (Phase 31's `archiveFolder`), the five flat list queries, the tenant-ownership helpers, and the folder cycle/depth check. The two genuinely new things are (1) the `sort_order` columns on `projects`/`programs`/`data_collections` (additive migration) and (2) the `FOR UPDATE`-based reorder transaction (new but standard-PostgreSQL, not exotic).

## Common Pitfalls

### Pitfall 1: Reorder endpoint accepts an `ordered_ids` array without validating it matches the locked sibling set

**What goes wrong:** A client with a stale tree snapshot (e.g., another user just moved a sibling out) submits a reorder for a sibling set that no longer matches reality — silently reordering the wrong rows, or leaving orphaned `sort_order` gaps.
**Why it happens:** It's tempting to trust the client's `ordered_ids` array outright and just loop through it in the `UPDATE ... FROM (VALUES ...)`.
**How to avoid:** After the `FOR UPDATE` lock, compare the locked id set (server-truth) against the client's `ordered_ids` array (set equality, not order). If they differ, throw `AppError(409, 'Sibling set has changed since last read — refresh and retry')` before applying the renumber. This matches the existing `409` convention already used for state-conflict errors elsewhere in this codebase (`invoicing.service.ts`, `pod.service.ts`, `marketplace.service.ts`).
**Warning signs:** Reorder "succeeds" but the resulting tree has duplicate or skipped `sort_order` values, or a sibling that was concurrently moved elsewhere reappears in the reordered parent.

### Pitfall 2: Forgetting `projects`/`programs`/`data_collections` have no `sort_order` column today

**What goes wrong:** Planner assumes `sort_order` already exists on all five node types (since `folders` and `project_pages` have it) and skips the migration step, then the reorder endpoint fails at write time with `column "sort_order" does not exist`.
**Why it happens:** `folders`, `project_pages`, `collection_records`, and `collection_views` all have `sort_order` — it's easy to assume it's universal across the tree's node types.
**How to avoid:** Add `sort_order INTEGER NOT NULL DEFAULT 0` to `projects`, `programs`, and `data_collections` in a new additive migration before building the reorder endpoint for those node types. `[VERIFIED: codebase — grep for "sort_order" across database/migrations/*.sql found it only in 006_folders.sql, 009_project_pages.sql, 025_records_views.sql (collection_records + collection_views), never in 004_projects_and_programs.sql or the data_collections table definition in 025_records_views.sql]`
**Warning signs:** `tsc`/migration apply succeeds but a live reorder request against a project/program/collection sibling set throws a Postgres `42703 undefined_column` error.

### Pitfall 3: Treating the move endpoint's cycle risk as uniform across all 5 node types

**What goes wrong:** Building a generic "check for cycles" step that runs for every `node_type`, when only `folder→folder` moves can actually cycle (projects/programs/collections/pages are leaves relative to their own type — a project cannot become an ancestor of another project).
**Why it happens:** The phase's success criteria mention "cycles" generically ("rejects illegal moves (cycles, cross-tenant targets)"), which reads as if it applies uniformly.
**How to avoid:** Cycle detection is only meaningful for `node_type: 'folder'` (delegate to the existing `foldersService.moveFolder()` ancestor_ids check). For `project`/`program`/`data_collection`, "illegal move" means only cross-tenant destination, not cycles. For `page` (`parent_page_id` self-reference within a project), a cycle is theoretically possible since pages have **no** `ancestor_ids`/trigger equivalent (only `folders` got that in Phase 31) — flag this as an Open Question for the planner (see below) rather than silently skipping it or silently over-building it.
**Warning signs:** A move endpoint that does an expensive ancestor-chain walk for every node type, including ones that structurally cannot cycle.

### Pitfall 4: Batch vs. per-row durable events on reorder

**What goes wrong:** Emitting one `event_outbox` row per reordered sibling (matching Phase 31's per-row archive-event convention) could produce a burst of N events for a single drag-reorder of N siblings, which may be excessive for a UI action that's conceptually "one user action."
**Why it happens:** Phase 31 established "never batch — one event per affected row" for cascade archive, but that was for a destructive, audit-significant action (archiving). Reorder is a much higher-frequency, lower-stakes UI action (every drag-drop).
**How to avoid:** This is a genuine open design question, not a clear-cut pitfall — flagged explicitly in Open Questions below for the planner/CONTEXT.md to resolve, since neither convention (Phase 31's per-row precedent vs. a single batched `tree.reordered` event with an `ordered_ids` payload) is unambiguously "the pattern" for this specific, high-frequency action type.
**Warning signs:** `event_outbox` table grows unexpectedly fast under normal drag-reorder UI usage (Phase 34).

### Pitfall 5: Building the tree-read endpoint's response shape without checking what Phase 33's sidebar actually needs

**What goes wrong:** Phase 32 ships a tree shape that Phase 33 (Tree-Based Sidebar UI) then has to reshape client-side or, worse, request a breaking change to.
**Why it happens:** No CONTEXT.md exists yet for Phase 32 (not yet discussed), so the exact consumed shape isn't locked.
**How to avoid:** Keep the response shape close to the existing `FolderTree` precedent (`{ ...entity, children: [...] }` recursively, with a `node_type` discriminant added per node) rather than inventing a novel shape — Phase 33 already expects to consume "folders/projects/programs as a real expand/collapse tree" per TREEUI-01, which maps naturally onto a `FolderTree`-shaped recursive structure extended with mixed node types.
**Warning signs:** Phase 33's plan discovers it needs a second aggregation pass or client-side re-nesting logic to consume Phase 32's response.

## Code Examples

### New migration skeleton (029)

```sql
-- Source: derived from this repo's own 028_folder_hierarchy_invariants.sql conventions
-- Migration: Tree node sort_order columns. Apply after 028. Idempotent.
--
-- folders and project_pages already have sort_order (006_folders.sql,
-- 009_project_pages.sql). projects, programs, and data_collections do not —
-- add it additively so TREEAPI-02 sibling reorder can cover all five node
-- types the aggregated tree (TREEAPI-01) exposes.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS projects_folder_sort_idx ON projects (folder_id, sort_order);
CREATE INDEX IF NOT EXISTS programs_parent_sort_idx ON programs (folder_id, project_id, sort_order);
CREATE INDEX IF NOT EXISTS data_collections_folder_sort_idx ON data_collections (folder_id, sort_order);
```

### Lock-safe reorder transaction (repository method shape)

```typescript
// Source: pattern derived from apps/api/src/core/events/outbox.ts's existing
// FOR UPDATE SKIP LOCKED idiom (the only lock precedent in this codebase),
// adapted to a non-skip-locked, blocking read + full renumber.
async reorderSiblings(
  client: PoolClient, companyId: string, parentScope: { column: string; value: string | null },
  orderedIds: string[],
): Promise<void> {
  const { rows: locked } = await client.query<{ id: string }>(
    `SELECT id FROM projects WHERE company_id = $1 AND ${parentScope.column} IS NOT DISTINCT FROM $2
       AND archived_at IS NULL FOR UPDATE`,
    [companyId, parentScope.value],
  );
  const lockedIds = new Set(locked.map((r) => r.id));
  if (lockedIds.size !== orderedIds.length || !orderedIds.every((id) => lockedIds.has(id))) {
    throw new AppError(409, 'Sibling set has changed since last read — refresh and retry');
  }
  const values = orderedIds.map((id, i) => `('${id}'::uuid, ${i})`).join(',');
  await client.query(
    `UPDATE projects AS p SET sort_order = v.pos, updated_at = NOW()
     FROM (VALUES ${values}) AS v(id, pos) WHERE p.id = v.id`,
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Per-domain reparenting only (`updateProject({folder_id})`, `updatePage({parent_page_id})`, etc., each independently) | One tenant-validated, cycle-checked `POST /folders/tree/move` dispatcher (this phase) | This phase (TREEAPI-03) | UI (Phase 33/34) gets one consistent move contract instead of five different per-domain PATCH shapes |
| No reorder mechanism exists for any node type except a bare `PATCH .../sort_order` field with no locking (`update-record.dto.ts`'s `sort_order` field, last-write-wins) | Lock-safe, transaction-scoped reorder endpoint (this phase) | This phase (TREEAPI-02) | Concurrent drag-reorders no longer silently overwrite each other |
| Folder-only tree read (`GET /folders` → `listFolderTree`) | Full cross-entity tree read (`GET /folders/tree/full`) spanning folders+projects+programs+collections+pages | This phase (TREEAPI-01) | Phase 33's sidebar UI has one endpoint to call instead of aggregating 5 separate list endpoints client-side |

**Deprecated/outdated:** None — this phase is purely additive; no existing endpoint is removed or changed in a breaking way. `foldersService.moveFolder()` (Phase 31) is reused, not replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A full renumber-on-reorder (integer `sort_order`, `FOR UPDATE` + single `UPDATE ... FROM VALUES`) is sufficient for expected sibling counts (bounded by UI-visible tree fan-out, not thousands of rows) — no fractional/gap-based position scheme is needed. | Standard Stack / Alternatives Considered, Pattern 2 | If a company has hundreds of siblings under one parent, a full renumber on every reorder becomes a larger write than necessary (still correct, just less efficient) — not a correctness risk, only a scale/performance one. Not independently benchmarked this session. |
| A2 | The `folders` domain (not a new `tree` domain) is the correct home for `GET /folders/tree/full`, `POST /folders/tree/reorder`, `POST /folders/tree/move`, mirroring Phase 31's cross-domain orchestration precedent in `archiveFolder`. | Architecture Patterns, Recommended Project Structure | If wrong, the planner may need to relocate these endpoints to a new domain later — low risk since Express route mounting is cheap to change, but would touch `apps/api/src/domains/index.ts` and any frontend `folders.api.ts` base-path assumptions. |
| A3 | `data_collections` and `programs`/`projects` gaining an additive `sort_order` column does not violate the "schema is locked, do not redesign" note on `data_collections` in `025_records_views.sql`, since Phase 31 already set the precedent of additive-only columns (`folder_id`, `archived_at`) on that same "locked" table. | Common Pitfalls / Pitfall 2, Code Examples | If the "locked" note is interpreted more strictly than Phase 31's own precedent, the planner should flag this as a discussion point rather than assume — but Phase 31's own migration already crossed this line additively, so the precedent is strong. |
| A4 | Page (`project_pages.parent_page_id`) reparenting cycle risk is out of this phase's DB-level enforcement scope (no `ancestor_ids`/trigger exists for pages, only for folders per Phase 31), and the move endpoint should either reject cross-project page moves entirely (pages stay within their existing project, matching the current `updatePage` behavior) or explicitly flag this as an unresolved gap rather than silently building unverified cycle protection. | Common Pitfalls / Pitfall 3 | If the planner assumes page cycle protection exists at the DB level (it does not), a page could theoretically be reparented into its own descendant with no trigger to stop it — a real (if narrow, since pages are typically shallow) data-integrity gap. |

## Open Questions (RESOLVED)

1. **Should reorder emit one durable event per moved sibling, or one batched `tree.reordered` event?**
   - What we know: Phase 31 established "never batch, one event per row" for cascade archive (a low-frequency, audit-significant action). Reorder is a high-frequency, low-stakes UI action (every drag-drop in Phase 34).
   - What's unclear: Whether the per-row convention should apply uniformly to all mutation types in this domain going forward, or whether reorder's frequency profile justifies a documented exception (a single event carrying the new `ordered_ids` array as payload).
   - Recommendation: Batch as a single `tree.<node_type>.reordered` event with the full `ordered_ids` array in the payload, explicitly as a documented exception to Phase 31's per-row convention, justified by event-volume concerns under normal drag-reorder usage. Flag for plan-check/CONTEXT.md confirmation since this deviates from the established Phase 31 precedent.
   - **RESOLVED:** Batched `tree.<node_type>.reordered` event per reorder call (adopted in 32-04) — a single event carries the full `ordered_ids` array in its payload, documented as an intentional exception to Phase 31's per-row archive-event convention.

2. **Should page-to-page reparenting (`parent_page_id`) be included in `POST /folders/tree/move`'s scope at all in this phase, given it has no DB-level cycle protection?**
   - What we know: `project_pages` has `parent_page_id` (self-referential, `012_page_hierarchy.sql`) but no `ancestor_ids` array and no cycle-prevention trigger — only `folders` got that treatment in Phase 31.
   - What's unclear: Whether TREEAPI-01's "folder/project/program/collection/page tree" (read-only) implies pages must also be move/reparent-capable via this same endpoint in this phase, or whether page reparenting can remain scoped to the existing `PATCH /projects/pages/:pageId` endpoint (same-project only, no cross-project cycle risk since pages can't currently move between projects via any existing endpoint).
   - Recommendation: Scope `POST /folders/tree/move` to `node_type: folder | project | program | data_collection` only for genuine cross-parent reparenting in this phase; leave page-to-page nesting (`parent_page_id`) on its existing `PATCH /projects/pages/:pageId` endpoint, unchanged, since it has no cross-project move capability today and building new cycle protection for it is a scope expansion beyond "one way to reorder/reparent any node" as applied to the folder/project/program/collection layer. If the planner disagrees and wants pages fully unified into the generic move endpoint, a page-level `ancestor_ids`-equivalent (or a bounded-depth walk, since page nesting depth is not documented as bounded to 3 the way folders are) needs to be designed first — treat as a blocking Open Question, not an assumption.
   - **RESOLVED:** Excluded `'page'` from the `NodeType` enum this phase (adopted in 32-01, 32-05) — no `ancestor_ids`/cycle-protection trigger exists for pages, and no regression results since no prior cross-project page move endpoint existed either; page reparenting stays on the existing `PATCH /projects/pages/:pageId`, same-project only.

3. **What HTTP verb/path convention for the two new mutation endpoints — `POST /folders/tree/reorder` + `POST /folders/tree/move`, or per-node-type paths (`POST /folders/:id/reorder`, etc.)?**
   - What we know: Existing folder mutations use per-resource paths (`PATCH /folders/:id/move`). The new endpoints are inherently cross-type (a `project` reorder request isn't "a folder resource").
   - What's unclear: Whether nesting these under `/folders/tree/*` (implying "folders domain owns the tree") reads confusingly for a project-reorder request, versus a more neutral `/tree/*` mount.
   - Recommendation: Use `/folders/tree/full`, `/folders/tree/reorder`, `/folders/tree/move` (keeping the existing `folders` router mount, per Pattern 3's "reuse the folders domain" recommendation) — the `/tree/` sub-path signals "this endpoint spans multiple node types," avoiding the false implication that a `POST /folders/tree/reorder` targeting `node_type: 'project'` is folder-specific. This is a naming recommendation, not a locked decision — confirm during planning.
   - **RESOLVED:** `/folders/tree/*` mount (adopted in 32-03/32-04/32-05) — `GET /folders/tree/full`, `POST /folders/tree/reorder`, `POST /folders/tree/move`, all under the existing `folders` router.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All schema/query work | ✓ (per `docker-compose.yml`, verified in Phase 31 research) | `postgres:15-alpine` | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None applicable.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` runner, via `ts-node/register` |
| Config file | none — driven by `package.json` script: `"test": "node --require ts-node/register --test src/**/*.test.ts"` (apps/api) |
| Quick run command | `node --require ts-node/register --test src/domains/folders/**/*.test.ts` |
| Full suite command | `npm test` (apps/api) — runs `src/**/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREEAPI-01 | `GET /folders/tree/full` returns full tree in exactly 5 queries, no per-node fan-out | unit (mock repos, assert call count = 5) + integration (live-DB, assert correct nesting) | `folders.service.test.ts` (extend) + new `folders.integration.test.ts` case | ⚠️ unit file exists, integration file exists (from Phase 31) and can be extended |
| TREEAPI-02 | Reorder is lock-safe under concurrent requests | integration (two concurrent transactions against a live test DB, assert no lost update) | new integration test — requires two overlapping `client.query('BEGIN')` sessions, cannot be meaningfully mocked | ❌ Wave 0 — needs a genuinely concurrent test harness (two `PoolClient`s racing), which is a new test shape not yet present anywhere in this codebase |
| TREEAPI-03 | Move rejects cycles (folder) and cross-tenant destinations (all node types) with distinguishing errors | unit (service, mocked repo, assert specific AppError status/message per case) + integration (reuses Phase 31's existing cross-tenant/cycle DB-level tests) | extend `folders.service.test.ts` + `folders.integration.test.ts` | ⚠️ folder cycle/cross-tenant DB tests already exist from Phase 31 (31-06); need new cases for project/program/collection cross-tenant move |
| TREEAPI-04 | Every mutation endpoint (reorder, move) requires `workspace.admin` | unit | extend `folders.service.test.ts` — assert 403 without capability, matching existing `moveFolder`/`archiveFolder` test pattern | ⚠️ needs new cases, same pattern as existing tests |

### Sampling Rate

- **Per task commit:** `node --require ts-node/register --test src/domains/folders/**/*.test.ts`
- **Per wave merge:** `npm test` (apps/api full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] A genuinely-concurrent (two overlapping transactions) integration test harness does not exist anywhere in this codebase yet — needed to prove TREEAPI-02's "no lost updates" claim beyond code inspection. Planner must decide: build a minimal two-`PoolClient`-race test (open connection A, `BEGIN` + `FOR UPDATE`, hold it open with a delay, open connection B and attempt the same reorder, assert B blocks until A commits then correctly re-validates the sibling set) or accept a narrower single-transaction correctness test plus manual/documented reasoning as the verification bar for this specific property.
- [ ] `029_tree_sort_order.sql` migration and its apply/idempotent-rerun check (same Docker/Postgres access gap Phase 31 hit — this environment could not reach a running Postgres instance during Phase 31's research or several of its plan executions; confirm Docker availability before relying on live-DB verification steps).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V4 Access Control | yes | `assertCapability(ctx, 'workspace.admin')` on `POST /folders/tree/reorder` and `POST /folders/tree/move` (TREEAPI-04); `GET /folders/tree/full` stays capability-free-read, `company_id`-scoped, matching existing `listFolderTree`/`getFolder` |
| V5 Input Validation | yes | New Zod schemas (`ReorderNodesSchema`, `MoveNodeSchema`) in `folders/dto/tree.dto.ts`, matching existing `folder.dto.ts` convention; `node_type` must be a strict enum, not a free string |
| V6 Cryptography | no | No new secrets/crypto surface |
| V2 Authentication | no | Unchanged — `authenticateToken` middleware already gates the router |
| V3 Session Management | no | Unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant move via a crafted `new_parent_id` pointing at another company's folder/project | Tampering / Elevation of Privilege | Reuse existing `assertOwnedFolder`/`findProjectForCompany`-style 404-on-cross-tenant checks (already company_id-scoped) before dispatching any write; the underlying composite FK invariants (Phase 31) are the DB-level backstop |
| Reorder race condition causing a sibling to silently disappear from its parent's visible order (lost update) | Tampering (data integrity) | `SELECT ... FOR UPDATE` + server-side sibling-set validation (Pattern 2, Pitfall 1) — reject with 409 rather than silently applying a stale reorder |
| Missing capability check on a new endpoint (reorder/move) | Elevation of Privilege | Wire both new routes with `requireCapability('workspace.admin')` in `folders.routes.ts`, exactly like the existing `move`/`archive`/`unarchive` routes — do not forget on net-new endpoints (this is the exact class of gap Phase 31's own threat model flagged for its own new routes) |
| `node_type` confusion (e.g., a `move` request claiming `node_type: 'folder'` but supplying a `node_id` that's actually a project's UUID) | Tampering | Each dispatch branch must look the row up in its own type-specific table scoped by `company_id` (existing `assertOwned*`/`findXForCompany` calls already do this) — a UUID that doesn't exist in the claimed table's tenant-scoped rows naturally 404s, no extra type-confusion check needed beyond the existing ownership lookups |

## Sources

### Primary (HIGH confidence)

- `apps/api/src/domains/folders/{folders.service,folders.repository,folders.controller,folders.routes,folders.types}.ts` — read in full this session (Phase 31 output, current state)
- `apps/api/src/domains/projects/{projects.repository,projects.types,projects.routes}.ts` — read in full/partial this session
- `apps/api/src/domains/records/{records.repository,records.types}.ts` — read in full/partial this session
- `apps/api/src/core/{capabilities/index,auth/request-context,events/outbox,errors/AppError,errors/errorHandler}.ts` — read in full this session
- `database/migrations/{004_projects_and_programs,006_folders,009_project_pages,012_page_hierarchy,025_records_views,028_folder_hierarchy_invariants}.sql` — read in full this session
- `.planning/phases/31-data-model-modernize-folders-domain/{31-01..31-06}-SUMMARY.md`, `31-RESEARCH.md` — read in full this session (immediate prior-phase context)
- `apps/api/package.json` (test/migrate scripts) — read this session

### Secondary (MEDIUM confidence)

- `FOR UPDATE` row-locking + `UPDATE ... FROM (VALUES ...)` renumber as the standard PostgreSQL technique for lock-safe sibling reorder: standard, widely-documented PostgreSQL pattern, not tied to a specific library; no Context7/WebSearch performed (no external library involved) — treated as MEDIUM confidence schema-design reasoning, consistent with the one existing in-repo lock precedent (`event_outbox`'s `FOR UPDATE SKIP LOCKED`).

### Tertiary (LOW confidence)

- None — no WebSearch was performed for this phase since it involves no external library or framework beyond PostgreSQL core SQL and this repo's own existing code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; 100% grounded in code read this session
- Architecture (read aggregation): HIGH — directly reuses existing, tested repository methods and the existing `buildTree()` precedent
- Architecture (reorder lock-safety): MEDIUM — standard PostgreSQL technique, consistent with this repo's one existing lock precedent, but not independently benchmarked/run against a live DB this session (no Docker/Postgres access in this research environment, matching the exact gap Phase 31's own research/execution hit)
- Pitfalls: HIGH for the codebase-specific ones (missing `sort_order` columns, no existing lock precedent, page cycle-protection gap — all directly grounded in files/migrations read this session); MEDIUM for the generic concurrency-testing pitfall (no prior art in this repo to compare against)

**Research date:** 2026-07-17
**Valid until:** 30 days (internal schema/architecture research, no external library version drift risk)
