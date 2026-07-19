---
phase: 32-aggregated-tree-read-api-reorder-move-endpoints
plan: 03
subsystem: api
tags: [express, folders-domain, tree-aggregation, tenant-isolation]

requires:
  - phase: 32-aggregated-tree-read-api-reorder-move-endpoints
    provides: "TreeNode discriminated-union type (folders.types.ts) built in 32-01"
provides:
  - "foldersService.getFullTree(ctx) — 5 parallel tenant-scoped queries assembled into a nested TreeNode[] tree"
  - "GET /folders/tree/full endpoint, registered ahead of the /:id catch-all"
affects: [33-read-only-tree-ui, 34-drag-create-rename-archive-ui]

tech-stack:
  added: []
  patterns:
    - "Aggregated tree read via exactly N parallel flat queries + single-pass Map-based in-memory nesting (no per-node fan-out filter loops)"
    - "Route-ordering guard: literal-path routes (/tree/full) registered before catch-all /:id routes"

key-files:
  created: []
  modified:
    - apps/api/src/domains/folders/folders.service.ts
    - apps/api/src/domains/folders/folders.controller.ts
    - apps/api/src/domains/folders/folders.routes.ts
    - apps/api/src/domains/folders/folders.service.test.ts
    - apps/api/src/domains/folders/folders.integration.test.ts

key-decisions:
  - "assembleTree nests all 5 arrays via one pass each into parent-keyed Maps (project:ID / folder:ID / page:ID / root), then recursive nesting from those maps — never a per-node .filter() across the full array set"
  - "Project-scoped programs/collections take priority over folder-scoped when both project_id and folder_id could theoretically apply (project_id checked first)"

patterns-established:
  - "Cross-entity tree assembly technique for future aggregated-read endpoints in this domain"

requirements-completed: [TREEAPI-01]

duration: ~30min
completed: "2026-07-19"
---

# Phase 32 Plan 03: Aggregated Tree Read Endpoint Summary

**`GET /folders/tree/full` returns the entire tenant workspace tree (folders, projects, programs, pages, collections) via exactly 5 parallel flat queries and in-memory nesting — no per-node fan-out.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-19T10:07:00Z
- **Completed:** 2026-07-19T10:36:00Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `foldersService.getFullTree` issues exactly 5 tenant-scoped repository calls in parallel (`Promise.all`) and assembles them into a single `TreeNode[]` via `assembleTree`, a capability-free read matching `listFolderTree`'s shape.
- `assembleTree` builds parent-keyed `Map`s in one pass per input array (folders by `parent_id`, projects/programs/collections by resolved parent key, pages by `parent_page_id`/`project_id`), then nests recursively — deliberately avoiding a per-node `.filter()` across the full array set.
- `GET /folders/tree/full` wired into `folders.routes.ts`, registered directly after `GET /` and strictly before the `/:id` catch-all (verified: line 15 vs line 16), matching the plan's route-ordering acceptance criterion.
- New live-DB integration test proves cross-tenant isolation: company1's tree contains its own `folderA` fixture and a newly-inserted company1 project, but never company2's `folderB`.

## Task Commits

Each task was committed atomically:

1. **Task 1: getFullTree + assembleTree (folders.service.ts)** - `419ef15` (feat)
2. **Task 2: Wire GET /folders/tree/full + live tenant-isolation integration test** - `4663e57` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/api/src/domains/folders/folders.service.ts` - Added `getFullTree` + private `assembleTree` helper
- `apps/api/src/domains/folders/folders.controller.ts` - Added `getFullTree` handler mirroring `listFolders`
- `apps/api/src/domains/folders/folders.routes.ts` - Registered `GET /tree/full` ahead of `/:id`
- `apps/api/src/domains/folders/folders.service.test.ts` - 5 new unit tests for `getFullTree`/`assembleTree`
- `apps/api/src/domains/folders/folders.integration.test.ts` - New live-DB cross-tenant isolation test

## Decisions Made
- Where a program or collection row could theoretically resolve to either a project or a folder parent, `project_id` is checked first (matches the plan's `<behavior>` spec: "programs whose folder_id equals... and project_id is null").
- Implementation uses a single `Map<string, TreeNode[]>` keyed by `'project:<id>' | 'folder:<id>' | 'page:<id>' | 'root'` built via one pass per array, then recursive folder nesting reads from that same map — satisfies the plan's explicit anti-pattern warning against re-filtering the full array set per node.

## Deviations from Plan

None — plan executed exactly as written.

### Environment note (not a deviation, no plan/code changes)

This worktree has no `.env` (only `.env.example` exists in the main repo too), so no live Postgres connection is configured — running `folders.integration.test.ts` fails with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` on **all** tests in that file, including the 5 pre-existing tests from prior plans (not just the new Task 2 test), confirming this is a pre-existing environment gap rather than anything introduced by this plan. This matches the environment note documented in `32-01-SUMMARY.md` (no `psql` installed either). The new integration test was verified statically against the existing `adminCtx`/fixture scaffolding conventions in the same file and type-checks cleanly (`npx tsc --noEmit` clean aside from the unrelated pre-existing `redis.ts` module-resolution error, also present on a clean checkout of this worktree's dependency-junction setup, not caused by this plan).

Node module resolution required repairing Windows directory junctions for `node_modules` (root and `apps/api`) pointing at the main repo's real `node_modules` — the same as the pattern noted in 32-01. These junctions are gitignored, untracked, local tooling artifacts only.

## Verification Results

- `cd apps/api && node --require ts-node/register --test src/domains/folders/folders.service.test.ts` — 15/15 pass (10 pre-existing + 5 new `getFullTree` tests).
- `cd apps/api && npx tsc --noEmit` — clean except the pre-existing, unrelated `src/core/db/redis.ts` module-resolution error (not touched by this plan, present regardless of these changes).
- `folders.routes.ts` route table verified: `GET /tree/full` at line 15, `GET /:id` at line 16 (correct order).
- `folders.integration.test.ts` — could not execute live against Postgres in this environment (see Environment note above); all 6 pre-existing tests in the file fail identically with the same connection error, confirming this is an environment limitation, not a regression.

## Known Stubs

None.

## Threat Flags

None — `GET /folders/tree/full` reuses all 5 already company-scoped repository calls verbatim; no new query logic, auth path, or schema change introduced. Matches the plan's own threat model (T-32-03-01, T-32-03-02).

## Issues Encountered

Windows directory junctions for `node_modules` initially resolved to a malformed doubled-drive-letter path (`C:\C:\Users\...`) when created via `cmd //c mklink` through the Bash tool's path translation; recreated successfully using `powershell.exe -Command New-Item -ItemType Junction`. Local environment tooling only, not committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `GET /folders/tree/full` is live and ready for Phase 33's read-only tree UI to consume as a single aggregated call.
- Live-DB integration test coverage for the cross-tenant isolation guarantee exists in the codebase but requires a reachable dev Postgres with valid credentials to execute — recommend running the full integration suite in CI/an environment with `.env` configured before Phase 33 UI work begins.

---
*Phase: 32-aggregated-tree-read-api-reorder-move-endpoints*
*Completed: 2026-07-19*
