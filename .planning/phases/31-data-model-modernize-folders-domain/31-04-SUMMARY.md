---
phase: 31-data-model-modernize-folders-domain
plan: 04
subsystem: database
tags: [postgresql, ancestor-ids, folders, archive-only-delete, gin-index]

# Dependency graph
requires:
  - phase: 31-data-model-modernize-folders-domain (plan 31-01)
    provides: "folders.ancestor_ids GIN-indexed column, cycle/depth trigger, archived_at columns"
provides:
  - "ancestor_ids-aware folders repository (createFolder, moveFolder, descendantFolderIds, findFoldersByIds, patchDescendantAncestors, archiveFolderSubtree, unarchiveFolder)"
  - "ArchiveFolderSchema/UnarchiveFolderSchema empty-body DTOs"
  - "Folder type with ancestor_ids/archived_at fields"
affects: ["31-05 (folders-domain service rewrite orchestrates these exact repository methods)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ancestor_ids array column + GIN containment (@>) query replaces recursive CTE tree walks for descendant lookup"
    - "Single-query prefix rewrite (array_position + array slice + concat) patches every descendant's ancestor_ids on move, bounded by max depth 3 — no per-row loop"
    - "Archive-only removal: hard DELETE replaced by archived_at timestamp + archived_at IS NULL default filtering"

key-files:
  created:
    - apps/api/src/domains/folders/folders.repository.test.ts
  modified:
    - apps/api/src/domains/folders/folders.types.ts
    - apps/api/src/domains/folders/dto/folder.dto.ts
    - apps/api/src/domains/folders/folders.repository.ts
    - apps/api/src/domains/folders/folders.service.ts

key-decisions:
  - "Repository holds no business logic: ancestorIds is always computed by the caller (service layer) from the parent's own ancestor_ids, per this codebase's controller/service/repository layering convention."
  - "deleteFolder (hard DELETE) removed entirely; archiveFolderSubtree + unarchiveFolder are now the only removal path, matching D-01's archive-only recommendation."
  - "listFolders/findFolderForCompany now filter archived_at IS NULL by default (archived = hidden from default tree view); findFolder stays unscoped since it's the internal lookup used to fetch an already-archived row for unarchive."

patterns-established:
  - "GIN-indexed ancestor_ids @> containment query for O(1) descendant lookup, used by both descendantFolderIds and patchDescendantAncestors"
  - "PoolClient-based methods (patchDescendantAncestors, archiveFolderSubtree) for transaction-composability by the plan 31-05 service layer"

requirements-completed: [HIER-02, HIER-03, HIER-07]

# Metrics
duration: 25min
completed: 2026-07-16
---

# Phase 31 Plan 04: Folders Repository Ancestor-Index Rewrite Summary

**Rewrote folders.repository.ts to use the ancestor_ids GIN-indexed column for O(1) descendant lookup, single-query ancestor-prefix patching on move, and archive-only removal, replacing hard DELETE and the old parent_id-only chain walk.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-16T00:00:00Z (approx, worktree session)
- **Completed:** 2026-07-16
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `Folder` type gained `ancestor_ids: string[]` and `archived_at: Date | null`
- `createFolder` now persists a caller-computed `ancestor_ids` array
- `descendantFolderIds` and `patchDescendantAncestors` both do their work in a single GIN-index-backed `ancestor_ids @>` query — no recursive CTE, no per-row loop
- `moveFolder` recomputes `ancestor_ids` alongside `parent_id` in one `UPDATE`
- `archiveFolderSubtree`/`unarchiveFolder` replace the old hard `deleteFolder`; `listFolders`/`findFolderForCompany` now exclude archived rows by default
- `ArchiveFolderSchema`/`UnarchiveFolderSchema` empty-body DTOs added for the upcoming archive/unarchive endpoints (plan 31-05)
- `folders.repository.ts` compiles cleanly and `folders.service.ts` was patched with a minimal compatibility shim so the whole `apps/api` package still type-checks (full service rewrite deferred to 31-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, DTOs, and ancestor-index-aware create/read** - `4fa565e` (feat)
2. **Task 2: Move (ancestor_ids recompute + descendant patch) and archive/unarchive** - `ce0d47b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/api/src/domains/folders/folders.types.ts` - `Folder` gains `ancestor_ids`, `archived_at`
- `apps/api/src/domains/folders/dto/folder.dto.ts` - `ArchiveFolderSchema`/`UnarchiveFolderSchema` empty-body DTOs
- `apps/api/src/domains/folders/folders.repository.ts` - ancestor-index-aware CRUD; `deleteFolder` removed; `descendantFolderIds`, `findFoldersByIds`, `patchDescendantAncestors`, `archiveFolderSubtree`, `unarchiveFolder` added; `moveFolder` extended
- `apps/api/src/domains/folders/folders.repository.test.ts` - new file, 7 test cases (node:test + mock.method on `db.query`/PoolClient, matching `records.repository.test.ts`'s style)
- `apps/api/src/domains/folders/folders.service.ts` - minimal compatibility shim (see Deviations)

## Decisions Made
- Repository stays business-logic-free: every method that needs `ancestor_ids` takes it as a parameter computed by the caller, matching this codebase's repository = "database queries only" convention (per CLAUDE.md Domain Organization).
- `patchDescendantAncestors`/`archiveFolderSubtree` accept a `PoolClient` (not the pool) so plan 31-05's service layer can compose them inside a single transaction alongside other cascade-archive writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Patched folders.service.ts call sites to match new repository signatures**
- **Found during:** Task 2 (after removing `deleteFolder` and adding required `ancestorIds` params to `createFolder`/`moveFolder`)
- **Issue:** `folders.service.ts` (out of this plan's `files_modified` — its full rewrite is plan 31-05's scope) calls `foldersRepository.createFolder(...)` with 3 args, `moveFolder(...)` with 2 args, and `foldersRepository.deleteFolder(...)`, none of which exist post-change. `npx tsc --noEmit` (required by this plan's own `<verification>`) failed with 3 `TS2554`/`TS2339` errors.
- **Fix:** Applied the smallest correctness-preserving shim, not a rewrite: `createFolder`/`moveFolder` now compute `ancestorIds` from the already-fetched parent (`[...parent.ancestor_ids, parent.id]`, or `[]` for a root folder) before calling the repository — the exact pattern the plan itself documents for callers. `deleteFolder` now archives the folder subtree (`descendantFolderIds` + `archiveFolderSubtree` inside a `db.connect()`/`client.release()` pair) instead of hard-deleting. Cascade archiving of projects/programs/data_collections within the subtree, and all RequestContext/capability/event_outbox orchestration, is explicitly left to plan 31-05 (documented inline with a `NOTE:` comment on `deleteFolder`).
- **Files modified:** `apps/api/src/domains/folders/folders.service.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` now reports zero errors in the folders domain; `folders.service.test.ts`'s existing test still passes unmodified.
- **Committed in:** `ce0d47b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the package compiling per this plan's own verification step, without doing plan 31-05's orchestration work. No scope creep — the shim is the minimal glue code the plan's own interface notes already specify as the caller's responsibility.

## Issues Encountered
- Test/type-check execution required `NODE_PATH` pointed at the monorepo root's `node_modules` (the git worktree checkout has no local `node_modules`); this is an environment artifact of worktree-based parallel execution, not a code issue, and required no source changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 31-05 (folders-domain service rewrite) can now be written directly against `descendantFolderIds`, `moveFolder(id, parentId, ancestorIds)`, `archiveFolderSubtree(client, ids, companyId)`, and `unarchiveFolder(id, companyId)` exactly as specified in this plan's interfaces.
- The `folders.service.ts` shim added here is intentionally minimal (no RequestContext, no event_outbox, no cascade to projects/programs/data_collections) — plan 31-05 will replace it wholesale, not extend it.
- `folders.repository.test.ts` (7 passing cases) gives 31-05 a regression baseline for the repository layer it will build the service on top of.

---
*Phase: 31-data-model-modernize-folders-domain*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created/modified files and all 3 task/plan commit hashes verified present in the worktree and git log.
