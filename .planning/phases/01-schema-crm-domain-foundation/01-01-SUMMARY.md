---
phase: 01-schema-crm-domain-foundation
plan: 01
subsystem: database
tags: [postgres, sql-migration, crm, kpi, schema]

# Dependency graph
requires: []
provides:
  - "clients.address and clients.responsible_employee_id columns (live in dev DB)"
  - "client_project_links table for per-project client overrides (rate/employee/notes)"
  - "email_messages table for synced Outlook message history (Phase 5 dependency)"
  - "kpi_results.user_id nullable + kpi_results.client_id column + kpi_results_subject_check CHECK constraint (Phase 6 dependency)"
affects: [02-crm-domain, 05-email-sync, 06-kpi-risk-evaluator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent SQL migrations: ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, guarded DO $$ block for ADD CONSTRAINT (no native IF NOT EXISTS for constraints)"
    - "Nullable-subject pattern for kpi_results: user_id now nullable, new client_id column, CHECK (user_id IS NOT NULL OR client_id IS NOT NULL) enforces exactly-one-subject at the DB level"

key-files:
  created:
    - database/migrations/021_crm_extensions.sql
  modified:
    - docs/DEPLOYMENT.md

key-decisions:
  - "kpi_results.user_id NOT NULL resolved via nullable column + new client_id column + CHECK constraint, rather than a separate kpi_results_clients table — keeps a single results table for both user-subject and client-subject KPI evaluators"
  - "clients.notes column was NOT re-added — verified already present from migration 019; only address and responsible_employee_id are genuinely new clients columns"

patterns-established:
  - "Client-project override tables use explicit typed columns (override_rate_eur, override_responsible_employee_id, override_notes) rather than JSONB, per D-01 decision — fallback resolution (override ?? global) happens in the service layer, not SQL"

requirements-completed: [API-01, API-02]

# Metrics
duration: 3min
completed: 2026-07-05
---

# Phase 01 Plan 01: Schema Foundation for CRM Rework Summary

**Idempotent migration 021 adds clients.address/responsible_employee_id, client_project_links and email_messages tables, and a nullable-subject fix to kpi_results — applied and verified live in the dev Postgres container.**

## Performance

- **Duration:** 3 min (task 3 resolved via user-confirmed manual application, no additional agent runtime)
- **Started:** 2026-07-05T10:30:02Z (Task 1 commit)
- **Completed:** 2026-07-05T10:30:16Z (Task 2 commit); Task 3 confirmed by user after that
- **Tasks:** 3/3 complete
- **Files modified:** 2

## Accomplishments
- Wrote `database/migrations/021_crm_extensions.sql`, matching the idempotent conventions of migrations 019/008 (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, guarded `DO $$` constraint block)
- Documented the manual-apply command for migration 021 in `docs/DEPLOYMENT.md`, in the same format used for migrations 013-020
- Migration applied against the live dev Postgres container by the user; all four schema changes confirmed present via `\d clients`, `\d client_project_links`, `\d email_messages`, `\d kpi_results`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 021_crm_extensions.sql** - `dccb6b1` (feat)
2. **Task 2: Document manual-apply instructions in DEPLOYMENT.md** - `a4145d8` (docs)
3. **Task 3: Run migration 021 against the dev database** - no code commit (database-state task); resolved via user confirmation, see below

**Plan metadata:** (this commit)

## Files Created/Modified
- `database/migrations/021_crm_extensions.sql` - New idempotent migration: clients.address, clients.responsible_employee_id, client_project_links table, email_messages table, kpi_results.user_id nullable + client_id column + kpi_results_subject_check CHECK constraint
- `docs/DEPLOYMENT.md` - New subsection documenting the migration 021 manual-apply command, following the established pattern for migrations 013-020

## Decisions Made
- Confirmed `clients.notes` already exists from migration 019 and correctly excluded it from this migration (verified no bare `ADD COLUMN IF NOT EXISTS notes` string present)
- Chose the nullable-`user_id` + new `client_id` + CHECK-constraint approach for `kpi_results` (per plan's specified resolution) over introducing a separate client-results table, keeping one unified results table for both user-subject and future client-subject KPI evaluators

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Task 3 (running the migration against the dev database) is a `checkpoint:human-action` gate. This executor instance runs in a sandboxed worktree without Docker/psql access. Per the continuation instructions from the orchestrator, the user manually ran:

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U vectra_user -d vectra_db -f - < database/migrations/021_crm_extensions.sql
```

and confirmed (literal reply: "confirmed") via `\d clients`, `\d client_project_links`, `\d email_messages`, `\d kpi_results` that all four schema changes exist:
- `clients.address` and `clients.responsible_employee_id` columns present
- `client_project_links` table present
- `email_messages` table present
- `kpi_results.user_id` nullable, `kpi_results.client_id` column present

This executor did not attempt to re-verify by connecting to the database directly (no Docker/psql access in this worktree), and accepted the user's confirmation as the checkpoint resolution per explicit instruction.

## User Setup Required

None - no external service configuration required. Database migration was applied manually by the user as documented above (this is expected for this project — no automated migration runner exists; see `docs/DEPLOYMENT.md` for the established manual-apply pattern).

## Next Phase Readiness

- Schema foundation is live in the dev database: `clients.address`, `clients.responsible_employee_id`, `client_project_links`, `email_messages`, and the `kpi_results` nullable-subject fix are all confirmed present.
- Phase 2 (CRM domain) can now build controller/service/repository layers against this real schema without a false-positive verification gap.
- Phase 5 (email sync) has its `email_messages` table ready, no missing-table blocker.
- Phase 6 (KPI risk evaluator) has its `kpi_results` client-subject write path ready (`user_id = NULL, client_id = <client>`), no NOT NULL blocker.
- No blockers carried forward from this plan.

---
*Phase: 01-schema-crm-domain-foundation*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: database/migrations/021_crm_extensions.sql
- FOUND: docs/DEPLOYMENT.md
- FOUND: .planning/phases/01-schema-crm-domain-foundation/01-01-SUMMARY.md
- FOUND: dccb6b1 (Task 1 commit)
- FOUND: a4145d8 (Task 2 commit)
