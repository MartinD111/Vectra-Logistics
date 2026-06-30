import { apiFetch } from './client';

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

/** Returned once on key creation — raw key is never stored server-side again. */
export interface InternalApiKeyCreated extends InternalApiKey {
  key: string;
  warning: string;
}

export interface SaveIntegrationDto {
  provider: IntegrationProvider;
  api_key: string;
}

// ── API ────────────────────────────────────────────────────────────────────

const BASE = '/api/v1/integrations';

export const integrationsApi = {
  getIntegrations:      ()                          => apiFetch<ApiCredential[]>(`${BASE}/settings`),
  saveIntegration:      (dto: SaveIntegrationDto)   => apiFetch<ApiCredential>(`${BASE}/settings`, 'POST', dto),

  getInternalApiKeys:   ()                          => apiFetch<InternalApiKey[]>(`${BASE}/settings/keys`),
  generateInternalApiKey: (name: string)            => apiFetch<InternalApiKeyCreated>(`${BASE}/settings/keys`, 'POST', { name }),
};
