import { db } from '../../core/db';
import { ApiCredential, ApiCredentialRow, InternalApiKey } from './integrations.types';
import { IntegrationProvider } from './integrations.types';

class IntegrationsRepository {
  // ── Third-party credentials ───────────────────────────────────────────────

  async findCredentialsByCompany(companyId: string): Promise<ApiCredential[]> {
    const { rows } = await db.query<ApiCredential>(
      `SELECT id, provider, status, updated_at
       FROM api_credentials
       WHERE company_id = $1`,
      [companyId],
    );
    return rows;
  }

  async findCredentialRow(
    companyId: string,
    provider: IntegrationProvider,
  ): Promise<ApiCredentialRow | null> {
    const { rows } = await db.query<ApiCredentialRow>(
      `SELECT * FROM api_credentials WHERE company_id = $1 AND provider = $2`,
      [companyId, provider],
    );
    return rows[0] ?? null;
  }

  async upsertCredential(
    companyId: string,
    provider: IntegrationProvider,
    encryptedJson: string,
  ): Promise<ApiCredential> {
    const { rows } = await db.query<ApiCredential>(
      `INSERT INTO api_credentials (company_id, provider, credentials_json, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (company_id, provider)
       DO UPDATE SET
         credentials_json = EXCLUDED.credentials_json,
         status           = 'active',
         updated_at       = NOW()
       RETURNING id, provider, status, updated_at`,
      [companyId, provider, encryptedJson],
    );
    return rows[0];
  }

  // ── Internal API keys ─────────────────────────────────────────────────────

  async findInternalKeysByCompany(companyId: string): Promise<InternalApiKey[]> {
    const { rows } = await db.query<InternalApiKey>(
      `SELECT id, key_prefix, name, created_at, last_used_at
       FROM internal_api_keys
       WHERE company_id = $1`,
      [companyId],
    );
    return rows;
  }

  async insertInternalKey(
    companyId: string,
    name: string,
    keyPrefix: string,
    hashedKey: string,
  ): Promise<InternalApiKey> {
    const { rows } = await db.query<InternalApiKey>(
      `INSERT INTO internal_api_keys (company_id, name, key_prefix, hashed_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, created_at, last_used_at`,
      [companyId, name, keyPrefix, hashedKey],
    );
    return rows[0];
  }
}

export const integrationsRepository = new IntegrationsRepository();
