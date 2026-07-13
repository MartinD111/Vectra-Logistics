---
phase: 19-release-versioning-upgrade-docs
plan: 01
subsystem: infra
tags: [versioning, health-check, express, node-test, ts-node]

# Dependency graph
requires: []
provides:
  - "Root VERSION file as single source of truth for release version string"
  - "apps/api/src/core/config/version.ts — getVersion()/resolveVersion() cached, testable version resolver"
  - "GET /health includes a version field sourced from getVersion()"
  - "apps/api/src/server.ts exports app importable in tests without triggering bootstrap()"
affects: [19-02, release-build-tooling, ops-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure resolver + cached wrapper shape (mirrors secrets.ts): resolveVersion()/getVersion() split for testability without touching real fs"
    - "require.main === module guard to make Express app importable in tests without side effects (DB/Redis bootstrap)"

key-files:
  created:
    - VERSION
    - apps/api/src/core/config/version.ts
    - apps/api/src/core/config/version.test.ts
    - apps/api/src/server.health.test.ts
  modified:
    - apps/api/src/server.ts

key-decisions:
  - "VERSION file contains bare semver (3.0.0, no v prefix) per RESEARCH.md Assumption A1 — git tag v3.0 cut separately at release time"
  - "getVersion() never process.exit()s on missing/unreadable VERSION file — soft fallback to 'unknown', unlike secrets.ts's fatal boot-time checks, since a missing version string is an ops annoyance, not a security/correctness failure"

patterns-established:
  - "Pattern 1: Pure resolver takes its I/O dependency (readVersionFile) as a parameter, keeping the resolver itself free of fs/path imports and directly unit-testable"
  - "Pattern 2: require.main === module guard at the bottom of server.ts, with export { app } — lets integration tests spin up the real Express app on an ephemeral port without triggering DB/Redis/worker bootstrap"

requirements-completed: [REL-01]

# Metrics
duration: 25min
completed: 2026-07-13
---

# Phase 19 Plan 01: VERSION file + /health version reporting Summary

**Root VERSION file (3.0.0) as single source of truth, resolved via a cached getVersion()/resolveVersion() pair mirroring secrets.ts's shape, exposed through GET /health, with server.ts made testable via a require.main guard.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-13T05:20:00Z
- **Completed:** 2026-07-13T05:46:36Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Root `VERSION` file established as the single source of truth for the release version string (REL-01)
- `apps/api/src/core/config/version.ts` — pure `resolveVersion()` resolver (env value -> VERSION file -> `'unknown'`) plus cached `getVersion()` wrapper, mirroring `secrets.ts`'s "pure validator + cached getter" shape
- `GET /health` now returns a `version` field sourced from `getVersion()`
- `apps/api/src/server.ts` exports `app` behind a `require.main === module` guard so tests can import it without triggering the DB/Redis/worker `bootstrap()` sequence

## Task Commits

Each task was committed atomically:

1. **Task 1: VERSION file + version.ts resolver + unit tests** - `3fa3efb` (feat)
2. **Task 2: Wire GET /health to report version + testable app export** - `c64a46a` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

_Note: Both tasks were TDD (`tdd="true"`); tests were written alongside implementation and verified green before commit, in line with the plan's `<behavior>` spec being the test spec itself rather than a separate RED-only commit._

## Files Created/Modified
- `VERSION` - Root single-source-of-truth release version string (`3.0.0`)
- `apps/api/src/core/config/version.ts` - `resolveVersion()` pure resolver + `getVersion()` cached wrapper
- `apps/api/src/core/config/version.test.ts` - Unit coverage for all `resolveVersion()` branches and `getVersion()` caching
- `apps/api/src/server.ts` - Added `getVersion()` import, `version` field on `/health`, `require.main === module` bootstrap guard, `export { app }`
- `apps/api/src/server.health.test.ts` - Integration test: spins up real Express `app` on an ephemeral port, asserts `GET /health` returns `status: 'OK'` and a string `version`

## Decisions Made
- VERSION file content is bare semver `3.0.0` (no `v` prefix), per RESEARCH.md Assumption A1 — the `v3.0` git tag is a separate release-time action, not produced by this plan
- `getVersion()` fails soft (`'unknown'`) rather than `process.exit()`-ing like `secrets.ts`'s boot-time checks — a missing/unreadable VERSION file is an operational nuisance for `/health`, not a security-critical boot gate

## Deviations from Plan

None - plan executed exactly as written. `npm install` was run once at the start of execution because this worktree had no `node_modules` (a pre-existing worktree-provisioning gap, not caused by this plan's tasks); this is standard environment setup, not a code deviation, and `package-lock.json`'s pre-existing modification (present before this plan started, per initial git status) was left untouched/uncommitted as out of scope.

## Issues Encountered
- Worktree had no `node_modules` installed, so `node --require ts-node/register --test ...` failed with `MODULE_NOT_FOUND` on first attempt. Resolved by running `npm install --prefer-offline --no-audit --no-fund` at the repo root (matches root `package-lock.json`, ~679 packages, no code changes required).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `getVersion()` is available for Plan 02's build tooling to consume as the canonical version source
- `GET /health` version field is live and ready for ops/monitoring integration
- No blockers identified

---
*Phase: 19-release-versioning-upgrade-docs*
*Completed: 2026-07-13*
