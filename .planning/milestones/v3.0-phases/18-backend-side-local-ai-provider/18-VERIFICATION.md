---
phase: 18-backend-side-local-ai-provider
verified: 2026-07-13T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 18: Backend-side Local AI Provider Verification Report

**Phase Goal:** Every AI-powered feature works on an on-prem install using only a local model — no dependency on a browser-side call path.
**Verified:** 2026-07-13 (retroactive — no VERIFICATION.md was created at execution time)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On an on-prem install with `provider='local'` and a reachable `local_endpoint` configured, `aiService.complete()` returns a real completion instead of throwing. | VERIFIED | `ai.service.ts:91-96` — `complete()` checks `getDeploymentMode() === 'on-prem' && row.local_endpoint`, dispatches to `this.completeLocal(...)` and returns its result. `completeLocal()` (lines 136-161) POSTs via axios to `${base}/v1/chat/completions` with 180s timeout and returns `{ text, provider: 'local', model }`. Confirmed by passing test `complete(): on-prem + local + local_endpoint dispatches to completeLocal via axios`. |
| 2 | On a cloud install, or on-prem with no `local_endpoint`, `complete()` still hard-throws the exact original message. | VERIFIED | `ai.service.ts:96` — fallback `throw new AppError(400, 'Local providers are called directly from the browser, not via the server proxy.')` inside the same `if (row.provider === 'local')` block, unchanged text. Confirmed by passing tests `complete(): local provider with local_endpoint set still hard-throws on cloud` and `complete(): local provider with no local_endpoint still throws AppError(400) unchanged`. Single occurrence confirmed via grep (no duplication). |
| 3 | `inbox.parser.extract()` performs real AI extraction (not `demoExtract`) on a local-only on-prem install when `hasCloudProvider` is false but `hasUsableProvider` is true. | VERIFIED | `inbox.parser.ts:48` — `const usable = (await aiService.hasCloudProvider(companyId)) || (await aiService.hasUsableProvider(companyId));` gates the demo fallback. Confirmed by passing test `extract(): hasCloudProvider false, hasUsableProvider true, complete resolves -> real extraction, demo:false` and the negative-path test proving `complete` is never called when both are false. |
| 4 | A failed local completion call inside `extract()` degrades to `demoExtract` with `demo:false`, never throws into the caller. | VERIFIED | `inbox.parser.ts:53-66` — `aiService.complete(...)` wrapped in try/catch, catch block returns `{ extraction: this.demoExtract(email), demo: false }` with an explanatory comment. Confirmed by passing test `extract(): hasUsableProvider true but complete() rejects -> degrades to demoExtract, demo:false, does not throw`. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/domains/ai/ai.service.ts` | `hasUsableProvider()`, private `completeLocal()`, on-prem dispatch branch | VERIFIED | All three present exactly as specified (lines 71-80, 91-96, 136-161). |
| `apps/api/src/domains/inbox/inbox.parser.ts` | `hasUsableProvider`-gated `extract()` with try/catch degrade | VERIFIED | Present at lines 48, 53-66. |
| `apps/api/src/domains/ai/ai.service.local-dispatch.test.ts` | on-prem dispatch + `hasUsableProvider` true-path coverage | VERIFIED | File exists, 5 tests, all pass. |
| `apps/api/src/domains/ai/ai.service.cloud-unchanged.test.ts` | cloud hard-throw-unchanged + `hasUsableProvider` false-path coverage | VERIFIED | File exists, 2 tests, all pass. |
| `apps/api/src/domains/inbox/inbox.parser.test.ts` | `extract()` gating + degrade-on-failure coverage | VERIFIED | File exists, 3 tests, all pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ai.service.ts complete()` | `ai.service.ts completeLocal()` | `row.provider === 'local' && getDeploymentMode() === 'on-prem' && row.local_endpoint` branch | WIRED | Confirmed at `ai.service.ts:91-95`; `completeLocal(` appears at method definition (line 136) and call site (line 94) — 2 matches. |
| `inbox.parser.ts extract()` | `ai.service.ts hasUsableProvider()` | OR-combined gate with `hasCloudProvider` | WIRED | Confirmed at `inbox.parser.ts:48`. |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| New phase-18 test files (10 tests) | `node --require ts-node/register --test src/domains/ai/ai.service.local-dispatch.test.ts src/domains/ai/ai.service.cloud-unchanged.test.ts src/domains/inbox/inbox.parser.test.ts` | 10/10 pass | PASS |
| Full `apps/api` test suite (regression check) | `npm test` (apps/api) | 90/90 pass | PASS |

Both commands executed live in this verification session (not sourced from SUMMARY.md claims).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AIL-01 | 18-01-PLAN.md | Backend can call a server-reachable `local` AI provider (not only the browser path), so an on-prem install gets full local-Gemma coverage of every AI feature | SATISFIED | `ai.service.ts` dispatch branch + `inbox.parser.ts` gate/degrade, both covered by passing tests. REQUIREMENTS.md line 35 and 96 mark AIL-01 as Complete, consistent with codebase evidence (not just trusted — independently verified above). |

No orphaned requirements found for Phase 18 in REQUIREMENTS.md.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|not available` across all 5 phase-18 files returned zero matches.

### Additional Verification Notes

- Commit hashes referenced in SUMMARY.md (`9db4475`, `e0a58a2`, `7b09d27`, `3f576ca`) were confirmed present in git history via `git log --oneline --all`.
- `translate()` was confirmed left untouched (still gated by `hasCloudProvider` only, line 197) — matches the explicit out-of-scope note in the plan/summary; this is a documented, intentional scope boundary, not a gap against this phase's success criteria (which only cover `complete()` and `inbox.parser.ts`).
- Cloud fallback message occurs exactly once in `ai.service.ts` (verified via source read, not just grep count claims).

### Human Verification Required

None. All success criteria are mechanically verifiable via source inspection and automated tests; no visual/UX/external-service behavior in scope for this phase.

### Gaps Summary

No gaps found. All 3 ROADMAP success criteria and all 4 PLAN must-have truths are verified against actual source code and passing automated tests (10 phase-specific + 90 full-suite, executed live in this session).

---

*Verified: 2026-07-13*
*Verifier: Claude (gsd-verifier)*
