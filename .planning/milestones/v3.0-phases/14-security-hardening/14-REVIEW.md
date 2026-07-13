---
phase: 14-security-hardening
reviewed: 2026-07-12T09:45:21Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/api/src/core/config/secrets.ts
  - apps/api/src/core/config/secrets.test.ts
  - apps/api/src/server.ts
  - apps/api/src/controllers/authController.ts
  - apps/api/src/core/auth/middleware.ts
  - apps/api/src/core/realtime/socket.ts
  - apps/api/src/domains/outlook/outlook.service.ts
  - docker-compose.yml
  - .env.example
findings:
  critical: 3
  warning: 7
  info: 3
  total: 13
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-07-12T09:45:21Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase adds a boot-time secret-validation module (`secrets.ts`) and wires it into `server.ts`, `authController.ts`, `middleware.ts`, `socket.ts`, and `outlook.service.ts`. The boot-time denylist checks for `JWT_SECRET`/`ENCRYPTION_KEY` are a reasonable idea and are unit-tested for the happy/denylist paths, but the validation is too weak to call "hardened": there is no minimum-length/entropy check on `JWT_SECRET`, and `ENCRYPTION_KEY` is validated for length only, not hex format, so a malformed key still passes boot and fails later at first encryption use. Separately from the secrets module itself, `core/realtime/socket.ts` has a genuine tenant-isolation bypass: any connected socket (including unauthenticated ones) can join `company:<anyId>` and other prefixed rooms unconditionally, which lets any client listen in on another company's realtime broadcasts — this directly contradicts the multi-tenancy isolation model described in project conventions. `authController.ts` also leaks raw database error messages to clients in `signup`, and runs `BEGIN`/`COMMIT` directly against the pooled `db.query` (not a checked-out client) in `verifyEmail`/`resetPassword`, which is not actually transactional. CORS is wide open (`origin: "*"` for Socket.IO, unrestricted `cors()` for Express) with no `algorithms` allowlist on any `jwt.verify()` call.

## Critical Issues

### CR-01: Socket.IO room-join has no authorization check — cross-tenant broadcast leak

**File:** `apps/api/src/core/realtime/socket.ts:12-53`
**Issue:** `configureSocket` auto-joins an authenticated socket to its own `user:<id>` and `company:<company_id>` rooms (lines 39-42), which is correct. But the generic `join` handler (lines 44-47) only checks that the room string starts with an allowed prefix (`isSafeRoom`, lines 14-16) — it never checks that the requesting socket is actually authorized for that specific room. Any connected socket — including anonymous ones, since `io.use` explicitly allows connections with no token at all ("Allow anonymous connections", lines 24-27) — can call `socket.emit('join', 'company:<victim-company-id>')`, `'shipment:<any-id>'`, or `'capacity:<any-id>'` and receive that tenant's realtime broadcasts (shipment updates, capacity changes, chat, KPI events). This defeats the row-level tenant isolation the rest of the codebase relies on (per project conventions: "isolation via WHERE clauses + middleware validation").
**Fix:**
```ts
socket.on('join', (room: string) => {
  if (typeof room !== 'string' || !isSafeRoom(room)) return;
  const user = socket.data.user;
  if (!user) return; // no anonymous room joins
  if (room.startsWith('company:') && room !== `company:${user.company_id}`) return;
  // For shipment:/capacity:/chat: rooms, verify ownership against the DB
  // (e.g. shipment belongs to user.company_id) before joining — do not
  // trust the client-supplied id alone.
  socket.join(room);
});
```

### CR-02: `JWT_SECRET` validation has no minimum length/entropy check

**File:** `apps/api/src/core/config/secrets.ts:22-30`
**Issue:** `validateJwtSecretValue` only rejects empty values and two hardcoded denylisted strings. Any other value — including `JWT_SECRET=a` or `JWT_SECRET=x` — passes validation and boots the server. A trivially short/weak secret makes HMAC-signed JWTs brute-forceable offline, which fully compromises authentication (forged admin tokens, `company_id` impersonation, etc.). This is the exact class of bug SEC-01/SEC-02 (referenced in the file's own header comment) is supposed to close, but the fix only closes the "known bad committed default" case, not the "weak secret" case.
**Fix:**
```ts
export function validateJwtSecretValue(value: string | undefined): SecretValidationResult {
  if (!value) return { valid: false, reason: 'JWT_SECRET is unset or empty' };
  if (value.length < 32) {
    return { valid: false, reason: 'JWT_SECRET must be at least 32 characters (use crypto.randomBytes(32).toString("hex"))' };
  }
  if (value === KNOWN_BAD_JWT_SECRET || value === KNOWN_BAD_JWT_SECRET_LEGACY) {
    return { valid: false, reason: 'JWT_SECRET is set to a known committed/legacy fallback value' };
  }
  return { valid: true };
}
```

### CR-03: Raw database error messages leaked to client on signup failure

**File:** `apps/api/src/controllers/authController.ts:119-125`
**Issue:** The `catch` block in `signup` returns `error.message` directly to the caller (`res.status(500).json({ error: error.message || 'Internal server error' })`). Every other handler in this file (`login`, `verifyEmail`, `forgotPassword`, `resetPassword`, `getMe`) correctly returns a generic `'Internal server error'` message and logs the real error server-side only. A failed `INSERT`/constraint violation here (e.g. Postgres unique-violation, check-constraint, or column-type error) will leak internal schema details (table/column/constraint names) straight into the HTTP response — useful reconnaissance for an attacker and inconsistent with the rest of the file.
**Fix:**
```ts
} catch (error: any) {
  await client.query('ROLLBACK');
  console.error('Signup error:', error);
  res.status(500).json({ error: 'Internal server error' });
} finally {
  client.release();
}
```

## Warnings

### WR-01: Permissive CORS on both Express and Socket.IO

**File:** `apps/api/src/server.ts:29-36`
**Issue:** `new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } })` and `app.use(cors())` (no options) both allow every origin. Combined with CR-01, an attacker-controlled page can open a Socket.IO connection from any origin with no restriction. Even setting aside CR-01, an unrestricted CORS policy on the REST API is broader than necessary for a 3-subdomain SSO setup where the actual set of trusted origins (`NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL`) is already known and configured via env vars.
**Fix:** Build an allowlist from the existing `NEXT_PUBLIC_*_URL` env vars (or a new `ALLOWED_ORIGINS` var) and pass it to both `cors({ origin: allowlist })` and the Socket.IO `cors` option.

### WR-02: `jwt.verify()` calls do not pin an algorithm allowlist

**File:** `apps/api/src/core/auth/middleware.ts:21`, `apps/api/src/core/realtime/socket.ts:29`, `apps/api/src/domains/outlook/outlook.service.ts:86`
**Issue:** None of the `jwt.verify(token, getJwtSecret())` calls pass an `algorithms` option. Relying on the library's default algorithm inference is weaker than explicitly restricting to the algorithm actually used for signing (`HS256`, implied by `jwt.sign` never passing an `algorithm` option). Pinning `algorithms` is the standard defense against algorithm-confusion / downgrade classes of JWT vulnerabilities and costs nothing here.
**Fix:**
```ts
jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }, (err, user) => { ... });
```

### WR-03: `getJwtSecret()` can call `process.exit(1)` from inside request-handling code paths

**File:** `apps/api/src/core/config/secrets.ts:47-63`; called from `middleware.ts:21`, `authController.ts:165`, `socket.ts:29`, `outlook.service.ts:66,86`
**Issue:** `getJwtSecret()` re-validates `JWT_SECRET` on every call and calls `fail()` → `process.exit(1)` on invalid values. `validateSecretsOrExit()` already guarantees a valid value at boot, but `getJwtSecret()` is also invoked on every single authenticated HTTP request, every socket handshake, and every Outlook OAuth call. If `JWT_SECRET` is ever unset or mutated at runtime (e.g. secret-store rotation without a process restart, an orchestration tool clearing env vars, a bug elsewhere that mutates `process.env`), the very next incoming request kills the entire server process for all tenants instead of just failing that one request.
**Fix:** Keep the boot-time fail-fast behavior in `validateSecretsOrExit()`, but make the per-call `getJwtSecret()` throw a normal `Error`/`AppError` instead of exiting the process:
```ts
export function getJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  const result = validateJwtSecretValue(value);
  if (!result.valid) {
    throw new Error(`JWT_SECRET invalid at runtime: ${result.reason}`);
  }
  return value as string;
}
```

### WR-04: `ENCRYPTION_KEY` validation checks length but not hex format

**File:** `apps/api/src/core/config/secrets.ts:33-44` (consumed by `apps/api/src/core/crypto/secretBox.ts:23-29`)
**Issue:** `validateEncryptionKeyValue` only checks `value.length !== 64`. It does not check that all 64 characters are valid hex digits. `secretBox.ts`'s `getEncryptionKey()` does `Buffer.from(hex, 'hex')`, which silently stops decoding at the first invalid hex character and returns a truncated (wrong-length) buffer rather than throwing. A 64-character but non-hex `ENCRYPTION_KEY` therefore passes boot validation cleanly, then crashes the first `encryptSecret`/`decryptSecret` call at request time with `Invalid key length` — exactly the deferred-failure-at-runtime scenario this whole module is meant to prevent.
**Fix:**
```ts
export function validateEncryptionKeyValue(value: string | undefined): SecretValidationResult {
  if (!value) return { valid: false, reason: 'ENCRYPTION_KEY is unset or empty' };
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    return { valid: false, reason: 'ENCRYPTION_KEY must be a 64-char hex string' };
  }
  if (value === KNOWN_BAD_ENCRYPTION_KEY) {
    return { valid: false, reason: 'ENCRYPTION_KEY is set to a known committed fallback value' };
  }
  return { valid: true };
}
```

### WR-05: `verifyEmail`/`resetPassword` run `BEGIN`/`COMMIT` on the pool, not a dedicated client — not actually transactional

**File:** `apps/api/src/controllers/authController.ts:205-213, 280-288`
**Issue:** Both handlers call `db.query('BEGIN')`, then further `db.query(...)` calls, then `db.query('COMMIT')`. `db` (`apps/api/src/core/db/index.ts`) is a raw `pg.Pool`; each `pool.query()` call checks out and releases a connection independently. `BEGIN` runs on one pooled connection, the subsequent `UPDATE`/`DELETE` very likely run on different connections (each auto-committing individually outside any transaction), and `COMMIT` runs on yet another connection where no transaction is open. There is no actual atomicity: if the `UPDATE users SET is_verified` succeeds but the `DELETE FROM auth_tokens` fails, there is no rollback — contrast with `signup` in the same file, which correctly uses `const client = await db.connect()` for a dedicated client across the whole transaction.
**Fix:** Use a dedicated client, mirroring `signup`:
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

### WR-06: No rate limiting on `login`/`signup`/`forgotPassword`

**File:** `apps/api/src/controllers/authController.ts:13-183, 223-253`
**Issue:** None of `signup`, `login`, or `forgotPassword` are rate-limited or protected against repeated automated attempts. `login` relies solely on bcrypt's cost factor to slow down brute force; `forgotPassword` can be hammered to enumerate timing differences or to spam reset-token generation for a target account (each call deletes the previous token and issues a new one, so a resourced attacker can also grief a legitimate user's in-flight reset link).
**Fix:** Add a rate limiter (e.g. `express-rate-limit` keyed on IP + email) in front of these three routes.

### WR-07: Hardcoded weak default DB/Redis credentials in `docker-compose.yml`

**File:** `docker-compose.yml:7-9, 10-11, 44-45`
**Issue:** `POSTGRES_PASSWORD` defaults to the fallback `vectra_password` via `${POSTGRES_PASSWORD:-vectra_password}` if unset, unlike `JWT_SECRET`/`ENCRYPTION_KEY` in the same file which correctly have no fallback (`${JWT_SECRET}`, `${ENCRYPTION_KEY}` — empty if unset, which then trips `validateSecretsOrExit()`). Postgres and Redis ports are also published to the host (`5433:5432`, `6380:6379`), which isn't needed for inter-container traffic and increases the exposed attack surface if this compose file is ever run on a host with a routable IP.
**Fix:** Drop the `:-vectra_password` fallback (force explicit `.env` configuration, consistent with how `JWT_SECRET`/`ENCRYPTION_KEY` are already handled) and remove the host port publishes unless local host access to the DB is actually needed for development tooling.

## Info

### IN-01: Dead `TODO: Handle 2FA` alongside real `two_factor_secret` field

**File:** `apps/api/src/controllers/authController.ts:155, 171`
**Issue:** `login` has `// TODO: Handle 2FA check here if enabled` immediately before issuing a JWT unconditionally, yet `getMe`/`login` already scrub `user.two_factor_secret` from responses (line 171), implying the column and partial feature exist. This is either an unfinished security control being silently bypassed or genuinely dead code — worth resolving one way or the other rather than leaving indefinitely.
**Fix:** Either implement the 2FA gate before issuing the JWT, or remove the TODO and `two_factor_secret` references if 2FA is not planned for this milestone.

### IN-02: Test suite doesn't cover the hex-format gap in `validateEncryptionKeyValue`

**File:** `apps/api/src/core/config/secrets.test.ts:39-49`
**Issue:** Tests cover "wrong length" and "known-bad value" but no test asserts that a 64-character *non-hex* string is rejected — which is exactly the gap described in WR-04. Had this case been tested, the missing hex check would have been caught before review.
**Fix:** Add `test('ENCRYPTION_KEY 64 chars but not hex -> invalid', ...)` once WR-04 is fixed, asserting `validateEncryptionKeyValue('z'.repeat(64)).valid === false`.

### IN-03: Unbounded pagination loop in `syncEmails`

**File:** `apps/api/src/domains/outlook/outlook.service.ts:253-264`
**Issue:** `while (url) { ... }` follows `@odata.nextLink` with no iteration cap or timeout. A mailbox with a very large backlog since the last successful sync (e.g. first-ever 90-day backfill on a busy mailbox) has no upper bound on how long/how many pages a single scheduled sync call will run for. Not flagged as a correctness bug, but worth a sanity cap (e.g. max 20 pages) so one mailbox can't monopolize the sync worker indefinitely.
**Fix:** Track a page counter and `break` (recording `skipped: 'sync truncated at N pages'`) past a fixed maximum.

---

_Reviewed: 2026-07-12T09:45:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
