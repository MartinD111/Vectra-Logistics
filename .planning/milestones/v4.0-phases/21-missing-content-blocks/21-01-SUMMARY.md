---
phase: 21-missing-content-blocks
plan: 01
subsystem: project-page-block-registry
tags: [blocks, checklist, quote, code, nestable, registry]
requires: []
provides:
  - ChecklistBlock (union member + PAGE_BLOCK_REGISTRY entry + components)
  - QuoteBlock (union member + PAGE_BLOCK_REGISTRY entry + components)
  - CodeBlock (union member + PAGE_BLOCK_REGISTRY entry + components)
  - "nestable?: boolean flag on PageBlockDef, correctly set on 8 content-group kinds"
  - isNestableItem() helper in slashMenu.ts
affects:
  - apps/workspaces/src/lib/projectPage/blocks.ts
  - apps/workspaces/src/lib/projectPage/registry.tsx
  - apps/workspaces/src/lib/projectPage/slashMenu.ts
  - apps/workspaces/src/components/projectPage/icon.tsx
tech-stack:
  added: []
  patterns:
    - "Cloned CalloutBlock.tsx's exact contentEditable commit-on-blur idiom for QuoteBlock"
    - "Cloned KanbanBlock.tsx's editable=!!onChange dual-mode + immutable-array-update pattern for ChecklistBlock"
    - "CodeBlock uses a controlled <textarea> (not contentEditable) for monospace code, per RESEARCH.md recommendation"
key-files:
  created:
    - apps/workspaces/src/components/projectPage/ChecklistBlock.tsx
    - apps/workspaces/src/components/projectPage/QuoteBlock.tsx
    - apps/workspaces/src/components/projectPage/CodeBlock.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/lib/projectPage/registry.tsx
    - apps/workspaces/src/lib/projectPage/slashMenu.ts
    - apps/workspaces/src/components/projectPage/icon.tsx
decisions:
  - "ChecklistView supports an optional onChange prop so item-toggling works outside edit mode too (per UI-SPEC's page-level toggle requirement), mirroring KanbanBoardView's dual-mode pattern"
  - "nestable flag lives on PageBlockDef, not on PageBlockGroup — group already means transform-in-place eligibility; nestable is a separate, orthogonal concern per RESEARCH.md Pitfall 5"
metrics:
  duration: "~35min"
  completed: 2026-07-13
---

# Phase 21 Plan 01: Checklist, Quote, Code blocks + nestable flag Summary

Added three new content-group block kinds (checklist/to-do, quote, fenced code with a language picker) to the existing `PageBlock` union / `PAGE_BLOCK_REGISTRY` / `pageBlockRegistry` system, and introduced the `nestable?: boolean` flag on `PageBlockDef` that later plans (toggle/columns nesting, 21-05) will filter on.

## What Was Built

**Task 1 — Model layer:** Added `'checklist' | 'quote' | 'code'` to `PageBlockKind`, their block interfaces (`ChecklistItem`/`ChecklistBlock`, `QuoteBlock`, `CodeBlock`), matching `PAGE_BLOCK_REGISTRY` entries, and a `nestable?: boolean` field on `PageBlockDef` — set `true` on the 3 new kinds plus the 5 pre-existing content-group kinds (`heading`, `rich-text`, `list`, `divider`, `callout`). Added `isNestableItem()` to `slashMenu.ts` (reads `pageBlockDef(item.kind)?.nestable`, not `item.group`, per RESEARCH.md Pitfall 5 — sub-page/media/table will be `'widget'`-grouped in later plans but ARE nestable). Registered `CheckSquare`, `Quote`, `Code2` icons in `icon.tsx`'s `MAP`.

**Task 2 — Checklist + Quote components:** `ChecklistBlock.tsx` exports `ChecklistView` (read mode, with an optional `onChange` for page-level item toggling) and `ChecklistEditor` (full add/remove/toggle/edit), cloning `KanbanBlock.tsx`'s immutable-array-update and `AddCardInput` idioms, and `CalloutEditor`'s contentEditable commit-on-blur idiom for item text. `QuoteBlock.tsx` is a direct clone of `CalloutBlock.tsx`'s structure with a neutral (no background) `border-l-4` container per UI-SPEC. Both wired into `registry.tsx`'s `entries` record.

**Task 3 — Code block:** `CodeBlock.tsx` exports `CodeView`/`CodeEditor` — a `bg-gray-50`/`border` container with a header strip holding a native `<select>` language picker (9 languages, default "Plain text") and a controlled `<textarea>` body (not contentEditable, per RESEARCH.md's recommendation that monospace text is easier to manage as plain text). No syntax highlighting (Assumption A1 — satisfies CONT-04's literal wording without a new dependency). Wired into `registry.tsx`, completing the `Record<PageBlockKind, ...>` exhaustiveness proof.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — after Task 1: single expected error (registry.tsx missing `code`/`checklist`/`quote` keys); after Task 2: single expected error (missing `code` only); after Task 3: **zero errors**.
- `npm run build --workspace=@vectra/workspaces` — compiled successfully, all 29 routes generated.
- All plan acceptance criteria (grep counts for `'checklist'`, `nestable`, `isNestableItem`, icon registrations) verified directly.

## Deviations from Plan

None — plan executed exactly as written. One minor sequencing adjustment (not a deviation from result, only from literal task-file order): the `CodeBlock` import/entry was added to `registry.tsx` only in Task 3 (not speculatively in Task 2), keeping each task's commit buildable independently at the expected intermediate `tsc` error state described in each task's acceptance criteria.

## Worktree Note

This worktree branch (`worktree-agent-a9b3dcf7c1daed148`) was checked out 12 commits behind `main` with zero unique commits (exactly at the merge-base) — `.planning/phases/21-missing-content-blocks/` didn't exist in the worktree at session start. Resolved with a safe `git merge main --ff-only` before execution began (no destructive operations, no conflicts) — same class of issue previously seen and documented at Phase 18 (see STATE.md → Blockers/Concerns).

## Self-Check: PASSED

All claimed files verified to exist on disk; all claimed commit hashes verified in `git log`.
