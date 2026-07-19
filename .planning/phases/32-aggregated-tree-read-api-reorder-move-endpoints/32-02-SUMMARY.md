---
phase: 32-aggregated-tree-read-api-reorder-move-endpoints
plan: 02
subsystem: repository-layer-sibling-reorder
tags: [postgres-locking, reorder, projects-domain, folders-domain, records-domain, tdd]
dependency-graph:
  requires:
    - "database/migrations/029_tree_sort_order.sql (sort_order columns on projects/programs/data_collections)"
  provides:
    - "apps/api/src/domains/projects/projects.repository.ts (reorderProjects, reorderPrograms)"
    - "apps/api/src/domains/folders/folders.repository.ts (reorderFolders)"
    - "apps/api/src/domains/records/records.repository.ts (reorderCollections)"
  affects:
    - "32-04 (reorder endpoint) will call these four repository methods inside a service-layer transaction"
tech-stack:
  added: []
  patterns:
    - "SELECT ... FOR UPDATE (blocking, no SKIP LOCKED) to lock the exact sibling row set before renumbering"
    - "Single UPDATE ... FROM (VALUES ($n::uuid,pos),...) renumber statement with numbered id placeholders and inlined integer positions (no UUID string interpolation)"
    - "Set-equality check (size + every) between locked ids and submitted orderedIds; AppError(409) on mismatch, no UPDATE issued"
key-files:
  created:
    - apps/api/src/domains/projects/projects.repository.test.ts
  modified:
    - apps/api/src/domains/projects/projects.repository.ts
    - apps/api/src/domains/folders/folders.repository.ts
    - apps/api/src/domains/folders/folders.repository.test.ts
    - apps/api/src/domains/records/records.repository.ts
    - apps/api/src/domains/records/records.repository.test.ts
decisions:
  - "sort_order positions (0..n-1) are inlined as integer literals directly in the VALUES SQL text rather than parameterized — they are internally-computed array indices, not user input, so this keeps the params array length at exactly 2 + orderedIds.length per the plan's acceptance criteria, while only the sibling UUIDs (genuine external input) go through numbered placeholders"
  - "reorderProjects/reorderFolders/reorderCollections early-return (no UPDATE issued) when orderedIds is empty and the locked set is also empty, since an empty VALUES() list is invalid SQL — not explicitly required by the plan's 4 test cases but needed to avoid a runtime SQL error on the legitimate empty-folder-with-no-children case"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-19"
---

# Phase 32 Plan 02: Lock-Safe Sibling Reorder Repository Primitives Summary

One-liner: `SELECT ... FOR UPDATE` (blocking) + single `UPDATE ... FROM (VALUES ...)` renumber, with `AppError(409)` on stale sibling-set mismatch, implemented identically across `reorderProjects`, `reorderPrograms`, `reorderFolders`, and `reorderCollections`.

## What Was Built

**Task 1 — `reorderProjects` + `reorderPrograms` (projects.repository.ts):** Both take a `PoolClient` as the first argument (transaction-participant convention matching `archiveProjectsInFolders`). `reorderProjects` locks siblings via `WHERE company_id = $1 AND folder_id IS NOT DISTINCT FROM $2 AND archived_at IS NULL FOR UPDATE`; `reorderPrograms` locks via the same shape plus `AND project_id IS NOT DISTINCT FROM $3`, since a program's siblings share both `folder_id` and `project_id`. Both compare the locked id set against the caller's `orderedIds` by set equality (size match + every id present) and throw `AppError(409, 'Sibling set has changed since last read — refresh and retry')` on any mismatch — without issuing the renumber UPDATE. On match, a single `UPDATE ... FROM (VALUES ($3::uuid,0),($4::uuid,1),...) AS v(id, pos)` statement renumbers `sort_order` to array index, with only the UUIDs parameterized (positions are inlined integer literals since they're internally computed, not external input). `projects.repository.test.ts` is a new file (none existed previously) covering all 4 behavior cases from the plan for both methods.

**Task 2 — `reorderFolders` (folders.repository.ts) + `reorderCollections` (records.repository.ts):** Identical lock-then-renumber shape. `reorderFolders` scopes by `parent_id IS NOT DISTINCT FROM $2` on `folders` (folders already had `sort_order` from `006_folders.sql`, no migration dependency). `reorderCollections` scopes by `folder_id IS NOT DISTINCT FROM $2` on `data_collections`. `AppError` is now imported in `records.repository.ts` (it was not previously). Both existing test files (`folders.repository.test.ts`, `records.repository.test.ts`) were extended with the same 4-case coverage, reusing the `fakeClient` object-literal mocking pattern already present in each file's `PoolClient`-taking method tests.

All four methods followed strict RED/GREEN TDD: each new test file/section was run and confirmed failing (`Property 'reorderX' does not exist`) before the corresponding implementation was added, per two `test(...)` -> `feat(...)` commit pairs.

## Deviations from Plan

None — plan executed exactly as written. The empty-orderedIds early-return (see Decisions) is a defensive addition within the method bodies, not a deviation from any specified behavior — it prevents a SQL syntax error on `VALUES ()` for the legitimate "folder/collection/project with zero remaining children" case, which the plan's 4 documented test cases don't exercise but which the lock-then-set-compare logic would otherwise reach silently.

### Environment note (not a deviation, no plan/code changes)

Same as 32-01: this worktree's `node_modules` was not present (gitignored, not checked out per-worktree). Temporary local Windows directory junctions to the main repo's already-installed `node_modules` (root and `apps/api`) were created for the duration of verification, gitignored/untracked, not part of any commit, and left in place since the worktree is force-removed by the orchestrator after this agent returns.

## Verification Results

- `cd apps/api && node --require ts-node/register --test src/domains/projects/projects.repository.test.ts src/domains/folders/folders.repository.test.ts src/domains/records/records.repository.test.ts` — 31/31 tests pass (6 new for projects, 4 new for folders, 4 new for records, plus all pre-existing tests in each file unaffected).
- `cd apps/api && npx tsc --noEmit` — clean, no errors.
- All 4 new methods' lock SELECT statements assert-matched against `/FOR UPDATE/` and assert-not-matched against `/SKIP LOCKED/` in their respective tests.
- All 4 new methods' renumber UPDATE statements assert-matched against `/FROM \(VALUES/`, with params arrays asserted via `deepEqual` to `[companyId, scopeParam(s)..., ...orderedIds]` — confirming no raw UUID string interpolation.
- All 4 new methods reject a stale sibling-set call with an `AppError` whose `.status === 409` (missing id, extra id, and empty-locked-set-with-nonempty-orderedIds cases all covered).

## Known Stubs

None.

## Threat Flags

None — this plan implements exactly the two threats already registered in its own `<threat_model>` (T-32-02-01 blocking-lock serialization, T-32-02-02 parameterized-UUID renumber). No new network endpoints, auth paths, or schema changes; these methods are repository-layer primitives not yet wired to any route (wiring is 32-04's scope).

## Self-Check: PASSED

- FOUND: apps/api/src/domains/projects/projects.repository.ts (reorderProjects, reorderPrograms added)
- FOUND: apps/api/src/domains/projects/projects.repository.test.ts (new file)
- FOUND: apps/api/src/domains/folders/folders.repository.ts (reorderFolders added)
- FOUND: apps/api/src/domains/folders/folders.repository.test.ts (extended)
- FOUND: apps/api/src/domains/records/records.repository.ts (reorderCollections added)
- FOUND: apps/api/src/domains/records/records.repository.test.ts (extended)
- FOUND commit c73ed44 (RED — projects reorder tests)
- FOUND commit 2eea21f (GREEN — projects reorder implementation)
- FOUND commit 742cf07 (RED — folders/records reorder tests)
- FOUND commit e80017b (GREEN — folders/records reorder implementation)
