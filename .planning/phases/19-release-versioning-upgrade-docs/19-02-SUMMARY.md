---
phase: 19-release-versioning-upgrade-docs
plan: 02
subsystem: infra
tags: [docker, versioning, build-args, docker-compose]

# Dependency graph
requires:
  - "19-01: Root VERSION file, apps/api/src/core/config/version.ts getVersion()/ENV VERSION consumer"
provides:
  - "ARG VERSION=unknown declared in all 4 production Dockerfiles (apps/api, apps/marketplace, apps/workspaces, apps/cmr)"
  - "apps/api/Dockerfile also sets ENV VERSION=$VERSION so the running container's getVersion() (Plan 01) can read it"
  - "3 frontend Dockerfiles set LABEL org.opencontainers.image.version=$VERSION in their runner stage"
  - "docker-compose.prod.yml passes VERSION as a required (:?) build arg to all 4 app services"
affects: [release-build-tooling, ops-deployment-runbooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-stage Dockerfile ARG scoping: ARG must be redeclared in the runner stage (not just near the top base FROM) because ARG scope does not cross FROM boundaries"
    - "Required build-arg convention: ${VERSION:?message} mirrors the existing ${JWT_SECRET:?...}/${ENCRYPTION_KEY:?...}/${DEPLOYMENT_MODE:?...} required-env-var pattern already used in docker-compose.prod.yml"

key-files:
  created: []
  modified:
    - apps/api/Dockerfile
    - apps/marketplace/Dockerfile
    - apps/workspaces/Dockerfile
    - apps/cmr/Dockerfile
    - docker-compose.prod.yml

key-decisions:
  - "apps/api/Dockerfile gets both ARG and ENV VERSION (single-stage image is the same one that serves /health at runtime, per Plan 01's getVersion()); the 3 Next.js frontends get only ARG + an OCI LABEL, since they don't read process.env.VERSION at request time — image metadata is sufficient for them"
  - "VERSION build arg is required with no silent default (${VERSION:?...}), matching existing required-secret conventions in docker-compose.prod.yml rather than introducing a new pattern"

requirements-completed: [REL-01]

# Metrics
duration: 12min
completed: 2026-07-13
---

# Phase 19 Plan 02: Docker VERSION build-arg wiring Summary

**All 4 production Dockerfiles now accept an ARG VERSION build arg (api additionally persists it via ENV for runtime /health reporting; the 3 frontends stamp it into an OCI image LABEL), and docker-compose.prod.yml passes VERSION as a required, non-defaulted build arg to all 4 app services, avoiding the apps/api-vs-repo-root build-context asymmetry called out in RESEARCH.md Pitfall 1.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-13
- **Completed:** 2026-07-13
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All 4 production Docker images (`apps/api`, `apps/marketplace`, `apps/workspaces`, `apps/cmr`) declare `ARG VERSION=unknown`
- `apps/api/Dockerfile` additionally sets `ENV VERSION=$VERSION`, wiring the build-time version into the running container so Plan 01's `getVersion()` (consumed by `GET /health`) reflects the actual built version rather than falling back to reading the `VERSION` file at runtime
- The 3 frontend Dockerfiles set `LABEL org.opencontainers.image.version=$VERSION` in their `runner` stage (the `ARG` had to be redeclared there specifically, since `ARG` scope does not cross `FROM` boundaries in multi-stage builds)
- `docker-compose.prod.yml` passes `VERSION` as a required build arg (`${VERSION:?...}`, no silent default) to all 4 app services' `build.args` blocks, consistent with the file's existing `JWT_SECRET`/`ENCRYPTION_KEY`/`DEPLOYMENT_MODE` required-env-var convention
- Corrected the stale "Requires Phase 15's migration runner ... not present in this repo as of Phase 16" comment above the `api` service — Phase 15 has since shipped (`apps/api/src/scripts/migrate.ts` exists, wired via `npm run migrate`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ARG VERSION to all 4 Dockerfiles** - `b0a8168` (feat)
2. **Task 2: Wire VERSION build-arg through docker-compose.prod.yml + fix stale comment** - `e5c74e6` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `apps/api/Dockerfile` - Added `ARG VERSION=unknown` + `ENV VERSION=$VERSION` after `FROM node:18-alpine`, before `WORKDIR /app`
- `apps/marketplace/Dockerfile` - Added `ARG VERSION=unknown` + `LABEL org.opencontainers.image.version=$VERSION` in the `runner` stage
- `apps/workspaces/Dockerfile` - Same as marketplace
- `apps/cmr/Dockerfile` - Same as marketplace
- `docker-compose.prod.yml` - Added `args: VERSION: ${VERSION:?VERSION is required (export VERSION from the VERSION file before build)}` under each of the 4 app services' `build:` blocks; corrected the stale Phase 15 comment above the `api` service

## Decisions Made
- Split treatment between `apps/api` (ARG + ENV, since it's the runtime image that serves `/health`) and the 3 Next.js frontends (ARG + LABEL only, since they don't read `process.env.VERSION` at request time) — matches the plan's explicit guidance and avoids adding an unused runtime env var to static frontend images
- Used the existing `${VAR:?message}` required-build-arg convention rather than a silently-defaulted `${VERSION:-unknown}`, so a missing `VERSION` export fails the build loudly instead of silently shipping an `unknown`-labeled production image

## Deviations from Plan

None - plan executed exactly as written. Note: this worktree environment surfaced a case-sensitivity quirk in the sandboxed file-path resolver (a lowercase-drive-letter path like `c:\Users\...` was rejected as "outside the worktree" while the identical path with `C:\Users\...` succeeded) — this was a tooling/environment artifact encountered while editing, not a plan or code deviation, and required no code changes to work around (just re-issuing the same Edit calls with the correctly-cased path).

## Issues Encountered
- The optional Docker-availability verification step (`docker compose -f docker-compose.prod.yml config` with `VERSION` and other required vars exported, to confirm the resolved value appears instead of a literal `${VERSION}`) produced no output in this execution environment — the `docker` CLI is on `PATH` but the daemon does not appear to be reachable/running here. Per the plan's own verification section, this is explicitly a non-blocking manual follow-up ("otherwise this step is a manual follow-up, not a blocking gate"), not a gate for plan completion. The static `grep` verifications (both automated and acceptance-criteria greps) all passed.

## User Setup Required

Before running `docker compose -f docker-compose.prod.yml build` (or `up`) in a real deployment, the operator must export `VERSION` from the repo's tracked `VERSION` file first, e.g.:
```bash
export VERSION=$(cat VERSION)
docker compose -f docker-compose.prod.yml build
```
No other external service configuration required for this plan.

## Next Phase Readiness
- Docker image versioning is fully wired end-to-end: `VERSION` file (Plan 01) -> operator shell export -> `docker-compose.prod.yml` required build arg -> `ARG VERSION` in each Dockerfile -> `ENV VERSION` (api) / `LABEL org.opencontainers.image.version` (frontends)
- Recommend a manual `docker compose -f docker-compose.prod.yml config` smoke test (with `VERSION` and other required env vars exported) in an environment with a running Docker daemon, to confirm the resolved build args before the next real production build/release
- No blockers identified for subsequent plans in this phase

## Self-Check: PASSED

All created/modified files and all 3 task/plan commits verified present on disk and in `git log --oneline --all`.

---
*Phase: 19-release-versioning-upgrade-docs*
*Completed: 2026-07-13*
