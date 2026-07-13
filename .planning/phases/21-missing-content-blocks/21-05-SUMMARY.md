---
phase: 21-missing-content-blocks
plan: 05
subsystem: project-page-block-registry
tags: [blocks, nesting, toggle, columns, registry]
requires: ["21-04"]
provides:
  - ToggleBlock (union member + non-nestable PAGE_BLOCK_REGISTRY entry + View/Editor pair)
  - ColumnsBlock (union member + non-nestable PAGE_BLOCK_REGISTRY entry + View/Editor pair)
  - NestedBlockList (shared nested mini-canvas: ordered child list, insert-only, no dnd-kit)
  - PageCtx.nestableSlashItems threading from LivePageCanvas
affects:
  - apps/workspaces/src/lib/projectPage/blocks.ts
  - apps/workspaces/src/lib/projectPage/slashMenu.ts
  - apps/workspaces/src/lib/projectPage/registry.tsx
  - apps/workspaces/src/components/projectPage/icon.tsx
  - apps/workspaces/src/components/projectPage/LivePageCanvas.tsx
  - apps/workspaces/src/components/projectPage/SlashMenu.tsx
tech-stack:
  added: []
  patterns:
    - "Nested mini-canvas without drag-and-drop: NestedBlockList uses an insert-only '+ Add block' affordance plus optional up/down move buttons instead of nesting a second dnd-kit SortableContext (avoids drop-target collisions with LivePageCanvas.tsx's top-level sortable context)"
    - "renderChild closure pattern: registry.tsx (which self-references pageBlockRegistry) builds a renderChild(child, onUpdate) => pageBlockRegistry.renderEditor(child, ctx, onUpdate) closure and passes it into ToggleBlock.tsx/ColumnsBlock.tsx's ctx — these components never import registry.tsx directly, eliminating a would-be import cycle"
    - "Persisted collapse state: ToggleBlock's collapsed field is written via onUpdate, not local useState, so it survives reload"
key-files:
  created:
    - apps/workspaces/src/components/projectPage/NestedBlockList.tsx
    - apps/workspaces/src/components/projectPage/ToggleBlock.tsx
    - apps/workspaces/src/components/projectPage/ColumnsBlock.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/lib/projectPage/slashMenu.ts
    - apps/workspaces/src/lib/projectPage/registry.tsx
    - apps/workspaces/src/components/projectPage/icon.tsx
    - apps/workspaces/src/components/projectPage/LivePageCanvas.tsx
    - apps/workspaces/src/components/projectPage/SlashMenu.tsx
decisions:
  - "Toggle and columns share one nested-children mechanism (NestedBlockList) reused verbatim for both ToggleBlock.children and each ColumnsBlock.columns[i] lane, per D-01"
  - "Nesting capped at one level (D-02) and restricted to content-group kinds (D-03) — enforced by omitting `nestable: true` on the toggle/columns registry entries themselves, so they can never appear in the nested insert menu, combined with NestedBlockList always rendering InsertBlockMenu with items={nestableItems} (never the full palette)"
  - "Columns fixed at exactly 2 lanes (D-04) — enforced by create()'s literal [[], []], not by the type"
metrics:
  duration: "~35min"
  completed: 2026-07-13
---

# Phase 21 Plan 05: Toggle and columns nesting blocks Summary

Added the two nesting content blocks that close out Phase 21 — toggle (CONT-02) and a fixed
2-column layout (CONT-07) — both built on one shared nested-rendering mechanism
(`NestedBlockList`), capped at one level of nesting and restricted to content-group children
only. This is the first time any project-page block has children, so a purpose-built
mini-canvas was created instead of reusing `LivePageCanvas.tsx`'s `@dnd-kit`-driven grid+DnD
approach, per `21-RESEARCH.md`'s explicit anti-pattern guidance (a second `SortableContext`
nested inside the page's own top-level one risks drop-target collisions).

## What Was Built

**Task 1 — Model layer + ctx wiring:** Added `'toggle'` and `'columns'` to `PageBlockKind`
and the `PageBlock` union (`ToggleBlock { title, collapsed, children: PageBlock[] }`,
`ColumnsBlock { columns: PageBlock[][] }`, fixed length 2). Both `PAGE_BLOCK_REGISTRY` entries
are deliberately created WITHOUT `nestable: true`, so `isNestableItem` (already present from a
prior plan) never lets toggle/columns appear inside their own nested insert menu — this is the
data-layer half of D-02/D-03's nesting cap. Added `EXTRA_KEYWORDS` for both kinds. In
`LivePageCanvas.tsx`, computed `nestableSlashItems = slashItems.filter(isNestableItem)` and
threaded it through `BlockEditor` into the `ctx` object passed to
`pageBlockRegistry.renderEditor`. Added `PageCtx.nestableSlashItems?: SlashMenuItem[]`.
Extended `InsertBlockMenu` with an optional `items` override (renamed to `itemsOverride`
internally to avoid shadowing the existing local `items` const) so nested insert menus can be
pre-filtered.

**Task 2 — NestedBlockList:** A shared nested mini-canvas: an ordered child list with hover
controls (delete `X`, optional up/down move buttons cloned from `KanbanBlock.tsx`'s
`moveCard` pattern) and a bottom "+ Add block" ghost button that opens `InsertBlockMenu` with
`items={nestableItems}` (never the unfiltered palette). Zero `@dnd-kit` usage anywhere in this
file — confirmed by grep.

**Task 3 — ToggleBlock/ColumnsBlock + registry wiring:** `ToggleBlock.tsx` exports
`ToggleView`/`ToggleEditor`; clicking the header row toggles `collapsed` via `onUpdate`
(persisted, not local `useState`), and when expanded renders `block.children` through
`NestedBlockList`. `ColumnsBlock.tsx` exports `ColumnsView`/`ColumnsEditor`, rendering a fixed
2-column grid, each lane a `NestedBlockList` over `block.columns[i]`. Neither component imports
`registry.tsx` — `registry.tsx` builds a `renderChild(child, onChildUpdate) =>
pageBlockRegistry.renderEditor(child, ctx, onChildUpdate)` closure (using its own
self-reference to `pageBlockRegistry`, already legal since both are defined in the same
module) and injects it into the `ctx` passed to `ToggleView`/`ToggleEditor`/`ColumnsView`/
`ColumnsEditor`, eliminating any component-to-registry import cycle. Both entries added to
`registry.tsx`'s `entries` record, closing the `Record<PageBlockKind, ...>` exhaustiveness
proof for the whole phase.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — after Task 1: single expected error
  (`registry.tsx` missing `'toggle'`/`'columns'` keys); after Task 2: **zero new errors** (same
  single expected error persisted); after Task 3: **zero errors**.
- `npm run build --workspace=@vectra/workspaces` — compiled successfully, all 29 routes
  generated (including `/projects/[id]/pages/[pageId]` and `/records/[clientId]`), no runtime
  circular-import breakage.
- `grep -n "'toggle'\|'columns'" apps/workspaces/src/lib/projectPage/blocks.ts` — union members
  + registry entries present, neither contains `nestable: true`.
- `grep -n "nestableSlashItems" apps/workspaces/src/components/projectPage/LivePageCanvas.tsx`
  — memoized filter present and threaded into the `ctx` object passed to `renderEditor`.
- `grep -n "itemsOverride" apps/workspaces/src/components/projectPage/SlashMenu.tsx` — the new
  optional param is used in place of the unconditional `buildSlashMenuItems()` call.
- `grep -n "dnd-kit\|useSortable\|SortableContext"
  apps/workspaces/src/components/projectPage/NestedBlockList.tsx` — no matches.
- `grep -n "import.*registry"
  apps/workspaces/src/components/projectPage/ToggleBlock.tsx
  apps/workspaces/src/components/projectPage/ColumnsBlock.tsx` — no matches.
- `grep -n "renderChild" apps/workspaces/src/lib/projectPage/registry.tsx` — closure built with
  `pageBlockRegistry.renderEditor(child, ctx, onChildUpdate)` at the toggle/columns entries only.
- Manual smoke test (insert toggle/columns, add nested children, collapse/expand, reload) not
  performed in this automated execution environment (no live dev server/browser available) —
  consistent with how prior plans in this phase (21-01..21-04) also deferred live-browser smoke
  tests, relying on static verification (tsc + build) to confirm the wiring compiles end-to-end.

## Deviations from Plan

**1. [Rule 1 - Bug] `Columns3` does not exist in the installed `lucide-react` version**
- **Found during:** Task 1
- **Issue:** The plan's interface spec named the icon `Columns3`, but the installed
  `lucide-react` version only exports `Columns` (and `ColumnsIcon`) — `Columns3` does not
  exist, causing `error TS2724: '"lucide-react"' has no exported member named 'Columns3'.
  Did you mean 'Columns'?`.
- **Fix:** Used `Columns` instead of `Columns3` in both `icon.tsx`'s import/`MAP` and the
  `'columns'` `PAGE_BLOCK_REGISTRY` entry's `icon` field.
- **Files modified:** `apps/workspaces/src/components/projectPage/icon.tsx`,
  `apps/workspaces/src/lib/projectPage/blocks.ts`
- **Commit:** a7db357

No other deviations — the rest of the plan (model layer, `NestedBlockList`, `ToggleBlock`,
`ColumnsBlock`, registry wiring) was executed exactly as written.

## Threat Flags

None — the plan's own `<threat_model>` (T-21-13, T-21-14) already covers the only new surface
this plan touches (deeper nesting inside the same `project_pages.config` JSONB column, and
nested contentEditable text reusing already-hardened commit patterns from earlier plans in this
phase). No new backend routes, no new authorization path, no new sanitization surface.

## Self-Check: PASSED

All claimed files verified to exist on disk (`NestedBlockList.tsx`, `ToggleBlock.tsx`,
`ColumnsBlock.tsx`, and all modified files); all claimed commit hashes (a7db357, ccf24fa,
38c13a8) verified in `git log`.
