---
phase: 16-production-compose-deployment-mode
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - .env.example
  - apps/api/src/controllers/authController.test.ts
  - apps/api/src/controllers/authController.ts
  - apps/api/src/core/config/secrets.test.ts
  - apps/api/src/core/config/secrets.ts
  - apps/api/src/server.ts
  - docker-compose.prod.yml
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The new `DEPLOYMENT_MODE`/secret-validation gate (`secrets.ts`, its tests, the `signup()` early-return, and `server.ts` bootstrap wiring) is well designed: pure validators, a fail-fast boot gate, denylisted known-bad values, and a check that runs before any DB/Redis I/O. That part is solid.

However, reviewing the full scope of the touched files surfaced pre-existing but serious defects that are directly relevant to a "production compose deployment" phase: an unauthenticated privilege-escalation path in `signup()` (arbitrary `role` accepted with no allow-list), fake transactions in `verifyEmail()`/`resetPassword()` that use pool-level `db.query()` for `BEGIN`/`COMMIT` instead of a dedicated client (risking permanently-open transactions on pooled connections), and an `.env.example` that is missing/mismatched against variables `docker-compose.prod.yml` unconditionally requires — which will break first-time production `docker compose up` for anyone following the example file. There are also several hardening gaps (wildcard CORS, undifferentiated default Postgres credentials, missing healthchecks) worth addressing before calling this deployment mode production-ready.

## Critical Issues

### CR-01: `signup()` accepts an arbitrary `role`, allowing self-service privilege escalation to admin

**File:** `apps/api/src/controllers/authController.ts:28,43-68,78`
**Issue:** The only validation performed on `role` is a truthiness check (`!role` → 400, line 28). The company-creation branch is gated on `role === 'carrier' || role === 'shipper'` (line 43), but there is no corresponding restriction on any *other* value. If a caller POSTs `{ role: "admin", ... }` (or any other string) without `company_name`, `companyId` stays `null`, and `effectiveRole = companyId ? 'admin' : role` (line 78) evaluates to the attacker-supplied `role` verbatim — i.e. a completely unauthenticated request can create a user with `role: "admin"` (or any arbitrary role string) with no company, no verification, and no downstream check. This is exploitable in `cloud` mode (the `DEPLOYMENT_MODE === 'on-prem'` gate at line 16 only blocks signup entirely in on-prem; in `cloud` mode — the default/most common mode — this path is fully open).
**Fix:**
```ts
const ALLOWED_SIGNUP_ROLES = ['carrier', 'shipper'] as const;
if (!ALLOWED_SIGNUP_ROLES.includes(role)) {
  return res.status(400).json({ error: 'Invalid role' });
}
// effectiveRole should never be derived from unchecked user input;
// admin should only ever be assigned by the workspace-owner path (companyId truthy).
```

### CR-02: `verifyEmail()` / `resetPassword()` use pool-level `db.query()` for BEGIN/COMMIT — no real transaction, risk of a permanently open transaction on a pooled connection

**File:** `apps/api/src/controllers/authController.ts:211-219` (verifyEmail), `apps/api/src/controllers/authController.ts:286-294` (resetPassword)
**Issue:** `db` (imported from `../config/db`, which re-exports `core/db`'s `db = new Pool(...)`) is a `pg.Pool`. Calling `db.query('BEGIN')`, then `db.query('UPDATE ...')`, then `db.query('COMMIT')` does **not** guarantee the statements run on the same physical connection — `Pool.query()` checks out a client, runs one statement, and releases it back to the pool for *each call*. This means:
1. There is no actual atomicity between the `UPDATE`/`DELETE` pair — a crash between them leaves partial state.
2. Whichever connection happens to execute the loose `BEGIN` is returned to the pool still inside an open transaction (since `Pool.query` auto-releases after each individual call). The next unrelated request that picks up that same connection will unknowingly run its queries inside a stale, uncommitted transaction — a serious data-integrity hazard and a path to connection-pool exhaustion (`idle in transaction` connections accumulating under load).

Contrast with `signup()` (lines 20-131), which correctly does `const client = await db.connect()` and issues `client.query('BEGIN'/'COMMIT'/'ROLLBACK')` against the same dedicated client in `finally { client.release() }`.
**Fix:**
```ts
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [authToken.user_id]);
  await client.query(`DELETE FROM auth_tokens WHERE id = $1`, [authToken.id]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```
Apply the same fix to `resetPassword()`.

### CR-03: `.env.example` is missing/mismatched against variables `docker-compose.prod.yml` unconditionally requires

**File:** `.env.example` (whole file) vs `docker-compose.prod.yml:56-57`
**Issue:** `docker-compose.prod.yml`'s `api` service uses `${API_PUBLIC_URL:?API_PUBLIC_URL is required}` and `${WORKSPACES_APP_URL:?WORKSPACES_APP_URL is required}` — both fail the `docker compose up` invocation if unset, for *every* deployment, regardless of whether Outlook integration is used. But:
- `API_PUBLIC_URL` does not appear anywhere in `.env.example` — an operator has no way to know this variable exists until the compose command fails with a bare `${API_PUBLIC_URL}` error.
- `WORKSPACES_APP_URL` is documented in `.env.example` only as a **commented-out, optional** setting under the "Outlook / Microsoft 365 integration (optional)" section (lines 35-42), which directly contradicts it being unconditionally required by `docker-compose.prod.yml`.

Since this file's whole purpose (per `docker-compose.prod.yml`'s own header comments) is to support the phase-16 production deployment path, this mismatch will break the documented `docker compose -f docker-compose.prod.yml up -d` flow for the first operator who copies `.env.example` to `.env` and fills in only what's documented.
**Fix:** Add `API_PUBLIC_URL=` to `.env.example` with an explanatory comment, and move `WORKSPACES_APP_URL` out of the "optional Outlook" comment block into the required/general section (or clearly state it is required unconditionally, with Outlook using it as a secondary purpose).

## Warnings

### WR-01: `.env.example` ships weak, predictable default Postgres credentials with no boot-time denylist check

**File:** `.env.example:6-8`
**Issue:** `POSTGRES_USER=vectra_user`, `POSTGRES_PASSWORD=vectra_password`, `POSTGRES_DB=vectra_db` are real, working default values (not blank placeholders like `JWT_SECRET=`/`ENCRYPTION_KEY=`). Unlike `JWT_SECRET`/`ENCRYPTION_KEY`, which `secrets.ts` explicitly denylists against known committed values and refuses to boot on (SEC-01/SEC-02), there is no equivalent check preventing a production deployment from silently running with `vectra_password` as the live Postgres password if an operator copies `.env.example` to `.env` without changing it. `docker-compose.prod.yml`'s `${POSTGRES_PASSWORD:?...}` only fails if the variable is *unset* — a copied default value passes that check trivially.
**Fix:** Either leave `POSTGRES_PASSWORD` blank in `.env.example` (forcing an explicit choice, consistent with `JWT_SECRET`) or add a boot-time denylist check in `secrets.ts` analogous to `KNOWN_BAD_JWT_SECRET`.

### WR-02: Wildcard CORS in production despite known per-app origins being available

**File:** `apps/api/src/server.ts:29-36`
**Issue:** `app.use(cors())` (default: reflects any origin) and the Socket.io server's `cors: { origin: "*", methods: ["GET","POST"] }` allow requests from any origin. `docker-compose.prod.yml` already defines exact origins for the three frontends (`NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL`), which could be used to build an explicit allowlist instead of `*`. For a phase specifically about hardening the production deployment path, this is an unnecessarily broad attack surface (CSRF-adjacent risk for any credential/cookie-bearing requests, and unrestricted WS cross-origin connections).
**Fix:**
```ts
const allowedOrigins = [process.env.NEXT_PUBLIC_MARKETPLACE_URL, process.env.NEXT_PUBLIC_WORKSPACES_URL, process.env.NEXT_PUBLIC_CMR_URL].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
```

### WR-03: `getDeploymentMode()` module-level cache creates cross-test-file ordering fragility

**File:** `apps/api/src/controllers/authController.test.ts:1-4`, `apps/api/src/core/config/secrets.ts:89,111-122`, `apps/api/src/core/config/secrets.test.ts:95-102`
**Issue:** `secrets.ts` caches `DEPLOYMENT_MODE` in a module-level variable after the first call to `getDeploymentMode()`. `authController.test.ts`'s own top-of-file comment acknowledges the danger ("if node --test ever runs files in the same process this must run first") but does nothing to actually guarantee it — it relies on `node --test`'s current default of one subprocess per file, which is an implementation detail of the test runner, not something enforced by the test code itself. `secrets.test.ts` line 95-102 also calls the real `getDeploymentMode()` (not just the pure validator) and asserts the cache sticks to `'cloud'` — if this test module and `authController.test.ts` ever execute in the same process (e.g. a future switch to a different runner, `--test-concurrency` changes, or bundling test files together), whichever cached value wins first will silently make the other file's assertions pass or fail for the wrong reason.
**Fix:** Add a test-only reset hook (e.g. `export function __resetDeploymentModeCacheForTests()`), or avoid calling the real cached `getDeploymentMode()` from test code entirely and only exercise `validateDeploymentModeValue()` (as `secrets.test.ts` mostly already does) plus a fork/child-process test for the actual caching behavior.

### WR-04: Misleading comment claims DEPLOYMENT_MODE caching "mirrors" JWT_SECRET/ENCRYPTION_KEY's shape

**File:** `apps/api/src/core/config/secrets.ts:85`
**Issue:** The comment states DEPLOYMENT_MODE is "Read once per process lifetime and cached, mirroring the JWT_SECRET/ENCRYPTION_KEY shape." But `getJwtSecret()` (line 56-63) and `validateSecretsOrExit()` (line 70-77) read `process.env.JWT_SECRET`/`process.env.ENCRYPTION_KEY` fresh on every call — there is no caching variable for either. The comment misdescribes the actual behavior and could mislead a future maintainer into assuming JWT_SECRET is also cached (e.g., when writing tests or reasoning about env-var reload behavior).
**Fix:** Correct the comment to state DEPLOYMENT_MODE is the only cached value in this module, and explain why (access-control stability) rather than implying parity with the other two secrets.

### WR-05: Inconsistent input validation in `signup()` vs other auth handlers

**File:** `apps/api/src/controllers/authController.ts:22-30`
**Issue:** `signup()` only checks that `email`/`password`/`first_name`/`last_name`/`role` are truthy — no email format validation and no password strength/length check. `resetPassword()` (line 270-272) enforces `newPassword.length >= 8`, but a user can originally register with a 1-character password via `signup()`. This is an inconsistent security posture between the two code paths that both set the same `password_hash` field.
**Fix:** Apply the same minimum-length (and ideally complexity) check used in `resetPassword()` to `signup()`'s password field, and validate `email` against a basic format regex before the DB round-trip.

### WR-06: `matching-engine` has no healthcheck; `api`'s dependency uses `service_started` instead of `service_healthy`

**File:** `docker-compose.prod.yml:65-78`
**Issue:** The `matching-engine` service defines no `healthcheck` block, so `api`'s `depends_on: matching-engine: condition: service_started` only waits for the container process to start, not for its HTTP server (FastAPI/Uvicorn) to actually be accepting connections. Early requests routed to `MATCHING_ENGINE_URL` right after `docker compose up` can fail until the Python service finishes initializing.
**Fix:** Add a healthcheck to `matching-engine` (e.g. `curl -f http://localhost:8000/health || exit 1`) and change `api`'s dependency condition to `service_healthy`.

## Info

### IN-01: Unused destructured `company_type` variable in `signup()`

**File:** `apps/api/src/controllers/authController.ts:24`
**Issue:** `company_type` is destructured from `req.body` but never referenced again (per the comment at line 58, it is "intentionally ignored"). Keeping it in the destructuring pattern is dead code that adds noise and could trigger unused-variable lint warnings.
**Fix:** Remove `company_type` from the destructuring list, or explicitly discard it (`// eslint-disable-next-line`) with a short comment referencing why it's still accepted on the wire (backward compatibility with older clients), if that's the actual reason.

### IN-02: `login()` relies on manual field deletion from a `SELECT *` row instead of an explicit allowlist

**File:** `apps/api/src/controllers/authController.ts:144-147, 176-177`
**Issue:** `login()` fetches the full `users` row (`SELECT * FROM users WHERE email = $1`) and then deletes `password_hash` and `two_factor_secret` before sending the response. This is a deny-list approach: any future sensitive column added to `users` (e.g. a new secret/token field) will leak into the API response by default unless someone remembers to add it to the deletion list here. `getMe()` (line 311-316) already uses the safer explicit-column-allowlist pattern.
**Fix:** Replace `SELECT *` with an explicit column list (mirroring `getMe()`), removing the need for post-hoc deletion.

### IN-03: TODO left in production auth path

**File:** `apps/api/src/controllers/authController.ts:161`
**Issue:** `// TODO: Handle 2FA check here if enabled` — 2FA is referenced elsewhere (`two_factor_secret` deleted from the login response) but never actually checked during login, meaning any account with 2FA "enabled" data present is not actually protected by it.
**Fix:** Track this as a known gap (already flagged as TODO); ensure it is not accidentally advertised as a supported security feature in user-facing docs until implemented.

---

_Reviewed: 2026-07-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
