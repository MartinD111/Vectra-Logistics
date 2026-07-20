---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
plan: 02
subsystem: ui
tags: [react, tailwind, context-menu, lucide-react]

# Dependency graph
requires: []
provides:
  - "TreeContextMenu.tsx: reusable dual-anchor (kebab-button / right-click-point) action menu component"
  - "TreeContextMenuAnchor and TreeContextMenuAction exported types for downstream Wave 2 consumption"
affects: [34-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anchored popover shell (fixed inset-0 backdrop + absolute/fixed positioned panel), cloned from ViewSettingsMenu.tsx"
    - "Dual anchor-mode component: caller owns trigger element and open/close boolean state; component only renders backdrop + panel"

key-files:
  created:
    - apps/workspaces/src/components/tree/TreeContextMenu.tsx
  modified: []

key-decisions:
  - "Backdrop also handles onContextMenu (preventDefault + onClose) so a second right-click closes the menu instead of stacking a new one"
  - "No trigger UI or open/close state owned by this component — Wave 2 (34-04) mounts it conditionally and supplies anchor/actions/onClose"

patterns-established:
  - "Pattern: dual-anchor popover component contract (button vs point) for future reusable menus in apps/workspaces"

requirements-completed: [TREEOPS-01, TREEOPS-02, TREEOPS-05]

# Metrics
duration: 12min
completed: 2026-07-20
---

# Phase 34 Plan 02: TreeContextMenu Component Summary

**Standalone dual-anchor (kebab-button / right-click-point) TreeContextMenu component with destructive-action styling, built from ViewSettingsMenu.tsx's anchored-popover shell — no trigger UI, ready for Wave 2 mounting.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T14:05:00Z
- **Completed:** 2026-07-20T14:17:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Built the first context-menu component in this codebase (confirmed via search: none existed in `apps/workspaces` or `packages/ui` prior to this plan)
- Supports both `{ type: 'button' }` (kebab-anchored, `absolute right-0 top-full mt-1`) and `{ type: 'point', x, y }` (right-click-anchored, `fixed` + inline `left`/`top`) positioning modes from a single component
- Exports `TreeContextMenu`, `TreeContextMenuAnchor`, and `TreeContextMenuAction` for Wave 2 (34-04) to consume verbatim per the plan's interface contract
- Destructive styling branch (red text/hover) wired for the future "Archive" action per D-09

## Task Commits

Each task was committed atomically:

1. **Task 1: Build TreeContextMenu.tsx with dual anchor modes** - `335af00` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `apps/workspaces/src/components/tree/TreeContextMenu.tsx` - Dual-anchor context menu component (backdrop + panel + action rows), no trigger UI, matches `ViewSettingsMenu.tsx`'s visual shell

## Decisions Made
- Followed the plan's exact interface contract verbatim (types, prop shapes, class names) since Wave 2 plans will import `TreeContextMenu`/`TreeContextMenuAnchor`/`TreeContextMenuAction` directly — no deviation from the documented contract was warranted.
- Backdrop's `onContextMenu` handler calls `preventDefault()` + `onClose()` so a second right-click while the menu is open closes it cleanly rather than stacking/re-triggering, per the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`TreeContextMenu.tsx` is standalone, typed, and compiles clean (`npx tsc --noEmit -p apps/workspaces/tsconfig.json` exits 0). It is not yet mounted anywhere in the app — Wave 2 plan 34-04 will wire it into `TreeNodeRow.tsx`/`TreeSection.tsx` for the kebab-button trigger, right-click trigger, and root-level create affordance (D-08/D-09/D-10). No blockers for that downstream work.

---
*Phase: 34-drag-to-reorder-reparent-create-rename-archive-flows*
*Completed: 2026-07-20*
