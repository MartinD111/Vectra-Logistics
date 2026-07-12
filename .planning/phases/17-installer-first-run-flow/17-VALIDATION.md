---
phase: 17
slug: installer-first-run-flow
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (via `ts-node/register`), matching `apps/api/package.json`'s existing test script |
| **Config file** | none — convention-based (`*.test.ts` colocated with source) |
| **Quick run command** | `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` |
| **Full suite command** | `npm test --workspace @vectra/api` |
| **Estimated runtime** | ~10 seconds (unit-only; live-DB smoke test is manual, not counted) |

---

## Sampling Rate

- **After every task commit:** Run `node --require ts-node/register --test apps/api/src/scripts/install.test.ts`
- **After every plan wave:** Run `npm test --workspace @vectra/api`
- **Before `/gsd:verify-work`:** Full suite must be green, PLUS a manual live-DB dry-run of the installer against a fresh Postgres container (see Manual-Only Verifications)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-0X | 01 | 0 | INS-01 | T-17-01 | Secret generation via `crypto.randomBytes(32)` produces unique, non-repo, 64-hex-char values on each call | unit | `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-0X | 01 | 1 | INS-01 | — | Schema-apply step is idempotent-guarded (`to_regclass('public.companies')`) and succeeds against a genuinely empty DB (no prior `init.sql`) | integration (manual) | live-DB smoke test | ❌ W0 | ⬜ pending |
| 17-01-0X | 01 | 1 | INS-01 | T-17-02 | Company/admin creation produces exactly one row each, bcrypt-hashed password, real email (not `admin@admin.com`) | integration (manual) | live-DB smoke test | ❌ W0 | ⬜ pending |
| 17-02-0X | 02 | 1 | INS-02 | — | Ollama reachability probe (`GET /api/tags`) returns true/false without throwing on unreachable endpoint | unit (mockable via axios interceptor or local test HTTP server) | `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-0X | 02 | 1 | INS-02 | — | Probe failure still writes `company_ai_config` with `provider:'local'` and a warning, not a hard failure | unit + integration | same as above (unit for logic; integration for DB write) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/scripts/install.test.ts` — stubs for INS-01 (secret generation, schema-apply guard logic) and INS-02 (probe logic) as pure/mockable unit tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema-apply against a genuinely empty database (no prior `init.sql`/`extensions.sql` run) | INS-01 | No live-DB fixture pattern exists in the current `node --test` harness; this execution environment has no live Postgres (same standing limitation noted for migrations 023/024 in STATE.md) | Spin up a fresh Postgres container with no init scripts mounted, run `npm run install:on-prem` (or equivalent), confirm `companies`/`users`/enum types are created and the migration runner then applies 002+ cleanly |
| Company + admin account creation end-to-end | INS-01 | Requires live Postgres to observe the actual inserted rows and bcrypt hash | Run the installer against a live test DB, query `companies`/`users` tables, confirm exactly one row each, password is bcrypt-hashed, email is the real value provided (not `admin@admin.com`) |
| Full installer run producing a bootable on-prem instance | INS-01, INS-02, INS-03 (DEPLOYMENT_MODE) | End-to-end system behavior spanning process boot, DB state, and env — not unit-testable | Run installer fresh, then boot the API with the resulting `.env`; confirm it serves traffic, registration is closed, and no cloud seed data is present |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-12
