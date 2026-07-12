# Phase 16: Production Compose + DEPLOYMENT_MODE - Research

**Researched:** 2026-07-12
**Domain:** Docker Compose production packaging + boot-time env-driven feature gating (Express/Node backend)
**Confidence:** HIGH

## Summary

This phase has no new library/framework surface — it is entirely composition of existing, already-verified artifacts (four Next.js production Dockerfiles, one Python matching-engine Dockerfile, existing Postgres/Redis service definitions) plus one small code change (a boot-time env validator, following an exact pattern already shipped in Phase 14) and one endpoint gate (a single `if` in `signup()`). Every file CONTEXT.md pointed to was read directly and confirmed to exist and match its described shape, with one important correction: **Phase 15 (the migration runner) has not been executed yet** — `apps/api/src/scripts/migrate.ts` and the `migrate` npm scripts do not exist in the repo today. Phase 16 planning must treat these as available-by-dependency (Phase 16 depends on Phase 15 per ROADMAP), not verify them again — but any plan that tries to `Read` or test-invoke them today will find them missing, which is expected and correct, not a bug to fix.

The three frontend Dockerfiles (`marketplace`, `workspaces`, `cmr`) all require **repo-root** build context (they `COPY apps ./apps` and `COPY packages ./packages` to resolve workspace deps) — this is the single most load-bearing detail for writing `docker-compose.prod.yml` correctly, since it differs from `apps/api/Dockerfile`, which builds from its own `./apps/api` context and has zero `@vectra/*` workspace dependencies. Getting this backwards (e.g. giving all five services the same `context: .`) will break the API image needlessly or, worse, break the frontend images if built from their own subdirectory context.

**Primary recommendation:** Build `docker-compose.prod.yml` as a straight assembly of existing artifacts — reuse dev compose's Postgres/Redis blocks verbatim minus `ports:`/initdb mounts, reference the four existing per-app Dockerfiles with correct build contexts (root for the 3 frontends, `./apps/api` for the API), add `matching-engine` as a 5th service from its existing Dockerfile, remove every `:-default` fallback for required secrets, and gate the API's `command`/entrypoint to run `npm run migrate` before `node dist/server.js` (matching `release-and-migrations.md` §5's `run --rm api npm run migrate` step, or building it into a single entrypoint script — planner's call, both are valid, see Open Questions). Add `DEPLOYMENT_MODE` validation to `apps/api/src/core/config/secrets.ts` following the exact `validateJwtSecretValue`/`fail()` pattern already there, called from `bootstrap()` in `server.ts` right next to `validateSecretsOrExit()`. Gate `authController.signup()` with a single early-return 403 check.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Production image assembly (compose file) | Infra / Deployment | — | Pure ops artifact, no app-tier code |
| Secret presence/format validation | API / Backend (boot) | — | `bootstrap()` runs once per process start, before any request is served |
| `DEPLOYMENT_MODE` read | API / Backend (boot) | — | Read once at boot per D-02/CLAUDE.md §2.1; never per-request |
| Registration gate (`on-prem` → 403) | API / Backend (request) | — | Existing `signup()` handler already owns this decision (409/400 checks live there) |
| Postgres/Redis persistence | Database / Storage | — | Unchanged from dev compose's shape, just no host ports |
| Migration execution before serving traffic | Infra / Deployment (compose orchestration) → API / Backend (script) | — | Compose sequences it; the actual runner is backend code from Phase 15 |

## Standard Stack

No new packages are introduced by this phase — it is Docker Compose YAML + ~15-30 lines of existing-pattern TypeScript. No `npm install` step required.

### Core
| Tool | Version (verified in repo) | Purpose | Why Standard |
|------|---------|---------|--------------|
| Docker Compose | v2 (`docker compose`, per release-and-migrations.md's command examples) | Assemble multi-container prod stack | Already the project's only orchestration mechanism (dev compose exists) |
| postgres image | `postgres:15-alpine` [VERIFIED: docker-compose.yml] | Primary datastore | Already pinned and running in dev |
| redis image | `redis:7-alpine` [VERIFIED: docker-compose.yml] | Cache/queue backing (BullMQ) | Already pinned and running in dev |
| node:18-alpine | base image for all 5 app Dockerfiles [VERIFIED: Dockerfiles] | App runtime | Already the pinned base across every existing Dockerfile |
| python:3.11-slim | base image for matching-engine [VERIFIED: services/matching-engine/Dockerfile] | Matching engine runtime | Matches CLAUDE.md tech stack (Python 3.11) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compose `command:` override for migrate-then-serve | A custom `docker-entrypoint.sh` script in the API image running migrate then exec-ing the server | Entrypoint script is more robust (works the same whether invoked via `docker run`, `compose up`, or `compose run`) but is a new file to add to the API Dockerfile; a compose-level `run --rm api npm run migrate && up -d` two-step (as release-and-migrations.md §5 literally documents) requires zero Dockerfile changes but pushes sequencing onto the operator/doc rather than the container itself. See Open Questions — recommend the two-step documented approach for this phase since §5 already specifies it as the operator procedure, but flag the entrypoint-script alternative for the planner to choose. |

**Installation:** N/A — no packages to install.

## Package Legitimacy Audit

Not applicable — this phase adds no external npm/pip/cargo packages. No `slopcheck`/registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
                     docker compose -f docker-compose.prod.yml up
                                      │
        ┌─────────────────┬──────────┴───────────┬──────────────────┐
        ▼                 ▼                       ▼                  ▼
   [marketplace]     [workspaces]              [cmr]            [matching-engine]
   (Next standalone) (Next standalone)   (Next standalone)      (FastAPI/uvicorn)
        │                 │                       │                  ▲
        └────────┬────────┴───────────┬───────────┘                  │
                  ▼                    │                              │
             NEXT_PUBLIC_API_URL       │                       MATCHING_ENGINE_URL
                  │                    │                              │
                  ▼                    ▼                              │
            ┌─────────────────────────────────────────────────────────┘
            │                    api (Express)
            │  1. entrypoint/compose step: npm run migrate (Phase 15 runner,
            │     applies pending database/migrations/*.sql, records in
            │     schema_migrations, skips 017_seed_admin_user.sql)
            │  2. bootstrap(): validateSecretsOrExit() [existing]
            │     + validateDeploymentModeOrExit() [NEW, same pattern]
            │  3. server.listen()
            └───────────────┬────────────────────────┬────────────────┘
                             ▼                        ▼
                        [postgres]                [redis]
                     (no host ports;           (no host ports;
                      internal network only)    internal network only)
```

Request-time gate (separate from boot-time read): `POST /api/auth/signup` reads the
already-boot-validated `DEPLOYMENT_MODE` and short-circuits with 403 when `on-prem`,
before any of its existing validation/DB work (see Code Examples).

### Recommended Project Structure
No new directories. Single new file at repo root:
```
docker-compose.prod.yml   # new — sibling to existing docker-compose.yml
```
One new export in an existing file:
```
apps/api/src/core/config/secrets.ts   # add getDeploymentMode()/validateDeploymentModeOrExit()
```
One new early-return in an existing file:
```
apps/api/src/controllers/authController.ts   # signup() — add 403 gate at top
```

### Pattern 1: Reuse dev compose's Postgres/Redis block, strip host ports + initdb mounts
**What:** Copy the `postgres`/`redis` service blocks from `docker-compose.yml` almost verbatim (image, `restart`, `healthcheck`, named volume) into `docker-compose.prod.yml`. Delete the `ports:` key from both (D-03) and delete every `volumes:` line under `postgres` that mounts an individual `.sql` file into `docker-entrypoint-initdb.d` — production has zero initdb mounts, since Phase 15's migration runner replaces that mechanism entirely per MIG-02 and `on-premise-deployment.md` §4.1/§6.1.
**When to use:** Always, for this phase — this is a locked decision area (D-03), not a discretionary one.
**Example:**
```yaml
# Source: docker-compose.yml lines 2-52, minus ports: and initdb volume mounts
postgres:
  image: postgres:15-alpine
  container_name: vectra_postgres
  restart: unless-stopped
  environment:
    POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER is required}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB is required}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
    interval: 5s
    timeout: 5s
    retries: 5

redis:
  image: redis:7-alpine
  container_name: vectra_redis
  restart: unless-stopped
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 5s
    retries: 5
```
Note the `${VAR:?message}` syntax above (Compose's required-variable-or-fail interpolation) —
this is the mechanism that satisfies success criterion 2 ("a missing required secret fails
startup rather than silently defaulting") at the compose-file level, complementing the
app-level `validateSecretsOrExit()` fail-fast that already exists for `JWT_SECRET`/`ENCRYPTION_KEY`.
Use `:?` for every required secret (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`,
`DEPLOYMENT_MODE`); keep bare `${VAR}` (no default) or an explicit empty-string default
(`${VAR:-}`) only for genuinely optional integration vars (`MS_CLIENT_ID`, `MS_CLIENT_SECRET`).

### Pattern 2: Correct build context per service (the critical gotcha)
**What:** The three frontend Dockerfiles (`apps/marketplace/Dockerfile`, `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile`) all start their build comment with an explicit instruction: build from the **repo root**, because their `deps` stage does `COPY apps ./apps` + `COPY packages ./packages` to resolve `@vectra/*` workspace packages before `npm ci`. `apps/api/Dockerfile` has no such dependency — it's a single-stage build that only needs its own `package.json`, and dev compose already builds it with `context: ./apps/api`. `services/matching-engine/Dockerfile` similarly only needs its own `requirements.txt`, `context: ./services/matching-engine`.
**When to use:** Always — every compose service definition's `build.context`/`build.dockerfile` pair.
**Example:**
```yaml
# Source: apps/marketplace/Dockerfile lines 1-3 ("Build from the REPO ROOT context"),
# apps/workspaces/Dockerfile, apps/cmr/Dockerfile (identical comment pattern);
# docs/DEPLOYMENT.md lines 48-51 (documented build commands, confirms context per image)
marketplace:
  build:
    context: .
    dockerfile: apps/marketplace/Dockerfile
workspaces:
  build:
    context: .
    dockerfile: apps/workspaces/Dockerfile
cmr:
  build:
    context: .
    dockerfile: apps/cmr/Dockerfile
api:
  build:
    context: ./apps/api
    dockerfile: Dockerfile
matching-engine:
  build:
    context: ./services/matching-engine
    dockerfile: Dockerfile
```

### Pattern 3: Boot-time fail-fast env validation (DEPLOYMENT_MODE) — exact Phase 14 pattern to replicate
**What:** `apps/api/src/core/config/secrets.ts` already implements the exact shape needed for `DEPLOYMENT_MODE`: a pure validator function returning `{valid, reason?}`, a `fail(varName, reason)` helper that logs and `process.exit(1)`s, and an exported `validateXOrExit()` wired into `bootstrap()` before any DB/Redis I/O. Add a parallel `validateDeploymentModeValue`/`getDeploymentMode` pair to this same file (not a new file — same module, same test file convention as `secrets.test.ts`).
**When to use:** D-02's boot-time hard-fail requirement.
**Example:**
```typescript
// Source: apps/api/src/core/config/secrets.ts (existing file, lines 1-78) — add alongside
// the existing JWT_SECRET/ENCRYPTION_KEY validators, following the identical shape.
export type DeploymentMode = 'cloud' | 'on-prem';

export function validateDeploymentModeValue(value: string | undefined): SecretValidationResult {
  if (!value) {
    return { valid: false, reason: 'DEPLOYMENT_MODE is unset or empty' };
  }
  if (value !== 'cloud' && value !== 'on-prem') {
    return { valid: false, reason: `DEPLOYMENT_MODE must be exactly "cloud" or "on-prem", got "${value}"` };
  }
  return { valid: true };
}

let cachedDeploymentMode: DeploymentMode | undefined;

/** Validated, cached read — computed once, read many times. Mirrors getJwtSecret()'s
 * lazy-but-validated shape, but additionally caches so later reads never re-derive from
 * process.env (D-02/DEP-02: "read once at API boot, not re-evaluated per request"). */
export function getDeploymentMode(): DeploymentMode {
  if (cachedDeploymentMode) return cachedDeploymentMode;
  const value = process.env.DEPLOYMENT_MODE;
  const result = validateDeploymentModeValue(value);
  if (!result.valid) {
    fail('DEPLOYMENT_MODE', result.reason ?? 'invalid value');
  }
  cachedDeploymentMode = value as DeploymentMode;
  return cachedDeploymentMode;
}

/** Boot-time gate — call once in bootstrap(), alongside validateSecretsOrExit(). */
export function validateDeploymentModeOrExit(): void {
  getDeploymentMode();
}
```
```typescript
// Source: apps/api/src/server.ts bootstrap() (existing, lines 72-97) — add one line
async function bootstrap() {
  try {
    validateSecretsOrExit();          // existing (SEC-01/SEC-02)
    validateDeploymentModeOrExit();   // NEW (DEP-02)
    await db.query("SELECT 1");
    // ...unchanged
```

### Pattern 4: Registration gate (D-04)
**What:** `authController.signup()` is a legacy (non-DDD) Express handler in `apps/api/src/controllers/authController.ts`. Its existing shape does `Missing required fields` (400) then `existing user` (409) checks before any DB write. Add the `DEPLOYMENT_MODE` check as the very first line of the handler, before those, per D-04 ("unconditional 403, no first-company state check").
**Example:**
```typescript
// Source: apps/api/src/controllers/authController.ts signup() (existing, starts line 13)
import { getDeploymentMode } from '../core/config/secrets';
// ...
export const signup = async (req: Request, res: Response) => {
  if (getDeploymentMode() === 'on-prem') {
    return res.status(403).json({ error: 'Registration is closed on this on-premise install' });
  }
  const client = await db.connect(); // use a transaction
  // ...rest unchanged
};
```
Note: `authController.ts` currently imports `getJwtSecret` from `'../core/config/secrets'` already
(line 8) — confirming the import path/module is already wired into this exact file, so adding
`getDeploymentMode` to the same import is a one-line addition, not a new import path to establish.

### Anti-Patterns to Avoid
- **Branching on `NODE_ENV` instead of `DEPLOYMENT_MODE`:** on-premise-deployment.md §4.2 and CLAUDE.md §2.1 are explicit — these are different axes; an on-prem install can run `NODE_ENV=production`. Never conflate them.
- **Re-reading `process.env.DEPLOYMENT_MODE` per-request:** violates success criterion 4 verbatim. Use the cached `getDeploymentMode()` (Pattern 3), not a raw `process.env` read scattered across files.
- **Giving all compose services `context: .`:** would work for the 3 frontends but pointlessly ships the entire monorepo into the API/matching-engine build contexts (slower builds, larger cache-busting surface) — keep contexts scoped per Pattern 2.
- **Leaving `${VAR:-default}` on `POSTGRES_PASSWORD`/`JWT_SECRET`/`ENCRYPTION_KEY` "just for prod convenience":** this is exactly the anti-pattern §3.1/§3.3 of `on-premise-deployment.md` already documents as a live, fixed vulnerability (Phase 14) — do not reintroduce a compose-level default for any of these three, or for the new `DEPLOYMENT_MODE`.
- **Building a second enforcement path for credit/registration-style gates:** not applicable to this phase's specific gates, but worth restating per project CLAUDE.md constraint — the 403 here is net-new gating (registration), not a duplicate of the existing over-limit-assignment 403 elsewhere in the codebase; don't conflate the two systems.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Required env var or fail" at the compose layer | A custom shell wrapper/entrypoint that greps `.env` | Compose's native `${VAR:?error message}` interpolation syntax | Built into Compose v2, zero extra code, fails before any container even starts |
| Boot-time app-level validation | A new validation framework/library | Extend the existing `secrets.ts` module (already hand-rolled, ~80 lines, proven pattern from Phase 14) | Consistency — this project already has exactly one validated place for this kind of check; don't fork a second mechanism |
| Sequencing migrate-then-serve | A custom process-supervisor/wait-for-it script | Either (a) the documented 2-step `docker compose run --rm api npm run migrate && docker compose up -d` from release-and-migrations.md §5, or (b) a short entrypoint shell script wrapping `npm run migrate && exec npm start` | Both are minimal; don't reach for a heavier orchestration tool (no need for an init system or wait-for-it library here) |

**Key insight:** This phase's entire "don't hand-roll" surface is about *not inventing new mechanisms* — every piece needed (compose var validation, boot-time fail-fast, endpoint gating) already has an established, minimal precedent in this exact repo. The discipline is reuse, not avoiding some external dependency.

## Common Pitfalls

### Pitfall 1: Building frontend images with the wrong context
**What goes wrong:** `docker build -f apps/workspaces/Dockerfile .` run from inside `apps/workspaces/` (or a compose `context: ./apps/workspaces`) fails at `COPY apps ./apps` / `COPY packages ./packages` — those paths don't exist relative to that context.
**Why it happens:** Natural instinct is "context = the app's own directory," which is correct for `api` and `matching-engine` but wrong for the three Next.js apps because of the monorepo workspace-package dependency.
**How to avoid:** Always set `context: .` (repo root) for `marketplace`/`workspaces`/`cmr`, `dockerfile: apps/<name>/Dockerfile`. Verified directly by reading each Dockerfile's own header comment and by `docs/DEPLOYMENT.md`'s documented build commands (all four use root-context invocations, differing only in the trailing context path — `.` for the three frontends, `./apps/api` for the API).
**Warning signs:** Build fails with "COPY failed: file not found" referencing `apps` or `packages` during the `deps` stage.

### Pitfall 2: Assuming Phase 15's migration runner already exists
**What goes wrong:** A plan/task that tries to `cat apps/api/src/scripts/migrate.ts` or run `npm run migrate` today (research/planning time) will find nothing — the file, the `apps/api/package.json` `migrate` script, and the root `package.json` passthrough do not exist in the repo as of this research (2026-07-12; STATE.md confirms Phase 15 is "Not started").
**Why it happens:** CONTEXT.md's phrasing ("Phase 15's migration runner... must be invoked") reads as already-built infrastructure to inspect, but it's a forward dependency, not a completed one.
**How to avoid:** Phase 16 planning should reference the *interface* Phase 15 commits to (per its own CONTEXT.md D-05: `npm run migrate` at repo root, delegating to `apps/api`'s own script) as a contract, and write compose/entrypoint wiring against that contract — not attempt to verify the runner's internals during Phase 16's own research/planning. If Phase 16 is executed before Phase 15 lands, this is a hard blocker (add a dependency check to the plan).
**Warning signs:** `npm run migrate` / `apps/api/src/scripts/` not found when Phase 16 execution begins — confirms Phase 15 must land first, not a Phase 16 defect.

### Pitfall 3: Forgetting `depends_on` health-gating for the new matching-engine dependency
**What goes wrong:** Dev compose already has `api` depend on `postgres`/`redis` with `condition: service_healthy`, but `matching-engine` only depends on `redis` (healthy) — it has no healthcheck of its own, and `api` doesn't `depends_on: matching-engine` at all today (dev compose confirmed: `api`'s `depends_on` block only lists `postgres`/`redis`). If `docker-compose.prod.yml` copies this shape unchanged, the `api` container can start and begin serving LTL-matching-dependent requests before `matching-engine` is ready, since there's no explicit ordering between them.
**Why it happens:** Copy-pasting the dev compose's `depends_on` block verbatim without noticing it never modeled the `api → matching-engine` runtime dependency that D-01 explicitly names (`MATCHING_ENGINE_URL`).
**How to avoid:** This is a real (pre-existing) gap, not one this phase is scoped to fully solve — `services/matching-engine/Dockerfile`/`main.py` has no documented `/health`-equivalent endpoint verified in this research (out of scope to add one here per D-01's "additive, not a scope violation" framing). Minimum safe move: add `depends_on: matching-engine` (a plain start-order dependency, without `condition: service_healthy` since no healthcheck exists) to `api` in the prod compose, and note in the plan that a proper healthcheck is a follow-up, not blocking this phase's success criteria.
**Warning signs:** LTL matching requests failing with connection-refused errors in the first few seconds after `docker compose up`, before matching-engine finishes uvicorn startup.

### Pitfall 4: `${VAR:?}` syntax works differently across Compose versions/shells
**What goes wrong:** The required-variable Compose syntax (`${VAR:?error}`) is a Compose-file interpolation feature (works the same regardless of host shell — Windows/PowerShell users don't need to worry about shell-specific behavior since Compose parses this itself, not the OS shell), but it's easy to accidentally write `${VAR:-}` (soft default to empty string) when meaning `${VAR:?message}` (hard fail) — the two differ by one character and have opposite security implications.
**Why it happens:** Dev compose already uses the `:-` syntax pervasively (`${POSTGRES_USER:-vectra_user}`) — copy-paste habit from adapting the dev file risks carrying the wrong operator over for secrets that must NOT have a prod fallback.
**How to avoid:** Explicit review pass on every env var in `docker-compose.prod.yml`: secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE`) must use `:?`; everything else may keep `:-default` or `:-` (empty) if genuinely optional.
**Warning signs:** `docker compose config` (which resolves interpolation without starting containers) silently substitutes an empty string for a secret instead of erroring — run this as a manual pre-flight check.

## Code Examples

See Architecture Patterns section above (Patterns 1-4) — all four are drawn from files read directly in this repo during research, not external sources, since this phase has no third-party library surface.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Dev compose bind-mounts source + `npm run dev` for all 5 app services | Prod compose builds standalone images from existing multi-stage Dockerfiles, no bind mounts, `npm start`/`node dist/server.js` | This phase | Matches success criterion 1 exactly |
| `docker-entrypoint-initdb.d` SQL mounts (fires once, only on empty volume, no tracking) | Phase 15's `schema_migrations`-tracked `npm run migrate`, invoked as an explicit compose step | Phase 15 → wired in Phase 16 | Enables real upgrades (MIG-02), not just fresh installs |
| No `DEPLOYMENT_MODE` concept anywhere in the codebase (confirmed: zero matches for the string in `apps/`/`packages/` today) | `DEPLOYMENT_MODE=cloud\|on-prem`, boot-validated, cached, read via `getDeploymentMode()` | This phase (net-new) | First concrete implementation of CLAUDE.md §2.1's mandated pattern |

**Deprecated/outdated:** N/A — no library versions or external tooling to deprecate; this is entirely first-party infra work.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended `restart: unless-stopped` (vs. dev's `restart: always`) for prod services is a reasonable default | Pattern 1 code example | Low — explicitly flagged in CONTEXT.md as Claude's Discretion, not a locked decision; planner/human can pick either with no correctness impact |
| A2 | Building an entrypoint shell script (Pattern 2's alternative) vs. the documented 2-step `run --rm ... && up -d` procedure — no locked decision on which the plan should implement | Standard Stack "Alternatives Considered"; Open Questions | Medium — affects task structure (new Dockerfile step vs. pure compose/doc change); does not affect correctness of either approach, but the planner must pick one explicitly since CONTEXT.md doesn't lock this |
| A3 | `matching-engine`'s FastAPI app has no `/health`-style endpoint (Pitfall 3) — inferred from the Dockerfile/CMD alone; `main.py`'s actual route table was not read in this research pass | Pitfall 3 | Low-Medium — if a health endpoint *does* exist, Pitfall 3's recommended mitigation (plain `depends_on` without health condition) is more conservative than necessary but still correct; if the planner wants a tighter health-gated dependency, `services/matching-engine/main.py` should be read directly before writing that task |

## Open Questions

1. **Should migrate-then-serve be a compose-level 2-step procedure or baked into the API image's entrypoint?**
   - What we know: `release-and-migrations.md` §5 documents the 2-step procedure (`docker compose run --rm api npm run migrate` then `docker compose up -d`) as the canonical operator-facing upgrade flow. This requires zero Dockerfile changes and matches the spec's literal wording.
   - What's unclear: Whether success criterion 1 ("`docker compose up` starts all four production app images... " — singular `up`, no separate migrate step mentioned) implies the *initial* `up` invocation itself must also run migrations automatically (e.g. via an entrypoint script), rather than requiring the two-step dance even on first install.
   - Recommendation: Treat the two-step procedure as satisfying the phase (it's what the canonical spec documents, and Phase 15's CONTEXT.md D-01 explicitly says the runner is "never auto-run inside `server.ts`'s `bootstrap()`" and is meant to be invoked as `docker compose run --rm api npm run migrate` before `up`) — the plan should have the human/planner confirm this reading against success criterion 1's literal wording before locking the task shape, since it's the one place phrasing could be read two ways.

2. **matching-engine health/readiness signal for `depends_on`**
   - What we know: `services/matching-engine/Dockerfile` has no `HEALTHCHECK` instruction; dev compose's `matching-engine` service has no `healthcheck:` block either.
   - What's unclear: Whether `services/matching-engine/main.py` (FastAPI) already exposes a trivial root/`/health` route that could be wired into a compose healthcheck cheaply, since this file wasn't read in this research pass (out of this phase's locked scope per D-01's "additive" framing).
   - Recommendation: Planner should do a quick read of `services/matching-engine/main.py`'s route table before deciding whether to add a `healthcheck:` block; if trivial (a bare FastAPI app almost always has at least the auto-generated `/docs`), a `curl`-based healthcheck costs one line and meaningfully improves Pitfall 3's mitigation. Not blocking — plain `depends_on` (no health condition) is an acceptable minimum for this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Compose v2 | Running/testing `docker-compose.prod.yml` | Not verified in this research session (no shell access to the target deploy host) | — | N/A — this is a hard requirement for the success criteria to be testable; assume available on any dev/CI machine that already runs the existing dev compose |
| `apps/api/src/scripts/migrate.ts` + `npm run migrate` (Phase 15 deliverable) | API service startup sequencing | ✗ (not yet built as of this research date) | — | None — hard dependency; Phase 16 execution must not begin before Phase 15 ships, per ROADMAP's stated phase dependency |

**Missing dependencies with no fallback:**
- Phase 15's migration runner — Phase 16 cannot be executed (only planned) until Phase 15 lands.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (via `ts-node/register`), per `apps/api/package.json`'s `"test"` script — confirmed as the project's only test runner (`secrets.test.ts` already uses bare `test(...)` from `node:test` implicitly) |
| Config file | none — `"test": "node --require ts-node/register --test src/**/*.test.ts"` in `apps/api/package.json` |
| Quick run command | `npm test --workspace @vectra/api` (or `cd apps/api && npm test`) |
| Full suite command | same — no separate "full" vs "quick" tiering exists in this project today |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-01 | `docker-compose.prod.yml` has no `ports:` on postgres/redis, no committed secret defaults, all 5 services present | manual / compose-config check | `docker compose -f docker-compose.prod.yml config` (verifies interpolation resolves/fails as expected — not a `node --test` unit test) | ❌ Wave 0 — this is inherently a compose-file structural check, not unit-testable |
| DEP-02 (validation) | `validateDeploymentModeValue()` rejects unset/invalid, accepts `cloud`/`on-prem` | unit | `node --require ts-node/register --test src/core/config/secrets.test.ts` (extend existing file with `DEPLOYMENT_MODE` cases, mirroring the existing JWT_SECRET/ENCRYPTION_KEY test shape) | ❌ Wave 0 — extend existing `secrets.test.ts`, don't create a new file |
| DEP-02 (registration gate) | `signup()` returns 403 when `DEPLOYMENT_MODE=on-prem`, unchanged behavior when `cloud` | unit/integration | New test file or extend an existing `authController` test (none currently exists — confirmed no `authController.test.ts` in the repo) | ❌ Wave 0 — no existing authController test file to extend; net-new |
| DEP-02 (read-once/cached) | `getDeploymentMode()` only reads `process.env` once per process lifetime | unit | Test that mutating `process.env.DEPLOYMENT_MODE` after first call doesn't change the cached return value | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && npm test` (fast, `node --test` has no meaningful startup cost)
- **Per wave merge:** same command — no tiered suite exists in this project
- **Phase gate:** `npm test` green + manual `docker compose -f docker-compose.prod.yml config` sanity check (compose file structure can't be unit-tested without a live Docker daemon, which may not be available in the execution sandbox — flag as human-verify if so)

### Wave 0 Gaps
- [ ] `apps/api/src/core/config/secrets.test.ts` — extend with `DEPLOYMENT_MODE` cases (file exists, needs new `test(...)` blocks, not a new file)
- [ ] `apps/api/src/controllers/authController.test.ts` — does not exist; new file needed to cover the 403 gate, OR cover it via a lighter-weight approach if the project has no existing pattern for testing Express controllers directly (no prior `*Controller.test.ts` file found in the repo — confirm approach with planner before committing to a test shape)
- [ ] Framework install: none — `node --test` + `ts-node/register` already present in `apps/api/devDependencies`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Indirect (yes) | No change to JWT mechanism itself; this phase only gates the registration *endpoint*, not authentication flow — existing `jsonwebtoken` + `bcrypt` usage untouched |
| V3 Session Management | no | Unaffected — no session/cookie logic touched by this phase |
| V4 Access Control | yes | The `DEPLOYMENT_MODE`-gated 403 on `/signup` is itself an access-control decision; must be unconditional (no bypass via request params) per D-04 |
| V5 Input Validation | Indirect (yes) | `DEPLOYMENT_MODE` value validation (`cloud`/`on-prem` exact match, reject anything else) is itself an input-validation control on a trusted (env, not user) input surface |
| V6 Cryptography | no | Unaffected — this phase does not touch `secretBox.ts`/`ENCRYPTION_KEY` usage, only reuses the existing validation *pattern* |
| V14 Configuration | yes | `docker-compose.prod.yml`'s "no committed secret defaults" requirement (success criterion 2) is squarely an ASVS V14 configuration-hardening control |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Shared/default secret across all installs (already identified and being fixed for JWT_SECRET/ENCRYPTION_KEY in Phase 14; this phase must not regress it for `POSTGRES_PASSWORD`/`DEPLOYMENT_MODE`) | Tampering / Information Disclosure | `${VAR:?}` required-var compose syntax + app-level `validateSecretsOrExit()`/`validateDeploymentModeOrExit()` fail-fast (Pattern 1, Pattern 3) |
| Postgres/Redis reachable from outside the docker network in prod (dev compose exposes `5433`/`6380` to host) | Elevation of Privilege / Information Disclosure | D-03: no `ports:` mapping in prod compose — internal-network-only access |
| Registration bypass on on-prem installs (a public `/signup` on a customer's "single company" box would let anyone create additional companies/admins) | Elevation of Privilege | D-04's unconditional 403 when `DEPLOYMENT_MODE=on-prem` |

## Sources

### Primary (HIGH confidence — files read directly in this repo)
- `docker-compose.yml` (repo root) — full read, service shapes for postgres/redis/api/matching-engine/3 frontends
- `apps/api/Dockerfile`, `apps/marketplace/Dockerfile`, `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile`, `services/matching-engine/Dockerfile` — full read
- `apps/api/src/server.ts` — full read (bootstrap sequence, existing `validateSecretsOrExit()` call site)
- `apps/api/src/core/config/secrets.ts` — full read (exact validator/fail pattern to replicate)
- `apps/api/src/controllers/authController.ts` — full read (`signup()` exact current shape, existing `getJwtSecret` import)
- `apps/api/src/routes/authRoutes.ts` — full read (route registration, confirms line 7)
- `apps/api/package.json` — full read (no `migrate` script exists yet, `test` script shape)
- `.env.example` — full read (no `DEPLOYMENT_MODE` var present yet; confirms `.env` needs a new entry)
- `docs/DEPLOYMENT.md` (partial grep) — confirmed documented build commands/contexts for all 4 web-app images
- `.planning/phases/15-migration-runner/15-CONTEXT.md` — full read (confirms exact `npm run migrate` contract Phase 16 must wire against, and confirms it does not exist yet)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — full read

### Secondary (MEDIUM confidence — project specs, treated as authoritative design docs per instructions, not independently re-verified against external sources)
- `docs/specs/deployment/on-premise-deployment.md` — full read (§4.1/§4.2 primary spec for this phase)
- `docs/specs/architecture-steering.md` (CLAUDE.md) — full read (§2.1/§2.2 mandated pattern)
- `docs/specs/deployment/cloud-deployment.md` — full read (§3.5, §6 context)
- `docs/specs/deployment/release-and-migrations.md` — full read (§1, §4, §5 upgrade procedure)

### Tertiary (LOW confidence)
- None — no WebSearch/external-library research was needed for this phase; everything required was verifiable directly in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every artifact referenced was read and confirmed to exist
- Architecture: HIGH — compose/Dockerfile shapes confirmed by direct file reads; the one uncertainty (Pitfall 3/Open Question 2, matching-engine health signal) is explicitly flagged, not asserted
- Pitfalls: HIGH for Pitfalls 1, 2, 4 (directly observed in repo); MEDIUM for Pitfall 3 (matching-engine's own `main.py` route table not read this session)

**Research date:** 2026-07-12
**Valid until:** 30 days (stable infra-only phase; re-verify if Phase 15 lands with a different `migrate` script contract than its own CONTEXT.md currently specifies)
