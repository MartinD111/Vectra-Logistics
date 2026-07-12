---
phase: 16-production-compose-deployment-mode
plan: 01
subsystem: auth
tags: [deployment-mode, env-config, boot-validation, express, node-test]

# Dependency graph
requires:
  - phase: 14-security-hardening
    provides: "secrets.ts JWT_SECRET/ENCRYPTION_KEY validate-and-cache pattern, fail()/validateSecretsOrExit() boot-gate shape"
provides:
  - "getDeploymentMode()/validateDeploymentModeValue()/validateDeploymentModeOrExit() exported from secrets.ts"
  - "DEPLOYMENT_MODE read once per process lifetime, cached, boot-gated in bootstrap()"
  - "POST /api/auth/signup unconditional 403 when DEPLOYMENT_MODE='on-prem'"
  - "First *Controller.test.ts pattern in this repo (plain-closure Request/Response mocks, no mocking library)"
affects: [18-backend-local-ai, 20-deploy-hardening-connectivity-doc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DEPLOYMENT_MODE validate-once-cache-forever pattern mirrors JWT_SECRET/ENCRYPTION_KEY in secrets.ts"
    - "Controller-level early-return gate checked before any DB I/O (mirrors existing 400/409 checks in signup())"
    - "Controller unit tests use plain closures for Request/Response mocks (no jest/sinon installed)"

key-files:
  created:
    - apps/api/src/controllers/authController.test.ts
  modified:
    - apps/api/src/core/config/secrets.ts
    - apps/api/src/core/config/secrets.test.ts
    - apps/api/src/server.ts
    - apps/api/src/controllers/authController.ts

key-decisions:
  - "getDeploymentMode() cache proven via a real mutate-after-first-read test, not just re-reading process.env twice"
  - "signup() gate is a single unconditional early-return before db.connect() -- no 'first company' state check, per D-04"
  - "authController.test.ts established as this repo's first *Controller.test.ts pattern, testing only the gate's early-return in isolation (no DB mocking layer exists)"

patterns-established:
  - "Pattern: env-var config gates (DEPLOYMENT_MODE) follow the same validate/cache/fail() shape as secrets (JWT_SECRET/ENCRYPTION_KEY) in secrets.ts"

requirements-completed: [DEP-02]

# Metrics
duration: 25min
completed: 2026-07-12
---

# Phase 16 Plan 01: DEPLOYMENT_MODE Boot Validation + Signup Gate Summary

**DEPLOYMENT_MODE=cloud|on-prem read once at boot via a cached secrets.ts validator, wired into server.ts's fail-fast bootstrap, and gating POST /api/auth/signup to a hard 403 on-prem.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-12T15:40:00Z
- **Completed:** 2026-07-12T16:05:00Z
- **Tasks:** 3
- **Files modified:** 4 modified, 1 created

## Accomplishments
- `secrets.ts` gained `DeploymentMode` type, `validateDeploymentModeValue()`, `getDeploymentMode()` (validate-once, cache-forever), and `validateDeploymentModeOrExit()` — exact mirror of the existing JWT_SECRET/ENCRYPTION_KEY shape
- `server.ts`'s `bootstrap()` now fails fast on an unset/invalid `DEPLOYMENT_MODE` before any Postgres/Redis connection, alongside the existing secret validation
- `signup()` now returns 403 unconditionally when `DEPLOYMENT_MODE='on-prem'`, before `db.connect()` — closing the public self-service registration hole on on-prem installs (T-16-01)
- New `authController.test.ts` establishes this repo's first `*Controller.test.ts` file, using plain-closure Request/Response mocks (no mocking library installed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DEPLOYMENT_MODE validator, cache, and boot-gate to secrets.ts** - `17137c1` (feat)
2. **Task 2: Wire validateDeploymentModeOrExit() into server.ts bootstrap** - `843902f` (feat)
3. **Task 3: Gate signup() with DEPLOYMENT_MODE='on-prem' -> 403** - `77c36cb` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `apps/api/src/core/config/secrets.ts` - Added `DeploymentMode` type, `validateDeploymentModeValue()`, cached `getDeploymentMode()`, `validateDeploymentModeOrExit()`
- `apps/api/src/core/config/secrets.test.ts` - Added 6 new test cases (unset/empty/invalid/valid-cloud/valid-on-prem/cache-persists)
- `apps/api/src/server.ts` - `bootstrap()` calls `validateDeploymentModeOrExit()` immediately after `validateSecretsOrExit()`, before `db.query("SELECT 1")`
- `apps/api/src/controllers/authController.ts` - `signup()` gains an unconditional 403 early-return when `getDeploymentMode() === 'on-prem'`
- `apps/api/src/controllers/authController.test.ts` (new) - Unit test for the signup() gate using plain-closure Request/Response mocks

## Decisions Made
- Followed the plan's exact interface spec (`getDeploymentMode()`/`validateDeploymentModeOrExit()` naming and shape) — no naming deviations
- Test isolation for `getDeploymentMode()`'s cache across the two touched test files (`secrets.test.ts` and `authController.test.ts`) was verified empirically: `node --test` gives each test file its own process, so `authController.test.ts` setting `DEPLOYMENT_MODE='on-prem'` at import time never collided with `secrets.test.ts`'s cache-mutation test. Full suite (34 tests across all `*.test.ts` files in `apps/api/src`) passes green in one `npm test` run.
- Per the plan's own scoping language ("test only the gate's early-return behavior in isolation"), `authController.test.ts` covers the on-prem 403 case only, not the cloud/400 unchanged-behavior case from the `<behavior>` block — testing both in the same file would require resetting `getDeploymentMode()`'s process-level cache mid-file, which the module deliberately does not expose (by design, per T-16-03). The cloud-path acceptance criterion ("behavior byte-for-byte unchanged when DEPLOYMENT_MODE='cloud'") is satisfied by inspection: the gate is a single early-return `if` block placed before the existing `db.connect()` call, and no other line of `signup()`'s cloud path was touched (confirmed via `git diff`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no `node_modules` — created NTFS junctions to the main repo's installed packages**
- **Found during:** Task 1 verification (`npm test`)
- **Issue:** This git worktree checkout has no `node_modules` at the repo root or in `apps/api` (gitignored, never installed for this worktree), so `npm test`/`npm run build` failed immediately with `Cannot find module 'ts-node/register'`.
- **Fix:** Created NTFS junction points (`node_modules` at repo root and `apps/api/node_modules`) pointing at the main repo's already-installed `node_modules` directories, via `New-Item -ItemType Junction` (PowerShell, since `cmd /c mklink` mis-resolved the path through Git Bash's path-translation layer). No package installation, `package.json`, or `package-lock.json` changes were made — this only exposes the existing installed packages to the worktree's build tooling.
- **Files modified:** None (junctions are directory reparse points, not tracked by git; `git status --ignored` confirms `node_modules/` and `apps/api/node_modules/` are ignored, not untracked)
- **Verification:** `npm test` and `npm run build` both run successfully from the worktree after the junctions were created
- **Committed in:** N/A (no file changes to commit; junctions are outside git's tracked/untracked file model)

---

**Total deviations:** 1 auto-fixed (1 blocking — build tooling environment fix, no code change)
**Impact on plan:** Zero impact on shipped code. This was purely a local build-environment fix required to run the plan's own verification commands (`npm test`, `npm run build`) inside the isolated worktree.

## Issues Encountered
None beyond the node_modules junction fix documented above.

## User Setup Required

None - no external service configuration required. Operators deploying on-prem or cloud installs will need to set `DEPLOYMENT_MODE=cloud` or `DEPLOYMENT_MODE=on-prem` in their environment before the server will boot — this is expected/intentional fail-fast behavior per DEP-02, not a gap. This env var is documented as part of the broader Phase 16/DEP-01 production compose work (16-02).

## Next Phase Readiness
- `getDeploymentMode()` is now available for any future on-prem-conditional logic (e.g. Phase 18's backend-side local AI dispatch, Phase 20's connectivity doc) to import from `apps/api/src/core/config/secrets.ts` without re-implementing the read/cache/validate pattern
- No blockers for 16-02 (docker-compose.prod.yml, DEP-01) — zero file overlap confirmed by the plan's own wave design
- `signup()`'s on-prem 403 gate is functionally complete for DEP-02/D-04; INS-01 (installer flow) will be the consumer that actually sets `DEPLOYMENT_MODE=on-prem` in a real on-prem install

---
*Phase: 16-production-compose-deployment-mode*
*Completed: 2026-07-12*

## Self-Check: PASSED

All commit hashes (17137c1, 843902f, 77c36cb, 16e1c4c) and all created/modified files verified present on disk and in git log.
