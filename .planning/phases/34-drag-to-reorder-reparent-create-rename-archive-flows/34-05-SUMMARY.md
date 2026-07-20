---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
plan: 05
subsystem: workspace-tree
tags: [archive, undo, tree-section, react-query]
status: checkpoint-pending
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
  duration: "~15m (Task 1 only; Task 2 is a human-verify checkpoint, not yet executed)"
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

**Task 2 (checkpoint — not yet executed):** Manual click-through verification of the archive confirm dialog, descendant-count breakdown, immediate disappearance from the tree, and the zero-descendant Undo toast round-trip. This requires a running app and human interaction; it has not been performed by this executor.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` — exits 0 (no errors).
- `grep -c "ArchiveConfirmDialog" TreeSection.tsx` → 2 (import + JSX usage).
- `grep -c "TreeUndoToast" TreeSection.tsx` → 2 (import + JSX usage).
- `grep -c "totalDescendants === 0" TreeSection.tsx` → 1.
- `grep -c "useUnarchiveFolder\|useUnarchiveProject" TreeSection.tsx` → 4 (import line + two hook-instantiation lines; exceeds the plan's "at least 2" floor, both hooks are wired and dispatched from `handleUndo`).

## Deviations from Plan

None — Task 1 executed exactly as written.

## Checkpoint Reached

Task 2 is `type="checkpoint:human-verify"` with `gate="blocking"`. Per the standard (non-auto-mode) checkpoint protocol — `workflow.auto_advance` is `false` and `_auto_chain_active` is `false` in `.planning/config.json` — this executor stopped before performing any manual verification and did not guess at approval. A human (or a follow-up agent with the checkpoint's `how-to-verify` steps) must run the app and walk through the 5-step manual verification listed in the plan (folder-with-descendants archive → breakdown accuracy → immediate disappearance; leaf-project archive → Undo toast → Undo restores the row; folder-with-descendants archive → no Undo toast).

## Self-Check: PASSED

- FOUND: apps/workspaces/src/components/tree/TreeSection.tsx (modified, contains ArchiveConfirmDialog/TreeUndoToast wiring)
- FOUND: commit 3a24f64 in `git log --oneline`
