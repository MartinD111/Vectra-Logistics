---
phase: 12-extensibility-proof
plan: 02
subsystem: mini-programs
tags: [mini-programs, plugins, extensibility, manifest]
dependency-graph:
  requires: []
  provides: [rowCountCallout-manifest-plugin]
  affects: [apps/workspaces/src/lib/miniProgram/plugins/examples.ts]
tech-stack:
  added: []
  patterns: [declarative-manifest-plugin, sandboxed-transform-passthrough]
key-files:
  created: []
  modified:
    - apps/workspaces/src/lib/miniProgram/plugins/examples.ts
decisions:
  - "Used group: 'output' for the new plugin since it only displays a derived value and produces no new columns"
  - "Logic is a hardcoded no-op transform (`return { rows: rows };`) — proves the manifest vocabulary needs no extension for this use case"
metrics:
  duration: "~15 minutes"
  completed: 2026-07-11
---

# Phase 12 Plan 02: Row Count Callout Manifest Plugin Summary

Added a third `PluginBlockManifest` ("Row count callout") to `EXAMPLE_PLUGINS` in `examples.ts`, proving EXT-02: the declarative manifest/uiSchema vocabulary (`text`, `badge`, `{{count}}` template binding) needs no new `UiNode`/`FieldSpecType` kind and no dispatch-file edits to add a new mini-program plugin block.

## What Was Built

**Task 1 (committed, `b4b97dc`):** Added `rowCountCallout: PluginBlockManifest` with `id: 'vectra.rowcountcallout'`, `group: 'output'`, empty `settingsSchema`, a two-node `uiSchema` (`text` + `badge` using the pre-existing `{{count}}` template binding resolved by `DynamicBlockView`), and a trivial pass-through `logic.source` (`return { rows: rows };`). Appended to `EXAMPLE_PLUGINS` alongside `dedupe` and `wordCount`.

Verification performed:
- `grep -n "vectra.rowcountcallout"` and `grep -n "rowCountCallout"` both confirm the id field, const declaration, and array inclusion.
- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` passes with zero errors.
- `git diff --stat` for this commit shows exactly 1 file touched: `apps/workspaces/src/lib/miniProgram/plugins/examples.ts`. No edits to `registry.ts`, `manifest.ts`, `BlockView.tsx`, `DynamicBlockView.tsx`, or `MiniProgramBuilder.tsx`.

**Task 2 (checkpoint, not yet resolved):** The plan's second task is `type="checkpoint:human-verify" gate="blocking"` — a manual browser round-trip (Add-block list → add to program → save → reload → run in player, confirm badge shows correct row count). This requires a running dev instance of the Workspaces app and human interaction; it has NOT been performed by this agent. `auto_advance`/`_auto_chain_active` are both `false` in `.planning/config.json`, so per standard checkpoint protocol this plan pauses here for the orchestrator/user to run the manual verification steps documented in `12-02-PLAN.md`.

## Deviations from Plan

None — Task 1 executed exactly as written per the plan's exact-fields specification and `12-PATTERNS.md` analog.

## Known Stubs

None.

## Threat Flags

None — this plan's only threat-register entries (T-12-03, T-12-04, T-12-SC) are all satisfied by the trivial, hardcoded `logic.source` and pre-validated `uiSchema` node kinds; no new surface introduced beyond what the threat model already scoped.

## Self-Check: PASSED

- FOUND: apps/workspaces/src/lib/miniProgram/plugins/examples.ts (rowCountCallout present, EXAMPLE_PLUGINS updated)
- FOUND: commit b4b97dc (feat(12-02): add row count callout manifest plugin)

## Plan Status

**Incomplete — paused at checkpoint.** Task 1 of 2 complete and committed. Task 2 is a blocking human-verify checkpoint requiring a running dev instance and manual browser steps; not resolvable by an autonomous worktree agent. Orchestrator/user must run the manual verification in `12-02-PLAN.md`'s checkpoint task before this plan can be marked fully complete.
