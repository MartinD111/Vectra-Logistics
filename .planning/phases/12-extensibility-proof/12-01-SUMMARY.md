---
phase: 12-extensibility-proof
plan: 01
subsystem: ui
tags: [react, nextjs, workspace-engine, project-pages, block-registry]

# Dependency graph
requires:
  - phase: 11-palette-derivation-unification
    provides: WorkspaceBlockRegistry / WorkspaceBlockPlugin engine, buildPaletteItems() derivation
provides:
  - A new native `callout` page block proving EXT-01 (add a native block = blocks.ts + registry.tsx + one component file, zero dispatch-file edits)
affects: [12-02, extensibility-proof-adr]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native page block extensibility contract confirmed: PageBlockKind union member + interface in blocks.ts, PAGE_BLOCK_REGISTRY metadata entry, one registry.tsx entries[] key wired to a new component file — no edits to PageBlockView.tsx, LivePageCanvas.tsx, slashMenu.ts, BlockView.tsx, icon.tsx, or PageBlockSettings.tsx"

key-files:
  created:
    - apps/workspaces/src/components/projectPage/CalloutBlock.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/lib/projectPage/registry.tsx

key-decisions:
  - "CalloutBlock has no `tone` field — single info-blue tone only, per UI-SPEC.md (supersedes 12-RESEARCH.md's earlier `tone` suggestion)"
  - "Task 4 checkpoint (manual browser round-trip) approved by user in their own dev instance — all 7 verification steps passed"

patterns-established:
  - "CalloutEditor reuses the exact uncontrolled-contentEditable + focus-guard pattern from EditableHeading.tsx (no caret jump on re-render while typing)"

requirements-completed: [EXT-01]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 12 Plan 01: Native Block Extensibility Proof (Callout) Summary

**Added a `callout` native page block by touching only blocks.ts (union + interface + registry metadata), registry.tsx (one dispatch entry), and one new component file — proving EXT-01's "add a block = one plugin entry" claim for native blocks; `tsc --noEmit` passes, `git diff --stat` is scoped to exactly 3 files, and the manual browser round-trip was verified and approved by the user.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-11
- **Tasks:** 4 of 4 complete
- **Files modified:** 3 (2 edited, 1 created)

## Accomplishments
- `CalloutBlock` type added to `PageBlockKind`/`PageBlock` unions and `PAGE_BLOCK_REGISTRY` in `blocks.ts` (Task 1) — confirmed this alone breaks `tsc` (ENG-03 exhaustiveness proof), as expected
- `CalloutBlock.tsx` created with `CalloutView` (read) and `CalloutEditor` (edit, uncontrolled contentEditable copied verbatim from `EditableHeading.tsx`'s focus-guard pattern) (Task 2)
- `registry.tsx` wired with a `'callout'` entry; `tsc --noEmit -p apps/workspaces/tsconfig.json` now passes with zero errors (Task 3)
- `git diff --stat` from the pre-Task-1 commit to HEAD shows exactly 3 files touched: `blocks.ts`, `registry.tsx`, `CalloutBlock.tsx` — no dispatch file (`PageBlockView.tsx`, `LivePageCanvas.tsx`, `slashMenu.ts`, `BlockView.tsx`, `icon.tsx`, `PageBlockSettings.tsx`) was edited
- Task 4 checkpoint approved: user manually verified in a running dev instance that "Callout" appears in the slash menu with correct description/icon, inserts an info-blue box, is editable with no caret jumping, persists on blur and reload, and confirmed the file scope

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CalloutBlock type + registry metadata to blocks.ts** - `3e49746` (feat)
2. **Task 2: Create CalloutBlock.tsx (CalloutView + CalloutEditor)** - `f3809c8` (feat)
3. **Task 3: Wire the 'callout' registry entry in registry.tsx** - `b0885d8` (feat)
4. **Task 4: Checkpoint — manual round-trip verification** - no code changes; approved by user

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `apps/workspaces/src/lib/projectPage/blocks.ts` - Added `'callout'` union member, `CalloutBlock` interface (`kind` + `text` only, no `tone`), and `PAGE_BLOCK_REGISTRY` entry (title "Callout", icon `MessagesSquare`, description "A highlighted note or tip.")
- `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` - New file: `CalloutView` (info-blue box, `MessagesSquare` icon, plain `block.text`) and `CalloutEditor` (uncontrolled contentEditable, focus-guarded `useEffect`, `onBlur` commits trimmed text)
- `apps/workspaces/src/lib/projectPage/registry.tsx` - Added `CalloutBlock` type import, `CalloutView`/`CalloutEditor` value import, and `'callout': entry(...)` key in the `entries` Record

## Decisions Made
- No `tone` field on `CalloutBlock` — the block is fixed to a single info-blue visual tone, config-free, per `12-UI-SPEC.md`. This intentionally supersedes an earlier `tone` suggestion in `12-RESEARCH.md`.

## Deviations from Plan

None - all 4 tasks executed exactly as written. All acceptance criteria (grep checks, `tsc --noEmit`, `git diff --stat` scoping, and the manual 7-step round-trip) verified and passed.

## Issues Encountered

**Worktree branch was stale relative to `main`** — this worktree's branch (`worktree-agent-a32e82493c2e9426e`) was created before several `.planning/` commits (Phase 12 planning docs, including `12-01-PLAN.md` itself) landed on `main`. Merged `main` into the worktree branch (fast-forward-safe, non-destructive `git merge main --no-edit`) before the plan file was even readable. This is an environment/setup issue, not a plan deviation — no plan files or task code were affected.

**Task 4 (checkpoint) could not be automated in-sandbox:** this sandboxed worktree execution environment has no Docker/Docker Compose available (`docker --version` produced no output), so the full stack (Postgres, Redis, `apps/api`, `apps/workspaces`) could not be started here to serve the manual browser verification steps. Static verification (grep checks, `tsc --noEmit`, `git diff --stat` scoping) all passed in-sandbox; the interactive slash-menu / contentEditable / reload round-trip was completed and approved by the user in their own running dev environment.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All 4 tasks complete, committed, and verified (automated: `tsc --noEmit` zero errors, `git diff --stat` exactly 3 files; manual: user-approved 7-step browser round-trip). EXT-01 (native block extensibility) is proven. No blockers for 12-02, which has no `depends_on` relationship to 12-01 per the plan frontmatter (`depends_on: []`).

---
*Phase: 12-extensibility-proof*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 3 modified/created code files and the SUMMARY.md file exist on disk; all 4 referenced commit hashes (3e49746, f3809c8, b0885d8, 8b29812) are present in git history.
