---
phase: 03-per-project-client-overrides
plan: 02
subsystem: ui
tags: [react, nextjs, tanstack-query, tailwind, crm]

# Dependency graph
requires:
  - phase: 03-per-project-client-overrides (plan 01)
    provides: "useUnlinkClientProjectLink hook, assertOwnedProject ownership check, DELETE /clients/:id/projects/:projectId"
provides:
  - "LinkedProjectsSection component on the client detail page (attach picker + collapsed card list + expanded per-field override editors + unlink confirm dialog)"
  - "CLI-04/CLI-05 fully closed end-to-end on the frontend"
affects: [crm-frontend, client-detail-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 override-state color contract: inherited = text-gray-400 italic on bg-gray-50/slate-700-50; overridden = full-strength text + border-l-2 border-primary-600"
    - "Override triple is always sent in full on every save (never a partial-field PATCH) to avoid the ON CONFLICT DO UPDATE upsert silently nulling unrelated override fields"
    - "Progressive disclosure: collapsed project cards, expand-on-click reveals the 3 override fields (rate/employee/notes)"

key-files:
  created: []
  modified:
    - "apps/workspaces/src/app/records/[clientId]/page.tsx"

key-decisions:
  - "LinkedProjectsSection placed in the main column above LivePageCanvas, not inside the 320px ClientSidebar, per UI-SPEC's resolved placement decision"
  - "Attach picker is a dropdown popover (not a full modal), anchored to the Attach project button, matching ResponsibleEmployeeField's existing dropdown pattern"
  - "Per-field override toggle uses explicit 'Override'/'Reset to default' text buttons, not an icon-only affordance, to keep inherited-vs-overridden visually unambiguous per D-04"

patterns-established:
  - "Full-override-triple save pattern for any future per-project-link field additions"

requirements-completed: [CLI-04, CLI-05]

# Metrics
duration: 35min
completed: 2026-07-06
---

# Phase 3 Plan 2: Linked Projects UI Summary

**"Linked Projects" section on the client detail page: searchable attach picker, collapsed per-project cards with an override-count badge, and three independently toggleable rate/employee/notes override editors following the D-04 grey-italic-vs-primary-accent visual contract.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- Built the entire client-detail-page frontend surface for CLI-04 (attach client to project via searchable picker) and CLI-05 (per-field rate/employee/notes override, isolated per link)
- Implemented D-04's override-vs-inherited visual contract on all three override fields (rate numeric input, responsible-employee dropdown, notes textarea)
- Wired the real unlink flow: confirm dialog with exact UI-SPEC copy, calls `useUnlinkClientProjectLink`, keeps the row with inline error text on failure, removes it on success
- Every override save sends the full 3-field triple (rate + employee + notes) regardless of which single field the user touched, preventing the Pitfall 2 data-loss bug identified in 03-RESEARCH.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Build LinkedProjectsSection — data wiring, project picker, collapsed card list** - `9dba2d9` (feat)
2. **Task 2: Per-field override editors (D-04 contract) and unlink confirm dialog** - `d5a5f8a` (feat)

## Files Created/Modified
- `apps/workspaces/src/app/records/[clientId]/page.tsx` - Added `LinkedProjectsSection`, `UnlinkConfirmDialog`, `LinkedProjectOverrideEditor`, `OverrideFieldShell`, `RateOverrideField`, `EmployeeOverrideField`, `NotesOverrideField`. Mounted `LinkedProjectsSection` in the main column above `LivePageCanvas`.

## Decisions Made
- Placement: main column above the canvas (not inside `ClientSidebar`) — matches UI-SPEC's resolved discretion call, since the 320px sidebar can't comfortably fit 3 override fields + actions per linked-project row.
- Picker form factor: dropdown popover (not full modal), consistent with the existing `ResponsibleEmployeeField` interaction pattern.
- Override toggle widget: explicit "Override"/"Reset to default" text buttons rather than pencil-icon click-to-edit, per D-04's "visually unambiguous" requirement and to deliberately differ from Phase 2's always-editable sidebar fields.
- No confirmation dialog on per-field reset (low-consequence, reversible) — confirmation reserved for Unlink only, per UI-SPEC.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's `<interfaces>` reference code and the 03-UI-SPEC.md layout/copy/color contract; no architectural surprises, no additional backend gaps found (Plan 01 had already closed all backend gaps this plan depends on).

## Issues Encountered

During Task 2 implementation, an initial draft of the `save()` helper used a generic `Record`-style field-assignment (`overrides[field] = value`) which TypeScript correctly rejected as unsound across the three differently-typed override fields (`number | null | undefined` for rate vs. `string | null | undefined` for employee/notes). Resolved by splitting into three field-specific save functions (`saveRate`, `saveEmployee`, `saveNotes`), each still reading the other two fields' current override intent from the same `currentOverrides()` helper before mutating — preserving the full-triple-save correctness guarantee without unsafe type widening. Verified via `npx tsc --noEmit` (clean, no errors) after the fix.

## User Setup Required

None - no external service configuration required.

## Human Verification Required (this plan has `autonomous: false`)

This plan's tasks include `<human-check>` steps that require visual/interactive confirmation in a browser, which this executor cannot perform. Both tasks were implemented fully and compile cleanly (`npx tsc --noEmit` passes with zero errors). Please manually verify the following before considering this plan fully done:

**Task 1 human-check:**
Open a client detail page in the browser. Confirm: "Linked Projects" section renders in the main column above the canvas (not inside the 320px sidebar). Empty state shows the correct copy when no projects are attached. Clicking "Attach project" opens a dropdown picker (not a full-screen modal) with a working search filter. Selecting a project attaches it — the row appears in the list without a page reload, and re-opening the picker shows that project deprioritized (checkmark) rather than removed from the list.

**Task 2 human-check:**
Expand a linked project card. Confirm each of the 3 fields independently shows "Override"/"Reset to default" correctly reflecting `is_overridden`. Override only the Rate field, save, then reload the page (or refetch) — confirm Responsible employee and Notes still show inherited/global values (not cleared) and Rate shows the overridden value with the primary-600 left-border accent. Click "Reset to default" on the overridden Rate field — confirm it reverts to the greyed inherited display showing the client's actual global default value. Click "Unlink" on a project with overrides set — confirm the dialog copy matches UI-SPEC exactly, confirming removes the row, and re-attaching that same project via the picker shows all 3 fields back in the inherited state (no residual overrides, per D-05).

**Full manual UAT script (from 03-02-PLAN.md `<verification>`):**
1. Attach client to project via picker → row appears in Linked Projects (CLI-04).
2. Cross-company `project_id` attach attempt rejected — already covered by Plan 01's backend fix; confirm no UI path exists to construct such a request (picker only ever offers same-company `useProjects()` results).
3. Override only "rate" on a link → confirm employee/notes still show global values (CLI-05 isolation).
4. Clearing an override (Reset to default) → confirm displayed value reverts to client's global default.
5. Override rate on Project A → confirm client's global `default_rate_eur` (visible in the sidebar) is unchanged, and Project B's resolved rate (if client is linked to a second project) is unaffected.
6. Unlink a project with overrides set → re-attach the same project → confirm all 3 fields show global values (no override survives), per D-05.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, or schema changes. All mutations go through the already-hardened Plan 01 backend endpoints (`useUpsertClientProjectLink`, `useUnlinkClientProjectLink`), which already enforce `assertOwnedProject`-based tenant isolation.

## Known Stubs

None — every rendered field is wired to live `useClientProjectLinks`/`useProjects`/`useTeam` data; no hardcoded/mock data paths were introduced.

## Next Phase Readiness

Phase 3 (per-project-client-overrides) is now fully implemented across both plans (03-01 backend, 03-02 frontend). CLI-04 and CLI-05 are closed end-to-end pending the human UAT pass described above. No blockers for subsequent phases.

---
*Phase: 03-per-project-client-overrides*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: .planning/phases/03-per-project-client-overrides/03-02-SUMMARY.md
- FOUND: apps/workspaces/src/app/records/[clientId]/page.tsx
- FOUND commit 9dba2d9 (Task 1)
- FOUND commit d5a5f8a (Task 2)
