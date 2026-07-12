# Phase 18: Backend-side Local AI Provider - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 18-backend-side-local-ai-provider
**Areas discussed:** Reachability check strategy, Local request timeout
**Areas surfaced but not selected:** Failure/fallback behavior, Scope: does translate() get local coverage too

---

## Reachability check strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Trust config (no preflight) | on-prem + provider==='local' + local_endpoint set → treat as usable. No extra network round-trip per extraction. If the endpoint is actually down, the completion call itself fails and extract() degrades to demoExtract — same as today's non-JSON-response fallback path. Matches existing hasCloudProvider (also just checks config). | ✓ |
| Live preflight ping | Before every extraction, ping the endpoint (e.g. /api/tags) to confirm reachability, then decide usable vs. demo. Adds latency + a second network call per inbox parse. | |

**User's choice:** Trust config (no preflight)
**Notes:** This also settles the (unselected) "Failure/fallback behavior" area by direct implication: since reachability isn't pre-verified, a real call failure must be caught and degrade to `demoExtract`, matching the existing non-JSON-response degrade path in `inbox.parser.ts`.

---

## Local request timeout

| Option | Description | Selected |
|--------|-------------|----------|
| 180s | CPU-bound local inference on modest on-prem hardware can be much slower than cloud APIs. Avoids false-timeout failures on first real installs, at the cost of a slower failure signal on a genuinely dead endpoint. | ✓ |
| 60s (match cloud) | Same timeout as completeOpenAi/completeGemini. Consistent across providers, but risks premature timeouts on slower local hardware for larger prompts. | |

**User's choice:** 180s
**Notes:** None.

---

## Claude's Discretion

- **`translate()` scope** — `docs/specs/core/ai-integration.md` §6.1 lists chat translate as an affected feature, but the roadmap's Phase 18 Success Criteria only names `aiService.complete()` and `inbox.parser.ts`. Not selected for discussion. Default: out of scope for Phase 18, matching the literal roadmap success criteria. Noted as a plausible low-risk follow-up.
- Exact axios error-normalization wording for a failed local call.
- Naming of the new backend-side local-completion method (e.g. `completeLocal`).

## Deferred Ideas

- Extending `translate()` to use `hasUsableProvider` / local dispatch.
- A live preflight/health-check "Test connection" UI for local AI config in Settings — out of scope for this backend-dispatch-only phase.
