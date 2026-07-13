---
phase: 20
slug: deploy-hardening-connectivity-doc
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict`, run via `ts-node/register` |
| **Config file** | none — driven by `apps/api/package.json`'s `"test"` script |
| **Quick run command** | `node --require ts-node/register --test src/<path>/<file>.test.ts` (per-file) |
| **Full suite command** | `npm test --workspace=apps/api` |
| **Estimated runtime** | ~10-20 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific new/updated test file(s) for that task.
- **After every plan wave:** Run `npm test --workspace=apps/api` (full suite).
- **Before `/gsd:verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-TBD | TBD | 0 | HRD-01 | Cross-origin credential/data leakage via wide-open CORS | `getAllowedOrigins()` parses `CORS_ALLOWED_ORIGINS`, falls back to `NEXT_PUBLIC_*_URL` vars | unit | `node --require ts-node/register --test src/core/config/cors.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-TBD | TBD | 0 | HRD-01 | Cross-origin credential/data leakage via wide-open CORS | Express `cors()` rejects a disallowed `Origin`, allows a listed one | integration | `node --require ts-node/register --test src/server.cors.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-TBD | TBD | 0 | HRD-02 | Credential stuffing / brute-force against `/api/auth/login` | Repeated `POST /api/auth/login` past threshold returns 429 with `{ error }` | integration | `node --require ts-node/register --test src/routes/authRoutes.ratelimit.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-TBD | TBD | 0 | HRD-03 | Silent unhealthy instance kept in load-balancer rotation | `checkDependencyHealth()` returns `down` when a check rejects, `ok` when it resolves | unit | `node --require ts-node/register --test src/core/health/health.service.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-TBD | TBD | 0 | HRD-03 | Silent unhealthy instance kept in load-balancer rotation | `GET /health` returns 503 with `dependencies` breakdown on failure | integration | `node --require ts-node/register --test src/server.health.test.ts` | ✅ (exists, needs update) | ⬜ pending |
| 20-01-TBD | TBD | 0 | DOC-01 | N/A | New `docs/DEPLOYMENT.md` connectivity section covers webhooks/pod/reverse-proxy posture | manual | N/A — documentation content | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/core/config/cors.test.ts` — unit tests for `getAllowedOrigins()` (env var present, env var absent + fallback, env var absent + no fallback vars set → empty array)
- [ ] `apps/api/src/server.cors.test.ts` — integration test asserting a disallowed `Origin` header is rejected and an allowed one succeeds, following `server.health.test.ts`'s `http.createServer(app)` pattern
- [ ] `apps/api/src/routes/authRoutes.ratelimit.test.ts` — integration test hammering `POST /api/auth/login` past the threshold and asserting a 429 with the expected JSON shape
- [ ] `apps/api/src/core/health/health.service.test.ts` — unit tests for `checkDependencyHealth()` with mock `queryPostgres`/`pingRedis` (both succeed, postgres fails, redis fails, both fail)
- [ ] Update `apps/api/src/server.health.test.ts` — must not break when `/health` starts calling `redisClient.ping()`/`db.query()` on a client never `.connect()`-ed in the test process (bootstrap-bypass pitfall); mock at module level or assert 503 in this unmodified-test context if real DB/Redis aren't reachable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New `docs/DEPLOYMENT.md` connectivity section content accuracy | DOC-01 | Documentation content, no automated test applies | Read the new section; confirm it covers webhook routes (`/api/webhooks/*`), POD public-route rationale (`/api/pod/*`), Outlook OAuth callback caveat, and the recommended reverse-proxy posture, matching `docs/specs/deployment/on-premise-deployment.md` §7 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-13 (gsd-plan-checker Dimension 8 pass)
