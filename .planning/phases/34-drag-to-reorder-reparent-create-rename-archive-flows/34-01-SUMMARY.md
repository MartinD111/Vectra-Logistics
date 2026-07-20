---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
plan: 01
subsystem: ui
tags: [react-query, typescript, tree-sidebar, folders-api, projects-api, drag-and-drop]

# Dependency graph
requires:
  - phase: 32
    provides: "Backend archive/unarchive/reorder/move endpoints for folders and projects (POST /folders/:id/archive, /unarchive, /tree/reorder, /tree/move, /projects/:id/archive, /unarchive)"
provides:
  - "foldersApi.archive/unarchive/reorder/moveNode wrappers"
  - "projectsApi.archive/unarchive wrappers"
  - "useArchiveFolder/useUnarchiveFolder/useReorderTree/useMoveTreeNode hooks"
  - "useArchiveProject/useUnarchiveProject hooks"
  - "Fixed full-tree cache invalidation gap on all folder mutations (create/update/move/delete/archive/unarchive)"
  - "flattenVisibleTree + computeDropZone pure drag-and-drop geometry utilities"
  - "countDescendants pure DFS archive-confirmation-count utility"
affects: [34-02, 34-03, 34-04, 34-05, 34-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation hooks always invalidate the shared qk.fullTree query key (['folders','tree','full']) so the sidebar tree reflects every folder/project mutation without stale reads"
    - "Pure tree-walk utility modules (treeDragUtils.ts, treeArchiveCount.ts) mirror treeFindPath.ts/treeFilters.ts: no imports beyond TreeNode type, no side effects"

key-files:
  created:
    - apps/workspaces/src/components/tree/treeDragUtils.ts
    - apps/workspaces/src/components/tree/treeArchiveCount.ts
  modified:
    - apps/workspaces/src/lib/api/folders.api.ts
    - apps/workspaces/src/lib/api/projects.api.ts
    - apps/workspaces/src/lib/hooks/useFolders.ts
    - apps/workspaces/src/lib/hooks/useProjects.ts

key-decisions:
  - "useProjects.ts's new fullTree invalidation key is a literal ['folders','tree','full'] duplicate of useFolders.ts's qk.fullTree (per plan spec) rather than a shared import, to avoid a new cross-file dependency"
  - "reorder/moveNode response types kept loose (moveNode returns unknown) per interface contract in plan — callers only need success/failure, not response shape"

patterns-established:
  - "Every folder/project mutation hook invalidates qk.fullTree/['folders','tree','full'] on success, closing the stale-sidebar gap noted in RESEARCH.md Pitfall 4"

requirements-completed: [TREEOPS-01, TREEOPS-02, TREEOPS-03, TREEOPS-04, TREEOPS-05, TREEOPS-06]

# Metrics
duration: 20min
completed: 2026-07-20
---

# Phase 34 Plan 01: Frontend API/Hook Foundation for Tree Operations Summary

**Wrapped the four Phase 32 folder tree-mutation endpoints (archive/unarchive/reorder/move) and two project archive endpoints as typed `foldersApi`/`projectsApi` methods, added six matching React Query mutation hooks, closed an existing full-tree cache-invalidation gap across all folder mutations, and created two pure tree-walk utility modules for drag-and-drop and archive-descendant counting.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 6 (4 modified, 2 created)

## Accomplishments
- `foldersApi` now exposes `archive`, `unarchive`, `reorder`, `moveNode` matching the Phase 32 backend contracts exactly (request/response shapes per plan `<interfaces>`)
- `projectsApi` now exposes `archive`/`unarchive`
- Six new mutation hooks (`useArchiveFolder`, `useUnarchiveFolder`, `useReorderTree`, `useMoveTreeNode`, `useArchiveProject`, `useUnarchiveProject`) all invalidate the shared full-tree query key on success
- Fixed a pre-existing bug: `invalidateFolderAffectedQueries` (used by `useCreateFolder`/`useUpdateFolder`/`useMoveFolder`/`useDeleteFolder`) did not invalidate `qk.fullTree`, so the sidebar tree view could show stale data after any folder mutation until the 60s staleTime elapsed. Now fixed for all six hooks that share the helper.
- `treeDragUtils.ts` (flattenVisibleTree + computeDropZone) and `treeArchiveCount.ts` (countDescendants) created as pure, dependency-free modules ready for Wave 2+ consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend folders.api.ts and projects.api.ts** - `d99af75` (feat)
2. **Task 2: Extend useFolders.ts and useProjects.ts** - `4f2be17` (feat), followed by `317b3ea` (fix — reordered an invalidation call for verification-grep compliance, no functional change)
3. **Task 3: Create treeDragUtils.ts and treeArchiveCount.ts** - `1df1f25` (feat)

## Files Created/Modified
- `apps/workspaces/src/lib/api/folders.api.ts` - Added archive/unarchive/reorder/moveNode methods to foldersApi
- `apps/workspaces/src/lib/api/projects.api.ts` - Added archive/unarchive methods to projectsApi
- `apps/workspaces/src/lib/hooks/useFolders.ts` - Added 4 new mutation hooks; fixed invalidateFolderAffectedQueries to also invalidate qk.fullTree
- `apps/workspaces/src/lib/hooks/useProjects.ts` - Added qk.fullTree literal key + 2 new mutation hooks (useArchiveProject/useUnarchiveProject)
- `apps/workspaces/src/components/tree/treeDragUtils.ts` - New: flattenVisibleTree + computeDropZone pure functions
- `apps/workspaces/src/components/tree/treeArchiveCount.ts` - New: countDescendants pure DFS function

## Decisions Made
- Kept `useProjects.ts`'s full-tree invalidation key as a standalone literal (`['folders', 'tree', 'full'] as const`) rather than importing `qk` from `useFolders.ts`, per plan instruction — avoids introducing a new cross-hook-file dependency while keeping the literal value byte-identical to `useFolders.ts`'s `qk.fullTree`.
- `moveNode`'s return type is `unknown` per the plan's interface note that "callers don't need the shape, only success/failure" — matches the backend route's documented untyped response.

## Deviations from Plan

None — plan executed exactly as written. One minor self-correction: after implementing Task 2, the plan's acceptance-criteria grep (`grep -A3 "function invalidateFolderAffectedQueries" ... | grep -c "qk.fullTree"`) expected the `qk.fullTree` invalidation call to fall within the first 3 lines after the function declaration; the initial ordering placed it 4th. Reordered the four `invalidateQueries` calls (functionally identical, same four calls execute in a different order) to satisfy the verification grep — committed as `317b3ea`.

## Issues Encountered
None.

## Next Phase Readiness
- All six frontend wrapper methods and six mutation hooks are ready for Wave 2+ plans (context menu, archive dialog, drag-and-drop) to consume directly.
- `treeDragUtils.ts` and `treeArchiveCount.ts` are pure and dependency-free, ready to be imported by UI components without further foundation work.
- No blockers for downstream plans in this phase.

---
*Phase: 34-drag-to-reorder-reparent-create-rename-archive-flows*
*Completed: 2026-07-20*

## Self-Check: PASSED
All 4 task commit hashes (d99af75, 4f2be17, 317b3ea, 1df1f25) found in git log. All 6 created/modified files exist on disk.
