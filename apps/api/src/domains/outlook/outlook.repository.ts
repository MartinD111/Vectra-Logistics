import { db } from '../../core/db';
import { encryptSecret, decryptSecret } from '../../core/crypto/secretBox';
import { OutlookCredentials } from './outlook.types';

const PROVIDER = 'outlook';

interface ConnectionRow {
  status: string;
  credentials_json: string;
  connected_at: Date | null;
  last_sync_at: Date | null;
}

class OutlookRepository {
  async find(companyId: string): Promise<{ status: string; creds: OutlookCredentials; connected_at: Date | null; last_sync_at: Date | null } | null> {
    const { rows } = await db.query<ConnectionRow>(
      `SELECT status, credentials_json, connected_at, last_sync_at
       FROM integration_credentials WHERE company_id = $1 AND provider_id = $2`,
      [companyId, PROVIDER],
    );
    if (rows.length === 0) return null;
    let creds: OutlookCredentials = { demo: false, email: null };
    try { creds = JSON.parse(decryptSecret(rows[0].credentials_json)); } catch { /* keep default */ }
    return { status: rows[0].status, creds, connected_at: rows[0].connected_at, last_sync_at: rows[0].last_sync_at };
  }

  async listConnectedMailboxes(): Promise<{ company_id: string; credentials_json: string; last_sync_at: Date | null }[]> {
    const { rows } = await db.query<{ company_id: string; credentials_json: string; last_sync_at: Date | null }>(
      `SELECT company_id, credentials_json, last_sync_at
       FROM integration_credentials WHERE provider_id = $1 AND status = 'connected'`,
      [PROVIDER],
    );
    return rows;
  }

  async updateLastSyncAt(companyId: string, at: Date): Promise<void> {
    await db.query(
      `UPDATE integration_credentials SET last_sync_at = $1, updated_at = NOW()
       WHERE company_id = $2 AND provider_id = $3`,
      [at, companyId, PROVIDER],
    );
  }

  async upsert(companyId: string, creds: OutlookCredentials): Promise<void> {
    // Tokens are encrypted at rest (AES-256-GCM) — see core/crypto/secretBox.
    await db.query(
      `INSERT INTO integration_credentials
         (company_id, provider_id, credentials_json, status, connected_at, updated_at)
       VALUES ($1, $2, $3, 'connected', NOW(), NOW())
       ON CONFLICT (company_id, provider_id)
       DO UPDATE SET credentials_json = EXCLUDED.credentials_json,
                     status = 'connected', connected_at = NOW(), updated_at = NOW(),
                     sync_error = NULL`,
      [companyId, PROVIDER, encryptSecret(JSON.stringify(creds))],
    );
  }

  async disconnect(companyId: string): Promise<void> {
    await db.query(
      `UPDATE integration_credentials
       SET status = 'disconnected', credentials_json = '{}', connected_at = NULL, updated_at = NOW()
       WHERE company_id = $1 AND provider_id = $2`,
      [companyId, PROVIDER],
    );
  }
}

export const outlookRepository = new OutlookRepository();
