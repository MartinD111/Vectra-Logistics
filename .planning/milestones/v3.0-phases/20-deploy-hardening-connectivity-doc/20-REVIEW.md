---
phase: 20-deploy-hardening-connectivity-doc
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/api/src/core/config/cors.ts
  - apps/api/src/core/config/cors.test.ts
  - apps/api/src/server.cors.test.ts
  - apps/api/src/server.ts
  - .env.example
  - apps/api/src/routes/authRoutes.ratelimit.test.ts
  - apps/api/package.json
  - apps/api/src/routes/authRoutes.ts
  - apps/api/src/core/health/health.service.ts
  - apps/api/src/core/health/health.service.test.ts
  - apps/api/src/server.health.test.ts
  - docs/DEPLOYMENT.md
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
post_review_fixes:
  - id: CR-01
    fixed_in: 4ccecd8
    note: >
      Added TRUST_PROXY_HOPS env var (fail-closed default: unset/false),
      applied via app.set('trust proxy', ...) in server.ts. Reproduced the
      ERR_ERL_UNEXPECTED_X_FORWARDED_FOR crash against the real app export
      both before and after the fix (present without TRUST_PROXY_HOPS set,
      gone with it set to 1). Regression tests added in
      server.trustproxy.test.ts / server.trustproxy-set.test.ts. WR-03
      (undocumented trust proxy requirement) fixed in the same commit by
      adding guidance to docs/DEPLOYMENT.md's "Recommended posture" section.
  - id: WR-01
    fixed_in: null
    note: "Not fixed — deferred. No timeout on health-check DB/Redis probes."
  - id: WR-02
    fixed_in: null
    note: "Not fixed — deferred. Shared rate-limit bucket across 5 auth endpoints."
  - id: IN-01
    fixed_in: null
    note: "Not fixed — deferred. CORS origin normalization (trailing slash/case)."
  - id: IN-02
    fixed_in: null
    note: "Not fixed — deferred. Misleading request-time doc comment in cors.ts."
  - id: IN-03
    fixed_in: null
    note: "Not fixed — deferred. Duplicated CORS-matching logic (Express vs Socket.IO)."
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the CORS/Socket.IO allowlist (HRD-01), the `/api/auth/*` rate limiter
(HRD-02), the live Postgres/Redis health check (HRD-03), and the
`docs/DEPLOYMENT.md` connectivity section (DOC-01).

The CORS allowlist logic itself is sound (fails closed on an empty allowlist,
Express and Socket.IO/engine.io both end up going through the same underlying
`cors` package matching semantics, and both the unit tests and an integration
test exercise the allow/deny paths). The health check is a clean, DI-friendly,
`Promise.allSettled`-based probe that never leaks connection details in its
response body.

However, the rate limiter (HRD-02) has a **confirmed, reproduced BLOCKER**:
`express-rate-limit`'s default `keyGenerator` throws a `ValidationError` when
an `X-Forwarded-For` header is present but Express's `trust proxy` setting is
not configured — which is exactly the topology `docs/DEPLOYMENT.md` (this
same phase, DOC-01) tells operators to run (a reverse proxy in front of the
API). This turns every `/api/auth/*` request into a `500 Internal server
error` once deployed behind nginx/Caddy/Traefik/an ELB, i.e. the moment this
phase's own recommended deployment posture is followed, login/signup/password
reset break entirely. I reproduced this against the actual `app` export (see
CR-01) — this is not speculative.

Two further Warnings (health-check timeout, shared rate-limit bucket across
five auth endpoints) and three Info items (origin normalization, boot-time
caching semantics vs. the module's own "request-time" doc comment, and
duplicated CORS-matching logic between Express and Socket.IO) round out the
findings. No cross-file regressions were found between the 20-01 and 20-03
edits to `server.ts` — the CORS middleware and the `/health` route coexist
cleanly with no duplicate registrations or ordering conflicts.

## Critical Issues

### CR-01: Rate limiter throws (500s) on every auth request when deployed behind the reverse proxy this phase's own docs recommend

**File:** `apps/api/src/routes/authRoutes.ts:8-20` (root cause: `apps/api/src/server.ts`, missing `app.set('trust proxy', ...)`)
**Issue:**
`authRateLimiter` is built with `express-rate-limit`'s default `keyGenerator`,
which derives the rate-limit bucket from `req.ip`. `express-rate-limit` v8
validates this at request time: if it sees an `X-Forwarded-For` header but
`app.get('trust proxy')` is `false` (Express's default, and `server.ts` never
calls `app.set('trust proxy', ...)`), it throws
`ValidationError: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` from inside
`keyGenerator`. That error propagates through `express-rate-limit`'s
`handleAsyncErrors` wrapper to `next(error)` → the app's generic
`errorHandler` → a `500 { error: "Internal server error" }` response, so the
route handler (`login`/`signup`/etc.) never runs.

`docs/DEPLOYMENT.md` (added in this same phase, "Recommended posture") tells
operators to "run a reverse proxy (nginx, Caddy, Traefik, your cloud LB)" in
front of the API. Every one of those, in their default/typical config, sets
`X-Forwarded-For`. So the documented, recommended deployment topology
directly triggers this bug on 100% of `/api/auth/*` traffic — login, signup,
email verification, and password reset all break with a 500 as soon as the
API sits behind a proxy.

I reproduced this directly against the exported `app`: sending
`POST /api/auth/login` with an `X-Forwarded-For` header (no other proxy setup
needed) returns:
```
STATUS 500
BODY {"error":"Internal server error"}
```
with the server log showing:
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust
proxy' setting is false (default). ... ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
```

Separately, even without the throw, the underlying design is wrong for the
documented topology: with `trust proxy` unset, `req.ip` resolves to the
proxy's own IP for *every* client behind it, so if the throw were silenced
(e.g. by disabling this validation) the rate limiter would still bucket every
user behind the same proxy/NAT into one shared 20-requests-per-15-minutes
budget — one user's failed logins would lock out everyone else on the same
egress IP.

**Fix:** Configure `trust proxy` to match the actual deployment topology (a
single reverse proxy hop, per `docs/DEPLOYMENT.md`), e.g. in `server.ts`:
```ts
// Trust exactly one hop (the reverse proxy documented in docs/DEPLOYMENT.md).
// Required so express-rate-limit (and req.ip generally) sees the real client
// IP instead of the proxy's, and so it doesn't throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);
```
and document the requirement (and its security implication — only trust as
many hops as you actually have a proxy for) in `docs/DEPLOYMENT.md` next to
the "Recommended posture" section, since HRD-02's correctness depends on it.
Add a regression test that sends `X-Forwarded-For` against the real `app`
export (not just direct-connection requests, as `authRoutes.ratelimit.test.ts`
currently does) to catch this in CI.

## Warnings

### WR-01: `/health` has no timeout on the Postgres/Redis probes — a hung dependency hangs the health check itself

**File:** `apps/api/src/core/health/health.service.ts:27-37`, `apps/api/src/server.ts:74-86`
**Issue:** `checkDependencyHealth` uses `Promise.allSettled([deps.queryPostgres(), deps.pingRedis()])` with no timeout. This correctly turns a *rejected* probe into `'down'`, but a probe that never settles (e.g. a network partition where TCP connects but nothing responds, rather than an immediate `ECONNREFUSED`) will make `Promise.allSettled` — and therefore the whole `GET /health` request — hang indefinitely. For a liveness/readiness endpoint that orchestrators (k8s, Docker healthcheck, an LB) poll on a tight interval, this is the one failure mode a health check most needs to handle gracefully: instead of reporting `503` quickly, the endpoint itself becomes unresponsive, and concurrent health-check requests can pile up on the connection pool during exactly the partial-outage window this endpoint exists to detect.
**Fix:** Wrap each probe with a timeout, e.g.:
```ts
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('health probe timeout')), ms)),
  ]);

const [postgresResult, redisResult] = await Promise.allSettled([
  withTimeout(deps.queryPostgres(), 2000),
  withTimeout(deps.pingRedis(), 2000),
]);
```

### WR-02: `authRateLimiter` shares one counter across five semantically different auth endpoints

**File:** `apps/api/src/routes/authRoutes.ts:8-26`
**Issue:** The same `authRateLimiter` instance (and therefore the same
per-key counter/store) is applied to `/signup`, `/login`, `/verify-email`,
`/forgot-password`, and `/reset-password`. A client's budget of 20
requests/15 min is shared across all five actions. In practice this means a
user who fails login a handful of times can be locked out of
`/forgot-password` — the one endpoint they'd need to recover access — for the
same window, and conversely signup-spam attempts from a shared IP consume the
same budget as legitimate login attempts from unrelated users behind that
IP. HRD-02's stated goal was "throttle credential-stuffing/signup-spam";
collapsing all five endpoints into one bucket makes the limiter more likely
to lock out legitimate recovery flows than to meaningfully slow a targeted
credential-stuffing attack against `/login` specifically.
**Fix:** Use a separate `rateLimit(...)` instance (or at least a distinct
`keyGenerator` prefix, e.g. ``key: `${req.ip}:login` ``) per endpoint, or at
minimum split `/forgot-password` and `/reset-password` (account recovery)
from `/login` and `/signup` (the actual abuse targets) so a locked-out
attacker can't also lock a legitimate user out of recovering their account.

### WR-03: `docs/DEPLOYMENT.md`'s "Recommended posture" section doesn't mention the `trust proxy` requirement it creates

**File:** `docs/DEPLOYMENT.md:151-156`
**Issue:** The doc tells operators to put a reverse proxy in front of the API
but says nothing about Express's `trust proxy` setting, even though (see
CR-01) this phase's own rate limiter requires it once a proxy is in the
path. An operator following this doc exactly as written will hit CR-01 in
production.
**Fix:** Once CR-01 is fixed, add a line to the "Recommended posture"
paragraph noting that `trust proxy` must be set to match the number of
proxy hops in front of the API, and why (rate limiting + audit logging
correctness).

## Info

### IN-01: CORS allowlist does no origin normalization (trailing slash / case)

**File:** `apps/api/src/core/config/cors.ts:23-42`, `apps/api/src/server.ts:42-48`
**Issue:** Origins are compared with a plain `allowedOrigins.includes(origin)` exact-string match. A `CORS_ALLOWED_ORIGINS` entry with a trailing slash (`https://app.vectra.app/`) or different case than what the browser sends will silently never match, and the operator gets no diagnostic beyond "CORS is broken" — the failure mode is indistinguishable from a genuinely disallowed origin.
**Fix:** Trim trailing slashes (and optionally lowercase scheme+host) when building the allowlist in `getAllowedOrigins()`, and/or log the resolved allowlist once at boot (`console.log('CORS allowed origins:', allowedOrigins)`) so misconfiguration is visible immediately.

### IN-02: `cors.ts`'s "request-time, not boot-time" doc comment is misleading given how it's actually called

**File:** `apps/api/src/core/config/cors.ts:5-10`, `apps/api/src/server.ts:32`
**Issue:** The module comment states the function "is request-time, not boot-time" and is safe to call "before `dotenv.config()` runs." In practice, `server.ts` calls `getAllowedOrigins()` exactly once at module load (`const allowedOrigins = getAllowedOrigins();`) and reuses that frozen array for the lifetime of the process — for both the Express `cors()` origin callback and the Socket.IO `cors.origin` option. So in the one place that matters, the allowlist *is* boot-time/frozen; changing `CORS_ALLOWED_ORIGINS` requires a restart. That may be the intended behavior, but the comment overstates what actually happens at the call site and could mislead a future maintainer into assuming the allowlist is live-reloadable.
**Fix:** Either make the doc comment describe the actual call-site behavior ("lazy env read, but callers typically cache the result once at boot"), or, if live updates are actually desired, call `getAllowedOrigins()` inside the Express `origin` callback per-request instead of capturing it once in the `allowedOrigins` const.

### IN-03: Duplicated CORS origin-matching logic between Express and Socket.IO

**File:** `apps/api/src/server.ts:33-50`
**Issue:** The Socket.IO/engine.io `cors.origin` option is passed the raw `allowedOrigins` array and delegates matching to the underlying `cors` package. The Express middleware instead reimplements the same "no origin OR in allowlist" logic by hand in a custom callback. The two are currently equivalent, but that equivalence is implicit and would silently drift if one side's logic changes without the other being updated (e.g. someone adds wildcard subdomain matching to one and forgets the other).
**Fix:** Pass the array directly to both, matching the Socket.IO config: `app.use(cors({ origin: allowedOrigins }))`, removing the hand-rolled callback (the `cors` package's built-in array handling already does the "no `Origin` header ⇒ allow" and exact-match behavior the callback reimplements).

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
