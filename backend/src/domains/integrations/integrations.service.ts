import crypto from 'crypto';
import { AppError } from '../../core/errors/AppError';
import { integrationsRepository } from './integrations.repository';
import { ApiCredential, InternalApiKey, InternalApiKeyCreated, EncryptedEnvelope } from './integrations.types';
import { SaveIntegrationSchema } from './dto/save-integration.dto';
import { GenerateApiKeySchema } from './dto/generate-api-key.dto';

// ── Encryption helpers (AES-256-GCM) ─────────────────────────────────────
//
// ENCRYPTION_KEY must be a 64-char hex string (32 bytes) in the environment.
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const ALGORITHM = 'aes-256-gcm' as const;

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new AppError(500, 'ENCRYPTION_KEY env var is missing or invalid (must be 64-char hex)');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptedEnvelope = {
    iv:         iv.toString('hex'),
    tag:        tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
  return JSON.stringify(envelope);
}

function decrypt(envelopeJson: string): string {
  const key = getEncryptionKey();
  const { iv, tag, ciphertext } = JSON.parse(envelopeJson) as EncryptedEnvelope;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(ciphertext, 'hex')) + decipher.final('utf8');
}

// ── Provider telematics stubs ─────────────────────────────────────────────

async function fetchSamsaraLocation(apiKey: string, vehicleId: string) {
  console.log(`[IntegrationsService] Fetching Samsara location for vehicle ${vehicleId}`);
  // TODO: Replace stub with real Samsara Fleet API call:
  // GET https://api.samsara.com/fleet/vehicles/{vehicleId}/locations
  // Headers: { Authorization: `Bearer ${apiKey}` }
  return { lat: 46.0569, lng: 14.5058, updated_at: new Date() };
}

async function fetchGeotabLocation(apiKey: string, vehicleId: string) {
  console.log(`[IntegrationsService] Fetching Geotab location for vehicle ${vehicleId}`);
  // TODO: Replace stub with real MyGeotab API call using JSON-RPC:
  // POST https://my.geotab.com/apiv1 with method="Get", typeName="DeviceStatusInfo"
  return { lat: 46.0569, lng: 14.5058, updated_at: new Date() };
}

// ── Service ───────────────────────────────────────────────────────────────

class IntegrationsService {
  async getIntegrations(companyId: string): Promise<ApiCredential[]> {
    return integrationsRepository.findCredentialsByCompany(companyId);
  }

  async saveIntegration(companyId: string, body: unknown): Promise<ApiCredential> {
    const parsed = SaveIntegrationSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const { provider, api_key } = parsed.data;

    // Encrypt before persisting — fixes plaintext storage security risk in legacy code
    const encryptedJson = encrypt(JSON.stringify({ key: api_key }));

    return integrationsRepository.upsertCredential(companyId, provider, encryptedJson);
  }

  async getVehicleLocation(companyId: string, provider: string, vehicleId: string) {
    const row = await integrationsRepository.findCredentialRow(
      companyId,
      provider as ApiCredential['provider'],
    );
    if (!row) throw new AppError(404, `No ${provider} integration found for this company`);

    const { key } = JSON.parse(decrypt(row.credentials_json)) as { key: string };

    switch (provider) {
      case 'samsara': return fetchSamsaraLocation(key, vehicleId);
      case 'geotab':  return fetchGeotabLocation(key, vehicleId);
      default:        throw new AppError(400, `Provider "${provider}" does not support location fetch`);
    }
  }

  // ── Internal API keys ─────────────────────────────────────────────────────

  async getInternalApiKeys(companyId: string): Promise<InternalApiKey[]> {
    return integrationsRepository.findInternalKeysByCompany(companyId);
  }

  async generateInternalApiKey(companyId: string, body: unknown): Promise<InternalApiKeyCreated> {
    const parsed = GenerateApiKeySchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const rawKey   = crypto.randomBytes(32).toString('hex');
    const keyPrefix = rawKey.substring(0, 8);

    // Hash before storing — fixes raw key storage security risk in legacy code
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const record = await integrationsRepository.insertInternalKey(
      companyId,
      parsed.data.name,
      keyPrefix,
      hashedKey,
    );

    return {
      ...record,
      company_id: companyId,
      key: rawKey,
      warning: 'Save this key now. It will not be shown again.',
    };
  }
}

export const integrationsService = new IntegrationsService();
