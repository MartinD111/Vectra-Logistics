# Phase 16: Production Compose + DEPLOYMENT_MODE - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Two things, tightly coupled: (1) a `docker-compose.prod.yml` that assembles the production app images + Postgres + Redis into one runnable stack with persistent volumes and zero committed secret defaults, and (2) a `DEPLOYMENT_MODE=cloud|on-prem` env var, read once at API boot, that gates registration (open on cloud, closed on on-prem) and any cloud-only seed data. The migration runner this compose file relies on (Phase 15) and the installer that will eventually write `DEPLOYMENT_MODE=on-prem` (Phase 17) are out of scope here — this phase only wires the compose file to call the runner and gates behavior on the env var already being set.

</domain>

<decisions>
## Implementation Decisions

### Matching-engine in prod compose
- **D-01:** `docker-compose.prod.yml` includes the Python matching-engine (`services/matching-engine`) as a 5th application service, built from its own production Dockerfile — same treatment as the four Next.js/Express images. It is a real runtime dependency of `api` (`MATCHING_ENGINE_URL`) for LTL matching; leaving it out would silently break that feature in production. The ROADMAP's "four production app images" wording names the primary web-facing apps, not an exhaustive service count — matching-engine is additive, not a scope violation.

### DEPLOYMENT_MODE unset/invalid handling
- **D-02:** The API hard-fails at boot if `DEPLOYMENT_MODE` is unset or is not exactly `cloud` or `on-prem` — same fail-fast pattern as `JWT_SECRET`/`ENCRYPTION_KEY` from Phase 14 (SEC-01/02). No silent default to `cloud`. This means every deploy, including existing Cloud environments, must explicitly set `DEPLOYMENT_MODE=cloud` in its `.env`/secrets — that's a required follow-up when this ships, not a gap in this phase.

### Prod Postgres/Redis network exposure
- **D-03:** `docker-compose.prod.yml`'s `postgres` and `redis` services have no `ports:` mapping to the host — they're reachable only via the internal compose network by other services (`api`, `matching-engine`). Dev compose's host-port publishing (5433/6380) is a dev-only convenience and is not carried into prod. Admin DB access on a customer's box goes through `docker compose exec` or an operator-provisioned bastion, not an open host port.

### Registration-closed mechanics (on-prem)
- **D-04:** `POST /api/auth/signup` checks `DEPLOYMENT_MODE` and returns 403 unconditionally when `on-prem` — no "first company" state check. On-prem's only company is created by the Phase 17 installer, never through the public signup endpoint. `DEPLOYMENT_MODE=cloud` leaves `/signup` behavior completely unchanged.

### Cloud-only seed data at boot
- **D-05:** No concrete "cloud-only seed data" exists in the codebase today (searched `server.ts` bootstrap and workspace/company creation paths — nothing boot-time seed-related found beyond the already-excluded `017_seed_admin_user.sql`, which Phase 15 handles unconditionally regardless of `DEPLOYMENT_MODE`). This success criterion is satisfied vacuously for this phase: the `DEPLOYMENT_MODE` read/gate mechanism must exist and be wired so a *future* cloud-only seed hook can check it, but there is nothing concrete to gate right now. Do not invent seed data to gate.

### Claude's Discretion
- Exact production Dockerfile build args / multi-stage details for the matching-engine service (D-01) beyond "production image, not dev" — the researcher/planner should confirm `services/matching-engine/Dockerfile` is already production-ready (per `docs/DEPLOYMENT.md`) or note what's missing.
- Exact `DEPLOYMENT_MODE` read/validation code location (e.g., a small config module vs. inline in `server.ts` bootstrap) — follow whatever pattern `JWT_SECRET`/`ENCRYPTION_KEY` validation from Phase 14 already established.
- Whether `docker-compose.prod.yml` needs explicit `restart: unless-stopped` vs. dev's `restart: always`, and healthcheck tuning for prod — left to planner/researcher judgment, not a user-facing decision.
- Volume naming/backup conventions for `postgres_data`/`redis_data` in the prod compose file (can reuse dev's volume names or use prod-prefixed names) — cosmetic, planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Production compose + DEPLOYMENT_MODE (primary spec for this phase)
- `docs/specs/deployment/on-premise-deployment.md` §4 ("Deployment mode toggle") — the authoritative design: §4.1 defines the missing `docker-compose.prod.yml` artifact (four production Dockerfiles + Postgres + Redis, no bind mounts, no dev servers, no committed secret defaults, persistent volumes reusing dev compose's shape); §4.2 defines `DEPLOYMENT_MODE=cloud|on-prem`, read once at boot, and its three concrete uses (seed-admin/seed-data gating, registration open/closed, optional local-AI gating). This phase implements §4.1–§4.2 exactly.
- `docs/specs/architecture-steering.md` §2.1–§2.2 — the CLAUDE.md-referenced pattern this phase is scoped against: "Introduce a top-level `DEPLOYMENT_MODE=cloud|on-prem` (env-driven, read once at boot). Use it to select behavior, never to branch business logic." Also lists known cloud-only assumptions to make optional.

### Adjacent specs (context, not this phase's scope)
- `docs/specs/deployment/cloud-deployment.md` §3.5, §6, line 144–146 — confirms Cloud is simply `DEPLOYMENT_MODE=cloud` (closer to today's default), and separately flags the matching-engine's own horizontal-scaling assumptions as unverified (informs D-01's discretion note, not this phase's scope to fix).
- `docs/specs/deployment/release-and-migrations.md` §1, §4 — why `017_seed_admin_user.sql` must never run in customer-facing installs (already handled unconditionally by Phase 15, D-02 there).
- `.planning/phases/15-migration-runner/15-CONTEXT.md` — the migration runner this compose file's api/entrypoint sequence must call (`npm run migrate` before `up`), per D-01 there and `release-and-migrations.md` §5's 5-step upgrade procedure.
- `.planning/PROJECT.md` §"v3.0 On-Premise GA" — milestone framing; DEP-01/DEP-02 requirement text.
- `.planning/REQUIREMENTS.md` lines 25-26 — DEP-01, DEP-02 requirement definitions.
- `.planning/ROADMAP.md` Phase 16 section — goal, dependency on Phase 15, success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker-compose.yml` (dev) — Postgres/Redis service shape (image, healthcheck, named volumes) is already correct and should be reused as-is in prod, minus the host `ports:` mappings (D-03) and minus the `docker-entrypoint-initdb.d` mounts (Phase 15 replaces these with the migration runner).
- `apps/api/Dockerfile`, `apps/marketplace/Dockerfile`, `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile` — production Dockerfiles already exist for all four web apps (per `docs/DEPLOYMENT.md`'s build commands, referenced in the spec) and should be built/referenced directly, not created new.
- `apps/api/src/controllers/authController.ts` `signup()` (line 13) / `apps/api/src/routes/authRoutes.ts` line 7 (`router.post('/signup', signup)`) — existing signup path to gate per D-04.
- Phase 14's `JWT_SECRET`/`ENCRYPTION_KEY` fail-fast validation (SEC-01/SEC-02) — the pattern to replicate for `DEPLOYMENT_MODE` validation per D-02.

### Established Patterns
- `docker-compose.yml`'s `${VAR:-default}` pattern for Postgres credentials (`POSTGRES_USER:-vectra_user`, `POSTGRES_PASSWORD:-vectra_password`) is dev-only convenience — `docker-compose.prod.yml` must NOT carry these soft defaults for any required secret (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`); optional integration vars (`MS_CLIENT_ID`, `MS_CLIENT_SECRET`) can keep empty-string defaults since they're genuinely optional today.
- `services/matching-engine` currently has its own `Dockerfile` (Python slim + uvicorn per root CLAUDE.md tech stack) already used by dev compose — same reuse-not-rebuild approach applies per D-01.

### Integration Points
- `apps/api/src/server.ts` `bootstrap()` — where `DEPLOYMENT_MODE` validation should hook in, alongside wherever `JWT_SECRET`/`ENCRYPTION_KEY` are currently validated (Phase 14 code).
- Phase 15's migration runner (`npm run migrate`, `apps/api/src/scripts/migrate.ts` once built) — `docker-compose.prod.yml`'s `api` service startup sequence must invoke this before the API process starts serving traffic (matching `release-and-migrations.md` §5's documented procedure: `docker compose run --rm api npm run migrate` then `up -d`).

</code_context>

<specifics>
## Specific Ideas

No UI/UX surface — this phase is pure infra (compose file) + one backend boot-time gate + one endpoint-level gate. Keep the compose file's shape close to the existing dev `docker-compose.yml` (same service list logic, same healthchecks) rather than inventing new patterns, per the spec's "reuse that part" note on Postgres/Redis.

</specifics>

<deferred>
## Deferred Ideas

- Installer/first-run flow that actually writes `DEPLOYMENT_MODE=on-prem` and creates the real admin/company — Phase 17 (Installer / First-Run Flow). This phase only makes the app *read* and *react to* the env var; it doesn't write it.
- Gating the backend-side local AI provider path behind `DEPLOYMENT_MODE` — Phase 18 (per STATE.md: "Phase 18 depends on Phase 16"). Noted in the spec as an optional §4.2 use of `DEPLOYMENT_MODE` but explicitly out of this phase.
- Reverse-proxy / inbound-connectivity documentation (§7 of the spec) — Phase 20 (DOC-01).
- Any future concrete "cloud-only seed data" hook (D-05) — nothing exists to gate today; if one is added later, it should check the same `DEPLOYMENT_MODE` mechanism this phase establishes.

### Reviewed Todos (not folded)
None — no matching todos found (`todo.match-phase 16` was not run standalone in this session, but STATE.md's Pending Todos section is empty).

</deferred>

---

*Phase: 16-Production Compose + DEPLOYMENT_MODE*
*Context gathered: 2026-07-12*
