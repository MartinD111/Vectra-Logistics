# Phase 18: Backend-side Local AI Provider - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Every AI-powered feature works on an on-prem install using only a local model — no dependency on a browser-side call path. Specifically: `aiService.complete()` dispatches to a server-reachable local Gemma/Ollama endpoint when `provider==='local'` **and** the deployment is on-prem, instead of the current hard `throw`; `inbox.parser.ts` gets real AI extraction on a local-only install instead of silently falling back to the regex extractor; Cloud's existing hard-throw behavior for `provider==='local'` is completely unchanged.

This is the last unimplemented piece of `docs/specs/core/ai-integration.md` §6.1 ("Backend-only features can't use a local provider") — the spec already prescribes the shape of the fix; this discussion locks the remaining implementation nuances the spec leaves open.

</domain>

<decisions>
## Implementation Decisions

### Reachability check (`hasUsableProvider`)
- **D-01:** `hasUsableProvider` (the `inbox.parser.ts` sibling to `hasCloudProvider`) trusts the stored config — `getDeploymentMode()==='on-prem' && provider==='local' && local_endpoint` set → usable. No live preflight ping (no `/api/tags` or `/v1/models` probe) before every extraction call.
  - **Why:** Matches the existing `hasCloudProvider` pattern, which also only checks stored config (never live-tests the API key). Avoids adding a second network round-trip to every inbox parse. If the endpoint is actually unreachable, the completion call itself fails and `extract()` degrades to `demoExtract` — the same path already used today when the model returns non-JSON output (`inbox.parser.ts:61-64`).
  - **Corollary (follows directly from D-01, not separately re-litigated):** when a real local completion call throws (timeout, connection refused, bad response), `inbox.parser.extract()` catches it and falls back to `demoExtract` with `demo: false`, exactly like the existing non-JSON-response degrade path — it does not surface a hard error to the dispatcher. This preserves the "inbox works out of the box, never blocks on AI" stance already documented at the top of `inbox.parser.ts`.

### Local completion timeout
- **D-02:** The backend's local Gemma/Ollama completion call uses a **180s** axios timeout, not the 60s used by `completeOpenAi`/`completeGemini`.
  - **Why:** CPU-bound local inference on modest on-prem hardware can be significantly slower than cloud APIs; a 60s ceiling risked false-timeout failures on real first installs. 180s trades a slower failure signal on a genuinely dead endpoint for not cutting off legitimate slow inference.

### Claude's Discretion
- **`translate()` scope:** `docs/specs/core/ai-integration.md` §6.1 lists "chat translate" as one of the backend-only features affected by the local-provider gap, but the roadmap's Phase 18 Success Criteria only names `aiService.complete()` and `inbox.parser.ts` explicitly. This area was surfaced but not selected for discussion — treat it as **out of scope for Phase 18** (translate() keeps its existing `hasCloudProvider` check, unchanged) to match the roadmap's literal success criteria. Extending `translate()` to also use `hasUsableProvider` is a natural, low-risk follow-up but is not required to satisfy AIL-01 as scoped, and should be called out explicitly if planning wants to fold it in.
- Exact axios error-normalization wording for a failed local call (mirroring `providerError()`) — implementation detail, not a vision decision.
- Whether the new backend-side method is literally named `completeLocal` (mirroring the browser's `ai.api.ts` naming) — naming detail for the planner/executor.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec (prescribes the fix)
- `docs/specs/core/ai-integration.md` §6.1 (lines 158-184) — "Backend-only features can't use a local provider (the On-Premise-relevant gap)". Explicitly specifies: add a `completeLocal`-equivalent to `ai.service.ts` for the backend; `aiService.complete` dispatches to it when `provider === 'local'` AND the endpoint is reachable from the server (On-Prem case); add a `hasUsableProvider` sibling to `hasCloudProvider` in `inbox.parser.ts`; keep Cloud's hard `throw` for local unchanged.

### Roadmap / Requirements
- `.planning/ROADMAP.md` — Phase 18 section (lines 141-152): goal, dependency on Phase 16, requirement AIL-01, 3 success criteria.
- `.planning/REQUIREMENTS.md` — AIL-01 ("Backend can call a server-reachable `local` AI provider (not only the browser path)").
- `.planning/PROJECT.md` — Current Milestone v3.0 On-Premise GA section; "AI — support tool only" section (3 install modes: BYOK / Local Gemma / Vectra AI).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workspaces/src/lib/api/ai.api.ts:67-100` (`completeLocal`) — the browser-side reference implementation to mirror server-side. Exact request shape: `POST {endpoint}/v1/chat/completions` (Ollama's OpenAI-compatible surface), body `{ model, messages: [{role:'system',...}?, {role:'user', content: prompt}], stream: false, response_format:{type:'json_object'}?, max_tokens? }`. Response: `data.choices[0].message.content`. Error handling: non-ok response reads `payload.error.message` or `payload.error` string, else generic `Local model request failed ({status})`.
- `apps/api/src/domains/ai/ai.service.ts:95-118` (`completeOpenAi`) — the server-side axios + try/catch + `providerError()` pattern to mirror for the new local method (swap the request shape for the one above).
- `apps/api/src/core/config/secrets.ts:111-122` (`getDeploymentMode()`) — cached, validated read of `DEPLOYMENT_MODE`. Example gate usage at `apps/api/src/controllers/authController.ts:16-18` (`if (getDeploymentMode() === 'on-prem') {...}`) — same gating pattern to wrap the new local-dispatch branch.
- `apps/api/src/domains/ai/ai.types.ts:23-31` (`AiConfigRow`) and `ai.repository.ts:5-13,20-46` — `local_endpoint` / `local_model` columns already exist, stored plaintext (non-secret), read via `findByCompany`.
- `ai.service.ts:11-15` (`DEFAULT_MODEL`) already has `local: 'gemma3'` as the fallback model name.

### Established Patterns
- `aiService.complete()` today: `if (row.provider === 'local') { throw new AppError(400, 'Local providers are called directly from the browser, not via the server proxy.'); }` (`ai.service.ts:79-81`) — this is the exact branch to replace with the on-prem dispatch + Cloud-unchanged hard-throw.
- `inbox.parser.ts:48-50` — `if (!(await aiService.hasCloudProvider(companyId))) { return demoExtract... }` is the exact call site `hasUsableProvider` slots into (as an `||` condition or a combined gate).
- Graceful degradation is a running theme in this codebase (translate() demo fallback, inbox.parser's non-JSON degrade) — the local-provider failure path should follow the same "never block the user's core workflow on an AI failure" stance.

### Integration Points
- `apps/api/src/domains/ai/ai.service.ts` — new private method + `complete()` dispatch branch.
- `apps/api/src/domains/inbox/inbox.parser.ts` — new `hasUsableProvider`-gated condition in `extract()`.
- `apps/api/src/domains/ai/ai.repository.ts` / `ai.types.ts` — no schema changes expected; `local_endpoint`/`local_model` already exist from the original ai config work.

</code_context>

<specifics>
## Specific Ideas

No UI/visual specifics — this is a pure backend dispatch-path phase. The two locked decisions (D-01, D-02) are the specific implementation choices that came out of discussion.

</specifics>

<deferred>
## Deferred Ideas

- Extending `translate()` to also use `hasUsableProvider` / local dispatch — noted under Claude's Discretion above as a plausible low-risk follow-up, not required for AIL-01 as scoped by the roadmap. Not folded into this phase; flag for a future cleanup pass or fold in during planning if trivial.
- A live preflight/health-check endpoint for local AI config (e.g. a "Test connection" button in Settings) — came up implicitly while discussing reachability strategy but is a UI feature, not part of this backend-dispatch phase.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

</deferred>

---

*Phase: 18-backend-side-local-ai-provider*
*Context gathered: 2026-07-12*
