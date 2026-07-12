---
phase: 14
slug: security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` (no Jest/Vitest installed) |
| **Config file** | none — invoked via `node --require ts-node/register --test src/**/*.test.ts` |
| **Quick run command** | `node --require ts-node/register --test src/core/config/secrets.test.ts` |
| **Full suite command** | `npm --prefix apps/api test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --require ts-node/register --test src/core/config/secrets.test.ts`
- **After every plan wave:** Run `npm --prefix apps/api test`
- **Before `/gsd:verify-work`:** Full suite must be green, plus both manual smoke checks below
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | SEC-01/SEC-02 | T-14-01 | `secrets.test.ts` stubs exist covering unset/empty/known-bad/valid cases for both vars | unit | `node --require ts-node/register --test src/core/config/secrets.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | SEC-01 | T-14-02 | `getEncryptionKey`-equivalent rejects unset/empty/known-bad `ENCRYPTION_KEY` | unit | `node --require ts-node/register --test src/core/config/secrets.test.ts` | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | SEC-02 | T-14-01 | `getJwtSecret()` rejects unset/empty/known-bad `JWT_SECRET`; accepts real value | unit | `node --require ts-node/register --test src/core/config/secrets.test.ts` | ✅ | ⬜ pending |
| 14-01-04 | 01 | 1 | SEC-01/SEC-02 | T-14-01/T-14-02 | `server.ts` calls `validateSecretsOrExit()` before `db.query`/`redisClient.connect()` | manual | `JWT_SECRET= ENCRYPTION_KEY= npm --prefix apps/api run dev` exits non-zero with clear error | — | ⬜ pending |
| 14-01-05 | 01 | 1 | SEC-02 | T-14-01 | 4 fallback call sites use `getJwtSecret()` lazily (no top-level module-scope reads) | source | `grep -rn "|| '.*secret.*'" apps/api/src` returns 0 matches | ✅ | ⬜ pending |
| 14-02-01 | 02 | 1 | SEC-03 | T-14-03 | `docker-compose.yml` no longer mounts `017_seed_admin_user.sql` into initdb | source | `grep -c "017_seed_admin_user" docker-compose.yml` returns 0 | ✅ | ⬜ pending |
| 14-02-02 | 02 | 1 | SEC-03 | T-14-03 | Fresh Postgres volume boot contains no `admin@admin.com` row | manual | `docker compose down -v && docker compose up -d postgres` then `psql ... -c "SELECT email FROM users WHERE email='admin@admin.com'"` returns 0 rows | — | ⬜ pending |
| 14-02-03 | 02 | 1 | SEC-04 (docs) | — | `.env.example` documents `JWT_SECRET`/`ENCRYPTION_KEY` with generation command | source | `grep -q "JWT_SECRET" .env.example && grep -q "randomBytes" .env.example` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/core/config/secrets.test.ts` — stubs for SEC-01/SEC-02 (unset/empty/known-bad/valid cases for `JWT_SECRET` and `ENCRYPTION_KEY`)
- No shared fixtures needed — existing `*.test.ts` files use inline data, no conftest-equivalent
- No framework install needed — `node:test` is built into Node.js 18+, already in use

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Boot fails cleanly with unset secrets | SEC-01, SEC-02 | Requires spawning a real subprocess and reading real `.env`/env state; stateful, slow relative to unit loop | `cd apps/api && JWT_SECRET= ENCRYPTION_KEY= npm run dev` — expect non-zero exit and a clear printed error before any DB/Redis connection attempt |
| Fresh install has no seeded admin | SEC-03 | Requires tearing down and re-provisioning a Docker Postgres volume — slow, stateful, environment-dependent | `docker compose down -v && docker compose up -d postgres`, then `docker exec vectra_postgres psql -U vectra_user -d vectra_db -c "SELECT email FROM users WHERE email='admin@admin.com'"` — expect 0 rows |
| Local dev still boots with real secrets | SEC-04 (success criterion #4) | End-to-end dev experience check, not a unit-testable assertion | Populate `.env` from `.env.example` with generated real values, run `npm --prefix apps/api run dev`, confirm normal startup (DB connect, Redis connect, listen) |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
