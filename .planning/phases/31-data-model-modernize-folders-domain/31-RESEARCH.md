# Phase 31: Data Model + Modernize Folders Domain - Research

**Researched:** 2026-07-16
**Domain:** PostgreSQL hierarchical data modeling (tenant-safe, cycle-safe tree) + Express/TS domain modernization to an existing internal v5 pattern
**Confidence:** MEDIUM-HIGH — the v5 pattern to replicate is fully present in-repo (HIGH), the SQL techniques (composite FK, ancestor-array, cycle trigger) are standard PostgreSQL patterns verified against this project's existing migration conventions (MEDIUM — no external library involved, so Context7/WebSearch do not apply; this is schema design reasoning grounded in the existing codebase), and one significant scope discrepancy with CONTEXT.md was found and must be corrected before planning (see below).

## Summary

This phase has no new external library to evaluate — it is 100% internal: a schema migration (new `NNN_description.sql` file, per project convention) plus a rewrite of `apps/api/src/domains/folders/folders.service.ts` (and its controller/routes) onto the v5 `RequestContext` + `assertCapability` + `event_outbox` pattern already used by `apps/api/src/domains/workflows/workflows.service.ts`. The research below is therefore primarily a close reading of the existing schema (`006_folders.sql`, `004_projects_and_programs.sql`, `025_records_views.sql`, `009_project_pages.sql`), the existing folders domain, and the v5 reference implementation, cross-checked against the five success criteria.

**Important correction to CONTEXT.md:** D-02 states "Projects/programs currently have no delete/removal endpoint at all." This is **factually wrong** — `apps/api/src/domains/projects/projects.service.ts` already has `deleteProject`/`deleteProgram` methods and `projects.routes.ts` already wires `DELETE /:id` and `DELETE /programs/:id`, both hard `DELETE FROM ... WHERE id = $1` with no `archived_at` concept. The correct framing for planning is: **projects/programs have hard-delete today; this phase replaces that hard-delete path with archive** (per D-01), not "introduces removal for the first time." This changes the diff: existing `deleteProject`/`deleteProgram` methods, controllers, and routes must be edited/replaced, not net-new code added. `[VERIFIED: codebase — apps/api/src/domains/projects/projects.service.ts:46-49,102-105; projects.routes.ts:18,31]`

**Primary recommendation:** Use an ancestor-ID array (`ancestor_ids UUID[]`) on `folders`, not a materialized path string — it avoids an `ltree` extension dependency, requires no ID-encoding workaround (UUIDs contain hyphens, which `ltree` labels reject), and a GIN index on `ancestor_ids` directly supports both required query shapes (`@>` for "all descendants," direct array read for "ancestors/breadcrumb") with max depth bounded at 3. Enforce the composite `(id, company_id)` FK invariant by adding `UNIQUE (id, company_id)` to every parent table and re-pointing each child FK to the composite key. Enforce cycle rejection with a `BEFORE INSERT OR UPDATE` trigger on `folders` (DB level) plus a mirrored service-layer check (API level) for a clean error message — Postgres has no declarative "no cycles" constraint, so a trigger is the standard mechanism.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant-safe reparenting (composite FK) | Database / Storage | — | Must be unconditionally true regardless of which API path writes the row; only a DB constraint can guarantee this (a service-layer check can be bypassed by a bug or a future direct-SQL script) |
| Cycle rejection | Database / Storage | API / Backend | DB trigger is the backstop (guarantees invariant even under future code paths); API/service check exists purely for a clean, specific 400 error instead of a raw constraint-violation 500 |
| Depth-limit (max 3) | API / Backend | Database / Storage (optional) | D-04 sets service-layer as the minimum bar; a DB check constraint is Claude's discretion per CONTEXT.md — see Open Questions |
| Ancestor-index maintenance (`ancestor_ids`) | API / Backend | — | Recomputed inside the same service-layer transaction that performs move/create, since Postgres has no native "materialized path" type: a trigger *could* maintain it, but a service-layer computation is simpler to test and matches how `folders.service.ts` already owns tree logic |
| Cascade archive (folder → descendants → projects/programs/collections/pages) | API / Backend | Database / Storage (transaction) | Multi-table, cross-domain cascade with per-node event emission — belongs in the service layer inside one DB transaction, not a DB-level `ON UPDATE CASCADE` (which can't emit application events) |
| RequestContext/capability/event_outbox migration | API / Backend | — | Pure backend refactor; no other tier involved |

## Package Legitimacy Audit

Not applicable — this phase introduces no new external packages. All work uses existing dependencies already in `package.json` (`pg`, `zod`, `express`) and Postgres built-in features. `slopcheck`/registry verification steps are skipped.

## Standard Stack

### Core
No new packages. Existing stack used:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | 8.11.3 (existing) | Transactional multi-statement cascade archive via `db.connect()` / `client.query('BEGIN'...)` | Already the project's only DB client; `workflows.service.ts`'s `manualRun` is the canonical transaction-pattern example to copy |
| `zod` | (existing) | DTO validation for new `ArchiveFolderSchema`/`MoveFolderSchema` additions | Matches `folders/dto/folder.dto.ts` convention |

### Supporting
None needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ancestor_ids UUID[]` array | PostgreSQL `ltree` extension (materialized path) | `ltree` gives richer path operators (`lquery`, `~`) but requires `CREATE EXTENSION ltree` (verify availability — see Environment Availability) and UUID labels must have hyphens stripped/replaced (`ltree` labels match `[A-Za-z0-9_]+`), adding an encode/decode step with no benefit at max-depth-3 scale |
| `ancestor_ids UUID[]` array | Recursive CTE (`WITH RECURSIVE`) per request, as today | This is exactly what HIER-07 requires replacing — recursive CTE cost grows with depth and issues N sequential queries in the current `assertNotDescendant` loop; explicitly out per requirement |
| DB trigger for cycle rejection | Application-only check (no DB trigger) | Faster to implement, but success criterion 3 explicitly requires DB-level rejection too — a trigger (or equivalent constraint) is not optional per the phase's stated success criteria |

**Installation:** None — no new packages.

**Version verification:** N/A (no external packages).

## Architecture Patterns

### System Architecture Diagram

```
Client (dispatcher / admin UI — Phase 33/34, not this phase)
        │
        ▼
Express route (folders.routes.ts)
  authenticateToken → requireCapability('workspace.admin') [mutations only]
        │
        ▼
folders.controller.ts
  requireRequestContext(req) → ctx: RequestContext
        │
        ▼
folders.service.ts  (rewritten this phase)
  requireCompanyId(ctx) / requireUserId(ctx)
  assertCapability(ctx, 'workspace.admin')   [for create/move/archive/unarchive]
  Zod parse (dto)
  assertNotDescendant() ──── reads ancestor_ids column directly (O(1), no loop)
  assertDepthLimit()     ──── reads array_length(ancestor_ids) + 1
        │
        ▼  (single DB transaction via db.connect())
folders.repository.ts + projectsRepository + recordsRepository
  BEGIN
    UPDATE folders SET parent_id=…, ancestor_ids=… WHERE id=…       (move)
      └─ DB trigger: folders_prevent_cycle() re-validates at DB level
    walk subtree (folders whose ancestor_ids @> ARRAY[id]) ─┐
    UPDATE …archived_at=NOW() on each descendant folder      │  (archive path)
    UPDATE projects/programs/data_collections/project_pages  │
      WHERE folder_id = ANY(subtree_folder_ids)              │
    for each affected row: createDurableEventEnvelope + INSERT INTO event_outbox
  COMMIT
        │
        ▼
event_outbox (existing table, existing dispatch worker) — no change needed this phase
```

### Recommended Project Structure
No new files/folders beyond the existing domain shape — this phase modifies in place:
```
apps/api/src/domains/folders/
├── folders.controller.ts   # updated: pass RequestContext through, not (companyId, actorId, body)
├── folders.repository.ts   # updated: ancestor_ids maintenance, archive/unarchive queries, composite-FK-aware inserts
├── folders.service.ts      # rewritten: RequestContext + assertCapability + event_outbox, ancestor-index lookups
├── folders.routes.ts       # likely unchanged (capability gating already present)
├── folders.types.ts        # add archived_at, ancestor_ids to Folder interface
└── dto/folder.dto.ts       # add ArchiveFolderSchema (if body needed) / extend MoveFolderSchema validation

database/migrations/
└── 028_folder_hierarchy_invariants.sql   # new — see Code Examples
```
Also touched (not moved into folders/, but required for HIER-01/04):
```
apps/api/src/domains/records/records.{types,repository,service}.ts   # add folder_id to data_collections
apps/api/src/domains/projects/projects.{types,repository,service}.ts # add archived_at to projects/programs, replace hard delete with archive
```

### Pattern 1: RequestContext + Capability + Durable Event (the v5 pattern to replicate)
**What:** Every mutation resolves `tenantId`/`userId` from `RequestContext` (never from raw `req.body`/params), asserts a capability before touching data, and emits a durable event via `createDurableEventEnvelope` + repository-level `INSERT INTO event_outbox` inside the same transaction as the data write — never `recordEvent()`.
**When to use:** Every folders-domain mutation (`createFolder`, `updateFolder`, `moveFolder`, `archiveFolder`, `unarchiveFolder`). Replaces the current `(id, companyId, body)` / `(id, companyId, actorId, body)` signatures.
**Example:**
```typescript
// Source: apps/api/src/domains/workflows/workflows.service.ts (canonical v5 pattern in this repo)
async manualRun(ctx: RequestContext, id: string, body: unknown): Promise<WorkflowRunDetail> {
  assertCapability(ctx, 'workflow.run');
  const tenantId = requireCompanyId(ctx);
  const userId = requireUserId(ctx);
  // ...validate...
  const event = createDurableEventEnvelope({
    eventName: 'workflow.manual_triggered',
    tenantId, actorId: userId, objectType: 'workflow', objectId: workflow.id,
    correlationId: ctx.requestId, payloadVersion: 1, payload: { /* ... */ },
  });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // ... repository writes using `client`, plus insertDurableEvent(client, event) ...
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
```
The folders rewrite should follow this shape exactly, substituting `workflow.*` capabilities for `workspace.admin` (already what `folders.routes.ts` gates on — TREEAPI-04 in the next phase reuses the same capability, so no new capability needs to be added to `CapabilityName` in `core/capabilities/index.ts`).

### Pattern 2: Ancestor-ID array for O(1) tree lookups
**What:** `folders.ancestor_ids UUID[] NOT NULL DEFAULT '{}'` holds the ordered chain of ancestor folder IDs from root to immediate parent (empty array = top-level folder). Depth = `array_length(ancestor_ids, 1) + 1` (NULL-safe via `COALESCE(array_length(ancestor_ids,1),0) + 1`).
**When to use:** Every breadcrumb read, every "get all descendants" cascade-archive query, every depth check.
**Example:**
```sql
-- Descendants of folder :id (for cascade archive) — GIN-index-backed, single query, no recursion
SELECT id FROM folders WHERE company_id = $1 AND ancestor_ids @> ARRAY[$2]::uuid[];

-- Breadcrumb for folder row `f` — single query, no per-row round trip
SELECT id, name FROM folders WHERE id = ANY($1::uuid[]);  -- $1 = f.ancestor_ids, then order client-side by array position

-- Depth check before create/move
-- newDepth = array_length(parent.ancestor_ids, 1) + 1 + 1  (parent's depth + 1 for the new node)
```
On move: `NEW.ancestor_ids = parent.ancestor_ids || parent.id` (or `'{}'` if moving to root), **and** every existing descendant of the moved node must have its `ancestor_ids` prefix rewritten in the same transaction (bounded work: max depth 3, so at most 2 levels of descendants to patch).

### Pattern 3: Composite `(id, company_id)` FK invariant
**What:** Add `UNIQUE (id, company_id)` on every parent table (`folders`, `projects`, `programs`, `data_collections`), then replace each child's single-column FK with a composite FK against `(parent_id, company_id)` / `(folder_id, company_id)` / `(project_id, company_id)`.
**When to use:** `folders.parent_id`, `projects.folder_id`, `programs.folder_id`, `data_collections.folder_id` (new), `project_pages.project_id`, `project_pages.parent_page_id` (self-ref, already exists per `012_page_hierarchy.sql` — verify).
**Example:**
```sql
-- Source: standard PostgreSQL multi-tenant "composite FK" pattern (no library — pure SQL)
ALTER TABLE folders ADD CONSTRAINT folders_id_company_uniq UNIQUE (id, company_id);

-- Existing single-column FK must be dropped before adding the composite one.
-- Constraint name is Postgres's auto-generated default for inline REFERENCES —
-- VERIFY the actual name via information_schema before writing the migration:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'folders'::regclass AND contype = 'f';
ALTER TABLE folders DROP CONSTRAINT folders_parent_id_fkey;
ALTER TABLE folders ADD CONSTRAINT folders_parent_id_company_fkey
  FOREIGN KEY (parent_id, company_id) REFERENCES folders (id, company_id) ON DELETE CASCADE;
```

### Pattern 4: DB-level cycle rejection via trigger
**What:** Postgres has no declarative "acyclic" constraint. The standard mechanism is a `BEFORE INSERT OR UPDATE` trigger function that walks the *new parent's* `ancestor_ids` (already O(1) thanks to Pattern 2) and rejects if the row being moved appears in that chain, or if the row is being parented to itself.
**Example:**
```sql
CREATE OR REPLACE FUNCTION folders_prevent_cycle() RETURNS TRIGGER AS $$
DECLARE
  parent_ancestors UUID[];
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Folder cannot be its own parent' USING ERRCODE = 'check_violation';
  END IF;
  SELECT ancestor_ids INTO parent_ancestors FROM folders WHERE id = NEW.parent_id;
  IF NEW.id = ANY(parent_ancestors) THEN
    RAISE EXCEPTION 'Cannot move a folder into its own descendant' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folders_prevent_cycle_trg
  BEFORE INSERT OR UPDATE OF parent_id ON folders
  FOR EACH ROW EXECUTE FUNCTION folders_prevent_cycle();
```
The service-layer `assertNotDescendant` check should run **first** (reading `ancestor_ids` directly, no loop) purely so the API returns a clean `AppError(400, 'Cannot move a folder into its own descendant')` instead of surfacing a raw Postgres exception; the trigger is the non-bypassable backstop.

### Anti-Patterns to Avoid
- **Recursive CTE per request:** The exact pattern HIER-07 requires removing (`assertNotDescendant`'s current one-parent-at-a-time loop in `folders.service.ts`). Do not reintroduce it anywhere in the rewrite, including in the cascade-archive descendant query.
- **`ltree` for a max-depth-3 tree:** Adds an extension dependency and a UUID-to-label encoding step for no real benefit at this scale — avoid.
- **Single root event with a descendant-ID list for cascade archive:** D-05 explicitly requires one durable event per affected node, matching `workflow.manual_triggered`'s per-object granularity. Do not batch.
- **Reusing `recordEvent()`/`activityLog` anywhere in the rewritten folders domain:** HIER-06 explicitly forbids this — even for the "read" side (list/get), though those never wrote events at all.
- **`ON DELETE CASCADE` as the archive mechanism:** The current `parent_id ON DELETE CASCADE` gives hard-delete-only tree removal. Archive must NOT use `DELETE` — it is an `UPDATE ... SET archived_at = NOW()`, no `ON DELETE` behavior is involved for archive at all (the FK `ON DELETE CASCADE` only matters if a hard-delete path is retained per D-01's open question).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant isolation on reparent | A service-layer-only "check company_id matches" (already exists, e.g. `assertOwnedFolder`) as the *sole* protection | Composite `(id, company_id)` FK (Pattern 3), service check stays as a defense-in-depth 403 with a clean message | Success criterion 2 explicitly requires DB-level rejection; a service check alone can be bypassed by any future direct-SQL code path (workers, scripts, migrations) |
| Cycle detection | A new generic graph library or a hand-rolled recursive traversal at request time | The ancestor-index (Pattern 2) + DB trigger (Pattern 4) | At max depth 3 a graph library is overkill; the existing per-request loop in `assertNotDescendant` is precisely what's being replaced |
| Transactional cascade archive | Multiple independent `UPDATE` calls with no transaction wrapper (risk of partial cascade on failure) | `db.connect()` / `BEGIN` / `COMMIT` / `ROLLBACK` exactly as `workflowsService.manualRun` already does | Success criterion 4 requires "a single transaction" — this project already has the exact transaction pattern to copy, no new abstraction needed |

**Key insight:** Nothing in this phase calls for a new dependency or a generic tree/hierarchy library — every technique needed (composite FK, ancestor array, cycle trigger, event_outbox) is either already implemented elsewhere in this codebase or is standard PostgreSQL DDL. The risk in this phase is entirely in migration-writing precision (existing constraint names, existing data backfill) and in correctly scoping the cascade across four different tables with three different attachment patterns (`parent_id` self-reference for folders; `folder_id` for projects/programs/collections; `project_id` for pages and for collections that aren't folder-filed).

## Runtime State Inventory

This phase alters constraints/columns on live tables but is not a rename/rebrand — most Runtime State Inventory categories don't apply. Answering explicitly per the protocol:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `folders`, `projects`, `programs`, `data_collections`, `project_pages` rows have no `archived_at`/`ancestor_ids` values yet — every existing row needs a backfill computed from current `parent_id` chains before the new columns can be made `NOT NULL`/indexed meaningfully. | Data migration: a one-time backfill UPDATE (or a PL/pgSQL loop bounded by max depth 3) inside the same migration file, run before adding `NOT NULL` constraints. |
| Live service config | None — no external services (n8n, Datadog, etc.) reference folder/project IDs by structure that this migration changes. | None. |
| OS-registered state | None — no OS-level task/process registrations reference folders/projects. | None. |
| Secrets/env vars | None — no secret or env var names reference `folders`/`projects`/`programs`/`data_collections` by name. | None. |
| Build artifacts | None — pure SQL + TS domain changes, no package/build-artifact renames. | None. |

**Backfill note:** Because current max real-world folder depth is unknown (no depth limit has been enforced until now), the backfill script must handle rows that may *already* exceed depth 3 (created before D-04 existed). Recommendation: backfill `ancestor_ids` for all rows regardless of resulting depth (data integrity first), then apply the depth-3 guard only to new creates/moves going forward — do not silently truncate or reject pre-existing deep folders as part of this migration (that would be a surprise data-loss/behavior change outside phase scope). Flag any folder found deeper than 3 during backfill in a migration `RAISE NOTICE` for human follow-up.

## Common Pitfalls

### Pitfall 1: Assuming auto-generated FK constraint names
**What goes wrong:** The migration drops the wrong constraint name (or fails outright) when trying to replace `folders.parent_id`'s single-column FK with the composite one.
**Why it happens:** Inline `REFERENCES` (as used in `006_folders.sql`, `004_projects_and_programs.sql`, etc.) get Postgres's auto-generated default name (`<table>_<column>_fkey`), which is a reasonable guess but not guaranteed if any migration ever explicitly named a constraint differently.
**How to avoid:** In the new migration, query `pg_constraint`/`information_schema.table_constraints` for the actual FK name before dropping, or use `DO $$ ... EXCEPTION WHEN undefined_object THEN NULL; END $$;` wrapping to make the drop idempotent regardless of name drift.
**Warning signs:** Migration fails with `constraint "..." does not exist` on a fresh vs. long-lived database.

### Pitfall 2: Forgetting `data_collections` already has a "do not redesign" lock note
**What goes wrong:** Planner assumes the whole `data_collections` schema is open for revision and touches `project_id` or other locked fields.
**Why it happens:** `025_records_views.sql`'s header comment says "Schema is locked in docs/specs/core/workspace-blocks.md §3.3 — do not redesign," and explicitly discusses `project_id` staying nullable/unreferenced by DTOs "in this phase" (referring to Phase 22, not this phase).
**How to avoid:** Only *add* `folder_id` (new nullable FK column + index), do not touch `project_id`, `schema`, or any other existing `data_collections` column/constraint. `[CITED: database/migrations/025_records_views.sql header comment]`
**Warning signs:** A migration diff that modifies more than adds to `data_collections`.

### Pitfall 3: Scope creep from "projects/programs need archive" into "projects/programs need full v5 migration"
**What goes wrong:** Since D-01/D-02 require archive behavior on projects/programs too, it's tempting to also migrate `projects.service.ts` fully onto `RequestContext`/`event_outbox` in this phase "while we're in there."
**Why it happens:** HIER-04 (archived_at + cascade) genuinely spans folders/projects/programs, but HIER-05/06 (RequestContext + event_outbox modernization) are scoped to "the folders domain" specifically, per REQUIREMENTS.md wording.
**How to avoid:** Cascade-archive events for descendant projects/programs/collections/pages can be written to `event_outbox` *from within the folders-domain transaction* (the folders service already holds the DB client and is the one place per D-05 emitting one event per node) without requiring `projects.service.ts` itself to be rewritten onto `RequestContext`. A standalone "archive this one project directly (not via folder cascade)" endpoint, if planned, is a separate design decision — see Open Questions.
**Warning signs:** Plan tasks touching `projects.controller.ts`/`projects.routes.ts` signatures beyond adding an archive endpoint.

### Pitfall 4: Depth-limit off-by-one
**What goes wrong:** "Max 3 levels" gets implemented as `array_length(ancestor_ids,1) > 3` (which actually allows depth 4, since a top-level folder's `ancestor_ids` length is 0, not 1).
**Why it happens:** Easy to conflate "array length" with "depth."
**How to avoid:** Depth = `COALESCE(array_length(ancestor_ids,1), 0) + 1` (top-level folder → depth 1, per D-04's own definition: "a top-level folder = depth 1"). Reject when the *new* depth (parent's depth + 1) would exceed 3.
**Warning signs:** A folder nested one level deeper than expected is silently allowed or one level shallower than expected is rejected.

### Pitfall 5: Cascade archive missing the two-hop case
**What goes wrong:** Archiving a folder cascades `archived_at` to folders/projects/programs/collections directly filed in the folder subtree, but misses `project_pages` and `programs`/`data_collections` that hang off an archived *project* via `project_id` rather than `folder_id`.
**Why it happens:** `project_pages` has no `folder_id` at all (only `project_id`); `programs`/`data_collections` can be attached via *either* `folder_id` or `project_id`. Archiving folder F must archive: (1) descendant folders, (2) projects/programs/collections whose `folder_id` is in that folder-subtree set, (3) **then**, for every project archived in step 2, its own programs/pages/collections attached via `project_id`.
**How to avoid:** Implement cascade as two passes in the same transaction: pass 1 walks the folder tree (`ancestor_ids @>`) to collect folder IDs, archives folders + directly-filed projects/programs/collections; pass 2 takes the just-archived project IDs and archives their `project_id`-attached programs/pages/collections. Emit one event per row in both passes.
**Warning signs:** Success criterion 4's manual test (archive a folder containing a project containing pages) leaves pages un-archived.

## Code Examples

### New migration skeleton
```sql
-- Source: derived from this repo's own 026_event_outbox.sql / 006_folders.sql conventions
-- Migration: Folder hierarchy invariants. Apply after 027. Idempotent.

ALTER TABLE folders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS ancestor_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE project_pages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS folders_ancestor_ids_gin_idx ON folders USING GIN (ancestor_ids);
CREATE INDEX IF NOT EXISTS data_collections_folder_idx ON data_collections (folder_id);

-- Backfill ancestor_ids for pre-existing rows (bounded loop; folders table only expected to be small)
-- ... WITH RECURSIVE backfill pass, one-time, NOT the per-request pattern being removed ...

-- Composite (id, company_id) uniqueness + FK re-pointing — see Pattern 3 for full detail per table.
-- Cycle trigger — see Pattern 4.
```

### Test file location for this phase
```typescript
// Existing precedent: apps/api/src/domains/folders/folders.service.test.ts
// uses node:test + node:assert/strict + mock.method on repository — extend this
// file (or add folders.repository.test.ts / a new migration-focused integration
// test) rather than introducing a new test framework.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Per-request recursive parent walk (`assertNotDescendant` loop) | Ancestor-index array read | This phase (HIER-07) | O(depth) sequential DB round-trips → O(1) single query |
| `recordEvent()`/`activity_events` best-effort logging | `event_outbox` durable envelope + dispatch worker | Phase 29 (already shipped), now extended to folders in this phase | Folder mutations become replayable/retryable; already true for workflows since Phase 30 |
| Hard `DELETE` for folders/projects/programs | Soft `archived_at` (this phase) | This phase (D-01) | Deleting a folder no longer destroys projects/programs/pages irrecoverably; adds an `unarchive` path (D-03) |

**Deprecated/outdated:** `foldersRepository.deleteFolder` (raw hard delete) and `projectsRepository.deleteProject`/`deleteProgram` (raw hard delete) — being replaced by archive per D-01/D-02, with hard-delete potentially retained only for genuinely-empty nodes (open question below).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres `postgres:15-alpine` (this project's DB image, per `docker-compose.yml`) supports arrays and GIN indexes out of the box with no extra extension — this is core Postgres, not a contrib module, so risk is very low, but not independently verified by running a query in this session. | Standard Stack / Architecture Patterns (ancestor_ids array + GIN index) | If somehow unsupported (extremely unlikely — array types and GIN are core Postgres since v9.x), the fallback is a materialized-path TEXT column with a btree index instead. |
| A2 | Existing FK constraint names on `folders.parent_id`, `projects.folder_id`, `programs.folder_id`, `project_pages.project_id` follow Postgres's default auto-generated naming (`<table>_<column>_fkey`) since none of the inline `REFERENCES` in `006_folders.sql`/`004_projects_and_programs.sql`/`009_project_pages.sql` explicitly name their constraints. | Common Pitfalls / Pattern 3 | If names differ (e.g., from a manual `ALTER TABLE` at some point not visible in these migration files), the `DROP CONSTRAINT` step in the new migration fails — mitigated by recommending a query-first or exception-safe drop. |
| A3 | The v5 `workspace.admin` capability (already used for all folder mutation routes) is sufficient for the modernized folders domain and no new `CapabilityName` needs to be added to `core/capabilities/index.ts`. | Pattern 1 | Low risk — `folders.routes.ts` already gates every mutation on `workspace.admin` today; REQUIREMENTS.md's "Out of Scope" table explicitly rules out a finer-grained `tree.organize` capability for this milestone. |
| A4 | Archiving a project directly (not via folder cascade) should reuse the same `archived_at` cascade logic and emit events the same way, even though HIER-05/06's RequestContext/event_outbox modernization is textually scoped to "the folders domain" only. | Common Pitfalls (Pitfall 3) / Open Questions | If wrong, projects.service.ts's new archive method might end up half-migrated (event_outbox for cascade-triggered archives, recordEvent for direct archives) — an inconsistency the planner should explicitly resolve, not inherit by accident. |

## Open Questions

1. **Should a hard-DELETE path be retained for genuinely-empty folders/projects/programs, alongside archive?**
   - What we know: D-01 explicitly asks the researcher/planner to weigh this; CONTEXT.md leaves it open.
   - What's unclear: Whether "empty" is cheap to check (folders: no child folders AND no projects/programs/collections with that `folder_id`; projects: no programs AND no pages AND no collections with that `project_id`) versus whether archive-only (uniform, one code path) is simpler and safer.
   - Recommendation: Favor **archive-only, no hard-delete path**, for uniformity and because D-03 already requires building unarchive/restore regardless — a second "genuinely empty → hard delete" code path adds a second set of edge cases (e.g., can an archived-then-emptied node later be hard-deleted?) for no clear user-facing benefit in this phase (no "empty trash" UI exists in the roadmap through Phase 34). If the planner disagrees, scope the hard-delete path narrowly: only reachable when `array_length(ancestor_ids,1) is null or 0`-style "no descendants and no attachments" check passes, and it must NOT be the default action a UI ever exposes without an explicit confirmation distinguishing it from archive.

2. **Should the depth-limit guard also be backed by a DB check constraint (not just service-layer)?**
   - What we know: D-04 says DB constraint is optional, service-layer guard is the minimum bar.
   - What's unclear: A `CHECK` constraint referencing `array_length(ancestor_ids,1)` is straightforward and cheap; a trigger-based check (to also cover moves, not just the stored value) is more consistent with Pattern 4's cycle trigger, since both can live in the same `folders_prevent_cycle_and_depth()` trigger function.
   - Recommendation: Fold the depth check into the same trigger as the cycle check (Pattern 4) — it's a few extra lines in a trigger function that's needed anyway, and gives true defense-in-depth for a requirement (D-04) that was explicitly called out as being added "now" for cost reasons (touching these mutations once, not twice).

3. **Does a project need its own direct archive endpoint in this phase, and if so, does it get the full RequestContext/event_outbox treatment or reuse the pre-v5 signature?**
   - What we know: HIER-04 requires `archived_at` support on projects/programs; HIER-05/06 textually scope RequestContext/event_outbox modernization to "the folders domain."
   - What's unclear: Whether "projects support archived_at" (HIER-04) implies only "can be archived as a side effect of folder cascade" or also "has its own `PATCH /projects/:id/archive` endpoint independent of any folder."
   - Recommendation: Plan for both — a direct project/program archive endpoint (replacing the existing hard-delete route) is clearly implied by D-02's "this phase introduces archive as their first removal mechanism" framing (now corrected to "replaces hard-delete as their removal mechanism," but the direct-endpoint need still stands). For consistency and because the cascade path will already require `event_outbox` writes from this same code region, use `event_outbox` (not `recordEvent`) for the direct archive endpoints too — do not create a mixed-pattern seam. This is a recommendation, not a locked decision; flag for plan-check.

4. **RESOLVED — `project_pages.parent_page_id` composite-FK gap confirmed.** `database/migrations/012_page_hierarchy.sql` was read this session: `parent_page_id UUID REFERENCES project_pages(id) ON DELETE CASCADE` — a bare single-column self-referential FK with **no** `company_id` awareness, same cross-tenant gap as `folders.parent_id`. `[VERIFIED: codebase — database/migrations/012_page_hierarchy.sql]` The composite-FK migration (Pattern 3) MUST also cover `project_pages.parent_page_id` (self-ref) and `project_pages.project_id` (from `009_project_pages.sql`) — both need `UNIQUE (id, company_id)` on `project_pages` plus the composite FK rewrite. `013_page_header.sql` was not read (header/cover-image columns only, per its filename and the workspace-blocks.md summary — unlikely to affect hierarchy invariants, but planner should confirm with a quick read before finalizing the migration if time permits).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All schema work | ✓ (per `docker-compose.yml`) | `postgres:15-alpine` | — |
| `ltree` extension | Only if materialized-path approach were chosen instead of the recommended ancestor-array | Not verified this session (not needed — array approach avoided the dependency) | — | N/A — recommendation avoids needing it |

**Missing dependencies with no fallback:** None — the recommended approach (native arrays + GIN) requires no extension beyond what every Postgres install ships with.

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
| HIER-01 | `data_collections.folder_id` accepts a valid folder, rejects a different tenant's folder | unit (repository-level, mocked or against a test DB) | `node --require ts-node/register --test src/domains/records/records.repository.test.ts` | ✅ file exists, needs new case |
| HIER-02 | Cross-tenant reparent attempt is rejected at DB level (constraint violation) | integration (requires live/test Postgres) | new test file against a test DB connection | ❌ Wave 0 |
| HIER-03 | Cycle move rejected at both DB and API level | unit (service, mocked repo) + integration (DB trigger) | `folders.service.test.ts` (extend) + new DB-level test | ⚠️ service test file exists, DB-level test is Wave 0 |
| HIER-04 | Archiving a folder cascades to all descendant types in one transaction | integration (multi-table, needs real transaction semantics — hard to fully mock) | new integration test hitting a test DB | ❌ Wave 0 |
| HIER-05 | Every folder mutation uses RequestContext + capability assertion | unit | extend `folders.service.test.ts` — assert `assertCapability`/`requireCompanyId` are invoked (or that missing-capability ctx throws 403) | ⚠️ needs new cases |
| HIER-06 | No `recordEvent`/`activityLog` calls remain; durable events written | unit + static check | extend service test to assert `insertDurableEvent`/`event_outbox` call; a `grep`-based lint/static check (not a test file) to confirm `recordEvent` import is gone from `folders.service.ts` | ❌ Wave 0 (static check has no existing tooling — likely a manual verification step, not an automated test) |
| HIER-07 | Ancestor/breadcrumb lookup uses ancestor-index, not recursive CTE | unit (assert no per-row loop; assert single query call count) | extend `folders.service.test.ts` with a call-count assertion on the repository mock | ⚠️ needs new cases |

### Sampling Rate
- **Per task commit:** `node --require ts-node/register --test src/domains/folders/**/*.test.ts`
- **Per wave merge:** `npm test` (apps/api full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] A test-DB-backed integration test setup for this domain does not appear to exist yet (existing `folders.service.test.ts` mocks the repository entirely — no live-DB test observed for folders). HIER-02/03(DB)/HIER-04 need real constraint/trigger/transaction behavior, which cannot be meaningfully asserted against a mocked repository. Planner must decide: add a lightweight test-DB integration harness (check whether one already exists elsewhere in `apps/api` for another domain — not confirmed in this research pass) or accept these as `manual-only` verification steps with clear justification.
- [ ] `folders.repository.test.ts` does not exist yet (only `folders.service.test.ts` does) — needed for ancestor-array/composite-FK-aware repository methods.
- [ ] Static "no `recordEvent` import remains" check has no existing tooling in this repo (no ESLint custom rule observed) — likely a manual grep step during verification, not an automated test.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | yes | `assertCapability(ctx, 'workspace.admin')` on every mutation (existing pattern, `core/capabilities/index.ts`) |
| V5 Input Validation | yes | Zod schemas in `folders/dto/folder.dto.ts` (existing pattern) — extend with archive/unarchive DTOs |
| V6 Cryptography | no | No new secrets/crypto surface in this phase |
| V2 Authentication | no | Unchanged — `authenticateToken` middleware already gates the router |
| V3 Session Management | no | Unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant reparenting (moving/attaching a node so it points at another company's tree) | Tampering / Elevation of Privilege | Composite `(id, company_id)` FK invariant (Pattern 3) — this is the core security property this phase must deliver at the DB layer, not just the service layer |
| Cycle-based denial of service (a self-referential or circular tree causing infinite recursion in any future recursive read) | Denial of Service | DB trigger rejection (Pattern 4) at write time, so no recursive read code path can ever encounter a cycle regardless of future bugs |
| Missing capability check on a new archive/unarchive endpoint | Elevation of Privilege | Ensure `archiveFolder`/`unarchiveFolder`/project-direct-archive routes are wired with `requireCapability('workspace.admin')` exactly like existing `create`/`update`/`move`/`delete` routes in `folders.routes.ts` — do not forget this on net-new endpoints |

## Sources

### Primary (HIGH confidence)
- `apps/api/src/domains/workflows/workflows.service.ts` — canonical v5 pattern, read in full this session
- `apps/api/src/core/auth/request-context.ts` — read in full this session
- `apps/api/src/core/capabilities/index.ts` — read in full this session
- `apps/api/src/core/events/outbox.ts` — read in full this session
- `apps/api/src/domains/folders/{folders.service,folders.repository,folders.controller,folders.routes,folders.types,folders.service.test}.ts` — read in full this session
- `apps/api/src/domains/projects/{projects.service,projects.repository,projects.types}.ts` — read in full this session (source of the D-02 correction)
- `apps/api/src/domains/records/{records.types,records.service}.ts` and `records.repository.ts` (partial grep) — read this session
- `database/migrations/{004_projects_and_programs,006_folders,009_project_pages,025_records_views,026_event_outbox}.sql` — read in full this session
- `docker-compose.yml` (grep for Postgres image) — read this session
- `apps/api/package.json` (test script) — read this session

### Secondary (MEDIUM confidence)
- Composite `(id, company_id)` FK pattern, ancestor-array vs. materialized-path tradeoff, and BEFORE-trigger cycle rejection: these are standard, widely-documented PostgreSQL hierarchical-data techniques (no single canonical doc cited — this is schema-design reasoning applied to this project's existing conventions, not a library API). Treated as MEDIUM confidence design guidance rather than a verified library fact.

### Tertiary (LOW confidence)
- None — no WebSearch was performed for this phase since it involves no external library or framework beyond Postgres core SQL and this repo's own existing code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; 100% grounded in code read this session
- Architecture: MEDIUM-HIGH — patterns are standard SQL/Postgres technique, verified against this repo's exact schema, but not validated by actually running the trigger/constraint SQL in this session (no DB access)
- Pitfalls: HIGH for the codebase-specific ones (D-02 correction, locked `data_collections` schema note — both directly grounded in files read); MEDIUM for the generic SQL pitfalls (constraint naming, off-by-one depth)

**Research date:** 2026-07-16
**Valid until:** 30 days (schema/architecture research for an internal, non-fast-moving domain — no external library version drift risk)
