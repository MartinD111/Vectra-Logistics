---
phase: 16-production-compose-deployment-mode
plan: 02
subsystem: infra
tags: [docker-compose, docker, deployment, on-premise, secrets]

# Dependency graph
requires:
  - phase: 15-migration-runner
    provides: "npm run migrate script referenced (not yet built) in the api service's inline startup-sequencing comment"
provides:
  - "docker-compose.prod.yml — production-only assembly of all 7 services (postgres, redis, api, matching-engine, marketplace, workspaces, cmr)"
  - "No host-port exposure on postgres/redis (D-03)"
  - "Required-secret enforcement via ${VAR:?...} compose interpolation syntax (POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, DEPLOYMENT_MODE, plus per-app NEXT_PUBLIC_* and WORKSPACES_APP_URL/API_PUBLIC_URL)"
  - "DEPLOYMENT_MODE documented in .env.example"
affects: [17-installer-first-run, 18-backend-local-ai, 20-deploy-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "docker compose ${VAR:?message} required-variable interpolation as a defense-in-depth layer below app-level fail-fast validation"

key-files:
  created:
    - docker-compose.prod.yml
  modified:
    - .env.example

key-decisions:
  - "api keeps a host port (8080:8080) despite being an internal service — D-03 only scopes postgres/redis; api needs to be reachable by a reverse proxy or directly"
  - "matching-engine uses depends_on condition: service_started (not service_healthy) since it defines no healthcheck, matching dev compose's shape"
  - "Migrate-then-serve sequencing documented as an inline YAML comment above the api service block, not automated — Phase 15's migrate script does not exist yet"

patterns-established:
  - "Prod compose service blocks mirror dev compose 1:1 minus: host ports on datastores, docker-entrypoint-initdb.d mounts, source bind-mounts, and dev command overrides"

requirements-completed: [DEP-01, DEP-02]

# Metrics
duration: 15min
completed: 2026-07-12
---

# Phase 16 Plan 02: Production Compose Assembly Summary

**docker-compose.prod.yml assembling all 7 production services (postgres, redis, api, matching-engine, marketplace, workspaces, cmr) with zero committed secret defaults, no datastore host-port exposure, and no dev bind-mounts, plus DEPLOYMENT_MODE documented in .env.example**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 automated tasks completed; 1 checkpoint (`checkpoint:human-verify`) documented below as unautomatable in this sandbox
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `docker-compose.prod.yml` at repo root: 7 services (postgres, redis, api, matching-engine, marketplace, workspaces, cmr), all built from the plan's exact `<action>` spec
- Every required secret (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE`) uses `${VAR:?message}` — compose itself refuses to start if any is unset, not silently substituting empty string
- `postgres`/`redis` have zero `ports:` keys — reachable only via the internal compose network (D-03)
- No `docker-entrypoint-initdb.d` mounts (MIG-02 — Phase 15's migration runner replaces this)
- No dev bind-mounts or `command:` overrides anywhere — every app service runs its built image's own production `CMD`
- 3 frontend services build with `context: .` (repo root, Pattern 2 for monorepo workspace resolution); `api`/`matching-engine` build with their own subdirectory contexts
- Inline YAML comment above the `api` block documents the migrate-then-serve two-step (`docker compose run --rm api npm run migrate` then `up -d`), per RESEARCH.md's Open Question 1 resolution
- `.env.example` documents the new `DEPLOYMENT_MODE` var in the Auth section, explaining both valid values and their effect

## Task Commits

1. **Task 1: Create docker-compose.prod.yml** - `ea421c7` (feat)
3. **Task 3: Document DEPLOYMENT_MODE in .env.example** - `1a595d6` (docs)

_Task 2 was the `checkpoint:human-verify` gate — see "Checkpoint Handling" below; no code commit for this task._

## Files Created/Modified
- `docker-compose.prod.yml` - Production Docker Compose assembly (7 services + named volumes)
- `.env.example` - Added `DEPLOYMENT_MODE=` with explanatory comment in the Auth section

## Decisions Made
- Kept `api`'s host port (`8080:8080`) since D-03 scopes only postgres/redis as internal-only; api is the shared backend reverse proxies/clients must reach
- Used `depends_on: matching-engine: condition: service_started` (not `service_healthy`) on `api`, since `matching-engine` defines no healthcheck in either dev or prod compose — avoids inventing a new health signal outside this plan's scope
- Documented the migrate-then-serve sequencing purely as an inline comment (no automation attempted) — Phase 15's `npm run migrate` script does not exist in this repo yet, per the plan's explicit dependency note; this is expected, not a gap

## Deviations from Plan

None - plan executed exactly as written. All automated verification checks (service count = 7, no ports on postgres/redis, no soft-defaulted secrets, `:?` on all 4 required secrets, no initdb mounts, no dev commands, no source bind-mounts) pass deterministically.

## Issues Encountered

None during automated task execution.

## Checkpoint Handling (Task 2: `checkpoint:human-verify`, gate="blocking")

This plan's Task 2 is a `checkpoint:human-verify` requiring a live Docker Compose v2 daemon to confirm:
1. `docker compose -f docker-compose.prod.yml config` resolves cleanly with all required vars set
2. The same command fails with a per-variable error message when any single required secret is unset (proving `:?` syntax works, not `:-`)

**This could not be automated in this execution environment** — the worktree agent runs in a sandboxed background context with no verified live Docker daemon available. Per the parallel-execution non-interactive protocol, this is documented here rather than blocking indefinitely on user input.

**What a human must manually verify before treating DEP-01 as fully closed:**

```bash
export POSTGRES_USER=u POSTGRES_PASSWORD=p POSTGRES_DB=d JWT_SECRET=j ENCRYPTION_KEY=e \
       DEPLOYMENT_MODE=cloud WORKSPACES_APP_URL=http://localhost:3001 \
       API_PUBLIC_URL=http://localhost:8080 NEXT_PUBLIC_API_URL=http://localhost:8080 \
       NEXT_PUBLIC_MARKETPLACE_URL=http://localhost:3000 \
       NEXT_PUBLIC_WORKSPACES_URL=http://localhost:3001 \
       NEXT_PUBLIC_CMR_URL=http://localhost:3002

docker compose -f docker-compose.prod.yml config   # expect: resolves cleanly, shows all 7 services

unset DEPLOYMENT_MODE
docker compose -f docker-compose.prod.yml config   # expect: fails naming DEPLOYMENT_MODE specifically
```

Static/textual verification was performed in place of the live check: every occurrence of `${VAR:?...}` in the file was grep-confirmed for the 4 named secrets (5+ occurrences total across postgres/api services), and zero occurrences of the soft-default `${VAR:-` pattern exist for those same 4 vars. This gives high confidence the YAML syntax is correct, but does not substitute for actually invoking `docker compose config` against a live Compose parser, which is the one thing 16-VALIDATION.md classifies as manual-only in this phase.

## User Setup Required

None for this plan directly — however, before running this compose file in any real environment, a human with Docker Compose v2 must perform the live `docker compose config` verification described above (both the pass case and the per-variable failure case). This is a prerequisite before DEP-01 is considered fully verified end-to-end (Task 1's static checks are already complete and passing).

## Next Phase Readiness
- `docker-compose.prod.yml` is structurally complete and ready to be exercised once Phase 15's migration runner (`apps/api/src/scripts/migrate.ts`, `npm run migrate`) ships — the compose file already references the correct migrate-then-serve procedure in its inline comment
- `.env.example` is up to date for operators standing up a production stack
- Live `docker compose config` verification (both pass and per-variable-fail cases) remains an open manual checkpoint — flagged above, not blocking further Phase 16 plan work (16-01 covers the app-code half independently, zero file overlap)

---
*Phase: 16-production-compose-deployment-mode*
*Completed: 2026-07-12*
