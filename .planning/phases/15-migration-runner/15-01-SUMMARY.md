---
phase: 15-migration-runner
plan: 01
subsystem: database
tags: [migrations, postgres, pg, node, cli-script]

# Dependency graph
requires:
  - phase: 14-security-hardening
    provides: 017_seed_admin_user.sql already excluded from customer-facing installs, so this runner's D-02 exclusion is defense-in-depth rather than the sole safeguard
provides:
  - "apps/api/src/scripts/migrate.ts — the shared migration runner used by both first-run installs and every upgrade"
  - "schema_migrations tracking table (bootstrapped by the runner itself, not a numbered migration)"
  - "npm run migrate from repo root, passthrough to the api workspace's compiled runner"
  - "Live-verified proof that migrations 021-024 apply cleanly and idempotently against a real Postgres instance (closes a standing STATE.md gap)"
affects: [16-production-compose-deployment-mode, 17-installer-first-run-flow, 19-release-versioning-upgrade-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI script pattern: apps/api/src/scripts/*.ts — async main() invoked at file bottom, composed from server.ts bootstrap() + secrets.ts fail-fast shape"
    - "Per-file transaction migration apply: db.connect() -> BEGIN -> apply SQL -> record filename -> COMMIT, ROLLBACK + rethrow on error, client.release() in finally"

key-files:
  created: [apps/api/src/scripts/migrate.ts]
  modified: [apps/api/package.json, package.json]

key-decisions:
  - "Followed D-01 through D-05 from 15-CONTEXT.md exactly: explicit npm run migrate step (not auto-run in bootstrap), hard-coded 017_seed_admin_user.sql exclusion independent of DEPLOYMENT_MODE, dev docker-compose.yml left untouched, fail-fast per-file transactions with no partial continue, runner lives at apps/api/src/scripts/migrate.ts reusing the existing db Pool."
  - "Strict filename regex (/^\\d+_[\\w-]+\\.sql$/) used for file discovery instead of a bare .sql suffix check, per the plan's T-15-01 mitigation guidance."
  - "Error messages in the failure path log only err.message (never the raw pg error object) to avoid leaking connection-string details, per T-15-04."

patterns-established:
  - "Migration runner script convention: apps/api/src/scripts/ as the home for future one-shot ops CLI scripts."

requirements-completed: [MIG-01, MIG-02]

# Metrics
duration: 25min
completed: 2026-07-12
---

# Phase 15 Plan 01: Migration Runner Summary

**Framework-free ~75-line migration runner (`apps/api/src/scripts/migrate.ts`) that applies pending `database/migrations/*.sql` files in numeric order inside per-file transactions, tracks them in a new `schema_migrations` table, hard-excludes `017_seed_admin_user.sql`, and is wired to `npm run migrate` from both the api workspace and repo root — live-verified twice against the running `vectra_postgres` container, actually applying migrations 021-024 for the first time outside static inspection.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-12T17:32:00Z
- **Completed:** 2026-07-12T17:57:52Z
- **Tasks:** 3 (2 code tasks + 1 live verification task)
- **Files modified:** 3

## Accomplishments
- Migration runner correctly discovers, sorts, and applies pending `.sql` files while permanently excluding `017_seed_admin_user.sql`
- `schema_migrations` bootstrap DDL created inside the runner itself (not a numbered migration), per spec §6.1
- Per-file transactional apply with fail-fast rollback + non-zero exit, no "log and continue" partial-failure mode
- `npm run migrate` wired end-to-end: root passthrough → api workspace → compiled `dist/scripts/migrate.js`
- Live two-run dry-run against the real `vectra_postgres` container proved both correct in-order application (021-024 applied for real, including the `kpi_rules.target_client_id` DDL) and true idempotency (second run: zero new rows, `No pending migrations.`, exit 0) — closing the STATE.md-flagged gap that 023/024 had only ever been manually inspected

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the migration runner script** - `b7db504` (feat)
2. **Task 2: Wire npm scripts (api workspace + root passthrough)** - `5d305a4` (feat)
3. **Task 3: Live dry-run verification against the running dev Postgres container** - no commit (verification-only task, `<files></files>` in plan; results documented below and in the DB itself)

**Plan metadata:** (this SUMMARY.md commit)

## Files Created/Modified
- `apps/api/src/scripts/migrate.ts` - The migration runner: schema_migrations bootstrap DDL, strict-regex file discovery/sort/exclusion, per-file transaction apply, fail-fast exit
- `apps/api/package.json` - Added `"migrate": "node dist/scripts/migrate.js"` to existing scripts block
- `package.json` (root) - Added `"migrate": "npm run migrate --workspace @vectra/api"` passthrough

## Decisions Made
None beyond what CONTEXT.md D-01 through D-05 already specified — plan and context were followed as written. See `key-decisions` in frontmatter for the specific implementation choices made within that guidance (regex-based discovery, message-only error logging).

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues required a Rule 1-3 auto-fix. The plan's own structure already handled the tricky parts (D-02 exclusion, D-04 fail-fast transactions).

**Total deviations:** 0
**Impact on plan:** None. Plan executed as written.

## Issues Encountered

**Live dry-run tooling gap (resolved, not a plan deviation):** The plan's Task 3 instructed running the compiled/ts-node script directly against the live container from `apps/api/`. This git worktree has no `node_modules` of its own (Node module resolution instead walks up the directory tree to the main checkout's hoisted `node_modules`, confirmed via `require.resolve('pg')`), and `ts-node` specifically is only installed under the *main repo's* `apps/api/node_modules/ts-node`, not hoisted to a location reachable from the worktree. `node --require ts-node/register src/scripts/migrate.ts` therefore failed with `MODULE_NOT_FOUND` for `ts-node/register`.

Resolution: compiled just the two needed files (`migrate.ts` + `core/db/index.ts`) with a standalone `tsc` invocation into `apps/api/dist/` *inside the worktree* (so the compiled `.js`'s `require('pg')`/`require('dotenv')` calls still resolve up to the main repo's hoisted `node_modules`), ran the compiled JS directly with `node apps/api/dist/scripts/migrate.js`, then deleted the temporary `apps/api/dist/` output afterward (it was untracked/gitignored, nothing to commit). This produced the exact same runtime behavior the plan's ts-node invocation would have — no code changes to `migrate.ts` itself, purely a local tooling workaround for the worktree's missing `node_modules`.

**`admin@admin.com` already present (not a runner defect):** The plan's Task 3 step 6 expected `SELECT email FROM users WHERE email='admin@admin.com'` to return 0 rows, noting the table "may already lack the row from Phase 14." In this live container it actually returned 1 row — pre-existing seed data from before Phase 14's hardening work, unrelated to and unaffected by this runner (which never applied `017_seed_admin_user.sql` in either run, confirmed by its absence from every `Applied:` log line and from `schema_migrations`). Documented here rather than silently treated as a pass/fail toggle, since the acceptance criterion's literal row-count assumption didn't hold for this particular live DB's history — the actually-relevant check (the runner never *introduces* the row) holds.

## Live Verification Results (Task 3)

First run (fresh `schema_migrations` table, live `vectra_postgres` container):
```
Applied: 002_realtime_and_documents.sql
Applied: 003_workspaces_and_presets.sql
... (through 016, skipping 017)
Applied: 018_field_execution.sql
Applied: 019_crm_billing.sql
Applied: 020_ltl_matching.sql
Applied: 021_crm_extensions.sql
Applied: 022_client_pages.sql
Applied: 023_email_messages_client_unique.sql
Applied: 024_kpi_target_client.sql
Migrations complete.
```
Exit code: 0. No mention of `017_seed_admin_user.sql`. `schema_migrations` row count after: 22. `kpi_rules.target_client_id` column confirmed present.

Second run (same container, immediately after):
```
No pending migrations.
Migrations complete.
```
Exit code: 0. Zero `Applied:` lines. `schema_migrations` row count after: 22 (unchanged — no duplicates). Automated verify command (`SELECT count(*) FROM schema_migrations WHERE filename IN (021...024)` = 4) passed.

Note: this container's `schema_migrations` table did not exist prior to this plan, so the first run applied every file back to `002_` (all of which are written idempotently per the existing migration convention, so re-applying `CREATE TABLE IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` DDL that had already landed via the dev compose's `docker-entrypoint-initdb.d` mounts was safe and completed without error) — this is expected first-run behavior for a database that has schema history but no tracking table yet, not specific to 021-024.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 16 (Production Compose + DEPLOYMENT_MODE) can now wire `docker compose run --rm api npm run migrate` into the production compose flow, dropping production's `docker-entrypoint-initdb.d` mounts, per D-01/D-03.
- Phase 17 (Installer / First-Run Flow) can call `npm run migrate` as part of first-run without further runner changes.
- No blockers identified.

---
*Phase: 15-migration-runner*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: apps/api/src/scripts/migrate.ts
- FOUND: "migrate" script in apps/api/package.json
- FOUND: "migrate" script in root package.json
- FOUND: commit b7db504 (Task 1)
- FOUND: commit 5d305a4 (Task 2)
