---
phase: 17-installer-first-run-flow
plan: 03
subsystem: installer
tags: [installer, re-run-safety, gap-closure, tdd]
dependency-graph:
  requires: ["17-01", "17-02"]
  provides: ["isAlreadyInstalled", "shouldBlockInstall", "formatFatalError"]
  affects: ["apps/api/src/scripts/install.ts main()"]
tech-stack:
  added: []
  patterns: ["fake PoolClient with call-order canned responses for DB-dependent unit tests without a live Postgres instance"]
key-files:
  created: []
  modified:
    - apps/api/src/scripts/install.ts
    - apps/api/src/scripts/install.test.ts
decisions:
  - "isAlreadyInstalled() reuses the same schemaClient connection for the subsequent applyBaseSchema() call rather than opening a second connection"
  - "--force bypass prints an explicit WARNING before proceeding, distinct from the hard-stop FATAL path"
metrics:
  duration: "~15 minutes"
  completed: 2026-07-12
---

# Phase 17 Plan 03: Installer re-run safety guard (CR-01/WR-01/WR-02 gap closure) Summary

Closed the installer's only failed verification truth: `main()` now hard-stops a second invocation against an already-installed system (distinguishing "no schema," "schema present but empty," and "real prior install" via `isAlreadyInstalled()`) unless `--force` is explicitly passed, and non-`Error` thrown values now produce a diagnostic message via `formatFatalError()` instead of `"FATAL: install failed: undefined"`.

## What Was Built

**Task 1 (RED):** Extended `apps/api/src/scripts/install.test.ts` with 9 new tests covering:
- `isAlreadyInstalled()` — three states (no `companies` table, table exists but empty, table exists with a row), using a local `makeFakeClient()` helper that returns canned `{ rows: [...] }` responses in call order (no mocking library added, per plan constraint)
- `shouldBlockInstall()` — pure boolean gate, all three truth-table cases
- `formatFatalError()` — `Error` instance, bare-string throw, and `undefined` throw

Confirmed RED: `node --require ts-node/register --test` failed with `TS2305: Module './install' has no exported member 'isAlreadyInstalled'` (and the other two names) before Task 2.

**Task 2 (GREEN):** Added to `apps/api/src/scripts/install.ts`:
- `export async function isAlreadyInstalled(client: PoolClient): Promise<boolean>` — checks `to_regclass('public.companies')` first (short-circuits to `false` if the table doesn't exist yet), then `SELECT EXISTS(SELECT 1 FROM companies)` to distinguish an empty pre-applied schema from a real prior install.
- `export function shouldBlockInstall(alreadyInstalled: boolean, force: boolean): boolean` — `alreadyInstalled && !force`.
- `export function formatFatalError(err: unknown): string` — `` `FATAL: install failed: ${err instanceof Error ? err.message : String(err)}` ``.

Wired into `main()`:
- The guard runs immediately after the connect-and-before-`generateSecrets()` point: `schemaClient` is opened, `isAlreadyInstalled()` is checked, and `shouldBlockInstall()` gates a hard `process.exit(1)` with a clear FATAL message before `generateSecrets()`, `upsertEnvVars()`, or `createCompanyAndAdmin()` can run.
- If bypassed via `--force` on an already-installed system, a `console.warn` fires before proceeding.
- The same `schemaClient` connection is reused for the immediately-following `applyBaseSchema()` call (no second connection opened).
- The catch block's `console.error(\`FATAL: install failed: ${(err as Error).message}\`)` was replaced with `console.error(formatFatalError(err))`.

All 27 tests pass (18 pre-existing + 9 new), zero regressions.

## Verification

- `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` — 27/27 pass
- Source read confirms `main()` calls `isAlreadyInstalled(schemaClient)` (line 271) and gates through `shouldBlockInstall()` (line 272) strictly before `generateSecrets()` (line 285), `upsertEnvVars()`, and `createCompanyAndAdmin()` execute
- `grep -c "err as Error" install.ts` returns 0 — the unsafe cast is fully replaced
- `grep -c "isAlreadyInstalled"` / `"shouldBlockInstall"` / `"formatFatalError"` each return 2 (definition + call site)

**Note on the plan's literal grep-ordering acceptance criterion:** the plan's suggested check (`grep -n "generateSecrets()" | head -1` vs. `grep -n "isAlreadyInstalled(schemaClient)" | head -1`) picks up `generateSecrets()`'s *function definition* (line 30) rather than its call site (line 285), so a naive re-run of that exact grep pair would not show the intended ordering. The actual intent — the guard executing before secret generation in `main()`'s control flow — is satisfied and verified by direct source read (call site at line 285 is after the guard block at lines 270-283).

- Manual (documented, not automated, consistent with 17-01's precedent): a live-DB dry-run of `isAlreadyInstalled()` against a genuinely already-installed Postgres volume has not been run in this session — flagging for STATE.md per the plan's verification note.

## Deviations from Plan

None - plan executed exactly as written (Task 1 RED, Task 2 GREEN, no rule 1-4 triggers).

## Self-Check: PASSED

- FOUND: apps/api/src/scripts/install.ts (isAlreadyInstalled, shouldBlockInstall, formatFatalError all present)
- FOUND: apps/api/src/scripts/install.test.ts (9 new tests present)
- FOUND commit 93a049d (test(17-03): add failing tests...)
- FOUND commit 7b27956 (feat(17-03): add already-installed guard...)
