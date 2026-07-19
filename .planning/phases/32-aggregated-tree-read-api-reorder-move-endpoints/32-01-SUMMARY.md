---
phase: 32-aggregated-tree-read-api-reorder-move-endpoints
plan: 01
subsystem: folders-domain-schema-dto-testinfra
tags: [migration, zod-dto, concurrency-testing, folders-domain]
dependency-graph:
  requires: []
  provides:
    - "database/migrations/029_tree_sort_order.sql (sort_order columns on projects/programs/data_collections)"
    - "apps/api/src/domains/folders/dto/tree.dto.ts (ReorderNodesSchema, MoveNodeSchema)"
    - "apps/api/src/domains/folders/folders.types.ts (TreeNode discriminated-union type)"
    - "apps/api/src/core/testUtils/concurrentRace.ts (raceLockedTransactions harness)"
  affects:
    - "32-04 (reorder endpoint) consumes ReorderNodesSchema + raceLockedTransactions"
    - "32-05 (move endpoint) consumes MoveNodeSchema"
    - "aggregated tree read endpoint consumes TreeNode"
tech-stack:
  added: []
  patterns:
    - "Idempotent additive SQL migration (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS), matching 028's convention"
    - "Zod schema + z.infer<> DTO pair, matching folder.dto.ts convention"
    - "node:test + fake pool/client stubs for concurrency-orchestration unit testing (no live DB)"
key-files:
  created:
    - database/migrations/029_tree_sort_order.sql
    - apps/api/src/domains/folders/dto/tree.dto.ts
    - apps/api/src/core/testUtils/concurrentRace.ts
    - apps/api/src/core/testUtils/concurrentRace.test.ts
  modified:
    - apps/api/src/domains/folders/folders.types.ts
decisions:
  - "project_id disambiguator on both ReorderNodesSchema and MoveNodeSchema is optional+nullable, defaulting to folder-scope so non-program node types are unaffected"
  - "'page' node_type intentionally excluded from NodeType enum this phase; page reparenting stays on existing PATCH /projects/pages/:pageId"
metrics:
  duration: "~35 minutes"
  completed: "2026-07-19"
---

# Phase 32 Plan 01: Tree Schema, DTOs & Concurrency Test Harness Summary

One-liner: Additive `sort_order` migration plus Zod reorder/move DTOs (with a `project_id` program-scope disambiguator) and a reusable two-transaction concurrency-race test harness, laying the foundation for Phase 32's aggregated tree read and write endpoints.

## What Was Built

**Task 1 — Migration 029:** `database/migrations/029_tree_sort_order.sql` adds `sort_order INTEGER NOT NULL DEFAULT 0` to `projects`, `programs`, and `data_collections` (folders and project_pages already had it), plus three supporting indexes (`projects_folder_sort_idx`, `programs_parent_sort_idx`, `data_collections_folder_sort_idx`). Every statement uses `IF NOT EXISTS` per the project's idempotent-migration convention, matching the immediately-preceding migration `028_folder_hierarchy_invariants.sql`.

**Task 2 — Tree DTOs + TreeNode type:** `apps/api/src/domains/folders/dto/tree.dto.ts` exports `ReorderNodesSchema` and `MoveNodeSchema`, both gated by a strict `NodeType` Zod enum (`'folder' | 'project' | 'program' | 'data_collection'` — `'page'` intentionally excluded). Both schemas carry an optional `project_id` field that disambiguates project-scoped programs (non-null `project_id`) from folder-scoped programs (omitted/null, the default) — necessary because `programs` rows carry both `folder_id` and `project_id` columns. `folders.types.ts` gained a `TreeNode` discriminated-union-shaped interface (`node_type`, `id`, `company_id`, `name`, `children: TreeNode[]`, `raw`) for the aggregated tree read endpoint.

**Task 3 — Concurrency race harness (TDD):** `apps/api/src/core/testUtils/concurrentRace.ts` exports `raceLockedTransactions<A, B>(pool, txnA, txnB)`, a DB-agnostic orchestration wrapper (no SQL inside) that checks out both `PoolClient`s via `pool.connect()` before invoking either callback, runs both concurrently via `Promise.all`, tracks `bStartedAt`/`aFinishedAt`/`bFinishedAt`, and releases both clients in a `finally` block regardless of success/failure. `concurrentRace.test.ts` covers all 4 behavior cases from the plan using fake pool/client stubs — no live Postgres connection required. Followed RED/GREEN TDD: the test was written and confirmed failing (module-not-found) before the implementation was added.

## Deviations from Plan

None — plan executed exactly as written.

### Environment note (not a deviation, no plan/code changes)

This worktree's `node_modules` was not present (gitignored, not checked out per-worktree). To run `tsc --noEmit` and the `node --require ts-node/register --test` verification commands specified in the plan, dependencies were made available via temporary local Windows directory junctions to the main repo's already-installed `node_modules` (root and `apps/api`) for the duration of verification. These junctions are gitignored, untracked, and were not part of any commit — they are local tooling artifacts only, left in place since the worktree is force-removed by the orchestrator after this agent returns. `psql` is not installed in this environment, so migration 029's idempotency was proven statically (every statement uses `IF NOT EXISTS`) per the plan's documented fallback.

## Verification Results

- `cd apps/api && npx tsc --noEmit` — clean, no errors in any file touched by this plan.
- `ReorderNodesSchema`/`MoveNodeSchema` — all 5 acceptance-criteria cases from the plan verified manually via `node --require ts-node/register -e`: empty `ordered_ids` rejected, `'page'` node_type rejected, `project_id` disambiguator round-trips on both schemas, and `project_id`-omitted case still succeeds for non-program node types.
- `node --require ts-node/register --test src/core/testUtils/concurrentRace.test.ts` — 4/4 tests pass (connect-before-txn ordering, concurrent-not-sequential execution, result passthrough, release-on-throw).

## Known Stubs

None.

## Threat Flags

None — this plan only adds DTOs/types/migration/test-infra; no new network endpoints, auth paths, or schema changes at trust boundaries beyond what's already documented in the plan's own threat model (T-32-01-01, T-32-01-02).

## Self-Check: PASSED

- FOUND: database/migrations/029_tree_sort_order.sql
- FOUND: apps/api/src/domains/folders/dto/tree.dto.ts
- FOUND: apps/api/src/domains/folders/folders.types.ts (TreeNode added)
- FOUND: apps/api/src/core/testUtils/concurrentRace.ts
- FOUND: apps/api/src/core/testUtils/concurrentRace.test.ts
- FOUND commit 394cca0 (migration)
- FOUND commit 72d7e73 (DTOs + TreeNode)
- FOUND commit 3ee6d06 (RED — failing test)
- FOUND commit 881ebbd (GREEN — harness implementation)
