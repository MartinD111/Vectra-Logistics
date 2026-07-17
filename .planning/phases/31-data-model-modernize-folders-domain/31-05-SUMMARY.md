---
phase: 31-data-model-modernize-folders-domain
plan: 05
subsystem: api
tags: [request-context, capabilities, event-outbox, postgres, folders]

requires:
  - phase: 31-data-model-modernize-folders-domain
    provides: ancestor_ids/archived_at schema (31-01), folders repository ancestor-index methods (31-04), bulk archive repository methods on projects/records (31-02, 31-03)
provides:
  - folders.service.ts fully rewritten onto RequestContext + assertCapability + event_outbox
  - Two-pass transactional cascade archive across folders -> projects/programs/collections -> their own programs/pages/collections
  - archiveFolder/unarchiveFolder replacing deleteFolder end-to-end (service, controller, routes)
affects: [31-06-integration-tests, folders-domain, projects-domain, records-domain]

tech-stack:
  added: []
  patterns:
    - "v5 domain pattern: ctx: RequestContext first arg, assertCapability before repo calls, requireCompanyId/requireUserId inside service not controller"
    - "One insertDurableEvent call per archived row inside a single db.connect()/BEGIN/COMMIT transaction, never one batched event"

key-files:
  created: []
  modified:
    - apps/api/src/domains/folders/folders.service.ts
    - apps/api/src/domains/folders/folders.controller.ts
    - apps/api/src/domains/folders/folders.routes.ts

key-decisions:
  - "Cycle/depth checks read directly from ancestor_ids (O(1)) instead of the old recursive assertNotDescendant loop, per HIER-07/HIER-03"
  - "unarchiveFolder is non-cascading by design (D-03 minimal scope) — only the target folder is restored"

patterns-established:
  - "Cascade archive: pass 1 archives directly-filed rows (folders, projects, programs, collections), pass 2 archives rows attached via pass-1's archived project ids (programs, pages, collections) — skips pass 2 entirely when pass 1 archived zero projects"

requirements-completed: [HIER-02, HIER-03, HIER-04, HIER-05, HIER-06, HIER-07]

duration: 45min
completed: 2026-07-16
---

# Phase 31: Data Model — Modernize Folders Domain Summary (Plan 31-05)

**Folders domain fully rewritten onto RequestContext + assertCapability + event_outbox, with O(1) ancestor-index cycle/depth checks and a two-pass transactional cascade archive replacing hard-delete**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-16
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments
- `createFolder`/`updateFolder`/`moveFolder` now take `ctx: RequestContext`, call `assertCapability(ctx, 'workspace.admin')` before any repository access, and resolve tenant/user via `requireCompanyId`/`requireUserId`; `listFolderTree`/`getFolder` remain capability-free reads
- Cycle detection replaced: the recursive `assertNotDescendant` walk is gone, replaced by a direct `parent.ancestor_ids.includes(id)` check plus a depth guard rejecting moves that would exceed depth 3
- `archiveFolder` cascades `archived_at` to every descendant folder plus every project/program/collection filed directly (pass 1) and every program/page/collection filed under those projects (pass 2), all inside one `db.connect()`/`BEGIN`/`COMMIT` transaction, emitting one `insertDurableEvent` per archived row (never a batched event)
- `unarchiveFolder` added as a non-cascading restore, emitting a single `folder.unarchived` event
- `deleteFolder` removed entirely from service, controller, and routes; `DELETE /:id` replaced by `POST /:id/archive` and `POST /:id/unarchive`, both gated by `requireCapability('workspace.admin')`
- Controller fully standardized on `requireRequestContext(req)` — no handler calls `requireCompanyId(req)` directly anymore
- Zero `recordEvent`/`activityLog` references remain anywhere in the folders domain (HIER-06 static check passes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Core CRUD onto RequestContext + capability + ancestor-index** - `326c514` (feat)
2. **Task 2: Cascade archive/unarchive transaction (two-pass, one event per row)** - `e5b423a` (feat)
3. **Task 3: Controller + routes — RequestContext handlers, archive/unarchive endpoints** - `2c37feb` (feat)

**Plan metadata:** written post-hoc by orchestrator (see Issues Encountered) after commit `2c37feb`

_Note: no separate red/green TDD commits — tests and implementation landed together per task._

## Files Created/Modified
- `apps/api/src/domains/folders/folders.service.ts` - createFolder/updateFolder/moveFolder/archiveFolder/unarchiveFolder on RequestContext + assertCapability + event_outbox; two-pass cascade archive transaction
- `apps/api/src/domains/folders/folders.controller.ts` - every handler uses `requireRequestContext(req)`; `archiveFolder`/`unarchiveFolder` replace `deleteFolder`
- `apps/api/src/domains/folders/folders.routes.ts` - `POST /:id/archive`, `POST /:id/unarchive` replace `DELETE /:id`, both gated by `workspace.admin`

## Decisions Made
- Ancestor/breadcrumb and cycle/depth checks read `ancestor_ids` directly rather than re-deriving from a recursive query, per HIER-07 and the plan's explicit instruction to delete `assertNotDescendant`
- Pass 2 of the cascade is skipped entirely (no query issued) when pass 1 archived zero projects, avoiding an unnecessary empty-array query

## Deviations from Plan

None - plan executed exactly as written (verified against all three tasks' acceptance criteria post-hoc; see Issues Encountered for why this verification was done by the orchestrator rather than the original agent).

## Issues Encountered
The executor agent hit its Claude Code session limit after completing and committing all three tasks and confirming all 155 apps/api tests passed, but before it could write this SUMMARY.md. The orchestrator verified the plan's acceptance criteria directly against the worktree (`recordEvent`/`activityLog` absent, `requireCompanyId` count 0 in controller, `archive`/`unarchive` routes present, `deleteFolder` absent, `tsc --noEmit` clean) and wrote this SUMMARY.md to close out the plan without re-executing any work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Folders domain is now fully on the v5 pattern with cascade archive wired end-to-end across folders/projects/programs/collections/pages. Plan 31-06 (integration tests) can now exercise the live-DB paths this plan and 31-01 could not verify without Docker/Postgres: cross-tenant reparent rejection, DB-level cycle rejection, and the full multi-table cascade-archive transaction.

---
*Phase: 31-data-model-modernize-folders-domain*
*Completed: 2026-07-16*
