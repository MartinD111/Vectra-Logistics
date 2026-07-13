# Phase 20: Deploy Hardening + Connectivity Doc - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The production stack must reject cross-origin requests from unknown origins (CORS + Socket.IO), throttle brute-force/spam attempts against `/api/auth/*`, and have `/health` actually verify Postgres and Redis reachability rather than reporting a static OK. Alongside the code changes, a customer-facing doc must explain exactly what needs to be exposed to the internet in a reverse-proxy setup. Requirements: HRD-01, HRD-02, HRD-03, DOC-01. Out of scope: the Socket.IO Redis-adapter / horizontal-scaling gap (cloud-deployment.md §3.4) — a separate, Cloud-priority concern not named in this phase's requirements.

</domain>

<decisions>
## Implementation Decisions

### Health check depth & failure semantics
- **D-01:** Single `/health` endpoint (no separate `/ready`) does a live check on every request — `SELECT 1` against Postgres and a Redis `PING`, no caching/staleness window. The spec (`cloud-deployment.md` §3.3) treats `/health` and a separate `/ready` as equivalent options; keeping one endpoint avoids a new route and matches what Phase 19 already extended with `version`.
- **D-02:** No caching of the health-check result — every request re-checks. Rationale: `SELECT 1`/`PING` are sub-millisecond on a healthy connection, and health probes are typically low-frequency (every 5-30s from a load balancer/orchestrator), so a staleness window buys nothing and adds a bug surface.
- **D-03:** On failure, respond `503` with a per-dependency breakdown: `{status: "unhealthy", version, dependencies: {postgres: "ok"|"down", redis: "ok"|"down"}}`. On success: `{status: "OK", version, dependencies: {postgres: "ok", redis: "ok"}}` (keep the `version` field from Phase 19; keep `status: "OK"` wording for the healthy case for backward compatibility with anything already parsing it, add `dependencies` as new information rather than replacing the existing shape).

### Connectivity doc placement & scope
- **D-04:** The §7 reverse-proxy posture (only `/api/webhooks/*` and `/api/pod/*` need inbound exposure) goes into a new section in `docs/DEPLOYMENT.md`, not a standalone file. `DEPLOYMENT.md` is already the single operator-facing deploy doc (production images, upgrade procedure from Phase 19) — a customer setting up a reverse proxy is doing so as part of deployment, so one doc to read end-to-end beats a second file to discover.
- **D-05 (scope confirmation):** The Socket.IO Redis-adapter gap (`cloud-deployment.md` §3.4 — realtime doesn't fan out across multiple API instances) is explicitly confirmed OUT of scope for this phase. It is not named in HRD-01/02/03/DOC-01 and is a Cloud-priority horizontal-scaling concern, unrelated to CORS/rate-limit/health/connectivity-doc. Do not touch Socket.IO's adapter wiring.

### Claude's Discretion
- **CORS/Socket.IO origin source (HRD-01)** — not discussed in this session. Known constraints from scouting: `.env.example` already has `NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL` (the three frontend origins); the spec (`cloud-deployment.md` §3.1) says the allowlist must be "sourced from env so On-Premise installs can still set their own allowed origin(s) without a code change" — researcher/planner should decide whether to reuse the existing `NEXT_PUBLIC_*_URL` vars directly or introduce a dedicated `CORS_ALLOWED_ORIGINS` var, and whether `app.use(cors())` (line 37) and the Socket.IO `cors: { origin: "*" }` (lines 30-35) in `apps/api/src/server.ts` share one origin-list implementation or two.
- **Rate-limit scope & thresholds (HRD-02)** — not discussed in this session. Known constraints: `apps/api/src/routes/authRoutes.ts` has 5 routes (`signup`, `login`, `verify-email`, `forgot-password`, `reset-password`); the spec names `login`+`signup` specifically as credential-stuffing/spam targets but says "at minimum," implying all 5 is also acceptable. No `express-rate-limit` (or equivalent) is currently installed in `apps/api`. Researcher/planner should pick the package, scope (2 routes vs all 5), limit/window values, and 429 response shape.
- Exact code structure for the health-check module (inline in `server.ts`'s `/health` handler vs. a small `health.ts`/`config` module) is Claude's call — no existing pattern to reuse beyond Phase 14/16's boot-time `secrets.ts` fail-fast style, which is boot-time not request-time and not directly analogous.
- Exact wording/structure of the new `docs/DEPLOYMENT.md` connectivity section — must cover: telematics webhooks need inbound reachability (Samsara/Geotab push GPS events, HMAC-verified), `/api/pod/*` is deliberately public (driver phone links, often from the road), Outlook OAuth callback needs to resolve for the admin's network context at setup time — and the recommended posture (reverse proxy exposing only `/api/webhooks/*` + `/api/pod/*` publicly, everything else LAN/VPN-only). Exact prose/structure is Claude's call; content must match `docs/specs/deployment/on-premise-deployment.md` §7.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deploy hardening (primary spec for HRD-01/02/03)
- `docs/specs/deployment/cloud-deployment.md` §3.1 (CORS wide open — fix), §3.2 (no rate limiting — fix), §3.3 (health check doesn't verify dependencies — fix) — the direct source for this phase's HRD-01/02/03 requirements, including exact current code locations and target end-state.
- `docs/specs/deployment/cloud-deployment.md` §3.4 — the Socket.IO Redis-adapter gap, explicitly confirmed OUT of scope for this phase (see D-05). Referenced only so downstream agents don't accidentally pull it in.

### Connectivity doc (primary spec for DOC-01)
- `docs/specs/deployment/on-premise-deployment.md` §7 ("Inbound connectivity — real dependencies, not hypothetical") — the authoritative content for the new `docs/DEPLOYMENT.md` section: exact webhook routes, POD public-route rationale, Outlook OAuth callback caveat, and the recommended reverse-proxy posture. This phase implements §7's content as customer-facing documentation, not new code.
- `docs/specs/deployment/on-premise-deployment.md` §9 (Build order) item 6 — confirms this doc was intentionally deferred to "later" (this phase), not skipped.

### Requirements & tracking
- `.planning/REQUIREMENTS.md` lines 45-51 — HRD-01, HRD-02, HRD-03, DOC-01 definitions and traceability table.
- `.planning/ROADMAP.md` Phase 20 section — Goal, Depends on (none — independent, sequenced last), Success Criteria.
- `.planning/phases/16-production-compose-deployment-mode/16-CONTEXT.md` (Deferred Ideas) — confirms DOC-01 was explicitly deferred from Phase 16 to this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/core/config/secrets.ts` — boot-time fail-fast validation pattern (`validateSecretsOrExit`, `validateDeploymentModeOrExit`) from Phases 14/16. Not directly reusable for CORS/rate-limit (those are request-time, not boot-time), but the "pure validator function + thin boot/request wrapper" shape is the established style to follow if a new validated-env-read helper is needed for the origin allowlist.
- `apps/api/src/core/config/version.ts` / the `/health` handler in `apps/api/src/server.ts` (lines 60-62, just added in Phase 19) — the health endpoint to extend with live dependency checks; already returns `version` via `getVersion()`.
- `apps/api/src/core/db/index.ts` (Postgres `db.query`) and `apps/api/src/core/db/redis.ts` (`redisClient`) — the existing DB/Redis client instances to reuse for the `/health` check's `SELECT 1` / `PING` (already imported in `server.ts`, already connected in `bootstrap()`).

### Established Patterns
- `.env.example` already lists `NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL`, `NEXT_PUBLIC_API_URL` — the three frontend origins CORS needs to allow are already named env vars, just not yet read by `server.ts`'s CORS config.
- `AppError` class (`apps/api/src/core/errors/AppError.ts`) — used for request-time errors; likely applicable to rate-limit 429 responses (existing project convention) though `express-rate-limit` may handle response shaping itself depending on the library chosen.

### Integration Points
- `apps/api/src/server.ts` lines 28-37 — where `cors()` (line 37) and the Socket.IO `cors:` option (lines 30-35) are currently configured with no restriction; both need the new origin allowlist.
- `apps/api/src/routes/authRoutes.ts` — the 5 routes rate-limiting would apply to (`signup`, `login`, `verify-email`, `forgot-password`, `reset-password`), currently unprotected.
- `apps/api/src/server.ts` lines 60-62 — the current static `/health` handler to extend with live Postgres/Redis checks per D-01/D-02/D-03.
- `docs/DEPLOYMENT.md` — existing "Production images" and "Upgrading a running install" sections (from Phase 19) that the new connectivity section (D-04) will sit alongside.

</code_context>

<specifics>
## Specific Ideas

No UI/UX surface — this phase is backend hardening (CORS, rate-limit, health check) plus one documentation section. No specific wording/format was requested for the doc beyond matching §7's content (see Claude's Discretion above).

</specifics>

<deferred>
## Deferred Ideas

- Socket.IO Redis-adapter / horizontal-scaling fix (`cloud-deployment.md` §3.4) — explicitly confirmed out of scope (D-05). Not this phase, not currently assigned to any phase; would need its own future phase if/when Cloud needs multiple API replicas.

### Reviewed Todos (not folded)
None — `todo.match-phase 20` returned zero matches.

</deferred>

---

*Phase: 20-Deploy Hardening + Connectivity Doc*
*Context gathered: 2026-07-13*
