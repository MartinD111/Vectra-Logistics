---
phase: 12
slug: extensibility-proof
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected in `apps/workspaces` (no jest/vitest config, no `*.test.*`/`*.spec.*` files) |
| **Config file** | none — Wave 0 requirements below explain why no install is needed |
| **Quick run command** | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` |
| **Full suite command** | Manual browser verification (see Manual-Only Verifications) |
| **Estimated runtime** | ~10s (type-check) + ~2 min manual round-trip per flow |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit -p apps/workspaces/tsconfig.json`
- **After every plan wave:** Manual browser verification of the native `callout` round-trip and/or the manifest plugin round-trip (whichever this wave touches)
- **Before `/gsd:verify-work`:** Full manual verification of both success-criteria flows + `git diff --stat` scope review
- **Max feedback latency:** ~10s (type-check gives fast feedback; manual checks are the authoritative gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | EXT-01 | V5 (minor) | `callout.text` stored/rendered as plain text, not `dangerouslySetInnerHTML` | type-check | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | EXT-01 | — | Block appears in slash palette, edits inline, autosaves+reloads | manual-only | see Manual-Only Verifications | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | EXT-02 | Sandbox escape (mitigated by existing `runInSandbox`) | Manifest plugin `logic.source` stays a trivial pass-through | manual-only | see Manual-Only Verifications | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements except runtime/browser behavior. No automated test framework exists in `apps/workspaces` (no jest/vitest/playwright config found); installing one is out of scope for this small, additive phase — this is a pre-existing gap, not something to fix here.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `callout` block renders (read), appears in slash palette, edits inline, autosaves, and reloads with content intact | EXT-01 | No e2e/browser test infra exists in `apps/workspaces` | Open a project page, type `/`, select "Callout", type text, click away to save, reload the page, confirm the text persisted |
| `git diff --stat` for the feature touches only the block's own module + registry files (`lib/projectPage/blocks.ts`, `lib/projectPage/registry.tsx`, new `components/projectPage/CalloutBlock.tsx`) — zero changes to `PageBlockView`/`BlockView`/`LivePageCanvas`/`slashMenu` | EXT-01 | Procedural scope check, not a code test | Run `git diff --stat` against the base commit and confirm no unexpected files appear |
| New manifest plugin (added to `examples.ts`) renders end-to-end via the declarative path | EXT-02 | No e2e/browser test infra exists in `apps/workspaces` | Add the new plugin block to a test mini program in the builder, save, reload the builder, run it in the player, confirm output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (type-check) or Wave 0 dependencies (manual-only, justified above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (type-check runs after every task)
- [x] Wave 0 covers all MISSING references (none — gap is pre-existing and out of scope)
- [x] No watch-mode flags
- [x] Feedback latency < 15s (type-check)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11
