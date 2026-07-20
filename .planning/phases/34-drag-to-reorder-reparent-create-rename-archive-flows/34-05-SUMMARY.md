---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
plan: 05
subsystem: workspace-tree
tags: [archive, undo, tree-section, react-query]
status: complete
dependency-graph:
  requires: ["34-03", "34-04"]
  provides: ["archive-confirm-flow-mounted", "archive-undo-toast-mounted"]
  affects: ["apps/workspaces/src/components/tree/TreeSection.tsx"]
tech-stack:
  added: []
  patterns:
    - "Conditional render of a standalone confirm-dialog component against nullable state (archiveTarget)"
    - "Post-mutation transient toast state (undoTarget) dismissed independently of the mutation's own cache invalidation"
key-files:
  created: []
  modified:
    - apps/workspaces/src/components/tree/TreeSection.tsx
decisions: []
metrics:
  duration: "~15m"
  completed: 2026-07-20
---

# Phase 34 Plan 05: Archive Confirm Dialog + Undo Toast Wiring Summary

Mounted `ArchiveConfirmDialog` and `TreeUndoToast` (both built in 34-03) into `TreeSection.tsx` against the `archiveTarget` state that 34-04 already declared and wired as every root `TreeNodeRow`'s `onArchive` prop, closing the loop on TREEOPS-05 (archive confirmation) and TREEOPS-06 (zero-descendant Undo).

## What Was Built

**Task 1 (complete, commit `3a24f64`):**

- Imported `ArchiveConfirmDialog` from `./ArchiveConfirmDialog` and `TreeUndoToast` from `./TreeUndoToast`.
- Added `useUnarchiveFolder()` / `useUnarchiveProject()` hook instances and `undoTarget` state (`useState<TreeNode | null>(null)`).
- Rendered `{archiveTarget && <ArchiveConfirmDialog ... />}` after the root node-list render block. `onArchived(node, totalDescendants)` sets `undoTarget` only when `totalDescendants === 0`; the dialog's own `onClose` handles clearing `archiveTarget` (dialog already calls `onClose()` internally before `onArchived` per its 34-03 contract, so this component does not double-clear `archiveTarget`).
- Rendered `{undoTarget && <TreeUndoToast ... />}` with a `handleUndo` function that dispatches `unarchiveFolder.mutate(undoTarget.id)` for `node_type === 'folder'` or `unarchiveProject.mutate(undoTarget.id)` for `node_type === 'project'`, then immediately calls `setUndoTarget(null)` — the mutation's own `onSuccess` handler (from `useFolders.ts`/`useProjects.ts`, built in prior plans) invalidates the full-tree query independently, so the toast dismiss timing does not need to wait on the mutation.

**Task 2 (checkpoint — recorded for end-of-phase verification, not executed by this executor):** Manual click-through verification of the archive confirm dialog, descendant-count breakdown, immediate disappearance from the tree, and the zero-descendant Undo toast round-trip. Per project config, `workflow.human_verify_mode` has no override, so the default (end-of-phase) applies — this checkpoint does not block plan completion; it is deferred to phase-level verification/UAT. See "Human Verification Needed" below for the exact steps.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — exits 0 (no errors).
- `grep -c "ArchiveConfirmDialog" TreeSection.tsx` → 2 (import + JSX usage).
- `grep -c "TreeUndoToast" TreeSection.tsx` → 2 (import + JSX usage).
- `grep -c "totalDescendants === 0" TreeSection.tsx` → 1.
- `grep -c "useUnarchiveFolder\|useUnarchiveProject" TreeSection.tsx` → 4 (import line + two hook-instantiation lines; exceeds the plan's "at least 2" floor, both hooks are wired and dispatched from `handleUndo`).

## Deviations from Plan

None — Task 1 executed exactly as written.

## Human Verification Needed

Task 2 is `type="checkpoint:human-verify"` with `gate="blocking"`. Project config has no `workflow.human_verify_mode` override, so the default (end-of-phase) applies — consistent with plan 34-04's checkpoint handling. This executor did not perform the manual click-through and does not block plan completion on it; the checkpoint is recorded here for surfacing during phase-level verification/UAT.

**What was built:** Archive confirmation dialog with per-type descendant-count breakdown, wired to the folder/project Archive menu action; zero-descendant Undo toast, mounted in `TreeSection.tsx` against the `archiveTarget`/`undoTarget` state.

**How to verify (full steps from the plan's checkpoint task):**
1. Right-click a folder with known children (some projects/programs nested under it) → Archive — confirm the dialog shows a per-type breakdown matching the actual tree contents (e.g. "This will also archive 2 projects, 3 pages.") with zero-count types omitted.
2. Confirm the archive — confirm the folder and its listed descendants disappear from the default tree view immediately (no manual refresh needed).
3. Right-click a leaf project with no children → Archive → confirm — confirm the dialog shows "This folder/project has no contents and will be archived." and, after confirming, an Undo toast appears bottom-right.
4. Click Undo on that toast — confirm the project reappears in the tree.
5. Repeat steps 1-2 for a folder WITH descendants — confirm no Undo toast appears after confirming.

**Resume signal (for the phase-level verification pass):** "approved" or a description of issues found.

## Self-Check: PASSED

- FOUND: apps/workspaces/src/components/tree/TreeSection.tsx (modified, contains ArchiveConfirmDialog/TreeUndoToast wiring)
- FOUND: commit 3a24f64 in `git log --oneline`
