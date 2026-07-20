---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
verified: 2026-07-20T14:39:42Z
status: gaps_found_then_resolved
score: 6/6 truths verified at code level after post-verification fix (commit 5ad7308); human UAT still pending
overrides_applied: 0
gaps:
  - truth: "A user can create a new folder or project at any level of the tree via a context menu"
    status: partial
    reason: "Folder creation is fully wired end-to-end (useCreateFolder -> invalidateFolderAffectedQueries invalidates qk.fullTree, new folder appears and auto-enters rename mode). Project creation is NOT: useCreateProject() in apps/workspaces/src/lib/hooks/useProjects.ts only invalidates qk.projects (['projects']), never qk.fullTree (['folders','tree','full']) -- the query TreeSection.tsx actually renders from (useFullTree()). TreeSection.handleCreateProject sets newlyCreatedId on mutation success regardless, but the new project row will not exist in the tree yet (no fullTree refetch), so the auto-rename-on-create effect in TreeNodeRow.tsx (matching autoFocusRenameId to node.id) can never fire, and the created project is invisible in the sidebar until an unrelated invalidation or the 60s staleTime elapses."
    artifacts:
      - path: "apps/workspaces/src/lib/hooks/useProjects.ts"
        issue: "useCreateProject (lines 113-119) onSuccess only calls qc.invalidateQueries({ queryKey: qk.projects }); does not invalidate qk.fullTree, unlike useArchiveProject/useUnarchiveProject (added in 34-01) which correctly invalidate both."
    missing:
      - "Add qc.invalidateQueries({ queryKey: qk.fullTree }) to useCreateProject's onSuccess."
  - truth: "A user can rename a folder or project inline from the tree"
    status: partial
    reason: "Folder rename works end-to-end (useUpdateFolder invalidates qk.fullTree via invalidateFolderAffectedQueries). Project rename does not visibly update the tree: useUpdateProject(id) in useProjects.ts (lines 101-111) only invalidates qk.project(id) and qk.projects, never qk.fullTree. TreeNodeRow.tsx's commitRename() calls updateProject.mutate({ name: trimmed }) for project nodes -- the backend PATCH succeeds but the sidebar tree (driven by useFullTree()) will keep showing the old name until an unrelated cache invalidation or the 60s staleTime elapses."
    artifacts:
      - path: "apps/workspaces/src/lib/hooks/useProjects.ts"
        issue: "useUpdateProject (lines 101-111) onSuccess does not invalidate qk.fullTree"
    missing:
      - "Add qc.invalidateQueries({ queryKey: qk.fullTree }) to useUpdateProject's onSuccess."
---

# Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows Verification Report

**Phase Goal:** Users can fully organize the workspace tree — creating, renaming, reordering, reparenting, and archiving folders/projects — with safe, clearly-communicated handling of illegal actions.
**Verified:** 2026-07-20T14:39:42Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a new folder or project at any level of the tree via a context menu | ⚠️ PARTIAL | Folder creation fully wired (`useCreateFolder` invalidates `qk.fullTree`). Project creation's `useCreateProject` never invalidates `qk.fullTree` — new project will not appear in the sidebar tree without an unrelated refetch. See gap above. |
| 2 | User can rename a folder or project inline from the tree | ⚠️ PARTIAL | Folder rename fully wired (`useUpdateFolder` invalidates `qk.fullTree`). Project rename's `useUpdateProject` never invalidates `qk.fullTree` — renamed project's new name will not show in the sidebar tree without an unrelated refetch. See gap above. |
| 3 | User can drag-to-reorder siblings within the same parent | ✓ VERIFIED | `TreeSection.handleDragEnd` computes sibling order via `flattenVisibleTree`/`findFolderNode` and dispatches `useReorderTree()` → `POST /folders/tree/reorder` (route confirmed in `folders.routes.ts` line 18); reorder line indicators rendered in `TreeNodeRow.tsx` (`isDropBefore`/`isDropAfter`). Mutation invalidates `qk.fullTree`. |
| 4 | User can drag-to-reparent a folder or project into a different folder; illegal drops rejected with clear inline reason | ✓ VERIFIED | `handleDragEnd`'s `into` branch dispatches `useMoveTreeNode()` → `POST /folders/tree/move` (confirmed route). `handleDragError` surfaces `ApiError.message` verbatim in a toast (matches UI-SPEC's requirement to show exact server text, e.g. "Cannot move a folder into its own descendant" / "Folder nesting cannot exceed depth 3"), with 403→friendly fallback and network-error→generic fallback, exactly per UI-SPEC Copywriting Contract. Root-level `root-drop` droppable un-files projects (`new_parent_id: null`) per D-04. Behavioral correctness (actual cycle/depth rejection, visual indicators) needs human confirmation — see Human Verification section. |
| 5 | User can archive a folder or project, with confirmation showing descendant count, archived nodes hidden but not deleted | ✓ VERIFIED | `ArchiveConfirmDialog.tsx` computes `countDescendants()` (pure DFS over `useFullTree()`-cached data), renders per-type breakdown or zero-descendant copy exactly per UI-SPEC contract, dispatches `useArchiveFolder`/`useArchiveProject` (both invalidate `qk.fullTree`/`qk.projects`). `pruneTree`/`isArchived` (Phase 33, confirmed present in `treeFilters.ts` and imported by `TreeSection.tsx`) already excludes archived nodes from the default view. `TreeUndoToast` renders only when `totalDescendants === 0` (`TreeSection.tsx` line 277), matching D-07. |

**Score:** 4/6 fully verified, 2 partial (project-specific create/rename cache-invalidation gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/components/tree/treeDragUtils.ts` | flattenVisibleTree + computeDropZone pure utilities | ✓ VERIFIED | Exists, substantive, wired into `TreeSection.tsx`/`TreeNodeRow.tsx` |
| `apps/workspaces/src/components/tree/treeArchiveCount.ts` | countDescendants pure DFS | ✓ VERIFIED | Exists, substantive, wired into `ArchiveConfirmDialog.tsx` |
| `apps/workspaces/src/lib/api/folders.api.ts` | archive/unarchive/reorder/moveNode wrappers | ✓ VERIFIED | All 4 methods present, match backend routes exactly |
| `apps/workspaces/src/lib/api/projects.api.ts` | archive/unarchive wrappers | ✓ VERIFIED | Both methods present, match backend routes |
| `apps/workspaces/src/lib/hooks/useFolders.ts` | 4 new mutation hooks, fullTree invalidation fix | ✓ VERIFIED | `useArchiveFolder`/`useUnarchiveFolder`/`useReorderTree`/`useMoveTreeNode` all invalidate `qk.fullTree` |
| `apps/workspaces/src/lib/hooks/useProjects.ts` | 2 new mutation hooks (archive/unarchive) | ⚠️ HOLLOW (partial) | `useArchiveProject`/`useUnarchiveProject` correctly invalidate `qk.fullTree`, but pre-existing `useCreateProject`/`useUpdateProject` (consumed by this phase's new create/rename UI) do not — see gaps |
| `apps/workspaces/src/components/tree/TreeContextMenu.tsx` | Dual-anchor popover component | ✓ VERIFIED | Both `button`/`point` anchor modes implemented, destructive styling present, `aria-label="Row actions"` present on kebab trigger (`TreeNodeRow.tsx` line 192) |
| `apps/workspaces/src/components/tree/ArchiveConfirmDialog.tsx` | Descendant-count breakdown dialog | ✓ VERIFIED | Matches UI-SPEC copy contract exactly, dispatches correct mutation by `node_type` |
| `apps/workspaces/src/components/tree/TreeUndoToast.tsx` | Zero-descendant undo toast | ✓ VERIFIED | Auto-dismiss 4s, matches UI-SPEC copy exactly |
| `apps/workspaces/src/components/tree/TreeNodeRow.tsx` | Context menu, inline rename, drag registration | ✓ VERIFIED | All wired; `useSortable`/`useDroppable` present, inline rename input with Enter/Escape/blur semantics matches `BoardColumn.tsx` convention |
| `apps/workspaces/src/components/tree/TreeSection.tsx` | Root create affordance, DndContext, archive/undo mounting | ✓ VERIFIED | `DndContext`+`SortableContext`+`root-drop` droppable present; `ArchiveConfirmDialog`/`TreeUndoToast` conditionally rendered against `archiveTarget`/`undoTarget` state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `TreeNodeRow.tsx` (folder context menu) | `useCreateFolder`/`useUpdateFolder` | `TreeSection.handleCreateFolder` / `commitRename` | ✓ WIRED | Full round-trip incl. tree refresh |
| `TreeNodeRow.tsx` (project context menu) | `useCreateProject`/`useUpdateProject` | `TreeSection.handleCreateProject` / `commitRename` | ⚠️ PARTIAL | Backend mutation dispatched correctly; tree-view refresh missing (no `qk.fullTree` invalidation) |
| `TreeSection.handleDragEnd` (reorder) | `POST /folders/tree/reorder` | `useReorderTree` | ✓ WIRED | Confirmed route exists in `folders.routes.ts`, hook invalidates `qk.fullTree` |
| `TreeSection.handleDragEnd` (reparent/un-file) | `POST /folders/tree/move` | `useMoveTreeNode` | ✓ WIRED | Confirmed route exists, hook invalidates `qk.fullTree` |
| `TreeNodeRow.tsx` (Archive action) | `ArchiveConfirmDialog` | `onArchive={setArchiveTarget}` | ✓ WIRED | State threaded correctly from row through `TreeSection` |
| `ArchiveConfirmDialog` | `useArchiveFolder`/`useArchiveProject` | node_type dispatch | ✓ WIRED | Both invalidate `qk.fullTree` |
| `TreeSection` archive success (0 descendants) | `TreeUndoToast` | `onArchived(node, total)` callback | ✓ WIRED | `undoTarget` set only when `total === 0` |
| `TreeUndoToast` Undo click | `useUnarchiveFolder`/`useUnarchiveProject` | `handleUndo` | ✓ WIRED | Both invalidate `qk.fullTree` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| TREEOPS-01 | 34-01, 34-02, 34-04 | Create folder/project via context menu at any tree level | ⚠️ PARTIAL | Folder create works; project create doesn't refresh tree view (cache-invalidation gap) |
| TREEOPS-02 | 34-04 | Rename folder/project inline | ⚠️ PARTIAL | Folder rename works; project rename doesn't refresh tree view (cache-invalidation gap) |
| TREEOPS-03 | 34-01, 34-06 | Drag-to-reorder siblings | ✓ SATISFIED | Code-level verified; visual/live behavior needs human confirmation |
| TREEOPS-04 | 34-01, 34-06 | Drag-to-reparent + illegal-drop clear reason | ✓ SATISFIED | Verbatim server error surfacing confirmed in code; needs human confirmation |
| TREEOPS-05 | 34-01, 34-02, 34-03, 34-05 | Archive with descendant-count confirmation | ✓ SATISFIED | Code-level verified; needs human confirmation |
| TREEOPS-06 | 34-03, 34-05 | Archived nodes hidden, not deleted; Undo | ✓ SATISFIED | `pruneTree`/`isArchived` (Phase 33) + zero-descendant Undo confirmed |

Note: `.planning/REQUIREMENTS.md` still shows TREEOPS-01 through TREEOPS-06 as `[ ]` unchecked / "Pending" in its coverage table — this appears to be a stale tracking artifact not yet updated to reflect Phase 34 completion, separate from the code-level gaps above.

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/`TBD`/placeholder/`console.log`-only patterns found in any of the 7 phase-modified/created tree files.

### TypeScript Compilation

`npx tsc --noEmit -p apps/workspaces/tsconfig.json` — exits 0, no errors. Confirms the orchestrator's clean-typecheck claim.

## Human Verification Required

Consolidated from all three deferred `checkpoint:human-verify` tasks (34-04, 34-05, 34-06), per `workflow.human_verify_mode = end-of-phase`. Recommend doing one pass through all items below. **Given the cache-invalidation gap found above, expect items 3 and 6 (project creation/rename) to visibly fail or require a manual page refresh — this is the root cause, not a UI/UX issue.**

### 1. Context menu, create, and inline rename (from 34-04)
**Test:** Hover a folder row (confirm kebab fades in and opens New Folder/New Project/Rename/Archive); right-click same row (same menu at cursor); click "New Folder" (child appears, auto-expanded, immediately editable, persists after reload); click "+" next to "Workspace" header (creates root-level nodes); right-click a project row (only Rename/Archive shown); trigger Rename + Escape (reverts); trigger Rename + clear + blur (retains original name).
**Expected:** All described behaviors work as stated.
**Why human:** Live UI interaction, visual affordance timing, and page-reload persistence can't be confirmed by static analysis.

### 2. Archive confirm dialog + Undo toast (from 34-05)
**Test:** Archive a folder with known descendants (dialog shows correct per-type breakdown, e.g. "This will also archive 2 projects, 3 pages.", zero-count types omitted); confirm and verify immediate disappearance from tree (no manual refresh); archive a leaf project with no children (dialog shows "no contents" copy, Undo toast appears after confirm); click Undo (project reappears); repeat descendant case and confirm no Undo toast appears.
**Expected:** All described behaviors work as stated.
**Why human:** Requires live click-through and visual confirmation of transient toast/dialog states.

### 3. Drag-to-reorder / drag-to-reparent (from 34-06)
**Test:** Drag a folder to reorder among siblings (line indicator during drag, order persists after reload); drag a project onto a folder's middle (highlight ring, project moves under folder); drag onto an empty/collapsed folder (drop still works); drag a folder onto its own descendant (rejected, toast shows exact text "Cannot move a folder into its own descendant"); nest folders past depth 3 (toast shows "Folder nesting cannot exceed depth 3"); drag a project out to root-level empty space (un-files, folder_id becomes null).
**Expected:** All described behaviors work as stated.
**Why human:** Drag-and-drop pointer interactions, visual indicator correctness, and exact toast text under live conditions require manual confirmation.

## Gaps Summary

The phase delivers a substantive, well-wired implementation for **folders**: create, rename, reorder, reparent, and archive/undo for folder nodes are all correctly connected end-to-end, including the tree-view cache invalidation needed for the sidebar to reflect changes immediately.

For **projects**, drag-to-reorder, drag-to-reparent, and archive/undo are also correctly wired (their hooks — `useArchiveProject`/`useUnarchiveProject`, and the reorder/move endpoints which are folder-domain-owned and node-type-agnostic — all invalidate `qk.fullTree`). However, **project creation and project inline-rename do not refresh the tree sidebar**, because the pre-existing `useCreateProject`/`useUpdateProject` hooks in `useProjects.ts` were never updated to invalidate `qk.fullTree`, unlike their folder counterparts. 34-01's SUMMARY.md claims "Fixed a pre-existing bug... for all six hooks that share the helper" — but this fix was scoped only to the shared `invalidateFolderAffectedQueries` helper in `useFolders.ts`; `useCreateProject`/`useUpdateProject` in `useProjects.ts` are separate hooks that were not touched, despite being the exact hooks 34-04 wired the new create/rename UI to for project nodes.

Practical effect: a user who creates a new project via the tree's context menu, or renames an existing project inline, will not see the change reflected in the sidebar tree without an unrelated refetch trigger or waiting out the 60-second `staleTime`. This contradicts the phase goal ("fully organize the workspace tree") for the project half of TREEOPS-01/02.

**This looks like an omission, not an intentional deviation** — no override is suggested. Fix: add `qc.invalidateQueries({ queryKey: qk.fullTree })` to both `useCreateProject`'s and `useUpdateProject`'s `onSuccess` in `apps/workspaces/src/lib/hooks/useProjects.ts`.

## Post-Verification Fix

**Status: RESOLVED** — commit `5ad7308` (`fix(34): invalidate qk.fullTree on project create/rename`) adds the missing `qc.invalidateQueries({ queryKey: qk.fullTree })` call to both `useCreateProject` and `useUpdateProject` in `useProjects.ts`, matching the folder hooks' behavior. `npx tsc --noEmit -p apps/workspaces/tsconfig.json` re-confirmed clean after the fix. TREEOPS-01 and TREEOPS-02 are now fully satisfied for both folders and projects. All 6/6 truths verified at the code level; the three consolidated Human Verification items above remain outstanding and require a live UAT pass.

---

*Verified: 2026-07-20T14:39:42Z*
*Verifier: Claude (gsd-verifier)*
