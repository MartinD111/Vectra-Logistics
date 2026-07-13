# Phase 17: Installer / First-Run Flow - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 5 (1 new script, 4 supporting wiring changes)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `apps/api/src/scripts/install.ts` (new) | script (ops/CLI, multi-step orchestration) | batch (sequential DB writes + one external HTTP probe) | `apps/api/src/scripts/migrate.ts` | exact (same "one-shot ops script, plain pg+fs, process.exit on failure" role) |
| `apps/api/src/scripts/install.ts` — schema-apply step (`applyBaseSchema()`) | utility (idempotent DDL apply) | batch | `apps/api/src/scripts/migrate.ts` (transaction-per-file loop) + `database/init.sql`/`database/extensions.sql` (content to apply) | role-match (no existing "apply init.sql idempotently from TS" code; migrate.ts's loop/guard style is the closest structural analog) |
| `apps/api/src/scripts/install.ts` — company+admin creation step (`createCompanyAndAdmin()`) | service-like function (CRUD, transactional) | CRUD | `apps/api/src/controllers/authController.ts` `signup()` (lines 13-131) | role-match (same companies+users insert shape, simplified — no workspace/verification-token steps) |
| `apps/api/src/scripts/install.ts` — local-AI probe+write step (`probeOllamaEndpoint()` + `company_ai_config` write) | service (external HTTP probe) + repository call (CRUD upsert) | request-response (probe) + CRUD (write) | `apps/api/src/domains/ai/ai.service.ts` (axios+timeout, `providerError` shape, lines 95-176) + `apps/api/src/domains/ai/ai.repository.ts` `upsert()` (lines 20-46) | exact for the repository write; role-match for the probe (no existing bare-reachability GET, but the axios+timeout+try/catch idiom is identical) |
| `apps/api/src/scripts/install.ts` — `.env` write (`upsertEnvVars()`) | utility (file I/O) | file-I/O | *(no analog exists in repo — plain `fs` read/replace/write is new territory)* | no analog — follow RESEARCH.md's provided code example, styled like `migrate.ts`'s plain-`fs` usage |
| `apps/api/package.json` / root `package.json` script wiring (`install:on-prem`) | config | — | existing `"migrate": "node dist/scripts/migrate.js"` (apps/api) + `"migrate": "npm run migrate --workspace @vectra/api"` (root) | exact — mirror verbatim with new script name |

## Pattern Assignments

### `apps/api/src/scripts/install.ts` (script, batch/orchestration) — overall shape

**Analog:** `apps/api/src/scripts/migrate.ts` (full file, 77 lines)

**Imports pattern** (lines 1-3):
```typescript
import { db } from '../core/db';
import fs from 'fs';
import path from 'path';
```
Use the same relative-import style (no path aliases in `apps/api`). Note the path-depth comment convention above `MIGRATIONS_DIR` (lines 5-8) — do the same for any `database/` path constants in `install.ts` (works identically for both `dist/scripts/install.js` prod and `src/scripts/install.ts` ts-node dev).

**Top-level script shape** (lines 14-77):
```typescript
async function main() {
  try {
    // ... steps ...
    console.log('...complete.');
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error(`FATAL: ... failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
main();
```
Reuse this exact `main()` + `process.exit(0)`/`process.exit(1)` shape, and the `(err as Error).message`-only logging discipline (never log the raw error object — same rationale as migrate.ts's T-15-04 comment, lines 61-63: avoid leaking connection-string/query details).

**Per-step transaction pattern** (lines 43-58, the migration-apply loop):
```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename]
  );
  await client.query('COMMIT');
  console.log(`Applied: ${filename}`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```
Reuse this `BEGIN`/`COMMIT`/`ROLLBACK`/`finally { client.release() }` idiom for every transactional step in `install.ts` (schema apply guard, company+admin creation).

---

### `install.ts` — schema-apply step (base-schema gap fix)

**Analog:** `apps/api/src/scripts/migrate.ts` (guard/filter style) + `database/extensions.sql` (idempotency conventions) + `database/init.sql` (`CREATE TYPE` non-idempotency — the specific gotcha)

**Idempotency guard** — RESEARCH.md's Common Pitfall #1 already specifies the exact check to use before applying `init.sql`/`extensions.sql`:
```sql
SELECT to_regclass('public.companies')
```
If this returns non-null, skip `applyBaseSchema()` entirely (companies table already exists — base schema was already applied, either via dev's `docker-entrypoint-initdb.d` mount or a prior installer run). This mirrors migrate.ts's own "check `schema_migrations` before applying" pattern (lines 30-33: `SELECT filename FROM schema_migrations` → `applied` set → `pending` filter) — same idea, applied to a single guard table instead of a per-file ledger.

**File-read pattern** (`database/extensions.sql` header, lines 1-10):
```sql
-- =============================================================================
-- VECTRA Platform — Schema Extension Migration
-- File: extensions.sql
-- Depends on: init.sql (must be executed first)
--
-- This migration safely extends the base schema created by init.sql.
-- All statements use CREATE TABLE IF NOT EXISTS and
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS so the script is fully
-- idempotent and can be re-run without errors.
-- =============================================================================
```
Confirms `extensions.sql` is naturally idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` throughout — see lines 19-188). `init.sql` is NOT (bare `CREATE TYPE user_role AS ENUM (...)` etc. at lines 5-9, and `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` at line 2 which IS idempotent) — this is exactly why the `to_regclass` guard must wrap the whole `applyBaseSchema()` call, not rely on the SQL files' own idempotency.

**Read+apply pattern** (adapt migrate.ts lines 42, 46 — `fs.readFileSync` + `client.query(sql)`):
```typescript
async function applyBaseSchema(client: PoolClient) {
  const { rows } = await client.query(`SELECT to_regclass('public.companies') AS exists`);
  if (rows[0].exists) {
    console.log('Base schema already applied — skipping init.sql/extensions.sql.');
    return;
  }
  const initSql = fs.readFileSync(path.join(__dirname, '../../../../database/init.sql'), 'utf-8');
  const extSql = fs.readFileSync(path.join(__dirname, '../../../../database/extensions.sql'), 'utf-8');
  await client.query(initSql);
  await client.query(extSql);
  console.log('Base schema applied (init.sql + extensions.sql).');
}
```

---

### `install.ts` — company + admin creation step

**Analog:** `apps/api/src/controllers/authController.ts` `signup()` (lines 13-131)

**Note on import path drift:** `authController.ts` imports `db` from `'../config/db'` (line 4), while `migrate.ts`/`ai.repository.ts` import from `'../core/db'`. Use `'../core/db'` in `install.ts` (the newer/canonical path per `migrate.ts` and `ai.repository.ts`), not the legacy `config/db` path `authController.ts` still uses.

**Company insert pattern** (lines 48-53):
```typescript
const companyResult = await client.query(
  `INSERT INTO companies (name, vat_number, address, city, country, postal_code, status)
   VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
  [company_name, company_vat, company_address, company_city, company_country, company_postal_code]
);
companyId = companyResult.rows[0].id;
```
Simplify for the installer: only `name` and `status` are needed (installer's single company should be created pre-approved, not `'pending'` — no approval workflow applies to a trusted first-run admin). RESEARCH.md's Pattern 2 example already reflects this simplification (`status = 'approved'`).

**Password hashing pattern** (lines 70-72):
```typescript
const saltRounds = 10;
const passwordHash = await bcrypt.hash(password, saltRounds);
```
Reuse verbatim — same `bcrypt`, same cost factor 10, matching both `signup()` and `017_seed_admin_user.sql`'s hash format (so `login()`'s `bcrypt.compare` continues to work unmodified).

**User insert pattern** (lines 81-85), adapted per RESEARCH.md Pattern 2 — `role='admin'` fixed, `is_verified=TRUE` (no email-verification token needed, unlike `signup()`'s lines 96-103 which create an `auth_tokens` row — installer is a trusted operator action, skip that step entirely):
```typescript
await client.query(
  `INSERT INTO users (email, password_hash, first_name, last_name, role, company_id, is_verified)
   VALUES ($1, $2, $3, $4, 'admin', $5, TRUE)`,
  [email, passwordHash, 'Admin', 'Admin', companyId],
);
```

**Transaction wrapper** — use the `BEGIN`/`COMMIT`/`ROLLBACK` pattern shown above (migrate.ts lines 45-58), not `authController.ts`'s `try/catch` + manual `res.status(500)` (no HTTP response context exists in a CLI script).

**What NOT to copy from `signup()`:** the `workspaces` insert (lines 55-67), the `user_preferences` insert (lines 90-93), the `auth_tokens` verification-token insert (lines 95-103), and the `recordEvent()` activity-log call (lines 108-116) — all out of scope for a one-shot installer per CONTEXT.md's phase boundary (this phase orchestrates company+admin+schema+AI-config, nothing else).

---

### `install.ts` — local-AI probe + `company_ai_config` write step

**Analog (probe):** `apps/api/src/domains/ai/ai.service.ts` (axios+timeout+error-normalization idiom, lines 95-176)

**Axios+timeout pattern** (lines 103-112, adapted to a plain GET):
```typescript
const res = await axios.post(
  'https://api.openai.com/v1/chat/completions',
  { /* ... */ },
  { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 },
);
```
Adapt to: `axios.get(\`${endpoint}/api/tags\`, { timeout: 3000 })` per RESEARCH.md Pattern 3 (shorter timeout appropriate for a reachability-only probe, not a completion call).

**Error normalization pattern** (lines 166-175, `providerError()`):
```typescript
private providerError(label: string, err: unknown): AppError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 502;
    const providerMsg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    return new AppError(status >= 400 && status < 500 ? status : 502, `${label} request failed: ${providerMsg ?? err.message}`);
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  return new AppError(502, `${label} request failed: ${message}`);
}
```
Do NOT reuse `AppError` in `install.ts` (no HTTP request context — matches the `authController` note above). Instead, per RESEARCH.md Pitfall #4, distinguish `err.code` (`ECONNREFUSED`/`ETIMEDOUT`/`ENOTFOUND`) vs. HTTP error status when building the printed warning string, borrowing the *shape* of this axios-error-discrimination logic, not the `AppError` throw.

**Analog (config write):** `apps/api/src/domains/ai/ai.repository.ts` `upsert()` (lines 20-46) — call this repository function directly rather than hand-writing a duplicate SQL upsert (per RESEARCH.md's Anti-Patterns section):
```typescript
async upsert(
  companyId: string,
  provider: AiProvider,
  model: string | null,
  apiKeyEnc: string | null | undefined,
  localEndpoint: string | null,
  localModel: string | null,
  updatedBy: string | null,
): Promise<AiConfigRow> {
  // INSERT ... ON CONFLICT (company_id) DO UPDATE ...
}
```
Call as: `aiRepository.upsert(companyId, 'local', localModel, null, localEndpoint, localModel, adminUserId)` — `apiKeyEnc: null` (not `undefined`) since local providers never have a cloud key (see `005_ai_config.sql` header comment, lines 6-9: local providers store a plain non-secret endpoint/model, no `api_key_enc`). `updatedBy` = the just-created admin's `users.id`.

**Schema reference** (`database/migrations/005_ai_config.sql`, lines 14-24):
```sql
CREATE TABLE IF NOT EXISTS company_ai_config (
  company_id       UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'openai',
  model            TEXT,
  api_key_enc      TEXT,
  local_endpoint   TEXT,
  local_model      TEXT,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `install.ts` — secrets generation

**Analog:** `apps/api/src/core/crypto/secretBox.ts` (header comment, line 9) — the exact command to invoke as the generation method:
```typescript
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
In `install.ts`, call the underlying primitive directly rather than shelling out:
```typescript
import crypto from 'crypto';
const jwtSecret = crypto.randomBytes(32).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');
```
Must produce exactly 64 hex chars for `ENCRYPTION_KEY` — `secretBox.ts`'s `getEncryptionKey()` (lines 23-29) throws `AppError(500, 'ENCRYPTION_KEY env var is missing or invalid (must be 64-char hex)')` if `hex.length !== 64`, so the installer's output must satisfy that exact length check.

**Validation contract the installer's output must satisfy:** `apps/api/src/core/config/secrets.ts` `validateJwtSecretValue()`/`validateEncryptionKeyValue()` (lines 22-44) reject empty values, the known-bad legacy fallback strings (lines 12-14: `'vectra-dev-secret-key-change-in-production'`, `'super-secret-key-for-dev'`, `'204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20'`), and any non-64-char `ENCRYPTION_KEY`. Freshly-generated `crypto.randomBytes(32)` output trivially satisfies all of these (astronomically unlikely to collide with the hardcoded fallback strings) — no special-casing needed, just don't hardcode a fallback value anywhere in `install.ts` itself.

**`DEPLOYMENT_MODE` write:** `secrets.ts` `validateDeploymentModeValue()` (lines 92-103) requires the value to be exactly `'cloud'` or `'on-prem'` — the installer must write `DEPLOYMENT_MODE=on-prem` verbatim (no trailing whitespace/quotes).

---

### `install.ts` — `.env` file write

**No direct analog in repo.** Follow RESEARCH.md's provided code example verbatim (Code Examples section) — plain `fs.readFileSync`/`writeFileSync`, line-based `^KEY=` replace-or-append, no new dependency:
```typescript
import fs from 'fs';

function upsertEnvVars(envPath: string, values: Record<string, string>): void {
  let lines: string[] = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf-8').split('\n')
    : [];
  for (const [key, val] of Object.entries(values)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    const line = `${key}=${val}`;
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
  }
  fs.writeFileSync(envPath, lines.filter((l) => l.length > 0).join('\n') + '\n');
}
```
This directly resolves RESEARCH.md Pitfall #2 (duplicate-key `.env` collisions on re-run) — must replace-in-place, never blind-append.

---

### Script/package.json wiring

**Analog:** `apps/api/package.json` line 11 (`"migrate": "node dist/scripts/migrate.js"`) + root `package.json` line 20 (`"migrate": "npm run migrate --workspace @vectra/api"`)

Mirror exactly, new script name (`install:on-prem` per RESEARCH.md's recommendation):
```json
// apps/api/package.json
"install:on-prem": "node dist/scripts/install.js"

// root package.json
"install:on-prem": "npm run install:on-prem --workspace @vectra/api"
```

## Shared Patterns

### One-shot CLI script shape (main() + process.exit + sanitized error logging)
**Source:** `apps/api/src/scripts/migrate.ts` (full file)
**Apply to:** `install.ts`'s entire top-level structure
```typescript
async function main() {
  try {
    // steps...
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error(`FATAL: ... failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
main();
```

### Transactional step pattern (BEGIN/COMMIT/ROLLBACK/release)
**Source:** `apps/api/src/scripts/migrate.ts` lines 43-58
**Apply to:** schema-apply step, company+admin creation step (both must be transactional; the local-AI write can use a single `aiRepository.upsert()` call without a manual transaction since it's a single statement)

### Bcrypt password hashing (cost 10)
**Source:** `apps/api/src/controllers/authController.ts` lines 70-72; hash format also confirmed by `database/migrations/017_seed_admin_user.sql` line 2 comment
**Apply to:** admin password hashing in `createCompanyAndAdmin()`

### Boot-time secret/env validation contract (must be satisfied, not re-implemented)
**Source:** `apps/api/src/core/config/secrets.ts` lines 22-131; `apps/api/src/core/crypto/secretBox.ts` lines 23-29
**Apply to:** the exact shape/length of `JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE` values the installer writes to `.env` — these are read-only contracts to satisfy, not files to modify

### Axios + timeout + graceful degradation on external HTTP calls
**Source:** `apps/api/src/domains/ai/ai.service.ts` lines 95-176
**Apply to:** the Ollama `/api/tags` reachability probe (shorter timeout, non-blocking on failure per D-03, no `AppError` since there's no HTTP request context)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.env` upsert logic within `install.ts` | utility | file-I/O | No existing code in this repo reads/writes `.env` programmatically (all `.env` consumption is via `dotenv.config()` at boot, never written by app code) — RESEARCH.md's provided code example is the closest available reference |
| Interactive `readline` prompt helper within `install.ts` | utility | request-response (stdin) | No `readline` usage exists anywhere in the repo today (confirmed by RESEARCH.md) — this is genuinely new territory; use Node's built-in `readline/promises` API as shown in RESEARCH.md's Code Examples section, no new dependency |

## Metadata

**Analog search scope:** `apps/api/src/scripts/`, `apps/api/src/core/crypto/`, `apps/api/src/core/config/`, `apps/api/src/controllers/`, `apps/api/src/domains/ai/`, `database/` (init.sql, extensions.sql, migrations/005 + 017), `apps/api/package.json`, root `package.json`
**Files scanned:** 10 (migrate.ts, secretBox.ts, secrets.ts, authController.ts, ai.service.ts, ai.repository.ts, init.sql, extensions.sql, 005_ai_config.sql, 017_seed_admin_user.sql) + 2 package.json files
**Pattern extraction date:** 2026-07-12
