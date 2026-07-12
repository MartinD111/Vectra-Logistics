---
phase: 17-installer-first-run-flow
verified: 2026-07-12T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The installer is safe to run more than once against an already-installed system without corrupting secrets or data (implied by the phase goal's 'one guided flow ... a running, secured instance' and INS-01's install-not-corrupt intent)"
    status: failed
    reason: >
      main() in install.ts guards ONLY schema-level idempotency
      (applyBaseSchema()'s to_regclass('public.companies') check). Nothing in
      main() checks whether the system has already been installed before
      calling generateSecrets() and upsertEnvVars(), and createCompanyAndAdmin()
      unconditionally inserts a new companies + users row on every invocation.
      A second run (accidental re-run, retried CI/CD deploy step, operator
      re-triggering "first run") will: (1) overwrite JWT_SECRET and
      ENCRYPTION_KEY in .env with brand-new random values, permanently
      breaking decryption of any company_ai_config.api_key_enc / telematics
      credentials encrypted under the old ENCRYPTION_KEY (no re-encryption or
      key-rotation path exists), and invalidating every existing JWT session;
      (2) insert a second company + admin user row (only blocked if the new
      run happens to reuse the same admin email, which collides with the
      unique users.email constraint — any different email sails through).
      This is documented as CR-01 (Critical) in 17-REVIEW.md and independently
      confirmed by direct code reading of install.ts:204-306 — there is no
      "already installed" check anywhere in main() prior to secret
      regeneration or company/admin creation.
    artifacts:
      - path: "apps/api/src/scripts/install.ts"
        issue: "main() (lines 204-306) calls generateSecrets()/upsertEnvVars() and createCompanyAndAdmin() unconditionally on every run; applyBaseSchema()'s to_regclass guard (lines 78-92) only protects schema DDL, not secrets or company/admin rows"
    missing:
      - "An 'already installed' check (e.g. SELECT EXISTS(SELECT 1 FROM companies)) before generating/writing new secrets or creating a company+admin, with a hard stop (or explicit --force acknowledgment) on a second run — per 17-REVIEW.md CR-01's suggested fix"
      - "Unit/integration test coverage asserting a second main() invocation against an already-installed database does NOT overwrite JWT_SECRET/ENCRYPTION_KEY (17-REVIEW.md WR-01)"
---

# Phase 17: Installer First-Run Flow Verification Report

**Phase Goal:** A customer or their IT partner can go from a fresh checkout to a running, secured instance through one guided flow — no manual SQL, no default credentials.
**Verified:** 2026-07-12T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the installer generates a unique JWT_SECRET and ENCRYPTION_KEY — never a value from the repo or a prior install | ✓ VERIFIED (fresh-install case only) | `generateSecrets()` (install.ts:30-34) makes two independent `crypto.randomBytes(32).toString('hex')` calls, unit-tested for 64-hex format and cross-call uniqueness (install.test.ts:19-30, both passing). No hardcoded/fallback value anywhere in the function. **Caveat:** see gap below — this same unconditional call also fires on a *second* run, overwriting an already-set, already-in-use secret. |
| 2 | The installer creates exactly one company and one real admin account (not admin@admin.com) | ✓ VERIFIED (single-run case) | `createCompanyAndAdmin()` (install.ts:102-130) does exactly one parameterized `INSERT INTO companies` and one `INSERT INTO users (... role='admin' ...)` per invocation, wrapped in `BEGIN/COMMIT/ROLLBACK` + `finally { client.release() }`. Email is operator-supplied and validated via `validateAdminEmail()` (rejects malformed addresses); no `admin@admin.com` default path exists. **Caveat:** "exactly one" only holds for a single invocation — see gap below for re-run behavior. |
| 3 | The installer runs the migration runner so the schema is current before the app serves traffic | ✓ VERIFIED | `applyBaseSchema()` (install.ts:78-92) applies `init.sql`+`extensions.sql` guarded by `to_regclass('public.companies')` (correctly handles the non-idempotent `CREATE TYPE` statements in init.sql), then `main()` calls `runMigrations()` (install.ts:97-99, 251) which spawns `node apps/api/dist/scripts/migrate.js` via `execFileSync` with `stdio: 'inherit'` — matches Phase 15's runner, invoked as a subprocess (correctly avoids `migrate.ts`'s own `process.exit()` killing the installer if imported in-process). |
| 4 | The installer can optionally write a reachable local Gemma/Ollama endpoint into company_ai_config (provider:'local') | ✓ VERIFIED | Step 6 in `main()` (install.ts:266-291): blank prompt/unset flags skip the step entirely (no `aiRepository.upsert` call reachable — confirmed by reading the `if (localAiEndpoint)` guard); a provided endpoint is probed via `fetchOllamaTags()`→`buildTagsUrl()` (`GET {endpoint}/api/tags`, 3s timeout) and written via `aiRepository.upsert(companyId, 'local', localAiModel, null, localAiEndpoint, localAiModel, adminUserId)` regardless of probe outcome (D-03 — probe failure only produces a `console.warn` with a specific ECONNREFUSED/ETIMEDOUT/ENOTFOUND/HTTP-status message via `describeProbeError()`, never blocks the write). All 7 probe-related unit tests pass. |
| 5 | The installer is safe to run more than once without corrupting secrets or existing data | ✗ FAILED | See gaps section — confirmed by direct code read of `main()` (install.ts:204-306): no "already installed" guard exists before `generateSecrets()`/`upsertEnvVars()`/`createCompanyAndAdmin()`. Matches 17-REVIEW.md's CR-01 finding exactly (line numbers and mechanism independently reproduced). |

**Score:** 4/5 truths verified (truth 5 is a derived truth, not a literal roadmap SC — see analysis below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/scripts/install.ts` | One-shot installer: generateSecrets, applyBaseSchema, runMigrations, createCompanyAndAdmin, upsertEnvVars, probeOllamaEndpoint, describeProbeError, buildTagsUrl, main() | ✓ VERIFIED (exists, substantive, wired) | 314 lines; all named exports present and used from `main()`; imports `aiRepository` from the real domain repository (no duplicate SQL). |
| `apps/api/src/scripts/install.test.ts` | Unit tests for secrets, validators, .env upsert, probe helpers | ✓ VERIFIED | 18 tests, all passing (`node --require ts-node/register --test src/scripts/install.test.ts` run directly — see below). |
| `apps/api/package.json` | `install:on-prem` script entry | ✓ VERIFIED | `"install:on-prem": "node dist/scripts/install.js"` present, mirrors `migrate` entry shape. |
| `package.json` (root) | root passthrough for `install:on-prem` | ✓ VERIFIED | `"install:on-prem": "npm run install:on-prem --workspace @vectra/api"` present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `install.ts main()` | `applyBaseSchema(client)` | `to_regclass('public.companies')` guard | ✓ WIRED | Confirmed at install.ts:79-83. |
| `install.ts main()` | `database/migrations/*.sql` via `migrate.ts` | `execFileSync` spawning `dist/scripts/migrate.js` | ✓ WIRED | Confirmed at install.ts:97-99, called from main() line 251. |
| `install.ts createCompanyAndAdmin()` | `users` table | `bcrypt.hash(password, 10)` + parameterized INSERT, `role='admin'` | ✓ WIRED | Confirmed at install.ts:114-119. |
| `install.ts main()` | `.env` file | `upsertEnvVars` writes JWT_SECRET, ENCRYPTION_KEY, DEPLOYMENT_MODE=on-prem | ✓ WIRED | Confirmed at install.ts:260-264. |
| `install.ts probeOllamaEndpoint()`/`fetchOllamaTags()` | customer's Ollama/Gemma endpoint | `axios.get(buildTagsUrl(endpoint), { timeout: 3000 })` | ✓ WIRED | Confirmed at install.ts:154, 168. |
| `install.ts main()` optional AI step | `company_ai_config` table | `aiRepository.upsert(companyId, 'local', localModel, null, localEndpoint, localModel, adminUserId)` | ✓ WIRED | Confirmed at install.ts:289; `aiRepository.upsert()` signature matches (`ai.repository.ts:20`). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit test suite for install.ts | `node --require ts-node/register --test src/scripts/install.test.ts` (run from `apps/api`, using local `node_modules/ts-node`) | 18/18 pass, 0 fail | ✓ PASS |
| `install:on-prem` wired in both package.json files | `grep -n "install:on-prem" apps/api/package.json package.json` | Both files contain exactly one match, mirroring `migrate` | ✓ PASS |
| Re-run safety (main() guards against double-install) | Direct code read of `main()` (install.ts:204-306) | No "already installed" check before secret/company writes | ✗ FAIL (see gap) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| INS-01 | 17-01-PLAN.md | Installer/first-run flow generates JWT_SECRET+ENCRYPTION_KEY, creates one company + real admin, runs migrations, writes DEPLOYMENT_MODE=on-prem | ⚠ SATISFIED for a genuine first run; re-run safety gap (see above) undermines the "no manual SQL, no default credentials" *safe* guided-flow intent for the realistic accidental-re-run scenario | install.ts main(), createCompanyAndAdmin(), applyBaseSchema(), upsertEnvVars() |
| INS-02 | 17-02-PLAN.md | Installer can optionally write a reachable local Gemma/Ollama endpoint into company_ai_config (provider:'local') | ✓ SATISFIED | install.ts Step 6, `probeOllamaEndpoint`/`describeProbeError`/`buildTagsUrl`, all unit-tested (7 tests) |

Both requirement IDs from REQUIREMENTS.md's Installer section are declared in plan frontmatter (`17-01-PLAN.md: [INS-01]`, `17-02-PLAN.md: [INS-02]`) and accounted for — no orphaned requirements for this phase. Note: REQUIREMENTS.md's traceability table still shows both as "Pending" — a documentation-sync item, not a code gap; not blocking for this verification (REQUIREMENTS.md checkbox/status update is typically done at milestone close, but flagged here for visibility).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/scripts/install.ts` | 204-306 | Missing "already installed" guard before secret regeneration / company creation | 🛑 Blocker (see gap) | Re-running the installer silently corrupts already-encrypted data and invalidates all sessions — documented as CR-01 in 17-REVIEW.md, independently confirmed here by direct code reading |
| `apps/api/src/scripts/install.ts` | 304 | `(err as Error).message` assumes every thrown value is an `Error` instance | ⚠️ Warning | Non-`Error` throws (e.g. a bare string) would print `FATAL: install failed: undefined`, hiding the real failure reason from the operator (17-REVIEW.md WR-02) |
| `apps/api/src/scripts/install.ts` | 278-291 | `localAiEndpoint` written to `company_ai_config.local_endpoint` with no URL-shape validation, even when the probe throws on a malformed string | ⚠️ Warning | A non-URL string could be persisted; low severity since it's operator-supplied trusted input, not attacker input (17-REVIEW.md WR-03) |
| `apps/api/src/scripts/install.ts` | 62-73 | `upsertEnvVars` strips all blank lines from `.env` on every write | ℹ️ Info | Cosmetic — reformats operator's `.env` file structure on every run (17-REVIEW.md IN-01) |
| `apps/api/src/scripts/install.ts` | 124-129 | `ROLLBACK` in `createCompanyAndAdmin()`'s catch block is unguarded; a rollback failure can mask the original error | ℹ️ Info | Lower diagnosability on rare connection-level failures (17-REVIEW.md IN-02) |
| `apps/api/src/scripts/install.test.ts` | — | No test coverage for `applyBaseSchema`, `createCompanyAndAdmin`, `runMigrations`, or `main()`'s orchestration (only pure/mockable helpers are tested) | ⚠️ Warning | This is exactly the code path where CR-01 went unnoticed (17-REVIEW.md WR-01) |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in files modified by this phase.

### Human Verification Required

None identified as strictly required for automated goal verification — the remaining items (live-DB dry-run against a genuinely fresh Postgres volume, live Ollama instance test) are documented in 17-VALIDATION.md's Manual-Only Verifications section as pre-existing, explicitly deferred manual checks (consistent with the migrations-023/024 precedent), not new items surfaced by this verification pass. Fixing CR-01 is a code change, not a human-verification item.

### Gaps Summary

Both plans' declared must-haves (INS-01, INS-02) are implemented, unit-tested, and wired correctly for a **single, genuine first run**: unique secrets are generated, exactly one company + one real bcrypt-hashed admin account is created, the migration runner is invoked before the app would serve traffic, and the optional local-AI step probes and writes `company_ai_config` without blocking on probe failure.

However, code-review finding CR-01 (already on file at `17-REVIEW.md`, independently reproduced here by direct reading of `install.ts:204-306`) identifies a critical gap against the phase goal: **the installer has no guard against being run a second time against an already-installed system.** `applyBaseSchema()`'s `to_regclass('public.companies')` check only protects the non-idempotent `CREATE TYPE` statements in `init.sql` — it does not gate `generateSecrets()`/`upsertEnvVars()` or `createCompanyAndAdmin()`. A second invocation (accidental re-run, a retried CI/CD deploy step, an operator re-triggering what they believe is still "first run") will:

1. Overwrite the global `ENCRYPTION_KEY` in `.env`, permanently breaking decryption of any `company_ai_config.api_key_enc` or telematics credentials encrypted under the old key (no re-encryption/rotation path exists anywhere in the codebase).
2. Overwrite `JWT_SECRET`, invalidating every existing user session instance-wide.
3. Insert a second `companies` + admin `users` row (blocked only if the new run happens to reuse the exact same admin email as before).

The phase goal is "a customer or their IT partner can go from a fresh checkout to a running, **secured** instance through **one guided flow**." A flow whose accidental second execution silently and irreversibly corrupts already-encrypted production data and kills every session is not a safe "one guided flow" for a production on-prem installer — this is a realistic operational scenario (retried deploy scripts, confused operators), not a contrived edge case, and it directly undermines the "secured instance" outcome for any company that already completed setup.

This is surfaced as a BLOCKER gap (truth 5 above), separate from the four literal roadmap Success Criteria (all VERIFIED for the single-run case) because it reflects the phase goal's implicit safety contract for a "guided flow" rather than a component that is missing outright. Recommend: add an "already installed" check (`SELECT EXISTS(SELECT 1 FROM companies)`) before secret regeneration/company creation, with a hard stop unless an explicit `--force` (or similar) is passed — per 17-REVIEW.md CR-01's suggested fix — before this phase is considered closed.

---

_Verified: 2026-07-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
