import { db } from '../core/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { execFileSync } from 'child_process';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import type { PoolClient } from 'pg';
import { aiRepository } from '../domains/ai/ai.repository';

// From apps/api/src/scripts/ up to repo root, then back into apps/api/dist or
// database/. Same depth under apps/api for both dist/scripts/install.js
// (prod) and src/scripts/install.ts (ts-node dev).
const REPO_ROOT = path.join(__dirname, '../../../../');
const INIT_SQL_PATH = path.join(REPO_ROOT, 'database/init.sql');
const EXTENSIONS_SQL_PATH = path.join(REPO_ROOT, 'database/extensions.sql');
const MIGRATE_SCRIPT_PATH = path.join(REPO_ROOT, 'apps/api/dist/scripts/migrate.js');
const ENV_PATH = path.join(REPO_ROOT, '.env');

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ── Secrets generation (T-17-01) ──────────────────────────────────────────
// Two independent CSPRNG calls — never a fallback/placeholder value. Matches
// secretBox.ts's documented generation command (32 random bytes, hex-encoded).
export function generateSecrets(): { jwtSecret: string; encryptionKey: string } {
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  return { jwtSecret, encryptionKey };
}

// ── Input validators (V5) ──────────────────────────────────────────────────

export function validateAdminEmail(value: string): ValidationResult {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: false, reason: 'Admin email must be a valid email address' };
  }
  return { valid: true };
}

export function validateAdminPassword(value: string): ValidationResult {
  // Mirrors resetPassword()'s existing newPassword.length < 8 check in authController.ts.
  if (!value || value.length < 8) {
    return { valid: false, reason: 'Admin password must be at least 8 characters' };
  }
  return { valid: true };
}

export function validateCompanyName(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, reason: 'Company name must not be empty' };
  }
  return { valid: true };
}

// ── .env upsert (Pitfall #2 — replace in place, never blind-append) ───────

export function upsertEnvVars(envPath: string, values: Record<string, string>): void {
  const lines: string[] = fs.existsSync(envPath)
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

// ── Base schema bootstrap (T-17-05 — closes the init.sql/extensions.sql gap) ──
// CREATE TYPE is NOT idempotent in Postgres, so this guard is mandatory, not
// optional: init.sql must never be re-applied against an already-initialized DB.
export async function applyBaseSchema(client: PoolClient): Promise<void> {
  const { rows } = await client.query(`SELECT to_regclass('public.companies') AS exists`);
  if (rows[0].exists) {
    console.log('Base schema already applied — skipping init.sql/extensions.sql.');
    return;
  }
  // init.sql first — it self-contains CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
  // and creates the base tables; extensions.sql depends on init.sql per its own
  // header and ALTER TABLEs tables init.sql creates.
  const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf-8');
  const extSql = fs.readFileSync(EXTENSIONS_SQL_PATH, 'utf-8');
  await client.query(initSql);
  await client.query(extSql);
  console.log('Base schema applied (init.sql + extensions.sql).');
}

// ── Migration runner invocation (subprocess — never in-process, per RESEARCH
// Open Question 1: migrate.ts calls process.exit() itself which would kill
// the installer process if imported in-process) ────────────────────────────
export function runMigrations(): void {
  execFileSync('node', [MIGRATE_SCRIPT_PATH], { stdio: 'inherit' });
}

// ── Company + admin creation (T-17-02/T-17-04) ─────────────────────────────
export async function createCompanyAndAdmin(
  client: PoolClient,
  input: { companyName: string; email: string; password: string },
): Promise<{ companyId: string; adminUserId: string }> {
  try {
    await client.query('BEGIN');
    const companyResult = await client.query(
      `INSERT INTO companies (name, status) VALUES ($1, 'approved') RETURNING id`,
      [input.companyName],
    );
    const companyId = companyResult.rows[0].id;

    const passwordHash = await bcrypt.hash(input.password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, company_id, is_verified)
       VALUES ($1, $2, 'Admin', 'Admin', 'admin', $3, TRUE) RETURNING id`,
      [input.email, passwordHash, companyId],
    );
    const adminUserId = userResult.rows[0].id;

    await client.query('COMMIT');
    return { companyId, adminUserId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Interactive prompt helper (no readline usage exists elsewhere in this repo) ──
export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

// ── Optional local-AI reachability probe (INS-02, D-01/D-02/D-03) ─────────
// Basic reachability only (D-02) — a GET against Ollama's /api/tags endpoint,
// not a full completion round-trip. Never blocks (D-03): failures are
// reported by the caller as a warning, the write to company_ai_config still
// happens regardless of probe outcome.

export function buildTagsUrl(endpoint: string): string {
  return `${endpoint.replace(/\/$/, '')}/api/tags`;
}

export async function probeOllamaEndpoint(endpoint: string): Promise<boolean> {
  try {
    const res = await axios.get(buildTagsUrl(endpoint), { timeout: 3000 });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

/**
 * Same reachability check as probeOllamaEndpoint(), but re-throws the raw
 * error instead of swallowing it, so callers (main()'s optional step) can
 * feed the real error shape into describeProbeError() rather than a
 * re-synthesized one.
 */
async function fetchOllamaTags(endpoint: string): Promise<void> {
  await axios.get(buildTagsUrl(endpoint), { timeout: 3000 });
}

/**
 * Describe a probe failure with an actionable, specific message. Adapts
 * ai.service.ts's providerError() discrimination shape (err.code vs axios
 * response.status) -- no AppError/HTTP request context here, this is a CLI
 * script, so it returns a plain string instead of throwing.
 */
export function describeProbeError(err: unknown): string {
  const e = err as { code?: string; isAxiosError?: boolean; response?: { status?: number } };
  if (e?.code === 'ECONNREFUSED') {
    return 'Connection refused -- is Ollama running on that host/port?';
  }
  if (e?.code === 'ETIMEDOUT') {
    return 'Connection timed out -- the endpoint did not respond within 3 seconds.';
  }
  if (e?.code === 'ENOTFOUND') {
    return 'Could not resolve host -- check the hostname in the endpoint URL.';
  }
  if (e?.response?.status !== undefined) {
    return `Endpoint responded with HTTP ${e.response.status} -- check the URL path.`;
  }
  return 'Endpoint unreachable -- check the URL and that Ollama is running.';
}

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  try {
    const nonInteractive = hasFlag('non-interactive');

    let companyName = parseFlag('company-name') ?? process.env.INSTALL_COMPANY_NAME ?? '';
    let adminEmail = parseFlag('admin-email') ?? process.env.INSTALL_ADMIN_EMAIL ?? '';
    // Password accepted only via env var — never a CLI flag (T-17-03: avoids
    // shell history / `ps` exposure).
    let adminPassword = process.env.INSTALL_ADMIN_PASSWORD ?? '';

    if (!companyName || !adminEmail || !adminPassword) {
      if (nonInteractive) {
        console.error(
          'FATAL: --non-interactive requires --company-name, --admin-email, and INSTALL_ADMIN_PASSWORD (env var) to all be set.',
        );
        process.exit(1);
      }
      if (!companyName) companyName = await prompt('Company name: ');
      if (!adminEmail) adminEmail = await prompt('Admin email: ');
      if (!adminPassword) adminPassword = await prompt('Admin password: ');
    }

    const companyCheck = validateCompanyName(companyName);
    if (!companyCheck.valid) {
      console.error(`FATAL: ${companyCheck.reason}`);
      process.exit(1);
    }
    const emailCheck = validateAdminEmail(adminEmail);
    if (!emailCheck.valid) {
      console.error(`FATAL: ${emailCheck.reason}`);
      process.exit(1);
    }
    const passwordCheck = validateAdminPassword(adminPassword);
    if (!passwordCheck.valid) {
      console.error(`FATAL: ${passwordCheck.reason}`);
      process.exit(1);
    }

    const { jwtSecret, encryptionKey } = generateSecrets();

    const schemaClient = await db.connect();
    try {
      await applyBaseSchema(schemaClient);
    } finally {
      schemaClient.release();
    }

    runMigrations();

    const adminClient = await db.connect();
    const { companyId, adminUserId } = await createCompanyAndAdmin(adminClient, {
      companyName,
      email: adminEmail,
      password: adminPassword,
    });

    upsertEnvVars(ENV_PATH, {
      JWT_SECRET: jwtSecret,
      ENCRYPTION_KEY: encryptionKey,
      DEPLOYMENT_MODE: 'on-prem',
    });

    // ── Step 6: optional local Gemma/Ollama wiring (INS-02, D-01..D-04) ────
    // Entirely skippable (D-04): a blank prompt answer / unset flags leave
    // company_ai_config untouched. When an endpoint is provided, it is
    // probed for basic reachability (D-01/D-02) and a specific warning is
    // printed on failure, but the value is written regardless (D-03).
    let localAiEndpoint = parseFlag('local-ai-endpoint') ?? process.env.INSTALL_LOCAL_AI_ENDPOINT ?? '';
    let localAiModel = parseFlag('local-ai-model') ?? process.env.INSTALL_LOCAL_AI_MODEL ?? '';

    if (!localAiEndpoint && !nonInteractive) {
      localAiEndpoint = await prompt('Local Ollama/Gemma endpoint URL (leave blank to skip): ');
    }

    if (localAiEndpoint) {
      if (!localAiModel) localAiModel = 'gemma';

      try {
        await fetchOllamaTags(localAiEndpoint);
      } catch (probeErr) {
        console.warn(`WARNING: local AI endpoint check failed: ${describeProbeError(probeErr)}`);
        console.warn('Continuing anyway -- you can fix the endpoint later in Settings.');
      }

      // provider: 'local' -- no cloud key is ever stored for this path (api_key_enc passed null)
      await aiRepository.upsert(companyId, 'local', localAiModel, null, localAiEndpoint, localAiModel, adminUserId);
      console.log(`Local AI endpoint configured: ${localAiEndpoint} (model: ${localAiModel})`);
    }

    console.log('');
    console.log('Install complete.');
    console.log(`  Company: ${companyName} (${companyId})`);
    console.log(`  Admin email: ${adminEmail}`);
    console.log('');
    console.log('Next step: docker compose -f docker-compose.prod.yml up -d');

    await db.end();
    process.exit(0);
  } catch (err) {
    // Log only .message — never the raw error object (T-17-03 mitigation).
    console.error(`FATAL: install failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
