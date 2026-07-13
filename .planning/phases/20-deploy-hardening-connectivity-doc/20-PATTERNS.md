# Phase 20: Deploy Hardening + Connectivity Doc - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 10
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/core/config/cors.ts` | config/utility | request-response (env-read) | `apps/api/src/core/config/secrets.ts` | exact (naming/module-shape precedent) |
| `apps/api/src/core/config/cors.test.ts` | test | request-response | `apps/api/src/core/config/secrets.test.ts` | exact |
| `apps/api/src/server.ts` (modified) | config/entrypoint | request-response | itself (existing lines 28-37, 60-62) | exact (in-place edit) |
| `apps/api/src/server.cors.test.ts` | test | request-response | `apps/api/src/server.health.test.ts` | exact |
| `apps/api/src/routes/authRoutes.ts` (modified) | route | request-response | itself (existing file) | exact (in-place edit) |
| `apps/api/src/routes/authRoutes.ratelimit.test.ts` | test | request-response | `apps/api/src/server.health.test.ts` | role-match (integration test hitting a live route via `http.createServer(app)`) |
| `apps/api/src/core/health/health.service.ts` | service | request-response (dependency probe) | `apps/api/src/core/config/secrets.ts` | role-match (pure validator/DI style, no boot-exit) |
| `apps/api/src/core/health/health.service.test.ts` | test | request-response | `apps/api/src/core/config/secrets.test.ts` | exact (pure-function unit test style) |
| `apps/api/src/server.health.test.ts` (modified) | test | request-response | itself (existing file) | exact (in-place edit) |
| `docs/DEPLOYMENT.md` (modified) | doc | N/A | itself (existing "Production images" / "Upgrading a running install" sections) | exact (in-place edit, new section) |

## Pattern Assignments

### `apps/api/src/core/config/cors.ts` (config, env-read)

**Analog:** `apps/api/src/core/config/secrets.ts`

**Module header/doc-comment pattern** (lines 1-11 of `secrets.ts`):
```typescript
// ── Boot-time secret validation ───────────────────────────────────────────
//
// Single validated-read module for JWT_SECRET and ENCRYPTION_KEY. Both must
// be present, non-empty, and not equal to a known committed/legacy fallback
// value — the server refuses to boot otherwise (SEC-01/SEC-02).
//
// This module is boot-oriented: failures call `console.error` + `process.exit(1)`,
// not `AppError` (which requires an HTTP request context)...
```
Adapt for `cors.ts`: header comment should note this module is **request-time, lazy-read, no exit()** (unlike `secrets.ts`'s boot-time gate) — it just returns an array, callers decide what to do with an empty/mismatched result.

**Pure function + lazy env read pattern** (lines 56-63):
```typescript
/**
 * Validated, lazy read of JWT_SECRET. Call inside a function body (never at
 * module scope) so it always runs after dotenv.config() has loaded .env.
 */
export function getJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  const result = validateJwtSecretValue(value);
  if (!result.valid) {
    fail('JWT_SECRET', result.reason ?? 'invalid value');
  }
  return value as string;
}
```
Copy the *shape* (exported pure function, reads `process.env` inside the function body — never at module scope — so it's safe to import before `dotenv.config()` runs in tests), not the fail/exit behavior. `getAllowedOrigins()` should:
```typescript
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
(Full recommended implementation is in RESEARCH.md Pattern 1 — reuse verbatim, it already matches this module's conventions.)

**Export style:** named exports of functions only (no class, no singleton instance) — matches `secrets.ts`'s `export function validateJwtSecretValue`, `export function getJwtSecret`, etc.

---

### `apps/api/src/core/config/cors.test.ts` (test)

**Analog:** `apps/api/src/core/config/secrets.test.ts`

**Imports + test structure pattern** (lines 1-20):
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateJwtSecretValue,
  validateEncryptionKeyValue,
  validateDeploymentModeValue,
  getDeploymentMode,
} from './secrets';

// ── getJwtSecret() / validateJwtSecretValue() ────────────────────────────

test('JWT_SECRET unset -> invalid', () => {
  const result = validateJwtSecretValue(undefined);
  assert.equal(result.valid, false);
});
```
Apply directly: `import { getAllowedOrigins } from './cors';`, group tests with a `// ── getAllowedOrigins() ──` banner comment, one `test()` per scenario (`CORS_ALLOWED_ORIGINS` set / unset+fallback / unset+no-fallback-vars → `[]`). Since `getAllowedOrigins()` reads `process.env` directly (not injected), tests must set/delete `process.env.CORS_ALLOWED_ORIGINS` and the three `NEXT_PUBLIC_*_URL` vars around each test (save/restore, or set inline per test) — no existing precedent for env mutation in `secrets.test.ts` since it tests the pure `validate*Value` functions instead; `cors.test.ts` will need `process.env.X = ...` / `delete process.env.X` bracketing, framed as a deliberate deviation since `getAllowedOrigins()` has no pure-value-only variant in the RESEARCH.md recommendation.

---

### `apps/api/src/server.ts` (modified — CORS + Socket.IO + health handler)

**Analog:** itself, in-place edit of existing lines

**Current CORS block to replace** (lines 28-37):
```typescript
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
```
Replace `origin: "*"` and bare `cors()` with `getAllowedOrigins()`-sourced config per RESEARCH.md Pattern 1 (both call sites must share the exact same resolved array — Pitfall 3 warns these are two independent config surfaces).

**Current health handler to replace** (lines 60-62):
```typescript
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "VECTRA backend running", version: getVersion() });
});
```
Replace with the async `checkDependencyHealth()`-based handler from RESEARCH.md Pattern 3, keeping `version: getVersion()` (import already present at line 24) and adding `dependencies`. Preserve `status: "OK"` string on success per D-03 backward-compat requirement; drop or keep the `message` field at implementer's discretion (not specified in D-03's exact shape, but D-03 says "keep the existing shape" — safest to keep `message` too, additive only).

**Existing import style to follow** (lines 1-24): flat top-of-file imports, no path aliases, relative paths only — `import { getAllowedOrigins } from "./core/config/cors";` and `import { checkDependencyHealth } from "./core/health/health.service";` go alongside the existing `validateSecretsOrExit`/`getVersion` imports (lines 23-24).

---

### `apps/api/src/server.cors.test.ts` (test)

**Analog:** `apps/api/src/server.health.test.ts`

**Full pattern to copy** (entire file, lines 1-37):
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from './server';

test('GET /health -> 200 OK with status + version fields', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected server to listen on a port');
    }
    const port = address.port;
    const body: string = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/health`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        })
        .on('error', reject);
    });
    const parsed = JSON.parse(body);
    assert.equal(parsed.status, 'OK');
    assert.equal(typeof parsed.version, 'string');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
```
Reuse the exact `http.createServer(app)` + `server.listen(0, resolve)` + manual `http.get`/response-buffering + `finally { server.close(...) }` scaffold — this is the established (only) pattern in the codebase for hitting a live route without `supertest`. For the CORS test, add a request with a disallowed `Origin` header (use `http.request` with `headers: { Origin: 'https://evil.example.com' }` instead of `http.get`) and assert the response either lacks `Access-Control-Allow-Origin` or the connection errors per `cors` package behavior; add a second case with an allowed origin from `CORS_ALLOWED_ORIGINS`/`NEXT_PUBLIC_*` env vars asserting the header is present and matches.

---

### `apps/api/src/routes/authRoutes.ts` (modified — add rate limiter)

**Analog:** itself, in-place edit

**Current full file** (lines 1-15):
```typescript
import { Router } from 'express';
import { signup, login, verifyEmail, forgotPassword, resetPassword, getMe } from '../controllers/authController';
import { authenticateToken } from '../core/auth/middleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, getMe);

export default router;
```
Per RESEARCH.md Open Questions recommendation, apply the limiter to the 5 mutation routes individually (not via blanket `router.use()`), leaving `/me` unlimited:
```typescript
import rateLimit from 'express-rate-limit';

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    // Intentional exception to the AppError/errorHandler convention: this
    // handler bypasses errorHandler entirely (see PATTERNS.md shared pattern).
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/verify-email', authRateLimiter, verifyEmail);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.get('/me', authenticateToken, getMe);
```
Import ordering follows existing convention: third-party (`express`, `rate-limit`) above relative imports (`../controllers/...`, `../core/...`).

---

### `apps/api/src/routes/authRoutes.ratelimit.test.ts` (test)

**Analog:** `apps/api/src/server.health.test.ts` (scaffold) + `apps/api/src/core/config/secrets.test.ts` (assertion style)

Use the same `http.createServer(app)` + manual `http.request`/response-buffering scaffold as `server.health.test.ts` (see excerpt above), looped `limit + 1` times against `POST /api/auth/login` from the same test process (same source IP, since `express-rate-limit`'s default `keyGenerator` uses `req.ip`), asserting the final response is `429` with body `{ error: '...' }`. Import `{ app }` from `../server` (one directory up, matching `server.health.test.ts`'s `./server` import pattern adjusted for path).

---

### `apps/api/src/core/health/health.service.ts` (service, dependency probe)

**Analog:** `apps/api/src/core/config/secrets.ts` (module style) — no direct request-time-DI-service precedent exists in the codebase; RESEARCH.md Pattern 3 is the primary source.

**Style to copy from `secrets.ts`:** exported pure functions, no class, no module-level singleton reads inside the function (contrast: `secrets.ts` *does* read `process.env` directly since that's its whole job — `health.service.ts` instead takes injected callbacks, per Pitfall 4/Anti-Patterns in RESEARCH.md, so it stays unit-testable without a live DB/Redis).

**Full pattern** (from RESEARCH.md Pattern 3, use verbatim):
```typescript
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
Caller in `server.ts` supplies `queryPostgres: () => db.query("SELECT 1")` and `pingRedis: () => redisClient.ping()`, reusing the existing `db` (`apps/api/src/core/db/index.ts`) and `redisClient` (`apps/api/src/core/db/redis.ts`) singletons already imported in `server.ts` lines 6-7 — do not create new client instances.

---

### `apps/api/src/core/health/health.service.test.ts` (test)

**Analog:** `apps/api/src/core/config/secrets.test.ts`

Same `import { test } from 'node:test'; import assert from 'node:assert/strict';` + flat `test('description', async () => {...})` blocks. Since `checkDependencyHealth` is DI-based (unlike `secrets.ts`'s `process.env`-reading functions), pass mock `queryPostgres`/`pingRedis` functions per case:
```typescript
test('both dependencies healthy -> {postgres: ok, redis: ok}', async () => {
  const result = await checkDependencyHealth({
    queryPostgres: async () => ({ rows: [{ '?column?': 1 }] }),
    pingRedis: async () => 'PONG',
  });
  assert.deepEqual(result, { postgres: 'ok', redis: 'ok' });
});

test('postgres down -> {postgres: down, redis: ok}', async () => {
  const result = await checkDependencyHealth({
    queryPostgres: async () => { throw new Error('connection refused'); },
    pingRedis: async () => 'PONG',
  });
  assert.deepEqual(result, { postgres: 'down', redis: 'ok' });
});
```
Cover all 4 combinations (both ok, postgres down, redis down, both down) per RESEARCH.md Wave 0 Gaps.

---

### `apps/api/src/server.health.test.ts` (modified — update for D-03 shape + Pitfall 1)

**Analog:** itself, in-place edit

Current assertions (lines 28-30) only check `status`/`version` on a 200:
```typescript
const parsed = JSON.parse(body);
assert.equal(parsed.status, 'OK');
assert.equal(typeof parsed.version, 'string');
```
Per RESEARCH.md Pitfall 1: this test imports `{ app }` without calling `bootstrap()`, so `redisClient.ping()` will throw (`ClientClosedError`) on an unconnected v4 client rather than lazily connecting — the test **will** now exercise the 503 path unless the test environment happens to have live Postgres/Redis reachable. Update assertions to tolerate either outcome (assert `dependencies` object shape and that `status` is one of `'OK'`/`'unhealthy'` consistent with the HTTP status code), or mock `db`/`redisClient` at the module level before importing `app`. Do not assume a live DB/Redis is available in CI (see RESEARCH.md Environment Availability table).

---

### `docs/DEPLOYMENT.md` (modified — new "Inbound connectivity" section)

**Analog:** itself — existing "Production images" / "Upgrading a running install" sections (lines 42-127)

**Section-header + table style to match** (e.g. lines 60-70, the "Subdomain routing" section):
```markdown
## Subdomain routing (production)

Map each app to a subdomain of one parent domain so the session cookie can be
shared (see SSO below):

| App          | Suggested host           |
|--------------|--------------------------|
| Marketplace  | `marketplace.vectra.app` |
...
```
New section should follow this exact style: `## <Title>` heading, one or two sentences of context, then a markdown table where useful (RESEARCH.md's Code Examples § Connectivity doc outline already provides a ready-to-use `| Route | Why it must be public | Notes |` table matching this format — use it near-verbatim). Place the new `## Inbound connectivity` section after "Upgrading a running install" (line 96-127) and before "## Outlook / Microsoft 365 integration" (line 129) since D-04 groups it with deploy-adjacent content and the existing Outlook section already documents its own OAuth-callback reachability nuance that the new section should cross-reference rather than duplicate (see existing lines 144-146 for the `MS_REDIRECT_URI`/callback URL pattern already documented there).

**Existing content this section must not duplicate:** lines 144-146 already state the Outlook OAuth callback URL format (`https://api.your-domain/api/v1/outlook/callback`) — the new connectivity section's Outlook callout (per CONTEXT.md Claude's Discretion) should reference this existing section rather than re-stating the exact URL.

---

## Shared Patterns

### Error/response JSON shape convention
**Source:** `apps/api/src/core/errors/AppError.ts` + `apps/api/src/core/errors/errorHandler.ts`
**Apply to:** the rate-limiter's 429 `handler` and the `/health` 503 response
```typescript
// errorHandler.ts's convention for AppError-driven responses:
if (err instanceof AppError) {
  res.status(err.status).json({ error: err.message });
  return;
}
console.error('[Unhandled]', err);
res.status(500).json({ error: 'Internal server error' });
```
Both the 429 handler (`res.status(429).json({ error: '...' })`) and the health-check 503 body must produce JSON matching this `{ error: message }` shape *where practical* — note the 503 body is an intentional exception since D-03 mandates a different shape (`{status, version, dependencies}`, no `error` key) for `/health` specifically; only the 429 handler should mirror `{ error: message }` literally. Document in a code comment (per RESEARCH.md Pitfall 2) that `express-rate-limit`'s `handler` cannot `throw new AppError` — it must call `res.status().json()` directly, bypassing `errorHandler` entirely.

### Module shape: pure validator/reader + lazy env access
**Source:** `apps/api/src/core/config/secrets.ts`
**Apply to:** `cors.ts` (new), and by contrast `health.service.ts` (new, DI-based instead of env-reading — the deliberate deviation is itself the pattern to note)
```typescript
// secrets.ts's shape: exported pure function, process.env read inside
// function body (never module scope), boot-time fail() helper for exits.
export function getJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  const result = validateJwtSecretValue(value);
  if (!result.valid) {
    fail('JWT_SECRET', result.reason ?? 'invalid value');
  }
  return value as string;
}
```
`cors.ts` copies the "read inside function body, no module-scope env access" discipline but drops the `fail()`/`process.exit()` behavior (request-time, not boot-time). `health.service.ts` goes further and drops direct `process.env`/singleton access entirely in favor of injected callbacks, per RESEARCH.md's explicit Anti-Pattern warning against reading `db`/`redisClient` module-level singletons inside `checkDependencyHealth`.

### Test scaffold: live route via `http.createServer(app)`
**Source:** `apps/api/src/server.health.test.ts`
**Apply to:** `server.cors.test.ts`, `authRoutes.ratelimit.test.ts`
This is the only established pattern in the codebase for integration-testing a route without `supertest` (not installed) — `http.createServer(app)`, `server.listen(0, resolve)` to get an OS-assigned port, manual `http.get`/`http.request` + buffered response, `finally { server.close(...) }`. Reuse verbatim for all new integration tests in this phase rather than introducing a new test-http pattern.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/core/health/health.service.ts` | service | request-time dependency probe | No existing request-time, DI-based health/dependency-check module exists in the codebase; `secrets.ts` is the closest precedent but is boot-time and env-reading rather than request-time and DI-based — RESEARCH.md Pattern 3 is the primary source of truth for this file, not a codebase analog. |

## Metadata

**Analog search scope:** `apps/api/src/core/**`, `apps/api/src/routes/**`, `apps/api/src/server*.ts`, `apps/api/src/core/errors/**`, `docs/DEPLOYMENT.md`
**Files scanned:** `server.ts`, `secrets.ts`, `secrets.test.ts`, `authRoutes.ts`, `server.health.test.ts`, `AppError.ts`, `errorHandler.ts`, `docs/DEPLOYMENT.md`
**Pattern extraction date:** 2026-07-13
