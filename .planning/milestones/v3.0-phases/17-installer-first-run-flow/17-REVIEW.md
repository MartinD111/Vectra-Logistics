---
phase: 17-installer-first-run-flow
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - apps/api/src/scripts/install.ts
  - apps/api/src/scripts/install.test.ts
  - apps/api/package.json
  - package.json
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the on-prem installer script (`install.ts`), its unit tests, and the two `package.json` files that wire up the new `install:on-prem` npm script. The unit-testable pure functions (validators, `upsertEnvVars`, `buildTagsUrl`, `describeProbeError`, `generateSecrets`) are correct and well covered by `install.test.ts` (18/18 passing locally). SQL access is fully parameterized (no injection risk), the admin password is never accepted via CLI flag/argv (avoiding shell-history/`ps` exposure), and the transaction in `createCompanyAndAdmin` is wrapped correctly with `BEGIN`/`COMMIT`/`ROLLBACK` and a `finally`-guaranteed `client.release()`.

The main correctness gap is that `applyBaseSchema()` guards *schema* idempotency only (`to_regclass('public.companies')`), but nothing in `main()` guards the rest of the install flow. Re-running the installer against an already-installed system (accidental re-run, retried failed deploy, re-triggered CI/CD step) unconditionally regenerates and overwrites the global `JWT_SECRET`/`ENCRYPTION_KEY` in `.env` and inserts another company/admin row. Because `ENCRYPTION_KEY` is a single global secret used to decrypt previously-stored `company_ai_config.api_key_enc` values (cloud AI provider keys) and telematics credentials elsewhere in the codebase, this can silently and irreversibly corrupt already-encrypted data for any company that was set up by an earlier run, in addition to invalidating every existing JWT session. This is the one Critical finding below; the rest are quality/robustness items.

## Critical Issues

### CR-01: Re-running the installer silently regenerates and overwrites global secrets, corrupting previously-encrypted data

**File:** `apps/api/src/scripts/install.ts:78-92, 242-264`
**Issue:** `applyBaseSchema()` (lines 78-92) only guards against re-applying `init.sql`/`extensions.sql` — it checks `to_regclass('public.companies')` and returns early if the schema already exists. However, `main()` calls `generateSecrets()` (line 242) and `upsertEnvVars(ENV_PATH, { JWT_SECRET, ENCRYPTION_KEY, DEPLOYMENT_MODE })` (lines 260-264) unconditionally on every successful run, with no check for "was this system already installed?" A second invocation of the installer (accidental re-run, retried CI/CD deploy, an operator re-triggering the "first run" flow, or simply running with a different `--admin-email`) will:
1. Insert a *second* `companies` row and a *second* admin `users` row (only blocked if the email happens to collide with the existing unique `users.email` constraint — a different email sails through).
2. Generate brand-new `JWT_SECRET`/`ENCRYPTION_KEY` values and blindly overwrite them in `.env` via `upsertEnvVars`.

`ENCRYPTION_KEY` is the single global AES-256-GCM key used by `apps/api/src/core/crypto/secretBox.ts` to encrypt/decrypt `company_ai_config.api_key_enc` (cloud AI provider keys) and by `apps/api/src/workers/telematics.worker.ts` to decrypt telematics credentials. Overwriting it means any data previously encrypted under the old key becomes permanently undecryptable — there is no migration or re-encryption path, and the old key is not retained anywhere. Rotating `JWT_SECRET` simultaneously invalidates every existing user session. Given the constraint that install must be safe as a "first-run flow," this needs a hard stop (or explicit `--force`/re-install confirmation) once the system is already installed, not just a schema-level guard.
**Fix:**
```ts
async function main() {
  try {
    // ...
    const schemaClient = await db.connect();
    let alreadyInstalled = false;
    try {
      const { rows } = await schemaClient.query(
        `SELECT EXISTS(SELECT 1 FROM companies LIMIT 1) AS installed`,
      );
      alreadyInstalled = rows[0].installed;
      await applyBaseSchema(schemaClient);
    } finally {
      schemaClient.release();
    }

    if (alreadyInstalled && !hasFlag('force')) {
      console.error(
        'FATAL: this system already has a company configured. Re-running the installer ' +
        'would overwrite JWT_SECRET/ENCRYPTION_KEY and break existing encrypted data. ' +
        'Pass --force only if you understand the consequences.',
      );
      process.exit(1);
    }
    // ... only regenerate secrets / write .env / create company when !alreadyInstalled (or --force)
```
Alternatively, gate secret regeneration specifically: only call `upsertEnvVars` with `JWT_SECRET`/`ENCRYPTION_KEY` when they are not already present and non-default in `.env`, so re-runs never clobber a working key even if company creation is retried for some other reason.

## Warnings

### WR-01: No test coverage for the highest-risk logic (`applyBaseSchema`, `createCompanyAndAdmin`, `runMigrations`, `main`)

**File:** `apps/api/src/scripts/install.test.ts`
**Issue:** `install.test.ts` covers only the pure helper functions (validators, `generateSecrets`, `upsertEnvVars`, `buildTagsUrl`, `describeProbeError`, `probeOllamaEndpoint`). None of the functions that touch the database transaction, schema idempotency check, or the overall `main()` orchestration (including the secret-overwrite behavior flagged in CR-01) have any test coverage. This is exactly the code path where the critical bug above went unnoticed.
**Fix:** Add integration-style tests (using a real or lightly-mocked `pg` client/pool, e.g. `pg-mem` or a test Postgres container) that exercise: (a) `applyBaseSchema()` skipping when `companies` already exists, (b) `createCompanyAndAdmin()` rolling back on a duplicate-email unique violation, and (c) a `main()`-level test asserting that a second invocation against an already-installed database does NOT overwrite `JWT_SECRET`/`ENCRYPTION_KEY` in `.env`.

### WR-02: Error handler assumes every thrown value is an `Error` instance

**File:** `apps/api/src/scripts/install.ts:302-306`
**Issue:**
```ts
} catch (err) {
  console.error(`FATAL: install failed: ${(err as Error).message}`);
  process.exit(1);
}
```
If anything in the call chain throws a non-`Error` value (a plain string, a `pg` driver error missing `.message` in some edge cases, or a rejected promise with a primitive reason), `(err as Error).message` is `undefined`, producing the unhelpful `FATAL: install failed: undefined` and hiding the actual failure reason from the operator running the installer.
**Fix:**
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`FATAL: install failed: ${message}`);
  process.exit(1);
}
```

### WR-03: Local AI endpoint value is persisted with no format validation, even on a hard probe failure

**File:** `apps/api/src/scripts/install.ts:278-291`
**Issue:** `localAiEndpoint` is taken directly from a flag/env var/prompt with no URL-shape validation (unlike `validateAdminEmail`/`validateCompanyName`/`validateAdminPassword` for the other three inputs). If the probe fails (e.g. `ECONNREFUSED`, or the string isn't even a valid URL and `axios.get` throws a `TypeError`/`Invalid URL` before making a network call), the warning is printed but `aiRepository.upsert(...)` still writes the raw, unvalidated string into `company_ai_config.local_endpoint`. This is called out as intentional in the surrounding comment ("D-03: value is written regardless"), but there's a difference between "reachability failed, still trust the URL" and "the string isn't a URL at all" — the latter should probably still be caught before writing to the DB.
**Fix:** Add a lightweight format check (e.g. `new URL(localAiEndpoint)` wrapped in try/catch) before the probe/write, and treat a malformed URL as a hard validation failure (consistent with the other three validators) rather than a soft warning.

## Info

### IN-01: `upsertEnvVars` silently drops all blank lines from `.env` on every write

**File:** `apps/api/src/scripts/install.ts:62-73`
**Issue:** `fs.writeFileSync(envPath, lines.filter((l) => l.length > 0).join('\n') + '\n')` strips every empty line from the file, including ones an operator may have added intentionally between sections of `.env` for readability. Every time the installer touches `.env` (which happens on every run per CR-01), this reformats the entire file.
**Fix:** Preserve blank lines, or only filter blank lines that were introduced by this function's own trailing-newline handling, e.g. `lines.join('\n')` without the aggressive filter, or a filter that only removes lines at the very end of the array.

### IN-02: `createCompanyAndAdmin` swallows the original error if `ROLLBACK` itself fails

**File:** `apps/api/src/scripts/install.ts:106-130`
**Issue:** In the `catch` block, `await client.query('ROLLBACK')` is not itself wrapped — if the connection has already been dropped (e.g. the original error was a connection-level failure), the `ROLLBACK` call can throw a second exception, replacing the original, more diagnostic error that triggered the catch block in the first place.
**Fix:**
```ts
} catch (err) {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackErr) {
    console.error('ROLLBACK failed after error:', (rollbackErr as Error).message);
  }
  throw err;
} finally {
  client.release();
}
```

---

_Reviewed: 2026-07-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
