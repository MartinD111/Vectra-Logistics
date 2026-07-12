---
phase: 13-cleanup-adr-park-workflowbuilder
plan: 01
subsystem: docs
tags: [docs, cleanup, adr, workspace-engine]
requires: []
provides: [workspace-engine-adr]
affects: [docs/ARCHITECTURE-WORKSPACE-ENGINE.md]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - docs/ARCHITECTURE-WORKSPACE-ENGINE.md
  modified: []
decisions:
  - "D-01 confirmed: the two settings-panel switches (BlockSettings.tsx, PageBlockSettings.tsx) remain untouched and are documented in the ADR as a permanent, intentional exception, not a TODO."
  - "D-02 sweep found zero switch-era dead code across all 6 target files (PageBlockView.tsx, BlockView.tsx, LivePageCanvas.tsx, both registry.tsx files, slashMenu.ts) — all were already fully cleaned during Phases 7-12 authorship, so no edits were made to any of them."
  - "ADR format: single flat docs/ARCHITECTURE-WORKSPACE-ENGINE.md file matching docs/DEPLOYMENT.md and docs/API.md house style (no frontmatter, no ADR Status/Decision/Consequences template), per CONTEXT.md's Claude's Discretion note — this is the first ADR in the repo, so there was no ADR-specific structure to mirror."
metrics:
  duration: ~35min
  completed: 2026-07-12
---

# Phase 13 Plan 01: Cleanup, ADR & Park WorkflowBuilder Summary

Closed out the v2.0 Engine Unification milestone by verifying the switch-statement dead code is already gone from every page/mini-program render and edit dispatch path, confirming zero leftover cruft in the six files touched across Phases 7-12, and writing a new architecture ADR (`docs/ARCHITECTURE-WORKSPACE-ENGINE.md`) documenting the resulting engine contract, native-vs-manifest split, the `keyOf` seam, palette derivation, package-promotion path, the settings-switch exception, and the explicit WorkflowBuilder deferral.

## What Was Built

### Task 1: Verify DOC-01 and sweep for switch-era dead code

Ran `rg 'switch \(block\.kind\)|switch\(block\.kind\)' apps/workspaces/src` and confirmed exactly 2 hits, both in the explicitly out-of-scope settings-panel files:
- `apps/workspaces/src/components/miniProgram/BlockSettings.tsx:27`
- `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx:16`

Read all 6 sweep-target files in full (`PageBlockView.tsx`, `BlockView.tsx`, `LivePageCanvas.tsx`, `apps/workspaces/src/lib/projectPage/registry.tsx`, `apps/workspaces/src/lib/miniProgram/registry.tsx`, `apps/workspaces/src/lib/projectPage/slashMenu.ts`) and checked for unused imports, orphaned helpers, commented-out switch-era code, and stray TODOs referencing old dispatch. **Found none** — every file was already fully migrated and clean from Phases 7-12 authorship. No edits were made to any of the 6 files (per the plan's explicit "if a file has no dead code, leave it unmodified" instruction).

This task produced no file changes and therefore no commit — it is a verification-only task, and its passing result is recorded here and reflected in the final `git diff --stat` check (Task 3).

### Task 2: Write the Workspace Engine ADR

Created `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` — a new flat markdown file matching the house style of `docs/DEPLOYMENT.md`/`docs/API.md` (no YAML frontmatter, no ADR Status/Decision/Consequences boilerplate — none exists elsewhere in this repo). Contains all 7 required `##` sections in order:

1. **Engine Contract** — `WorkspaceBlockRegistry<B, Ctx>`/`WorkspaceBlockPlugin<B, Ctx>`, citing the `Record<PageBlockKind, ...>` exhaustiveness proof (ENG-03 safety net).
2. **Native vs. Manifest Split** — the two `PluginSource` flavors and how `renderManifest` lets one generic engine serve both.
3. **The keyOf Seam** — contrasts the page registry's `(block) => block.kind` resolver against the mini-program registry's `plugin`-aware resolver, verbatim from source.
4. **Palette Derivation** — `buildPaletteItems(registry)` as the shared helper both palettes derive from (Phase 11).
5. **Package-Promotion Path** — citing `packages/{ui,auth,api-client,types,data,config}` as precedent for future app-local → shared-package graduation.
6. **Settings-Panel Switch Exception** — states the two settings switches are a permanent, intentional exception (D-01), not a TODO.
7. **Deferred: Automations WorkflowBuilder** — names WorkflowBuilder as a third parallel block/node system, explains its demo-only status, cites `.planning/PROJECT.md`'s "Five Engines" (Automation Engine, Engine #3) framing, sketches the conceptual future migration shape (D-04), and explicitly states zero code changes were made to it during this phase or the milestone.

Committed as `430f051`.

### Task 3: Final phase verification

Ran all four verification commands:
- `git diff --stat -- apps/workspaces/src/components/automations/WorkflowBuilder.tsx` → empty (zero diff, D-03 held).
- `git diff --stat 99537d8 HEAD` (phase-wide, since the plan-creation commit) → lists only `docs/ARCHITECTURE-WORKSPACE-ENGINE.md`, matching the plan's `files_modified` frontmatter (the 6 sweep files needed no edits, so they correctly do not appear).
- `cd apps/workspaces && npx tsc --noEmit` → exit 0, no errors.
- `rg 'switch \(block\.kind\)|switch\(block\.kind\)' apps/workspaces/src` → exactly 2 hits (settings panels only), reconfirmed.

All acceptance criteria passed. No commit needed for this task — it is verification-only and its result is recorded here.

## Deviations from Plan

None — plan executed exactly as written. Task 1's zero-dead-code outcome was explicitly anticipated by the plan itself ("If a file has no dead code (expected outcome for most)... leave it unmodified").

## Auth Gates

None encountered — this is a docs/verification-only phase with no external service dependencies.

## Known Stubs

None. This phase introduced no new runtime code or data flow — it is purely subtractive verification plus static documentation.

## Threat Flags

None. Per the plan's threat model, this phase introduces zero new trust boundaries, endpoints, or schema changes.

## Self-Check: PASSED

- `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` — FOUND (verified via Read tool after Write, and via `head -1` check for correct title).
- Commit `430f051` — FOUND (`git log --oneline -3` shows it at HEAD).
- `rg` switch-check — confirmed 2 hits, matching settings-panel files only, both times (Task 1 and Task 3).
- `git diff --stat 99537d8 HEAD` — confirmed only `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` changed.
- `npx tsc --noEmit` — confirmed exit 0.
- WorkflowBuilder.tsx — confirmed zero diff via `git diff --stat`.
