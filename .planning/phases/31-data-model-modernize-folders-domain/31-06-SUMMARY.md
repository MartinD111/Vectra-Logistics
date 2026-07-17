---
phase: 31-data-model-modernize-folders-domain
plan: 06
subsystem: testing
tags: [postgres, node-test, integration-test, folders, event-outbox, triggers]

# Dependency graph
requires:
  - phase: 31 (plans 01-05)
    provides: folder hierarchy migration (028_folder_hierarchy_invariants.sql), ancestor_ids-aware repository, and cascade-archive service
provides:
  - Live-DB integration test suite proving HIER-02 (cross-tenant FK rejection), HIER-03 (cycle/depth trigger rejection), and HIER-04 (multi-table cascade-archive transaction) against the real dev Postgres
  - Automated static grep gate for HIER-06 (no recordEvent/activityLog in the folders domain)
affects: [32-aggregated-read-mutation-api, phase-gate verification for v6.0]

# Tech tracking
tech-stack:
  added: []
  patterns: [node:test integration test against real db.Pool with before/after fixture teardown scoped to throwaway company_ids]

key-files:
  created: [apps/api/src/domains/folders/folders.integration.test.ts]
  modified: []

key-decisions:
  - "Both tasks (Task 1: reparent/cycle/depth tests, Task 2: cascade-archive test + HIER-06 static gate) landed in a single commit because they extend the same new file created in Task 1 — splitting would require artificial partial-file commits with no functional benefit."
  - "Created a throwaway users row (not just companies/folders) because event_outbox.actor_id has a real FK to users(id) — requireUserId's ctx.user.id must reference an existing row or the cascade-archive test's event assertions would fail on insert, not just on capability check."

patterns-established:
  - "Integration tests reuse the same `db` Pool every repository uses (core/db) rather than a separate test-database abstraction, per the plan's Don't Hand-Roll guidance."
  - "Fixture rows are scoped to dedicated randomUUID() company_ids and torn down in dependency order (event_outbox -> data_collections -> project_pages -> programs -> projects -> folders -> users -> companies) in an `after` hook, verified idempotent by running the suite twice in a row."

requirements-completed: [HIER-02, HIER-03, HIER-04, HIER-06]

# Metrics
duration: 35min
completed: 2026-07-17
---

# Phase 31 Plan 06: Folders Live-DB Integration Tests Summary

**Five `node:test` integration tests against the real dev Postgres proving the folder hierarchy's composite-FK tenant isolation, cycle/depth trigger, full cascade-archive transaction, and an automated recordEvent/activityLog grep gate.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-17T08:14:00Z
- **Completed:** 2026-07-17T08:49:11Z
- **Tasks:** 2 completed
- **Files modified:** 1 (created)

## Accomplishments
- Proved cross-tenant folder reparenting is rejected at the database level via the composite `(parent_id, company_id) REFERENCES folders(id, company_id)` FK (Postgres error code `23503`), not just by application-layer checks.
- Proved the `folders_prevent_cycle_and_depth_trg` trigger rejects both a cycle (moving a folder into its own descendant) and a 4th-level nesting attempt, asserting on the trigger's raised exception messages ("descendant" / "depth").
- Proved `foldersService.archiveFolder` cascades a real folder -> project -> (program, page, data_collection) fixture tree to `archived_at IS NOT NULL` on all 5 entities in one transaction, and that exactly one `event_outbox` row per archived entity is written (never a single batched event).
- Automated the previously-manual HIER-06 grep check ("no `recordEvent`/`activityLog` in the folders domain") as a `node:test` static-scan test, so it now runs as part of the automated suite instead of requiring a human to run it before sign-off.
- Verified the full suite passes twice in a row back-to-back, confirming fixture cleanup leaves zero leftover rows (spot-checked via a direct query for lingering `Integration Test Co%` company rows post-run: 0).

## Task Commits

Both tasks extend the same newly-created file, so they are captured in a single commit:

1. **Task 1 + Task 2: Cross-tenant/cycle/depth rejection tests, cascade-archive test, HIER-06 static gate** - `97c2ce3` (test)

**Plan metadata:** committed by orchestrator after wave completion (per worktree mode — STATE.md/ROADMAP.md not touched by this agent).

## Files Created/Modified
- `apps/api/src/domains/folders/folders.integration.test.ts` - New `node:test` integration test file: `before`/`after` fixture hooks creating 3 throwaway companies + 1 throwaway user; 5 tests covering HIER-02 (FK), HIER-03 (cycle + depth trigger), HIER-04 (cascade-archive transaction with event_outbox verification), and HIER-06 (static grep gate over non-test `.ts` files in the folders domain).

## Decisions Made
- Combined Task 1 and Task 2 into one commit since both extend the same file created in Task 1; no functional benefit to an artificial partial-file split.
- Added a throwaway `users` fixture row beyond what the plan's Interfaces section explicitly called out, because `event_outbox.actor_id` has a real foreign key to `users(id)` — without a real user row, the cascade-archive test's `insertDurableEvent` calls would fail on the FK constraint even though `requireUserId` only checks that `ctx.user.id` is truthy, not that it exists in the database.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Environment: worktree had no `node_modules`, blocking `ts-node/register` test execution**
- **Found during:** Task 1 verification (`node --require ts-node/register --test ...`)
- **Issue:** This git worktree checkout has no installed `node_modules` (neither at repo root nor `apps/api`), so `ts-node/register` could not be resolved, blocking the plan's required `<verify>` command from running at all.
- **Fix:** Created Windows junction points (`New-Item -ItemType Junction`) from the worktree's `node_modules` and `apps/api/node_modules` to the main checkout's already-installed `node_modules` directories. This is a local filesystem link only — `node_modules` is gitignored and no package.json/lockfile was touched, so nothing was committed.
- **Files modified:** None (junctions are outside git's tracked tree; `git status --short` confirms no tracked-file impact)
- **Verification:** `node --require ts-node/register --test src/domains/folders/folders.integration.test.ts` ran successfully, all 5 tests passed, and passed again on a second consecutive run.
- **Committed in:** N/A (no file changes — environment-only fix, not part of any commit)

**2. [Rule 2 - Missing Critical] Added a throwaway `users` fixture row for the FK-backed `actor_id` column**
- **Found during:** Task 2 (writing the cascade-archive test)
- **Issue:** The plan's Interfaces section only mentions creating `companies`/`folders`/`projects` fixture rows, but `foldersService.archiveFolder` calls `insertDurableEvent`, which writes `actor_id` into `event_outbox` — a column with a real FK to `users(id)`. Using a synthetic (non-existent) user id for the admin `ctx.user.id` would pass the capability check (which is ctx-only, no DB lookup) but fail the event insert with a FK violation.
- **Fix:** Inserted one throwaway `users` row in `before()` scoped to `company1Id`, used its id as `adminUserId` for the admin `RequestContext` passed to `archiveFolder`, and added it to the `after()` cleanup.
- **Files modified:** `apps/api/src/domains/folders/folders.integration.test.ts`
- **Verification:** Cascade-archive test's `event_outbox` assertions pass; no FK violation.
- **Committed in:** `97c2ce3` (part of the single task commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 missing-critical fixture data)
**Impact on plan:** Both auto-fixes were necessary for the plan's own `<verify>` commands to run and pass at all. No scope creep — no application code was touched, only the new test file and local (untracked) environment linking.

## Issues Encountered
- None beyond the two auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three Wave 0 gaps from `31-VALIDATION.md` (HIER-02, HIER-03, HIER-04 DB-level proof) are now closed with live-DB tests, and HIER-06 is an automated gate rather than a manual sign-off step.
- Phase 31's data model and folders-domain service/repository layers are now verified against real Postgres constraints/triggers/transactions, in addition to the mocked-repository unit tests from plans 31-04/31-05. Phase 32 (aggregated read + mutation API) can build on this foundation with confidence that the underlying invariants actually hold at the database level.
- No blockers identified for Phase 32.

---
*Phase: 31-data-model-modernize-folders-domain*
*Completed: 2026-07-17*
