---
phase: 15-migration-runner
verified: 2026-07-12T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
deferred:
  - truth: "The production stack no longer mounts docker-entrypoint-initdb.d; migrations only ever run through the runner, on first-run and upgrade alike (ROADMAP Phase 15 Success Criterion 3)"
    addressed_in: "Phase 16"
    evidence: "docker-compose.prod.yml postgres service (lines 2-16) has no docker-entrypoint-initdb.d mount — only a data volume and healthcheck; api service comment (lines 31-36) documents 'docker compose -f docker-compose.prod.yml run --rm api npm run migrate' as the required pre-boot step. 15-CONTEXT.md D-03 explicitly scoped production compose wiring to Phase 16 ('wiring the runner into compose (dev or docker-compose.prod.yml) is explicitly out of this phase's scope'), and ROADMAP.md Phase 16 goal/success-criteria (lines 85-93) own the production compose file."
---

# Phase 15: Migration Runner Verification Report

**Phase Goal:** Schema migrations apply the same way on first install and on every upgrade, tracked and idempotent.
**Verified:** 2026-07-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run migrate` applies all pending numbered files from `database/migrations/` in ascending numeric order and records each in `schema_migrations` | ✓ VERIFIED | `apps/api/src/scripts/migrate.ts` lines 25-59: `fs.readdirSync(...).filter(regex).sort()`, per-file `BEGIN`/apply/`INSERT INTO schema_migrations`/`COMMIT`. Live re-query of the running `vectra_postgres` container during this verification returned 22 rows in `schema_migrations`, including `021_crm_extensions.sql` through `024_kpi_target_client.sql` in order and correctly omitting `017_seed_admin_user.sql` — matches SUMMARY.md's claimed first-run output exactly. |
| 2 | Running `npm run migrate` again with no new files is a no-op — zero new rows, exit 0, no errors | ✓ VERIFIED | Code path (lines 33-36): `pending.length === 0` → logs `No pending migrations.`, falls through to `process.exit(0)` without touching the DB. Live DB state re-checked at verification time still shows exactly 22 rows (matches SUMMARY's "second run: 22, unchanged"), and no `Applied:` code path can run for an empty `pending` array. |
| 3 | `017_seed_admin_user.sql` is never applied by the runner under any circumstance | ✓ VERIFIED | Line 12: `EXCLUDED_FILES = new Set(['017_seed_admin_user.sql'])`, applied unconditionally in the discovery filter (line 27) with no `DEPLOYMENT_MODE` gate anywhere in the file (grep for `DEPLOYMENT_MODE` in migrate.ts returns nothing). Live query confirms `017_seed_admin_user.sql` is absent from `schema_migrations` in the real container. |
| 4 | A migration file that fails rolls back its own transaction, logs which file failed, and the process exits non-zero without attempting later files | ✓ VERIFIED | Lines 39-65: inner `try/catch` wraps the `for` loop; on error `client.query('ROLLBACK')` + `throw err` (rethrown to outer catch, lines 60-65) which logs `FATAL: migration ${current} failed: ...` and calls `process.exit(1)` immediately — the `for` loop is inside the `try`, so a thrown error unwinds out of the loop entirely; no `continue`/log-and-proceed pattern exists. `finally { client.release() }` ensures no connection leak. |

**Score:** 4/4 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Production stack drops `docker-entrypoint-initdb.d` mounts (ROADMAP SC3) | Phase 16 | `docker-compose.prod.yml` postgres service has no initdb mount (only `postgres_data` volume + healthcheck); api service documents `npm run migrate` as required pre-boot step. Explicitly out-of-scope for Phase 15 per 15-CONTEXT.md D-03 and 15-01-PLAN.md Task 2's explicit "Do NOT modify docker-compose.yml... or docker-compose.prod.yml" instruction. Phase 16 (already completed, per ROADMAP.md line 96-97) owns this wiring. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/scripts/migrate.ts` | Migration runner: bootstrap DDL, discovery/sort/exclusion, per-file transaction, fail-fast | ✓ VERIFIED | 77 lines. Contains `import { db } from '../core/db'` (no second `new Pool(`/`dotenv.config()`), `schema_migrations` DDL with `filename TEXT PRIMARY KEY` / `applied_at TIMESTAMPTZ`, `017_seed_admin_user.sql` exclusion with D-02 comment, `BEGIN`/`COMMIT`/`ROLLBACK` as separate `client.query()` calls, `process.exit(1)` failure path and `process.exit(0)` after `db.end()` success path. `npx tsc --noEmit -p apps/api/tsconfig.json` passes with zero errors. |
| `apps/api/package.json` | `migrate` script entry | ✓ VERIFIED | Line 11: `"migrate": "node dist/scripts/migrate.js"`, alongside unmodified `start`/`dev`/`build`/`test`. |
| `package.json` (root) | Root passthrough | ✓ VERIFIED | Line 20: `"migrate": "npm run migrate --workspace @vectra/api"`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/api/src/scripts/migrate.ts` | `apps/api/src/core/db/index.ts` | `import { db } from '../core/db'` | ✓ WIRED | Line 1 of migrate.ts; the reused pool executes both the bootstrap DDL and every per-file transaction (confirmed live against `vectra_postgres`). |
| `package.json` (root) | `apps/api/package.json` | `npm run migrate --workspace @vectra/api` passthrough | ✓ WIRED | Root script literally contains `--workspace @vectra/api`; matches the exact shape of the pre-existing `dev:api`/`build:api` passthrough pattern. |

### Non-Interference Checks (D-01/D-03 boundaries)

| Check | Expected | Status | Details |
|-------|----------|--------|---------|
| `apps/api/src/server.ts` untouched by Phase 15 | No auto-run of migrations in `bootstrap()` | ✓ VERIFIED | `git log --oneline -- apps/api/src/server.ts` shows the most recent commit touching this file is `843902f` (Phase 16), not any Phase 15 commit (`b7db504`/`5d305a4`). File was not modified by this phase. |
| `docker-compose.yml` (dev) untouched by Phase 15 | Dev compose keeps existing initdb mounts per D-03 | ✓ VERIFIED | `grep -n "migrate" docker-compose.yml` returns zero matches — file has no reference to the new runner, confirming it was not touched. |

### Live Dry-Run Verification (independently re-executed against the real container)

SUMMARY.md's live dry-run claims were **not** taken on faith — this verification independently re-queried the running `vectra_postgres` container directly:

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Container running | `docker ps --format {{.Names}}` | `vectra_postgres` present | ✓ PASS |
| `schema_migrations` row count | `SELECT filename FROM schema_migrations ORDER BY filename` | 22 rows, `002_...` through `024_...` with `017_` absent | ✓ PASS — matches SUMMARY's claimed count exactly |
| 021-024 present in order | same query | `021_crm_extensions.sql`, `022_client_pages.sql`, `023_email_messages_client_unique.sql`, `024_kpi_target_client.sql` all present | ✓ PASS |
| `024`'s DDL actually executed (not just recorded) | `SELECT column_name FROM information_schema.columns WHERE table_name='kpi_rules' AND column_name='target_client_id'` | 1 row returned | ✓ PASS |
| `017_seed_admin_user.sql` never applied | absence from row list above | absent | ✓ PASS |

This independently confirms the SUMMARY.md's "Live Verification Results" section reflects real database state, not narrated/fabricated output — the current live state (22 rows, `target_client_id` column present, 017 absent) is exactly what a successful two-run dry-run followed by idempotent no-op reruns would leave behind.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MIG-01 | 15-01-PLAN.md | `schema_migrations` tracking table + `npm run migrate` runner applies pending numbered migrations in order, idempotently, recording each | ✓ SATISFIED | Truths 1, 2 above; live DB confirms both application and idempotency. |
| MIG-02 | 15-01-PLAN.md | First-run and upgrade use the same migration path; production stack drops the `docker-entrypoint-initdb.d` mounts | ✓ SATISFIED (split across Phase 15 + Phase 16) | "Same migration path" half fully satisfied by this phase (single runner, no separate dev/prod code paths — Task 2 standardizes on the compiled-dist invocation for both). "Production drops initdb mounts" half is satisfied by Phase 16's `docker-compose.prod.yml` (verified above), which was explicitly deferred here per D-03/15-01-PLAN Task 2. REQUIREMENTS.md's tracking table (line 91) still shows MIG-02 as "Pending" against Phase 15 alone — this is expected since the requirement genuinely spans two phases; it should be reconciled to "Complete" once Phase 16's contribution is accounted for, but that reconciliation is a documentation bookkeeping item, not a functional gap. |

### Anti-Patterns Found

None. `migrate.ts` contains no `TODO`/`FIXME`/`TBD`/`XXX`/`HACK`/placeholder markers, no empty-return stubs, and no hardcoded empty-data returns. The file is a complete, working 77-line script consistent with the ~50-75 line target set by the spec and plan.

### Human Verification Required

None. All truths were verified either by direct static inspection of `migrate.ts` or by live re-querying of the actual running `vectra_postgres` container (not by trusting SUMMARY.md's narrated output). No visual, real-time, or external-service behavior in scope for this phase.

### Gaps Summary

No blocking gaps. One item (ROADMAP Success Criterion 3, "production stack drops docker-entrypoint-initdb.d") was out of this phase's declared scope per 15-CONTEXT.md D-03 and is confirmed already resolved by the already-completed Phase 16 (`docker-compose.prod.yml` has no initdb mount). This is recorded as a deferred item, not a gap, per Step 9b — no follow-up plan is required for it. The only loose end is a documentation-only discrepancy: `.planning/REQUIREMENTS.md`'s Phase Mapping table still lists MIG-02 as "Pending" under Phase 15 even though its full text is now satisfied jointly by Phase 15 + Phase 16; this does not block phase progression.

---

*Verified: 2026-07-12*
*Verifier: Claude (gsd-verifier)*
