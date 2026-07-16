---
phase: 31-data-model-modernize-folders-domain
plan: 02
subsystem: database
tags: [postgres, zod, records-domain, folders-domain, event-outbox]

# Dependency graph
requires:
  - phase: 31-01
    provides: "data_collections.folder_id/archived_at columns, composite (id, company_id) FK invariants from migration 028"
provides:
  - "DataCollectionRow.folder_id / .archived_at fields"
  - "CreateCollectionSchema/UpdateCollectionSchema folder_id validation"
  - "recordsService company-scoped folder_id ownership check (assertOwnedFolder)"
  - "recordsRepository.archiveCollectionsInFolders / archiveCollectionsInProjects / unarchiveCollection"
affects: [31-05, 31-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository bulk-mutation methods accept an explicit PoolClient as first arg when they must run inside a caller-owned transaction (mirrors workflowsRepository convention)"
    - "Service-layer ownership check for a caller-supplied foreign folder_id via foldersRepository.findFolderForCompany, returning a clean 404 (no existence leak) instead of a separate 403"

key-files:
  created: []
  modified:
    - apps/api/src/domains/records/records.types.ts
    - apps/api/src/domains/records/records.repository.ts
    - apps/api/src/domains/records/records.service.ts
    - apps/api/src/domains/records/dto/create-collection.dto.ts
    - apps/api/src/domains/records/dto/update-collection.dto.ts
    - apps/api/src/domains/records/records.repository.test.ts
    - apps/api/src/domains/records/records.service.test.ts

key-decisions:
  - "assertOwnedFolder in records.service.ts throws AppError(404, 'Folder not found') for both missing and cross-tenant folder_id, differing from projects.service.ts's assertOwnedFolder (which throws 403 for wrong-tenant) — findFolderForCompany already scopes by company_id in one query, so there is no separate existence check to leak from."
  - "Bulk archive methods emit one data_collection.archived durable outbox event per archived row, inside the same client/transaction passed by the caller, matching the existing createCollectionWithDefaultView outbox pattern."

requirements-completed: [HIER-01, HIER-04]

duration: 15min
completed: 2026-07-16
---

# Phase 31 Plan 02: data_collections.folder_id + bulk archive primitives Summary

**`data_collections.folder_id` end-to-end (types/DTOs/repository/service ownership check) plus transaction-safe bulk archive/unarchive repository methods for the folders-domain cascade.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-16T13:46:06Z
- **Tasks:** 2/2 completed
- **Files modified:** 7

## Accomplishments
- `data_collections` rows can now be filed into a folder via `folder_id`, validated against the caller's own company before any write (HIER-01).
- `recordsRepository` exposes `archiveCollectionsInFolders`, `archiveCollectionsInProjects` (both `PoolClient`-taking, for the folders-domain cascade transaction), and a standalone `unarchiveCollection` (HIER-04).
- 10 new/updated unit tests across `records.service.test.ts` and `records.repository.test.ts`, all passing.

## Task Commits

1. **Task 1: data_collections.folder_id — types, repository, DTOs, service ownership check** - `61e2f0b` (feat)
2. **Task 2: Bulk archive/unarchive repository methods for the folders-domain cascade** - `f89130d` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `apps/api/src/domains/records/records.types.ts` - `DataCollectionRow` gains `folder_id: string | null` and `archived_at: Date | null`
- `apps/api/src/domains/records/records.repository.ts` - `createCollectionWithDefaultView`/`updateCollection` persist `folder_id`; adds `archiveCollectionsInFolders`, `archiveCollectionsInProjects`, `unarchiveCollection`
- `apps/api/src/domains/records/records.service.ts` - `assertOwnedFolder` private method; wired into `createCollection`/`updateCollection`
- `apps/api/src/domains/records/dto/create-collection.dto.ts` - `folder_id: z.string().uuid().nullable().optional()`
- `apps/api/src/domains/records/dto/update-collection.dto.ts` - same `folder_id` field
- `apps/api/src/domains/records/records.repository.test.ts` - 4 new tests for the bulk archive/unarchive methods (pre-existing file from the 31-01 wave, extended here)
- `apps/api/src/domains/records/records.service.test.ts` - 3 new tests for `folder_id` DTO validation + cross-tenant 404 rejection; existing `createCollectionWithDefaultView` call-arguments assertion updated to include `folderId: undefined`

## Decisions Made
- Threw a plain 404 (not 403) for a folder_id that exists but belongs to a different company, per the plan's interface note — `findFolderForCompany` already returns `null` for both cases, so returning 404 avoids leaking cross-tenant folder existence.
- Emitted `data_collection.archived` outbox events per-row inside the bulk archive methods (not deferred to the caller), reusing the exact `createDurableEventEnvelope`/`insertDurableEvent` pattern already used by `createCollectionWithDefaultView`, keeping event emission co-located with the mutation that produces it.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment (updating `records.service.test.ts`'s pre-existing `createCollectionWithDefaultView` call-arguments assertion to include `folderId: undefined`) was a direct, expected consequence of adding the `folderId` field to that repository call signature and falls within Task 1's own stated verification scope (the task's `<verify>` command targets that same test file).

## Issues Encountered
- The worktree has no local `node_modules` (git worktrees don't carry gitignored directories). Ran tests with `NODE_PATH` pointed at the main repo's `apps/api/node_modules` and root `node_modules` to resolve `ts-node`/`typescript`/`pg` without installing anything new in the worktree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 31-05 (folders-domain cascade) can call `recordsRepository.archiveCollectionsInFolders`/`archiveCollectionsInProjects` inside its own transaction to archive collections when a folder or project is archived.
- Plan 31-06 (integration tests) can exercise the real-DB path for the bulk archive cascade against migration 028's schema.
- No blockers identified.

---
*Phase: 31-data-model-modernize-folders-domain*
*Completed: 2026-07-16*
