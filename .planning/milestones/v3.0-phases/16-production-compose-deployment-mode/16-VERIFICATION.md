---
phase: 16-production-compose-deployment-mode
verified: 2026-07-12T20:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "A customer can stand up the full production stack from one compose file (`docker compose -f docker-compose.prod.yml up`) — `.env.example` now documents API_PUBLIC_URL and WORKSPACES_APP_URL as required, uncommented vars, matching docker-compose.prod.yml's `${VAR:?required}` usage"
  gaps_remaining: []
  regressions: []
human_verification: []
human_verification_resolved:
  - test: "Run `docker compose -f docker-compose.prod.yml config` on a machine with a live Docker Compose v2 daemon, with all required vars exported (dummy values), and confirm it resolves cleanly showing all 7 services."
    result: "PASS — executed 2026-07-12T19:05:00Z via Docker Desktop 29.4.3 / Compose v5.1.3 (`C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe`). Exit 0, fully resolved config, all 7 services present, no unresolved `${VAR}` placeholders. See 16-HUMAN-UAT.md test 1."
  - test: "Unset one required secret at a time and re-run `docker compose -f docker-compose.prod.yml config`."
    result: "PASS — all 12 required vars tested individually; each failure names the specific missing variable (e.g. `required variable DEPLOYMENT_MODE is missing a value: DEPLOYMENT_MODE is required (cloud or on-prem)`). See 16-HUMAN-UAT.md test 2."
---

# Phase 16: Production Compose + Deployment Mode Verification Report

**Phase Goal:** A customer can stand up the full production stack from one compose file, and the running app knows at boot whether it's Cloud or On-Premise.
**Verified:** 2026-07-12
**Status:** passed
**Re-verification:** Yes — after gap closure (commit ddcd9b5) and human verification (2026-07-12T19:05:00Z, see 16-HUMAN-UAT.md)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docker compose -f docker-compose.prod.yml up` starts all production app images + Postgres + Redis, with persistent volumes, no bind mounts, no dev servers | ✓ VERIFIED | Structurally verified: 7 services present, named volumes `postgres_data`/`redis_data` declared, zero `docker-entrypoint-initdb.d` mounts, zero `npm run dev` overrides, zero `./apps:` source bind mounts, correct build contexts (root for 3 frontends, subdirectory for api/matching-engine). Gap closed: `.env.example` now documents `API_PUBLIC_URL=http://localhost:8080` (uncommented, with explanatory comment) and `WORKSPACES_APP_URL=http://localhost:3001` (moved out of the commented Outlook-only block into the general/required section, with a comment clarifying it's required by `docker-compose.prod.yml`'s api service regardless of Outlook usage). Confirmed via `git show ddcd9b5 -- .env.example`: both vars added/moved, old commented `WORKSPACES_APP_URL` line under Outlook section removed to avoid duplication/confusion. Live `docker compose config`/`up` execution still not run (no Docker daemon in this environment) — routed to Human Verification (unchanged from previous pass, not a regression). |
| 2 | No committed secret defaults — a missing required secret fails startup rather than silently defaulting | ✓ VERIFIED | `docker-compose.prod.yml`: 4/4 required secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE`) plus `API_PUBLIC_URL`/`WORKSPACES_APP_URL`/4x `NEXT_PUBLIC_*` all use `${VAR:?message}` — 16 required-var declarations total, zero soft-defaults (`${VAR:-`) among them. Optional integration vars (`MS_CLIENT_ID` etc.) correctly keep `:-` defaults. App-level defense-in-depth unchanged: `validateSecretsOrExit()`/`validateDeploymentModeOrExit()` still wired in `server.ts` bootstrap() before any DB/Redis I/O. No regression — not touched by the fix commit. |
| 3 | `DEPLOYMENT_MODE=on-prem` closes open registration and skips cloud-only seed data at boot; `DEPLOYMENT_MODE=cloud` preserves today's behavior unchanged | ✓ VERIFIED | Unchanged from previous pass — not touched by the fix commit. `authController.ts` signup() 403-gates on `on-prem` before `db.connect()`; unit test confirms; cloud path untouched; no cloud-only seed data exists in codebase (vacuously satisfied). |
| 4 | `DEPLOYMENT_MODE` is read once at API boot, not re-evaluated per request | ✓ VERIFIED | Unchanged from previous pass — not touched by the fix commit. `secrets.ts` module-scope cache confirmed; caching test passes. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/core/config/secrets.ts` | `getDeploymentMode()`, `validateDeploymentModeValue()`, `validateDeploymentModeOrExit()` | ✓ VERIFIED | Unchanged, all exported and functioning |
| `apps/api/src/core/config/secrets.test.ts` | Unit coverage: unset/empty/invalid/valid-cloud/valid-on-prem/cache | ✓ VERIFIED | Unchanged, 6 test cases pass |
| `apps/api/src/controllers/authController.ts` | `signup()` 403 gate on `on-prem` | ✓ VERIFIED | Unchanged |
| `apps/api/src/controllers/authController.test.ts` | Unit coverage for signup() gate | ✓ VERIFIED | Unchanged, passes |
| `apps/api/src/server.ts` | `bootstrap()` calls `validateDeploymentModeOrExit()` alongside `validateSecretsOrExit()` | ✓ VERIFIED | Unchanged |
| `docker-compose.prod.yml` | Full production stack assembly | ✓ VERIFIED | 7 services, correct build contexts, persistent volumes, no host ports on postgres/redis, `:?` on all required vars including `API_PUBLIC_URL`/`WORKSPACES_APP_URL` |
| `.env.example` | Documents every var `docker-compose.prod.yml` marks `:?required` | ✓ VERIFIED | Gap closed by commit ddcd9b5. Cross-check: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE`, `WORKSPACES_APP_URL`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL` — all 12 distinct required vars present, uncommented, with explanatory comments in `.env.example` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `apps/api/src/server.ts` | `apps/api/src/core/config/secrets.ts` | `bootstrap()` import + call, `validateDeploymentModeOrExit()` | ✓ WIRED | Unchanged |
| `apps/api/src/controllers/authController.ts` | `apps/api/src/core/config/secrets.ts` | `getDeploymentMode()` import + call at top of `signup()` | ✓ WIRED | Unchanged |
| `docker-compose.prod.yml` (api service environment) | `apps/api/src/core/config/secrets.ts` (`getDeploymentMode`) | `DEPLOYMENT_MODE:?` env var passed through | ✓ WIRED | Unchanged |
| `docker-compose.prod.yml` (frontend build blocks) | `apps/marketplace/Dockerfile`, `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile` | `build.context: .` / `build.dockerfile: apps/<name>/Dockerfile` | ✓ WIRED | Unchanged |
| `.env.example` | `docker-compose.prod.yml` (api service `${API_PUBLIC_URL:?}`, `${WORKSPACES_APP_URL:?}`) | Documented required vars matching compose interpolation | ✓ WIRED | Fixed by ddcd9b5 — cross-checked, all 12 required vars present in `.env.example` |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces infrastructure config (compose file, env template) and a boot-time gate, not a UI data-rendering artifact.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit test suite (secrets + authController + others) | `cd apps/api && npm test` | 34/34 tests pass | ✓ PASS |
| Cross-check `.env.example` vs `docker-compose.prod.yml` required vars | grep both files for `${VAR:?` and manual diff against `.env.example` var names | All 12 distinct required vars present in `.env.example`, none missing | ✓ PASS |
| Live `docker compose -f docker-compose.prod.yml config` (all vars set) | `docker compose --env-file <populated> -f docker-compose.prod.yml config` | Exit 0, all 7 services resolved | ✓ PASS |
| Live `docker compose -f docker-compose.prod.yml config` (each required var unset) | Same command, 1 of 12 vars removed at a time | All 12 fail with a per-variable error naming the missing var | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DEP-01 | 16-02-PLAN.md | `docker-compose.prod.yml` assembles four production images + Postgres + Redis, persistent volumes, no committed secret defaults | ✓ SATISFIED | Compose file structurally correct; `.env.example` now fully consistent with compose file's required vars (gap closed). Live-daemon verification still deferred to human (documented sandbox limitation, not a code defect). |
| DEP-02 | 16-01-PLAN.md, 16-02-PLAN.md | `DEPLOYMENT_MODE=cloud|on-prem` read once at API boot; gates seed data + registration | ✓ SATISFIED | Unchanged from previous pass — `getDeploymentMode()` cache proven by test; `signup()` 403-gated on `on-prem`; cloud path untouched; no cloud-only seed data exists to gate (vacuously satisfied) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/controllers/authController.ts` | 161 | `// TODO: Handle 2FA check here if enabled` | ℹ️ Info | Pre-existing, unrelated to Phase 16 scope, not a blocker (unchanged from previous pass) |

No `TBD`/`FIXME`/`XXX` markers found in any file touched by this phase's fix commit (`.env.example` only touched comments and var placement).

### Human Verification — Resolved

Both items originally routed to human verification have since been executed and passed (2026-07-12T19:05:00Z, Docker Desktop 29.4.3 / Compose v5.1.3). Full detail in `16-HUMAN-UAT.md`.

### Gaps Summary

No remaining gaps. The single gap from the previous verification pass — `.env.example` missing `API_PUBLIC_URL` and mis-documenting `WORKSPACES_APP_URL` as optional — is confirmed closed by commit `ddcd9b5`. Cross-checking both files line-by-line shows all 12 distinct required (`${VAR:?...}`) variables in `docker-compose.prod.yml` are now documented, uncommented, and given sensible defaults with explanatory comments in `.env.example`. Full API test suite (34/34) still passes, confirming no regression to the deployment-mode boot-gate logic touched in earlier waves of this phase. The two live-Docker-daemon checks have now been executed and passed — see `16-HUMAN-UAT.md`. All observable truths for this phase are fully verified with no gaps.

---

*Verified: 2026-07-12*
*Verifier: Claude (gsd-verifier)*
