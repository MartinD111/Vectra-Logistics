---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
plan: 03
subsystem: ui
tags: [react, typescript, tree-sidebar, folders-api, projects-api, react-query]

# Dependency graph
requires:
  - phase: 34-01
    provides: "countDescendants (treeArchiveCount.ts), useArchiveFolder/useArchiveProject mutation hooks"
provides:
  - "ArchiveConfirmDialog component: per-node-type descendant-count breakdown, dispatches archive mutation by node_type, calls onArchived(node, total) on success"
  - "TreeUndoToast component: zero-descendant Undo affordance (D-07), auto-dismisses after 4s"
affects: [34-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ArchiveConfirmDialog mirrors FolderModal.tsx's submit-mutates-directly pattern (performs mutation itself, not caller-supplied mutation fn)"
    - "TreeUndoToast mirrors KanbanMigrationGate.tsx's fixed bottom-6 right-6 auto-dismiss toast shape"

key-files:
  created:
    - apps/workspaces/src/components/tree/ArchiveConfirmDialog.tsx
    - apps/workspaces/src/components/tree/TreeUndoToast.tsx
  modified: []

key-decisions:
  - "ArchiveConfirmDialog picks useArchiveFolder()/useArchiveProject() internally based on node.node_type rather than accepting a mutation prop, per plan interface contract"
  - "TreeUndoToast's Undo button calls onUndo() only (not onDismiss()) — caller (Wave 3) is responsible for unmounting after onUndo resolves, per plan interface contract"

patterns-established:
  - "Descendant breakdown copy composed by filtering TYPE_LABELS to only non-zero counts, joined with ', ' — omits zero-count types entirely per UI-SPEC"

requirements-completed: [TREEOPS-05, TREEOPS-06]

# Metrics
duration: 15min
completed: 2026-07-20
---

# Phase 34 Plan 03: Archive Confirmation Dialog and Undo Toast Summary

**Standalone `ArchiveConfirmDialog` (per-type descendant-count breakdown, self-contained archive mutation dispatch by node_type) and `TreeUndoToast` (D-07 zero-descendant Undo affordance) built as independently verifiable components, not yet wired into the tree UI — that wiring is Wave 3's job.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `ArchiveConfirmDialog.tsx` reuses `FolderModal.tsx`'s exact modal shell, computes `countDescendants(node)` once, and renders either the zero-descendant reassurance copy or the per-type breakdown (omitting zero-count types) per the UI-SPEC Copywriting Contract
- Dispatches `useArchiveFolder()` or `useArchiveProject()` based on `node.node_type`, awaits the mutation, then calls `onClose()` followed by `onArchived(node, total)`
- `TreeUndoToast.tsx` reuses `KanbanMigrationGate.tsx`'s toast shape, renders the exact `"{nodeName}" archived.` + `Undo` copy contract, and auto-dismisses via `onDismiss()` after a 4000ms timer (cleared on unmount)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ArchiveConfirmDialog.tsx with descendant-count breakdown** - `900eae8` (feat)
2. **Task 2: Build TreeUndoToast.tsx (D-07 zero-descendant Undo affordance)** - `4950b09` (feat)

## Files Created/Modified
- `apps/workspaces/src/components/tree/ArchiveConfirmDialog.tsx` - New: modal confirming archive with per-node-type descendant breakdown, performs the archive mutation itself
- `apps/workspaces/src/components/tree/TreeUndoToast.tsx` - New: auto-dismissing bottom-right toast with an Undo action

## Decisions Made
- Followed the plan's interface contract exactly: `ArchiveConfirmDialog` does not accept a mutation function prop, it picks the correct hook internally by `node.node_type`.
- `TreeUndoToast`'s `Undo` button click handler calls only `onUndo()`, leaving unmount/dismissal orchestration to the caller, per the plan's explicit interface note.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both components expose the exact prop contracts documented in this plan's `<interfaces>` block, ready for Wave 3 (34-05) to wire into `TreeNodeRow.tsx`/`TreeSection.tsx` without further design decisions.
- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` exits clean with both new files in place.
- No blockers for downstream plans in this phase.

---
*Phase: 34-drag-to-reorder-reparent-create-rename-archive-flows*
*Completed: 2026-07-20*

## Self-Check: PASSED
Both task commit hashes (900eae8, 4950b09) found in git log. Both created files exist on disk. `npx tsc --noEmit -p apps/workspaces/tsconfig.json` exits with no output (0 errors).
