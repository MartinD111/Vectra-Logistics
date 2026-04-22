import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'samsara' | 'geotab' | 'webfleet' | 'wialon' | 'transporeon' | 'alpega';

export type IntegrationStatus = 'active' | 'inactive' | 'error';

export interface ApiCredential {
  id: string;
  company_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  updated_at: string;
}

export interface InternalApiKey {
  id: string;
  company_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

/** Returned once on key creation — raw key is never stored again. */
export interface InternalApiKeyCreated extends InternalApiKey {
  key: string;
  warning: string;
}

// ── Request DTOs ───────────────────────────────────────────────────────────

export interface SaveIntegrationDto {
  provider: IntegrationProvider;
  api_key: string;
}

export interface GenerateApiKeyDto {
  name?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

const BASE = '/api/v1/integrations';

export const integrationsApi = {
  // Third-party provider credentials
  getIntegrations:  ()                         => api.get<ApiCredential[]>(`${BASE}/settings`),
  saveIntegration:  (dto: SaveIntegrationDto)  => api.post<ApiCredential>(`${BASE}/settings`, dto),

  // Internal API keys
  getApiKeys:       ()                         => api.get<InternalApiKey[]>(`${BASE}/settings/keys`),
  generateApiKey:   (dto: GenerateApiKeyDto)   => api.post<InternalApiKeyCreated>(`${BASE}/settings/keys`, dto),
};
