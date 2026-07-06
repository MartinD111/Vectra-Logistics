---
phase: 8
plan: 08-01
status: complete
completed: 2026-07-06
requirements: [RND-01, RND-03]
---

# Phase 8 — Page Read-Rendering → Registry — Summary

**One-liner:** Replaced `PageBlockView`'s 30-case `switch(block.kind)` with `pageBlockRegistry.render`; extracted the per-kind views into `pageBlockViews.tsx` and repointed each registry entry's renderer at its specific view. Zero behavior change, no persisted-JSON change.

## What was built
- New `components/projectPage/pageBlockViews.tsx` — the 11 previously-local view components (Heading/RichText/List/MiniProgramEmbed/People/StatCards/KpiGrid/ChartWidget/ActivityTimeline/ProgramLink/Calendar) + helpers (`clean`, `timeAgo`, `STATUS_STYLE`) + new `DividerView`, all exported.
- `lib/projectPage/registry.tsx` — each entry's `renderer` is now a specific adapter arrow mapping `PageCtx`→props, mirroring the old switch exactly (including `projectId as string` / `clientId as string` assertions). Imports views from `pageBlockViews` + the sibling widget files. Does not import `PageBlockView` → no cycle.
- `components/projectPage/PageBlockView.tsx` — reduced to a thin wrapper: `<>{pageBlockRegistry.render(block, { projectId, clientId, onChange })}</>`. External signature unchanged, so `DragOverlay`/`PageView`/`BlockEditor` default arm are untouched.

## Verification
- `npx tsc --noEmit` → exit 0.
- `npx next build` → exit 0, including `/projects/[id]/pages/[pageId]`, `/records/[clientId]`, `/programs/[id]`.
- `grep -c "switch (block.kind)"` in `PageBlockView.tsx` → 0.

## Notes for next phases
- **Phase 9:** add `editor` entries to the 4 edit kinds (rich-text/list → `EditableRichText`; heading → `EditableHeading` (export from LivePageCanvas); kanban → `KanbanBoardView` w/ onChange). Replace `BlockEditor`'s switch with `pageBlockRegistry.renderEditor(block, {projectId, clientId, slashItems, onSlashSelect}, onUpdate)`. Re-source `buildSlashMenuItems` from `pageBlockRegistry.list()` preserving heading/list variant expansion.
- Runtime smoke (open a page, render every widget) still worth a manual pass but the production build compiling all block routes is strong evidence.
