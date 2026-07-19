---
phase: 21-missing-content-blocks
plan: 04
subsystem: project-page-block-registry
tags: [blocks, sub-page, nesting, registry]
requires: ["21-03"]
provides:
  - SubPageBlock (union member + PAGE_BLOCK_REGISTRY entry + View/Editor pair)
  - PageCtx.pageId threading from the project-page route through LivePageCanvas
affects:
  - apps/workspaces/src/lib/projectPage/blocks.ts
  - apps/workspaces/src/lib/projectPage/registry.tsx
  - apps/workspaces/src/lib/projectPage/slashMenu.ts
  - apps/workspaces/src/components/projectPage/LivePageCanvas.tsx
  - apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx
tech-stack:
  added: []
  patterns:
    - "Async-side-effect block: create() stays synchronous per the PageBlockDef contract (returns a placeholder with pageId: null); the actual network call (page creation) runs inside the block's own Editor component on mount, guarded by a useRef flag to survive React 18 strict-mode double-invoke"
    - "Static title+icon row cloned from PageTree.tsx's existing Link pattern — no live content preview/sync (per D-13)"
key-files:
  created:
    - apps/workspaces/src/components/projectPage/SubPageBlock.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/lib/projectPage/registry.tsx
    - apps/workspaces/src/lib/projectPage/slashMenu.ts
    - apps/workspaces/src/components/projectPage/LivePageCanvas.tsx
    - apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx
decisions:
  - "Sub-page insert always creates a brand-new empty child page — no 'link an existing page' picker (D-12)"
  - "Rendered row is static (title + icon, set once at creation) — no live sync if the sub-page is later renamed elsewhere (D-13)"
metrics:
  duration: "~20min"
  completed: 2026-07-13
---

# Phase 21 Plan 04: Sub-page link block Summary

Added the sub-page link block (CONT-08). Inserting it via the slash menu always creates a
brand-new, empty child page by reusing `projectsApi.createPage` + `parent_page_id` nesting
verbatim (no existing-page picker, per D-12), and renders a static title+icon row that
navigates to the created page on click (no live content preview, per D-13). This is the only
content block in the phase whose `create()` factory cannot be purely synchronous — resolved by
having `create()` return an unconfigured placeholder (`pageId: null`) synchronously, with the
actual page-creation side effect performed by the block's own Editor component on mount.

## What Was Built

**Task 1 — Model layer:** Added `'sub-page'` to `PageBlockKind`, the `SubPageBlock { pageId:
string | null; title: string }` union member, a `nestable: true` `PAGE_BLOCK_REGISTRY` entry
(reusing the already-imported `FileText` icon), `EXTRA_KEYWORDS` for the slash menu, and
`PageCtx.pageId?: string` on the registry's context interface.

**Task 2 — SubPageBlock component:** `SubPageBlock.tsx` exports `SubPageBlockView` and
`SubPageBlockEditor`. The Editor, on mount, guards on `ctx.projectId` first — if absent (the
client-detail canvas, `/records/[clientId]`, which has no project context), renders a static
grayed disabled row ("Sub-pages aren't available here") and never attempts creation. Otherwise
it calls `projectsApi.createPage(ctx.projectId, { title: 'Untitled', parent_page_id: ctx.pageId
?? null })` inside a `useEffect` guarded by a `useRef` "already creating" flag (prevents a
double page-create on React 18 strict-mode's dev double-invoke), rendering a `Loader2` spinner
row while pending. On success, `onUpdate` sets `block.pageId`/`block.title` from the created
page. Once `pageId` is set, both View and Editor render the same static row (cloned from
`PageTree.tsx`'s link pattern): `FileText` icon + bold title + `ExternalLink` icon fading in on
hover, opening the created page in a new tab. Wired into `registry.tsx`, closing the
`Record<PageBlockKind, ...>` exhaustiveness proof.

**Task 3 — PageCtx.pageId threading:** `LivePageCanvas` now accepts a `pageId?: string` prop
and forwards it into both `BlockEditor`'s own props and the `ctx` object passed to
`pageBlockRegistry.renderEditor(...)`. The project-page route
(`app/projects/[id]/pages/[pageId]/page.tsx`) passes its existing `pageId` route param through.
`app/records/[clientId]/page.tsx` (client-detail canvas) was deliberately left unmodified — it
has no `project_pages` row to be a parent of, so `ctx.pageId` (and `ctx.projectId`) correctly
stay `undefined` there, which is exactly the signal `SubPageBlockEditor` uses to show the
disabled state.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — after Task 1: single expected error
  (`registry.tsx` missing the `'sub-page'` key); after Task 2: **zero errors**; after Task 3:
  **zero errors**.
- `npm run build --workspace=@vectra/workspaces` — compiled successfully, all 29 routes
  generated (including `/projects/[id]/pages/[pageId]` and `/records/[clientId]`).
- `grep -n "'sub-page'" apps/workspaces/src/lib/projectPage/blocks.ts` — union member + registry
  entry present, `nestable: true`.
- `grep -n "createPage(" apps/workspaces/src/components/projectPage/SubPageBlock.tsx` — reused
  `projectsApi.createPage` call, guarded by `creatingRef`.
- `grep -n "aren't available here" apps/workspaces/src/components/projectPage/SubPageBlock.tsx`
  — no-projectId disabled-state copy present.
- `git diff --stat` for this plan confirms `apps/workspaces/src/app/records/[clientId]/page.tsx`
  was not touched.
- Manual smoke test not performed in this automated session (no live dev server/browser
  available in this execution environment) — static verification (tsc + build) confirms the
  wiring compiles and type-checks end-to-end; a live click-through (insert block → confirm real
  child page created → click row → opens in new tab) is recommended before/during rollout,
  consistent with how prior plans in this phase (21-01..21-03) also deferred live-browser
  smoke tests.

## Deviations from Plan

None — plan executed exactly as written. One addition beyond the plan's explicit `<action>`
text: `SubPageBlockEditor` also handles a page-creation *failure* case (network/API error)
with a small red-bordered error row ("Couldn't create the sub-page…") rather than leaving the
loading spinner stuck forever — classified as **Rule 2 (auto-add missing critical
functionality)**, since an unhandled promise rejection would otherwise leave the block
permanently in the loading state with no way to recover or understand what happened.

**1. [Rule 2 - missing error handling] Added a failure state to SubPageBlockEditor**
- **Found during:** Task 2
- **Issue:** The plan's action only specified the happy path (create → onUpdate) and the
  no-projectId guard; a `createPage` rejection (network error, 403, etc.) was unhandled and
  would leave the loading spinner rendered forever with no operator feedback.
- **Fix:** Added a `failed` state set in the `.catch()` handler, rendering a distinct red
  error row instead of an infinite spinner.
- **Files modified:** `apps/workspaces/src/components/projectPage/SubPageBlock.tsx`
- **Commit:** 4f9613a

## Threat Flags

None — the plan's own `<threat_model>` (T-21-11, T-21-12) already covers the only new surface
this plan touches (`createPage` reuse via block insert); no additional surface was found during
implementation. No new backend routes, no new authorization path.

## Self-Check: PASSED

All claimed files verified to exist on disk (`SubPageBlock.tsx`, and all modified files);
all claimed commit hashes verified in `git log`.
