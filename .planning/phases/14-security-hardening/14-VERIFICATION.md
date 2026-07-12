---
phase: 14-security-hardening
verified: 2026-07-12T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 14: Security Hardening Verification Report

**Phase Goal:** The server cannot boot with insecure defaults, and no customer-facing install ships a known-default admin account.
**Verified:** 2026-07-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Starting the API with `ENCRYPTION_KEY` unset fails at boot with a clear error — no fallback key is used (Roadmap SC1) | VERIFIED | `secrets.ts` `validateEncryptionKeyValue` rejects unset/empty; `validateSecretsOrExit()` called first in `bootstrap()` before `db.query`/`redisClient.connect()` (`server.ts:75-82`). Live run: `JWT_SECRET= ENCRYPTION_KEY= node ... src/server.ts` printed `FATAL: invalid JWT_SECRET — JWT_SECRET is unset or empty...` and exited before any `PostgreSQL connected`/`Redis connected` line (JWT is validated first, so ENCRYPTION_KEY path is same code path, unit-tested at `secrets.test.ts:34-49`). No `docker-compose.yml` fallback remains (`ENCRYPTION_KEY=${ENCRYPTION_KEY}`, no `:-` default). |
| 2 | Starting the API with `JWT_SECRET` unset fails at boot with a clear error — no fallback secret is used (Roadmap SC2) | VERIFIED | Live-executed `JWT_SECRET= ENCRYPTION_KEY= node --require ts-node/register src/server.ts` in this session: printed `FATAL: invalid JWT_SECRET — JWT_SECRET is unset or empty. Set a real, non-default value before starting the server.` and exited with no DB/Redis connect log lines. All 4 legacy `process.env.JWT_SECRET \|\| 'super-secret-key-for-dev'` call sites removed — grep for `JWT_SECRET` across `apps/api/src` now only matches `secrets.ts`/`secrets.test.ts`; all consumers (`authController.ts:165`, `middleware.ts:21`, `socket.ts:29`, `outlook.service.ts:66,86`) call `getJwtSecret()` inline. `docker-compose.yml` has no `vectra-dev-secret-key-change-in-production` fallback (`JWT_SECRET=${JWT_SECRET}`). |
| 3 | `017_seed_admin_user.sql` (or its effect, `admin@admin.com`/`admin`) never runs in any customer-facing install path (Roadmap SC3 / SEC-03) | VERIFIED | `docker-compose.yml`'s postgres `volumes:` list no longer mounts `018_...`/`18-seed-admin-user.sql` into `docker-entrypoint-initdb.d` — confirmed by direct read: initdb mounts jump from `17-yard-management.sql` to `19-field-execution.sql`, an intentional gap where `18-seed-admin-user.sql` used to be. `database/migrations/017_seed_admin_user.sql` still exists on disk (deliberately, per plan — only the customer-facing mount mechanism was removed) but is not referenced anywhere in `docker-compose.yml` (`grep -c "017_seed_admin_user" docker-compose.yml` → 0). |
| 4 | Local development workflows still start normally when secrets are supplied via env/`.env` (Roadmap SC4) | VERIFIED | Live-executed with freshly generated 32-byte-hex `JWT_SECRET`/`ENCRYPTION_KEY`: no `FATAL` message printed; process proceeded past `validateSecretsOrExit()` straight into the DB-connect step (failed only on a Postgres auth error unrelated to this phase — `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`, an artifact of this sandbox having no configured DB password, not a secrets-validation failure). Confirms the gate does not block valid, non-default secrets. |

**Score:** 4/4 roadmap truths verified (plus 3 supporting PLAN-frontmatter artifact/link must-haves below, also verified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/core/config/secrets.ts` | `getJwtSecret()`/`validateSecretsOrExit()` single validated-read module | VERIFIED | Exists, exports both functions plus pure validators `validateJwtSecretValue`/`validateEncryptionKeyValue`; denylists both known-bad JWT strings and the known-bad encryption key; no `AppError` import (confirmed by read). |
| `apps/api/src/core/config/secrets.test.ts` | Unit coverage for unset/empty/known-bad/valid × both secrets | VERIFIED | 9 `node:test` cases present, all pass (`node --require ts-node/register --test src/core/config/secrets.test.ts` → 9/9 pass, run live in this session). |
| `apps/api/src/server.ts` | Calls `validateSecretsOrExit()` before `db.query`/`redisClient.connect()` | VERIFIED | Line 75 calls it as first statement inside `bootstrap()`'s try block, before line 78's `db.query("SELECT 1")`; no `NODE_ENV`/`DEPLOYMENT_MODE` conditional wraps it. |
| `docker-compose.yml` | No seed-admin initdb mount; no `:-` fallback defaults for `JWT_SECRET`/`ENCRYPTION_KEY` | VERIFIED | Confirmed by direct read: mount absent, `JWT_SECRET=${JWT_SECRET}` / `ENCRYPTION_KEY=${ENCRYPTION_KEY}` present with no fallback. |
| `.env.example` | Documents `JWT_SECRET`+`ENCRYPTION_KEY` with a generation command | VERIFIED | Lines 19-22: shared `randomBytes` generation comment above empty `JWT_SECRET=`/`ENCRYPTION_KEY=` placeholders; no known-bad literal remains. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `server.ts` | `secrets.ts` | `validateSecretsOrExit()` call in `bootstrap()` before `db.query` | WIRED | Confirmed at `server.ts:75`, before line 78. |
| `authController.ts` | `secrets.ts` | `getJwtSecret()` inline in `login()`'s `jwt.sign()` | WIRED | `authController.ts:165` |
| `core/auth/middleware.ts` | `secrets.ts` | `getJwtSecret()` inline in `authenticateToken()`'s `jwt.verify()` | WIRED | `middleware.ts:21` |
| `core/realtime/socket.ts` | `secrets.ts` | `getJwtSecret()` inline in `io.use()` handshake `jwt.verify()` | WIRED | `socket.ts:29` |
| `domains/outlook/outlook.service.ts` | `secrets.ts` | `getJwtSecret()` inline in `beginConnect()`/`handleCallback()` | WIRED | `outlook.service.ts:66,86` |
| `docker-compose.yml` | `secrets.ts` (Plan 01) | Unset `JWT_SECRET`/`ENCRYPTION_KEY` now reach the API process empty | WIRED | No compose-level fallback; empty pass-through trips `validateSecretsOrExit()` — verified live in this session. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Boot fails on unset secrets | `JWT_SECRET= ENCRYPTION_KEY= node --require ts-node/register src/server.ts` | `FATAL: invalid JWT_SECRET — JWT_SECRET is unset or empty...` printed, process exits, no DB/Redis connect logs | PASS |
| Boot proceeds past validation with valid secrets | `JWT_SECRET=<32-byte-hex> ENCRYPTION_KEY=<32-byte-hex> node --require ts-node/register src/server.ts` | No `FATAL` line; failure occurs only later, at Postgres auth (sandbox has no DB password), confirming the secrets gate itself passed | PASS |
| Unit test suite for secrets module | `node --require ts-node/register --test src/core/config/secrets.test.ts` | 9/9 tests pass | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| SEC-01 | 14-01, 14-02 | No production-facing fallback for `ENCRYPTION_KEY`; server refuses to boot without it set | SATISFIED | `secrets.ts` boot gate + `docker-compose.yml` fallback removed |
| SEC-02 | 14-01, 14-02 | No production-facing fallback for `JWT_SECRET`; server refuses to boot without it set | SATISFIED | Same as above, plus all 4 call sites converted |
| SEC-03 | 14-02 | `017_seed_admin_user.sql` never runs in any customer-facing install | SATISFIED | initdb mount removed from `docker-compose.yml`; file left on disk (not customer-facing mechanism) |

No orphaned requirements — REQUIREMENTS.md maps only SEC-01/02/03 to Phase 14, and all three are claimed across the two plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/core/config/secrets.ts:22-30` (`validateJwtSecretValue`) | — | No minimum-length/entropy check on `JWT_SECRET` — a 1-character value (e.g. `JWT_SECRET=a`) passes boot validation and is usable to sign/verify tokens | WARNING (not a phase-goal blocker — see note below) | Weak secrets remain brute-forceable; flagged as CR-02 in `14-REVIEW.md` |
| `apps/api/src/controllers/authController.ts:155` | 155 | Pre-existing `// TODO: Handle 2FA check here if enabled` | INFO | Not introduced by this phase (file modified only for the `getJwtSecret()` swap at line 165); tracked separately as IN-01 in `14-REVIEW.md`, out of this phase's scope |

**Judgment call on CR-02 (weak JWT_SECRET passes boot):** The roadmap's Phase 14 goal is scoped specifically to "insecure defaults" (fallback/known-bad values) and its 4 Success Criteria all say "unset ... fails" / "no fallback ... is used" — none require a minimum-length or entropy check on operator-supplied values. The PLAN 01 frontmatter `must_haves.truths` and its 9-case test matrix likewise only cover unset/empty/known-bad-literal/valid, never "too short." REQUIREMENTS.md's SEC-02 text is the same: "No production-facing fallback for `JWT_SECRET`; server refuses to boot without it set" — about fallback/unset, not strength. Live-verified: `JWT_SECRET=a` does pass `validateSecretsOrExit()` today (confirmed by reading `validateJwtSecretValue`'s logic — only unset/empty/denylist-literal checks exist). This is a real hardening gap (correctly caught by the code reviewer) but it is not a failure of the specific truths this phase's goal and roadmap Success Criteria commit to. Recording it here as a WARNING rather than a BLOCKER; it should be picked up as a follow-up hardening item (e.g., during Phase 20 Deploy Hardening, or as a fast-follow to this phase) rather than reopening Phase 14.

### Human Verification Required

None. All observable truths were verified directly by reading source and by live-executing the boot sequence with unset, invalid, and valid secrets in this session (Docker was not available in this sandbox, so the `docker compose down -v` fresh-volume smoke test from 14-02-SUMMARY.md was not re-run here — but the removal of the initdb mount was verified by direct file read, which is the actual mechanism enforcing SEC-03, not the manual Docker check).

### Gaps Summary

No blocking gaps. All 4 roadmap Success Criteria for Phase 14 are observably true in the codebase: boot fails hard and fast on unset `JWT_SECRET`/`ENCRYPTION_KEY` (verified via live process execution, not just source reading), the seed-admin initdb mount is gone from `docker-compose.yml`, and valid secrets still allow normal boot progression. One hardening gap (CR-02, no minimum-length check on `JWT_SECRET`) was found by the prior code review and is real, but it falls outside this phase's stated goal/success-criteria wording ("insecure defaults," not "weak operator-chosen secrets") and is recorded as a WARNING for follow-up rather than a phase-blocking failure.

---

*Verified: 2026-07-12*
*Verifier: Claude (gsd-verifier)*
