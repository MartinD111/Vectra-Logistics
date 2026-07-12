---
phase: 17-installer-first-run-flow
verified: 2026-07-12T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "The installer is safe to run more than once against an already-installed system without corrupting secrets or data (CR-01)"
  gaps_remaining: []
  regressions: []
---

# Phase 17: Installer First-Run Flow Verification Report

**Phase Goal:** A customer or their IT partner can go from a fresh checkout to a running, secured instance through one guided flow — no manual SQL, no default credentials.
**Verified:** 2026-07-12T00:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 17-03)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the installer generates a unique JWT_SECRET and ENCRYPTION_KEY — never a value from the repo or a prior install | ✓ VERIFIED | `generateSecrets()` (install.ts:30-34) unchanged from prior verification; two independent `crypto.randomBytes(32)` calls; unit-tested (install.test.ts:22-33, passing). No regression — the guard added in 17-03 runs *before* this call, so it now only executes on a genuine first run (or explicit `--force`). |
| 2 | The installer creates exactly one company and one real admin account (not admin@admin.com) | ✓ VERIFIED | `createCompanyAndAdmin()` (install.ts:124-152) unchanged; parameterized INSERTs inside BEGIN/COMMIT/ROLLBACK+finally. Now only reachable on a genuine first run (or `--force`), closing the "exactly one" caveat noted in the prior verification. |
| 3 | The installer runs the migration runner so the schema is current before the app serves traffic | ✓ VERIFIED | `applyBaseSchema()` (install.ts:78-92) + `runMigrations()` (install.ts:119-121, called at line 293) unchanged; still executes via `execFileSync` subprocess spawning `dist/scripts/migrate.js`, matching Phase 15's pattern. |
| 4 | The installer can optionally write a reachable local Gemma/Ollama endpoint into company_ai_config (provider:'local') | ✓ VERIFIED | Step 6 in `main()` (install.ts:308-333) unchanged; blank input skips entirely, probe failures warn but never block the write; 7 probe-related unit tests still pass (install.test.ts, `probeOllamaEndpoint`/`describeProbeError`/`buildTagsUrl` sections). |
| 5 | The installer is safe to run more than once against an already-installed system without corrupting secrets or data (CR-01 gap) | ✓ VERIFIED (gap closed) | `isAlreadyInstalled(client)` (install.ts:101-110) distinguishes "no schema" / "schema present but empty" / "real prior install" via `to_regclass('public.companies')` then `SELECT EXISTS(SELECT 1 FROM companies)`. `shouldBlockInstall(alreadyInstalled, force)` (install.ts:112-114) is a pure `alreadyInstalled && !force` gate. Wired into `main()` at lines 270-284 — this guard block executes strictly *before* `generateSecrets()` (line 285), `applyBaseSchema()` (line 288), and `createCompanyAndAdmin()` (line 296): a real prior install now hard-stops with `process.exit(1)` and a clear FATAL message unless `--force` is passed (in which case a `console.warn` fires first). Confirmed by direct source read of install.ts:270-284, not just SUMMARY claim. 9 new unit tests (install.test.ts:168-220) cover all three `isAlreadyInstalled()` states and all three `shouldBlockInstall()` truth-table cases, all passing. |

**Score:** 5/5 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/scripts/install.ts` | One-shot installer + re-run guard: `isAlreadyInstalled`, `shouldBlockInstall`, `formatFatalError` exported and wired into `main()` | ✓ VERIFIED (exists, substantive, wired) | 356 lines; all named exports present (confirmed by direct read); guard wired before secret/company mutation. |
| `apps/api/src/scripts/install.test.ts` | Unit tests for all helpers including the new guard/format functions | ✓ VERIFIED | 27 tests, all passing — ran directly: `node --require ts-node/register --test src/scripts/install.test.ts` → `pass 27, fail 0`. |
| `apps/api/package.json` | `install:on-prem` script entry | ✓ VERIFIED (regression check) | Still present, unchanged: `"install:on-prem": "node dist/scripts/install.js"`. |
| `package.json` (root) | root passthrough for `install:on-prem` | ✓ VERIFIED (regression check) | Still present, unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `install.ts main()` | `isAlreadyInstalled(schemaClient)` | called before `generateSecrets()`/`upsertEnvVars()`/`createCompanyAndAdmin()`, gated through `shouldBlockInstall()` | ✓ WIRED | Confirmed: guard block at install.ts:270-284; `generateSecrets()` call site at line 285, `applyBaseSchema()` at line 288, `createCompanyAndAdmin()` at line 296 — all strictly after the guard. |
| `install.ts main()` catch block | `formatFatalError(err)` | `console.error(formatFatalError(err))` replaces the direct `(err as Error).message` access | ✓ WIRED | Confirmed at install.ts:346; `grep -c "err as Error" install.ts` returns 0 — unsafe cast fully removed. |
| `install.ts main()` | `applyBaseSchema(client)` | `to_regclass('public.companies')` guard | ✓ WIRED (regression check, unchanged) | Confirmed at install.ts:78-92, called at line 288, reusing the same `schemaClient` opened for the new guard (no second connection). |
| `install.ts main()` | `database/migrations/*.sql` via `migrate.ts` | `execFileSync` spawning `dist/scripts/migrate.js` | ✓ WIRED (regression check, unchanged) | Confirmed at install.ts:119-121, called from main() line 293. |
| `install.ts createCompanyAndAdmin()` | `users` table | `bcrypt.hash` + parameterized INSERT, `role='admin'` | ✓ WIRED (regression check, unchanged) | Confirmed at install.ts:136-141. |
| `install.ts main()` | `.env` file | `upsertEnvVars` writes JWT_SECRET, ENCRYPTION_KEY, DEPLOYMENT_MODE=on-prem | ✓ WIRED (regression check, unchanged) | Confirmed at install.ts:302-306, now only reachable past the re-run guard. |
| `install.ts main()` optional AI step | `company_ai_config` table | `aiRepository.upsert(...)` | ✓ WIRED (regression check, unchanged) | Confirmed at install.ts:331. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit test suite for install.ts (18 pre-existing + 9 new guard/format tests) | `node --require ts-node/register --test src/scripts/install.test.ts` (run from `apps/api`) | 27/27 pass, 0 fail | ✓ PASS |
| `install:on-prem` still wired in both package.json files | `grep -n "install:on-prem" apps/api/package.json package.json` | Both files contain exactly one match | ✓ PASS |
| Unsafe error cast fully removed | `grep -c "err as Error" apps/api/src/scripts/install.ts` | Returns 0 | ✓ PASS |
| Guard executes before secret/company mutation | Direct code read of `main()` (install.ts:232-349) | `isAlreadyInstalled`/`shouldBlockInstall` (270-284) precede `generateSecrets()` (285), `applyBaseSchema()` (288), `createCompanyAndAdmin()` (296) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| INS-01 | 17-01-PLAN.md, 17-03-PLAN.md (gap closure) | Installer/first-run flow generates JWT_SECRET+ENCRYPTION_KEY, creates one company + real admin, runs migrations, writes DEPLOYMENT_MODE=on-prem — safely, including on a re-run | ✓ SATISFIED | install.ts main(), createCompanyAndAdmin(), applyBaseSchema(), upsertEnvVars(), and now isAlreadyInstalled()/shouldBlockInstall() closing the re-run safety gap |
| INS-02 | 17-02-PLAN.md | Installer can optionally write a reachable local Gemma/Ollama endpoint into company_ai_config (provider:'local') | ✓ SATISFIED (regression check, unchanged) | install.ts Step 6, `probeOllamaEndpoint`/`describeProbeError`/`buildTagsUrl`, all unit-tested |

Both requirement IDs from REQUIREMENTS.md's Installer section are declared in plan frontmatter (`17-01-PLAN.md: [INS-01]`, `17-02-PLAN.md: [INS-02]`, `17-03-PLAN.md: [INS-01]` gap closure) and fully accounted for — no orphaned requirements for this phase.

Note: REQUIREMENTS.md's traceability table (lines 30-31, 94-95) still shows both `INS-01`/`INS-02` as unchecked `[ ]` / "Pending" — this is a documentation-sync item (typically updated at milestone close), not a code gap. Flagged for visibility but non-blocking, consistent with the prior verification pass's note.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/scripts/install.ts` | 278-291 (now 320-333) | `localAiEndpoint` written to `company_ai_config.local_endpoint` with no URL-shape validation | ⚠️ Warning (pre-existing, WR-03, not in scope for 17-03) | Unchanged from prior verification — low severity, operator-supplied trusted input |
| `apps/api/src/scripts/install.ts` | 62-73 | `upsertEnvVars` strips all blank lines from `.env` on every write | ℹ️ Info (pre-existing, IN-01, not in scope for 17-03) | Cosmetic, unchanged |
| `apps/api/src/scripts/install.ts` | 146-151 | `ROLLBACK` in `createCompanyAndAdmin()`'s catch block is unguarded | ℹ️ Info (pre-existing, IN-02, not in scope for 17-03) | Lower diagnosability on rare connection-level failures, unchanged |
| `apps/api/src/scripts/install.test.ts` | — | Still no integration-style test coverage for `applyBaseSchema`, `createCompanyAndAdmin`, `runMigrations`, or the DB-connected portions of `main()`'s orchestration against a real Postgres instance | ℹ️ Info (documented, deferred per plan) | The new guard's DB-facing logic (`isAlreadyInstalled`) is now unit-tested via a fake `PoolClient`, closing the highest-risk portion of WR-01; a live-DB dry-run remains an explicitly documented manual verification step, not an automated gap |

CR-01 (previously 🛑 Blocker) is resolved — no longer present. WR-01 is substantially addressed (the guard logic itself is now unit-tested); the remaining live-DB dry-run is explicitly documented as a deferred manual check, consistent with 17-01's precedent, not a new gap introduced by this re-verification. WR-02 is resolved — no longer present (`grep -c "err as Error"` = 0).

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in files modified by this phase.

### Human Verification Required

None. The only remaining manual item — a live-DB dry-run of `isAlreadyInstalled()` against a genuinely already-installed Postgres volume — is explicitly documented in both 17-03-SUMMARY.md and this report as a deferred manual check (consistent with the pre-existing pattern for this phase's live-DB/live-Ollama checks), not a blocking gap for automated goal verification. The guard's core three-state logic is fully proven via unit tests against a fake `PoolClient`.

### Gaps Summary

None. Plan 17-03 closed the phase's only remaining gap (CR-01: no guard against re-running the installer against an already-installed system). Direct source reading of `apps/api/src/scripts/install.ts` confirms:

1. `isAlreadyInstalled(client)` and `shouldBlockInstall(alreadyInstalled, force)` are implemented exactly as specified, distinguishing "schema absent," "schema present but empty," and "real prior install."
2. Both are wired into `main()` strictly before `generateSecrets()`, `applyBaseSchema()`, and `createCompanyAndAdmin()` — a second run against an already-installed system now hard-stops with `process.exit(1)` unless `--force` is explicitly passed (in which case a `console.warn` fires).
3. `formatFatalError(err)` replaces the unsafe `(err as Error).message` cast (WR-02), confirmed by `grep -c "err as Error"` returning 0.
4. All 27 unit tests pass (18 pre-existing regression tests + 9 new guard/format tests), independently re-run in this verification pass (not just trusted from SUMMARY.md).
5. All four previously-verified truths (unique secrets, single company/admin, migration runner, optional local-AI wiring) and all previously-verified key links and artifacts still hold — no regressions introduced by the 17-03 changes.

The phase goal — "a customer or their IT partner can go from a fresh checkout to a running, secured instance through one guided flow — no manual SQL, no default credentials" — is now achieved including the safety property implicit in "one guided flow": accidentally or deliberately re-running the installer against a live system no longer silently corrupts encrypted data or invalidates sessions.

---

_Verified: 2026-07-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
