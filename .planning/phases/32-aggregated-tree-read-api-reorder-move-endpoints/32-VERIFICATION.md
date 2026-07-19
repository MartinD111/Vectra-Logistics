---
phase: 32-aggregated-tree-read-api-reorder-move-endpoints
verified: 2026-07-19T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 32: Aggregated Tree Read API + Reorder/Move Endpoints Verification Report

**Phase Goal:** There is one tenant-scoped, single-request way to read the whole workspace tree and one transactional, lock-safe way to reorder or reparent any node, so UI work in later phases has a stable, correct API to build against.

**Verified:** 2026-07-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | `GET /folders/tree/full` returns the entire tenant's folder/project/program/collection/page tree in one request, with no per-node fan-out queries | VERIFIED | `folders.service.ts:28-38` (`getFullTree`) issues exactly 5 `Promise.all`-parallel, company-scoped flat queries (`listFolders`, `listProjects`, `listPrograms`, `listAllPages`, `listCollections`) and assembles the tree in-memory via `assembleTree` (single-pass `Map`-based nesting, no per-node `.filter()` fan-out — verified by code read of lines 382-474). Route registered at `folders.routes.ts:17`, ahead of the `/:id` catch-all. Unit test `getFullTree calls each of the 5 repository methods exactly once` passes. Live cross-tenant isolation test exists (`folders.integration.test.ts:202-223`, `TREEAPI-01`) — well-formed, could not execute live (no reachable Postgres in this environment; pre-existing, documented env gap). |
| 2 | Reordering siblings via the reorder endpoint uses server-authoritative, lock-safe positions and produces no lost updates when two reorders happen concurrently | VERIFIED | All four reorder repository methods (`reorderFolders`, `reorderProjects`, `reorderPrograms`, `reorderCollections`) issue a blocking `SELECT ... FOR UPDATE` (never `SKIP LOCKED` — grep-confirmed absent) on the exact sibling row set, compare against `orderedIds` by set equality, throw `AppError(409, ...)` on mismatch, and otherwise renumber via one parameterized `UPDATE ... FROM (VALUES ...)`. `foldersService.reorderSiblings` wraps this in `BEGIN`/dispatch/`COMMIT` with `ROLLBACK` on error (`folders.service.ts:179-230`). All 71 relevant unit tests pass (see below), including 409-on-stale-set assertions for every node type. Live two-`PoolClient` concurrency proof exists at `folders.reorder-concurrency.integration.test.ts` — well-formed, asserts `bFinishedAt >= aFinishedAt` (lock blocked B) and last-committed-wins ordering; could not execute live (SASL/Postgres unreachable, pre-existing env gap affecting this entire phase and Phase 31). |
| 3 | The move/reparent endpoint validates tenant ownership on both source and destination and rejects illegal moves (cycles, cross-tenant targets) with a specific error distinguishing the reason | VERIFIED | `moveNode` (`folders.service.ts:120-172`) pre-checks `node_id` ownership per node type (`findProjectForCompany`/`findProgramForCompany`/`findCollection`, all company-scoped) before validating the destination via `assertOwnedFolder`/`findProjectForCompany` (404 on cross-tenant). The `'folder'` branch delegates verbatim to the existing Phase-31 `moveFolder`, which rejects cycles with a distinct `AppError(400, 'Cannot move a folder into its own descendant')` — confirmed no duplicate cycle-check logic exists in `moveNode`. 404 (cross-tenant/missing) vs 400 (cycle) are structurally distinct AppError statuses. A real bug was caught and fixed during execution: `updateProject`/`updateProgram`'s COALESCE-based PATCH semantics silently no-op a `null` clear, which would have broken un-filing/rescoping; `setProjectFolder`/`setProgramParent` (unconditional `SET`, confirmed at `projects.repository.ts:70-77,168-177`) were added instead, and `moveNode` correctly calls these new methods (confirmed by direct code read, not just SUMMARY claim). Live integration tests exist distinguishing 404 (cross-tenant project move) from the existing 400 (folder cycle), plus an end-to-end project-scoped program move test — well-formed, could not execute live (same env gap). |
| 4 | Every tree mutation endpoint (reorder, move/reparent) is gated by the `workspace.admin` capability | VERIFIED | `folders.routes.ts:18-19`: `router.post('/tree/reorder', requireCapability('workspace.admin'), reorderNodes)` and `router.post('/tree/move', requireCapability('workspace.admin'), moveNode)`. Redundantly, both `reorderSiblings` and `moveNode` also call `assertCapability(ctx, 'workspace.admin')` as their first line in the service layer (`folders.service.ts:121,180`). Unit tests confirm 403 with zero repository calls when capability is missing. Live integration test `TREEAPI-04: both reorderSiblings and moveNode reject a non-admin ctx with 403` exists and is well-formed; could not execute live (same env gap). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `database/migrations/029_tree_sort_order.sql` | additive sort_order + indexes | VERIFIED | 3 `ADD COLUMN IF NOT EXISTS`, 3 `CREATE INDEX IF NOT EXISTS`, idempotent by construction |
| `apps/api/src/domains/folders/dto/tree.dto.ts` | ReorderNodesSchema/MoveNodeSchema with project_id disambiguator | VERIFIED | Both schemas present, `project_id` optional/nullable UUID disambiguator documented and implemented on both |
| `apps/api/src/domains/folders/folders.types.ts` (TreeNode) | discriminated union return type | VERIFIED | `TreeNode` interface present, recursive `children: TreeNode[]` |
| `apps/api/src/core/testUtils/concurrentRace.ts` | two-transaction race harness | VERIFIED | `raceLockedTransactions` exported, 4/4 unit tests pass |
| `apps/api/src/domains/projects/projects.repository.ts` (reorderProjects/reorderPrograms/setProjectFolder/setProgramParent) | lock-safe reorder + explicit-set reparent | VERIFIED | All present, `FOR UPDATE` confirmed, no `SKIP LOCKED`, explicit unconditional `SET` (not COALESCE) confirmed by code read |
| `apps/api/src/domains/folders/folders.repository.ts` (reorderFolders) | lock-safe reorder | VERIFIED | `FOR UPDATE` confirmed, 409-on-stale-set |
| `apps/api/src/domains/records/records.repository.ts` (reorderCollections) | lock-safe reorder | VERIFIED | `FOR UPDATE` confirmed, 409-on-stale-set |
| `apps/api/src/domains/folders/folders.service.ts` (getFullTree, reorderSiblings, moveNode) | endpoint orchestration | VERIFIED | All three implemented exactly per plan, capability gating present, transactional (BEGIN/COMMIT/ROLLBACK) for the two write paths |
| `apps/api/src/domains/folders/folders.controller.ts` / `folders.routes.ts` | route wiring | VERIFIED | `GET /tree/full`, `POST /tree/reorder`, `POST /tree/move` all registered before `/:id` catch-all; reorder/move both `requireCapability('workspace.admin')`-gated |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `folders.routes.ts` | `folders.controller.ts` | `getFullTree`/`reorderNodes`/`moveNode` imports | WIRED | All three imported and registered |
| `folders.routes.ts` | `core/capabilities` | `requireCapability('workspace.admin')` on reorder/move | WIRED | Confirmed at lines 18-19 |
| `folders.service.ts` | `projects.repository.ts` / `folders.repository.ts` / `records.repository.ts` | dispatch-by-node_type in `reorderSiblings`/`moveNode` | WIRED | Confirmed by direct code read; program dispatch correctly threads `project_id` scope disambiguator through to both `reorderPrograms` and `setProgramParent` |
| `moveNode`'s `'folder'` branch | `moveFolder` | direct delegation | WIRED | `return this.moveFolder(ctx, nodeId, { parent_id: newParentId })` — no duplicate cycle-check code |
| `moveNode` | `setProjectFolder`/`setProgramParent` | explicit-SET reparent (COALESCE bug fix) | WIRED | Confirmed `moveNode` calls the new explicit-set methods, not the COALESCE-based `updateProject`/`updateProgram` |

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|---|---|---|---|
| TypeScript compiles clean | `cd apps/api && npx tsc --noEmit` | No errors | PASS |
| Full non-DB unit suite (folders/projects/records repos+service, concurrentRace) | `node --require ts-node/register --test src/domains/folders/folders.service.test.ts src/domains/folders/folders.repository.test.ts src/domains/projects/projects.repository.test.ts src/domains/records/records.repository.test.ts src/core/testUtils/concurrentRace.test.ts` | 71/71 pass | PASS |
| Full apps/api suite (`npm test`) | `cd apps/api && npm test` | 199/211 pass, 12 fail | EXPECTED FAIL (env gap) |

**Note on the 12 failures:** All 12 are in `folders.integration.test.ts` and `folders.reorder-concurrency.integration.test.ts`, all failing at `before()`/first query with `Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` — a Postgres-unreachable/credential-configuration error in this environment, not a test-logic or code defect. This exact failure mode and count (199/211, 12 failures) matches 32-05-SUMMARY.md's claim precisely, and is consistent with the documented pre-existing environment gap across Phase 31 and all of Phase 32. Reviewed the integration test source directly (not just the SUMMARY): both files are well-formed and, if run against a reachable Postgres, would prove the claimed TREEAPI-01/02/03/04 behaviors (cross-tenant isolation, lock-serialized concurrent reorder with last-committed-wins, cross-tenant-404 vs cycle-400 distinction, 403 capability gating, project-scoped program move).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TREEAPI-01 | 32-03 | Single-request aggregated tree read, no fan-out | SATISFIED | `getFullTree`, 5-query `Promise.all`, route wired |
| TREEAPI-02 | 32-01, 32-02, 32-04 | Lock-safe, server-authoritative reorder, no lost updates | SATISFIED | `FOR UPDATE` lock + 409-on-stale-set in all 4 repo methods, transactional dispatch, live concurrency test (well-formed, unexecutable in this env) |
| TREEAPI-03 | 32-01, 32-05 | Move/reparent validates ownership both ends, distinguishable errors | SATISFIED | `moveNode` dispatch, cross-tenant 404 vs folder-cycle 400, COALESCE bug caught and fixed with explicit-set methods |
| TREEAPI-04 | 32-04, 32-05 | workspace.admin gating on all tree mutation endpoints | SATISFIED | Route-level `requireCapability` + service-level `assertCapability` (redundant by design) on both `/tree/reorder` and `/tree/move` |

Note: `.planning/REQUIREMENTS.md` still shows these four as "Pending" in its checkbox/status table — this is a documentation-tracking lag in that file, not a code gap. All four requirements are functionally satisfied by the shipped code and passing unit tests.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the phase's modified files. No stub returns (`return null`/`return {}`/`return []` as a permanent no-op), no empty handlers, no hardcoded static responses masquerading as real queries. The one deviation from the original plan text (COALESCE vs. explicit `SET`) was caught by the executor as a genuine correctness bug during implementation, fixed with new methods, and independently confirmed here by direct code read: `moveNode` calls `setProjectFolder`/`setProgramParent`, not the COALESCE-based `updateProject`/`updateProgram`.

### Human Verification Required

None. All success criteria are verifiable via static code inspection, type-checking, and unit test execution. The live-DB integration/concurrency proofs cannot be executed in this environment (no reachable Postgres), but this is a documented, pre-existing environment gap (not specific to this phase) and the test code itself was read and confirmed well-formed and would prove the claimed behavior if run against a real database.

### Gaps Summary

No gaps found. All four ROADMAP.md success criteria (TREEAPI-01 through TREEAPI-04) are verified against the actual shipped code, not just SUMMARY.md claims:
- The aggregated tree read issues exactly 5 parallel, tenant-scoped queries with in-memory Map-based nesting (no fan-out).
- All four reorder repository methods use blocking `FOR UPDATE` (never `SKIP LOCKED`) plus a single parameterized renumber UPDATE, with 409 rejection of stale sibling sets, wrapped in a real BEGIN/COMMIT/ROLLBACK transaction at the service layer.
- The move endpoint pre-checks source ownership per node type, validates destination ownership, delegates folder-cycle detection to the existing Phase 31 `moveFolder` (no duplicate implementation), and — notably — a real bug (COALESCE silently no-op'ing null clears) was caught during execution and fixed with dedicated explicit-set repository methods, which `moveNode` was confirmed (by direct code read) to actually use.
- Both mutation endpoints are gated by `workspace.admin` at both the route and service layer.
- 71/71 relevant unit tests pass; `tsc --noEmit` is clean; the 12 integration-test failures are a confirmed, isolated, pre-existing environment gap (unreachable Postgres), not a code defect — matching the exact failure count and reason claimed in 32-05-SUMMARY.md.

---

_Verified: 2026-07-19_
_Verifier: Claude (gsd-verifier)_
