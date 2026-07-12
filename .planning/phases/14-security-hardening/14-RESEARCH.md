# Phase 14: Security Hardening - Research

**Researched:** 2026-07-12
**Domain:** Node.js/Express boot-time secret validation; Postgres `docker-entrypoint-initdb.d` seed-data removal
**Confidence:** HIGH

## Summary

This phase is small in surface area and entirely internal (no new packages, no new architecture layer) — it's a hardening pass over code and config that already mostly exists. Two independent problems, both already fully scoped by CONTEXT.md and the on-premise-deployment spec: (1) four call sites plus `docker-compose.yml` fall back to hardcoded weak secrets for `JWT_SECRET`, while `ENCRYPTION_KEY` already has one clean no-fallback reference implementation (`secretBox.ts`) to copy; (2) `017_seed_admin_user.sql` is unconditionally mounted into Postgres's `docker-entrypoint-initdb.d`, so every fresh install — dev or customer — gets `admin@admin.com`/`admin`.

The codebase has no shared config/env module today (`apps/api/src/core` has `auth/`, `crypto/`, `db/`, `errors/`, `events/`, `queue/`, `realtime/` — no `config/` or `env/`). This phase should introduce one. `secretBox.ts`'s `getEncryptionKey()` function is the exact pattern to generalize: read env var, validate presence/shape, throw on failure. The four `JWT_SECRET` fallback sites should all import from one new validated-read module instead of repeating `process.env.JWT_SECRET || '...'`.

For the seed-admin removal (SEC-03), there is no production-facing deployment path today distinct from `docker-compose.yml` — no `docker-compose.prod.yml` exists yet (that's Phase 16's DEP-01). This means Phase 14's only customer-facing artifact to fix is `docker-compose.yml`'s initdb mount itself, since it is — today — also the only path toward "customer install" that exists in the repo. CONTEXT.md's suggested interim mechanism (drop the mount, rely on `/api/auth/signup` self-registration) is confirmed viable: `authController.ts`'s `signup` handler already creates a company + admin-role user from scratch with no seed dependency.

**Primary recommendation:** Add a single `apps/api/src/core/config/secrets.ts` module exporting validated `getJwtSecret()` (mirroring `secretBox.ts`'s `getEncryptionKey()`), call both validators once eagerly at the very top of `server.ts` (before `dotenv.config()` side effects settle into `bootstrap()`), replace all four `JWT_SECRET` fallback usages with the new getter, strip both `docker-compose.yml` defaults, drop the `017_seed_admin_user.sql` initdb mount line, and add `JWT_SECRET`/`ENCRYPTION_KEY` (with generation comment) to `.env.example`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Boot-time secret validation | API / Backend (process startup) | — | Must run before any HTTP listener, DB, or Redis connection is established — a startup-sequence concern, not a request-time concern |
| Removing weak fallback secrets from 4 call sites | API / Backend | — | Pure code-level fix; each site already lives in `apps/api/src` |
| docker-compose.yml default stripping | Database / Storage config (deployment) | — | Compose file is infra-config, not app code, but it's the only "prod-like" artifact that exists pre-Phase 16 |
| Seed-admin exclusion | Database / Storage (migration/initdb mechanism) | API / Backend (signup fallback) | The seed lives in Postgres init scripts; the local-dev bootstrapping replacement (`/api/auth/signup`) lives in the API tier |

## Standard Stack

No new libraries are required for this phase. All work uses existing dependencies already in `apps/api/package.json`: `dotenv` (env loading, already used in `server.ts`), Node's built-in `crypto` module (already used in `secretBox.ts` for key validation patterns), and Node's built-in `node:test` + `node:assert/strict` (existing test runner, see Validation Architecture below).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled presence/shape checks | `zod` (already a dependency, used elsewhere for DTOs) for an `EnvSchema` | Zod is already in the project and DTO-validation is an established pattern (`dto/*.dto.ts`), but for 2 env vars with simple string/length checks, a schema library is more ceremony than the problem needs — plain functions mirroring `secretBox.ts`'s existing style are more consistent with the "reuse over rebuild" and minimal-footprint spirit of this phase. Zod remains a reasonable Claude's-discretion alternative if the planner prefers one canonical validation surface for future env vars too (Phase 16 will add `DEPLOYMENT_MODE`). |

**No installation step needed** — no `npm install` required for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. All work uses existing dependencies (`dotenv`, built-in `crypto`, built-in `node:test`).

## Architecture Patterns

### System Architecture Diagram

```
process start (npm run dev / node dist/server.js)
        │
        ▼
dotenv.config()  ── loads .env into process.env
        │
        ▼
[NEW] validateSecretsOrExit()  ← core/config/secrets.ts
        │
        ├─ ENCRYPTION_KEY unset/empty/== known-bad? ──► console.error + process.exit(1)
        ├─ JWT_SECRET unset/empty/== known-bad?      ──► console.error + process.exit(1)
        │
        ▼  (both valid)
bootstrap()
        │
        ├─ db.query("SELECT 1")        ← existing
        ├─ redisClient.connect()       ← existing
        ├─ startMatchingWorker() / startEmailWorker() / scheduleEmailSync()
        └─ server.listen(PORT)
        │
        ▼
Request-time JWT usage (unchanged call shape, new source):
  authController.ts login/signup  ──┐
  core/auth/middleware.ts         ──┼─► getJwtSecret()  (core/config/secrets.ts)
  core/realtime/socket.ts         ──┤     validated once at import/call time —
  outlook.service.ts              ──┘     same value already proven present by
                                           the boot-time check
```

### Recommended Project Structure
```
apps/api/src/core/
├── config/                    # NEW
│   └── secrets.ts             # getJwtSecret(), getEncryptionKeyHex()* validators
│                               #   + validateSecretsOrExit() for server.ts boot step
├── crypto/
│   └── secretBox.ts            # existing getEncryptionKey() — unchanged, already correct;
│                                #   config/secrets.ts's encryption-key check can either
│                                #   delegate to this or duplicate the same shape check —
│                                #   see Pattern 1 below for the tradeoff
```
*`secretBox.ts` already validates `ENCRYPTION_KEY` shape (64-char hex) every time it's called (lazy, per-call). The boot-time check needs the same validation to run once, eagerly, before `server.listen()`.

### Pattern 1: Boot-time fail-fast validation (extending `secretBox.ts`'s existing style)
**What:** A small module that validates required secrets are present, non-empty, and not equal to the known committed fallback strings, called once at process start before any I/O.
**When to use:** Any environment variable whose absence should hard-block boot rather than degrade silently.
**Example:**
```typescript
// Source: pattern generalized from apps/api/src/core/crypto/secretBox.ts (existing, already correct for ENCRYPTION_KEY)
// apps/api/src/core/config/secrets.ts

const KNOWN_BAD_JWT_SECRET = 'vectra-dev-secret-key-change-in-production';
const KNOWN_BAD_JWT_SECRET_LEGACY = 'super-secret-key-for-dev'; // the 4-call-site fallback string
const KNOWN_BAD_ENCRYPTION_KEY =
  '204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20';

function fail(varName: string, reason: string): never {
  console.error(`[boot] ${varName} ${reason}. Refusing to start.`);
  process.exit(1);
}

export function getJwtSecret(): string {
  const v = process.env.JWT_SECRET;
  if (!v) return fail('JWT_SECRET', 'is not set');
  if (v === KNOWN_BAD_JWT_SECRET || v === KNOWN_BAD_JWT_SECRET_LEGACY) {
    return fail('JWT_SECRET', 'is set to a known insecure default value');
  }
  return v;
}

export function validateSecretsOrExit(): void {
  getJwtSecret(); // throws/exits if invalid
  const enc = process.env.ENCRYPTION_KEY;
  if (!enc || enc.length !== 64) fail('ENCRYPTION_KEY', 'is missing or not 64-char hex');
  if (enc === KNOWN_BAD_ENCRYPTION_KEY) fail('ENCRYPTION_KEY', 'is set to a known insecure default value');
}
```
Call `validateSecretsOrExit()` as the first line of `bootstrap()` in `server.ts` (or immediately after `dotenv.config()`, before the `io`/`app` setup that doesn't strictly need secrets but keeps the fail-fast intent clear) — **before** `db.query`/`redisClient.connect()` so a misconfigured install never even attempts a DB connection.

### Pattern 2: Single-source-of-truth secret getter replacing duplicated fallbacks
**What:** Replace `const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';` (repeated identically in 4 files) with `import { getJwtSecret } from '../core/config/secrets'; const JWT_SECRET = getJwtSecret();` (or call `getJwtSecret()` inline at each `jwt.sign`/`jwt.verify` call site — module-load-time constant assignment is fine since `validateSecretsOrExit()` already ran in `server.ts` before any of these modules' importing code path executes requests).
**When to use:** Any place `JWT_SECRET` is read.
**Files to update:**
- `apps/api/src/controllers/authController.ts:9`
- `apps/api/src/core/auth/middleware.ts:5`
- `apps/api/src/core/realtime/socket.ts:5`
- `apps/api/src/domains/outlook/outlook.service.ts:12`

**Caution:** if `getJwtSecret()` is called at module-load time (top-level `const JWT_SECRET = getJwtSecret();`) in any of these 4 files, and one of those modules is imported *before* `server.ts`'s `validateSecretsOrExit()` runs (e.g. via a require chain triggered by an early import), `process.exit(1)` would still fire correctly (module-load order doesn't change the actual invalid value) — but the error would surface at a different import site than expected. Given `server.ts` already imports `authRoutes` → `authController` and `configureSocket` → `socket.ts` near the top of the file (before `bootstrap()` runs), all 4 modules load before `dotenv.config()` even runs on line 24 — **this is a real ordering hazard**. `dotenv.config()` must remain the first executable statement (already true at line 24), and any top-level `getJwtSecret()` call inside the 4 files will execute at `import` time, which happens *after* line 1-23's imports resolve but the actual function bodies of those imports run synchronously as soon as the file is required — Node resolves `import ... from './routes/authRoutes'` (line 10) *before* line 24's `dotenv.config()` executes, because ES module/CJS `require` transpilation hoists imports above other top-level code. **This means a naive top-level `const JWT_SECRET = getJwtSecret();` in `authController.ts` would run before `dotenv.config()` has loaded `.env`, seeing `undefined` even when `.env` has a valid value.**
**Fix:** call `getJwtSecret()` lazily — inside each function body (`login`, `authenticateToken`, the `io.use` handshake handler, `beginConnect`/`handleCallback`) — not as a top-level module constant. This also matches `secretBox.ts`'s own existing lazy-per-call pattern (`getEncryptionKey()` is called inside `encryptSecret`/`decryptSecret`, never cached at module scope) — precedent is already in the codebase and avoids the dotenv-ordering pitfall entirely, and requires no reordering of `server.ts`'s import list.

### Anti-Patterns to Avoid
- **Top-level `const JWT_SECRET = process.env.JWT_SECRET` (or a validated equivalent) at module scope in files imported before `dotenv.config()` runs:** as detailed above, this silently reads `undefined`/pre-dotenv state in the current `server.ts` import order. Always read inside the function body that needs it.
- **Throwing `AppError` for boot-time failures:** `AppError` is an HTTP-response construct (has a `status` field consumed by `errorHandler.ts` Express middleware) — there is no request/response cycle at boot time to catch it. Use `console.error` + `process.exit(1)`, matching `server.ts`'s existing `bootstrap()` catch block (lines 89-91).
- **Adding a `NODE_ENV`/`DEPLOYMENT_MODE` bypass to the boot check:** explicitly rejected by CONTEXT.md D-01 — the check must be universal with no exceptions, including local dev.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure random secret generation | A custom RNG/token generator | Node's built-in `crypto.randomBytes` — already documented in `secretBox.ts`'s header comment (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | Already the project's own documented convention; reuse the exact command in `.env.example` and any error messages, per CONTEXT.md D-04 and the on-prem spec §5.1 ("reuse it, don't invent a second method") |
| Bcrypt-hashing a new "safe" seed admin | A modified seed migration with a random password | Nothing — drop the seed mount entirely and rely on `/api/auth/signup` | CONTEXT.md's discretion note + on-prem spec §5.2 both point at self-registration/installer-driven creation, not a "safer" seed variant. A random-password seed still auto-creates an account nobody explicitly requested. |

**Key insight:** This phase is entirely about *removing* things (fallback strings, an initdb mount) and adding one small validated-read module — resist the urge to build new abstractions (env schema frameworks, secret rotation, etc.) beyond what SEC-01/02/03 literally require.

## Common Pitfalls

### Pitfall 1: dotenv load-order vs. module-level secret reads
**What goes wrong:** A top-level `const JWT_SECRET = getJwtSecret()` in a file imported before `dotenv.config()` executes reads `process.env.JWT_SECRET` as `undefined`, even though `.env` has a valid value — causing false-positive boot failures in local dev.
**Why it happens:** `server.ts` imports `authRoutes` (line 10, which transitively imports `authController.ts`) and `configureSocket`/`socket.ts` (line 22) *before* `dotenv.config()` runs on line 24. Node resolves all `import` statements before executing any top-level statement in the importing module, so any code that runs at import time in those dependency files executes before line 24.
**How to avoid:** Read `process.env.JWT_SECRET` lazily, inside function bodies (`login`, `authenticateToken`, the socket auth handshake, `beginConnect`/`handleCallback`), never as a cached top-level `const`. `secretBox.ts` already does this correctly for `ENCRYPTION_KEY` (calls `getEncryptionKey()` inside each function, never module-scope) — follow that precedent.
**Warning signs:** Boot succeeds in production build order but fails or reads stale values in dev (`npm run dev` via `ts-node-dev`), or vice versa — dotenv timing bugs are load-order-sensitive and can differ between `ts-node-dev`'s watch/respawn behavior and a plain `node dist/server.js` run.

### Pitfall 2: `docker-entrypoint-initdb.d` scripts only run once, on an empty data volume
**What goes wrong:** Removing the `017_seed_admin_user.sql` mount line from `docker-compose.yml` has **no effect** on any Postgres volume that has already been initialized (i.e. any developer's existing local `vectra_postgres` container/volume already has `admin@admin.com` seeded and will keep it — the fix only prevents it on *fresh* volumes going forward).
**Why it happens:** Postgres's official image only executes `docker-entrypoint-initdb.d/*` scripts when `PGDATA` is empty at container first-start; it is a first-run-only mechanism, not a reconciliation loop.
**How to avoid:** This is expected/acceptable for SEC-03 as scoped (which is about preventing the seed from running in *new* customer-facing installs, not retroactively removing an already-seeded local dev account) — but the planner should note in verification/success-criteria language that testing SEC-03 requires spinning up a **fresh** volume (`docker compose down -v` or a new volume name), not reusing an existing dev Postgres container, or the seed-admin row will still appear to "exist" and give a false sense that the mount removal didn't work.
**Warning signs:** Manual verification of SEC-03 that runs against an already-provisioned local Postgres volume will show `admin@admin.com` still present regardless of whether the mount was removed — this is not a bug in the fix, it's residual state from before the fix.

### Pitfall 3: No `docker-compose.prod.yml` exists yet — don't invent one in this phase
**What goes wrong:** Scope creep — since the on-prem spec's build order (§9) lists "fix §3 immediately" as step 1 and "production compose file" as step 3 (Phase 16/DEP-01), it would be tempting to also stand up a prod compose file here to give SEC-03 "somewhere real" to apply to.
**Why it happens:** SEC-03's phrasing ("never runs in any customer-facing install") sounds like it needs a customer-facing compose file to test against, but none exists until Phase 16.
**How to avoid:** Per the phase's own dependency note ("Nothing" — first phase of milestone) and ROADMAP.md's ordering rationale ("Phase 14 precedes Phase 15 so the default-admin seed is already excluded... before the migration runner formalizes execution"), Phase 14's fix is scoped to `docker-compose.yml` (today's only compose file) — dropping the initdb mount there is sufficient; Phase 16 will build `docker-compose.prod.yml` fresh, without ever adding the mount back.
**Warning signs:** A plan that adds `docker-compose.prod.yml` or a `DEPLOYMENT_MODE` env var — both are explicitly out of this phase's scope (`DEPLOYMENT_MODE` is Phase 16/DEP-02).

## Code Examples

### Existing correct reference pattern (model to copy)
```typescript
// Source: apps/api/src/core/crypto/secretBox.ts (existing code, already SEC-01-compliant)
function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new AppError(500, 'ENCRYPTION_KEY env var is missing or invalid (must be 64-char hex)');
  }
  return Buffer.from(hex, 'hex');
}
```
Note: this throws `AppError`, which is fine for `secretBox.ts` because it's called from request-time code paths (encrypting/decrypting integration secrets during an HTTP request) where `errorHandler.ts` can catch it. The **boot-time** check in `server.ts` needs a different failure mode (`process.exit(1)`, no HTTP context) — see Pattern 1 above. Do not reuse `AppError` for the boot-time path; it is the wrong error type for a pre-listen failure.

### docker-compose.yml diff shape (illustrative, not exact line numbers post-edit)
```yaml
# Before (lines 69-70):
      - JWT_SECRET=${JWT_SECRET:-vectra-dev-secret-key-change-in-production}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20}

# After:
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
```
```yaml
# Before (line 31, in postgres.volumes):
      - ./database/migrations/017_seed_admin_user.sql:/docker-entrypoint-initdb.d/18-seed-admin-user.sql:ro

# After: line removed entirely. Note the remaining initdb mounts (lines 32-34, migrations
# 018-020) keep their existing numeric prefixes (19, 20, 21) — do NOT renumber them; Postgres
# only cares about lexical/numeric sort order among files that exist, removing one entry doesn't
# require shifting the others' prefixes.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `process.env.X || 'fallback'` inline at 4+ call sites | Single validated getter module, called eagerly at boot + lazily at each use site | This phase (14) | Eliminates the "silently boots with a weak secret" failure mode; centralizes the "known bad value" denylist so it can't drift between call sites |
| `docker-entrypoint-initdb.d` seed admin, unconditional | Seed removed; self-registration (`/api/auth/signup`) is the only account-creation path until Phase 17's installer | This phase (14) | No account exists until someone explicitly registers — matches "never a fixed known password" from on-prem spec §3.2/§5.2 |

**Deprecated/outdated:** `017_seed_admin_user.sql`'s effect (not necessarily the file itself — the migration file can remain in `database/migrations/` for historical/idempotency-tracking reasons once Phase 15's migration runner exists, per MIG-01; this phase only needs to stop it from being *mounted into initdb*, not necessarily delete the file. Confirm with the planner whether deleting vs. merely un-mounting is preferred — see Open Questions).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Calling `getJwtSecret()`/secret validation lazily (inside function bodies) rather than at module top-level avoids the dotenv-load-order hazard described in Pitfall 1 | Pattern 2, Pitfall 1 | If the planner instead centralizes validation as a top-level constant in each of the 4 files, local dev boot could intermittently fail depending on ts-node-dev's specific transpilation/hoisting behavior — this should be verified by actually running `npm run dev` after the change, not just reasoned about statically |
| A2 | `017_seed_admin_user.sql` file itself can remain in `database/migrations/` (only the docker-compose mount needs removing) without violating SEC-03, since SEC-03's wording is about the seed's *effect* "never runs" | State of the Art, Don't Hand-Roll | If the planner/user intends full deletion of the file too, leaving it could look like incomplete work even though functionally correct — low risk since Phase 15's migration runner (MIG-01) will need to decide how to treat this file anyway (skip-list vs. delete) |
| A3 | No separate customer-facing compose/entrypoint path exists today distinct from `docker-compose.yml` | Summary, Pitfall 3 | Verified directly — `find`/`Glob` for `docker-compose*.yml` in the repo root returned only `docker-compose.yml`. High confidence, not really an assumption, but flagged since the on-prem spec explicitly discusses a future prod compose file that doesn't exist yet |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `017_seed_admin_user.sql` be deleted outright, or just un-mounted from `docker-compose.yml`?**
   - What we know: CONTEXT.md's discretion note and the on-prem spec both frame this as "exclude from the customer-facing path" — the *mount* is the concrete customer-facing mechanism today. The file's continued existence in `database/migrations/` doesn't run anything on its own without the initdb mount.
   - What's unclear: Whether Phase 15's migration runner (MIG-01, reads `database/migrations/*.sql` in numeric order) would pick this file up and re-apply its `INSERT ... ON CONFLICT DO NOTHING` once it exists — which would reintroduce the seed via a different mechanism than the one this phase fixes.
   - Recommendation: Un-mount from `docker-compose.yml` now (satisfies SEC-03 for the only customer-facing path that exists today); leave a decision for Phase 15's planner about whether the migration runner's file-list should explicitly skip `017_seed_admin_user.sql` (or the file should be deleted/neutralized at that time) — flag this explicitly as a Phase 15 dependency note so it isn't silently reintroduced.

2. **Should the "known bad" JWT_SECRET denylist include both `vectra-dev-secret-key-change-in-production` (compose-level) and `super-secret-key-for-dev` (4-call-site level), or just one?**
   - What we know: CONTEXT.md D-02 explicitly names both strings as needing denylist treatment.
   - What's unclear: Nothing — this is already answered by CONTEXT.md, included here only to confirm the research aligns (it does — see Pattern 1's `KNOWN_BAD_JWT_SECRET` + `KNOWN_BAD_JWT_SECRET_LEGACY` constants).
   - Recommendation: Include both, as CONTEXT.md specifies.

## Environment Availability

Skipped — this phase has no external tool/service dependencies beyond what's already running in the existing dev stack (Node.js, Postgres via Docker, already-installed npm packages). No new CLI tools, runtimes, or services are introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` (no Jest/Vitest installed) |
| Config file | none — invoked directly via `node --require ts-node/register --test src/**/*.test.ts` |
| Quick run command | `npm --prefix apps/api test -- --test-name-pattern="secrets"` (once new test file(s) exist, filter by name) |
| Full suite command | `npm --prefix apps/api test` |

Existing precedent: `apps/api/src/domains/outlook/email.matcher.test.ts` and 2 other `*.test.ts` files use `import { test } from 'node:test'; import assert from 'node:assert/strict';` with plain `test('description', () => { ... })` blocks — no mocking framework, no fixtures directory, pure function tests. Follow this exact style for new secret-validation tests.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `getEncryptionKey`-equivalent check in the new boot-validation module rejects unset/empty/known-bad `ENCRYPTION_KEY` | unit | `node --require ts-node/register --test src/core/config/secrets.test.ts` | ❌ Wave 0 |
| SEC-02 | New `getJwtSecret()` rejects unset/empty/known-bad `JWT_SECRET`; accepts a real value | unit | `node --require ts-node/register --test src/core/config/secrets.test.ts` | ❌ Wave 0 |
| SEC-01/02 (boot integration) | Starting the process (`node -e` shim or a small script invoking `bootstrap()`'s validation step) with `JWT_SECRET`/`ENCRYPTION_KEY` unset exits non-zero with a printed error; with valid values, validation passes and does not exit | smoke (manual or scripted subprocess) | Manual: `JWT_SECRET= ENCRYPTION_KEY= npm --prefix apps/api run dev` should exit immediately with a clear error printed; automating this as a real subprocess-spawn test is optional given the unit tests above already cover the actual validation logic | — (manual-only acceptable; see justification below) |
| SEC-03 | Fresh Postgres volume boot does not contain `admin@admin.com` in `users` table; `docker-compose.yml` no longer mounts `017_seed_admin_user.sql` | manual/smoke | `grep -c "017_seed_admin_user" docker-compose.yml` should be 0; live verification: `docker compose down -v && docker compose up -d postgres` then `docker exec vectra_postgres psql -U vectra_user -d vectra_db -c "SELECT email FROM users WHERE email='admin@admin.com'"` should return 0 rows | — (manual — see justification) |

**Manual-only justification:** SEC-03's real verification requires tearing down a Docker volume and re-provisioning Postgres from scratch (a slow, stateful, environment-dependent operation not suited to a fast unit-test loop) — grep-checking `docker-compose.yml` for the removed mount line is the fast automatable proxy; the full fresh-volume check belongs at phase-gate/human-verification time, matching Pitfall 2 above. The boot-integration smoke test for SEC-01/02 is similarly stateful (spawns a real subprocess, reads real `.env`); the unit tests of `secrets.ts`'s pure validation functions are the correct place for fast, sampled coverage, with the manual boot check as a phase-gate/final confirmation only.

### Sampling Rate
- **Per task commit:** `node --require ts-node/register --test src/core/config/secrets.test.ts`
- **Per wave merge:** `npm --prefix apps/api test` (full suite — currently 3 existing test files + new secrets tests)
- **Phase gate:** Full suite green, plus the two manual smoke checks (boot-fail with unset secrets; fresh-volume no-seed-admin) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/core/config/secrets.test.ts` — new file, covers SEC-01/SEC-02 (unset/empty/known-bad/valid cases for both `JWT_SECRET` and `ENCRYPTION_KEY`)
- [ ] No shared fixtures/conftest-equivalent needed — `node:test` files here are pure-function tests with inline data, matching existing 3 test files' style
- [ ] No framework install needed — `node:test` is built into Node.js 18+, already in use

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | JWT signing secret must be a real, non-default, non-empty value (SEC-02) — this phase directly implements ASVS V2's "verifier secrets shall not use default/weak values" requirement |
| V3 Session Management | no | JWT session mechanics themselves (expiry, refresh) are unchanged in this phase — out of scope |
| V4 Access Control | no | No RBAC/authorization logic changes in this phase |
| V5 Input Validation | no | No new user-facing input surface in this phase (env vars are operator-provided config, not user input) |
| V6 Cryptography | yes | `ENCRYPTION_KEY` (AES-256-GCM key material via `secretBox.ts`) must be a real, non-default 32-byte value (SEC-01) — this phase directly implements ASVS V6's "no hardcoded/default cryptographic keys" requirement |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Shared/default JWT signing secret across installs | Spoofing (forged tokens if secret is guessable/shared) | Boot-time rejection of unset or known-default `JWT_SECRET` (this phase) |
| Shared/default at-rest encryption key across installs | Information Disclosure (any install's encrypted integration secrets could be decrypted by anyone who knows the committed default) | Boot-time rejection of unset or known-default `ENCRYPTION_KEY` (this phase) |
| Default/known admin credentials shipped in product | Elevation of Privilege (unauthenticated attacker logs in as admin on any un-hardened install) | Removing the seed-admin mount from customer-facing provisioning (SEC-03); self-registration creates the first admin instead |

## Sources

### Primary (HIGH confidence)
- `apps/api/src/core/crypto/secretBox.ts` — existing correct no-fallback pattern for `ENCRYPTION_KEY`, read directly from the repo
- `apps/api/src/workers/telematics.worker.ts` — second existing no-fallback `ENCRYPTION_KEY` reference, read directly from the repo
- `apps/api/src/server.ts` — actual `bootstrap()` structure and import order, read directly (confirms the dotenv-load-order hazard in Pitfall 1)
- `docker-compose.yml` — actual current mount list and secret defaults, read directly
- `database/migrations/017_seed_admin_user.sql` — actual seed content, read directly
- `docs/specs/deployment/on-premise-deployment.md` §3, §5.1, §5.2, §9 — canonical spec named in CONTEXT.md's `canonical_refs`, read directly
- `.planning/phases/14-security-hardening/14-CONTEXT.md` — locked decisions D-01 through D-04, read directly
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement text and project history, read directly
- 4 fallback call sites (`authController.ts`, `core/auth/middleware.ts`, `core/realtime/socket.ts`, `outlook.service.ts`) and root `.env.example` / `apps/api/.env.example` — all read directly, confirming exact line numbers and current values
- Existing test files (`email.matcher.test.ts`, `creditRisk.evaluator.test.ts`, `outlook.service.test.ts`) — confirm `node:test` framework and style, read directly
- `apps/api/package.json` — confirms `"test": "node --require ts-node/register --test src/**/*.test.ts"` script, read directly

### Secondary (MEDIUM confidence)
- None — all findings in this research were verified directly against the repository; no external web sources were needed since this phase is entirely internal code/config hardening with no new library integration.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; verified directly against existing package.json and code
- Architecture: HIGH - both patterns (boot validation, seed removal) are directly modeled on existing in-repo code (`secretBox.ts`) and directly verified file contents (`server.ts`, `docker-compose.yml`)
- Pitfalls: HIGH - the dotenv-load-order hazard (Pitfall 1) and initdb-once-only behavior (Pitfall 2) are both verifiable facts about Node's module resolution and Postgres's documented initdb behavior, not speculative

**Research date:** 2026-07-12
**Valid until:** 30 days (stable, internal-only change; no external API/library version drift risk)
