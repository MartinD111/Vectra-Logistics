# Phase 18: Backend-side Local AI Provider - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 2 modified files (no new files — this phase only extends two existing modules)
**Analogs found:** 2 / 2 (both analogs are sibling methods within the same files being modified)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/api/src/domains/ai/ai.service.ts` (new private `completeLocal`-equivalent method + `complete()` dispatch branch edit) | service | request-response (outbound HTTP to local model endpoint) | `completeOpenAi` (same file, lines 95-118); request-shape mirror is `apps/workspaces/src/lib/api/ai.api.ts` `completeLocal` (lines 67-100) | exact (same file, same class, same private-method convention) |
| `apps/api/src/domains/inbox/inbox.parser.ts` (new `hasUsableProvider`-gated condition in `extract()`) | service (gating/degrade logic) | request-response with graceful-degrade fallback | `aiService.hasCloudProvider` (`ai.service.ts:64-68`) for the new `hasUsableProvider` sibling; `extract()`'s own existing `hasCloudProvider` call site + non-JSON degrade (`inbox.parser.ts:48-50, 58-65`) for the call-site wiring | exact (same file/module, existing sibling pattern) |

No new files are created in this phase — both target files already exist and are being extended with new methods/branches that mirror sibling methods already present in the same file.

## Pattern Assignments

### `apps/api/src/domains/ai/ai.service.ts` — new local-dispatch method (service, request-response)

**Primary analog:** `completeOpenAi` (same file, lines 95-118) — the axios + try/catch + `providerError()` skeleton to copy.
**Request-shape analog:** `apps/workspaces/src/lib/api/ai.api.ts` `completeLocal` (lines 67-100) — the exact Ollama-compatible request/response shape to port server-side.

**Imports already present** (`ai.service.ts:1-9`) — no new imports needed beyond what's already imported (`axios`, `AppError`); no need to import anything from `secrets.ts` beyond what the dispatch branch requires:
```typescript
import axios from 'axios';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppError } from '../../core/errors/AppError';
import { encryptSecret, decryptSecret } from '../../core/crypto/secretBox';
import { aiRepository } from './ai.repository';
import { AiConfigPublic, AiConfigRow, AiCompletion, AiProvider } from './ai.types';
import { SaveAiConfigSchema } from './dto/save-ai-config.dto';
import { AiCompleteSchema } from './dto/ai-complete.dto';
```
Add one import for the on-prem gate:
```typescript
import { getDeploymentMode } from '../../core/config/secrets';
```

**Core axios + try/catch + providerError() pattern to mirror** (`ai.service.ts:95-118`):
```typescript
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
```

**Request shape to port from the browser-side `completeLocal`** (`apps/workspaces/src/lib/api/ai.api.ts:67-100`) — note this is fetch-based (browser); the server-side port swaps `fetch` for `axios` per the analog above, keeps the same body shape and endpoint suffix (`/v1/chat/completions`), and keeps the same trailing-slash-strip on the endpoint:
```typescript
const base = endpoint.replace(/\/+$/, '');
const messages: { role: string; content: string }[] = [];
if (req.system) messages.push({ role: 'system', content: req.system });
messages.push({ role: 'user', content: req.prompt });

// POST `${base}/v1/chat/completions`
// body: { model, messages, stream: false, response_format?: {type:'json_object'}, max_tokens? }
// response: data.choices[0].message.content
```
Combined server-side shape (axios version, per D-02 uses a 180s timeout instead of `completeOpenAi`'s 60000):
```typescript
private async completeLocal(
  endpoint: string, model: string, system: string | undefined, prompt: string, json: boolean | undefined, maxTokens: number | undefined,
): Promise<AiCompletion> {
  const base = endpoint.replace(/\/+$/, '');
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await axios.post(
      `${base}/v1/chat/completions`,
      {
        model,
        messages,
        stream: false,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 180000 }, // D-02: 180s, not 60s
    );
    const text = res.data?.choices?.[0]?.message?.content ?? '';
    return { text, provider: 'local', model };
  } catch (err) {
    throw this.providerError('Local model', err);
  }
}
```

**`complete()` dispatch branch to replace** (`ai.service.ts:79-81`) — this is the exact code to change. Cloud unchanged; on-prem dispatches to the new method:
```typescript
if (row.provider === 'local') {
  throw new AppError(400, 'Local providers are called directly from the browser, not via the server proxy.');
}
```
New shape (on-prem dispatch branch, Cloud hard-throw unchanged per spec) — matches the gating pattern at `apps/api/src/controllers/authController.ts:16-18`:
```typescript
// apps/api/src/controllers/authController.ts:16-18 gating pattern to mirror:
if (getDeploymentMode() === 'on-prem') {
  return res.status(403).json({ error: 'Registration is closed on this on-premise install' });
}
```
Applied to `complete()`'s local branch (note: `local_endpoint`/`local_model` are non-secret plaintext columns, no decrypt step needed, unlike `api_key_enc`):
```typescript
if (row.provider === 'local') {
  if (getDeploymentMode() === 'on-prem' && row.local_endpoint) {
    const localModel = row.local_model?.trim() || DEFAULT_MODEL.local;
    return this.completeLocal(row.local_endpoint, localModel, system, prompt, json, maxTokens);
  }
  throw new AppError(400, 'Local providers are called directly from the browser, not via the server proxy.');
}
```

**Error normalization pattern** (`providerError`, `ai.service.ts:166-175`) — reuse as-is, just pass a new label (e.g. `'Local model'`):
```typescript
private providerError(label: string, err: unknown): AppError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 502;
    const providerMsg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    return new AppError(status >= 400 && status < 500 ? status : 502, `${label} request failed: ${providerMsg ?? err.message}`);
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  return new AppError(502, `${label} request failed: ${message}`);
}
```

**`DEFAULT_MODEL` fallback already has the local entry** (`ai.service.ts:11-15`):
```typescript
const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  local: 'gemma3',
};
```

**`AiConfigRow` fields already available, no schema/type changes needed** (`ai.types.ts:23-31`):
```typescript
export interface AiConfigRow {
  company_id: string;
  provider: AiProvider;
  model: string | null;
  api_key_enc: string | null;
  local_endpoint: string | null;
  local_model: string | null;
  updated_at: Date;
}
```
And repository already selects these columns (`ai.repository.ts:6-11`) — no repository changes needed:
```typescript
const { rows } = await db.query<AiConfigRow>(
  `SELECT company_id, provider, model, api_key_enc, local_endpoint, local_model, updated_at
   FROM company_ai_config
   WHERE company_id = $1`,
  [companyId],
);
```

---

### `apps/api/src/domains/inbox/inbox.parser.ts` — new `hasUsableProvider` gate (service, request-response with degrade fallback)

**Analog for the new sibling method:** `aiService.hasCloudProvider` (`ai.service.ts:64-68`):
```typescript
/** Whether the company has a usable server-side cloud provider (key stored). */
async hasCloudProvider(companyId: string): Promise<boolean> {
  const row = await aiRepository.findByCompany(companyId);
  return !!row && row.provider !== 'local' && !!row.api_key_enc;
}
```
Per D-01, `hasUsableProvider` should follow the exact same "trust stored config, no live ping" shape, but check on-prem + local + `local_endpoint` set:
```typescript
/** Whether the company has a usable server-reachable LOCAL provider (on-prem only). No live ping — trusts stored config, mirroring hasCloudProvider. */
async hasUsableProvider(companyId: string): Promise<boolean> {
  if (getDeploymentMode() !== 'on-prem') return false;
  const row = await aiRepository.findByCompany(companyId);
  return !!row && row.provider === 'local' && !!row.local_endpoint;
}
```
(This method lives on `aiService` in `ai.service.ts`, not in `inbox.parser.ts` itself — mirrors where `hasCloudProvider` lives, per CONTEXT.md's "sibling to `hasCloudProvider`" framing.)

**Existing call site to extend** (`inbox.parser.ts:47-50`) — exact code to change:
```typescript
async extract(companyId: string, email: { subject?: string; body: string }): Promise<{ extraction: Extraction; demo: boolean }> {
  if (!(await aiService.hasCloudProvider(companyId))) {
    return { extraction: this.demoExtract(email), demo: true };
  }
```
New shape — OR-combine both provider checks so either a cloud key or a reachable local endpoint unlocks real extraction:
```typescript
async extract(companyId: string, email: { subject?: string; body: string }): Promise<{ extraction: Extraction; demo: boolean }> {
  const usable = (await aiService.hasCloudProvider(companyId)) || (await aiService.hasUsableProvider(companyId));
  if (!usable) {
    return { extraction: this.demoExtract(email), demo: true };
  }
```

**Existing non-JSON degrade pattern to mirror for the completion-throw catch** (`inbox.parser.ts:58-65`) — per D-01's corollary, wrap the `aiService.complete(...)` call in try/catch and degrade the same way a non-JSON response degrades today:
```typescript
let raw: unknown;
try {
  raw = JSON.parse(completion.text);
} catch {
  // Model returned non-JSON — degrade to the deterministic extractor rather
  // than throwing into the dispatcher's inbox.
  return { extraction: this.demoExtract(email), demo: false };
}
```
Applied to the whole completion call (new try/catch wrapping `aiService.complete(...)` itself, not just the `JSON.parse`), so a local-endpoint timeout/connection-refused/bad-response degrades identically:
```typescript
let completion;
try {
  completion = await aiService.complete(companyId, {
    system: SYSTEM_PROMPT,
    prompt: text,
    json: true,
    maxTokens: 500,
  });
} catch {
  // Local completion failed (timeout, connection refused, bad response) —
  // degrade the same way a non-JSON model response degrades. Never surfaces
  // a hard error to the dispatcher (D-01 corollary).
  return { extraction: this.demoExtract(email), demo: false };
}
```

**Import to add** (`inbox.parser.ts:1-8` currently only imports `z` and `aiService`) — no new import needed if `hasUsableProvider` lives on `aiService` as designed above; `aiService` is already imported:
```typescript
import { z } from 'zod';
import { aiService } from '../ai/ai.service';
```

---

## Shared Patterns

### Deployment-mode gating
**Source:** `apps/api/src/core/config/secrets.ts:111-122` (`getDeploymentMode()`), example usage `apps/api/src/controllers/authController.ts:16-18`
**Apply to:** Both the `ai.service.ts` `complete()` local-dispatch branch and the new `hasUsableProvider` method.
```typescript
export function getDeploymentMode(): DeploymentMode {
  if (cachedDeploymentMode !== undefined) {
    return cachedDeploymentMode;
  }
  const value = process.env.DEPLOYMENT_MODE;
  const result = validateDeploymentModeValue(value);
  if (!result.valid) {
    fail('DEPLOYMENT_MODE', result.reason ?? 'invalid value');
  }
  cachedDeploymentMode = value as DeploymentMode;
  return cachedDeploymentMode;
}
```
Usage example:
```typescript
if (getDeploymentMode() === 'on-prem') {
  return res.status(403).json({ error: 'Registration is closed on this on-premise install' });
}
```

### Provider error normalization
**Source:** `apps/api/src/domains/ai/ai.service.ts:166-175` (`providerError`)
**Apply to:** The new `completeLocal` private method in `ai.service.ts` — reuse verbatim, just pass a distinct label string (e.g. `'Local model'`) so error messages stay consistent with the OpenAI/Gemini paths without leaking secrets (there is no api key to leak for local, but the same shape avoids introducing a second error-formatting convention).

### Graceful degradation ("never block the core workflow on an AI failure")
**Source:** `apps/api/src/domains/inbox/inbox.parser.ts:48-50` (hasCloudProvider gate) and `:58-65` (non-JSON degrade); also `ai.service.ts:154-156` (translate() demo fallback)
**Apply to:** `inbox.parser.ts extract()` — both the new `hasUsableProvider` gate and the new try/catch around `aiService.complete()` follow this same "degrade to `demoExtract`, never throw" stance, per D-01's corollary.

## No Analog Found

None — both target files already contain sibling methods (`completeOpenAi`/`completeGemini`, `hasCloudProvider`) that are direct structural analogs for the new local-provider additions. No files in this phase require patterns from outside `ai.service.ts` / `inbox.parser.ts` / `secrets.ts` / `authController.ts`.

## Metadata

**Analog search scope:** `apps/api/src/domains/ai/`, `apps/api/src/domains/inbox/`, `apps/api/src/core/config/`, `apps/api/src/controllers/`, `apps/workspaces/src/lib/api/ai.api.ts`
**Files scanned:** 6 (`ai.service.ts`, `ai.types.ts`, `ai.repository.ts`, `secrets.ts`, `authController.ts`, `inbox.parser.ts`) + 1 browser-side reference (`ai.api.ts`)
**Pattern extraction date:** 2026-07-12
