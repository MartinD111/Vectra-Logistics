---
phase: 20-deploy-hardening-connectivity-doc
verified: 2026-07-13T07:40:28Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 20: Deploy Hardening & Connectivity Doc Verification Report

**Phase Goal:** Harden the deployment surface before GA — restrict CORS/Socket.IO to an origin allowlist (HRD-01), add rate limiting to auth endpoints (HRD-02), make /health perform a live Postgres/Redis check (HRD-03), and document the inbound-connectivity posture for operators (DOC-01).
**Verified:** 2026-07-13T07:40:28Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (HRD-01) Disallowed browser origin rejected by both Express CORS and Socket.IO handshake | ✓ VERIFIED | `apps/api/src/server.ts:44-63` — single `getAllowedOrigins()` call shared by `io` (`cors.origin: allowedOrigins`) and `app.use(cors({origin: fn}))`. `apps/api/src/server.cors.test.ts` — both allow/deny paths pass (`✔ GET /health with allowed Origin...`, `✔ GET /health with disallowed Origin...`, observed in test run). |
| 2 | (HRD-01) Allowed origin (explicit or `NEXT_PUBLIC_*_URL` fallback) succeeds unchanged | ✓ VERIFIED | `apps/api/src/core/config/cors.ts:23-42` implements explicit `CORS_ALLOWED_ORIGINS` + 3-var fallback; `cors.test.ts` covers all 4 behaviors (part of 90/90 passing suite). |
| 3 | (HRD-01) Operator can add/remove origins via env only | ✓ VERIFIED | `CORS_ALLOWED_ORIGINS` documented in `.env.example`; no code change needed to alter allowlist. |
| 4 | (HRD-02) 21st request to a mutation `/api/auth/*` route in 15-min window returns 429 | ✓ VERIFIED | `apps/api/src/routes/authRoutes.ts:8-26` — `authRateLimiter` (`windowMs: 15*60*1000, limit: 20`) applied individually to signup/login/verify-email/forgot-password/reset-password. `authRoutes.ratelimit.test.ts` sends 21 sequential requests, asserts 21st is `429` with `{error:'Too many requests. Please try again later.'}` — passing in the 90/90 suite. |
| 5 | (HRD-02) `GET /api/auth/me` is not throttled | ✓ VERIFIED | `authRoutes.ts:27` — `router.get('/me', authenticateToken, getMe)` has no `authRateLimiter` argument. |
| 6 | (HRD-02) 429 body matches `{error: message}` convention | ✓ VERIFIED | `authRoutes.ts:17-19` handler returns `res.status(429).json({error: 'Too many requests. Please try again later.'})`; asserted in ratelimit test. |
| 7 | (HRD-03) `GET /health` performs a live per-request Postgres/Redis check, 200 when both reachable | ✓ VERIFIED | `health.service.ts` — `checkDependencyHealth` via `Promise.allSettled`, no caching; `server.ts:87-99` wires real `db.query`/`redisClient.ping` probes, computed fresh every request. `health.service.test.ts` covers all 4 ok/down combinations (part of 90/90 suite). |
| 8 | (HRD-03) 503 with per-dependency breakdown when either dependency unreachable | ✓ VERIFIED | `server.ts:92-98` — `allOk` gate, `res.status(allOk?200:503).json({status, dependencies,...})`. `server.health.test.ts` asserts `dependencies.postgres`/`.redis` each `'ok'|'down'` and status/HTTP-code consistency — passing. |
| 9 | (HRD-03) version field preserved in both success/failure bodies | ✓ VERIFIED | `server.ts:96` — `version: getVersion()` present regardless of `allOk`. |
| 10 | (DOC-01) `docs/DEPLOYMENT.md` documents inbound-connectivity posture (webhooks/POD public, everything else internal, Outlook OAuth caveat, recommended reverse-proxy posture) | ✓ VERIFIED | `docs/DEPLOYMENT.md:129-165` — new `## Inbound connectivity` section between "Upgrading a running install" and "Outlook / Microsoft 365 integration"; table with `/api/webhooks/*` and `/api/pod/*` rows, "Recommended posture" paragraph, Outlook OAuth callback caveat cross-referencing the existing section without restating the literal callback URL. |
| 11 | (CR-01 post-review fix) Rate limiter does not 500 when `X-Forwarded-For` is present and the reverse-proxy topology documented in DOC-01 is followed | ✓ VERIFIED | `server.ts:32-42` — `TRUST_PROXY_HOPS` env var, fail-closed default (unset → `trust proxy` left `false`). Manually reproduced in this verification session against the real `app` export: with `TRUST_PROXY_HOPS` unset + `X-Forwarded-For` header on `POST /api/auth/login`, `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` still fires (expected — fail-closed default requires explicit opt-in). With `TRUST_PROXY_HOPS=1` set, the same request no longer throws that error (the only remaining 500 in that run was an unrelated Postgres SASL auth failure from the no-DB test environment, not the rate-limiter bug). `docs/DEPLOYMENT.md:158-165` documents the requirement next to "Recommended posture". Regression tests `server.trustproxy.test.ts` / `server.trustproxy-set.test.ts` assert `app.get('trust proxy')` reflects the env var in both states — both pass in the 90/90 suite. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/core/config/cors.ts` | `getAllowedOrigins()` single source of truth | ✓ VERIFIED | Exports function, no `process.exit`, no module-scope env read. |
| `apps/api/src/server.ts` | Express `cors()` + Socket.IO both wired to `getAllowedOrigins()`; `trust proxy` configured via `TRUST_PROXY_HOPS`; async `/health` with live probes | ✓ VERIFIED | Confirmed by direct read, lines 25-99. |
| `apps/api/src/server.cors.test.ts` | Integration proof of allow/deny | ✓ VERIFIED | 2 tests, both passing. |
| `apps/api/src/routes/authRoutes.ts` | `authRateLimiter` applied individually to 5 mutation routes | ✓ VERIFIED | `grep -c authRateLimiter` = 6 (1 decl + 5 usages). |
| `apps/api/src/routes/authRoutes.ratelimit.test.ts` | 429-threshold proof | ✓ VERIFIED | 21-request loop, asserts 21st is 429 with correct body; passing. |
| `apps/api/src/core/health/health.service.ts` | `checkDependencyHealth`, DI-based, pure | ✓ VERIFIED | No `db`/`redisClient` import, no `process.env`. |
| `docs/DEPLOYMENT.md` | New `## Inbound connectivity` section | ✓ VERIFIED | Present at line 129, correct position, required content. |
| `apps/api/src/server.trustproxy.test.ts`, `server.trustproxy-set.test.ts` | Regression coverage for CR-01 fix | ✓ VERIFIED | Both assert `trust proxy` app setting in unset/set states; passing. Manually extended in this verification with an HTTP-level repro (not committed — scratch-only) confirming the underlying `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` is actually resolved when `TRUST_PROXY_HOPS=1`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `server.ts` (Socket.IO + Express) | `cors.ts` | `getAllowedOrigins()` called once, shared array | ✓ WIRED | Single call site at line 45, reused by both `io` cors option and `app.use(cors(...))`. |
| `authRoutes.ts` | `express-rate-limit` | `rateLimit({...})` instance applied per-route | ✓ WIRED | `authRateLimiter` used on all 5 mutation routes, absent on `/me`. |
| `server.ts` `/health` handler | `health.service.ts` | `checkDependencyHealth({queryPostgres, pingRedis})` | ✓ WIRED | Real `db.query`/`redisClient.ping` singletons injected, no static/hardcoded return. |
| `server.ts` `trust proxy` | `TRUST_PROXY_HOPS` env var | `app.set('trust proxy', hops)` conditional on hops > 0 | ✓ WIRED | Confirmed both via unit test and manual HTTP-level reproduction in this session. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HRD-01 | 20-01 | CORS + Socket.IO origins restricted to env-configured app origins (not `*`) | ✓ SATISFIED | Truths 1-3, artifacts/links above. |
| HRD-02 | 20-02 | Rate limiting on `/api/auth/*` at minimum | ✓ SATISFIED | Truths 4-6, plus CR-01 fix (truth 11) makes it functional in the documented deployment topology. |
| HRD-03 | 20-03 | `/health` actually verifies Postgres + Redis reachability | ✓ SATISFIED | Truths 7-9. |
| DOC-01 | 20-04 | Customer-facing doc of inbound-connectivity posture | ✓ SATISFIED | Truth 10. |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps exactly these 4 IDs to Phase 20, and all 4 are claimed by a plan (`20-01`..`20-04`).

### Anti-Patterns Found

None in the phase's modified files (`cors.ts`, `server.ts`, `authRoutes.ts`, `health.service.ts`, `docs/DEPLOYMENT.md`, all `*.test.ts` files). No TODO/FIXME/XXX/TBD/placeholder markers.

### Post-Review Fix Verification (CR-01)

The code review (`20-REVIEW.md`) found a Critical, reproduced issue: `express-rate-limit`'s default `keyGenerator` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` when `X-Forwarded-For` is present but `trust proxy` is unconfigured — exactly the reverse-proxy topology `docs/DEPLOYMENT.md` (this phase, DOC-01) recommends.

This verification did not take the "fixed in 4ccecd8" commit message at face value. Instead:
1. Read the actual diff/code (`server.ts:32-42` — `TRUST_PROXY_HOPS`, fail-closed default).
2. Ran the full apps/api suite — 90/90 pass, including the two new `server.trustproxy*.test.ts` regression tests.
3. Independently reproduced the original crash and the fix at the HTTP layer (not committed — ephemeral test files, removed after use): confirmed `POST /api/auth/login` with `X-Forwarded-For` set and `TRUST_PROXY_HOPS` unset still throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` (expected, fail-closed default), and confirmed the same request with `TRUST_PROXY_HOPS=1` no longer throws that error (the only 500 observed with the fix applied was an unrelated Postgres SASL failure caused by no live DB in the test env, not the rate-limiter).

**Conclusion: the fix resolves CR-01 as designed** — an operator following `docs/DEPLOYMENT.md`'s guidance to set `TRUST_PROXY_HOPS` will not hit the 500. The fail-closed default means an operator who *doesn't* read the docs and deploys behind a proxy without setting the var will still see the crash — this is a documented, intentional tradeoff (fail closed rather than silently trusting an arbitrary number of hops) and is called out in both the commit message and `docs/DEPLOYMENT.md:158-165`. Not treated as a gap.

### Deferred Findings (Not Gaps)

Per the phase context, three Warning-level and three Info-level findings from `20-REVIEW.md` were deliberately deferred and do not block any of HRD-01/02/03/DOC-01:

- WR-01: No timeout on `/health`'s DB/Redis probes (a hung dependency hangs the health check). Does not block "live check performed" (HRD-03's stated truth) — it's a robustness improvement, not a correctness gap in what was asked.
- WR-02: `authRateLimiter` shares one bucket across all 5 auth routes. Does not block "21st request returns 429" (HRD-02's stated truth) — the limiter functions as specified; this is a design refinement.
- IN-01/IN-02/IN-03: CORS origin normalization, a stale doc comment, and duplicated CORS-matching logic between Express/Socket.IO. None block HRD-01's stated truths (allow/deny behavior is correct and tested).

These are legitimate follow-up items but do not represent unmet phase must-haves.

### Human Verification Required

None. All 4 requirement areas (HRD-01, HRD-02, HRD-03, DOC-01) are backend/config/doc changes fully verifiable via code inspection, automated tests, and a direct HTTP-level reproduction — no visual, real-time, or external-service-dependent behavior requires human judgment.

### Gaps Summary

No gaps. All 11 derived truths verified, all artifacts exist/substantive/wired, all 4 requirement IDs satisfied, the post-review Critical fix (CR-01) independently reproduced and confirmed resolved, and the full apps/api test suite passes (90/90).

---

_Verified: 2026-07-13T07:40:28Z_
_Verifier: Claude (gsd-verifier)_
