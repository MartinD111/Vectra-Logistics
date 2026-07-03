import { apiFetch } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export type AiProvider = 'openai' | 'gemini' | 'local';

/** Public config — never includes the api key. `hasApiKey` reflects whether one is stored. */
export interface AiConfigPublic {
  provider: AiProvider;
  model: string | null;
  hasApiKey: boolean;
  localEndpoint: string | null;
  localModel: string | null;
  updatedAt: string | null;
}

export interface SaveAiConfigDto {
  provider: AiProvider;
  model?: string;
  /** Omit/empty to keep the existing stored key. Cloud providers only. */
  apiKey?: string;
  localEndpoint?: string;
  localModel?: string;
}

export interface AiCompleteRequest {
  prompt: string;
  system?: string;
  json?: boolean;
  maxTokens?: number;
}

export interface AiCompletion {
  text: string;
  provider: AiProvider;
  model: string;
}

// ── API ────────────────────────────────────────────────────────────────────

const BASE = '/api/v1/ai';

export const aiApi = {
  getConfig:  ()                       => apiFetch<AiConfigPublic>(`${BASE}/config`),
  saveConfig: (dto: SaveAiConfigDto)   => apiFetch<AiConfigPublic>(`${BASE}/config`, 'POST', dto),
  /** Cloud completion proxied through the backend (key stays server-side). */
  complete:   (req: AiCompleteRequest) => apiFetch<AiCompletion>(`${BASE}/complete`, 'POST', req),
};

// ── Local (Ollama-compatible) direct-from-browser completion ────────────────
//
// The backend cannot reach a model running on the user's machine/LAN, so local
// completions go straight from the browser to the configured endpoint. Uses the
// Ollama OpenAI-compatible /v1/chat/completions surface (also served by LM
// Studio, llama.cpp server, etc.).

export async function completeLocal(
  endpoint: string,
  model: string,
  req: AiCompleteRequest,
): Promise<AiCompletion> {
  const base = endpoint.replace(/\/+$/, '');
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  messages.push({ role: 'user', content: req.prompt });

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    }),
  });
  if (!res.ok) {
    let message = `Local model request failed (${res.status})`;
    try {
      const payload = await res.json();
      if (payload?.error?.message) message = payload.error.message;
      else if (typeof payload?.error === 'string') message = payload.error;
    } catch { /* keep generic */ }
    throw new Error(message);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return { text, provider: 'local', model };
}
