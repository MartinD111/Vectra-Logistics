---
phase: 21-missing-content-blocks
plan: 02
subsystem: project-page-editor
tags: [mentions, rich-text, dompurify, content-blocks]
requires:
  - apps/workspaces/src/components/projectPage/SlashMenu.tsx (cloned container/list pattern)
  - apps/workspaces/src/lib/api/team.api.ts (teamApi.list for @person)
  - apps/workspaces/src/lib/api/projects.api.ts (projectsApi.listPages for @page)
provides:
  - apps/workspaces/src/lib/projectPage/mentionMenu.ts (buildMentionItems, filterMentionItems, MentionMenuItem)
  - apps/workspaces/src/components/projectPage/MentionMenu.tsx (MentionMenuPanel)
  - "@" inline-mention trigger in EditableRichText.tsx
affects:
  - apps/workspaces/src/components/projectPage/pageBlockViews.tsx (mention click/hover interactions, ADD_ATTR fix)
  - apps/workspaces/src/lib/projectPage/registry.tsx (ctx.projectId threading)
  - apps/workspaces/src/components/projectPage/icon.tsx (User icon added)
tech-stack:
  added: []
  patterns:
    - "Two-phase trigger detection (keydown pre-check + input-event confirmation) cloned from the existing '/' slash-command mechanism"
    - "DOMPurify ADD_ATTR allowlist extension (narrow, two keys only) at both write-path and read-path sanitize call-sites"
key-files:
  created:
    - apps/workspaces/src/lib/projectPage/mentionMenu.ts
    - apps/workspaces/src/components/projectPage/MentionMenu.tsx
  modified:
    - apps/workspaces/src/components/projectPage/EditableRichText.tsx
    - apps/workspaces/src/components/projectPage/pageBlockViews.tsx
    - apps/workspaces/src/lib/projectPage/registry.tsx
    - apps/workspaces/src/components/projectPage/icon.tsx
decisions:
  - "D-10 (locked): @person shows a hover card rather than navigating (no per-member profile route exists in this codebase); @page opens in a new tab via crossAppUrl mirroring PageTree.tsx's route pattern; @date is a no-op, styled text only"
  - "Open Question 1 (resolved per plan): @page mention search is current-project-scoped only (uses ctx.projectId), not cross-project — matches projectsApi.listPages(projectId)'s existing shape, no new endpoint needed"
metrics:
  duration: "~45min"
  completed: 2026-07-13
---

# Phase 21 Plan 02: Inline @mention (person/page/date) Summary

One-liner: Cloned the existing `/`-slash-command two-phase trigger mechanism for `@`-mentions (person/page/date), fixing the DOMPurify strip bug on both write and read paths so mention spans survive save/reload.

## What was built

**Task 1 — `mentionMenu.ts` data layer.** `buildMentionItems(query, ctx)` fetches `teamApi.list()` (person, company-scoped) and, when `ctx.projectId` is set, `projectsApi.listPages(ctx.projectId)` (page, current-project-scoped only per the plan's resolution of Open Question 1) — both filtered client-side by substring match on name/email/title and capped at 8 results each. Date parsing is pure client-side and never fetches: recognizes `today`/`tomorrow`/`yesterday`, `YYYY-MM-DD`, or anything `new Date()` can parse without producing `Invalid Date`, emitting exactly one date item. Results concatenate People → Pages → Dates. `filterMentionItems` is a documented pass-through kept for interface symmetry with `slashMenu.ts`.

**Task 2 — `MentionMenuPanel`.** An exact structural/visual clone of `SlashMenuPanel` (same `fixed z-50 w-72 rounded-xl ...` container, same `createPortal` to `document.body`, same `onMouseDown` focus-retention trick), grouped by `item.type` (People/Pages/Dates) instead of `PageBlockGroup`. Empty state: `"No matching people, pages, or dates."` exactly as specified.

**Task 3 — the trigger, DOMPurify fix, and click/hover navigation.**
- `EditableRichText.tsx` gained a parallel `pendingMention`/`mention`/`mentionQuery`/`mentionItems`/`mentionActiveIndex` state set, mirroring the existing slash state exactly (same whitespace/block-start guard, same `ArrowUp`/`ArrowDown`/`Enter`/`Tab`/`Escape` handling), mutually exclusive with the `/` menu. Since `buildMentionItems` is async (unlike the synchronous `filterSlashMenuItems`), a `useEffect` re-fetches on every `mentionQuery` change, guarded by a fetch-sequence ref (`mentionFetchSeq`) so a slower stale fetch can't clobber a newer one's results.
- `selectMentionItem` is a **new function**, not a reuse of `selectItem` — it deletes the `@query` trigger text via the same `range.setStart/setEnd/deleteContents()` idiom, then inserts a `contentEditable=false` `<span>` with `data-mention-type`/`data-mention-id` and the exact UI-SPEC class contract (`cursor-pointer hover:underline` for person/page, `cursor-default no-underline` for date), places the caret after it, and schedules a commit.
- **The DOMPurify bug fix (the plan's core "must fix"):** both `commit()` and `selectItem()` in `EditableRichText.tsx`, plus `pageBlockViews.tsx`'s `clean()` helper (the second, read-mode sanitize call-site RESEARCH.md's Pitfall 4 flagged), now call `DOMPurify.sanitize(html, { ADD_ATTR: ['data-mention-type', 'data-mention-id'] })` — a narrow, explicit allowlist extension, not a blanket attribute allow.
- `pageBlockViews.tsx`'s `RichTextView`/`ListView` gained a `projectId?: string` prop and a shared `useMentionInteractions(projectId)` hook: click delegation via `closest('[data-mention-type]')` navigates `@page` mentions to `/projects/{projectId}/pages/{pageId}` in a new tab via `crossAppUrl('workspaces', ...)` (mirroring `PageTree.tsx`'s existing route pattern), `@person` mentions show a `MentionHoverCard` (name + email, resolved via `useTeam()` against the mention's stored id) on hover, and `@date` mentions are inert.
- `registry.tsx`'s `'rich-text'`/`'list'` editor entries now pass `ctx={{ projectId: ctx.projectId }}` to `EditableRichText`, and the corresponding VIEW entries now destructure `ctx` and pass `projectId={ctx.projectId}` to `RichTextView`/`ListView` — closing the gap the interfaces excerpt called out (neither previously threaded `ctx.projectId` at all).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] Added missing `User` lucide icon to `icon.tsx`'s `MAP`**
- **Found during:** Task 2
- **Issue:** `MentionMenuPanel` renders `@person` rows with `icon: 'User'` (per Task 1's spec), but `icon.tsx`'s `PageBlockIcon` resolver had no `User` entry in its `MAP` — it would have silently fallen back to the neutral `Square` icon for every person mention row.
- **Fix:** Added `User` to both the `lucide-react` import list and the `MAP` record.
- **Files modified:** `apps/workspaces/src/components/projectPage/icon.tsx`
- **Commit:** `98f832a`

## Threat Flags

None. The plan's own `<threat_model>` (T-21-04, T-21-05, T-21-06, T-21-SC) already covers all security-relevant surface introduced by this plan (the DOMPurify `ADD_ATTR` allowlist extension at both call-sites, the accept-disposition on mention-id spoofing, and the accept-disposition on the hover card's data exposure). No new surface beyond what's already registered.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — zero errors
- `npm run build --workspace=@vectra/workspaces` — compiled successfully, all 29 routes generated
- Manual smoke test of the running dev server (`@` trigger opening the popover, mention insertion, click-navigation) was **not** performed in this execution environment — no live dev server was started. The acceptance-criteria greps confirming end-to-end wiring (ADD_ATTR at all 3 call-sites, pendingMention two call-sites, data-mention-type click handler, concrete route string, ctx.projectId threading in registry.tsx) all pass; see the grep output captured during execution.

## Self-Check: PASSED

- FOUND: apps/workspaces/src/lib/projectPage/mentionMenu.ts
- FOUND: apps/workspaces/src/components/projectPage/MentionMenu.tsx
- FOUND (modified): apps/workspaces/src/components/projectPage/EditableRichText.tsx
- FOUND (modified): apps/workspaces/src/components/projectPage/pageBlockViews.tsx
- FOUND (modified): apps/workspaces/src/lib/projectPage/registry.tsx
- FOUND (modified): apps/workspaces/src/components/projectPage/icon.tsx
- Commit 6874eae: FOUND in git log
- Commit 98f832a: FOUND in git log
- Commit c4b32ff: FOUND in git log
