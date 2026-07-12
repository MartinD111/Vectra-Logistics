---
phase: 17-installer-first-run-flow
plan: 01
subsystem: infra
tags: [installer, crypto, bcrypt, pg, cli, on-prem, migrations]

# Dependency graph
requires:
  - phase: 15-migration-runner
    provides: "apps/api/src/scripts/migrate.ts — schema_migrations table + idempotent migration runner, invoked as a subprocess"
  - phase: 16-production-compose
    provides: "docker-compose.prod.yml with no docker-entrypoint-initdb.d mounts — the base-schema gap this plan closes"
  - phase: 14-security-hardening
    provides: "apps/api/src/core/config/secrets.ts validation contract (JWT_SECRET/ENCRYPTION_KEY/DEPLOYMENT_MODE) the installer's .env output must satisfy"
provides:
  - "apps/api/src/scripts/install.ts — one-shot installer: generateSecrets, applyBaseSchema, runMigrations, createCompanyAndAdmin, upsertEnvVars, main()"
  - "npm run install:on-prem at root and apps/api, mirroring the existing migrate wiring"
affects: [17-02-local-ai-installer-step, deploy-docs, release-versioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot ops CLI script sibling to migrate.ts: main() IIFE, process.exit(0)/process.exit(1), (err as Error).message-only logging"
    - "to_regclass('public.companies') guard before applying non-idempotent init.sql CREATE TYPE statements"
    - "Migration runner invoked via child_process.execFileSync subprocess (never in-process, since migrate.ts calls process.exit() itself)"

key-files:
  created:
    - apps/api/src/scripts/install.ts
    - apps/api/src/scripts/install.test.ts
  modified:
    - apps/api/package.json
    - package.json

key-decisions:
  - "Admin password accepted only via INSTALL_ADMIN_PASSWORD env var or interactive readline prompt — never a CLI flag (avoids shell history/ps exposure)"
  - "Installer-created admin is pre-approved (companies.status='approved') and pre-verified (users.is_verified=TRUE) — no pending-approval or email-verification-token flow, since this is a trusted first-run operator action"
  - "Base schema (init.sql/extensions.sql) applied by install.ts itself, guarded by to_regclass('public.companies'), before invoking the migration runner subprocess — closes the gap left by Phase 16 dropping docker-entrypoint-initdb.d mounts"

patterns-established:
  - "Installer input validation mirrors resetPassword()'s existing length<8 password check for consistency across the codebase"

requirements-completed: [INS-01]

# Metrics
duration: 6min
completed: 2026-07-12
---

# Phase 17 Plan 01: Core One-Shot Installer Summary

**One-shot `install.ts` script that generates unique JWT_SECRET/ENCRYPTION_KEY, applies the base schema idempotently, runs the Phase 15 migration runner as a subprocess, creates exactly one company + one real bcrypt-hashed admin account, and writes `.env` with `DEPLOYMENT_MODE=on-prem` — wired into `npm run install:on-prem` at root and `apps/api`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-12T20:37:32+02:00
- **Completed:** 2026-07-12T20:42:08+02:00
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `apps/api/src/scripts/install.ts` implements `generateSecrets`, `validateAdminEmail`, `validateAdminPassword`, `validateCompanyName`, `upsertEnvVars`, `applyBaseSchema`, `runMigrations`, `createCompanyAndAdmin`, `prompt`, and `main()` orchestration — closes the base-schema gap left by Phase 16's removal of `docker-entrypoint-initdb.d` mounts.
- 11 unit tests in `install.test.ts` cover secret uniqueness/format, validator logic, and `.env` upsert replace-in-place/append semantics (RED confirmed before implementation, GREEN after).
- `npm run install:on-prem` wired identically to the existing `migrate` script at both `apps/api/package.json` and root `package.json`.
- Full `apps/api` test suite (45 tests across 6 files) passes with no regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing unit tests for install.ts's pure/mockable functions** - `a77d109` (test)
2. **Task 2: Implement install.ts — secrets, schema bootstrap, migration invocation, company+admin creation, .env write** - `27ac30d` (feat)
3. **Task 3: Wire install:on-prem npm scripts** - `456da30` (chore)

**Plan metadata:** (pending — committed with this SUMMARY)

## Files Created/Modified
- `apps/api/src/scripts/install.ts` - One-shot installer entry point (secrets, base schema, migrations, company+admin, .env write)
- `apps/api/src/scripts/install.test.ts` - Unit tests for `generateSecrets`, validators, and `upsertEnvVars`
- `apps/api/package.json` - Added `install:on-prem` script entry
- `package.json` - Added root `install:on-prem` passthrough

## Decisions Made
- Password validation mirrors `authController.ts`'s existing `resetPassword()` length<8 check rather than inventing a new threshold.
- `createCompanyAndAdmin()` does not create `workspaces`, `user_preferences`, or `auth_tokens` rows and does not call `recordEvent()` — explicitly out of scope per 17-PATTERNS.md's "What NOT to copy from signup()" section (a one-shot installer, not a public signup flow).
- Migration runner invoked as a subprocess (`execFileSync`) rather than importing `migrate.ts`'s internals in-process, since `migrate.ts` calls `process.exit()` itself, which would kill the installer process if imported directly — matches RESEARCH.md's resolved Open Question 1.

## Deviations from Plan

None - plan executed exactly as written. One micro-adjustment: the `generateSecrets()` doc comment initially embedded the literal string `randomBytes(32)` in a code-example comment, which inflated the plan's `grep -c "randomBytes(32)"` acceptance check to 3 instead of the expected 2 (both real call sites). Reworded the comment to describe the primitive in prose instead of repeating the exact code snippet — no functional change, verification command now returns exactly 2 as specified.

## Issues Encountered
- The worktree had no `node_modules` installed (monorepo dependencies live only in the main checkout). Ran verification (`node --test`, `tsc --noEmit`) with `NODE_PATH` pointing at the main repo's `node_modules` and `apps/api/node_modules` rather than a fresh `npm install` inside the worktree, to avoid an expensive, unnecessary reinstall for a worktree that will be merged and discarded. No impact on the committed code — this only affected how verification commands were invoked in this sandbox.

## User Setup Required

None - no external service configuration required. Manual live-DB dry-run of the installer against a genuinely fresh Postgres volume remains a documented, not-yet-executed verification step (see plan's `<verification>` section) — consistent with the existing migrations-023/024 precedent noted in STATE.md, flagged there rather than blocking this plan's completion.

## Next Phase Readiness
- `install.ts` is ready for Plan 02 (local AI / Gemma-Ollama optional installer step, INS-02) to extend `main()`'s flow with the probe+`company_ai_config` write, using the admin's `users.id` already returned by `createCompanyAndAdmin()`.
- Outstanding: a live-DB smoke test of `applyBaseSchema()` + `runMigrations()` + `createCompanyAndAdmin()` against a genuinely fresh Postgres volume has not been run in this environment (no live Postgres available) — recommended before phase close, per 17-VALIDATION.md's Manual-Only Verifications section.

---
*Phase: 17-installer-first-run-flow*
*Completed: 2026-07-12*
