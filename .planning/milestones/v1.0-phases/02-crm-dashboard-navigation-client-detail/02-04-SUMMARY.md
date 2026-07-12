---
phase: 02-crm-dashboard-navigation-client-detail
plan: 04
subsystem: frontend
tags: [nextjs, react-query, notion-canvas, crm, get-or-create]

# Dependency graph
requires:
  - phase: 02-01
    provides: client_pages table, idempotent get-or-create client page endpoint (crmApi.getClientPage)
  - phase: 02-03
    provides: "/records/[clientId] client detail page route to open into"
provides:
  - "NewClientPageModal: search-existing/quick-create picker with get-or-create-then-open flow"
  - "\"New client page\" toolbar entry point on every project page, satisfying DET-04"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct one-shot API call (crmApi.getClientPage) instead of a mounted query, for a fire-once selection action inside a modal"
    - "Same-app new-tab open (window.open + noopener,noreferrer) matching the CRM dashboard's row-click pattern, not crossAppUrl"

key-files:
  created:
    - apps/workspaces/src/components/projectPage/NewClientPageModal.tsx
  modified:
    - "apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx"

key-decisions:
  - "Reused AddClientModal's exact quick-create field set (name, country, VAT ID, credit limit, default rate) inside the picker modal rather than importing AddClientModal directly, since the picker needs a two-step in-place UI (search view <-> create view) rather than a standalone modal-in-a-modal"
  - "On quick-create success, immediately calls the same get-or-create-then-open flow used for existing-client selection, so both paths converge on one code path (openClientPage) — avoids duplicating the open/error/loading logic"

requirements-completed: [DET-04]

# Metrics
duration: ~20min
completed: 2026-07-06
---

# Phase 02 Plan 04: New Client Page Entry Point Summary

**"New client page" button added to every project page's toolbar, opening a search-existing/quick-create picker modal that calls the Plan 01 get-or-create endpoint and opens the resulting client detail page in a new tab — no duplicate `client_pages` rows possible.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-06
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- New `NewClientPageModal.tsx`: "Choose a client" heading, client-side name-substring search over `useClients()`, selectable client rows (name + country badge), and a "Create new client" fallback revealing the same quick-create field set as `AddClientModal`
- Selection flow (existing client or freshly quick-created one) always funnels through a single `openClientPage(clientId)` helper: calls `crmApi.getClientPage(clientId)` directly (bypassing `useClientPage`'s mounted-query semantics, since this is a one-shot action), then `window.open('/records/{id}', '_blank', 'noopener,noreferrer')`, then closes/resets the modal
- Per-row loading indicator while the get-or-create call is in flight; inline retry-able error message on failure (modal does not auto-close on error)
- "New client page" button wired into the project page toolbar (`apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx`), styled identically to the existing "+ Sub-page" button, using the `Building2` icon (already used elsewhere in this codebase for clients) — existing `addSubPageUnder`/sub-page creation logic untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: NewClientPageModal — search/quick-create picker with get-or-create-then-open flow** - `e8327d2` (feat)
2. **Task 2: Wire "New client page" trigger into the project page toolbar** - `c4a2614` (feat)

_No TDD tasks in this plan (autonomous, type=execute)._

## Files Created/Modified
- `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx` (new) - Picker modal: search existing clients, quick-create fallback, get-or-create + open-in-new-tab flow
- `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` - Added `newClientPageOpen` state, "New client page" toolbar button, `NewClientPageModal` render

## Decisions Made
- Copied `AddClientModal`'s quick-create field set inline into `NewClientPageModal` rather than composing the two modals, since the picker needs a single modal shell that toggles between a search view and a create view (mounting `AddClientModal` inside `NewClientPageModal` would require a modal-in-a-modal or a second overlay, which the plan's UI spec didn't call for)
- Both the "select existing client" and "quick-create then select" paths converge on the same `openClientPage` function, so there is exactly one implementation of the get-or-create + open + error-handling logic (avoids duplicated failure-mode code)
- Chose `Building2` over `UserPlus` for the toolbar button icon per the plan's explicit note that `Building2` is already used elsewhere in this codebase for clients (visual consistency with `CrmClientsBlock.tsx`/CRM dashboard)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Live-DB / browser verification not possible.** Consistent with Plans 02-01 and 02-03: no Docker/Postgres daemon is reachable in this execution sandbox, so the plan's manual QA steps (open a project page, trigger "New client page", search for an existing client, select it, confirm a new tab opens at `/records/{id}`; confirm no duplicate `client_pages` row via `SELECT COUNT(*) FROM client_pages WHERE client_id = $1`) could not be executed against a running dev server + database. Verification performed instead:
- `npx tsc --noEmit` across `apps/workspaces` — clean, zero errors, both before and after each task's changes
- Manual code review against every acceptance criterion in the plan (string-presence checks via `Grep`, confirmed `getClientPage`/`window.open` present and no `crossAppUrl` import, confirmed `useClients`/`useCreateClient` imported from `@/lib/hooks/useCrm`)
- Confirmed existing `addSubPageUnder`/"Sub-page" button/logic is textually unchanged in the modified file (only additive lines inserted)

The `022_client_pages.sql` migration (Plan 01) still needs to be applied to the dev Postgres instance before any of this plan's flow can be exercised end-to-end in a browser — this is the same carried-over blocker noted in the 02-01 and 02-03 summaries, not a new one introduced by this plan.

## User Setup Required

None beyond what Plans 01/03 already flagged: `database/migrations/022_client_pages.sql` must be applied to the running dev Postgres instance before `/records/[clientId]` (and therefore this plan's "open in new tab" step) can be exercised end-to-end.

## Next Phase Readiness
- DET-04 fully implemented: users can create or re-open a client's detail page from the Notion-like project page creator, not only from the CRM dashboard
- No duplicate-page risk under repeated selection, per Plan 01's `ON CONFLICT (client_id) DO UPDATE` unique-constraint guarantee (T-02-08 mitigated at the database layer, unchanged by this plan)
- This is the final plan (Wave 3) of Phase 02 — phase-level verification/transition is the next step, gated on the carried-over `022_client_pages.sql` migration being applied to a live dev database

## Self-Check: PASSED

All declared files verified present on disk; both commit hashes (e8327d2, c4a2614) verified in `git log`.

---
*Phase: 02-crm-dashboard-navigation-client-detail*
*Completed: 2026-07-06*
