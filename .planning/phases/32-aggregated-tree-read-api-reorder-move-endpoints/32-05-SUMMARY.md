---
phase: 32-aggregated-tree-read-api-reorder-move-endpoints
plan: 05
subsystem: folders-domain-move-endpoint
tags: [express, zod, tenancy-checks, folders-domain, tdd, live-db-integration-test]

dependency-graph:
  requires:
    - "apps/api/src/domains/folders/dto/tree.dto.ts (MoveNodeSchema, built in 32-01)"
    - "apps/api/src/domains/folders/folders.service.ts (moveFolder — Phase 31 cycle/depth check, built in 32-04's file, delegated to verbatim)"
    - "apps/api/src/domains/projects/projects.repository.ts (findProjectForCompany/findProgramForCompany, built pre-Phase-32)"
    - "apps/api/src/domains/records/records.repository.ts (findCollection/updateCollection, built pre-Phase-32)"
  provides:
    - "foldersService.moveNode(ctx, body) — capability-gated dispatch-by-node_type reparent"
    - "POST /folders/tree/move — workspace.admin-gated route"
    - "projectsRepository.setProjectFolder / setProgramParent — explicit (non-COALESCE) reparent primitives"
  affects: [33-read-only-tree-ui, 34-drag-create-rename-archive-ui]

tech-stack:
  added: []
  patterns:
    - "Explicit-set repository methods (setProjectFolder/setProgramParent) for reparent writes, distinct from the existing COALESCE-based PATCH updateProject/updateProgram — COALESCE cannot represent 'clear this field to null'"
    - "Route-ordering: /tree/move registered before the /:id catch-all, same guard as /tree/full and /tree/reorder"

key-files:
  created: []
  modified:
    - apps/api/src/domains/folders/folders.service.ts
    - apps/api/src/domains/folders/folders.controller.ts
    - apps/api/src/domains/folders/folders.routes.ts
    - apps/api/src/domains/folders/folders.service.test.ts
    - apps/api/src/domains/folders/folders.integration.test.ts
    - apps/api/src/domains/projects/projects.repository.ts
    - apps/api/src/domains/projects/projects.repository.test.ts

decisions:
  - "Added projectsRepository.setProjectFolder/setProgramParent as dedicated explicit-set methods rather than reusing updateProject/updateProgram, because those two use COALESCE($n, column) PATCH semantics where a null argument is a no-op ('leave unchanged'), which cannot represent moveNode's 'clear folder_id to null' (un-file / switch scope) requirement. updateProject/updateProgram's existing callers (projects.service.ts PATCH endpoints) are untouched."
  - "moveNode's 'folder' branch is a single delegating call to the existing moveFolder — confirmed by test (foldersRepository.moveFolder mock invocation count) and by source inspection, per the plan's explicit requirement to never duplicate Phase 31's cycle/depth check"

requirements-completed: [TREEAPI-03, TREEAPI-04]

metrics:
  duration: "~45 minutes (session interrupted mid-task once, resumed from last committed state)"
  completed: "2026-07-19"
---

# Phase 32 Plan 05: Aggregated Tree Move Endpoint Summary

One-liner: `POST /folders/tree/move` — capability-gated, dispatch-by-node_type reparent covering all 4 tree node types (folder/project/program/data_collection), distinguishing cross-tenant-destination (404) from folder-cycle (400) rejections, with full support for moving project-filed programs to either a folder or a project destination — closing out Phase 32.

## Performance

- **Duration:** ~45 min active work (session was interrupted by an API/session limit mid-Task-1 and resumed from the last committed state)
- **Tasks:** 2 completed (plus one Rule-1 prerequisite fix)
- **Files modified:** 7

## Accomplishments

- `foldersService.moveNode(ctx, body)` dispatches by `node_type` (and by the `project_id` disambiguator for programs) to the existing per-domain, company-scoped ownership checks — `'folder'` delegates verbatim to `moveFolder` (Phase 31's cycle/depth check is never duplicated), `'project'`/`'program'`/`'data_collection'` each pre-check `node_id` ownership before validating and writing the destination.
- Discovered and fixed (Rule 1) a real bug in the reuse path the plan specified: `projectsRepository.updateProject`/`updateProgram` are COALESCE-based PATCH updates where passing `folder_id: null` is a silent no-op, not a clear. Since `moveNode` needs to actually clear `folder_id`/`project_id` (un-filing, or switching a program between folder-filed and project-filed), added `setProjectFolder` and `setProgramParent` — unconditional `SET`, not `COALESCE` — and used those instead.
- `POST /folders/tree/move` registered (workspace.admin-gated) before the `/:id` catch-all, alongside the existing `/tree/full` and `/tree/reorder` routes.
- 11 new unit tests in `folders.service.test.ts` cover: 403 pre-repository-call, folder delegation (mock-invocation-count proof of no duplicate cycle-check), cross-tenant destination 404 for project moves, missing-`node_id` 404 for project/data_collection, `data_collection` un-filing, and both program-scope branches (`project_id` set vs. omitted) including cross-tenant project-scoped destination rejection.
- 2 new unit tests in `projects.repository.test.ts` for the new `setProjectFolder`/`setProgramParent` methods, proving explicit-null-set SQL shape.
- 3 new live-DB integration tests in `folders.integration.test.ts`: cross-tenant project-move-destination 404 (distinct from the folder-cycle 400), non-admin 403 on both `moveNode` and `reorderSiblings`, and an end-to-end project-scoped program move proving `project_id` gets set and `folder_id` gets cleared against a real database.

## Task Commits

1. **Rule-1 prerequisite fix:** `fix(32-05): add explicit-null reparent methods to projects.repository` — `72c8620`
2. **Task 1 (RED):** `test(32-05): add failing tests for moveNode dispatch` — `2e5e1d2`
3. **Task 1 (GREEN):** `feat(32-05): implement moveNode dispatch (folders.service.ts)` — `85be4f5`
4. **Task 2:** `feat(32-05): wire POST /folders/tree/move + cross-tenant/capability integration coverage` — `f87ee7b`

## Files Created/Modified

- `apps/api/src/domains/projects/projects.repository.ts` — added `setProjectFolder`, `setProgramParent` (explicit reparent, non-COALESCE)
- `apps/api/src/domains/projects/projects.repository.test.ts` — 2 new tests for the above
- `apps/api/src/domains/folders/folders.service.ts` — added `moveNode(ctx, body)` dispatcher
- `apps/api/src/domains/folders/folders.service.test.ts` — 11 new `moveNode` unit tests
- `apps/api/src/domains/folders/folders.controller.ts` — added `moveNode` handler
- `apps/api/src/domains/folders/folders.routes.ts` — registered `POST /tree/move`
- `apps/api/src/domains/folders/folders.integration.test.ts` — 3 new live-DB tests (TREEAPI-03 cross-tenant 404, TREEAPI-04 403s, TREEAPI-03 project-scoped program move)

## Decisions Made

- Added dedicated `setProjectFolder`/`setProgramParent` repository methods instead of reusing `updateProject`/`updateProgram` — see frontmatter `decisions`. This is the one place this plan's action text (which assumed `updateProject(node_id, { folder_id: new_parent_id })` would just work) needed correcting for actual correctness.
- Kept `moveNode`'s `'folder'` branch as a single delegating call (`return this.moveFolder(ctx, nodeId, { parent_id: newParentId })`), matching the plan's explicit non-negotiable requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `updateProject`/`updateProgram`'s COALESCE semantics silently no-op a `folder_id: null` clear**
- **Found during:** Task 1 (moveNode service dispatch), while reading `projects.repository.ts` per the plan's `<read_first>` instruction
- **Issue:** The plan's action text specified calling `projectsRepository.updateProject(node_id, { folder_id: new_parent_id })` and `updateProgram(node_id, { project_id, folder_id: null })`. Both `updateProject` and `updateProgram` build their SQL as `folder_id = COALESCE($n, folder_id)` — passing `null` for `data.folder_id` is treated as "no value provided, keep existing," not "set to null." This would have silently broken un-filing a project/program to root (`new_parent_id: null`) and switching a program between folder-filed and project-filed scope (the exact gap TREEAPI-03 requires closing).
- **Fix:** Added `setProjectFolder(id, companyId, folderId)` and `setProgramParent(id, companyId, { folderId, projectId })` to `projects.repository.ts` — unconditional `UPDATE ... SET folder_id = $3` (and `project_id = $4` for programs), no COALESCE. `moveNode` calls these instead of `updateProject`/`updateProgram`. The existing PATCH-endpoint callers of `updateProject`/`updateProgram` (`projects.service.ts`) are untouched, so no existing behavior changed.
- **Files modified:** `apps/api/src/domains/projects/projects.repository.ts`, `apps/api/src/domains/projects/projects.repository.test.ts`
- **Verification:** 2 new repository unit tests assert the exact SQL shape (`folder_id = $3`, no COALESCE) and that a `null` argument round-trips as `null` in the returned row; `moveNode`'s own tests assert the correct arguments are passed to these new methods including for the null-clearing cases.
- **Committed in:** `72c8620`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — bug preventing correctness of a requirement the plan explicitly calls out: "no scope is left unreachable through this endpoint")
**Impact on plan:** Necessary for TREEAPI-03's correctness; no scope creep — the new methods do exactly what the plan's already-specified `moveNode` behavior needs, just via a correct repository primitive instead of the COALESCE-based one that would have silently failed.

## Issues Encountered

- Session was interrupted by an API/session limit partway through Task 1's GREEN implementation (after the RED commit `2e5e1d2` and the prerequisite fix `72c8620`). Resumed cleanly from the last committed git state per the coordinator's resume instructions — no rework needed, only completed the in-progress uncommitted edit (fixing non-UUID test fixture strings to satisfy `MoveNodeSchema`'s `z.string().uuid()` validation on `node_id`).
- Same pre-existing environment gap documented in every prior plan this phase (32-01 through 32-04): this worktree has no `.env` and no reachable dev Postgres, so both `folders.integration.test.ts` and `folders.reorder-concurrency.integration.test.ts` fail at `before()`/first query with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` — a connection-configuration error, not a test-logic failure. `npm test` reports 199/211 passing; all 12 failures are in these two integration-test files (pre-existing gap, confirmed by running `folders.integration.test.ts` alone and seeing the same error on every test, including ones from prior plans like HIER-02/HIER-03/HIER-04/TREEAPI-01). The 3 new moveNode integration tests type-check cleanly (`npx tsc --noEmit` — clean) and statically match the plan's Task 2 spec. Recommend running the full integration suite in CI/an environment with `.env` configured before Phase 33 UI work begins, as recommended in every prior plan's summary this phase.
- Node module resolution required the same Windows directory junctions to the main repo's `node_modules` (root and `apps/api`) documented in 32-01 through 32-04 — gitignored, untracked, local tooling artifacts only, not part of any commit.

## Verification Results

- `cd apps/api && node --require ts-node/register --test src/domains/projects/projects.repository.test.ts` — 8/8 pass (6 pre-existing + 2 new `setProjectFolder`/`setProgramParent` tests).
- `cd apps/api && node --require ts-node/register --test src/domains/folders/folders.service.test.ts` — 34/34 pass (23 pre-existing + 11 new `moveNode` tests).
- `cd apps/api && npx tsc --noEmit` — clean, no errors.
- `folders.routes.ts` — `POST /tree/move` registered after `/tree/reorder`, before the `/:id` catch-all, gated with `requireCapability('workspace.admin')`.
- `cd apps/api && npm test` — 199/211 pass; all 12 failures confined to the two pre-existing DB-dependent integration test files (environment gap, not a code defect — see Issues Encountered).
- `folders.integration.test.ts`'s 3 new moveNode tests — could not execute live against Postgres in this environment; type-check cleanly and statically match the plan's Task 2 spec (same verification approach as every prior plan this phase under the same environment gap).

## Known Stubs

None.

## Threat Flags

None — this plan implements exactly the four threats already registered in its own `<threat_model>` (T-32-05-01 destination tenant-ownership checks reused from existing 404-on-cross-tenant helpers, T-32-05-02 redundant capability gate at route+service, T-32-05-03 folder cycle-detection delegated not duplicated, T-32-05-04 node_type confusion accepted and naturally 404s via type-specific tenant-scoped lookups). No new packages, no new query patterns beyond the plan's own already-reviewed repository primitives plus the two new explicit-set methods documented above as a deviation.

## Self-Check: PASSED

- FOUND: apps/api/src/domains/projects/projects.repository.ts (setProjectFolder, setProgramParent added)
- FOUND: apps/api/src/domains/projects/projects.repository.test.ts (2 new tests)
- FOUND: apps/api/src/domains/folders/folders.service.ts (moveNode added)
- FOUND: apps/api/src/domains/folders/folders.service.test.ts (11 new moveNode tests)
- FOUND: apps/api/src/domains/folders/folders.controller.ts (moveNode handler added)
- FOUND: apps/api/src/domains/folders/folders.routes.ts (POST /tree/move registered)
- FOUND: apps/api/src/domains/folders/folders.integration.test.ts (3 new live-DB tests)
- FOUND commit 72c8620 (Rule 1 fix — explicit-null reparent methods)
- FOUND commit 2e5e1d2 (RED — failing moveNode tests)
- FOUND commit 85be4f5 (GREEN — moveNode implementation)
- FOUND commit f87ee7b (route + controller + integration tests)

## Next Phase Readiness

`POST /folders/tree/move` is live, workspace.admin-gated, and dispatches correctly across all 4 node types including both folder-filed and project-filed programs. Combined with 32-04's `POST /folders/tree/reorder` and 32-03's `GET /folders/tree/full`, Phase 32's full read/reorder/move API surface (TREEAPI-01 through TREEAPI-04) is complete. This is the final plan in Phase 32 — ready for Phase 33 (read-only tree UI) to consume `GET /tree/full`, and Phase 34 (drag/create/rename/archive UI) to consume `/tree/reorder` and `/tree/move`. Both `.reorder-concurrency` and the cross-tenant/capability move integration tests should be run once against a live dev Postgres before either UI phase ships, to close the environment-gap verification noted above.

---
*Phase: 32-aggregated-tree-read-api-reorder-move-endpoints*
*Completed: 2026-07-19*
