---
phase: 9
plan: 09-01
status: complete
completed: 2026-07-06
requirements: [RND-02, PAL-01]
---

# Phase 9 — Page Edit-Mode + Slash → Registry — Summary

**One-liner:** Moved `LivePageCanvas`'s `BlockEditor` switch onto `pageBlockRegistry.renderEditor` and re-sourced the slash menu from `pageBlockRegistry.list()`; both hand-maintained page switches are now gone. Bespoke contentEditable/slash behavior untouched.

## What was built
- New `components/projectPage/EditableHeading.tsx` — the heading contentEditable editor, extracted from `LivePageCanvas` so the registry can reference it without a cycle.
- `lib/projectPage/registry.tsx` — `entry()` gained an optional `editor`; the 4 edit kinds (rich-text, list, heading, kanban) now carry `editor` adapters that mirror the old `BlockEditor` arms exactly. Entries reordered to canonical `PAGE_BLOCK_REGISTRY` order so `list()` preserves palette order.
- `components/projectPage/LivePageCanvas.tsx` — `BlockEditor` reduced to `renderEditor(...)`; the inline `EditableHeading` definition removed. `handleSlashSelect`/`isContentItem`/`PhantomFirstBlock`/`SortableBlockShell`/`DragOverlay`/`EditableRichText` untouched.
- `lib/projectPage/slashMenu.ts` — `buildSlashMenuItems` iterates `pageBlockRegistry.list()` (skipping the hand-expanded heading/list), preserving `EXTRA_KEYWORDS` and variant expansion.

## Verification
- `npx tsc --noEmit` → 0.
- `npx next build` → 0, all 29 static pages generated. The runtime import cycle (`registry → EditableRichText → slashMenu → registry`) resolves via deferred (call-time) usage — confirmed by successful SSR static generation.
- `grep "switch (block.kind)"` in `LivePageCanvas.tsx` → 0. Only remaining page-side switch is `PageBlockSettings.tsx` (settings panel — not a render/edit path; DOC-01 does not require it).

## Notes for next phases
- **Phase 10:** mirror this for Mini Programs — new `lib/miniProgram/registry.tsx` (`keyOf` plugin→pluginId, `renderManifest`→`DynamicBlockView`), `BlockView.tsx` switch → `miniProgramBlockRegistry.render`.
- **Optional later:** fold `PageBlockSettings` into the registry `settings` slot (contract already has it) — not required by DOC-01.
- Manual browser smoke of the `/` menu (in-place transform vs insert-below) + autosave still recommended as a final human check.
