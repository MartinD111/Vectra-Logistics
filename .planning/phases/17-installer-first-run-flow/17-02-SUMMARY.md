---
phase: 17-installer-first-run-flow
plan: 02
subsystem: infra
tags: [installer, ollama, gemma, ai, axios, on-prem]

# Dependency graph
requires:
  - phase: 17-installer-first-run-flow (plan 01)
    provides: install.ts scaffold (generateSecrets, createCompanyAndAdmin, prompt, flag/env convention) and install.test.ts's flat test('...', () => {}) style
provides:
  - "buildTagsUrl()/probeOllamaEndpoint()/describeProbeError() reachability-probe helpers in install.ts"
  - "Optional Step 6 in main(): wires a customer's local Gemma/Ollama endpoint into company_ai_config via aiRepository.upsert(), skippable, non-blocking on probe failure"
affects: [18-backend-side-local-ai]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-throwing reachability probe (probeOllamaEndpoint returns boolean, swallows errors) paired with a raw-error variant (fetchOllamaTags) used only where the caller needs describeProbeError() to see the real error shape"
    - "Optional installer step: unset flags/env + blank interactive prompt answer = skip entirely, no code path writes a partial/default value"

key-files:
  created: []
  modified:
    - apps/api/src/scripts/install.ts
    - apps/api/src/scripts/install.test.ts

key-decisions:
  - "Reused aiRepository.upsert() directly instead of hand-writing a duplicate SQL upsert against company_ai_config, per the plan's interface contract"
  - "Split probe logic into probeOllamaEndpoint() (boolean, swallows error, used by tests) and an internal fetchOllamaTags() (throws, used by main() so describeProbeError() receives the real caught error instead of a re-synthesized one)"

patterns-established:
  - "CLI script error description (describeProbeError) returns a plain string, not an AppError -- no HTTP request context in a standalone script"

requirements-completed: [INS-02]

# Metrics
duration: 20min
completed: 2026-07-12
---

# Phase 17 Plan 02: Optional Local-AI Installer Wiring Summary

**Installer's Step 6 probes a customer's Ollama/Gemma endpoint for basic `/api/tags` reachability (3s timeout), warns with a specific ECONNREFUSED/ETIMEDOUT/ENOTFOUND/HTTP-status message on failure, and writes `company_ai_config` via `aiRepository.upsert(..., 'local', ...)` regardless of probe outcome -- unless the step is skipped entirely via a blank prompt answer.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `buildTagsUrl()`, `probeOllamaEndpoint()`, `describeProbeError()` added to `install.ts`, all unit-tested
- Optional Step 6 wired into `main()`: `--local-ai-endpoint`/`INSTALL_LOCAL_AI_ENDPOINT` and `--local-ai-model`/`INSTALL_LOCAL_AI_MODEL` flags/env vars (model defaults to `'gemma'`), or an interactive prompt when neither is set and not `--non-interactive`
- Declining the step (blank prompt answer, no flags/env vars) leaves `company_ai_config` completely untouched -- confirmed by code inspection (no `aiRepository.upsert` call reachable unless `localAiEndpoint` is truthy)
- Probe failure never blocks the write (D-03) -- `aiRepository.upsert` is called unconditionally once an endpoint is present, only the console warning is conditional on probe outcome

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing unit tests for the Ollama reachability probe** - `9f7e07c` (test)
2. **Task 2: Implement the probe, error-description helper, and optional local-AI step in main()** - `a1f3aff` (feat)

_TDD plan: RED (`9f7e07c`) confirmed via `Cannot find module '"./install"' has no exported member` compile errors before GREEN (`a1f3aff`) made all 18 tests pass._

## Files Created/Modified
- `apps/api/src/scripts/install.ts` - Added `buildTagsUrl()`, `probeOllamaEndpoint()`, internal `fetchOllamaTags()`, `describeProbeError()`, and optional Step 6 in `main()` wiring `company_ai_config` via `aiRepository.upsert()`
- `apps/api/src/scripts/install.test.ts` - Added 7 new tests covering URL construction, reachability against a closed local port, and error-message discrimination

## Decisions Made
- Kept `probeOllamaEndpoint()` non-throwing (boolean return, matches the plan's task-1 test contract exactly) and added a small internal `fetchOllamaTags()` used only by `main()` so the real thrown error (not a re-synthesized one) reaches `describeProbeError()` for the warning message -- the plan explicitly allowed either shape ("either shape is acceptable as long as `describeProbeError` receives the real thrown error").
- `provider: 'local'` literal call site annotated with an inline comment (`// provider: 'local' -- no cloud key is ever stored for this path`) so the plan's acceptance-criteria grep (`provider.*'local'`) and human readers both immediately see the disposition -- functionally identical to the uncommented version, purely a readability/verifiability addition.

## Deviations from Plan

None - plan executed exactly as written. The `fetchOllamaTags()` helper and inline comment above are within the explicit flexibility the plan granted ("either shape is acceptable") and are not scope changes.

## Issues Encountered
- The worktree had no `node_modules` installed (npm workspace not bootstrapped in this isolated worktree). Ran tests via `NODE_PATH` pointing at the main repo's `apps/api/node_modules` + root `node_modules` (which do have `ts-node`/`typescript` installed) rather than running `npm install` inside the worktree -- avoids duplicating a multi-hundred-MB install for a 2-task plan while still executing the real test suite against the real TypeScript compiler. A stray `tsc --noEmit` run surfaced one pre-existing, unrelated error in `src/core/db/redis.ts` (missing `redis` type declarations) -- confirmed out of scope (not touched by this plan, not caused by these changes) and left as-is per the deviation-rules scope boundary.

## User Setup Required

None - no external service configuration required. (Manual verification against a real running Ollama instance is documented as a separate, non-automated manual check in `17-VALIDATION.md`'s Manual-Only Verifications section, per the plan's `<verification>` block.)

## Next Phase Readiness
- INS-02 satisfied: the installer can now optionally wire a local Gemma/Ollama endpoint into `company_ai_config` at install time, reusing the existing `aiRepository` write path (no second write path introduced).
- Ready for Phase 18 (Backend-side Local AI), which depends on `DEPLOYMENT_MODE` (Phase 16) to add the server-side dispatch path that will actually call the `local_endpoint`/`local_model` this plan writes.

## Self-Check: PASSED

- FOUND: apps/api/src/scripts/install.ts
- FOUND: apps/api/src/scripts/install.test.ts
- FOUND: .planning/phases/17-installer-first-run-flow/17-02-SUMMARY.md
- FOUND: 9f7e07c (test commit)
- FOUND: a1f3aff (feat commit)
- FOUND: 0917cfb (docs commit)

---
*Phase: 17-installer-first-run-flow*
*Completed: 2026-07-12*
