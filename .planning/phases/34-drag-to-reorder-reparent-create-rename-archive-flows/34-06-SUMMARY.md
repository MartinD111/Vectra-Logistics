---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
plan: 06
subsystem: ui
tags: [dnd-kit, react, tree-sidebar, drag-and-drop, folders-api]

# Dependency graph
requires:
  - phase: 34
    plan: "01"
    provides: "flattenVisibleTree/computeDropZone pure geometry utilities, useReorderTree/useMoveTreeNode hooks"
  - phase: 34
    plan: "05"
    provides: "Current TreeSection.tsx state (archive/undo wiring) this plan builds on"
provides:
  - "TreeNodeRow.tsx: useSortable whole-row drag registration + useDroppable folder-drop-<id> hit-target (always present, even on empty/collapsed folders) + reorder-line/reparent-ring rendering driven by a new dropZone prop"
  - "TreeSection.tsx: DndContext + flattened SortableContext + root-level 'root-drop' droppable + onDragMove drop-zone computation + onDragEnd reorder/move/un-file dispatch + illegal-drop error toast"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-level useSortable + folder-level useDroppable dual registration (distinct id namespaces, folder-drop-<id> vs the row's own sortable id) mirroring BoardCard.tsx/BoardColumn.tsx's drag idiom already used for the Kanban board"
    - "DndContext's flattened SortableContext items list is used purely for drag-ordering registration and id-to-node_type/parentKey lookups in the drag handlers; it never replaces the existing recursive TreeNodeRow JSX render (indentation/expand-collapse structure untouched)"

key-files:
  created: []
  modified:
    - apps/workspaces/src/components/tree/TreeNodeRow.tsx
    - apps/workspaces/src/components/tree/TreeSection.tsx

key-decisions:
  - "event.over.rect / event.active.rect.current.translated are dnd-kit's ClientRect type, not DOMRect; cast with `as DOMRect` at both computeDropZone call sites since ClientRect and DOMRect share the same shape properties consumed by the pure utility (top/height) and the utility's signature (built in 34-01) is fixed"
  - "Sibling list for reorder is resolved via a small findFolderNode(pruned, parentKey) DFS helper local to TreeSection.tsx rather than extending treeDragUtils.ts, since it needs the full TreeNode (with .children) rather than the flat row shape flattenVisibleTree returns"
  - "handleDragEnd re-derives the drop zone from live state (dropZone?.nodeId === overId ? dropZone.zone : computeDropZone(...)) as a fallback for the rare case where onDragEnd fires without a preceding onDragMove having set matching state"

patterns-established: []

requirements-completed: [TREEOPS-03, TREEOPS-04]

# Metrics
duration: 25min
completed: 2026-07-20
---

# Phase 34 Plan 06: Drag-to-Reorder and Drag-to-Reparent Wiring Summary

**Wired `@dnd-kit` whole-row drag registration onto the tree sidebar's folder/project rows, giving every folder row a droppable hit-target even when empty or collapsed, and dispatching `useReorderTree()`/`useMoveTreeNode()` from a single `DndContext` in `TreeSection.tsx` with edge-vs-middle drop-zone detection, a dedicated root-level drop zone for un-filing projects, and verbatim server-error surfacing on illegal drops — completing the last two of six TREEOPS requirements for the phase.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 automated tasks + 1 checkpoint (human-verify, not halted mid-flight — see Human Verification Needed below)
- **Files modified:** 2

## Accomplishments
- `TreeNodeRow.tsx` now registers `useSortable({ id: node.id })` for folder/project rows (whole row is the drag handle, D-01), applying `setNodeRef`/`attributes`/`listeners`/transform-transition style exactly as `BoardCard.tsx` does for Kanban cards
- Every folder row additionally registers `useDroppable({ id: 'folder-drop-<id>' })` in a distinct id namespace from its own sortable id — this guarantees a hit-testable drop target exists even for an empty or fully-collapsed folder (RESEARCH.md Pitfall 2), mirroring `BoardColumn.tsx`'s column-level `useDroppable` pattern
- New `dropZone` prop threads unchanged through the recursive `TreeNodeRow` render, driving a `before`/`after` reorder line (absolute-positioned edge indicator) or an `into` reparent highlight ring (folder rows only)
- `TreeSection.tsx` wraps the existing recursive tree render in a single `DndContext` (`PointerSensor` with an 8px activation distance, matching `BoardBlock.tsx`) and a flattened `SortableContext` used solely for drag-ordering registration and id lookups — the recursive indentation/expand-collapse JSX itself is untouched
- `onDragMove` computes the live drop zone via `computeDropZone()` using the dragged element's live translated rect as the vertical-center proxy (dnd-kit's documented pattern, since `DragMoveEvent` carries no raw pointer-Y field)
- `onDragEnd` dispatches: `useReorderTree()` for edge drops (siblings resolved via a small local `findFolderNode` DFS, scoped to the same `node_type`+`parent_id` per Pitfall 3), `useMoveTreeNode()` for into-folder reparents and for the dedicated `root-drop` droppable region (un-filing a project by setting `folder_id: null`, D-04)
- Illegal drops (cycle, depth-limit, permission) are never pre-validated client-side per the RESEARCH.md anti-pattern — the server's `AppError(400, "...")` message is surfaced verbatim as a toast; a 403 gets the friendly UI-SPEC fallback text ("You don't have permission to do this."), and any other failure gets a generic fallback ("Something went wrong moving this item.")

## Task Commits

Each task was committed atomically:

1. **Task 1: Register drag/drop targets and render drop-zone indicators in TreeNodeRow.tsx** - `f751111` (feat)
2. **Task 2: DndContext, root drop zone, drop-zone geometry, reorder/move/un-file dispatch, and illegal-drop error toast in TreeSection.tsx** - `536eb52` (feat)

## Files Created/Modified
- `apps/workspaces/src/components/tree/TreeNodeRow.tsx` - Added `dropZone` prop; `useSortable` drag registration for folder/project rows; `useDroppable` folder-drop hit-target for folder rows; before/after reorder-line and into reparent-ring rendering; wrapped folder rows in a droppable-ref div; threaded `dropZone` through the recursive `children.map(...)` call
- `apps/workspaces/src/components/tree/TreeSection.tsx` - Added `DndContext`/`SortableContext` wrapping the existing tree render; `useReorderTree`/`useMoveTreeNode` hook instances; `dropZone`/`dragError` state; `root-drop` `useDroppable` region on the tree container; `handleDragMove`/`handleDragEnd` handlers implementing reorder/reparent/un-file dispatch with try/catch error surfacing; a `findFolderNode` DFS helper for resolving the true sibling children array during reorder; the illegal-drop error toast (positioned `bottom-6 left-6`, distinct from `TreeUndoToast`'s `bottom-6 right-6`)

## Decisions Made
- Cast `event.over.rect`/`event.active.rect.current.translated` results `as DOMRect` at the two `computeDropZone()` call sites — dnd-kit's internal `ClientRect` type lacks `x`/`y`/`toJSON` that `DOMRect` declares, but `computeDropZone` (built in 34-01, contract fixed) only reads `top`/`height`, both present on `ClientRect`. Casting avoids modifying the already-shipped pure utility's signature for a TypeScript-only type mismatch.
- Sibling-list resolution for reorder uses a small `findFolderNode(nodes, id)` DFS helper defined locally in `TreeSection.tsx` rather than extending `treeDragUtils.ts` — it needs the full `TreeNode.children` array, which the flat `FlatTreeRow` shape returned by `flattenVisibleTree` doesn't carry (by design, per 34-01's pure/flat contract).
- `handleDragEnd`'s zone determination re-derives from `computeDropZone` as a fallback (`dropZone?.nodeId === overId ? dropZone.zone : computeDropZone(...)`) covering the edge case where `onDragEnd` fires without a matching prior `onDragMove` state update, per the plan's exact instruction.

## Deviations from Plan

None — plan executed exactly as written. One TypeScript-only adjustment (the `as DOMRect` cast noted above) was required to satisfy `computeDropZone`'s parameter type against dnd-kit's `ClientRect`; this is a type-compatibility fix (Rule 3 — blocking issue), not a behavioral or architectural change.

## Issues Encountered
None.

## Human Verification Needed

The plan's final task is `checkpoint:human-verify` (gate="blocking"). Per this project's `workflow.human_verify_mode` default (`end-of-phase`, not overridden in `.planning/config.json`), this executor did not halt mid-flight — the verification steps below are recorded here for the phase-level verifier/human-UAT harvest, consistent with how 34-04 and 34-05 recorded their checkpoints.

**What was built:** Drag-to-reorder and drag-to-reparent on folder/project tree rows, with edge-vs-middle drop-zone detection, empty/collapsed-folder drop targets, a root-level drop zone for un-filing projects, and illegal-drop error surfacing.

**How to verify (manual, live app):**
1. Drag a folder to a new position among its siblings (drop near the top/bottom edge of another sibling row) — confirm a line indicator appears during drag and the new order persists after a page reload.
2. Drag a project onto the middle of a different folder row — confirm a highlight ring appears during hover and the project moves under that folder after drop.
3. Drag a folder or project onto an empty or fully-collapsed folder — confirm the drop still works (no silent failure).
4. Drag a folder onto one of its own descendant folders — confirm the drop is rejected and a toast shows the exact text "Cannot move a folder into its own descendant" (not a generic message), and the tree does NOT silently snap back without explanation.
5. Nest a folder past the maximum depth (create/move folders until depth 3, then attempt one more level) — confirm the toast shows "Folder nesting cannot exceed depth 3".
6. Drag a root-filed project into a folder, then drag it back out onto empty root-level tree space (below the last row, or the section's empty background) — confirm it un-files (folder_id becomes null) rather than erroring.

**Resume signal (for the phase-level verification pass):** "approved" or a description of issues found.

## Next Phase Readiness
- All six TREEOPS requirements (TREEOPS-01 through TREEOPS-06) are now complete across the six plans in Phase 34.
- `TreeNodeRow.tsx`/`TreeSection.tsx` are feature-complete for this phase's scope: context menu, create, rename, archive/undo, and drag-to-reorder/reparent all coexist without conflicting state.
- No blockers for the phase-level verification pass; the checkpoint above (this plan) plus the checkpoints deferred by 34-04 and 34-05 should all be walked together per 34-VALIDATION.md's sampling rate.

---
*Phase: 34-drag-to-reorder-reparent-create-rename-archive-flows*
*Completed: 2026-07-20*

## Self-Check: PASSED
Both task commit hashes (f751111, 536eb52) found in git log. Both modified files (TreeNodeRow.tsx, TreeSection.tsx) exist on disk. `npx tsc --noEmit -p apps/workspaces/tsconfig.json` exits 0.
