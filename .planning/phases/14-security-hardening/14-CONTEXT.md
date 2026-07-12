# Phase 14: Security Hardening - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The server must refuse to boot with insecure defaults, and no customer-facing install may ship a known-default admin account. Scope is limited to: (1) removing the `ENCRYPTION_KEY`/`JWT_SECRET` fallback values (code + docker-compose.yml) and replacing them with a hard boot-time check, and (2) stopping `017_seed_admin_user.sql` from running in customer-facing installs. Requirements: SEC-01, SEC-02, SEC-03.

</domain>

<decisions>
## Implementation Decisions

### Boot-fail strictness
- **D-01:** The boot check applies universally — no `NODE_ENV`/`DEPLOYMENT_MODE` bypass. Local dev must also supply real `JWT_SECRET`/`ENCRYPTION_KEY` values via a `.env` file. Rationale: matches roadmap Success Criteria #4 literally ("local dev still starts normally when secrets are supplied via env/.env" implies dev supplies them too, just not via committed defaults) and avoids a second enforcement path that could leak into a misconfigured prod deploy.
- **D-02:** The check does two things, not just presence: (a) fail if `ENCRYPTION_KEY`/`JWT_SECRET` is unset or empty, AND (b) fail if the value literally equals the known committed fallback strings (`vectra-dev-secret-key-change-in-production` for JWT_SECRET, `204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20` for ENCRYPTION_KEY). This stops someone from copy-pasting the old default into a real `.env` and passing the check by accident.
- Applies to all 4 existing fallback sites found in scouting: `apps/api/src/controllers/authController.ts`, `apps/api/src/core/auth/middleware.ts`, `apps/api/src/core/realtime/socket.ts`, `apps/api/src/domains/outlook/outlook.service.ts` (all currently do `process.env.JWT_SECRET || 'super-secret-key-for-dev'` — note this is a *different* fallback string than the compose-level one; both need to be treated as "known bad" and/or simply removed in favor of a single validated read).

### docker-compose.yml defaults
- **D-03:** Strip the `${JWT_SECRET:-vectra-dev-secret-key-change-in-production}` and `${ENCRYPTION_KEY:-204a7160...}` fallback substitutions from `docker-compose.yml` (lines 69-70). Change to plain `${JWT_SECRET}` / `${ENCRYPTION_KEY}` so an unset var passes through empty and trips the new boot check — one enforcement path, consistent with D-01 (no bypass, not even for the dev compose file).
- **D-04:** Update `.env.example` to include `JWT_SECRET` and `ENCRYPTION_KEY` placeholders plus a one-line comment on how to generate real values (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, per `secretBox.ts`'s own header comment). Devs copy `.env.example` → `.env` and fill in real values once — no new tooling needed.

### Claude's Discretion
- **Seed-admin removal mechanism (SEC-03)** was raised as a gray area but the user chose not to discuss it in this session — left open for the researcher/planner to figure out. Known constraints (from scouting): `017_seed_admin_user.sql` is currently mounted directly into `docker-entrypoint-initdb.d` in `docker-compose.yml` (line 31), so it runs unconditionally on any fresh volume. `DEPLOYMENT_MODE` (the clean gating mechanism referenced in Phase 16) does not exist yet — Phase 15's dependency note says the seed migration should "already be excluded from the customer-facing path before the runner formalizes migration execution," implying Phase 14 should resolve this now via some interim mechanism (e.g. dropping the initdb mount and relying on the existing `/api/auth/signup` self-registration flow for local dev bootstrapping), not defer it to Phase 16.
- Exact code structure for the boot-time check (single config-validation module vs. inline in `server.ts` vs. per-usage-site) is Claude's call — no existing config/env module was found in the codebase to reuse (`apps/api/src/core` has no `config.ts` or `env.ts`).
- Error message wording/format for the boot failure is Claude's call — must be "clear" per roadmap; no specific format was requested.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deployment/Security spec (primary)
- `docs/specs/deployment/on-premise-deployment.md` §3 (Security Issues Found — 3.1 hardcoded ENCRYPTION_KEY, 3.2 seeded admin, 3.3 hardcoded JWT_SECRET) and §5.1-5.2 (Secrets generation, Single company + real admin) — this section is the direct source for this phase's requirements and describes the exact current vulnerabilities and target end-state.
- `docs/specs/architecture-steering.md` §2 — referenced as a source spec for the v3.0 milestone; check for any cross-cutting boot/config conventions.

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02, SEC-03 definitions and traceability table.
- `.planning/ROADMAP.md` — Phase 14 section (Goal, Depends on, Success Criteria).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/core/crypto/secretBox.ts` — already has a correct pattern to model the new checks on: reads `ENCRYPTION_KEY`, throws `AppError(500, ...)` if missing/invalid (64-char hex). No fallback here already — this file is SEC-01-compliant today. The header comment already documents the generation command to reuse in `.env.example` and error messages.
- `apps/api/src/workers/telematics.worker.ts` — same correct no-fallback pattern for `ENCRYPTION_KEY`, already throws if missing/invalid.
- `apps/api/src/routes/authRoutes.ts` + `authController.ts` `signup` — existing self-service registration (creates company + admin user) that local dev can use instead of the seeded `admin@admin.com`, if the seed migration is removed from the dev path.

### Established Patterns
- `AppError` class (`apps/api/src/core/errors/AppError.ts`) for structured errors — used by `secretBox.ts` already; boot-time failures should probably `console.error` + `process.exit(1)` (matching `server.ts`'s existing `bootstrap()` catch block at line 89-91) rather than throwing `AppError` (which is an HTTP-response construct, not applicable pre-listen).
- `apps/api/src/server.ts` `bootstrap()` (lines 71-93) is the natural place to add an early secret-validation step before `db.query`/`redisClient.connect` — currently has no secret checks at all.

### Integration Points
- 4 fallback sites to fix: `authController.ts:9`, `core/auth/middleware.ts:5`, `core/realtime/socket.ts:5`, `domains/outlook/outlook.service.ts:12` — all read `process.env.JWT_SECRET || 'super-secret-key-for-dev'` independently (no shared constant). Fixing this cleanly likely means introducing one validated read (module or constant) that all four import, rather than patching four independent fallbacks.
- `docker-compose.yml` lines 14-33 mount every numbered migration individually into `docker-entrypoint-initdb.d` (line 31 is the seed-admin one) — this whole mounting scheme is what Phase 15's migration runner will eventually replace, but Phase 14 only needs to deal with line 31 (and the two secret defaults on lines 69-70).

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX requirements — this is a backend/infra hardening phase with no user-facing surface beyond the boot error message.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Seed-admin removal mechanism is in-scope for the phase per SEC-03, just not discussed in this session — see "Claude's Discretion" above.)

</deferred>

---

*Phase: 14-Security Hardening*
*Context gathered: 2026-07-12*
