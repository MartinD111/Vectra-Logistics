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

**Task 2 (checkpoint, APPROVED):** The plan's second task is `type="checkpoint:human-verify" gate="blocking"` — a manual browser round-trip (Add-block list → add to program → save → reload → run in player, confirm badge shows correct row count). The user manually verified all 7 steps in a running dev instance of the Workspaces app: "Row count callout" appears in the Add-block palette (group: output) with correct title/description/icon; the block was added downstream of an input block, saved, and persisted correctly across a reload; running the program in the player rendered a badge reading "{N} rows" matching the actual dataset row count; and `git diff --stat` confirmed only `examples.ts` (plus `.planning/` files) changed. Checkpoint APPROVED.

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

**Complete.** Both tasks done: Task 1 (manifest plugin added, committed `b4b97dc`) and Task 2 (human-verify checkpoint, APPROVED by user). All must-haves satisfied:
- "Row count callout" appears in the Mini Program Builder's Add-block list with no code change to `MiniProgramBuilder.tsx`, `BlockView.tsx`, or `DynamicBlockView.tsx` — confirmed.
- Adding the plugin, saving, reloading, and running it in the player shows a badge with the current row count — confirmed.
- The plugin's logic is a trivial pass-through (no dataset mutation) — confirmed (`return { rows: rows };`).

EXT-02 proven: the declarative manifest/uiSchema vocabulary needs no extension to add a new mini-program plugin block.
