---
phase: 21-missing-content-blocks
plan: 03
subsystem: project-page-block-registry
tags: [blocks, table, media, image, file, video, bookmark, embed, registry]
requires: ["21-01"]
provides:
  - TableBlock (union member + PAGE_BLOCK_REGISTRY entry + TableView/TableEditor)
  - ImageBlock/FileBlock/VideoBlock/BookmarkBlock/EmbedBlock (union members + registry entries + View/Editor pairs)
  - "6 new nestable:true content-group kinds"
affects:
  - apps/workspaces/src/lib/projectPage/blocks.ts
  - apps/workspaces/src/lib/projectPage/registry.tsx
  - apps/workspaces/src/lib/projectPage/slashMenu.ts
  - apps/workspaces/src/components/projectPage/icon.tsx
tech-stack:
  added: []
  patterns:
    - "Cloned CalloutBlock.tsx's contentEditable commit-on-blur idiom for table cells and media captions"
    - "Media blocks share one internal UrlInputCard sub-component for the unconfigured (!block.url) state, per kind icon injected via prop"
    - "Video block does a strict-allowlist hostname check (youtube.com/youtu.be/vimeo.com + www. variants) before ever rendering an <iframe>; any other host always falls back to a plain <video> tag"
key-files:
  created:
    - apps/workspaces/src/components/projectPage/TableBlock.tsx
    - apps/workspaces/src/components/projectPage/MediaBlocks.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/lib/projectPage/registry.tsx
    - apps/workspaces/src/lib/projectPage/slashMenu.ts
    - apps/workspaces/src/components/projectPage/icon.tsx
decisions:
  - "Bookmark/embed render a static hostname+URL card built entirely from `new URL()` client-side — no server-side og:title/og:image scraping, eliminating the SSRF surface a scraping endpoint would introduce (D-06)"
  - "Media blocks are URL-only (D-05) — no file upload path, zero backend/migration changes"
metrics:
  duration: "~30min"
  completed: 2026-07-13
---

# Phase 21 Plan 03: Table + Media blocks (image/file/video/bookmark/embed) Summary

Added the simple inline table block (CONT-06) and the five URL-only media blocks (CONT-05) —
image, file, video, bookmark, embed — following the same registry recipe as Plan 21-01,
extending the `nestable` flag to each new content-group kind. Zero new backend/API surface;
all data lives in the existing `project_pages.config` JSONB.

## What Was Built

**Task 1 — Model layer:** Added `'table' | 'image' | 'file' | 'video' | 'bookmark' | 'embed'` to
`PageBlockKind`, their block interfaces (`TableBlock { rows: string[][] }`, and
`ImageBlock`/`FileBlock`/`VideoBlock`/`BookmarkBlock`/`EmbedBlock` each `{ url: string;
caption?: string }`), matching `PAGE_BLOCK_REGISTRY` entries (all `nestable: true`, `group:
'widget'`), `EXTRA_KEYWORDS` for the slash menu, and `Table2`/`Image`/`File`/`Bookmark`/`Frame`
icon registrations (reusing the already-imported `Play` icon for video).

**Task 2 — TableBlock component:** `TableBlock.tsx` exports `TableView` (read-only `<table>`
matching UI-SPEC classes) and `TableEditor` (contentEditable cells with commit-on-blur, cloned
from `CalloutEditor`'s idiom; immutable row/column updates; hover-revealed `X` delete controls
on rows and header cells; "+ Add row"/"+ Add column" ghost buttons cloned from
`KanbanBlock.tsx`'s ghost-button styling). Wired into `registry.tsx`.

**Task 3 — MediaBlocks component:** `MediaBlocks.tsx` exports one View/Editor pair per kind
(`ImageBlockView/Editor`, `FileBlockView/Editor`, `VideoBlockView/Editor`,
`BookmarkBlockView/Editor`, `EmbedBlockView/Editor`), sharing a common `UrlInputCard` for the
unconfigured state (dashed-border card, centered icon, single URL input, client-side `new URL()`
validation with the exact UI-SPEC error copy). Configured state renders per kind: image →
`<img>`; file → a linked row with basename; video → an allowlisted YouTube/Vimeo `<iframe>` (16:9
wrapper) or a plain `<video>` fallback; bookmark/embed → a static hostname+URL card, no
server-side scraping. All Editor variants add a contentEditable caption line and a "Change URL"
reset button. Wired all five into `registry.tsx`, closing the `Record<PageBlockKind, ...>`
exhaustiveness proof for this plan.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — after Task 1: single expected error
  (registry.tsx missing all 6 new keys); after Task 2: single expected error (missing 5 media
  keys only); after Task 3: **zero errors**.
- `npm run build --workspace=@vectra/workspaces` — compiled successfully, all 29 routes generated.
- `grep -n "Add row\|Add column" TableBlock.tsx` — both present.
- `grep -n "That doesn't look like a valid link" MediaBlocks.tsx` — exact UI-SPEC copy present.
- `grep -n "youtube.com\|youtu.be\|vimeo.com" MediaBlocks.tsx` — hostname allowlist present.
- `grep -n "fetch(" MediaBlocks.tsx` — no matches, confirming no SSRF-risk scraping was introduced.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — the plan's own `<threat_model>` (T-21-07 through T-21-10) already covers every new
surface introduced by this plan (URL-rendered `<img>`/`<a>`/`<video>`/`<iframe>`, allowlisted
iframe src construction); no additional surface was found during implementation.

## Self-Check: PASSED

All claimed files verified to exist on disk; all claimed commit hashes verified in `git log`.
