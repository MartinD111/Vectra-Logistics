---
phase: 20-deploy-hardening-connectivity-doc
plan: 02
subsystem: api-auth
tags: [rate-limiting, security, express, auth]
dependency-graph:
  requires: []
  provides:
    - authRateLimiter (apps/api/src/routes/authRoutes.ts)
  affects:
    - apps/api/src/routes/authRoutes.ts
tech-stack:
  added:
    - express-rate-limit@8.5.2
  patterns:
    - "Per-route rate-limit middleware applied individually (not blanket router.use())"
    - "Rate-limit 429 handler responds directly, documented as an intentional narrow exception to the AppError/errorHandler convention"
key-files:
  created:
    - apps/api/src/routes/authRoutes.ratelimit.test.ts
  modified:
    - apps/api/package.json
    - package-lock.json
    - apps/api/src/routes/authRoutes.ts
decisions: []
metrics:
  duration: ~15min
  completed: 2026-07-13
---

# Phase 20 Plan 02: Auth Rate Limiting Summary

Added `express-rate-limit@8.5.2` to `apps/api` and wired a shared `authRateLimiter` (20 requests / 15 minutes per IP, `standardHeaders: 'draft-8'`) onto the 5 mutation-adjacent `/api/auth/*` routes (signup, login, verify-email, forgot-password, reset-password), leaving `GET /me` unthrottled — closing the "no rate limiting" gap from `docs/specs/deployment/cloud-deployment.md` §3.2 (HRD-02).

## What Was Built

**Task 1 — `authRateLimiter` wiring (`apps/api/src/routes/authRoutes.ts`):**
- Installed `express-rate-limit@^8.5.2` via `npm install express-rate-limit@^8.5.2 --workspace=apps/api` (already audited/approved in `20-RESEARCH.md`'s Package Legitimacy Audit — no blocking checkpoint required).
- Constructed `authRateLimiter` once: `windowMs: 15 * 60 * 1000`, `limit: 20`, `standardHeaders: 'draft-8'`, `legacyHeaders: false`.
- Applied `authRateLimiter` individually (not via blanket `router.use()`) to `POST /signup`, `POST /login`, `POST /verify-email`, `POST /forgot-password`, `POST /reset-password`.
- Left `router.get('/me', authenticateToken, getMe)` unchanged — this route is polled on every page load by all three frontends, not a mutation/abuse target.
- The 429 `handler` responds directly with `res.status(429).json({ error: 'Too many requests. Please try again later.' })`, with an inline comment documenting why this bypasses the `AppError`/`errorHandler` convention (the handler isn't wrapped in `asyncHandler` and must respond to the request itself, not throw).

**Task 2 — Integration test (`apps/api/src/routes/authRoutes.ratelimit.test.ts`):**
- Reused the `http.createServer(app)` / `server.listen(0, resolve)` / manual `http.request` scaffold from `apps/api/src/server.health.test.ts`.
- Sends 21 sequential `POST /api/auth/login` requests from the same test process (all sharing one rate-limit bucket via `express-rate-limit`'s default `req.ip`-based `keyGenerator`).
- Asserts requests 1-20 never return 429 (any auth-flow status is acceptable — the test only proves the limiter, not login correctness; no live Postgres in this environment, so all 21 actually fail with 5xx from the DB layer, still non-429, still valid per the plan's acceptance criteria).
- Asserts request 21 returns `429` with body `{ error: 'Too many requests. Please try again later.' }`.

## Verification

- `grep -c "authRateLimiter" apps/api/src/routes/authRoutes.ts` → `6` (1 declaration + 5 route usages) — matches acceptance criteria.
- `npx tsc --noEmit` in `apps/api` — clean, no type errors.
- `node --require ts-node/register --test src/routes/authRoutes.ratelimit.test.ts` (run from `apps/api`) → 1 test, 1 pass.
- `npm ls express-rate-limit --workspace=apps/api` → resolves to `8.5.2`.

## Deviations from Plan

None - plan executed exactly as written.

### Worktree Note (not a plan deviation, execution-environment only)

This worktree branch (`worktree-agent-afe94f7ee7c5cd15c`) was checked out at the exact merge-base with `main` (zero unique commits, `.planning/` and other main-branch content missing at session start) — the same pattern previously documented in STATE.md's Phase 18 blocker note. Resolved with a safe `git merge main --ff-only` before execution began (fast-forward only, no destructive operations, no conflicts).

## Self-Check: PASSED

- FOUND: apps/api/src/routes/authRoutes.ratelimit.test.ts
- FOUND: 6b0b645 (feat(20-02): install express-rate-limit and wire authRateLimiter into authRoutes)
- FOUND: 1098a95 (test(20-02): integration test proves 429 after 20 requests to /api/auth/login)
