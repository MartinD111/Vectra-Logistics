# Phase 15: Migration Runner - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 4 (1 new, 3 modified)
**Analogs found:** 3 / 4 (no prior CLI-script directory exists — closest analogs are boot-time modules and the migrations themselves)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/api/src/scripts/migrate.ts` | script/CLI (batch DB runner) | batch / transform (read files → apply SQL → record state) | `apps/api/src/server.ts` (`bootstrap()`) + `apps/api/src/core/config/secrets.ts` (fail-fast/exit pattern) | role-match (no true CLI-script precedent; composed from two boot-time analogs) |
| `apps/api/src/core/db/index.ts` | config/singleton (DB pool) | N/A (reused as-is, not modified) | itself — reuse directly | exact (this *is* the dependency to import, not to pattern-match) |
| `apps/api/package.json` | config | N/A | itself (existing `scripts` block) | exact |
| `package.json` (root) | config | N/A | itself (existing passthrough `dev:*`/`build:*` scripts) | exact |
| `database/migrations/NNN_*.sql` | migration (read-only input to the runner) | batch | `database/migrations/017_seed_admin_user.sql`, `024_kpi_target_client.sql` | exact (runner must parse/respect this exact convention, not author new migrations) |

## Pattern Assignments

### `apps/api/src/scripts/migrate.ts` (script, batch)

**No direct analog exists** — there is no prior `apps/api/src/scripts/` directory or CLI-runner file in this codebase. Compose the pattern from two real analogs that between them cover every piece the spec asks for (~50-line script, `pg` + `fs` only, per-file transaction, fail-fast exit):

**Analog 1 — `apps/api/src/core/db/index.ts`** (the Pool to reuse, import verbatim, do not re-instantiate):
```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

export { db };
```
→ `migrate.ts` should `import { db } from '../core/db';` — no second `dotenv.config()` or second `Pool` needed; importing the module runs its top-level `dotenv.config()` once.

**Analog 2 — `apps/api/src/server.ts` `bootstrap()`** (lines 72-102): async top-level function pattern, try/catch wrapping I/O, `console.log`/`console.error` logging with descriptive prefixes, `process.exit(1)` on failure, invoked once at bottom of file (`bootstrap();`):
```typescript
async function bootstrap() {
  try {
    // Fail fast on missing/default secrets before any DB/Redis I/O (SEC-01/SEC-02)
    validateSecretsOrExit();
    ...
    await db.query("SELECT 1");
    console.log("PostgreSQL connected");
    ...
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}
...
bootstrap();
```
→ Copy this shape for `migrate.ts`'s `main()`: top-level `async function main() { ... } main();`, `console.log` per applied file, `console.error` + `process.exit(1)` on any migration failure (per D-04, "log which file failed, exit non-zero immediately — no later files attempted").

**Analog 3 — `apps/api/src/core/config/secrets.ts`** (fail-fast helper style, lines 46-50): small named `fail()`-style helper for a fatal, boot-time error with a clear operator-facing message before exiting:
```typescript
/** Boot-time fatal error: print a clear message and exit before any DB/Redis I/O. */
function fail(varName: string, reason: string): never {
  console.error(`FATAL: invalid ${varName} — ${reason}. Set a real, non-default value before starting the server.`);
  process.exit(1);
}
```
→ Mirror this for the per-migration failure message, e.g. `console.error(\`FATAL: migration ${filename} failed: ${err.message}\`); process.exit(1);` — same "prefix with FATAL, name the exact file, then exit" shape.

**Transaction pattern (no existing analog in this codebase — this project has no prior manual-transaction code)**: use `pg`'s standard client-checkout pattern since `db` is a `Pool`, not a single client:
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
} catch (err) {
  await client.query('ROLLBACK');
  throw err; // let main()'s catch log + exit(1), per D-04
} finally {
  client.release();
}
```

**File discovery + exclusion (D-02) — no existing analog; straightforward `fs` + `path`**:
```typescript
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../../database/migrations');
const EXCLUDED_FILES = new Set(['017_seed_admin_user.sql']); // never runs outside dev seeding — see D-02

const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && !EXCLUDED_FILES.has(f))
  .sort(); // numeric-prefix filenames sort correctly as strings (002_ < 010_ < 024_)
```

**`schema_migrations` bootstrap DDL** — follow the exact idempotent header/style convention from `database/migrations/*.sql` (see below) even though this DDL lives inside `migrate.ts`, not a new migration file (per spec §6.1, the tracking table is created by the runner itself, not by a numbered migration):
```typescript
await db.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);
```

---

### `apps/api/src/core/db/index.ts` (reused, not modified)

No changes needed. `migrate.ts` imports `{ db }` from this module directly — see Analog 1 above. Do not duplicate the `Pool`/`dotenv.config()` setup.

---

### `apps/api/package.json` (config)

**Analog:** itself, existing `scripts` block (lines 6-11):
```json
"scripts": {
  "start": "node dist/server.js",
  "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
  "build": "tsc",
  "test": "node --require ts-node/register --test src/**/*.test.ts"
}
```
Follow the existing `start` (compiled, prod) vs `dev`/`test` (ts-node, dev) split. Per D-05, add a `migrate` script whose prod path points at `dist/scripts/migrate.js` (built by the existing `build: tsc` step, no new build config needed since `tsc` already compiles all of `src/`) and whose dev path uses `ts-node` directly (matching the `test` script's `ts-node/register` style, not `ts-node-dev --respawn` since this is a one-shot run, not a watch process):
```json
"migrate": "node dist/scripts/migrate.js"
```
(If a dev-mode/ts-node variant is wanted per D-05's "ts-node in dev" note, mirror the `test` script's invocation style: `node --require ts-node/register src/scripts/migrate.ts` — planner's call on whether to split into two scripts or rely on `dist/` always being present.)

---

### `package.json` (root, config)

**Analog:** itself, existing passthrough scripts (lines 10-19):
```json
"scripts": {
  "dev:workspaces": "npm run dev --workspace @vectra/workspaces",
  "dev:marketplace": "npm run dev --workspace @vectra/marketplace",
  "dev:cmr": "npm run dev --workspace @vectra/cmr",
  "dev:api": "npm run dev --workspace @vectra/api",
  "build": "npm run build --workspaces --if-present",
  "build:workspaces": "npm run build --workspace @vectra/workspaces",
  "build:marketplace": "npm run build --workspace @vectra/marketplace",
  "build:cmr": "npm run build --workspace @vectra/cmr",
  "build:api": "npm run build --workspace @vectra/api"
}
```
Follow the exact `npm run <cmd> --workspace @vectra/api` passthrough shape already used by `dev:api`/`build:api`. Per D-05, add (unprefixed, since it's the only migrate script and matches how compose invokes it):
```json
"migrate": "npm run migrate --workspace @vectra/api"
```

---

### `database/migrations/*.sql` (read-only input — convention reference, not a file to author this phase)

**Analog:** `database/migrations/024_kpi_target_client.sql` (full file) and `database/migrations/017_seed_admin_user.sql` (full file) — both read in full above.

Header comment convention (from 024, lines 1-4):
```sql
-- Migration: kpi_rules gains target_client_id so a rule can target a single
-- client (client-subject evaluators, e.g. credit_risk) the same way
-- target_project_id/target_user_id already target a project or user.
-- Apply after 023. Idempotent.
```
`017_seed_admin_user.sql` (lines 1-2) deliberately breaks the "Apply after N" numbering convention and has no such line — this is exactly why D-02 requires the runner to hard-exclude it by filename rather than relying on convention/ordering to skip it:
```sql
-- Seed a default admin/admin login for local/dev use.
-- Password hash below is bcrypt('admin', 10 rounds).
```
The runner does not need to parse or validate these headers — just glob `*.sql`, numeric-sort, skip `017_seed_admin_user.sql`, and apply the rest. No migration files are created or modified by this phase.

## Shared Patterns

### Fail-fast / exit-on-error
**Source:** `apps/api/src/core/config/secrets.ts` (`fail()` helper, lines 46-50) and `apps/api/src/server.ts` (`bootstrap()` catch block, lines 96-99)
**Apply to:** `migrate.ts`'s top-level error handling and per-migration transaction failure (D-04)
```typescript
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}
```

### Pool reuse (no duplicate connections)
**Source:** `apps/api/src/core/db/index.ts`
**Apply to:** `migrate.ts` — `import { db } from '../core/db';`, never construct a second `Pool` or call `dotenv.config()` again.

### Idempotent SQL / numbered-file convention
**Source:** `database/migrations/017_seed_admin_user.sql`, `database/migrations/024_kpi_target_client.sql`
**Apply to:** The `schema_migrations` bootstrap DDL inside `migrate.ts` (use `CREATE TABLE IF NOT EXISTS`) and the runner's file-discovery logic (numeric-prefix sort = apply order, per D-05/code_context notes — no separate dependency graph needed).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/scripts/migrate.ts` (transaction-per-file logic, `fs.readdirSync` file discovery) | script | batch | No prior CLI/script directory or manual-transaction code exists anywhere in `apps/api/src`; this phase establishes the first instance of both. Composed instead from `server.ts` bootstrap shape + `secrets.ts` fail-fast shape + standard `pg` client-checkout idiom (documented above). |

## Metadata

**Analog search scope:** `apps/api/src/` (scripts/, core/db/, core/config/, server.ts), `database/migrations/*.sql`, `apps/api/package.json`, root `package.json`
**Files scanned:** `apps/api/src/core/db/index.ts`, `apps/api/src/server.ts`, `apps/api/src/core/config/secrets.ts`, `apps/api/package.json`, root `package.json`, `database/migrations/017_seed_admin_user.sql`, `database/migrations/024_kpi_target_client.sql`, glob of `database/migrations/*.sql` (23 files, confirms no `001_` file and numeric-only ordering), glob of `apps/api/src/scripts/**` (empty — confirmed no prior scripts directory)
**Pattern extraction date:** 2026-07-12
