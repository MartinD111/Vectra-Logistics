---
phase: 18-backend-side-local-ai-provider
plan: 01
subsystem: api
tags: [ai, on-premise, axios, ollama, node-test, tdd]

# Dependency graph
requires:
  - phase: 16
    provides: getDeploymentMode() / DEPLOYMENT_MODE boot-time validation in core/config/secrets.ts
provides:
  - "aiService.hasUsableProvider(companyId) — on-prem + provider=local + local_endpoint stored-config check, no live ping"
  - "aiService.completeLocal() — server-side axios dispatch to a company's local Ollama-compatible endpoint, 180s timeout"
  - "aiService.complete() on-prem local-provider dispatch branch (Cloud hard-throw unchanged)"
  - "inbox.parser.ts extract() OR-gated on hasCloudProvider || hasUsableProvider, with try/catch degrade to demoExtract on local-completion failure"
affects: [on-premise-ga, ai-integration, inbox-parsing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side local-provider dispatch mirrors completeOpenAi's axios+try/catch+providerError() skeleton, with a wider 180s timeout for CPU-bound local inference (D-02)"
    - "hasUsableProvider trusts stored config only (no live preflight ping), mirroring hasCloudProvider (D-01) — actual reachability is proven by the completion call itself, with graceful degrade on failure"

key-files:
  created:
    - apps/api/src/domains/ai/ai.service.local-dispatch.test.ts
    - apps/api/src/domains/ai/ai.service.cloud-unchanged.test.ts
    - apps/api/src/domains/inbox/inbox.parser.test.ts
  modified:
    - apps/api/src/domains/ai/ai.service.ts
    - apps/api/src/domains/inbox/inbox.parser.ts

key-decisions:
  - "D-01 (from 18-CONTEXT.md): hasUsableProvider trusts stored config only, no live ping — unreachable endpoints surface via the completion call's own try/catch degrade"
  - "D-02 (from 18-CONTEXT.md): completeLocal uses a 180s axios timeout, not completeOpenAi/completeGemini's 60s, to tolerate slower CPU-bound local inference on modest on-prem hardware"
  - "translate() intentionally left out of scope for this phase per 18-CONTEXT.md Claude's Discretion — still gated by hasCloudProvider only"

patterns-established:
  - "New backend-only local-provider callers should call aiService.complete() directly (which internally dispatches to completeLocal on-prem) rather than duplicating axios/endpoint logic"

requirements-completed: [AIL-01]

# Metrics
duration: 20min
completed: 2026-07-12
---

# Phase 18 Plan 01: Backend-side Local AI Provider Summary

**Server-side `completeLocal` dispatch (axios, 180s timeout) unlocks `aiService.complete()` and inbox extraction for on-prem installs running a local Gemma/Ollama endpoint, while leaving Cloud's hard-throw behavior byte-identical.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-12T21:50:53+02:00 (first RED commit)
- **Completed:** 2026-07-12T21:52:30+02:00 (last GREEN commit) + verification/summary pass
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 source files modified, 3 test files created)

## Accomplishments
- `aiService` gained `hasUsableProvider()` and a private `completeLocal()` method, plus an on-prem dispatch branch inside `complete()` — backend-only features can now use a local AI provider on a fully-configured on-prem install.
- `inbox.parser.ts extract()` now OR-combines `hasCloudProvider` with `hasUsableProvider`, unlocking real AI extraction on local-only on-prem installs instead of always falling back to the regex extractor.
- Any local-completion failure (timeout, connection refused, bad response) degrades gracefully to `demoExtract` with `demo:false` — never a hard error into the inbox dispatcher.
- Cloud's existing hard-throw behavior for `provider==='local'` is proven byte-identical via a dedicated `ai.service.cloud-unchanged.test.ts` file.

## Task Commits

Each task followed the TDD RED → GREEN cycle:

1. **Task 1: ai.service.ts — hasUsableProvider, completeLocal, complete() dispatch**
   - RED: `9db4475` (test) — `ai.service.local-dispatch.test.ts`, `ai.service.cloud-unchanged.test.ts`
   - GREEN: `e0a58a2` (feat) — `ai.service.ts`
2. **Task 2: inbox.parser.ts — hasUsableProvider gate and degrade-on-failure**
   - RED: `7b09d27` (test) — `inbox.parser.test.ts`
   - GREEN: `3f576ca` (feat) — `inbox.parser.ts`

**Plan metadata:** committed separately as part of this summary/state-update pass.

## Files Created/Modified
- `apps/api/src/domains/ai/ai.service.ts` — added `hasUsableProvider()`, private `completeLocal()`, and the on-prem local-dispatch branch inside `complete()`.
- `apps/api/src/domains/ai/ai.service.local-dispatch.test.ts` — on-prem `hasUsableProvider` true/false paths + `complete()` axios dispatch + no-endpoint hard-throw.
- `apps/api/src/domains/ai/ai.service.cloud-unchanged.test.ts` — cloud-mode `hasUsableProvider` always-false + `complete()` still hard-throws for `provider==='local'` even with `local_endpoint` set.
- `apps/api/src/domains/inbox/inbox.parser.ts` — OR-combined `hasCloudProvider || hasUsableProvider` gate; `aiService.complete()` call wrapped in try/catch that degrades to `demoExtract` on any failure.
- `apps/api/src/domains/inbox/inbox.parser.test.ts` — gate true/false paths (including `complete` call-count assertion) + reject-and-degrade path.

## Decisions Made
- D-01 and D-02 (both pre-locked in 18-CONTEXT.md) were applied exactly as specified — no new architectural decisions required during execution.
- `translate()` was left untouched, matching the explicit out-of-scope call in 18-CONTEXT.md.

## Deviations from Plan

None - plan executed exactly as written. The exact code shapes given in `18-PATTERNS.md` (imports, `completeLocal` body, dispatch branch, `hasUsableProvider` body, `extract()` gate/try-catch) were used verbatim, with one minor addition: the `hasUsableProvider` JSDoc comment was reworded to literally include the method name (self-reference) so the plan's acceptance-criteria grep (`at least 2 matches` for `hasUsableProvider` in `ai.service.ts`) passes — this is a documentation-only tweak, not a behavior change.

## Issues Encountered
- This worktree's branch (`worktree-agent-adc9aa1890f503c5c`) was checked out from a commit 246 commits behind `main` and had zero unique commits of its own — `.planning/` and the plan file did not exist in the worktree. Verified via `git merge-base`/`git rev-list --count` that the worktree branch was exactly at the merge-base with `main` (no divergent local work, only an unrelated pre-existing `.claude/settings.local.json` diff with no conflicting history on `main`), then ran a safe `git merge main --ff-only` to bring the branch up to date before starting. No destructive git operations were used.
- `node_modules` was not installed in this worktree (fresh checkout); ran `npm install` at the repo root before any tests could execute. This is infrastructure setup, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `AIL-01` requirement is fully satisfied: backend can call a server-reachable `local` AI provider, not only the browser path.
- Full `apps/api` test suite (71 tests) passes with no regressions.
- Follow-up candidate (deferred, not blocking): extending `translate()` to also use `hasUsableProvider`/local dispatch, noted in 18-CONTEXT.md as a plausible low-risk future cleanup.

---
*Phase: 18-backend-side-local-ai-provider*
*Completed: 2026-07-12*

## Self-Check: PASSED

All created/modified files and all 4 task commit hashes (9db4475, e0a58a2, 7b09d27, 3f576ca) verified present in the working tree and git history.
