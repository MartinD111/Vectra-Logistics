# Phase 20: Deploy Hardening + Connectivity Doc - Research

**Researched:** 2026-07-13
**Domain:** Express.js API hardening (CORS allowlisting, rate limiting, dependency-aware health checks) + operator documentation
**Confidence:** HIGH

## Summary

This phase closes three concrete, narrow gaps in `apps/api/src/server.ts` (CORS/Socket.IO wide-open origins, no auth rate limiting, a `/health` that never checks its dependencies) and adds one documentation section. None of the three code changes touch schema, business logic, or existing request/response contracts beyond `/health`'s JSON body (which is additive per D-03). All three follow patterns already established in this codebase: `secrets.ts`'s "pure validator + thin wrapper, lazy-read after `dotenv.config()`" module shape, the `AppError`/`errorHandler` `{ error: message }` JSON convention, and `node --test` colocated `*.test.ts` files.

The only new runtime dependency is `express-rate-limit` (npm, current `8.5.2`, `[OK]` per slopcheck and npm registry — peer dep `express >= 4.11` satisfied by installed `express@4.22.2`, engine `node >= 16` satisfied). `cors` and `socket.io` (both already installed: `cors@2.8.6`, `socket.io@4.8.3`) already support function/array-based origin allowlisting natively — no new package needed for HRD-01.

A live `server.health.test.ts` already exists (added Phase 19) and asserts `status`/`version` on a 200 response, using an `app` imported directly from `server.ts` **without calling `bootstrap()`** — meaning `db`/`redisClient` are never `.connect()`-ed in that test process. This is a real pitfall for HRD-03: the new dependency-check logic must be exercised by a test that either mocks/stubs the DB/Redis calls or explicitly connects them, and the existing test must be updated to match the new response shape (`dependencies` field) without breaking on an unconnected pool/client in CI.

**Primary recommendation:** Add a new `apps/api/src/core/config/cors.ts` module (mirrors `secrets.ts`'s style) exporting `getAllowedOrigins()`, sourced from a new `CORS_ALLOWED_ORIGINS` env var (comma-separated) with a computed fallback from the existing `NEXT_PUBLIC_MARKETPLACE_URL`/`NEXT_PUBLIC_WORKSPACES_URL`/`NEXT_PUBLIC_CMR_URL` vars so zero-config dev/docker-compose keeps working; wire both `cors()` and the Socket.IO `cors.origin` option to this one function. Install `express-rate-limit@^8.5.2`, apply to all 5 `/api/auth/*` routes (spec says "at minimum" login+signup; the other 3 are equally abuse-prone and the marginal cost of covering all 5 is zero), custom `handler` returning `{ error: '...' }` matching the `AppError` JSON shape. Add a small `apps/api/src/core/health/health.service.ts` (or extend `/health` inline — see Common Pitfalls for the tradeoff) performing `db.query('SELECT 1')` and `redisClient.ping()` per request with no caching, per D-01/D-02/D-03.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CORS origin allowlist (HTTP) | API / Backend | — | `server.ts` is the single Express entry point; origin check must happen before any route handler runs |
| Socket.IO origin allowlist | API / Backend | — | Same process, same `server.ts`; Socket.IO's own `cors` option is independent of Express `cors()` middleware and must be configured separately even though it shares the same allowlist source |
| Auth rate limiting | API / Backend | — | `express-rate-limit` is Express middleware scoped to `authRoutes.ts`; no client or CDN-tier involvement needed for a single-instance on-prem/cloud API |
| Health/readiness check | API / Backend | Database / Storage (queried, not owning) | The endpoint lives in the API tier but its correctness depends on live Postgres/Redis reachability — API tier owns the check logic, DB/Redis tier is what's being probed |
| Connectivity doc | N/A (documentation) | — | Pure documentation artifact (`docs/DEPLOYMENT.md`); no runtime tier |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**Health check depth & failure semantics**
- **D-01:** Single `/health` endpoint (no separate `/ready`) does a live check on every request — `SELECT 1` against Postgres and a Redis `PING`, no caching/staleness window. The spec (`cloud-deployment.md` §3.3) treats `/health` and a separate `/ready` as equivalent options; keeping one endpoint avoids a new route and matches what Phase 19 already extended with `version`.
- **D-02:** No caching of the health-check result — every request re-checks. Rationale: `SELECT 1`/`PING` are sub-millisecond on a healthy connection, and health probes are typically low-frequency (every 5-30s from a load balancer/orchestrator), so a staleness window buys nothing and adds a bug surface.
- **D-03:** On failure, respond `503` with a per-dependency breakdown: `{status: "unhealthy", version, dependencies: {postgres: "ok"|"down", redis: "ok"|"down"}}`. On success: `{status: "OK", version, dependencies: {postgres: "ok", redis: "ok"}}` (keep the `version` field from Phase 19; keep `status: "OK"` wording for the healthy case for backward compatibility with anything already parsing it, add `dependencies` as new information rather than replacing the existing shape).

**Connectivity doc placement & scope**
- **D-04:** The §7 reverse-proxy posture (only `/api/webhooks/*` and `/api/pod/*` need inbound exposure) goes into a new section in `docs/DEPLOYMENT.md`, not a standalone file. `DEPLOYMENT.md` is already the single operator-facing deploy doc (production images, upgrade procedure from Phase 19) — a customer setting up a reverse proxy is doing so as part of deployment, so one doc to read end-to-end beats a second file to discover.
- **D-05 (scope confirmation):** The Socket.IO Redis-adapter gap (`cloud-deployment.md` §3.4 — realtime doesn't fan out across multiple API instances) is explicitly confirmed OUT of scope for this phase. It is not named in HRD-01/02/03/DOC-01 and is a Cloud-priority horizontal-scaling concern, unrelated to CORS/rate-limit/health/connectivity-doc. Do not touch Socket.IO's adapter wiring.

### Claude's Discretion

- **CORS/Socket.IO origin source (HRD-01)** — not discussed in this session. Known constraints from scouting: `.env.example` already has `NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL` (the three frontend origins); the spec (`cloud-deployment.md` §3.1) says the allowlist must be "sourced from env so On-Premise installs can still set their own allowed origin(s) without a code change" — researcher/planner should decide whether to reuse the existing `NEXT_PUBLIC_*_URL` vars directly or introduce a dedicated `CORS_ALLOWED_ORIGINS` var, and whether `app.use(cors())` (line 37) and the Socket.IO `cors: { origin: "*" }` (lines 30-35) in `apps/api/src/server.ts` share one origin-list implementation or two. **Research recommendation: see Architecture Patterns § Pattern 1 below.**
- **Rate-limit scope & thresholds (HRD-02)** — not discussed in this session. Known constraints: `apps/api/src/routes/authRoutes.ts` has 5 routes (`signup`, `login`, `verify-email`, `forgot-password`, `reset-password`); the spec names `login`+`signup` specifically as credential-stuffing/spam targets but says "at minimum," implying all 5 is also acceptable. No `express-rate-limit` (or equivalent) is currently installed in `apps/api`. Researcher/planner should pick the package, scope (2 routes vs all 5), limit/window values, and 429 response shape. **Research recommendation: see Standard Stack and Architecture Patterns § Pattern 2 below.**
- Exact code structure for the health-check module (inline in `server.ts`'s `/health` handler vs. a small `health.ts`/`config` module) is Claude's call — no existing pattern to reuse beyond Phase 14/16's boot-time `secrets.ts` fail-fast style, which is boot-time not request-time and not directly analogous. **Research recommendation: see Common Pitfalls § Pitfall 3 and Architecture Patterns § Pattern 3 below.**
- Exact wording/structure of the new `docs/DEPLOYMENT.md` connectivity section — must cover: telematics webhooks need inbound reachability (Samsara/Geotab push GPS events, HMAC-verified), `/api/pod/*` is deliberately public (driver phone links, often from the road), Outlook OAuth callback needs to resolve for the admin's network context at setup time — and the recommended posture (reverse proxy exposing only `/api/webhooks/*` + `/api/pod/*` publicly, everything else LAN/VPN-only). Exact prose/structure is Claude's call; content must match `docs/specs/deployment/on-premise-deployment.md` §7.

### Deferred Ideas (OUT OF SCOPE)

- Socket.IO Redis-adapter / horizontal-scaling fix (`cloud-deployment.md` §3.4) — explicitly confirmed out of scope (D-05). Not this phase, not currently assigned to any phase; would need its own future phase if/when Cloud needs multiple API replicas.

</user_constraints>

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| HRD-01 | CORS + Socket.IO origins restricted to env-configured app origins (not `*`) | `cors` package's function/array `origin` option + Socket.IO's native `cors.origin` array support; single shared `getAllowedOrigins()` helper (Pattern 1) |
| HRD-02 | Rate limiting on `/api/auth/*` at minimum | `express-rate-limit@8.5.2` (verified npm + slopcheck `[OK]`); scope, thresholds, and 429 shape recommended in Pattern 2 |
| HRD-03 | `/health` (or `/ready`) actually verifies Postgres + Redis reachability | Reuse existing `db` (`pg.Pool`) and `redisClient` (`redis` v4 client) instances already imported in `server.ts`; `Promise.allSettled` pattern in Pattern 3; test-isolation pitfall documented (Pitfall 1) |
| DOC-01 | Customer-facing doc of the inbound-connectivity posture | `on-premise-deployment.md` §7 content mapped directly to a new `docs/DEPLOYMENT.md` section (Code Examples § Connectivity doc outline) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No ORM**: this phase makes no schema changes, so the SQL-migration convention does not apply — confirmed, no `database/migrations/` file is needed for HRD-01/02/03/DOC-01.
- **Existing 403 behavior**: not directly relevant to this phase (that constraint targets the credit-limit dispatcher block, a CRM feature, not deploy hardening) — noted only to confirm no conflict.
- **Naming conventions**: any new module must follow `[domain].service.ts` / `[domain].ts` conventions already used in `core/config/` (e.g. `secrets.ts`, `version.ts`) — applies directly to the new CORS-origin helper and health-check module.
- **Error handling**: `AppError` + `errorHandler` convention (`{ error: message }` JSON, `asyncHandler` wrapper for async routes) — the 429 response and the `/health` 503 response should stay consistent with this shape where practical (see Pitfall 2 for why `express-rate-limit`'s handler can't literally `throw new AppError` and must send JSON directly instead).
- **Logging**: `console.error`/`console.log` with context prefixes, no external secrets in logs — applies to health-check failure logging (log which dependency failed, not connection strings).
- **TypeScript strict mode**: all new code must be fully typed, no `any`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express-rate-limit` | `8.5.2` [VERIFIED: npm registry — `npm view express-rate-limit version` → `8.5.2`] | Per-route request throttling for `/api/auth/*` | The de-facto standard Express rate-limiting middleware; actively maintained, zero-dependency, supports custom `handler`/`keyGenerator`, works as in-memory store out of the box (no Redis store required for a single-instance API) |

No new package is needed for CORS/Socket.IO origin restriction (HRD-01) — `cors@2.8.6` and `socket.io@4.8.3` are already installed and both natively support origin allowlisting (function-based for `cors`, array-based for Socket.IO).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | — | — | This phase needs no additional supporting packages beyond `express-rate-limit` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `express-rate-limit` (in-memory store) | `rate-limiter-flexible` | More flexible (supports Redis/Postgres-backed distributed limiting out of the box), but this API runs as a single instance today (Socket.IO has no Redis adapter — D-05 confirms multi-instance scaling is explicitly out of scope this phase); in-memory `express-rate-limit` is simpler and sufficient. Revisit if/when SCALE-01 (Socket.IO Redis adapter, v2 requirement) ships and the API goes multi-replica, since in-memory rate limits don't share state across processes. |
| Custom origin-check middleware (hand-rolled) | `cors` package's `origin` function option | `cors` already handles preflight `OPTIONS`, `Vary: Origin` header, and credentialed-request edge cases correctly; hand-rolling origin matching risks missing these (see Don't Hand-Roll below) |

**Installation:**
```bash
npm install express-rate-limit --workspace=apps/api
```

**Version verification:** `npm view express-rate-limit version` → `8.5.2` (checked 2026-07-13). `npm view express-rate-limit peerDependencies` → `{ express: '>= 4.11' }` — satisfied by installed `express@4.22.2`. `npm view express-rate-limit engines` → `{ node: '>= 16' }` — satisfied (repo targets Node 18+).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `express-rate-limit` | npm | Long-established (originally published ~2015, current major v8 actively maintained) [CITED: npm registry repository field] | High (widely used Express middleware; exact weekly download figure not queried, but is the top result for "express rate limit" and has 8 major versions of sustained maintenance) | `github.com/express-rate-limit/express-rate-limit` [VERIFIED: `npm view express-rate-limit repository.url`] | `[OK]` [VERIFIED: `python -m slopcheck install express-rate-limit` → `[OK] express-rate-limit (npm)` — registry-check passed; note the same invocation then attempted an actual `npm install` which failed locally with a Windows subprocess `FileNotFoundError` unrelated to package legitimacy — confirmed via `git status` that no `package.json`/lockfile changes occurred] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No `postinstall` script check was needed — `npm view express-rate-limit scripts.postinstall` was not run since the package has no native bindings and is a pure-JS middleware library; standard practice for this class of package is low-risk, but the planner may run `npm view express-rate-limit scripts.postinstall` as a zero-cost extra check before install if desired.

## Architecture Patterns

### System Architecture Diagram

```
Browser/Client (3 origins: Marketplace/Workspaces/CMR)
        │  HTTP request with Origin header
        ▼
┌─────────────────────────────────────────────────────────┐
│  apps/api/src/server.ts                                 │
│                                                           │
│  1. cors() middleware ──── getAllowedOrigins() ─────┐   │
│     reject if Origin not in allowlist               │   │
│                                                       │   │
│  2. express-rate-limit ──── applied only to           │   │
│     /api/auth/* routes                                │   │
│     429 if over threshold                             │   │
│                                                       ▼   │
│  3. Route handlers (authRoutes, domainRouter, etc.)      │
│                                                            │
│  Separately: Socket.IO Server ── cors.origin ─────────────┤
│     same getAllowedOrigins() source                      │
│                                                            │
│  GET /health ── on each request ──────────────────────┐  │
│     Promise.allSettled([db.query('SELECT 1'),          │  │
│                          redisClient.ping()])           │  │
│     200 {status:OK, dependencies:{postgres:ok,redis:ok}}│  │
│     503 {status:unhealthy, dependencies:{...down...}}   │  │
└────────────────────────────────────────────────────────┘  │
        │                                                     │
        ▼                                                     ▼
   PostgreSQL (Pool)                                    Redis (client v4)
   apps/api/src/core/db/index.ts                        apps/api/src/core/db/redis.ts
```

### Recommended Project Structure

```
apps/api/src/core/
├── config/
│   ├── cors.ts          # NEW — getAllowedOrigins(), mirrors secrets.ts style
│   ├── secrets.ts        # existing — pattern precedent
│   └── version.ts        # existing
├── health/
│   └── health.service.ts # NEW — checkDependencyHealth(), pure & testable
├── db/
│   ├── index.ts           # existing — db (pg.Pool), reused as-is
│   └── redis.ts           # existing — redisClient (redis v4), reused as-is
└── errors/
    └── AppError.ts         # existing — 429/503 JSON shape reference
```

### Pattern 1: Shared origin-allowlist helper for CORS + Socket.IO (HRD-01)

**What:** One pure function, `getAllowedOrigins(): string[]`, in a new `apps/api/src/core/config/cors.ts` module, consumed by both `app.use(cors({ origin: ... }))` and the Socket.IO `cors: { origin: ... }` option.

**Recommendation — exact source:** Introduce a dedicated `CORS_ALLOWED_ORIGINS` env var (comma-separated list), because:
- The spec text (`cloud-deployment.md` §3.1) explicitly frames this as "sourced from env so On-Premise installs can still set their own allowed origin(s) *without a code change*" — a dedicated var makes that literal: an operator can add a staging domain, a reverse-proxy hostname, or drop an app they don't run, independent of what the `NEXT_PUBLIC_*_URL` vars say.
- `NEXT_PUBLIC_*_URL` vars are semantically "where the frontend tells itself to link to" (cross-app navigation), not "what origins are allowed to call the API" — today they happen to coincide, but conflating the two means a future change to one silently changes the other.
- **However**, to avoid forcing every existing install (dev, docker-compose, anyone who already deployed Phase 16-19) to set a brand-new var just to keep working, default `CORS_ALLOWED_ORIGINS` (when unset) to a computed list built from the three existing `NEXT_PUBLIC_MARKETPLACE_URL`/`NEXT_PUBLIC_WORKSPACES_URL`/`NEXT_PUBLIC_CMR_URL` vars (filtering out any that are unset). This keeps zero-config dev/docker-compose behavior identical to today while giving production operators an explicit override path.

**When to use:** Both origin checks (Express CORS + Socket.IO) must consume the exact same list — do not let them drift.

**Example:**
```typescript
// apps/api/src/core/config/cors.ts
// Source: pattern precedent from core/config/secrets.ts (pure validator + lazy env read)

/**
 * Returns the list of allowed CORS/Socket.IO origins.
 * Primary source: CORS_ALLOWED_ORIGINS (comma-separated, e.g.
 *   "https://app.vectra.app,https://cmr.vectra.app").
 * Fallback (when unset): derived from the existing NEXT_PUBLIC_*_URL vars,
 * so dev/docker-compose keeps working with zero new config.
 */
export function getAllowedOrigins(): string[] {
  const explicit = process.env.CORS_ALLOWED_ORIGINS;
  if (explicit && explicit.trim().length > 0) {
    return explicit.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return [
    process.env.NEXT_PUBLIC_MARKETPLACE_URL,
    process.env.NEXT_PUBLIC_WORKSPACES_URL,
    process.env.NEXT_PUBLIC_CMR_URL,
  ].filter((v): v is string => Boolean(v));
}
```

```typescript
// apps/api/src/server.ts — Express CORS (source: cors npm docs, function-based origin)
import { getAllowedOrigins } from "./core/config/cors";

app.use(cors({
  origin: (origin, callback) => {
    const allowed = getAllowedOrigins();
    // no Origin header = same-origin/non-browser request (curl, health checks,
    // server-to-server) — allow; cors() only ever runs for cross-origin browser calls anyway.
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));
```

```typescript
// apps/api/src/server.ts — Socket.IO (Socket.IO's cors.origin accepts a string[] directly)
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST"],
  },
});
```

**Note on evaluation timing:** Socket.IO's `cors.origin` is read once at `new Server()` construction time (module load), while the Express `origin` callback re-evaluates `getAllowedOrigins()` per-request. Since `.env` doesn't change at runtime in this codebase (same `dotenv.config()`-once pattern as `secrets.ts`), this asymmetry is harmless — but call `getAllowedOrigins()` once and pass the resolved array to both, rather than relying on the Express callback re-invoking a slightly different code path, to guarantee they can never drift apart within one process lifetime.

### Pattern 2: express-rate-limit scoped to all 5 auth routes (HRD-02)

**What:** A single `express-rate-limit` instance applied as router-level middleware in `authRoutes.ts`, ahead of all 5 route handlers.

**Recommendation — scope:** All 5 routes (`signup`, `login`, `verify-email`, `forgot-password`, `reset-password`), not just login+signup. The spec says login+signup "at minimum" — `verify-email`, `forgot-password`, and `reset-password` are equally abuse-prone (token/OTP brute-forcing, email-bombing a victim's inbox via repeated forgot-password triggers) and applying one shared limiter to the whole router costs nothing extra in code complexity.

**Recommendation — thresholds:** `windowMs: 15 * 60 * 1000` (15 minutes), `limit: 20` requests per window per IP. Rationale: a legitimate user might mistype a password 3-5 times or retry a flaky network request; 20/15min gives generous headroom for real users while still capping credential-stuffing/spam scripts to ~1.3 requests/minute sustained — far below what makes brute-forcing or signup-spam economically practical. This is a starting point, not a hard requirement from any spec — flag as `[ASSUMED]`, tune post-launch if telemetry shows false positives or insufficient throttling.

**Recommendation — 429 shape:** Match the existing `AppError`/`errorHandler` `{ error: message }` JSON convention directly in the limiter's `handler` option (cannot literally throw `AppError` here — see Pitfall 2 for why).

**Example:**
```typescript
// apps/api/src/routes/authRoutes.ts
// Source: express-rate-limit npm docs (https://express-rate-limit.mintlify.app/reference/configuration)
import rateLimit from 'express-rate-limit';

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,                 // 20 requests per IP per window
  standardHeaders: 'draft-8', // RateLimit-* headers per current IETF draft
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});

router.use(authRateLimiter);

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, getMe); // GET /me is not a mutation/abuse target — left unlimited, or apply router.use() after this line if excluding it is preferred
```

**Note:** placing `router.use(authRateLimiter)` before `getMe` also rate-limits `GET /me` (a low-risk, frequently-polled endpoint for session validation per `docs/DEPLOYMENT.md`'s "each app calls `GET /api/auth/me` on load"). To avoid throttling normal session checks, apply the limiter to the 5 POST routes individually (or via a sub-router) rather than blanket `router.use()`. Planner should structure this as 5 explicit `router.post(path, authRateLimiter, handler)` calls, or split into two routers (mutating vs. `/me`), to keep `/me` unlimited while covering the 5 requirement-relevant routes.

### Pattern 3: Request-time dependency health check, separate module (HRD-03)

**What:** A small `apps/api/src/core/health/health.service.ts` module exporting a pure, testable `checkDependencyHealth()` function that the `/health` route handler calls.

**Recommendation — inline vs. module: use a separate module.** Rationale:
- Matches the established `[domain].service.ts` naming/placement convention (CLAUDE.md Domain Organization) — `server.ts` today only wires routes and middleware; it does not contain business logic for any other route (auth logic lives in `authController.ts`, not inline in `server.ts`).
- Testability: `server.health.test.ts` already exists and spins up the real `app` without calling `bootstrap()`. A separate, pure `checkDependencyHealth(db, redisClient)` function (dependency-injected, not reading module-level singletons directly) can be unit-tested with mock/stub clients, independent of whether a real Postgres/Redis is reachable in CI — directly avoiding Pitfall 1 below.
- Explicitly note the difference from `secrets.ts`'s boot-time style per the phase's own Claude's-Discretion callout: `secrets.ts` fails fast and calls `process.exit(1)` before the server starts; this new module runs per-request and must never call `process.exit()` — it returns a result object that the route handler turns into a 200/503 response.

**Example:**
```typescript
// apps/api/src/core/health/health.service.ts
// Source: pattern precedent from core/config/secrets.ts (pure function, DI-friendly),
// D-01/D-02/D-03 in 20-CONTEXT.md for exact response shape

export interface DependencyHealth {
  postgres: 'ok' | 'down';
  redis: 'ok' | 'down';
}

export interface HealthCheckDeps {
  queryPostgres: () => Promise<unknown>;
  pingRedis: () => Promise<unknown>;
}

/** Pure, DI-friendly dependency check — no module-level singleton access, safe to unit test. */
export async function checkDependencyHealth(deps: HealthCheckDeps): Promise<DependencyHealth> {
  const [pgResult, redisResult] = await Promise.allSettled([
    deps.queryPostgres(),
    deps.pingRedis(),
  ]);
  return {
    postgres: pgResult.status === 'fulfilled' ? 'ok' : 'down',
    redis: redisResult.status === 'fulfilled' ? 'ok' : 'down',
  };
}
```

```typescript
// apps/api/src/server.ts
import { checkDependencyHealth } from "./core/health/health.service";

app.get("/health", async (req, res) => {
  const dependencies = await checkDependencyHealth({
    queryPostgres: () => db.query("SELECT 1"),
    pingRedis: () => redisClient.ping(),
  });
  const allOk = dependencies.postgres === "ok" && dependencies.redis === "ok";
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "OK" : "unhealthy",
    version: getVersion(),
    dependencies,
  });
});
```

### Anti-Patterns to Avoid

- **Hand-rolled `Origin` header string comparison** instead of the `cors` package's `origin` function — misses `OPTIONS` preflight handling, `Vary: Origin` header, and credentialed-request nuances the library already solves.
- **Caching the health check result** (e.g., a 5-second in-memory cache) — explicitly rejected by D-02; adds a staleness bug surface for no measured benefit at typical health-probe polling frequency.
- **Calling `process.exit()` from the health-check module** — this is request-time code (D-01 note), not boot-time; a bad DB connection must return 503, not crash the process.
- **Reading `db`/`redisClient` as module-level singletons directly inside `checkDependencyHealth`** — makes the function untestable without a live DB/Redis; inject as parameters instead (Pattern 3 example).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS origin validation, preflight handling | Custom `Origin` header middleware | `cors` package's `origin` function/array option (already installed) | Handles `OPTIONS` preflight, `Vary` header, credentialed-request edge cases correctly; a hand-rolled check is easy to get subtly wrong (e.g. forgetting `OPTIONS` short-circuit) |
| Per-IP request counting/throttling | Custom in-memory counter + timer | `express-rate-limit` | Handles proxy `X-Forwarded-For` trust configuration, sliding/fixed window algorithms, standard `RateLimit-*` response headers, and edge cases (IPv6 normalization) that a hand-rolled counter would miss |

**Key insight:** both HRD-01 and HRD-02 are "well-solved problems" in the Express ecosystem — the risk in hand-rolling either is not effort, it's silently missing an edge case (preflight requests, IPv6 proxy headers) that only surfaces in production under real traffic patterns.

## Common Pitfalls

### Pitfall 1: `/health` test doesn't call `bootstrap()` — DB/Redis clients are never connected in test process
**What goes wrong:** `apps/api/src/server.health.test.ts` imports `{ app }` from `./server` directly and starts an `http.createServer(app)` without ever calling `bootstrap()` (which is gated behind `if (require.main === module)`). This means the module-level `db` (`pg.Pool`) has never had a client checked out, and `redisClient` (`redis` v4) has never had `.connect()` called. A `pg.Pool.query()` call will lazily open a connection on first use (this generally still works if Postgres is reachable at the configured `DATABASE_URL`), but `redisClient.ping()` on an unconnected `redis` v4 client **throws** (`ClientClosedError` or similar) rather than lazily connecting — v4's `createClient()` requires an explicit `.connect()` before any command.
**Why it happens:** `bootstrap()`'s `redisClient.connect()` call is the only place in the codebase that connects Redis; test files that import `app` directly bypass it.
**How to avoid:** In the updated `checkDependencyHealth`-based test, either (a) connect a real Redis/Postgres in the test (if a test DB/Redis is available in CI — check `Environment Availability` below), or (b) unit-test `checkDependencyHealth()` in isolation with mock `queryPostgres`/`pingRedis` functions (Pattern 3's DI design exists specifically to make this possible), and separately keep a lighter integration-style test for the route wiring that tolerates either outcome. Do NOT assume the existing `server.health.test.ts` will keep passing unmodified — it currently only asserts `status`/`version` on a 200, and once `/health` calls `redisClient.ping()` on an unconnected client, that test will likely fail or hang unless updated.
**Warning signs:** `redisClient.ping()` throwing `ClientClosedError`, or the health test hanging/timing out in CI.

### Pitfall 2: `express-rate-limit`'s `handler` can't `throw new AppError` — it must send the response itself
**What goes wrong:** The project's convention is to `throw new AppError(status, message)` and let the global `errorHandler` middleware serialize it. `express-rate-limit`'s `handler` callback, however, is invoked directly by the middleware when the limit is exceeded — it is not wrapped in `asyncHandler`, and throwing inside it does not automatically flow to Express's error-handling middleware chain in the same way a route handler's rejected promise does.
**Why it happens:** `express-rate-limit` predates/doesn't integrate with this project's specific `AppError` pattern; its `handler` option's documented contract is "respond to the request yourself" (`res.status(...).json(...)`), not "throw and let something else respond."
**How to avoid:** Send the response directly in `handler`, keeping the JSON body shape (`{ error: message }`) consistent with what `errorHandler` produces for other `AppError`s, even though the code path bypasses `errorHandler` itself. Document this as an intentional, narrow exception to the `AppError` convention in a code comment.
**Warning signs:** A 429 response with a different JSON shape than the rest of the API's errors (e.g. `express-rate-limit`'s own default `message` string instead of `{ error: ... }`), or a request hanging because `handler` both throws and never calls `res.send()`.

### Pitfall 3: Socket.IO's CORS config is independent of Express's `cors()` middleware
**What goes wrong:** Fixing `app.use(cors())` alone (HTTP routes) does not restrict Socket.IO's WebSocket/polling handshake — that's a separate `cors` option passed to `new Server(server, { cors: {...} })` at construction time. Missing this means HRD-01 looks "done" (curl/browser testing against REST routes correctly rejects bad origins) while the WebSocket handshake still accepts any origin.
**Why it happens:** Both libraries happen to use a `cors` option name, but they're two independent configuration surfaces, easy to fix one and forget the other exists.
**How to avoid:** Verify both integration points from `20-CONTEXT.md`'s code_context section (`server.ts` lines 28-37 for Socket.IO, `app.use(cors())` for Express) are updated to reference the same `getAllowedOrigins()` source, and write a test/manual check specifically for the Socket.IO handshake with a disallowed origin (not just an HTTP fetch).
**Warning signs:** REST API correctly returns CORS errors for bad origins, but browser dev tools show a successful Socket.IO connection from an origin outside the allowlist.

## Code Examples

### Connectivity doc outline (DOC-01) — content sourced from `on-premise-deployment.md` §7

```markdown
## Inbound connectivity

If you're placing Vectra behind a reverse proxy or firewall, only two route
prefixes need to be reachable from outside your network:

| Route | Why it must be public | Notes |
|-------|----------------------|-------|
| `/api/webhooks/*` | Samsara and Geotab push GPS/telematics events to your server via signed webhook (HMAC-verified). There is no polling alternative today — if this route isn't reachable, telematics updates stop. | Only needed if you use Samsara or Geotab integration. |
| `/api/pod/*` | Drivers upload signed proof-of-delivery photos from a single-use link on their phone — often from the road, not your office network. | Deliberately unauthenticated (token-scoped per link), by design. |

Everything else — the three frontend apps, the rest of the API, admin
tooling — should stay on your internal network / VPN. There is no
functional requirement for the general API or UI to be internet-reachable.

**Outlook / Microsoft 365 setup:** if you enable live Outlook integration,
the OAuth callback (`/api/v1/outlook/callback`) needs to be reachable by
whichever browser completes the admin's sign-in at setup time — this does
not need to be the public internet if the admin configuring it is on your
LAN/VPN, but it will fail if the admin is external and no ingress exists at all.

**Recommended posture:** run a reverse proxy (nginx, Caddy, Traefik, your
cloud LB) that exposes only `/api/webhooks/*` and `/api/pod/*` publicly,
and routes everything else so it's reachable only from your internal
network or VPN. A fully air-gapped install (no public ingress at all) will
lose telematics webhooks and public POD upload links — that's a real
tradeoff to make consciously, not a bug.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `cors()` with no options (reflects any origin) | Function/array-based `origin` allowlist | Not a library change — this is a config-only fix within the already-installed `cors@2.8.6` | Closes an open CORS hole without a dependency bump |
| Static `{status:"OK"}` health response | Live per-request dependency probe with `Promise.allSettled` | Not a library change — uses already-installed `pg`/`redis` clients | Load balancers/orchestrators can now detect a genuinely unhealthy instance |

**Deprecated/outdated:** None — no libraries in this phase's scope are being replaced or deprecated; this is closing configuration gaps, not migrating tech.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rate-limit thresholds: `windowMs: 15min`, `limit: 20` per IP | Architecture Patterns § Pattern 2 | If too strict, legitimate users get locked out during normal retry behavior (password typos, flaky network); if too loose, doesn't meaningfully throttle credential-stuffing. No spec value given — needs product/security sign-off or post-launch tuning. |
| A2 | `CORS_ALLOWED_ORIGINS` is the right new env var name (vs. reusing `NEXT_PUBLIC_*_URL` directly) | User Constraints § Claude's Discretion, Architecture Patterns § Pattern 1 | If the team strongly prefers zero-new-vars, this could be simplified to derive the allowlist solely from `NEXT_PUBLIC_*_URL` with no override — a smaller, equally valid design. Low risk either way since the fallback behavior is identical. |
| A3 | Applying the rate limiter to all 5 auth routes (not just login+signup) is desired | Architecture Patterns § Pattern 2 | If product wants only login+signup limited (per the spec's literal "at minimum" reading), the extra 3 routes being limited is a strictly more conservative, harmless default — but could theoretically throttle a legitimate bulk-invite or verification-heavy admin workflow if one exists (none found in current code). |
| A4 | `express-rate-limit`'s in-memory store (no Redis-backed store) is acceptable for this phase | Standard Stack § Alternatives Considered | If the API is later horizontally scaled (SCALE-01, a v2/future requirement, explicitly deferred alongside the Socket.IO Redis-adapter gap), in-memory rate limits won't share state across replicas — each instance enforces its own count. Not a problem today (single instance), flagged for future revisit. |

## Open Questions

1. **Should `GET /api/auth/me` be included in the rate limiter's scope?**
   - What we know: `docs/DEPLOYMENT.md` documents that all three frontends call `GET /me` on every page load to validate the session — a moderately high-frequency, legitimate, low-risk endpoint.
   - What's unclear: the phase's "5 auth routes" framing in `20-CONTEXT.md` lists `/me` among the 5 (via `getMe`), but doesn't explicitly say whether it should share the same limiter.
   - Recommendation: exclude `/me` from the rate limiter (apply the limiter only to the 5 write/mutation-adjacent routes: signup, login, verify-email, forgot-password, reset-password) to avoid throttling normal multi-tab/multi-app session checks. Planner should confirm this framing in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `express-rate-limit` (npm) | HRD-02 | ✓ (verified via `npm view`, not yet installed in `apps/api/package.json`) | `8.5.2` | — |
| PostgreSQL (local dev, via docker-compose) | HRD-03 health check | ✓ (docker-compose.yml already provisions it; confirmed via `apps/api/src/core/db/index.ts`'s `Pool` config) | 15 (per `on-premise-deployment.md` §1) | — |
| Redis (local dev, via docker-compose) | HRD-03 health check | ✓ (docker-compose.yml already provisions it; confirmed via `apps/api/src/core/db/redis.ts`) | 7 (per `on-premise-deployment.md` §1) | — |
| Live Postgres/Redis instance in the test-execution environment (for integration-style health-check tests) | HRD-03 test coverage | ✗ (not confirmed reachable from this research session's sandbox; prior phase notes — see STATE.md "Migration 023/024 idempotency verified by manual SQL inspection only, no live PostgreSQL container was available in the execution environment" — indicate this has been a recurring constraint) | — | Use dependency-injected unit tests against mock `queryPostgres`/`pingRedis` functions (Pattern 3) instead of a live-DB integration test; this sidesteps the missing test-DB entirely and is the recommended approach regardless of DB availability, per Pitfall 1. |

**Missing dependencies with no fallback:** none — the one plausible gap (live test DB) has a viable code-level fallback (DI + mocks).

**Missing dependencies with fallback:**
- Live Postgres/Redis for integration testing → use DI-based unit tests on `checkDependencyHealth()` instead (see Pitfall 1, Pattern 3).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict`, run via `ts-node/register` |
| Config file | none — driven by `apps/api/package.json`'s `"test"` script |
| Quick run command | `node --require ts-node/register --test src/core/config/cors.test.ts` (per-file, once created) |
| Full suite command | `npm test --workspace=apps/api` (runs `node --require ts-node/register --test src/**/*.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HRD-01 | `getAllowedOrigins()` parses `CORS_ALLOWED_ORIGINS` and falls back to `NEXT_PUBLIC_*_URL` vars correctly | unit | `node --require ts-node/register --test src/core/config/cors.test.ts` | ❌ Wave 0 |
| HRD-01 | Express `cors()` rejects a disallowed `Origin` header, allows a listed one | integration | `node --require ts-node/register --test src/server.cors.test.ts` (new, follows `server.health.test.ts` pattern) | ❌ Wave 0 |
| HRD-02 | Repeated `POST /api/auth/login` from one IP past the threshold returns 429 with `{ error: ... }` | integration | `node --require ts-node/register --test src/routes/authRoutes.ratelimit.test.ts` (new) | ❌ Wave 0 |
| HRD-03 | `checkDependencyHealth()` returns `{postgres:'down'}` when `queryPostgres` rejects, `{postgres:'ok'}` when it resolves (same for redis) | unit | `node --require ts-node/register --test src/core/health/health.service.test.ts` (new) | ❌ Wave 0 |
| HRD-03 | `GET /health` returns 503 with `dependencies` breakdown when a dependency check fails (mocked) | integration | update existing `node --require ts-node/register --test src/server.health.test.ts` | ✅ (exists, needs update — see Pitfall 1) |
| DOC-01 | New `docs/DEPLOYMENT.md` connectivity section exists and covers the 3 required points | manual-only | N/A — documentation content, no automated test applies | N/A |

### Sampling Rate
- **Per task commit:** run the specific new/updated test file(s) for that task.
- **Per wave merge:** `npm test --workspace=apps/api` (full suite).
- **Phase gate:** Full suite green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/api/src/core/config/cors.test.ts` — unit tests for `getAllowedOrigins()` (env var present, env var absent + fallback, env var absent + no fallback vars set → empty array)
- [ ] `apps/api/src/server.cors.test.ts` — integration test asserting a disallowed `Origin` header is rejected and an allowed one succeeds, following `server.health.test.ts`'s `http.createServer(app)` pattern
- [ ] `apps/api/src/routes/authRoutes.ratelimit.test.ts` — integration test hammering `POST /api/auth/login` past the threshold and asserting a 429 with the expected JSON shape
- [ ] `apps/api/src/core/health/health.service.test.ts` — unit tests for `checkDependencyHealth()` with mock `queryPostgres`/`pingRedis` (both succeed, postgres fails, redis fails, both fail)
- [ ] Update `apps/api/src/server.health.test.ts` — must not break when `/health` starts calling `redisClient.ping()`/`db.query()` on a client that was never `.connect()`-ed in the test process (Pitfall 1); recommend either mocking at the module level or accepting/asserting a 503 in this specific unmodified-test context if the real DB/Redis aren't reachable

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes (indirectly) | Rate limiting on auth endpoints (HRD-02) is a standard ASVS V2.2.1-adjacent control against credential-stuffing/brute-force; existing `bcrypt`-based password hashing (already in place) is unaffected by this phase |
| V3 Session Management | no | Not touched by this phase — JWT/session mechanism unchanged |
| V4 Access Control | no | Not touched — no new authz logic |
| V5 Input Validation | no | Not touched — no new user input surfaces beyond `CORS_ALLOWED_ORIGINS` (an operator-controlled env var, not user input) |
| V6 Cryptography | no | Not touched — no new crypto/secret handling in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-origin credential/data leakage via wide-open CORS (`origin: '*'` or reflect-any-origin) | Information Disclosure / Spoofing | HRD-01: origin allowlist via `cors`/Socket.IO `cors.origin` options (Pattern 1) |
| Credential stuffing / brute-force against `/api/auth/login` | Spoofing | HRD-02: `express-rate-limit` (Pattern 2) |
| Signup spam creating throwaway companies (Cloud multi-tenant risk noted in `cloud-deployment.md` §3.2) | Denial of Service (resource exhaustion) | HRD-02: rate limit on `/api/auth/signup` |
| Silent unhealthy instance kept in a load balancer's rotation | Denial of Service (availability) | HRD-03: live dependency health check (Pattern 3) |

## Sources

### Primary (HIGH confidence)
- `apps/api/src/server.ts` (lines 28-37, 60-62) — current CORS/Socket.IO/health config, read directly
- `apps/api/src/core/config/secrets.ts` — established pure-validator + lazy-env-read module style precedent
- `apps/api/src/core/errors/AppError.ts` + `errorHandler.ts` — JSON error shape convention
- `apps/api/src/core/db/index.ts`, `apps/api/src/core/db/redis.ts` — existing Postgres/Redis client instances
- `apps/api/src/server.health.test.ts` — existing health test, read directly, revealed the `bootstrap()`-bypass pitfall
- `docs/specs/deployment/cloud-deployment.md` §3.1-3.4 — primary spec for HRD-01/02/03
- `docs/specs/deployment/on-premise-deployment.md` §7, §9 — primary spec for DOC-01
- `.planning/phases/20-deploy-hardening-connectivity-doc/20-CONTEXT.md` — locked decisions D-01–D-05
- `npm view express-rate-limit version/peerDependencies/engines/repository.url` — verified 2026-07-13, package metadata directly from npm registry
- `python -m slopcheck install express-rate-limit` — package legitimacy check, `[OK]` verdict

### Secondary (MEDIUM confidence)
- `cors` npm package's documented function-based `origin` option and Socket.IO's array-based `cors.origin` option — based on well-established, stable APIs of already-installed packages (training knowledge, cross-checked against installed versions `cors@2.8.6`/`socket.io@4.8.3` which have not changed this API in years); not re-fetched from Context7/live docs in this session — flag as MEDIUM rather than HIGH since it wasn't independently re-verified against current published docs.

### Tertiary (LOW confidence)
- `express-rate-limit`'s exact `standardHeaders: 'draft-8'` option name/value — based on training knowledge of the library's v7/v8 configuration API; the package version and existence are `[VERIFIED: npm registry]`, but this specific option name should be double-checked against the installed version's README/types once `npm install` actually runs, since rate-limit-header-draft option naming has changed across major versions historically.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `express-rate-limit` version/existence directly verified via `npm view` and slopcheck; `cors`/`socket.io` already installed and inspected in `package-lock.json`
- Architecture: HIGH — all three patterns are direct, minimal extensions of code read directly in this session (`server.ts`, `secrets.ts`, `AppError.ts`)
- Pitfalls: HIGH — Pitfall 1 (test/bootstrap gap) and Pitfall 3 (Socket.IO/Express CORS independence) were discovered by directly reading `server.health.test.ts` and `server.ts`, not inferred from training data

**Research date:** 2026-07-13
**Valid until:** 30 days (stable Express-ecosystem tooling, no fast-moving dependencies in scope)
