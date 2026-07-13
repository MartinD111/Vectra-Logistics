---
phase: 20-deploy-hardening-connectivity-doc
plan: 01
subsystem: api
tags: [cors, socket.io, express, security, hardening]

# Dependency graph
requires: []
provides:
  - "getAllowedOrigins() — single source of truth for the CORS/Socket.IO origin allowlist"
  - "Express cors() and Socket.IO cors.origin both restricted to the allowlist (no more origin: \"*\")"
  - "CORS_ALLOWED_ORIGINS env var, documented in .env.example"
affects: [20-03, deploy-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Request-time, lazy-env-read config module (mirrors secrets.ts's lazy-read discipline but never calls process.exit — returns [] on empty)"
    - "Single getAllowedOrigins() call site shared by two independent CORS surfaces (Express + Socket.IO) to prevent config drift"

key-files:
  created:
    - apps/api/src/core/config/cors.ts
    - apps/api/src/core/config/cors.test.ts
    - apps/api/src/server.cors.test.ts
  modified:
    - apps/api/src/server.ts
    - .env.example

key-decisions:
  - "getAllowedOrigins() is request-time (no process.exit), unlike secrets.ts's boot-time gate — an empty allowlist is a valid return value, decision left to caller"
  - "server.cors.test.ts uses require() (not import) after setting process.env.CORS_ALLOWED_ORIGINS, since server.ts reads the allowlist once at module-load time and CommonJS require() executes in program order (unlike hoisted ES imports)"

patterns-established:
  - "New request-time config helpers under apps/api/src/core/config/ should read process.env only inside the function body, matching cors.ts/secrets.ts"

requirements-completed: [HRD-01]

duration: 25min
completed: 2026-07-13
---

# Phase 20 Plan 01: CORS + Socket.IO Origin Allowlist Summary

**Express CORS and Socket.IO's handshake now both reject origins outside an env-configured allowlist (`CORS_ALLOWED_ORIGINS`, falling back to the three `NEXT_PUBLIC_*_URL` vars), replacing the prior wide-open `cors()`/`origin: "*"` config.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-13T06:21:00Z
- **Completed:** 2026-07-13T06:46:45Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `getAllowedOrigins()` helper: primary `CORS_ALLOWED_ORIGINS` (comma-separated) source, falls back to `NEXT_PUBLIC_MARKETPLACE_URL`/`NEXT_PUBLIC_WORKSPACES_URL`/`NEXT_PUBLIC_CMR_URL` when unset/empty
- `server.ts` wired so Express's `cors()` and Socket.IO's `Server({ cors })` both consume the exact same resolved array, eliminating the two-independent-surfaces drift risk called out in the plan's threat model
- Integration test proves an allowed origin gets `access-control-allow-origin` reflected on `/health`, and a disallowed origin gets no such header
- `CORS_ALLOWED_ORIGINS` documented in `.env.example` next to the existing cross-app URL vars

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cors.ts allowlist helper + unit tests** - `ff1872f` (feat)
2. **Task 2: Wire getAllowedOrigins into Express CORS + Socket.IO, integration test** - `0aca596` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/api/src/core/config/cors.ts` - `getAllowedOrigins(): string[]`, request-time lazy-env-read allowlist resolver
- `apps/api/src/core/config/cors.test.ts` - 4 unit tests (explicit list, fallback, all-unset, whitespace-only fallback)
- `apps/api/src/server.ts` - `allowedOrigins` resolved once via `getAllowedOrigins()`, shared by Socket.IO's `cors.origin` and Express's function-based `cors({ origin })`
- `apps/api/src/server.cors.test.ts` - 2 integration tests (allowed origin reflected, disallowed origin rejected) against a real `http.createServer(app)`
- `.env.example` - added `CORS_ALLOWED_ORIGINS` documentation

## Decisions Made
- Matched `secrets.ts`'s lazy-read-inside-function-body discipline (module safe to import before `dotenv.config()` runs) but deliberately did NOT copy its `fail()`/`process.exit()` boot-gate behavior, since this is request-time code — an empty allowlist is a legitimate return value.
- Test env mutation (explicit `delete process.env.X` at the top of each `cors.test.ts` case) is a deliberate, documented deviation from `secrets.test.ts` (which has no precedent for env mutation), required because `getAllowedOrigins()` reads `process.env` directly and tests must not leak state between cases.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree branch (`worktree-agent-a8b319113efd0950f`) was checked out 282 commits behind `main` with zero unique commits (exactly at the merge-base) — `.planning/` and current `apps/api` code (including `secrets.ts`, `server.health.test.ts`) didn't exist in the worktree at session start. Resolved with a safe `git merge main --ff-only` before execution began (no destructive operations, no conflicts). Same class of issue previously seen and documented for Phase 18 (see STATE.md Blockers/Concerns).
- `node_modules` was not installed in the worktree (fresh checkout); ran `npm install` at the repo root before running any tests. This updated `package-lock.json` by 52 lines (dependency resolution sync, not a new dependency) — left unstaged/uncommitted since it's outside this plan's `files_modified` scope and not needed for either task's acceptance criteria.

## User Setup Required

None - no external service configuration required. `CORS_ALLOWED_ORIGINS` is optional; unset in dev falls back to existing `NEXT_PUBLIC_*_URL` behavior with no operator action needed.

## Next Phase Readiness
- `getAllowedOrigins()` is available for Plan 20-03's health-check wiring (both plans edit `server.ts`; 20-03 depends on this plan's `server.ts` state per wave ordering).
- HRD-01 satisfied: CORS + Socket.IO origins restricted to env-configured app origins.

---
*Phase: 20-deploy-hardening-connectivity-doc*
*Completed: 2026-07-13*
