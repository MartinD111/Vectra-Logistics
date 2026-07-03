import { db } from '../../core/db';
import { AiConfigRow, AiProvider } from './ai.types';

class AiRepository {
  async findByCompany(companyId: string): Promise<AiConfigRow | null> {
    const { rows } = await db.query<AiConfigRow>(
      `SELECT company_id, provider, model, api_key_enc, local_endpoint, local_model, updated_at
       FROM company_ai_config
       WHERE company_id = $1`,
      [companyId],
    );
    return rows[0] ?? null;
  }

  /**
   * Upsert config. `apiKeyEnc === undefined` means "keep the existing key"
   * (COALESCE keeps the stored value); passing `null` explicitly clears it
   * (used when switching to a local provider).
   */
  async upsert(
    companyId: string,
    provider: AiProvider,
    model: string | null,
    apiKeyEnc: string | null | undefined,
    localEndpoint: string | null,
    localModel: string | null,
    updatedBy: string | null,
  ): Promise<AiConfigRow> {
    const keepKey = apiKeyEnc === undefined;
    const { rows } = await db.query<AiConfigRow>(
      `INSERT INTO company_ai_config
         (company_id, provider, model, api_key_enc, local_endpoint, local_model, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         provider       = EXCLUDED.provider,
         model          = EXCLUDED.model,
         api_key_enc    = ${keepKey ? 'company_ai_config.api_key_enc' : 'EXCLUDED.api_key_enc'},
         local_endpoint = EXCLUDED.local_endpoint,
         local_model    = EXCLUDED.local_model,
         updated_by     = EXCLUDED.updated_by,
         updated_at     = NOW()
       RETURNING company_id, provider, model, api_key_enc, local_endpoint, local_model, updated_at`,
      [companyId, provider, model, keepKey ? null : apiKeyEnc, localEndpoint, localModel, updatedBy],
    );
    return rows[0];
  }
}

export const aiRepository = new AiRepository();
