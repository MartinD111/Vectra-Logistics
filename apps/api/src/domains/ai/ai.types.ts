// Company-level AI provider configuration.
//
// Cloud providers ('openai' | 'gemini') keep an encrypted api key that is only
// ever used by the backend /complete proxy — never returned to the client.
// 'local' providers (Ollama-compatible, e.g. Gemma running on the user's
// machine) store a NON-secret endpoint URL + model that the browser calls
// directly, since a hosted backend generally cannot reach the user's LAN.

export type AiProvider = 'openai' | 'gemini' | 'local';

/** Public config — safe to return to the browser. Never includes the api key. */
export interface AiConfigPublic {
  provider: AiProvider;
  model: string | null;
  /** Whether a cloud api key is stored (so the UI can show "key set" without revealing it). */
  hasApiKey: boolean;
  localEndpoint: string | null;
  localModel: string | null;
  updatedAt: Date | null;
}

/** Full DB row including the encrypted key — never leaves the service layer. */
export interface AiConfigRow {
  company_id: string;
  provider: AiProvider;
  model: string | null;
  api_key_enc: string | null;
  local_endpoint: string | null;
  local_model: string | null;
  updated_at: Date;
}

/** Result of a completion request proxied to a cloud provider. */
export interface AiCompletion {
  text: string;
  provider: AiProvider;
  model: string;
}
