# Phase 15: Migration Runner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 15-Migration Runner
**Areas discussed:** Trigger mechanism, Seed-admin exclusion, Dev environment scope, Failure handling, Script location & wiring

---

## Trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit step only | `npm run migrate` as a separate command before API start; server.ts bootstrap() untouched | ✓ |
| Auto-run on boot | server.ts calls the runner inside bootstrap() | |
| Both | Standalone script + boot-time safety net | |

**User's choice:** Explicit step only (recommended option accepted).
**Notes:** Matches `release-and-migrations.md` §5's documented upgrade procedure (`docker compose run --rm api npm run migrate` then `up -d`) exactly.

---

## Seed-admin exclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-code filename skip in the runner | Runner explicitly skips `017_seed_admin_user.sql` regardless of environment | ✓ |
| Rely on release packaging only | Safety comes entirely from the file never shipping in a customer-facing checkout | |

**User's choice:** Hard-code filename skip (recommended option accepted).
**Notes:** Defense-in-depth — correct even if release packaging (Phase 19) ever forgets to strip the file.

---

## Dev environment scope

| Option | Description | Selected |
|--------|-------------|----------|
| Leave dev compose on initdb mounts | `docker-compose.yml` unchanged this phase | ✓ |
| Switch dev compose too | Replace dev's initdb mounts with the runner now | |

**User's choice:** Leave dev compose on initdb mounts (recommended option accepted).
**Notes:** MIG-02's success criterion only requires the *production* stack to drop initdb mounts. Dev compose changes deferred to Phase 16.

---

## Failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Stop immediately, exit non-zero | Per-file transaction rollback, log failed file, stop before later files | ✓ |
| Log and continue with remaining files | Riskier — later migrations may depend on the failed one | |

**User's choice:** Stop immediately, exit non-zero (recommended option accepted).
**Notes:** Matches spec's "transaction each" design; gives a clean pass/fail signal for scripted upgrades.

---

## Script location & wiring

| Option | Description | Selected |
|--------|-------------|----------|
| `apps/api/src/scripts/migrate.ts` | Reuses existing `core/db` Pool; api + root package.json scripts | ✓ |
| `database/migrate.js` standalone | No TS build step, but duplicates DB connection/env logic | |

**User's choice:** `apps/api/src/scripts/migrate.ts` (recommended option accepted).
**Notes:** Root `package.json` gets a passthrough `migrate` script so `npm run migrate` works from repo root, matching how compose invokes it inside the api container.

---

## Claude's Discretion

- Exact `schema_migrations` schema beyond the spec's minimal baseline (`filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ`).
- Logging format/verbosity of the runner's console output.
- Whether the runner needs a unit/integration test harness vs. live dry-run verification.

## Deferred Ideas

- Wiring the runner into `docker-compose.prod.yml` and dropping production's initdb mounts — Phase 16.
- Switching local dev compose to the runner — deferred by the Dev environment scope decision; revisit only if Phase 16 needs it for parity.
- Installer calling `npm run migrate` as part of first-run — Phase 17.
- `CHANGELOG.md`, `VERSION` file, per-release migration list generation — Phase 19.
- A live pre/post dry-run of the runner against a real Postgres container — raised as a standing gap in STATE.md for migrations 023/024; worth doing during this phase's own verification.
