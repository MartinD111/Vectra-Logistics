---
phase: 26-additional-view-types
plan: 01
subsystem: ui
tags: [react, nextjs, tailwind, lucide-react, records-views]

# Dependency graph
requires:
  - phase: 24-board-view
    provides: BoardCard.tsx (private formatCardPropertyValue), ViewSwitcher.tsx (2-type segmented control)
  - phase: 25-view-ux-parity
    provides: ViewSettingsMenu.tsx (card properties + aggregation picker, autosave-on-change convention)
provides:
  - "formatCardPropertyValue exported from BoardCard.tsx for reuse by List/Calendar/Gallery renderers (Wave 2)"
  - "ViewSwitcher.tsx rewritten as a 6-type dropdown (Board/Table/List/Calendar/Gallery/Timeline), create-once-then-remember logic unchanged"
  - "ViewSettingsMenu.tsx extended with calendarDateProperty/galleryCoverProperty/timelineStartProperty/timelineEndProperty pickers, each autosaving independently to view.config"
affects: [26-02-list-view, 26-03-calendar-gallery-view, 26-04-timeline-view, 26-05-block-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-view-type conditional ViewSettingsMenu sections gated on view.type, each with its own local-state buffer + independent updateView.mutate call (no combined config object)"
    - "Hand-rolled dropdown popover shell (fixed inset-0 z-20 backdrop + absolute z-30 panel) reused verbatim from ViewSettingsMenu for ViewSwitcher, left-aligned instead of right-aligned"

key-files:
  created: []
  modified:
    - apps/workspaces/src/components/projectPage/board/BoardCard.tsx
    - apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx
    - apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx

key-decisions:
  - "Used GanttChartSquare (not the BarChart3 fallback) for the Timeline icon — confirmed present in lucide-react 0.294.0's type declarations"
  - "ViewSwitcher trigger name lookup switched from a 2-way ternary to VIEW_TYPES.find(...).label, matching the plan's exact instruction"

patterns-established:
  - "Downstream view renderers import formatCardPropertyValue from '../board/BoardCard' instead of duplicating person/select/multi-select label resolution"

requirements-completed: [VIEW-02, VIEW-03, VIEW-04, VIEW-05]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 26 Plan 01: Shared View Foundation Summary

**Exported `formatCardPropertyValue` for reuse, rebuilt `ViewSwitcher` as a 6-type dropdown menu, and added Calendar/Gallery/Timeline property pickers to `ViewSettingsMenu` — the shared contracts Wave 2's four new view renderers consume.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T06:14:00Z
- **Completed:** 2026-07-15T06:26:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `BoardCard.tsx`'s `formatCardPropertyValue` is now exported (zero behavior change) so List/Calendar/Gallery renderers can import it verbatim instead of re-deriving the person/select/multi-select label-resolution logic.
- `ViewSwitcher.tsx` rewritten from a 2-button segmented control into a 6-type dropdown (Board, Table, List, Calendar, Gallery, Timeline) per D-10, preserving the create-once-then-remember `switchTo` logic and `pendingType` in-flight guard exactly.
- `ViewSettingsMenu.tsx` extended with three new conditional sections (Calendar date property D-01, Gallery cover property D-04, Timeline start/end properties D-06), each gated on `view.type`, each autosaving independently to a distinct `view.config` key via `useUpdateView`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export formatCardPropertyValue from BoardCard.tsx** - `7c0fef8` (refactor)
2. **Task 2: Rewrite ViewSwitcher.tsx as a 6-type dropdown menu (D-10)** - `809dd91` (feat)
3. **Task 3: Extend ViewSettingsMenu.tsx with Calendar/Gallery/Timeline property pickers** - `a26b995` (feat)

**Plan metadata:** committed in the same batch as this SUMMARY (worktree mode — orchestrator merges STATE.md/ROADMAP.md updates centrally)

## Files Created/Modified
- `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` - `formatCardPropertyValue` is now `export function` (was private); function body byte-identical otherwise
- `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` - Rewritten as a 6-type dropdown; `VIEW_TYPES` widened to include list/calendar/gallery/timeline with lucide-react icons; `switchTo`/`pendingType` logic unchanged
- `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` - Added `localCalendarDateProperty`/`localGalleryCoverProperty`/`localTimelineStartProperty`/`localTimelineEndProperty` local-state buffers (synced in the existing `useEffect(() => {...}, [view.id])`), four new setters mirroring `setAggregationProp`'s shape, and three new conditional `<select>` sections gated on `view.type`

## Decisions Made
- Used `GanttChartSquare` for the Timeline icon (not the documented `BarChart3` fallback) — verified present in the installed `lucide-react` 0.294.0 package's type declarations, so no fallback substitution was needed.
- Ordered the new ViewSettingsMenu sections after "Column aggregation" (plan left ordering to discretion); each new section only renders for its matching `view.type`, so there's no risk of multiple sections competing for space on the same view.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**No `node_modules` installed in this worktree** — the plan's automated verification step (`cd apps/workspaces && npx tsc --noEmit`) could not be run because no dependencies are installed anywhere in the worktree or monorepo root (`apps/workspaces/node_modules` and the repo-root `node_modules` are both absent). All three files were verified instead via:
- Manual review against the existing codebase's established TypeScript patterns (matching `ViewSettingsMenu.tsx`'s existing `useUpdateView`/local-state-buffer conventions exactly).
- All plan-specified `grep` acceptance criteria (exact counts for `formatCardPropertyValue`, `'timeline'`, `ChevronDown`, `pendingType`, `fixed inset-0 z-20`, `calendarDateProperty`, `galleryCoverProperty`, `timelineStartProperty`, `timelineEndProperty`, and each `view.type === '...'` gate) — all passed.
- Confirming `GanttChartSquare` exists in the pinned `lucide-react@0.294.0` package's published type declarations (fetched via unpkg) before using it without the fallback.

This is an environment limitation (dependencies never installed in this worktree), not a plan or code defect. Recommend running `npx tsc --noEmit` once in a wave-2 or wave-3 agent's worktree (or in the merged main branch) to get a live compiler pass before Phase 26 verification closes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 plans (26-02 List view, 26-03 Calendar/Gallery view, 26-04 Timeline view) can now:
- `import { formatCardPropertyValue } from '../board/BoardCard'` directly.
- Rely on `view.config.calendarDateProperty` / `galleryCoverProperty` / `timelineStartProperty` / `timelineEndProperty` being settable and persisted from the UI once a Calendar/Gallery/Timeline view exists (created via the new `ViewSwitcher` dropdown).
- No blockers. One open item: a live `tsc --noEmit` pass against these three files is still recommended once a worktree with installed dependencies is available (see Issues Encountered).

---
*Phase: 26-additional-view-types*
*Completed: 2026-07-15*
