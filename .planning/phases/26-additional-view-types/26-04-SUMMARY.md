---
phase: 26-additional-view-types
plan: 04
subsystem: ui
tags: [react, nextjs, tailwind, lucide-react, records-views, gantt]

# Dependency graph
requires:
  - phase: 26-additional-view-types
    plan: 01
    provides: formatCardPropertyValue exported from BoardCard.tsx, ViewSettingsMenu.tsx timelineStartProperty/timelineEndProperty pickers
provides:
  - "CollectionTimelineView.tsx — Gantt-style timeline renderer with computeBarPosition/getDaysInMonth pure geometry functions"
affects: [26-05-block-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Small pure-function geometry helpers (computeBarPosition, getDaysInMonth) styled after viewFilters.ts's compareValues/aggregateColumn convention — no side effects, called once per qualifying record before render"
    - "D-07 hide-if-incomplete filter applied as a plain .filter() before rendering lanes, not folded into viewFilters.ts (timeline-specific, not a user-configured filter condition)"

key-files:
  created:
    - apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx
  modified: []

key-decisions:
  - "Title source derived the same way BoardBlock.tsx already does (collection.schema[0]?.id), since the plan's CollectionTimelineView props signature omits a dedicated titlePropId prop"
  - "Not wired into BoardBlock.tsx yet — deferred to Plan 26-05 per this plan's explicit output scope"

patterns-established: []

requirements-completed: [VIEW-05]

# Metrics
duration: 9min
completed: 2026-07-15
---

# Phase 26 Plan 04: Timeline/Gantt View Summary

**New `CollectionTimelineView.tsx` renders month-wide proportional Gantt bars from two independently-chosen date properties, hiding records missing either value and providing accessible prev/next month navigation.**

## Performance

- **Duration:** 9 min
- **Tasks:** 2
- **Files modified:** 1 (new file)

## Accomplishments
- `computeBarPosition`/`getDaysInMonth` pure functions compute clamped left/width percentages for Gantt bars within a fixed month-wide scale (D-06, D-08), styled after `viewFilters.ts`'s small-pure-function convention.
- `CollectionTimelineView` renders a month-nav header (`ChevronLeft`/`ChevronRight`, accessible `aria-label="Previous month"`/`"Next month"`), a day-of-month gridline row, and one lane per qualifying record.
- D-07 strict hide-if-incomplete semantics: `records.filter((r) => r.props[timelineStartProperty] && r.props[timelineEndProperty])` — a record needs both dates set to render a bar at all; otherwise it is entirely absent from this view (no placeholder row, no point-marker).
- Bar labels render inside the bar (white text) when `widthPct >= 15`, else to the right of the bar in default text color — matching the UI-SPEC's Interaction Contract for Timeline bars.
- Click-through opens record detail via `window.open('/collections/{id}/records/{id}', '_blank', 'noopener,noreferrer')`, copied verbatim from `BoardCard.tsx`.
- Two empty states: unset start/end property config ("Choose start and end date properties to plot this timeline") and zero-qualifying-records ("No records match these filters"), both reusing the `CollectionTableView.tsx`-style container/empty-state shell.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the pure bar-position geometry function** - `66a3e91` (feat)
2. **Task 2: Build the full Timeline component — month nav, lanes, bars, D-07 filtering** - `6887b2a` (feat)

**Plan metadata:** committed in the same batch as this SUMMARY (worktree mode — orchestrator merges STATE.md/ROADMAP.md updates centrally)

## Files Created/Modified
- `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx` - New file. Task 1 added `getDaysInMonth`/`computeBarPosition` pure functions plus a placeholder `CollectionTimelineView` export; Task 2 replaced the placeholder with the full month-nav/lane/bar implementation, D-07 filtering, and empty states.

## Decisions Made
- The plan's `CollectionTimelineView` props signature (`collection, records, collectionId, timelineStartProperty, timelineEndProperty, cardProperties`) does not include a dedicated `titlePropId` prop. Derived the record title the same way `BoardBlock.tsx` already does elsewhere (`collection.schema[0]?.id`) rather than inventing a new convention — matches the plan's exact prop list while keeping title derivation consistent with the rest of the codebase.
- `cardProperties` is accepted in the props signature (as the plan specifies) but not rendered inside bars/lanes — the plan's task 2 action and acceptance criteria do not call for rendering card-face properties on Timeline bars (unlike Gallery/List), only the record title. Left as an accepted-but-unused prop to match the exact signature the plan specifies for forward compatibility with `BoardBlock.tsx`'s wiring in Plan 26-05.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**No `node_modules` installed anywhere in this worktree** (same environment limitation noted in Plan 26-01's SUMMARY — `apps/workspaces/node_modules` and the repo-root `node_modules` are both absent). The plan's automated verification step (`cd apps/workspaces && npx tsc --noEmit`) could not be run. Verified instead via:
- Manual review against existing codebase conventions (`BoardCard.tsx`'s click-through pattern, `CollectionTableView.tsx`'s container/empty-state shell, `viewFilters.ts`'s pure-function style).
- All plan-specified `grep` acceptance criteria for both tasks — exact/minimum counts for `computeBarPosition`, `getDaysInMonth`, `leftPct`, `widthPct`, `aria-label="Previous month"`, `aria-label="Next month"`, the empty-state copy string, the D-07 filter regex, `bg-primary-600`, and the `window.open` click-through string — all passed.
- Type imports (`CollectionPropertyDef`, `CollectionRecord`, `DataCollection`) confirmed against `apps/workspaces/src/lib/api/records.api.ts`'s actual interface declarations (read directly, not assumed).

This is an environment limitation (dependencies never installed in this worktree), not a plan or code defect. Recommend running `npx tsc --noEmit` once a worktree/branch with installed dependencies is available, before Phase 26 verification closes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 26-05 (block wiring) can now:
- `import { CollectionTimelineView } from '../collectionTimeline/CollectionTimelineView'` and mount it in `BoardBlock.tsx`'s `view.type === 'timeline'` branch, passing `collection`, `records={sorted}`, `collectionId`, `timelineStartProperty={view.config.timelineStartProperty as string}`, `timelineEndProperty={view.config.timelineEndProperty as string}`, and `cardProperties`.
- No blockers. One open item: a live `tsc --noEmit` pass against this file is still recommended once a worktree with installed dependencies is available (see Issues Encountered).

---
*Phase: 26-additional-view-types*
*Completed: 2026-07-15*

## Self-Check: PASSED

Created file and both task commit hashes (66a3e91, 6887b2a) were verified present in the worktree and git log.
