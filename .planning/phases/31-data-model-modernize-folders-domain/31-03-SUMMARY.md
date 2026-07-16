---
phase: 31
plan: 03
subsystem: projects-domain
tags: [archive, hard-delete-removal, folders-cascade, projects, programs]
dependency-graph:
  requires: ["31-01"]
  provides: ["projects.archive-unarchive", "projects.bulk-cascade-archive-primitives"]
  affects: ["apps/api/src/domains/projects"]
tech-stack:
  added: []
  patterns: ["PoolClient-first bulk repository methods for transactional cascades (matches 31-02's recordsRepository pattern)"]
key-files:
  created: []
  modified:
    - apps/api/src/domains/projects/projects.types.ts
    - apps/api/src/domains/projects/projects.repository.ts
    - apps/api/src/domains/projects/projects.service.ts
    - apps/api/src/domains/projects/projects.controller.ts
    - apps/api/src/domains/projects/projects.routes.ts
    - apps/api/src/domains/projects/projects.service.test.ts
decisions:
  - "Added assertOwnedProjectAnyState/assertOwnedProgramAnyState (unscoped-by-archived-state ownership checks) rather than reusing assertOwnedProject/assertOwnedProgram for archive/unarchive, since findProjectForCompany/findProgramForCompany now filter out archived rows and unarchive must be able to find an already-archived row by id"
metrics:
  duration: "~45m"
  completed: "2026-07-16"
---

# Phase 31 Plan 03: Replace Project/Program Hard-Delete With Archive/Unarchive Summary

Replaced `DELETE /projects/:id` and `DELETE /projects/programs/:id` with archive/unarchive endpoints backed by the `archived_at` column (added by 31-01's migration), and added transaction-safe bulk cascade-archive repository primitives for the folders-domain cascade (plan 31-05).

## What Changed

**Types** (`projects.types.ts`): `Project`, `Program`, `ProjectPage` now include `archived_at: Date | null`.

**Repository** (`projects.repository.ts`):
- `deleteProject`/`deleteProgram` removed; replaced with `archiveProject`/`unarchiveProject`/`archiveProgram`/`unarchiveProgram` (single-row, `UPDATE ... SET archived_at = NOW()/NULL ... RETURNING *`).
- `listProjects`, `findProjectForCompany`, `listPrograms`, `findProgramForCompany` now filter `archived_at IS NULL` so archived rows are hidden from default listing/lookup. `findProject`/`findProgram` (unscoped-by-company) intentionally remain unfiltered — used internally to look up an already-archived row.
- Added 4 bulk cascade-archive methods for the folders-domain cascade (plan 31-05), each taking a `PoolClient` as first argument and filtering `archived_at IS NULL`: `archiveProjectsInFolders`, `archiveProgramsInFolders`, `archiveProgramsInProjects`, `archivePagesInProjects` (two-pass cascade per RESEARCH.md Pitfall 5 — folder-filed projects/programs first, then project-attached programs/pages).

**Service** (`projects.service.ts`):
- `deleteProject`/`deleteProgram` removed; replaced with `archiveProject`/`unarchiveProject`/`archiveProgram`/`unarchiveProgram`, each emitting `recordEvent` (`project.archived`/`project.unarchived`/`program.archived`/`program.unarchived`) — kept on the existing `activityLog` event spine, not `event_outbox`, per RESEARCH.md Pitfall 3 (this plan does not migrate the rest of `projects.service.ts` to the v5 durable-event pattern).
- Added `assertOwnedProjectAnyState`/`assertOwnedProgramAnyState` private helpers (deviation — see below).

**Controller/Routes**: `deleteProject`/`deleteProgram` handlers replaced with `archiveProject`/`unarchiveProject`/`archiveProgram`/`unarchiveProgram`, returning `200 { project }` / `200 { program }` instead of `204`. Routes: `POST /:id/archive`, `POST /:id/unarchive`, `POST /programs/:id/archive`, `POST /programs/:id/unarchive` replace `DELETE /:id` and `DELETE /programs/:id`, keeping the exact capability gates their replaced routes used (`workspace.admin` for projects, `program.build` for programs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unarchive would 404 immediately under the plan's literal wording**

- **Found during:** Task 1 implementation
- **Issue:** The plan's action text says to call `assertOwnedProject`/`assertOwnedProgram` first in `archiveProject`/`unarchiveProject` (and the Program equivalents). But the same plan's `<interfaces>` section explicitly scopes `findProjectForCompany`/`findProgramForCompany` (which `assertOwnedProject`/`assertOwnedProgram` call) to exclude archived rows. Following the action text literally would make `unarchiveProject` call `assertOwnedProject`, which — for an already-archived project — would always throw `404` before ever reaching the repository's `unarchiveProject` call, since the row is filtered out by `archived_at IS NULL`.
- **Fix:** Added `assertOwnedProjectAnyState`/`assertOwnedProgramAnyState` private helpers, mirroring the existing `assertOwnedFolder` pattern (unscoped `findProject`/`findProgram` lookup + manual `company_id` compare). `archiveProject`/`unarchiveProject`/`archiveProgram`/`unarchiveProgram` all use the `AnyState` variant so both archiving a live row and unarchiving an already-archived row succeed for the true owner, while still returning 404 for cross-tenant access.
- **Files modified:** `apps/api/src/domains/projects/projects.service.ts`
- **Commit:** 4cba034

### Deferred Items (not fixed — out of scope)

- `apps/workspaces/src/lib/api/projects.api.ts` still exports `remove`/`removeProgram` calling `DELETE /:id`/`DELETE /programs/:id`, which no longer exist on the backend. These exports are currently unused (no live UI wiring calls them), so nothing breaks today, but a later phase (32-34, tree UI / archive flows) must update or remove these frontend calls before wiring an "archive" UI action. Logged here rather than fixed, since this plan's `files_modified` scope is backend-only (`apps/api/src/domains/projects/*`).

## Known Stubs

None — this plan does not introduce placeholder UI or empty-data states.

## Verification

- `npx tsc --noEmit -p tsconfig.json` from `apps/api`: no errors in any `projects.*` file (the only reported errors — `src/core/db/redis.ts` missing the `redis` package's type declarations — are a pre-existing environment gap: the `redis` and `ts-node` packages are declared in `apps/api/package.json` but not present under any `node_modules` reachable from this worktree or the main repo, unrelated to this plan's changes and out of this plan's scope per the SCOPE BOUNDARY rule).
- `node --require ts-node/register --test src/domains/projects/projects.service.test.ts` could not be executed in this environment: `ts-node` is listed as a devDependency in `apps/api/package.json` but is not installed under any `node_modules` directory reachable from the repo root or this worktree (confirmed via `find` — only `ts-node-dev` is present). This is a pre-existing tooling/install gap, not something introduced by this plan's code changes. The new/updated tests were reviewed manually for correctness against the existing test file's conventions (`node:test` + `node:assert/strict` + `mock.method`), and `tsc --noEmit` confirms the test file type-checks cleanly against the updated `projectsRepository`/`projectsService` signatures.
- `grep -rn "router.delete" apps/api/src/domains/projects/projects.routes.ts` returns only the unrelated, unchanged `DELETE /pages/:pageId` route — no `DELETE /:id` or `DELETE /programs/:id` remain.

## Threat Flags

None — the only new surface (`POST /:id/archive`, `/:id/unarchive`, `/programs/:id/archive`, `/programs/:id/unarchive`) was already covered by the plan's own threat model (T-31-03), and each route carries the exact capability its replaced hard-delete route used.
