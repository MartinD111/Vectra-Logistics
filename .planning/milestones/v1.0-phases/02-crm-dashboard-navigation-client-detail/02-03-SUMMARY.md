---
phase: 02-crm-dashboard-navigation-client-detail
plan: 03
subsystem: frontend
tags: [nextjs, react-query, notion-canvas, crm, inline-edit]

# Dependency graph
requires:
  - phase: 02-01
    provides: client_pages table, get-or-create/update endpoints, unified client timeline endpoint
provides:
  - "/records/[clientId] client detail page: sidebar (address/notes/responsible employee) + block canvas"
  - "client-current-situation and client-timeline PageBlockKind members with working renderers"
  - "additive clientId prop on LivePageCanvas/PageBlockView/PageBlockSettings, zero regression to existing project-page block kinds"
affects: [02-04 (page-creator entry point), 03-excel-import, 05-email-sync, 06-risk-semaphore]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive optional prop widening (projectId?: string, clientId?: string) threaded through a shared component tree so a second consumer (client pages) can reuse LivePageCanvas/PageBlockView without touching any existing project-page block kind's behavior"
    - "Seed-once + 1500ms-debounce + unmount-flush autosave pattern (from projects/[id]/pages/[pageId]/page.tsx) copied verbatim for client-page canvas config, plus a second one-time seed effect for the default two-block layout on brand-new client_pages rows"
    - "Inline click-to-edit fields with ~800ms debounce-while-typing AND blur-flush (stricter than the existing PageHeader EditableTitle's blur-only commit)"

key-files:
  created:
    - apps/workspaces/src/components/projectPage/ClientCurrentSituationBlock.tsx
    - apps/workspaces/src/components/projectPage/ClientTimelineBlock.tsx
    - apps/workspaces/src/app/records/[clientId]/page.tsx
  modified:
    - apps/workspaces/src/lib/api/crm.api.ts
    - apps/workspaces/src/lib/hooks/useCrm.ts
    - apps/workspaces/src/lib/projectPage/blocks.ts
    - apps/workspaces/src/components/projectPage/LivePageCanvas.tsx
    - apps/workspaces/src/components/projectPage/PageBlockView.tsx
    - apps/workspaces/src/components/projectPage/PageBlockSettings.tsx

key-decisions:
  - "Widened PageBlockView's `projectId` prop to optional rather than adding a second parallel component tree — all existing 20+ project-only cases cast `projectId as string` at their single call site inside the switch, since those cases are unreachable without a projectId in practice (block kinds are mutually exclusive between project pages and client pages)"
  - "PageBlockSettings.tsx was NOT in the plan's declared files_modified list but required a matching signature change (projectId widened to optional) plus two new switch cases for the new block kinds' title-only settings — added under deviation Rule 3 (blocking type-safety fix), matching the existing per-kind title-input pattern used by 10+ other simple widget blocks"
  - "getClientEmails's return type was left as unknown[] per the plan's explicit allowance (only narrow if it blocks Task 2) — ClientCurrentSituationBlockView doesn't need to read individual email fields since Phase 1's stub always returns [] and the block's contract is to always show the empty state until Phase 5"

requirements-completed: [CLI-01, CLI-02, CLI-03, DET-01, DET-02, DET-03]

# Metrics
duration: ~40min
completed: 2026-07-06
---

# Phase 02 Plan 03: Client Detail Page (Sidebar + Block Canvas) Summary

**Full client detail page at `/records/[clientId]`: inline-editable sidebar (address/notes/responsible employee, D-09/D-10/D-13) plus a block canvas reusing `LivePageCanvas`/`PageBlockView` for two new client-scoped block kinds (current-situation, timeline), threaded through an additive `clientId` prop with zero regression to any existing project-page block.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-06 (approx)
- **Completed:** 2026-07-06
- **Tasks:** 3 completed
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments
- `crm.api.ts`/`useCrm.ts` extended with `ClientPage`/`ClientTimelineEntry` types and `useClientPage`, `useUpdateClientPage`, `useClientTimeline`, `useClientEmails` hooks, matching Plan 01's backend contract exactly
- Two new `PageBlockKind` union members (`client-current-situation`, `client-timeline`) registered end-to-end: type union → interface → `PAGE_BLOCK_REGISTRY` entry → `PageBlockView` dispatch case → dedicated renderer component
- `LivePageCanvas`/`PageBlockView`/`PageBlockSettings` now accept an additive optional `clientId` prop alongside the existing (now optional) `projectId`, threaded through every internal component (`SortableBlockShell`, `BlockEditor`, `SettingsPopover`) without removing `projectId` from any signature
- New `/records/[clientId]` route: two-column layout — 320px sidebar with inline click-to-edit address/notes (blur-flush + 800ms debounce autosave, inline error text on save failure) and a flat-list responsible-employee dropdown (no role grouping, per D-13) — plus a main canvas area passing `clientId` (not `projectId`) to `LivePageCanvas`
- Canvas auto-seeds a `client-current-situation` + `client-timeline` block pair exactly once on a brand-new (empty-blocks) `client_pages` row, guarded so it never re-seeds on subsequent visits
- Both new block renderers always show their mandated empty-state copy exactly as specified in the Copywriting Contract ("No emails synced yet" / "No activity yet") — the current-situation block always shows its empty state today since the Phase 1 `getClientEmails` stub always returns `[]` until Phase 5's real Outlook sync ships
- Invalid/cross-tenant client IDs surface as the "Couldn't load this client." error state (backed by the existing company_id-scoped 404 from Plan 01, per threat T-02-06) rather than crashing

## Task Commits

Each task was committed atomically:

1. **Task 1: crm.api.ts/useCrm.ts hooks + two new block kinds registered** - `cd1b69e` (feat)
2. **Task 2: additive clientId prop on LivePageCanvas/PageBlockView + two new block renderers** - `51f1205` (feat)
3. **Task 3: client detail page — sidebar (inline edit) + canvas** - `de261b6` (feat)

_No TDD tasks in this plan (autonomous, type=execute, tdd="false" on Task 3)._

## Files Created/Modified
- `apps/workspaces/src/lib/api/crm.api.ts` - Added `ClientPage`, `UpdateClientPageInput`, `ClientTimelineEntry` interfaces + `getClientPage`/`updateClientPage`/`getClientTimeline` API methods
- `apps/workspaces/src/lib/hooks/useCrm.ts` - Added `qk.clientPage`/`qk.clientTimeline`/`qk.clientEmails` key factories + `useClientPage`, `useUpdateClientPage`, `useClientTimeline`, `useClientEmails` hooks
- `apps/workspaces/src/lib/projectPage/blocks.ts` - Added `client-current-situation`/`client-timeline` to `PageBlockKind`, two new interfaces, `PageBlock` union members, and `PAGE_BLOCK_REGISTRY` entries
- `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` - `projectId` widened to optional, `clientId?: string` added and threaded through `SortableBlockShell`/`BlockEditor`/`SettingsPopover`
- `apps/workspaces/src/components/projectPage/PageBlockView.tsx` - `projectId` widened to optional, `clientId?: string` added, two new dispatch cases, existing project-only cases cast `projectId as string` at their call site
- `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx` - `projectId` widened to optional, `clientId?: string` added (unused by any current case), two new block kinds added to the existing title-only settings case group (deviation, see below)
- `apps/workspaces/src/components/projectPage/ClientCurrentSituationBlock.tsx` (new) - Current-situation block renderer; always shows "No emails synced yet" empty state today
- `apps/workspaces/src/components/projectPage/ClientTimelineBlock.tsx` (new) - Unified timeline block renderer; icon-tagged by entry type (Mail/Receipt/BarChart3), "No activity yet" empty state
- `apps/workspaces/src/app/records/[clientId]/page.tsx` (new) - Client detail page: sidebar (inline-edit fields) + canvas, auto-seed logic, loading/error states

## Decisions Made
- Cast `projectId as string` at each of the ~14 existing project-only `PageBlockView` switch cases rather than widening every individual widget component's (`PeopleView`, `StatCardsView`, etc.) prop type to optional — keeps the diff additive and localized to the three files the plan targeted, since those components are only ever reached when `projectId` is actually set (block kinds are mutually exclusive between the two canvas contexts)
- `PageBlockSettings.tsx` required the same optional-prop widening as a direct consequence of `SettingsPopover` (inside `LivePageCanvas.tsx`) now typing `projectId` as optional — added under deviation Rule 3 (blocking type-safety fix) since this file was not in the plan's declared `files_modified` list but the change was mechanically required for `tsc --noEmit` to pass
- Followed the plan's explicit guidance to leave `getClientEmails`'s return type as `unknown[]` since Task 2 didn't require narrowing it — `ClientCurrentSituationBlockView` treats the empty array as the sole rendering path or a symmetrical loading state, never reading individual fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking type error] Widened `PageBlockSettings.tsx`'s `projectId` prop to optional and added the two new block kinds to its existing title-only settings case group**
- **Found during:** Task 2, running `tsc --noEmit` after widening `LivePageCanvas`'s `SettingsPopover`/`PageBlockSettings` call site
- **Issue:** `SettingsPopover` (inside `LivePageCanvas.tsx`) now passes a `string | undefined` `projectId` to `PageBlockSettings`, which still declared `projectId: string` (required) — a straight type error blocking compilation. Additionally, `client-current-situation`/`client-timeline` block kinds fell into `PageBlockSettings`'s `default: return null` case, which is correct behavior (no dedicated settings needed beyond the span picker the canvas already renders) but was made explicit by adding both kinds to the existing "title-only" case group (matching 10+ other simple widget blocks) for consistency and to avoid relying on the implicit `default` fallthrough for a documented, intentional pattern.
- **Fix:** `projectId?: string`, `clientId?: string` added to `PageBlockSettings`'s prop type; `ProgramPicker` call sites (still project-only) use `projectId ?? ''`; two new `case` labels added to the existing title-input case group.
- **Files modified:** `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx`
- **Commit:** `51f1205`

## Issues Encountered

**Live-DB verification not possible.** Per the environment notes carried over from Plan 02-01, no Docker/Postgres daemon is reachable in this execution sandbox. This plan is pure frontend (no new SQL), so the only live-DB-dependent verification step is the plan's manual QA instruction ("visit /records/{seeded-client-id}, confirm sidebar renders... confirm canvas shows... blocks by default") — this could not be executed against a running dev server + database in this environment. All verification performed was static: `npx tsc --noEmit` (clean, zero errors across the whole `apps/workspaces` project) and manual code review against the plan's acceptance criteria (`grep`-equivalent checks on required source strings, confirmed via `Read`). The `022_client_pages.sql` migration this plan depends on (from Plan 01) still needs to be applied to the dev database before any of this can be exercised end-to-end in a browser.

## User Setup Required

None beyond what Plan 01 already flagged: `database/migrations/022_client_pages.sql` must be applied to the running dev Postgres instance before `/records/[clientId]` can be exercised end-to-end (the get-or-create page endpoint and timeline endpoint both depend on the `client_pages` table existing).

## Next Phase Readiness
- CLI-01/02/03 and DET-01/02/03 fully implemented per this plan's acceptance criteria
- D-09 through D-13 implemented per CONTEXT.md/UI-SPEC.md
- No regression to any existing project-page block kind — `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` continues to call `LivePageCanvas` with only `projectId` (no `clientId`), which remains fully backward compatible since `clientId` is optional everywhere it was threaded
- Ready for Plan 02-04 (page-creator entry point: "New client page" menu item, D-07/D-08) to link into this route
- Blocker carried over from Plan 01: `022_client_pages.sql` must run against the dev database before any browser-level QA of this plan's route is possible

## Self-Check: PASSED

All declared files verified present on disk; all 4 commit hashes (cd1b69e, 51f1205, de261b6, 6e4bfee) verified in `git log`.

---
*Phase: 02-crm-dashboard-navigation-client-detail*
*Completed: 2026-07-06*
