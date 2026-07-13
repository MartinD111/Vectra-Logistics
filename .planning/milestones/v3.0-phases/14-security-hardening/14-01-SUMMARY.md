---
phase: 14-security-hardening
plan: 01
subsystem: auth
tags: [jwt, encryption, boot-validation, security, secrets]

# Dependency graph
requires: []
provides:
  - "apps/api/src/core/config/secrets.ts single validated-read module for JWT_SECRET/ENCRYPTION_KEY"
  - "Boot-time hard fail (validateSecretsOrExit()) wired into server.ts bootstrap() before any DB/Redis I/O"
  - "All 4 legacy JWT_SECRET fallback call sites converted to lazy getJwtSecret() calls"
affects: [15-migration-runner, 16-deployment-mode, installer-first-run]

# Tech tracking
tech-stack:
  added: []
  patterns: ["boot-time fail-fast validation module (console.error + process.exit(1), no AppError)", "lazy secret getter called inside function bodies, never module-scope constants"]

key-files:
  created:
    - apps/api/src/core/config/secrets.ts
    - apps/api/src/core/config/secrets.test.ts
  modified:
    - apps/api/src/server.ts
    - apps/api/src/controllers/authController.ts
    - apps/api/src/core/auth/middleware.ts
    - apps/api/src/core/realtime/socket.ts
    - apps/api/src/domains/outlook/outlook.service.ts

key-decisions:
  - "Boot-time secrets.ts module uses console.error + process.exit(1), not AppError, since it runs before any HTTP request context exists"
  - "validateSecretsOrExit() called as the first statement inside bootstrap()'s try block (server.ts), never at module scope, to avoid reading process.env before dotenv.config() has run"
  - "Pure validator functions (validateJwtSecretValue/validateEncryptionKeyValue) exported separately from the process.exit-triggering wrappers so unit tests can exercise all 9 behavior cases without spawning subprocesses"

patterns-established:
  - "Boot-time fail-fast validation module pattern: pure decision function + process.exit wrapper, testable without killing the test runner"
  - "Lazy secret getter pattern: call getJwtSecret() inside the function body that needs it, never as a top-level constant — avoids the dotenv-load-order hazard where imports execute before dotenv.config()"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 25min
completed: 2026-07-12
---

# Phase 14 Plan 01: Boot-time JWT_SECRET/ENCRYPTION_KEY Validation Summary

**A single validated-read `secrets.ts` module now fails the API's boot process before any DB/Redis I/O when `JWT_SECRET` or `ENCRYPTION_KEY` is unset, empty, or a known committed/legacy fallback value — all 4 prior hardcoded `|| 'super-secret-key-for-dev'` call sites now read the secret lazily instead.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-12T09:04:00Z (approx, per task read order)
- **Completed:** 2026-07-12T09:29:25Z
- **Tasks:** 3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `apps/api/src/core/config/secrets.ts` exports `getJwtSecret()`, `validateSecretsOrExit()`, and pure validators (`validateJwtSecretValue`, `validateEncryptionKeyValue`) covering all 9 required behavior cases, unit tested via `node:test`
- `server.ts`'s `bootstrap()` now calls `validateSecretsOrExit()` before `db.query("SELECT 1")`, with no `NODE_ENV`/`DEPLOYMENT_MODE` bypass — manually verified `JWT_SECRET= ENCRYPTION_KEY= node --require ts-node/register src/server.ts` exits with code 1 and a clear `FATAL:` message before any DB/Redis connect log line
- All 4 legacy `const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev'` sites (authController.ts, core/auth/middleware.ts, core/realtime/socket.ts, outlook.service.ts) replaced with lazy `getJwtSecret()` calls inline at each `jwt.sign`/`jwt.verify` use

## Task Commits

Each task was committed atomically:

1. **Task 1: Create secrets.ts validated-read module with test coverage** - `b9e7a43` (feat)
2. **Task 2: Wire validateSecretsOrExit() into server.ts bootstrap** - `0390ca5` (feat)
3. **Task 3: Replace 4 fallback call sites with lazy getJwtSecret() calls** - `3ca94f9` (fix)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `apps/api/src/core/config/secrets.ts` - Validated-read module: `getJwtSecret()`, `validateSecretsOrExit()`, pure validators, denylist constants for both known-bad JWT_SECRET values and the committed ENCRYPTION_KEY
- `apps/api/src/core/config/secrets.test.ts` - `node:test` unit coverage for all 9 required behavior cases (unset/empty/known-bad/valid × JWT_SECRET and ENCRYPTION_KEY)
- `apps/api/src/server.ts` - Imports and calls `validateSecretsOrExit()` as first statement in `bootstrap()`'s try block
- `apps/api/src/controllers/authController.ts` - Removed top-level `JWT_SECRET` constant; `login()` now calls `getJwtSecret()` inline in `jwt.sign(...)`
- `apps/api/src/core/auth/middleware.ts` - Removed top-level `JWT_SECRET` constant; `authenticateToken()` now calls `getJwtSecret()` inline in `jwt.verify(...)`
- `apps/api/src/core/realtime/socket.ts` - Removed top-level `JWT_SECRET` constant; `io.use()` handshake handler now calls `getJwtSecret()` inline in `jwt.verify(...)`
- `apps/api/src/domains/outlook/outlook.service.ts` - Removed top-level `JWT_SECRET` constant; `beginConnect()` and `handleCallback()` now call `getJwtSecret()` inline at each `jwt.sign`/`jwt.verify` use

## Decisions Made
- Boot-time failures in `secrets.ts` use `console.error` + `process.exit(1)`, never `AppError` (no HTTP context exists at boot time) — matches the plan's explicit interface note and mirrors `server.ts`'s existing `bootstrap()` catch block style
- Exported pure validator functions separately so `secrets.test.ts` can assert on decision logic directly without triggering `process.exit`, keeping the automated test suite safe to run repeatedly

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks completed per the plan's `<action>` and `<acceptance_criteria>` with no architectural changes, no missing functionality discovered, and no blocking issues beyond the expected one-time `npm install` needed to populate this worktree's `node_modules` (reverted the incidental `package-lock.json` diff that install produced, since it was not part of this plan's file scope).

## Issues Encountered
- This worktree had no `node_modules` installed at start (fresh worktree checkout). Ran `npm install` at the repo root to enable running the automated test suite and the manual boot smoke test; the resulting `package-lock.json` diff (52 insertions, dependency-tree metadata only, no dependency version changes) was reverted via `git checkout -- package-lock.json` after verification since it was incidental to enabling test execution, not a plan task deliverable.

## User Setup Required

None - no external service configuration required. Existing `.env`/`.env.example` files already document `JWT_SECRET`/`ENCRYPTION_KEY`; this plan only makes their absence/known-bad values a hard boot failure instead of a silent fallback.

## Next Phase Readiness

- SEC-01 and SEC-02 fully satisfied: no code path in `apps/api` can start or issue/verify a JWT with a missing or known-bad secret
- Ready for Phase 15 (Migration Runner) — no dependency conflicts; this plan only touched auth/boot code, no schema or migration changes
- No blockers or concerns carried forward

---
*Phase: 14-security-hardening*
*Completed: 2026-07-12*
