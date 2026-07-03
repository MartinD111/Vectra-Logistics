import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppError } from '../../core/errors/AppError';
import { encryptSecret, decryptSecret } from '../../core/crypto/secretBox';
import { aiRepository } from './ai.repository';
import { AiConfigPublic, AiConfigRow, AiCompletion, AiProvider } from './ai.types';
import { SaveAiConfigSchema } from './dto/save-ai-config.dto';
import { AiCompleteSchema } from './dto/ai-complete.dto';

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  local: 'gemma3',
};

function toPublic(row: AiConfigRow | null): AiConfigPublic {
  if (!row) {
    return { provider: 'openai', model: null, hasApiKey: false, localEndpoint: null, localModel: null, updatedAt: null };
  }
  return {
    provider: row.provider,
    model: row.model,
    hasApiKey: !!row.api_key_enc,
    localEndpoint: row.local_endpoint,
    localModel: row.local_model,
    updatedAt: row.updated_at,
  };
}

class AiService {
  async getConfig(companyId: string): Promise<AiConfigPublic> {
    return toPublic(await aiRepository.findByCompany(companyId));
  }

  async saveConfig(companyId: string, body: unknown, userId: string | null): Promise<AiConfigPublic> {
    const parsed = SaveAiConfigSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const { provider, model, apiKey, localEndpoint, localModel } = parsed.data;

    // Cloud key: encrypt when provided, keep existing when omitted (undefined),
    // clear when switching to a local provider.
    let apiKeyEnc: string | null | undefined;
    if (provider === 'local') {
      apiKeyEnc = null;
    } else if (apiKey && apiKey.length > 0) {
      apiKeyEnc = encryptSecret(apiKey);
    } else {
      apiKeyEnc = undefined; // keep existing
    }

    const row = await aiRepository.upsert(
      companyId,
      provider,
      model?.trim() || null,
      apiKeyEnc,
      provider === 'local' ? localEndpoint ?? null : null,
      provider === 'local' ? localModel?.trim() || null : null,
      userId,
    );
    return toPublic(row);
  }

  /** Proxy a completion to the company's configured CLOUD provider. Local providers are handled client-side and rejected here. */
  async complete(companyId: string, body: unknown): Promise<AiCompletion> {
    const parsed = AiCompleteSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const { prompt, system, json, maxTokens } = parsed.data;

    const row = await aiRepository.findByCompany(companyId);
    if (!row) throw new AppError(400, 'No AI provider configured for this company. Set one in Settings.');

    if (row.provider === 'local') {
      throw new AppError(400, 'Local providers are called directly from the browser, not via the server proxy.');
    }
    if (!row.api_key_enc) {
      throw new AppError(400, `No API key stored for ${row.provider}. Add one in Settings.`);
    }

    const apiKey = decryptSecret(row.api_key_enc);
    const model = row.model?.trim() || DEFAULT_MODEL[row.provider];

    if (row.provider === 'openai') {
      return this.completeOpenAi(apiKey, model, system, prompt, json, maxTokens);
    }
    return this.completeGemini(apiKey, model, system, prompt, json, maxTokens);
  }

  private async completeOpenAi(
    apiKey: string, model: string, system: string | undefined, prompt: string, json: boolean | undefined, maxTokens: number | undefined,
  ): Promise<AiCompletion> {
    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
        },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 },
      );
      const text = res.data?.choices?.[0]?.message?.content ?? '';
      return { text, provider: 'openai', model };
    } catch (err) {
      throw this.providerError('OpenAI', err);
    }
  }

  private async completeGemini(
    apiKey: string, model: string, system: string | undefined, prompt: string, json: boolean | undefined, maxTokens: number | undefined,
  ): Promise<AiCompletion> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const client = genAI.getGenerativeModel({
        model,
        ...(system ? { systemInstruction: system } : {}),
        generationConfig: {
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
        },
      });
      const result = await client.generateContent(prompt);
      return { text: result.response.text(), provider: 'gemini', model };
    } catch (err) {
      throw this.providerError('Gemini', err);
    }
  }

  /** Normalise a provider error into an AppError without leaking the api key. */
  private providerError(label: string, err: unknown): AppError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 502;
      const providerMsg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
      return new AppError(status >= 400 && status < 500 ? status : 502, `${label} request failed: ${providerMsg ?? err.message}`);
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return new AppError(502, `${label} request failed: ${message}`);
  }
}

export const aiService = new AiService();
