# Phase 17: Installer / First-Run Flow - Research

**Researched:** 2026-07-12
**Domain:** Node.js/TypeScript CLI ops tooling — secrets generation, one-time DB seeding, HTTP reachability probe, env-file writing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Local AI step validation (the only area discussed this session)
- **D-01:** The installer test-connects to the customer-provided Gemma/Ollama endpoint before writing it into `company_ai_config` — it does not blindly trust whatever URL is typed.
- **D-02:** The probe is basic reachability only (e.g. an HTTP GET against something like Ollama's `/api/tags` or a root ping) — confirms something is listening, not that a specific model is loaded or answering. A full completion round-trip was explicitly rejected as slower and more failure-prone (model-name typos, cold-start timeouts).
- **D-03:** If the probe fails (endpoint unreachable), the installer warns clearly but still writes the value and continues — it does not block. Rationale: the customer's Ollama box may not be up yet or networking may still be getting configured; a hard block could trap the installer mid-run for something that resolves itself minutes later.
- **D-04:** The entire local-AI step is skippable — the customer can decline it entirely during install and configure AI later from the existing Settings UI. This matches the spec's §5.4 framing as an "optional step"; `company_ai_config` already supports being unset, so no special-casing is needed for the skip path.

### Claude's Discretion
Every other gray area for this phase was explicitly left unselected by the user and is Claude's/researcher's/planner's call:
- **Interaction mode** — interactive prompts (readline) vs. scripted/flag-driven vs. both. Spec §5 allows either ("interactive (or scripted, non-interactive-with-flags for automated installs)").
- **Invocation mechanism & secrets handling** — how the installer is run (e.g. reusing the `migrate.ts`/`docker compose run --rm api node dist/scripts/install.js` pattern) and whether it writes directly to `.env` vs. prints values for the customer to paste in.
- **Re-run / idempotency behavior** — what happens if the installer runs against a DB that already has a company/admin (hard error vs. skip vs. confirm-to-reset).
- **The base-schema gap (found during scouting, not user-decided):** `apps/api/src/scripts/migrate.ts` only applies numbered files in `database/migrations/` (002+). The original base schema (`database/init.sql`, `database/extensions.sql` — companies/users/etc. tables) has never been migration `001`; dev compose still mounts it via `docker-entrypoint-initdb.d`, but `docker-compose.prod.yml` (Phase 16) dropped all initdb mounts. On a genuinely fresh production Postgres volume, running `npm run migrate` alone will fail. Confirmed and resolved with a concrete approach in this research's Summary/Common Pitfalls sections — the planner must resolve it, not a user preference call.

### Deferred Ideas (OUT OF SCOPE)
- Backend-side local AI provider dispatch (`aiService.complete()` actually calling the local endpoint) — Phase 18 (Backend-side Local AI Provider). This phase only writes the config row; it doesn't make the AI feature work end-to-end.
- `VERSION` file / `CHANGELOG.md` / documented upgrade procedure — Phase 19 (Release Versioning & Upgrade Docs).
- Reverse-proxy / inbound-connectivity documentation — Phase 20 (Deploy Hardening + Connectivity Doc).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| INS-01 | An installer/first-run flow generates `JWT_SECRET`+`ENCRYPTION_KEY`, creates one company + real admin, runs migrations, writes `DEPLOYMENT_MODE=on-prem` | Standard Stack (crypto/bcrypt/pg reuse), Architecture Patterns (Patterns 1-2, full sequence diagram), Common Pitfalls #1 (base-schema gap — the key blocker for the "runs migrations" clause), Security Domain |
| INS-02 | Installer can optionally write a reachable local Gemma/Ollama endpoint into `company_ai_config` (`provider:'local'`) | Architecture Patterns (Pattern 3 — probe design satisfying D-01/D-02), Don't Hand-Roll (probe scope), Common Pitfalls #4 (probe error messaging), Validation Architecture (test map) |
</phase_requirements>

## Summary

This phase is small, well-scoped orchestration glue, not new infrastructure. Every piece it needs already exists in the repo: `secretBox.ts` documents the exact secret-generation command, `apps/api/src/scripts/migrate.ts` (Phase 15) is the schema-apply step to invoke, `docker-compose.prod.yml` (Phase 16) already declares `JWT_SECRET`/`ENCRYPTION_KEY`/`DEPLOYMENT_MODE` as hard-required env vars with no fallback, and `database/init.sql` + `005_ai_config.sql` define the exact `companies`/`users`/`company_ai_config` columns to populate. The installer is best built as a single new script, `apps/api/src/scripts/install.ts`, following `migrate.ts`'s existing shape exactly (reuse `core/db` pool, plain `pg`+`fs`+Node built-ins, no new dependencies, `npm run install:on-prem`-style passthrough script at root).

The one real technical finding (already flagged in CONTEXT.md, confirmed here): **there is no migration `001` for the base schema.** `apps/api/src/scripts/migrate.ts` only reads `database/migrations/*.sql` (002+); `database/init.sql` (216 lines: extensions, enum types, `companies`/`users`/and ~13 other core tables) and `database/extensions.sql` are applied today only via Postgres's `docker-entrypoint-initdb.d` mount in **dev** compose — and `docker-compose.prod.yml` has zero such mounts (confirmed by reading the file directly). On a genuinely fresh production Postgres volume, `npm run migrate` alone will fail the first numbered migration that references `companies`/`users` (e.g. `005_ai_config.sql`'s `REFERENCES companies(id)`). The installer's schema-apply step (success criterion 3) cannot be satisfied by calling `npm run migrate` alone unless this gap is closed first. Two viable fixes are documented below under Common Pitfalls — the installer script itself should apply `init.sql`+`extensions.sql` (idempotently, via `CREATE TABLE IF NOT EXISTS`/`CREATE EXTENSION IF NOT EXISTS`, which they already use) before calling the migration runner, since that's the smallest change that doesn't touch Phase 15's already-shipped/tested runner.

The local-AI probe (D-01–D-04) is straightforward: Ollama's `/api/tags` (`GET {endpoint}/api/tags`) is the documented, no-auth, lightweight reachability check — confirms the daemon is listening without requiring a specific model to be loaded (matches D-02's "basic reachability only" framing exactly). `axios` is already a dependency and already used elsewhere in this codebase for exactly this shape of external HTTP call with a timeout (`ai.service.ts`).

**Primary recommendation:** Build one new script, `apps/api/src/scripts/install.ts`, invoked via `npm run install:on-prem` (root + `apps/api` passthrough, mirroring Phase 15's `migrate` wiring exactly). It generates secrets in-process, applies `init.sql`/`extensions.sql` idempotently then calls the same migration logic as `migrate.ts` (or shells out to it), creates company+admin via parameterized SQL reusing `bcrypt`, optionally probes+writes `company_ai_config`, and writes/updates `.env` with the generated values plus `DEPLOYMENT_MODE=on-prem`. Support both an interactive (readline) and flag-driven mode from day one — CI/scripted installs need the latter, and it costs little extra given the same underlying functions are called either way.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Secrets generation (JWT_SECRET/ENCRYPTION_KEY) | Ops/CLI script | — | Pure Node `crypto`, no DB/HTTP involved; runs before the API process even starts |
| Schema application | Ops/CLI script → Database | — | Calls migration runner logic against Postgres directly; API process must not be serving traffic yet |
| Company + admin creation | Ops/CLI script → Database | — | Direct parameterized SQL insert against `companies`/`users`, same shape as `authController.signup()`'s transaction but run once, out-of-band, not via the HTTP API |
| Local AI endpoint probe | Ops/CLI script → External (customer's Ollama box) | — | Outbound-only HTTP GET from the installer process (which itself often runs inside the `api` container/context), not a browser or server-runtime concern |
| `company_ai_config` write | Ops/CLI script → Database | API/Backend (ai.repository) | Installer writes the same row shape `aiRepository.upsert()` would produce — reuse the table/columns, not the repository class itself (no HTTP/company-auth context exists during install) |
| `.env` file write | Ops/CLI script → Filesystem | — | Local filesystem write on the host/container running the installer, consumed by compose/API boot afterward |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | 8.11.3 (already a dependency) [VERIFIED: package.json] | DB access for schema apply + company/admin insert | Same pool (`apps/api/src/core/db`) already used by `migrate.ts`; no new client needed |
| `bcrypt` | 6.0.0 (already a dependency) [VERIFIED: package.json] | Hash the admin password before insert | Same library `authController.signup()` uses (`saltRounds = 10`); consistency, no new hashing approach |
| `axios` | 1.6.2 (already a dependency) [VERIFIED: package.json] | HTTP GET probe against the customer's Ollama endpoint | Already used in `ai.service.ts` for external HTTP calls with `timeout` option; no new HTTP client needed |
| Node built-in `crypto` | Node 18+ runtime | `randomBytes(32).toString('hex')` for both secrets | The exact command `secretBox.ts`'s header comment documents — spec explicitly says reuse this, not invent a second method |
| Node built-in `readline` | Node 18+ runtime | Interactive prompts (company name, admin email/password, optional AI endpoint) | Zero new dependencies; no `readline` usage exists anywhere in the repo today, so this is a new pattern but does not require adding a package (`inquirer`/`prompts` are unnecessary for ~4 prompts) |
| Node built-in `fs` | Node 18+ runtime | Read/write `.env`, read `init.sql`/`extensions.sql`/migration files | Same module `migrate.ts` already uses |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | 16.3.1 (already a dependency) [VERIFIED: package.json] | Load existing `.env` before deciding what to append/overwrite | Same pattern as `core/db/index.ts`, `server.ts` — call `dotenv.config()` before reading `process.env` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node built-in `readline` | `inquirer` / `prompts` npm packages | Nicer UX (validation, masked password input) but a new dependency for a one-shot ops script the spec explicitly frames as "minimum viable" — not worth it unless the planner wants masked password entry, which built-in `readline` cannot do without extra hackery |
| Idempotent `init.sql` application from installer | Fold `init.sql`/`extensions.sql` into the migration runner as an implicit "migration 001" | Touches Phase 15's already-shipped/tested `migrate.ts`; riskier for a phase whose scope is "installer calls the runner," not "modify the runner" — see Common Pitfalls for full tradeoff discussion |

**Installation:** No new packages required — everything above is already in `apps/api/package.json`.

**Version verification:** All versions confirmed directly from `apps/api/package.json` (already-installed dependencies) — no registry lookup needed since nothing new is being added.

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** `pg`, `bcrypt`, `axios`, `dotenv` are pre-existing dependencies already used elsewhere in `apps/api`; Node built-ins (`crypto`, `readline`, `fs`) require no installation. The Package Legitimacy Gate is not applicable — skip `slopcheck`/registry verification since no `npm install` step is planned for this phase.

## Architecture Patterns

### System Architecture Diagram

```
Fresh checkout (customer/IT partner)
        │
        ▼
[apps/api/src/scripts/install.ts]  ◄── invoked via `npm run install:on-prem`
        │                              (mirrors `npm run migrate` wiring)
        │
        ├─ 1. Generate JWT_SECRET, ENCRYPTION_KEY
        │      (crypto.randomBytes(32).hex, in-process — no DB/HTTP)
        │
        ├─ 2. Apply base schema (init.sql + extensions.sql)
        │      idempotent CREATE TABLE/EXTENSION IF NOT EXISTS
        │      → Postgres (fresh volume, no prior state)
        │
        ├─ 3. Invoke migration runner logic (Phase 15's migrate.ts)
        │      reads database/migrations/*.sql, applies pending, records
        │      in schema_migrations
        │      → Postgres
        │
        ├─ 4. Prompt/flags: company name, admin email, admin password
        │      INSERT INTO companies (...) → companies.id
        │      INSERT INTO users (..., role='admin', company_id) → users.id
        │      (bcrypt hash password_hash, same as authController.signup())
        │      → Postgres
        │
        ├─ 5. [OPTIONAL] Prompt/flag: local Ollama endpoint URL
        │      GET {endpoint}/api/tags  (axios, short timeout)
        │        ├─ 200 OK  → proceed, write config
        │        └─ unreachable → print WARNING, still proceed (D-03: no block)
        │      INSERT/UPSERT company_ai_config
        │        (company_id, provider='local', local_endpoint, local_model)
        │      → Postgres
        │
        └─ 6. Write .env: JWT_SECRET, ENCRYPTION_KEY, DEPLOYMENT_MODE=on-prem
               (+ any other required vars already collected)
               → Filesystem (.env consumed by docker-compose.prod.yml next boot)
        │
        ▼
Operator runs: docker compose -f docker-compose.prod.yml up -d
        │
        ▼
API boots — DEPLOYMENT_MODE=on-prem read once (secrets.ts), registration closed,
schema already current, one company/one admin already exists.
```

### Recommended Project Structure
```
apps/api/src/scripts/
├── migrate.ts       # existing (Phase 15) — unchanged
└── install.ts        # new — this phase's entry point

database/
├── init.sql           # existing — read (not modified) by install.ts, applied idempotently
├── extensions.sql      # existing — same treatment
└── migrations/*.sql    # existing — applied via migrate.ts's logic (reused, not duplicated)
```

### Pattern 1: Reuse `migrate.ts`'s exact idioms rather than a new framework
**What:** `install.ts` should read like a sibling of `migrate.ts` — reuse `core/db`'s pool, plain `fs.readFileSync`/`readdirSync`, per-statement transactions, `process.exit(1)` on failure, no new abstraction layer.
**When to use:** Every step of this script.
**Example:**
```typescript
// Source: apps/api/src/scripts/migrate.ts (existing pattern in this repo)
import { db } from '../core/db';
import fs from 'fs';
import path from 'path';

async function applyBaseSchema() {
  const initSql = fs.readFileSync(path.join(__dirname, '../../../../database/init.sql'), 'utf-8');
  const extSql = fs.readFileSync(path.join(__dirname, '../../../../database/extensions.sql'), 'utf-8');
  // init.sql/extensions.sql already use CREATE TABLE/EXTENSION IF NOT EXISTS
  // and CREATE TYPE ... — note CREATE TYPE is NOT naturally idempotent in
  // Postgres (see Common Pitfalls) — this must be handled explicitly.
  await db.query(extSql);
  await db.query(initSql);
}
```

### Pattern 2: Company + admin creation mirrors `authController.signup()`'s shape, but simplified
**What:** One `companies` insert, one `users` insert with `role='admin'`, bcrypt-hashed password — same columns `signup()` already populates, run inside a single transaction, no email verification token needed (this is a trusted first-run operator action, not public self-service signup).
**When to use:** Step 4 of the flow.
**Example:**
```typescript
// Source: apps/api/src/controllers/authController.ts signup() (existing pattern, adapted)
import bcrypt from 'bcrypt';

async function createCompanyAndAdmin(companyName: string, email: string, password: string) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const companyResult = await client.query(
      `INSERT INTO companies (name, status) VALUES ($1, 'approved') RETURNING id`,
      [companyName],
    );
    const companyId = companyResult.rows[0].id;
    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, company_id, is_verified)
       VALUES ($1, $2, $3, $4, 'admin', $5, TRUE)`,
      [email, passwordHash, 'Admin', 'Admin', companyId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```
Note: `is_verified: TRUE` — the installer-created admin should not need email verification (no outbound email exists in this on-prem flow); this differs from `signup()`'s default `is_verified: FALSE`.

### Pattern 3: Reachability probe (D-01/D-02) — GET, short timeout, don't block on failure
**What:** A single `axios.get('${endpoint}/api/tags', { timeout: 3000 })` call. 2xx = reachable; anything else (including network error/timeout) = unreachable.
**When to use:** Step 5, only if the customer opts into the local-AI step.
**Example:**
```typescript
// Source: apps/api/src/domains/ai/ai.service.ts (existing axios+timeout pattern in this repo);
// endpoint shape confirmed against https://docs.ollama.com/api/tags
import axios from 'axios';

async function probeOllamaEndpoint(endpoint: string): Promise<boolean> {
  try {
    const res = await axios.get(`${endpoint.replace(/\/$/, '')}/api/tags`, { timeout: 3000 });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false; // D-03: warn, don't block — caller still writes the config
  }
}
```

### Anti-Patterns to Avoid
- **Calling `aiRepository.upsert()` directly from the installer:** That class assumes an HTTP request context is not required (it's a plain repository), so it's actually fine to call — but note it takes an `updatedBy: string | null` (a `users.id`), which the installer has right after creating the admin. Prefer calling the repository over hand-writing a duplicate SQL upsert, to avoid the column list drifting between two write paths.
- **Skipping the base-schema gap and just calling `npm run migrate`:** Will fail on a genuinely fresh production Postgres volume (see Summary/Common Pitfalls) — this is not optional to handle.
- **Auto-running the installer inside `server.ts`'s boot path:** Contradicts Phase 15's D-01 precedent (migration runner is a separate explicit step, not auto-run at boot) and the spec's "run once" framing. Keep it a standalone script invoked before `docker compose up -d`, exactly like the documented `run --rm api npm run migrate` step.
- **Blocking on the local-AI probe failure:** D-03 is explicit — warn and continue. Don't add a `--force` flag workaround for something that was already decided not to block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret generation | A custom random-string generator or shorter/weaker secret | `crypto.randomBytes(32).toString('hex')` exactly as `secretBox.ts` documents | Spec explicitly says reuse the documented command verbatim; `ENCRYPTION_KEY` must be exactly 64 hex chars or `getEncryptionKey()` (secretBox.ts) throws at first use |
| Password hashing | A different hashing library or lower cost factor | `bcrypt.hash(password, 10)` — same as `authController.signup()`/`017_seed_admin_user.sql` | Consistency with the existing login path (`bcrypt.compare` in `login()`); a mismatched hash format would break login for the installer-created admin |
| Ollama/local-model reachability check | A full chat-completion round-trip to "really" verify the model works | `GET {endpoint}/api/tags` | D-02 explicitly rejected a full completion round-trip as slower/more failure-prone; `/api/tags` is Ollama's documented no-auth model-listing endpoint, sufficient to confirm "something is listening" |
| `.env` merging | A full INI/dotenv parser library | Simple line-based read + replace-or-append logic (few known keys: `JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE`) | `.env` files here are simple `KEY=value` lines with comments; a full parser is overkill for ~3-5 keys the installer needs to set |

**Key insight:** Every primitive this phase needs (crypto, hashing, HTTP, transactions) already exists as a dependency and an established in-repo pattern. The only genuinely new code is orchestration — sequencing these calls in the right order and handling the base-schema gap.

## Common Pitfalls

### Pitfall 1: The base-schema gap (`init.sql`/`extensions.sql` never became migration 001)
**What goes wrong:** Running `npm run migrate` against a genuinely fresh production Postgres volume (no `docker-entrypoint-initdb.d` mounts, per Phase 16's `docker-compose.prod.yml`) fails on the first migration referencing `companies`/`users`/etc., because those tables were never created.
**Why it happens:** `database/init.sql` and `database/extensions.sql` predate the migration-file convention (`002_...` onward) and were only ever applied via Postgres's one-time `docker-entrypoint-initdb.d` init mechanism in **dev** compose. Phase 16 correctly dropped all initdb mounts from prod compose (per its own design, to make the migration runner the single source of truth) but this left no path for `init.sql`/`extensions.sql` to reach a genuinely fresh production database.
**How to avoid:** The installer must apply `init.sql` + `extensions.sql` itself, idempotently, before invoking the migration-runner logic. Two sub-considerations for the planner:
  1. **`CREATE TYPE` is NOT idempotent in Postgres** — unlike `CREATE TABLE IF NOT EXISTS`, there is no `CREATE TYPE IF NOT EXISTS`. `init.sql` defines 5 enum types (`user_role`, `subscription_status`, etc.) with bare `CREATE TYPE`. Re-running `init.sql` against a database where it already ran will error on the `CREATE TYPE` statements. The installer needs either: (a) a guard that only runs `init.sql`/`extensions.sql` when `companies` table doesn't yet exist (simplest — check `SELECT to_regclass('public.companies')`), or (b) wrap each `CREATE TYPE` in a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block. Option (a) is simpler and sufficient for a first-run-only script (the installer is documented as running once against a fresh DB, not repeatedly).
  2. **Re-run/idempotency of the whole installer** is explicitly left to Claude's Discretion in CONTEXT.md — this finding constrains that decision: whatever idempotency behavior is chosen for company/admin creation, the schema-apply step specifically should check `to_regclass('public.companies')` (or equivalent) rather than relying on `init.sql`'s own statements to no-op.
**Warning signs:** `npm run migrate` (or the installer's call into it) failing with `relation "companies" does not exist` on a fresh volume is the direct symptom this gap produces.

### Pitfall 2: `.env` file collisions on re-run
**What goes wrong:** If the installer blindly appends `JWT_SECRET=...`/`ENCRYPTION_KEY=...`/`DEPLOYMENT_MODE=...` to an existing `.env` without checking for prior keys, a second run produces duplicate keys — most `.env` loaders (including `dotenv`) take the **first** occurrence, so a re-run's freshly generated secrets would silently be ignored while the file looks like it updated.
**Why it happens:** Naive `fs.appendFileSync` usage.
**How to avoid:** Read the existing `.env` (if present), replace lines matching `^KEY=` in place, only append if the key doesn't exist yet. This ties into the "re-run behavior" decision left to Claude's Discretion — whatever is chosen (hard error / skip / confirm-to-reset) should be applied consistently to both the DB writes and the `.env` write, not just one.
**Warning signs:** `.env` containing two `JWT_SECRET=` lines after a second installer run.

### Pitfall 3: Writing plaintext passwords to logs or process arguments
**What goes wrong:** A scripted/flag-driven invocation (`--admin-password=...`) puts the password in shell history and `ps` output; console-logging the collected admin credentials for confirmation echoes a real password to the terminal/log file.
**Why it happens:** Convenience during interactive confirmation ("You entered: admin@x.com / hunter2 — confirm?").
**How to avoid:** For the interactive path, echo back email/company name only, never the password. For the flag-driven path, document (in the script's own `--help`) that operators should prefer an env var (`INSTALL_ADMIN_PASSWORD`) over a CLI flag, consistent with how `docker-compose.prod.yml` already treats all real secrets as env-injected, never baked into a command line.
**Warning signs:** Grep the installer's own console.log calls for anything touching the password variable.

### Pitfall 4: Local-AI probe treating DNS failure and HTTP 4xx/5xx the same as "unreachable" without distinguishing detail in the warning
**What goes wrong:** A generic "could not reach endpoint" message doesn't tell the customer whether the URL was malformed, the port is closed, or Ollama is up but returning an error — makes the "resolves itself in a few minutes" case (D-03's stated rationale) harder for the customer to self-diagnose.
**How to avoid:** Catch `axios`'s error shape distinctly — `err.code` (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`) vs. an HTTP error status — and print a slightly more specific warning (e.g., "connection refused — is Ollama running on that host/port?" vs. "endpoint returned 404 — check the URL path"). Not required by D-01–D-04 but meaningfully improves the "warn clearly" requirement in D-03.
**Warning signs:** N/A — this is a UX-quality recommendation, not a functional bug.

## Code Examples

### Reading `.env` and replacing/appending known keys (no new dependency)
```typescript
// Source: original pattern for this phase — no direct repo precedent, but
// follows the plain-fs style established by migrate.ts (no ini/dotenv-write library)
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

### Minimal readline prompt helper (interactive mode)
```typescript
// Source: Node.js built-in readline/promises — standard pattern, no repo precedent
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `docker-entrypoint-initdb.d` mount running `init.sql`/`extensions.sql`/numbered migrations once, on fresh dev volumes only | Explicit `npm run migrate` runner (Phase 15) + `docker-compose.prod.yml` dropping all initdb mounts (Phase 16) | Phase 15/16 (this milestone, 2026-07-12) | Production has no automatic schema bootstrap anymore — this phase (17) is what closes that gap for first-run |
| `017_seed_admin_user.sql` auto-seeding `admin@admin.com`/`admin` | Hard-excluded from the runner by filename (Phase 15, D-02); replaced by this phase's real admin-creation step for customer installs | Phase 14 (exclusion)/Phase 17 (replacement), this milestone | Customer-facing installs never get a known-credential admin account |

**Deprecated/outdated:** None — this is all net-new tooling in an actively developing milestone; no external library deprecations apply.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ollama's `GET /api/tags` is the correct, stable, no-auth reachability endpoint to probe | Architecture Patterns (Pattern 3), Don't Hand-Roll | If Ollama changes this path in a future version, the probe would report false negatives (endpoint marked unreachable when actually fine) — low risk since D-03 already makes probe failure non-blocking, but worth a quick live test against a real Ollama instance during implementation |
| A2 | `CREATE TYPE` guard via `to_regclass('public.companies')` is sufficient to make base-schema application idempotent for this installer's use case | Common Pitfalls (Pitfall 1) | If a future re-run scenario needs partial schema re-apply (e.g., `companies` exists but a later `init.sql` table was somehow dropped), this guard would skip re-creating it; acceptable for a "runs once against a fresh DB" installer, but the planner should confirm this matches whatever re-run/idempotency decision is made (left to Claude's Discretion in CONTEXT.md) |

**If this table is empty:** N/A — see above; both entries are LOW-risk given D-03's non-blocking design and the installer's documented "runs once against fresh DB" scope.

## Open Questions (RESOLVED)

1. **Should `install.ts` invoke `migrate.ts`'s logic via subprocess (`npm run migrate` as a child process) or by importing/calling shared functions in-process?**
   - What we know: `migrate.ts` currently has no exported functions — it's a `main()` IIFE-style script that calls `process.exit()` directly, which makes in-process import awkward (a shared `process.exit(1)` inside a library function would kill the installer itself, not just signal failure).
   - What's unclear: Whether the planner wants to refactor `migrate.ts` to export a reusable `runMigrations()` function (small overlap with Phase 15, already shipped) vs. spawning `node dist/scripts/migrate.js` as a subprocess from `install.ts` and checking its exit code (zero repo-code overlap, but adds a Node subprocess dependency — `child_process.execFileSync` is a built-in, no new package).
   - Recommendation: Subprocess invocation (`child_process.execFileSync('node', ['dist/scripts/migrate.js'])`) is simpler and touches zero already-shipped Phase 15 code — this is likely the safer default given Phase 15 is already complete and tested. Flag for the planner to confirm, since it affects task sequencing (installer's `package.json` script may need `&& npm run build` first, since `migrate` only has a compiled `dist/scripts/migrate.js` entry, no ts-node dev variant).
   - **RESOLVED:** `17-01-PLAN.md` Task 2 adopts subprocess invocation — `runMigrations()` calls `child_process.execFileSync('node', [path.join(__dirname, '../../../../apps/api/dist/scripts/migrate.js')], { stdio: 'inherit' })`, propagating non-zero exit as a thrown error rather than importing/calling `migrate.ts` in-process.

2. **Interaction mode: interactive-only, flag-only, or both from day one?**
   - What we know: CONTEXT.md leaves this to Claude's Discretion; spec (§5.2) allows either.
   - What's unclear: Whether supporting both adds meaningful scope for a "minimum viable installer."
   - Recommendation: Support both from the start — the underlying functions (`createCompanyAndAdmin`, `probeOllamaEndpoint`, `upsertEnvVars`) are interaction-mode-agnostic; the only branch is how values are collected (readline prompts vs. `process.argv`/env-var flags). This is a small amount of extra surface for meaningfully better automated-install support, and CI/scripted on-prem installs are a realistic customer scenario per the spec's own framing ("interactive (or scripted, non-interactive-with-flags for automated installs)").
   - **RESOLVED:** `17-01-PLAN.md` Task 2's `main()` supports both — flags/env vars (`--company-name`/`INSTALL_COMPANY_NAME`, `--admin-email`/`INSTALL_ADMIN_EMAIL`, `INSTALL_ADMIN_PASSWORD`, `--non-interactive`) with a `readline/promises` prompt fallback for any value not supplied.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Schema apply, company/admin insert | N/A (target is customer's fresh Postgres, not this dev machine) | 15-alpine (per `docker-compose.prod.yml`) | — |
| `pg`, `bcrypt`, `axios`, `dotenv` (npm) | Installer script | ✓ | Already in `apps/api/package.json` | — |
| Node.js 18+ | Runtime for the installer script | ✓ (project baseline) | — | — |
| Customer's Ollama/Gemma endpoint | Optional local-AI step only | Unknown (customer environment, not verifiable at research time) | — | Skippable per D-04; probe failure is non-blocking per D-03 |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Customer's local Ollama endpoint — entire step is optional (D-04) and non-blocking on probe failure (D-03).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node --test` (via `ts-node/register`), matching `apps/api/package.json`'s existing `"test": "node --require ts-node/register --test src/**/*.test.ts"` |
| Config file | none — convention-based (`*.test.ts` colocated with source) |
| Quick run command | `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` (once created) |
| Full suite command | `npm test --workspace @vectra/api` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INS-01 | Generated secrets are non-repo, non-prior-install values (unit-testable: pure `crypto.randomBytes` call produces 64-hex-char unique output on each call) | unit | `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` | ❌ Wave 0 |
| INS-01 | Company + admin creation produces exactly one row each, bcrypt-hashed password, not `admin@admin.com` | integration (requires live Postgres) | manual/live-DB smoke test — same limitation noted in STATE.md for migrations 023/024 (no live DB in this execution environment) | ❌ Wave 0 |
| INS-01 | Schema-apply step succeeds against a genuinely empty database (no prior `init.sql` run) | integration (requires live Postgres) | manual/live-DB smoke test — this is the single most important test for this phase given the base-schema gap finding above | ❌ Wave 0 |
| INS-02 | Probe against reachable endpoint returns true; against unreachable endpoint returns false without throwing | unit (mockable via axios interceptor or a local test HTTP server) | `node --require ts-node/register --test apps/api/src/scripts/install.test.ts` | ❌ Wave 0 |
| INS-02 | Probe failure still writes `company_ai_config` with a warning (D-03) | unit + integration | same as above (unit for logic, integration for the actual DB write) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --require ts-node/register --test apps/api/src/scripts/install.test.ts`
- **Per wave merge:** `npm test --workspace @vectra/api`
- **Phase gate:** Full suite green before `/gsd:verify-work`; additionally, a real live-DB dry-run of the installer against a fresh Postgres container is strongly recommended before considering this phase done, given the same class of gap (migrations 023/024 only manually inspected, never run twice against a live DB) is flagged as a standing risk in STATE.md.

### Wave 0 Gaps
- [ ] `apps/api/src/scripts/install.test.ts` — covers INS-01 (secret generation, schema-apply guard logic) and INS-02 (probe logic) as pure/mockable unit tests
- [ ] A live Postgres smoke-test script or documented manual procedure for the schema-apply + company/admin creation path (integration-level; the existing `node --test` harness has no live-DB fixture pattern to reuse — this would be new test infrastructure, likely out of scope to fully automate this phase, but should be run manually per the Phase gate note above)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | `bcrypt` password hashing (cost 10, matching existing `authController.signup()`/`login()`) for the installer-created admin account; no new auth mechanism introduced |
| V3 Session Management | no | Installer doesn't issue sessions/tokens — it only creates the DB row; the admin logs in normally afterward via the existing `login()` JWT flow |
| V4 Access Control | no | Installer runs with full DB access by design (it's an ops tool, not a user-facing endpoint) — no new access-control surface |
| V5 Input Validation | yes | Company name/email/password inputs (interactive or flag-driven) should be validated minimally (non-empty, email shape, password length ≥ 8 chars — matching `resetPassword()`'s existing `newPassword.length < 8` check) before insert |
| V6 Cryptography | yes | `crypto.randomBytes(32)` for both secrets (CSPRNG, matching `secretBox.ts`'s documented method exactly) — never a weaker RNG or a shorter key |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Weak/predictable secrets shipped to production | Spoofing / Information Disclosure | `crypto.randomBytes(32)` CSPRNG generation (never a fallback/default value) — this is the entire point of INS-01/success criterion 1 |
| Default/known admin credentials | Spoofing | Real customer-provided email/password only, bcrypt-hashed; `017_seed_admin_user.sql` already hard-excluded from the runner (Phase 15) as defense-in-depth |
| Plaintext secrets in shell history/process list/logs | Information Disclosure | Prefer env-var input over CLI flags for the admin password in scripted mode (see Common Pitfalls #3); never `console.log` the raw password |
| SQL injection via company name / admin email | Tampering | Parameterized queries throughout (`$1, $2, ...`), matching every existing query in this codebase — no string concatenation into SQL |

## Sources

### Primary (HIGH confidence)
- `apps/api/src/scripts/migrate.ts` (this repo, Phase 15) — migration runner shape/pattern to reuse
- `apps/api/src/core/crypto/secretBox.ts` (this repo) — documented secret-generation command
- `apps/api/src/core/config/secrets.ts` (this repo, Phase 14/16) — `DEPLOYMENT_MODE`/`JWT_SECRET`/`ENCRYPTION_KEY` validation logic the installer's output must satisfy
- `apps/api/src/controllers/authController.ts` (this repo) — existing company/user creation transaction pattern
- `database/init.sql`, `database/extensions.sql`, `database/migrations/005_ai_config.sql`, `database/migrations/017_seed_admin_user.sql` (this repo) — exact schema/columns to populate
- `docker-compose.prod.yml` (this repo, Phase 16) — confirms zero `docker-entrypoint-initdb.d` mounts in production, confirming the base-schema gap
- `docs/specs/deployment/on-premise-deployment.md` §5 (this repo) — authoritative installer design spec
- https://docs.ollama.com/api/tags — official Ollama API docs confirming `/api/tags` as the model-listing/reachability endpoint

### Secondary (MEDIUM confidence)
- WebSearch cross-reference on Ollama `/api/tags` usage patterns (multiple community sources agree with official docs on endpoint shape/behavior)

### Tertiary (LOW confidence)
- None — every finding in this research was either read directly from repo source or confirmed against Ollama's official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already an installed, in-use dependency in this exact codebase; no version-lookup uncertainty
- Architecture: HIGH — directly derived from reading `migrate.ts`, `authController.ts`, `secretBox.ts`, `secrets.ts`, and the actual `docker-compose.prod.yml`/`init.sql` files in this repo
- Pitfalls: HIGH for the base-schema gap (confirmed by direct file inspection of both `migrate.ts`'s file filter and `docker-compose.prod.yml`'s absence of initdb mounts); MEDIUM for the `CREATE TYPE` non-idempotency claim (general PostgreSQL behavior, not this-repo-specific, but well-established)

**Research date:** 2026-07-12
**Valid until:** 30 days (stable internal codebase; only external-facing risk is Ollama API stability, low churn)
