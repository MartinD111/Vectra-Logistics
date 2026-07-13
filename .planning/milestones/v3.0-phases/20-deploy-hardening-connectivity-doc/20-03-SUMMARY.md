---
phase: 20-deploy-hardening-connectivity-doc
plan: 03
subsystem: api
tags: [health-check, postgres, redis, express, deployment, hardening]

# Dependency graph
requires:
  - phase: 20-01
    provides: "CORS/Socket.IO allowlist wired into server.ts (sequenced first — both plans edit server.ts)"
provides:
  - "checkDependencyHealth(deps) — pure, DI-friendly Postgres/Redis reachability probe"
  - "GET /health performs a live per-request check of Postgres + Redis, no caching"
  - "GET /health returns 503 with a per-dependency breakdown when either dependency is unreachable"
affects: [20-deploy-hardening-connectivity-doc, deployment-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DI-based request-time probe module (apps/api/src/core/health/) — no process.env reads, no db/redisClient singleton imports inside the pure function, dependencies injected via a HealthCheckDeps interface for unit testability without a live DB/Redis connection"
    - "Promise.allSettled fan-out for independent, non-blocking dependency checks (one dependency being down never masks or blocks the other's result)"

key-files:
  created:
    - apps/api/src/core/health/health.service.ts
    - apps/api/src/core/health/health.service.test.ts
  modified:
    - apps/api/src/server.ts
    - apps/api/src/server.health.test.ts

key-decisions:
  - "checkDependencyHealth() never throws — a failed probe is reflected as 'down' in the result object, not a rejected promise, so the /health handler never needs a try/catch around the health check itself"
  - "server.health.test.ts assertions changed from an unconditional 'status === OK' expectation to shape + status/HTTP-code consistency checks, since the test process imports { app } without calling bootstrap() — redisClient.ping() throws (ClientClosedError) rather than lazily connecting, so the test process legitimately exercises the 503 path most of the time (RESEARCH.md Pitfall 1)"

patterns-established:
  - "New core/<domain>/[domain].service.ts modules that need external I/O for testability should follow the DI-deps-interface pattern here, not import singletons directly, mirroring how core/config/*.ts already isolates process.env reads"

requirements-completed: [HRD-03]

# Metrics
duration: 25min
completed: 2026-07-13
---

# Phase 20 Plan 03: Live Health Check (Postgres + Redis) Summary

**`GET /health` now performs a live, uncached Postgres + Redis reachability check on every request via a new DI-based `checkDependencyHealth()`, returning 503 with a per-dependency `{postgres,redis}` breakdown when either is unreachable instead of a static 200.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-13T06:39:00Z
- **Completed:** 2026-07-13T07:04:51Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `checkDependencyHealth(deps)`: pure, DI-friendly probe using `Promise.allSettled` — never reads `process.env`, never imports the `db`/`redisClient` singletons directly, fully unit-testable with mocks
- 4 unit tests covering all postgres/redis ok/down combinations
- `GET /health` handler is now `async`, calls `checkDependencyHealth` with the real `db.query("SELECT 1")` / `redisClient.ping()` probes reused from the existing singletons — no new client instances constructed
- Response shape is additive-only per D-03: existing `status`/`message`/`version` fields preserved, new `dependencies: {postgres, redis}` field added; HTTP status is 200 iff both dependencies are `'ok'`, 503 otherwise
- `server.health.test.ts` updated to assert `dependencies` shape and status/HTTP-code consistency rather than a fixed 200/OK outcome, since the test process never calls `bootstrap()` and therefore the redis client is never `.connect()`-ed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create health.service.ts with DI-based checkDependencyHealth + unit tests** - `76e8adb` (feat)
2. **Task 2: Wire checkDependencyHealth into /health, update server.health.test.ts** - `c45307a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/api/src/core/health/health.service.ts` - `checkDependencyHealth(deps: HealthCheckDeps): Promise<DependencyHealth>`, exports `DependencyHealth`/`HealthCheckDeps` interfaces
- `apps/api/src/core/health/health.service.test.ts` - 4 unit tests (both ok, postgres down, redis down, both down)
- `apps/api/src/server.ts` - `/health` handler now `async`, imports and calls `checkDependencyHealth`, returns 200/503 based on dependency status
- `apps/api/src/server.health.test.ts` - Updated integration test asserts `dependencies` object shape and status/HTTP-code consistency instead of a fixed `status === 'OK'` expectation

## Decisions Made
- `checkDependencyHealth()` design mirrors the request-time, DI-friendly discipline established elsewhere in `core/` (e.g. `core/config/cors.ts`) rather than the boot-time `process.exit()` gate pattern in `core/config/secrets.ts` — this is per-request code, not boot-time code, and must never crash the process on a transient dependency outage.
- Kept the `message` field on both the success and failure response bodies per the plan's explicit "additive-only" interface spec.

## Deviations from Plan

None — plan executed exactly as written. One pre-existing environment gap was resolved to enable verification: the worktree had no `node_modules` installed at any workspace level (root, `apps/api`); ran `npm install --workspaces=false --ignore-scripts` at the repo root to restore the dev dependency tree (`ts-node`, `typescript`, etc.) needed to run the plan's test/tsc verification commands. This is a Rule 3 (auto-fix blocking issue) — a legitimate `npm install` of already-locked dependencies from `package-lock.json`, not a new/unverified package addition, so the package-legitimacy exclusion in Rule 3 does not apply.

## Verification

- `cd apps/api && node --require ts-node/register --test src/core/health/health.service.test.ts src/server.health.test.ts` — 5/5 tests pass
- `cd apps/api && npx tsc --noEmit` — clean, no errors
- Manually confirmed `apps/api/src/server.ts`'s `/health` handler is `async` and references `checkDependencyHealth`

## Self-Check: PASSED
- FOUND: apps/api/src/core/health/health.service.ts
- FOUND: apps/api/src/core/health/health.service.test.ts
- FOUND commit 76e8adb in git log
- FOUND commit c45307a in git log
