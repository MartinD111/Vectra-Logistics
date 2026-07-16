---
phase: 31-data-model-modernize-folders-domain
plan: 01
subsystem: database
tags: [postgres, migrations, folders, multi-tenancy, triggers]

# Dependency graph
requires: []
provides:
  - "data_collections.folder_id column + index"
  - "Composite (id, company_id) FK invariants across folders/projects/programs/data_collections/project_pages"
  - "folders_prevent_cycle_and_depth trigger (cycle + depth>3 rejection)"
  - "archived_at columns on folders/projects/programs/data_collections/project_pages"
  - "folders.ancestor_ids (GIN-indexed), backfilled for existing rows"
affects: [31-02, 31-03, 31-04, 31-05, 31-06, phase-32, phase-33, phase-34]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite (id, company_id) FK invariant for tenant-safe self-referential/parent-pointer hierarchies"
    - "One-time DO $$ ... WITH RECURSIVE $$ backfill block (not a per-request query) followed by array-column GIN index for O(1) ancestor-chain reads going forward"
    - "DROP CONSTRAINT IF EXISTS <assumed-default-name> + ADD CONSTRAINT <explicit-name> pattern for idempotently upgrading single-column FKs to composite FKs"

key-files:
  created:
    - database/migrations/028_folder_hierarchy_invariants.sql
  modified: []

key-decisions:
  - "ancestor_ids maintenance on create/move is deferred to the service layer (later plan), not this trigger — matches RESEARCH.md Pattern recommendation; the migration's trigger only enforces cycle/depth rejection, it does not write ancestor_ids"
  - "UNIQUE (id, company_id) added only to folders/projects/project_pages — not programs or data_collections — since only those three are referenced as parent-pointer targets elsewhere in the tree"
  - "Backfill flags (RAISE NOTICE) but does not truncate/reject pre-existing folders deeper than 3 levels; the depth-3 guard in the trigger only applies to new creates/moves going forward"

requirements-completed: [HIER-01, HIER-02, HIER-03, HIER-04, HIER-07]

duration: 15min
completed: 2026-07-16
---

# Phase 31 Plan 01: Folder Hierarchy Invariants Migration Summary

**Single idempotent migration (028_folder_hierarchy_invariants.sql) adding data_collections.folder_id, composite (id, company_id) FK invariants across the folder/project/program/collection/page tree, a cycle+depth-3 trigger on folders, archived_at columns, and a GIN-indexed ancestor_ids array with one-time backfill.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed
- **Files modified:** 1 (new file)

## Accomplishments
- `data_collections.folder_id` column + index added (HIER-01 schema half)
- 8 composite `(id, company_id)` foreign keys added, replacing single-column FKs, so no code path can reparent a folder/project/program/collection/page row into a different tenant's node (HIER-02, T-31-01 mitigated)
- `folders_prevent_cycle_and_depth()` trigger rejects self-parenting, descendant-cycles, and nesting beyond depth 3 at the database level, independent of caller (HIER-03, D-04, T-31-02 mitigated)
- `archived_at TIMESTAMPTZ` added to folders/projects/programs/data_collections/project_pages (HIER-04 schema half)
- `folders.ancestor_ids UUID[]` added, GIN-indexed, and backfilled for every existing folder row via a one-time recursive CTE inside a `DO $$` block (HIER-07 schema half)

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive columns, indexes, and ancestor_ids backfill** - `9bd0589` (feat)
2. **Task 2: Composite (id, company_id) FK invariants + cycle/depth trigger** - `e06cef7` (feat)

_Both tasks append to the same migration file `database/migrations/028_folder_hierarchy_invariants.sql`, committed in the order the plan defines them._

## Files Created/Modified
- `database/migrations/028_folder_hierarchy_invariants.sql` - New idempotent migration: archived_at columns, ancestor_ids + backfill, data_collections.folder_id, 8 composite FKs, folder cycle/depth trigger

## Decisions Made
- Followed RESEARCH.md's explicit guidance that `ancestor_ids` maintenance on insert/move belongs to the service layer in a later plan, not this migration's trigger — the trigger here is scoped strictly to cycle/depth rejection.
- Kept `UNIQUE (id, company_id)` limited to the three tables (`folders`, `projects`, `project_pages`) whose `id` is actually referenced as a parent-pointer target elsewhere, per the plan's explicit instruction not to add it to `programs`/`data_collections`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Docker/Postgres was not reachable from this worktree agent's sandboxed environment (`docker ps`/`docker info` returned no output, no running containers), so the plan's `<verify>` step ("apply via `npm run migrate` against the running dev Postgres, confirm idempotent re-run, run manual `psql` cycle/depth/cross-tenant exception checks") could not be executed here. This matches the plan's own annotation of these verify steps as `MISSING — Wave 0`, i.e. expected to require infrastructure beyond a single execute-plan agent. The migration SQL was verified instead via:
- Manual review against `006_folders.sql`, `004_projects_and_programs.sql`, `025_records_views.sql`, `009_project_pages.sql`, `012_page_hierarchy.sql` for correct existing-constraint names, column types, and `ON DELETE` behaviors.
- `grep` verification of every acceptance-criteria pattern in the plan (5x `ADD COLUMN IF NOT EXISTS archived_at`, `ancestor_ids UUID[] NOT NULL DEFAULT '{}'`, GIN index, `WITH RECURSIVE` inside a one-time `DO $$` block, `RAISE NOTICE` depth warning, 3x `UNIQUE (id, company_id)`, 8x composite `FOREIGN KEY (...) REFERENCES ... (id, company_id)`, trigger function + `CREATE TRIGGER ... BEFORE INSERT OR UPDATE OF parent_id ON folders`).

**Follow-up recommended:** Before or during plan 31-02 (or whichever plan next touches this database), run `cd apps/api && npm run build && npm run migrate` against the dev Postgres (docker-compose `postgres` service, port 5433) to confirm the migration applies cleanly, then the manual `psql` cycle/depth/cross-tenant exception checks described in Task 2's acceptance criteria, before building application code on top of these invariants.

## Next Phase Readiness
- Schema foundation for the entire folders domain rework is in place: composite FK tenant-safety, cycle/depth trigger, archived_at columns, and ancestor_ids are all ready for the repository/service-layer plans (31-02 onward) to build against.
- **Blocker for downstream plans:** live-database verification (migration apply + manual exception-path checks) has not yet been performed in this environment — recommended as a first step before or during the next plan that touches this schema.

## Self-Check: PASSED

- FOUND: `database/migrations/028_folder_hierarchy_invariants.sql`
- FOUND: `.planning/phases/31-data-model-modernize-folders-domain/31-01-SUMMARY.md`
- FOUND commit `9bd0589` (Task 1)
- FOUND commit `e06cef7` (Task 2)
- FOUND commit `3ee16a0` (docs: plan metadata)
