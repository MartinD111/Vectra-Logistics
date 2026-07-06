---
phase: 10
plan: 10-01
status: complete
completed: 2026-07-06
requirements: [MPG-01, MPG-02]
---

# Phase 10 — Mini Program onto the Engine — Summary

**One-liner:** Replaced `BlockView`'s 15-case switch with `miniProgramBlockRegistry.render`, an instance of the same `WorkspaceBlockRegistry` class the pages use. Plugin blocks resolve by `pluginId` to `DynamicBlockView` via the `renderManifest` hook.

## What was built
- New `components/miniProgram/miniProgramBlockViews.tsx` — the 11 player-side views + helpers (`clean`, `useDatasetFor`), extracted and exported.
- New `lib/miniProgram/registry.tsx` — `miniProgramBlockRegistry`: `keyOf` maps native blocks by `kind` and `plugin` blocks by `pluginId`; static entries `Record<Exclude<BlockKind,'plugin'>, …>` reuse `blockDef()` metadata + `create()`; `code`/`columns`/`transform` use an `Invisible` renderer; `renderManifest` → `DynamicBlockView`. `MiniProgramCtx` is empty (renderers use `useRuntime()`).
- `components/miniProgram/BlockView.tsx` — thin wrapper: `<>{miniProgramBlockRegistry.render(block, {})}</>`.

## Verification
- `npx tsc --noEmit` → 0.
- `npx next build` → 0, 29/29 static pages (incl. `/programs/[id]`, `/programs/[id]/run`).
- `grep "switch (block.kind)"` in `BlockView.tsx` → 0. Both `pageBlockRegistry` and `miniProgramBlockRegistry` are instances of `WorkspaceBlockRegistry`.

## Notes for next phases
- **Phase 11:** add `lib/workspaceEngine/palette.ts` `buildPaletteItems(registry)`; wire page slash menu + mini-program builder add-menu (currently `BLOCK_REGISTRY` + `usePlugins()`) to derive from it. Keep the two UX surfaces separate.
- The `plugin` kind is intentionally not a static registry entry (resolved via pluginId → renderManifest); Phase 11's palette must still surface plugin blocks (from `usePlugins()`) — do not lose that path.
