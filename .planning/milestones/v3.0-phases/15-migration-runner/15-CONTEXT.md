# Phase 15: Migration Runner - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A small, framework-free migration runner shared by first-run and every upgrade: a `schema_migrations` tracking table + `npm run migrate` that applies pending numbered files from `database/migrations/` in order, idempotently, and records each one. The production stack stops mounting `docker-entrypoint-initdb.d` in favor of this runner. This phase builds the runner itself — production compose wiring (`docker-compose.prod.yml`) is Phase 16, the installer flow that calls it is Phase 17, and `CHANGELOG.md`/versioned-release packaging around it is Phase 19.

</domain>

<decisions>
## Implementation Decisions

### Trigger mechanism
- **D-01:** The runner is an explicit, separate step — `npm run migrate` — never auto-run inside `server.ts`'s `bootstrap()`. It runs before the API process starts (`docker compose run --rm api npm run migrate` then `up -d`, per `release-and-migrations.md` §5). This matches the documented upgrade procedure exactly and keeps the API process from needing migration privileges at every boot.

### Seed-admin exclusion
- **D-02:** The runner hard-excludes `017_seed_admin_user.sql` by filename, unconditionally — not gated by `DEPLOYMENT_MODE` (that env var doesn't exist until Phase 16) and not left to release-packaging discipline alone. Defense-in-depth: correct even if a future release process ever forgets to strip the file from a customer-facing checkout. Comment the skip clearly so it's not mistaken for a bug.

### Dev environment scope
- **D-03:** `docker-compose.yml` (local dev) is left untouched — it keeps its current `docker-entrypoint-initdb.d` mounts for fast fresh-DB bootstrap. MIG-02's success criterion only requires the *production* stack to drop initdb mounts; dev compose changes belong to Phase 16 alongside `docker-compose.prod.yml`. The runner itself must still work correctly against a dev database (e.g. for manual `npm run migrate` testing) — it's just not wired into dev's compose flow yet.

### Failure handling
- **D-04:** Each migration file runs inside its own transaction. On failure, that transaction rolls back, the runner logs which file failed, and the process exits non-zero immediately — no later files are attempted. No partial "log and continue" mode. This gives `docker compose run api npm run migrate` a clean pass/fail signal for scripted upgrades.

### Location & wiring
- **D-05:** Runner script lives at `apps/api/src/scripts/migrate.ts`, reusing the existing `apps/api/src/core/db` Pool/env-loading rather than duplicating a standalone DB connection. `apps/api/package.json` gets a `migrate` script (compiled `dist/scripts/migrate.js` in prod, ts-node in dev). Root `package.json` gets a passthrough `"migrate": "npm run migrate --workspace @vectra/api"` so `npm run migrate` works from repo root too, matching how the compose command invokes it inside the api container.

### Claude's Discretion
- Exact `schema_migrations` schema beyond the spec's baseline (`filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ`) — e.g. whether to add a `success BOOLEAN` or checksum column — is left to the planner/researcher; the spec's minimal shape is sufficient for MIG-01/02.
- Logging format/verbosity of the runner's console output.
- Whether the runner itself needs a unit/integration test harness, or is verified via a live dry-run against a real Postgres instance (flagged as a past gap in STATE.md — migrations 023/024 were only manually inspected, never actually run twice against a live DB).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration runner design (primary spec for this phase)
- `docs/specs/deployment/on-premise-deployment.md` §6 ("The central gap: there is no migration runner") — the authoritative design: `schema_migrations` table shape, glob-order application, per-file transactions, dropping `docker-entrypoint-initdb.d` from the production compose. This phase implements §6.1 exactly.

### Adjacent specs (context, not this phase's scope)
- `docs/specs/deployment/release-and-migrations.md` §1, §4, §5, §6 — confirms `017_seed_admin_user.sql` must never ship/run in customer-facing installs (§1, §4), documents the 5-step upgrade procedure this runner enables (§5: backup → pull → `npm run migrate` → restart → verify), and states there are no down-migrations — rollback is backup-restore only (§6). Read for the "why" behind D-01/D-02; the actual compose/versioning work described here is Phase 16/19.
- `docs/specs/deployment/cloud-deployment.md` §3.5 — "same runner serves both targets" (Cloud and On-Premise share one migration path; only cadence/trigger differs, not the mechanism).
- `.planning/PROJECT.md` §"v3.0 On-Premise GA" — milestone framing; MIG-01/MIG-02 requirement text.
- `.planning/REQUIREMENTS.md` lines 20-22 — MIG-01, MIG-02 requirement definitions.
- `.planning/ROADMAP.md` Phase 15 section — goal, dependency on Phase 14, success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/core/db/index.ts` — existing `pg.Pool` instance (`export { db }`), already reads `DATABASE_URL` via `dotenv`. The runner should reuse this pool rather than opening a second connection.
- Migration file convention is already fully idempotent and disciplined: every file in `database/migrations/*.sql` follows `-- Migration: <what it does>. Apply after <N>. Idempotent.` with `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` throughout — the runner does not need to add its own idempotency guards, just tracking.

### Established Patterns
- Numeric filename order *is* the dependency order (`002_...` through `024_...` today; no `001` file — `database/init.sql`/`database/extensions.sql` cover that ground). Glob + numeric sort is sufficient; no separate dependency graph needed.
- `017_seed_admin_user.sql` is the one file that breaks the "Apply after N" convention and is already excluded from the dev compose's initdb mount list (Phase 14) — the runner must independently exclude it too (D-02).

### Integration Points
- `apps/api/src/server.ts` `bootstrap()` — NOT touched by this phase (D-01: no auto-run on boot). Future phases (16/17) may reference the runner from compose/installer flows.
- `docker-compose.yml` — currently mounts `database/init.sql`, `database/extensions.sql`, and 19 of the 23 existing migration files individually as `docker-entrypoint-initdb.d/N-name.sql` (notably missing 017, 021-024 — those never got added to the mount list, a pre-existing drift this runner makes irrelevant going forward). Left unchanged this phase per D-03; production's equivalent (`docker-compose.prod.yml`) is Phase 16's responsibility to wire against the runner instead.
- `apps/api/package.json` currently has no `migrate` script; root `package.json` has no `migrate` passthrough. Both need one (D-05).

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references — this is a backend CLI/ops tool with no user-facing surface. The spec (`on-premise-deployment.md` §6.1) explicitly describes it as "a ~50-line script," not a framework — keep it that small and dependency-free (no migration library, just `pg` + `fs`).

</specifics>

<deferred>
## Deferred Ideas

- Wiring the runner into `docker-compose.prod.yml` and dropping *production's* initdb mounts — Phase 16 (Production Compose + DEPLOYMENT_MODE).
- Switching local dev compose to the runner too — explicitly deferred by D-03; revisit only if Phase 16 finds it necessary for parity.
- Installer calling `npm run migrate` as part of first-run — Phase 17 (Installer / First-Run Flow).
- `CHANGELOG.md`, `VERSION` file, and generating a migration list per release from filenames — Phase 19 (Release Versioning & Upgrade Docs).
- A live pre/post dry-run of the runner against a real Postgres container (raised in STATE.md as a standing gap for migrations 023/024) — worth doing during this phase's own verification, but not a scope item to plan around; noted here so it isn't lost.

### Reviewed Todos (not folded)
None — no matching todos found (`todo.match-phase 15` returned 0 matches).

</deferred>

---

*Phase: 15-Migration Runner*
*Context gathered: 2026-07-12*
