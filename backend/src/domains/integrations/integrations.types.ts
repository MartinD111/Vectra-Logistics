// ── Third-party integrations ──────────────────────────────────────────────

export type IntegrationProvider = 'samsara' | 'geotab' | 'webfleet' | 'wialon' | 'transporeon' | 'alpega';
export type IntegrationStatus  = 'active' | 'inactive' | 'error';

export interface ApiCredential {
  id: string;
  company_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  updated_at: Date;
}

/** Full row including encrypted blob — never exposed to HTTP layer */
export interface ApiCredentialRow extends ApiCredential {
  credentials_json: string;
}

// ── Internal API keys ─────────────────────────────────────────────────────

export interface InternalApiKey {
  id: string;
  company_id: string;
  name: string;
  key_prefix: string;
  created_at: Date;
  last_used_at: Date | null;
}

/** Returned once on creation only — raw key is never stored */
export interface InternalApiKeyCreated extends InternalApiKey {
  key: string;
  warning: string;
}

// ── Telematics ────────────────────────────────────────────────────────────

export interface VehicleLocation {
  lat: number;
  lng: number;
  updated_at: Date;
}

// ── Encrypted credential envelope ─────────────────────────────────────────

export interface EncryptedEnvelope {
  iv: string;         // hex
  tag: string;        // hex — GCM auth tag
  ciphertext: string; // hex
}
