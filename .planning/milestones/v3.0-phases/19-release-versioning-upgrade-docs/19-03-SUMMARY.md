---
phase: 19-release-versioning-upgrade-docs
plan: 03
subsystem: infra
tags: [changelog, migrations, deployment-docs, bash, release]

# Dependency graph
requires:
  - phase: 19-release-versioning-upgrade-docs (Plan 02)
    provides: VERSION file + docker build-arg stamping used in the new upgrade procedure's step 2
provides:
  - CHANGELOG.md at repo root with one section per shipped release (v1.0, v2.0, v3.0-unreleased), each with a migration list
  - scripts/list-release-migrations.sh — reusable git diff wrapper to regenerate a release's migration list
  - docs/DEPLOYMENT.md upgrade guidance rewritten as a single 5-step npm-run-migrate procedure, zero manual psql instructions remaining
affects: [20-deploy-hardening-connectivity-doc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Release changelog: one ## section per release, newest first, each with a ### Migrations subsection generated from git diff <prev-tag>..HEAD -- database/migrations/"
    - "Upgrade docs point at the same npm run migrate runner used on first-run (apps/api/src/scripts/migrate.ts), not manual per-file psql -f invocations"

key-files:
  created: [CHANGELOG.md, scripts/list-release-migrations.sh]
  modified: [docs/DEPLOYMENT.md]

key-decisions:
  - "CHANGELOG.md's v3.0 and v2.0 Migrations subsections state 'no new migration files' rather than omitting the subsection, since git diff v2.0..HEAD and v1.0..v2.0 -- database/migrations/ are both verified empty — keeps the per-release Migrations subsection format consistent across all 3 sections."

requirements-completed: [REL-02, REL-03]

# Metrics
duration: 15min
completed: 2026-07-13
---

# Phase 19 Plan 03: CHANGELOG + Upgrade Docs Rewrite Summary

**CHANGELOG.md with 3 versioned sections plus a reusable `list-release-migrations.sh` git-diff generator, and docs/DEPLOYMENT.md's 8 scattered manual `psql -f` upgrade call-outs replaced by one 5-step `npm run migrate`-based procedure.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-13T05:20:00Z
- **Completed:** 2026-07-13T05:43:31Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `CHANGELOG.md` created at repo root with exactly 3 `##` sections (v3.0-unreleased, v2.0, v1.0), newest first, each with a `### Migrations` subsection — v1.0's lists all 23 migration files (002 through 024, no 001).
- `scripts/list-release-migrations.sh` created — a reusable `git diff <prev-tag>..HEAD --name-only -- database/migrations/` wrapper filtered to the `NNN_description.sql` convention, usage-message + exit 1 on missing arg, verified against both the no-arg and `v2.0` cases.
- `docs/DEPLOYMENT.md`'s entire `## Database migrations` section (8 separate manual `psql -f database/migrations/0NN_*.sql` call-outs) replaced with a single `## Upgrading a running install` section containing exactly 5 numbered, runnable steps.

## Task Commits

Each task was committed atomically:

1. **Task 1: CHANGELOG.md + migration-list generator script** - `01874a4` (feat)
2. **Task 2: Replace docs/DEPLOYMENT.md's manual migration section with a 5-step upgrade procedure** - `78876d0` (docs)

**Plan metadata:** committed separately per worktree convention (SUMMARY.md only; STATE.md/ROADMAP.md owned by orchestrator)

## Files Created/Modified
- `CHANGELOG.md` - New file, 3 `##` release sections each with a `### Migrations` subsection, plus a top note pointing at the generator script
- `scripts/list-release-migrations.sh` - New reusable bash script wrapping the verified `git diff <prev-tag>..HEAD --name-only -- database/migrations/` pattern
- `docs/DEPLOYMENT.md` - `## Database migrations` section (8 manual psql call-outs) replaced by `## Upgrading a running install` (5-step npm-run-migrate procedure); section order preserved (`## Outlook / Microsoft 365 integration` remains immediately after)

## Decisions Made
- CHANGELOG.md's v3.0 and v2.0 sections keep an explicit `### Migrations` subsection stating "no new migration files" (verified via empty `git diff` output) rather than omitting the subsection for those releases — keeps the per-release format uniform and machine-scannable across all 3 sections.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria for both tasks verified directly:
- `grep -c "^## " CHANGELOG.md` → `3`
- `grep -n "024_kpi_target_client.sql" CHANGELOG.md` → match found
- `grep -n "001_" CHANGELOG.md` → no match
- `bash scripts/list-release-migrations.sh` (no arg) → exit 1, prints `Usage:` message
- `bash scripts/list-release-migrations.sh v2.0` → exits 0, empty output (no new migrations since v2.0)
- `grep -q "psql -f database/migrations" docs/DEPLOYMENT.md` → no match (exit 1)
- `grep -n "## Upgrading a running install" docs/DEPLOYMENT.md` → matches exactly once
- `grep -n "## Database migrations" docs/DEPLOYMENT.md` → no match (old heading removed)
- `grep -n "npm run migrate" docs/DEPLOYMENT.md` → matches
- `## Outlook / Microsoft 365 integration` still immediately follows the new section

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REL-02 and REL-03 satisfied; CHANGELOG.md and the rewritten upgrade procedure are ready for Phase 20 (Deploy Hardening + Connectivity Doc), which has no hard dependency on this plan's output but may reference `docs/DEPLOYMENT.md`'s structure.
- No blockers or concerns.

---
*Phase: 19-release-versioning-upgrade-docs*
*Completed: 2026-07-13*
