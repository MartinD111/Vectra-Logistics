---
phase: 21-missing-content-blocks
verified: 2026-07-13T17:33:24Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 1
human_verification:
  - test: "Live @-mention popover, insertion, persistence-after-reload, and click/hover navigation"
    expected: "Mention span persists after reload; @page opens in new tab; @person shows hover card; @date is inert"
    why_human: "Requires a live dev server + browser session; not smoke-tested in 21-02's own execution per its SUMMARY.md"
  - test: "Toggle/columns nested insert, collapse/expand, reload, and nested slash-menu content-only filtering"
    expected: "Nested children persist across reload; nested insert menu shows only content-group kinds, never kanban/media widgets"
    why_human: "Requires live browser interaction to confirm isNestableItem filtering behaves correctly at runtime"
  - test: "Sub-page creation flow end-to-end (insert block -> real child page created -> appears in PageTree -> opens in new tab)"
    expected: "A real project_pages row is created via projectsApi.createPage and is clickable/navigable"
    why_human: "Requires a live API call against a real database; not exercisable via static analysis"
overrides:
  - must_have: "Decision Coverage Gate: D-01, D-04, D-05, D-06, D-07, D-08, D-09, D-11, D-13 must be literally cited by ID in PLAN.md files"
    reason: "gsd-plan-checker's independent Dimension 7 review confirmed all 9 decisions are substantively implemented (nesting mechanism in 21-05, media decisions in 21-03, mention scope in 21-02, sub-page preview in 21-04); gap is citation-format only, not a missing feature"
    accepted_by: "user (per STATE.md 2026-07-13 entry)"
    accepted_at: "2026-07-13"
---

# Phase 21: Missing Content Blocks Verification Report

**Phase Goal:** Card/page bodies get a complete generic block palette: checklist/to-do, toggle,
quote, fenced code with language picker, media blocks (image/file/video/bookmark/embed), a
simple inline table, a multi-column layout block, a sub-page link block, and inline `@mention`
(person/page/date).

**Verified:** 2026-07-13T17:33:24Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CONT-01: checklist/to-do block with checkable items | VERIFIED | `ChecklistBlock.tsx` (159 lines) exports `ChecklistView`/`ChecklistEditor` with add/remove/toggle; registered in `blocks.ts` (`'checklist'` kind, `nestable:true`) and `registry.tsx` line 162-165 |
| 2 | CONT-02: collapsible toggle block containing child blocks | VERIFIED | `ToggleBlock.tsx` (87 lines) + `NestedBlockList.tsx` (91 lines, no dnd-kit); `collapsed` persisted via `onUpdate`; wired `registry.tsx` line 202-217 with `renderChild` closure avoiding import cycle |
| 3 | CONT-03: quote block | VERIFIED | `QuoteBlock.tsx` (43 lines), clone of CalloutBlock idiom; `registry.tsx` line 166-169 |
| 4 | CONT-04: fenced code block with language selection | VERIFIED | `CodeBlock.tsx` (51 lines) — `<select>` with 9 languages + controlled `<textarea>`; `registry.tsx` line 170-173 |
| 5 | CONT-05: media blocks (image/file/video/bookmark/embed) | VERIFIED | `MediaBlocks.tsx` (320 lines) — 5 View/Editor pairs sharing `UrlInputCard`; video has YouTube/Vimeo hostname allowlist + `<video>` fallback (grep confirms no unvalidated iframe src); `registry.tsx` line 178-197 |
| 6 | CONT-06: simple inline table block | VERIFIED | `TableBlock.tsx` (192 lines) — `TableView`/`TableEditor`, add/remove row+column, contentEditable cells; `registry.tsx` line 174-177 |
| 7 | CONT-07: multi-column layout block | VERIFIED | `ColumnsBlock.tsx` (55 lines) — fixed 2-lane grid, each lane a `NestedBlockList`; `registry.tsx` line 218-233 |
| 8 | CONT-08: inline sub-page link block | VERIFIED | `SubPageBlock.tsx` (99 lines) — create-on-mount via `projectsApi.createPage`, static title+icon row, new-tab navigation, failure state added beyond plan; `PageCtx.pageId` threaded through `LivePageCanvas.tsx` and the pages route |
| 9 | CONT-09: inline @mention (person/page/date) | VERIFIED | `mentionMenu.ts` (100 lines) + `MentionMenu.tsx` (89 lines) + `@`-trigger in `EditableRichText.tsx`; DOMPurify `ADD_ATTR` fix present at both write path (`EditableRichText.tsx:115,151`) and read path (`pageBlockViews.tsx:34`); click/hover navigation wired in `pageBlockViews.tsx` (`useMentionInteractions`) |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/lib/projectPage/blocks.ts` | 12 new `PageBlockKind` union members + interfaces + registry entries | VERIFIED | All 12 kinds present (checklist, quote, code, table, image, file, video, bookmark, embed, sub-page, toggle, columns), each with interface + `PAGE_BLOCK_REGISTRY` entry |
| `apps/workspaces/src/lib/projectPage/registry.tsx` | `Record<PageBlockKind,...>` exhaustively wired | VERIFIED | Compile-time exhaustiveness proof via `Record<PageBlockKind, WorkspaceBlockPlugin<...>>`; `tsc --noEmit` passes with zero errors, meaning no kind can be missing |
| `apps/workspaces/src/lib/projectPage/slashMenu.ts` | All 12 new kinds exposed with keywords | VERIFIED | `EXTRA_KEYWORDS` entries present for all 12; `buildSlashMenuItems()` derives from `PAGE_BLOCK_REGISTRY` automatically — no manual per-kind list to fall out of sync |
| `ChecklistBlock.tsx`, `QuoteBlock.tsx`, `CodeBlock.tsx` | Substantive components | VERIFIED | 159/43/51 lines, no stub/debt markers |
| `TableBlock.tsx`, `MediaBlocks.tsx` | Substantive components | VERIFIED | 192/320 lines, no stub/debt markers |
| `SubPageBlock.tsx` | Create-on-mount + static row | VERIFIED | 99 lines, `projectsApi.createPage` reused, failure-state handling |
| `ToggleBlock.tsx`, `ColumnsBlock.tsx`, `NestedBlockList.tsx` | Nesting mechanism | VERIFIED | 87/55/91 lines; no `@dnd-kit` import (confirmed by grep), matches plan's stated anti-pattern avoidance |
| `mentionMenu.ts`, `MentionMenu.tsx` | @mention data + UI | VERIFIED | 100/89 lines; person/page/date item building present |
| `PageBlockView.tsx` | Single read-mode dispatch point (no legacy switch to regress) | VERIFIED | Thin wrapper delegating to `pageBlockRegistry.render()` — confirms no duplicate switch-statement code path exists that could drift out of sync |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `slashMenu.ts` | `PAGE_BLOCK_REGISTRY` | `buildPaletteItems(pageBlockRegistry)` | WIRED | Palette items generated from registry, not hand-listed — new kinds automatically appear in slash menu |
| `registry.tsx` entries | block components | direct import + JSX render | WIRED | All 12 new kinds import and render real View/Editor components, not placeholders |
| `LivePageCanvas.tsx` | `ToggleBlock`/`ColumnsBlock` nested children | `renderChild` closure → `pageBlockRegistry.renderEditor` | WIRED | Confirmed via grep: `renderChild` closure built in `registry.tsx`, injected into `ctx`, consumed by `NestedBlockList` |
| `LivePageCanvas.tsx` | nested insert menu filtering | `isNestableItem` / `nestableSlashItems` | WIRED | `nestableSlashItems = slashItems.filter(isNestableItem)` computed and threaded through `BlockEditor` → `ctx` |
| Project-page route (`pages/[pageId]/page.tsx`) | `SubPageBlock` | `PageCtx.pageId` | WIRED | Route's `pageId` param passed to `LivePageCanvas`, then into `ctx.pageId`, consumed by `SubPageBlockEditor` as `parent_page_id` |
| `EditableRichText.tsx` `@` trigger | `mentionMenu.ts` | async fetch + fetch-sequence guard | WIRED | `mentionFetchSeq` ref prevents stale-fetch clobbering; confirmed present in file |
| Mention span render | click/hover navigation | `pageBlockViews.tsx` `useMentionInteractions` | WIRED | `closest('[data-mention-type]')` delegation confirmed; DOMPurify `ADD_ATTR` present at all 3 sanitize call-sites (write commit, write selectItem, read clean()) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-checking across entire workspaces app | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | zero errors | PASS |
| Production build | `npm run build --workspace=@vectra/workspaces` | Compiled successfully, all 29 routes generated (including `/projects/[id]/pages/[pageId]` and `/records/[clientId]`) | PASS |
| No SSRF-risk scraping introduced in media blocks | `grep -n "fetch(" MediaBlocks.tsx` | no matches | PASS |
| Video iframe hostname allowlist present | `grep youtube.com\|youtu.be\|vimeo.com MediaBlocks.tsx` | present | PASS |
| No dnd-kit in nested mini-canvas (anti-pattern avoidance) | `grep dnd-kit\|useSortable\|SortableContext NestedBlockList.tsx` | no matches | PASS |
| No import cycle between Toggle/Columns and registry | `grep "import.*registry" ToggleBlock.tsx ColumnsBlock.tsx` | no matches | PASS |

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` across all 11 new/modified component and lib files in this phase returned zero matches.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CONT-01 | 21-01 | Checklist/to-do block | SATISFIED | `ChecklistBlock.tsx`, registry wiring |
| CONT-02 | 21-05 | Collapsible toggle block with children | SATISFIED | `ToggleBlock.tsx` + `NestedBlockList.tsx` |
| CONT-03 | 21-01 | Quote block | SATISFIED | `QuoteBlock.tsx` |
| CONT-04 | 21-01 | Fenced code block with language selection | SATISFIED | `CodeBlock.tsx` (9-language `<select>`) |
| CONT-05 | 21-03 | Media blocks (image/file/video/bookmark/embed) | SATISFIED | `MediaBlocks.tsx` (5 kinds) |
| CONT-06 | 21-03 | Simple inline table | SATISFIED | `TableBlock.tsx` |
| CONT-07 | 21-05 | Multi-column layout block | SATISFIED | `ColumnsBlock.tsx` (fixed 2-lane) |
| CONT-08 | 21-04 | Sub-page link block | SATISFIED | `SubPageBlock.tsx` + `PageCtx.pageId` threading |
| CONT-09 | 21-02 | Inline @mention (person/page/date) | SATISFIED | `mentionMenu.ts`, `MentionMenu.tsx`, `@`-trigger in `EditableRichText.tsx` |

Note: `.planning/REQUIREMENTS.md` still shows all 9 CONT-* rows as unchecked (`[ ]`) / "Pending" in its tracking table. This is a **documentation bookkeeping gap**, not a code gap — the underlying features are implemented and verified above. Recommend the orchestrator update REQUIREMENTS.md and STATE.md's stale `completed_plans: 0` / `completed_phases: 0` counters as part of phase close-out.

### Decision Coverage Override

Per STATE.md's documented 2026-07-13 override, D-01, D-04, D-05, D-06, D-07, D-08, D-09, D-11, D-13
are not literally cited by ID in the PLAN.md files but are substantively implemented:
- D-01 (nesting mechanism): `NestedBlockList.tsx` shared by toggle + columns — VERIFIED in code.
- D-04 (column count): fixed 2-lane, `create()` returns `[[], []]` — VERIFIED in `blocks.ts:524`.
- D-05 (media upload vs URL): URL-only, no upload plumbing added — VERIFIED (no `multer`/`FileUploader` import in `MediaBlocks.tsx`).
- D-06 (link-preview): static hostname+URL card, no scraping endpoint — VERIFIED (no `fetch(` in `MediaBlocks.tsx`).
- D-07 (video embed): YouTube/Vimeo iframe allowlist + `<video>` fallback — VERIFIED.
- D-08 (upload limits): N/A, no uploads implemented (consistent with D-05).
- D-09 (mention scope): all three types (person/page/date) shipped — VERIFIED in `mentionMenu.ts`.
- D-11 (mention notification): not wired (deferred, as permitted by discretion) — no notification/activity-log call found in mention selection code; this is an accepted discretionary choice, not a gap.
- D-13 (sub-page preview): static title+icon row, no live sync — VERIFIED in `SubPageBlock.tsx`.

This override is accepted per instructions and not re-flagged as a blocker.

### Human Verification Required

None identified as blocking. The following are recommended for manual UX confirmation before considering the phase fully "field-tested" (informational only, does not block phase completion since all code-level truths are verified and building/type-checking cleanly):

1. **Live `@`-mention popover and click-navigation** — Test: type `@` in a rich-text block, select a person/page/date result, reload the page, click the rendered mention. Expected: mention span persists after reload (confirms DOMPurify fix works end-to-end at runtime, not just via grep), `@page` opens in a new tab, `@person` shows hover card. Why human: requires a live dev server + browser session, which was not available in this verification environment (SUMMARY.md for 21-02 explicitly notes this was not smoke-tested).
2. **Toggle/columns nested insert + collapse/expand + reload** — Test: insert a toggle, add 2-3 nested children (of different content kinds), collapse, reload, expand. Expected: children persist, nested slash menu only shows content-group kinds (no kanban/media-widget items should leak through per D-03). Why human: requires live browser interaction to confirm the `isNestableItem` filter behaves correctly at runtime (static grep only confirms the filter function exists and is wired).
3. **Sub-page creation flow** — Test: insert a sub-page block on a real project page, confirm a new child page is created and appears in `PageTree.tsx`, click the row, confirm it opens in a new tab. Why human: requires a live API call (`projectsApi.createPage`) with a real database, not verifiable via static analysis alone.

### Gaps Summary

No blocking gaps found. All 9 CONT-* requirements have real, non-stub implementations wired end-to-end through the registry/slash-menu system; `tsc --noEmit` and `next build` both pass cleanly at HEAD with zero errors, confirming no regressions across the 5 stacked plans. The only non-code gap is stale bookkeeping in `.planning/REQUIREMENTS.md` (checkboxes/status column not updated) and `.planning/STATE.md` (progress counters not updated) — cosmetic, recommended for close-out but not a phase-goal blocker. Three items are flagged for human/live-browser confirmation as a best-practice follow-up, not because code evidence is missing.

---

_Verified: 2026-07-13T17:33:24Z_
_Verifier: Claude (gsd-verifier)_
