# ai-integration.md — AI provider abstraction & consumers

Scope: how Vectra talks to AI models — the company-level provider config
(cloud/local), the completion abstraction both frontend and backend use, the
real features already built on it, and the gaps that matter most for
On-Premise / Gemma. This documents the system **as it exists in code today**.

> Suggested location: `docs/specs/core/ai-integration.md`.
> Reads with: `program-builder.md` (the mini-program AI generator is the
> primary consumer), `event-spine.md`, and `on-premise-deployment.md`.

Governing philosophy (business plan §9): **AI is a helper, never the platform's
core function.** Every consumer below is an assist on top of something that
already works without AI (a demo/fallback path, a manual builder, a regex
extractor) — preserve that shape in anything new.

---

## 1. What already exists (do not rebuild)

- `database/migrations/005_ai_config.sql` — `company_ai_config`: one row per
  company, `provider: openai | gemini | local`.
- `apps/api/src/core/crypto/secretBox.ts` — AES-256-GCM at-rest encryption for
  provider API keys (`ENCRYPTION_KEY` env, 64-char hex). Shared secret-box used
  for AI keys and other integration credentials — reuse it, don't add a second
  encryption scheme.
- `apps/api/src/domains/ai/` — `ai.service.ts` (config CRUD, `complete`,
  `translate`), `ai.controller.ts`, `ai.routes.ts`, `ai.repository.ts`,
  `ai.types.ts`, `dto/`.
- `apps/workspaces/src/lib/hooks/useAi.ts` + `lib/api/ai.api.ts` — the frontend
  mirror: `useAiConfig`, `useAiComplete` (the single call site every feature
  should use), `completeLocal` (direct-from-browser Ollama-compatible call).
- Real consumers already built: the mini-program AI generator
  (`program-builder.md` §5), Smart Inbox email extraction
  (`inbox.parser.ts`), chat auto-translate (`ai.service.translate`).

---

## 2. The provider model

One config row per company (`company_ai_config`), admin-settable only:

| provider | model default | key storage | who calls it |
|---|---|---|---|
| `openai` | `gpt-4o` | encrypted (`api_key_enc`), server-side only | backend proxy |
| `gemini` | `gemini-1.5-pro` | encrypted, server-side only | backend proxy |
| `local` | `gemma3` | none (`local_endpoint` + `local_model`, plain, non-secret) | **browser, directly** |

The `local` split is the key architectural decision, and it's already correct:
a hosted backend cannot reach a model running on the customer's LAN, so local
completions bypass the server entirely and go straight from the browser to
`{endpoint}/v1/chat/completions` (Ollama's OpenAI-compatible surface — also
served by LM Studio, llama.cpp server, etc.). Cloud providers do the opposite:
the key must **never** reach the browser, so those calls proxy through the
backend, which decrypts the key server-side and calls OpenAI/Gemini directly.

**This split is the single most important pattern to preserve.** Every new AI
feature must pick the right side:
- Needs the company's cloud key → backend service, proxied through
  `/api/v1/ai/complete`.
- Runs from a UI the user is already in and provider could be local → use
  `useAiComplete()`, which already branches on `config.provider` so **the
  calling feature never branches on provider itself**.

---

## 3. The completion abstraction (single call shape everywhere)

Backend (`aiService.complete`) and frontend (`useAiComplete().complete`) both
accept the same shape and it should stay identical:

```ts
{ prompt: string; system?: string; json?: boolean; maxTokens?: number }
→ { text: string; provider: AiProvider; model: string }
```

- `system` steers the model (e.g. "you generate mini-program JSON," the Smart
  Inbox extraction prompt). `prompt` is the user/content input.
- `json: true` requests structured output where the provider supports it
  (OpenAI `response_format: json_object`, Gemini `responseMimeType:
  application/json`). Ollama-compatible local endpoints accept the same flag on
  `completeLocal`.
- Errors are normalised (`providerError`) so a provider failure never leaks the
  API key and always becomes a clean `AppError` with the provider's message.
- `maxTokens` is capped (8192) at the DTO level — keep new call sites within it
  rather than raising the ceiling casually.

**New AI features should call this abstraction, not a provider SDK directly.**
Adding OpenAI/Gemini calls ad hoc in a new domain service duplicates key
handling and error normalisation that already exists here.

---

## 4. Real consumers today (the pattern to copy)

Every existing consumer follows the same shape: **try AI if configured, else
degrade to something deterministic that still works.** This is not incidental —
it's what makes AI "a helper" rather than a dependency, and it should be the
template for every new one.

### 4.1 Mini-program generator (`program-builder.md` §5)
Natural language → draft `MiniProgramConfig`. Prompt derived from
`BLOCK_REGISTRY`; output never trusted, rebuilt from registry defaults. Fully
covered in `program-builder.md` — this file just re-anchors it as the flagship
AI consumer and the one most relevant to the Gemma quality bar.

### 4.2 Smart Inbox extraction (`inbox.parser.ts`)
Turns a raw broker/agency email into a structured load
(`origin/destination/cargo_type/weight_kg/pickup_date/delivery_date/
wagon_number/reference/confidence`), via a strict few-shot system prompt +
`json: true`. **Fallback is not a stub** — `demoExtract` is a real deterministic
regex/heuristic extractor (from/to phrases, kg/tonne parsing with EU/US
thousands-separator handling, date formats, wagon-number pattern, reference
pattern) that runs whenever no cloud provider is configured, or when the model
returns non-JSON. This is the reference implementation for "AI assist with a
genuinely useful non-AI fallback," not just an error message — copy this shape
for any new extraction feature.

Note: extraction **only checks `hasCloudProvider`** — it does not attempt a
local-provider path (see gap in §6.1).

### 4.3 Chat auto-translate (`ai.service.translate`)
Same fallback stance: `demo: true` with a bracketed placeholder translation
when no cloud provider is set, so the omnichannel chat's auto-translate "works
out of the box" without configuration. Real translation uses a system prompt
that explicitly preserves names/plate numbers/wagon numbers/reference codes —
worth reusing verbatim for any other logistics-text AI feature that must not
mangle identifiers.

---

## 5. Document AI / OCR — current status is a mock, not a gap to patch lightly

`apps/api/src/domains/workspace/document-ai.service.ts`
(`extractRateConfirmationData`) is **entirely a mock today**: it checks the file
exists, sleeps 2–3s to simulate latency, and returns hardcoded realistic-looking
rate-confirmation data. It is **not** wired to any real vision/OCR provider.

This matters because the business plan and prior context describe
"Gemini-powered document parsing" as existing — it does not yet, only its
integration point and target schema (`ParsedRateResponseSchema`) do. The file
already contains a detailed, correct TODO for wiring OpenAI Vision (`gpt-4o`
with an image/PDF content block) or Google Document AI. When implementing:

- Route it through `aiService`-style key handling (reuse `secretBox`, don't
  invent new credential storage) rather than a fresh `OpenAI` client reading
  its own env var.
- Follow the CMR Digital Workflow spec (business plan §7.5): classic OCR first,
  AI OCR only as the fallback when confidence is low or the document is
  handwritten/poor quality — don't make every document a full AI call by
  default.
- Keep the Zod schema (`ParsedRateResponseSchema`) as the contract; the real
  provider's output must validate against the same shape the mock already
  returns, so nothing downstream needs to change.

---

## 6. Gaps to close

### 6.1 Backend-only features can't use a local provider (the On-Premise-relevant gap)

Today, **any AI feature that runs server-side (Smart Inbox extraction, chat
translate, future document AI) can only use `openai`/`gemini`.** They check
`hasCloudProvider()` and fall back to the deterministic path when the
company's configured provider is `local` — even though a local model may well
be reachable from the backend too, especially **On-Premise**, where the backend
and a local Gemma instance can sit on the same network (unlike Cloud, where the
hosted backend genuinely cannot reach a customer's LAN).

This is worth fixing deliberately for the On-Premise phase: add a
backend-callable local path (the server calls `local_endpoint` directly,
symmetric to what the browser already does in `completeLocal`) so On-Premise
installs get **full local-Gemma coverage of every AI feature**, not just the
client-side mini-program generator. Concretely:
- Add a `completeLocal`-equivalent in `ai.service.ts` for the backend, and let
  `aiService.complete` dispatch to it when `provider === 'local'` **and** the
  endpoint is reachable from the server (On-Prem case) — vs. today's hard
  `throw` for local on the server.
- Give `inbox.parser.ts`'s `hasCloudProvider` check a `hasUsableProvider`
  sibling that also accepts a server-reachable local config, so extraction gets
  real AI on a local-only On-Premise install instead of always falling back to
  regex.
- Keep the Cloud behaviour unchanged — the hard `throw` for local on
  Cloud-hosted backends stays correct there.

### 6.2 Document AI is unimplemented (§5)
Wire a real provider behind the existing mock's interface and Zod contract.

### 6.3 No "Vectra AI" hosted tier
Business plan §9.1 describes three AI modes: BYOK, local, and a paid
**Vectra-hosted** tier for companies without their own GPU. Only BYOK
(`openai`/`gemini`) and `local` exist in `company_ai_config` today — there is
no `vectra-hosted` provider value or billing hook. Out of scope for the current
On-Premise phase (per `CLAUDE.md` §2.4-adjacent reasoning — this is a Cloud-side
revenue feature); note it so it isn't silently designed out of the `provider`
enum later. When it lands, it's a fourth `provider` value proxied like
`openai`/`gemini` but billed per-company rather than keyed to the company's own
account.

### 6.4 NL → data query (Power BI proposal §2)
The Power BI analysis proposed a `/ask-ai` Q&A block that turns a question
("top 5 customers by revenue in 2025") into a query over the event
spine/KPI results. Not built. When it is, it should be **another consumer of
`useAiComplete`/`aiService.complete`**, with a system prompt describing the
generic schema (verbs, object types, KPI rule shapes) the same way the
mini-program generator's prompt is derived from `BLOCK_REGISTRY` — schema-driven,
not hand-written per query type. Natural home: `kpi-engine.md` /
`analytics-reporting.md`, implemented on top of this file's abstraction.

---

## 7. Making Gemma (local) reliable across features

Same underlying advice as `program-builder.md` §5, generalised to every AI
consumer, since Gemma-class local models are the On-Premise default:

- **Prefer strict `json: true` + a Zod-validated response schema** for every
  extraction-style feature (Smart Inbox already does this — follow it).
- **Always ship a working non-AI fallback** (§4's pattern) — a smaller local
  model failing to produce valid JSON should degrade gracefully, never break
  the feature.
- **Keep system prompts short, concrete, and few-shot** — the Smart Inbox
  prompt's one worked example is the right size; long instruction lists degrade
  faster on smaller models than on GPT-4o/Gemini-1.5-Pro.
- **Validate, don't trust** — every consumer either Zod-parses the JSON
  (`ExtractionSchema`, `ParsedRateResponseSchema`) or rebuilds from a known
  structure (`parseGeneratedConfig`). New consumers must do the same; never
  pass raw model output further downstream unvalidated.

---

## 8. Cloud vs. On-Premise

- Cloud vs. On-Prem doesn't change the provider **model** — same three
  provider values, same config table. What changes is which providers are
  *practical*: Cloud installs will mostly use `openai`/`gemini` (BYOK) since a
  hosted backend can't reach a customer LAN for `local`; On-Premise installs
  are the primary audience for `local`, and per §6.1 should get full
  backend-side local support too, not just the browser path.
- Keys stay encrypted at rest via `secretBox` either way; `ENCRYPTION_KEY`
  generation is covered in `on-premise-deployment.md`, not here.
- No AI call in this domain requires reaching Vectra's own infrastructure
  (until §6.3's hosted tier exists) — consistent with `CLAUDE.md` §2's "no
  hidden cloud-only assumption" rule.

---

## 9. Do / Don't

**Do**
- Route every new AI feature through `aiService.complete` (backend) or
  `useAiComplete()` (frontend) — never call a provider SDK directly in a new
  domain service.
- Always pair an AI path with a real, working non-AI fallback (§4's pattern).
- Validate all model output with Zod (or registry-based reconstruction) before
  using it — never trust raw JSON downstream.
- Reuse `secretBox` for any new at-rest secret; don't invent new encryption.

**Don't**
- Don't let a new backend feature assume cloud-only — track it against §6.1's
  planned local-server-side path so On-Premise isn't second-class.
- Don't call OpenAI/Gemini/Ollama endpoints from a new domain without going
  through the shared abstraction — key handling and error normalisation would
  fork.
- Don't treat `document-ai.service.ts` as already working — it's a mock; say so
  when discussing platform capabilities.
- Don't design the `provider` enum or config shape in a way that blocks adding
  a future `vectra-hosted` value (§6.3).
