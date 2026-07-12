import { db } from '../core/db';
import fs from 'fs';
import path from 'path';

// From apps/api/src/scripts/ up to repo root, then into database/migrations.
// Same depth under apps/api for both dist/scripts/migrate.js (prod) and
// src/scripts/migrate.ts (ts-node dev).
const MIGRATIONS_DIR = path.join(__dirname, '../../../../database/migrations');

// 017_seed_admin_user.sql must never run outside dev seeding — D-02. Hard-excluded
// by filename unconditionally, independent of DEPLOYMENT_MODE (defense-in-depth).
const EXCLUDED_FILES = new Set(['017_seed_admin_user.sql']);

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Strict filename regex (not a bare .sql suffix check) — T-15-01 mitigation:
    // any non-conforming or path-traversal-shaped entry is silently skipped.
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_[\w-]+\.sql$/.test(f) && !EXCLUDED_FILES.has(f))
      .sort();

    const { rows } = await db.query('SELECT filename FROM schema_migrations');
    const applied = new Set<string>(rows.map((r: { filename: string }) => r.filename));

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('No pending migrations.');
    } else {
      let current = '';
      try {
        for (const filename of pending) {
          current = filename;
          const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
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
        }
      } catch (err) {
        // Log only .message — never the raw pg error object, which can embed
        // connection-string/query details (T-15-04 mitigation).
        console.error(`FATAL: migration ${current} failed: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    console.log('Migrations complete.');
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error(`FATAL: migration setup failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
