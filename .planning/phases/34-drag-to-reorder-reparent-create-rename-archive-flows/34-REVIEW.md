---
phase: 34-drag-to-reorder-reparent-create-rename-archive-flows
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - apps/workspaces/src/components/tree/ArchiveConfirmDialog.tsx
  - apps/workspaces/src/components/tree/TreeContextMenu.tsx
  - apps/workspaces/src/components/tree/TreeNodeRow.tsx
  - apps/workspaces/src/components/tree/TreeSection.tsx
  - apps/workspaces/src/components/tree/TreeUndoToast.tsx
  - apps/workspaces/src/components/tree/treeArchiveCount.ts
  - apps/workspaces/src/components/tree/treeDragUtils.ts
  - apps/workspaces/src/lib/api/folders.api.ts
  - apps/workspaces/src/lib/api/projects.api.ts
  - apps/workspaces/src/lib/hooks/useFolders.ts
  - apps/workspaces/src/lib/hooks/useProjects.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: partially_fixed
fixed:
  - "CR-01: fixed in commit f17e21d — cross-parent before/after drops now reparent via moveTreeNode instead of a same-parent reorderTree"
  - "WR-01: fixed in commit f17e21d — ArchiveConfirmDialog.handleArchive now catches mutateAsync rejections and surfaces an inline error message"
remaining:
  - WR-02 (kebab + right-click menu can both be open)
  - WR-03 (drag-error dismiss timer not tracked/cleared)
  - WR-04 (no client-side guard against folder-into-own-descendant drop)
  - WR-05 (dragging a folder onto root drop zone silently no-ops)
  - IN-01 through IN-05 (info-level)
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the drag-to-reorder/reparent/create/rename/archive tree feature. The DnD geometry helpers (`treeDragUtils.ts`), the archive descendant counter (`treeArchiveCount.ts`), and the API/hook layers are generally clean and consistent with project conventions. The most significant defect is in `TreeSection.tsx`'s `handleDragEnd`: the `before`/`after` reorder branch never verifies that the dragged node and the drop target share the same parent, so dropping an item next to a sibling in a *different* folder is sent to the backend as a same-parent reorder rather than a reparent — this can silently corrupt sort order or fail confusingly, depending on backend leniency. Several secondary issues were also found around unhandled promise rejections on archive failure, timer/lifecycle handling for the drag-error toast, and duplicated context-menu state.

## Critical Issues

### CR-01: Cross-parent before/after drop is treated as a same-parent reorder, not a reparent

**File:** `apps/workspaces/src/components/tree/TreeSection.tsx:134-157`
**Issue:** In `handleDragEnd`, the `zone === 'before' || zone === 'after'` branch only checks that `overRow.node_type === activeNodeType`. It does **not** check that `overRow.parentKey === activeRow.parentKey`. `parentKey` is derived from the drop target (`overRow.parentKey`), and the sibling list used to build `ordered_ids` is the target's sibling list — which will not include `activeId` at all (it's filtered from a different parent's children). The code nonetheless calls `reorderTree.mutateAsync({ node_type, parent_id: <target's parent>, ordered_ids })` with `activeId` spliced into that list.

Because `flattenVisibleTree` produces a single flat list mixing rows from multiple expanded folders and the root, it is trivial for a user to drag a project from Folder A and drop it "before"/"after" a project that lives in Folder B (or at root) — the drop lands on `zone === 'before'/'after'` (not `'into'`), so the intended semantic is "reparent + position", but the code only performs a reorder scoped to the wrong parent. If the backend's `/folders/tree/reorder` endpoint does not strictly validate that every id in `ordered_ids` already belongs to `parent_id`, this silently reassigns `sort_order` for a node that is not actually a child of that parent (data corruption: node disappears from its real folder's ordering, or ends up with a colliding sort position). If the backend does validate, the mutation fails with a generic error via `handleDragError`, and the user's drop appears to silently "not work" with no reparent occurring — even though visually it looked like a normal reorder.
**Fix:**
```ts
if (zone === 'before' || zone === 'after') {
  if (overRow.node_type !== activeNodeType) return;
  const parentKey = overRow.parentKey;

  if (parentKey !== activeRow.parentKey) {
    // Cross-parent drop: reparent first, then let the position be
    // determined by a subsequent reorder call (or pass position info
    // to /tree/move if the backend supports it).
    try {
      await moveTreeNode.mutateAsync({
        node_type: activeNodeType,
        node_id: activeId,
        new_parent_id: parentKey === 'root' ? null : parentKey,
      });
    } catch (err) {
      handleDragError(err);
    }
    return;
  }

  // ...existing same-parent reorder logic
}
```

## Warnings

### WR-01: Archive mutation errors are unhandled — unhandled promise rejection, no user feedback

**File:** `apps/workspaces/src/components/tree/ArchiveConfirmDialog.tsx:43-51`
**Issue:** `handleArchive` is an `async` function passed directly to `onClick`. `archiveFolder.mutateAsync`/`archiveProject.mutateAsync` reject on failure (e.g. 403 permission, 404 already-archived, network error). Because the returned promise from `handleArchive` is never awaited or caught by the caller, any rejection becomes an unhandled promise rejection in the browser console, `onClose()`/`onArchived()` are never called, and the dialog is left open with `isPending` reset to `false` and **no error message shown to the user**. This is inconsistent with the drag-and-drop error handling pattern already established in `TreeSection.tsx` (`handleDragError`).
**Fix:**
```tsx
async function handleArchive() {
  try {
    if (node.node_type === 'folder') {
      await archiveFolder.mutateAsync(node.id);
    } else {
      await archiveProject.mutateAsync(node.id);
    }
    onClose();
    onArchived(node, total);
  } catch (err) {
    // surface via local error state, e.g. setError('Failed to archive. Try again.')
  }
}
```

### WR-02: Kebab menu and right-click context menu can both be open simultaneously

**File:** `apps/workspaces/src/components/tree/TreeNodeRow.tsx:188-217`
**Issue:** `menuOpen` (kebab button) and `contextPoint` (right-click) are independent pieces of state, each rendering its own `TreeContextMenu` with its own backdrop/`onClose`. Nothing closes one when the other opens. Right-clicking a row's content while the kebab menu is already open (both live on the same row and are simultaneously reachable — the row's `onContextMenu` handler is not disabled while `menuOpen` is true) results in two overlapping `TreeContextMenu` instances stacked at the same `z-30`, each with its own full-viewport backdrop. Clicking an action in one closes only that menu, leaving the other menu's backdrop/panel still mounted.
**Fix:** Track a single `activeMenu: 'button' | 'point' | null` state (or close the other on open) instead of two independent booleans/nullable states:
```ts
const [activeMenu, setActiveMenu] = useState<{ type: 'button' } | { type: 'point'; x: number; y: number } | null>(null);
// onContextMenu: setActiveMenu({ type: 'point', x: e.clientX, y: e.clientY })
// kebab onClick: setActiveMenu(activeMenu ? null : { type: 'button' })
```

### WR-03: Drag-error dismiss timers are untracked — overlapping errors can be dismissed early, and no cleanup on unmount

**File:** `apps/workspaces/src/components/tree/TreeSection.tsx:68-75`
**Issue:** `handleDragError` calls `setTimeout(() => setDragError(null), 4000)` on every invocation without storing/clearing the previous timer id. If two drag errors occur within 4 seconds of each other (e.g. two quick failed drags), the first timer fires and clears `dragError` early — cutting the second error's visible time down to whatever remained of the first timer's window instead of a full 4s. Additionally, unlike `TreeUndoToast.tsx` (which properly clears its timer in a `useEffect` cleanup), this timer is not tied to a `useEffect`/ref and is never cleared if the component unmounts before it fires.
**Fix:**
```ts
const dragErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const handleDragError = (err: unknown) => {
  if (dragErrorTimer.current) clearTimeout(dragErrorTimer.current);
  setDragError(/* ... */);
  dragErrorTimer.current = setTimeout(() => setDragError(null), 4000);
};
// clear dragErrorTimer.current in a useEffect cleanup on unmount
```

### WR-04: No client-side guard against dropping a folder onto its own descendant

**File:** `apps/workspaces/src/components/tree/TreeSection.tsx:158-165`
**Issue:** The `zone === 'into'` branch only checks `overRow.node_type !== 'folder'`; it does not check whether `overId` is a descendant of `activeId` (for folder-into-folder drops). Nothing in the visible tree/drop-zone computation prevents highlighting or attempting to drop Folder A onto Folder B when B is currently nested inside A, which would create a parent cycle. Whether the backend rejects this is unverified (out of this review's scope), but the client renders the tree recursively without cycle detection in several places (`TreeNodeRow`'s recursive `node.children.map`, `countDescendants`'s `walk`, `flattenVisibleTree`'s recursion, `findFolderNode`'s recursion) — if a cycle were ever persisted, these would recurse indefinitely and crash/hang the tree UI on the next load.
**Fix:** Before calling `moveTreeNode.mutateAsync` for a folder-into-folder drop, walk `overRow`'s ancestor chain (or check `findFolderNode(activeRow's subtree, overId)`) and no-op with a user-facing message if `overId` is `activeId` or one of its descendants.

### WR-05: Dragging a folder onto the root drop zone silently no-ops

**File:** `apps/workspaces/src/components/tree/TreeSection.tsx:111-119`
**Issue:** `if (overId === 'root-drop') { if (activeNodeType !== 'project') return; ... }` means dropping a folder onto the dedicated root drop zone does nothing at all — no error toast, no visual rejection, the dragged row just snaps back. From the user's perspective this looks like a failed/broken interaction rather than an intentionally-disallowed one, especially since projects support the same gesture successfully.
**Fix:** Either support moving folders to root via the same code path (if the backend endpoint supports `new_parent_id: null` for folders), or surface a message (e.g. via `handleDragError`-style toast) explaining why the drop was rejected instead of silently returning.

## Info

### IN-01: `qk.fullTree` query-key literal duplicated across two hook files

**File:** `apps/workspaces/src/lib/hooks/useFolders.ts:9`, `apps/workspaces/src/lib/hooks/useProjects.ts:17`
**Issue:** The exact same query key tuple `['folders', 'tree', 'full']` is hand-duplicated in both files (the comment in `useProjects.ts` even calls out that it "must match... exactly"). This is a magic-string coupling that will silently break cache invalidation if either literal is edited without updating the other.
**Fix:** Export `qk.fullTree` from `useFolders.ts` and import it in `useProjects.ts` instead of redefining the literal.

### IN-02: `foldersApi.moveNode` has an `unknown` return type at the API boundary

**File:** `apps/workspaces/src/lib/api/folders.api.ts:58-63`
**Issue:** Every other `foldersApi` method returns a concrete shape (`Folder`, `TreeNode[]`, etc.); `moveNode` returns `Promise<unknown>`. This is weaker typing than the rest of the file and than the project convention of fully-specified types.
**Fix:** Type the response based on the backend `/tree/move` contract (e.g. `{ node_type: string; node_id: string; new_parent_id: string | null }`) instead of `unknown`.

### IN-03: Point-anchored context menu is not clamped to the viewport

**File:** `apps/workspaces/src/components/tree/TreeContextMenu.tsx:32-49`
**Issue:** `panelStyle = { left: anchor.x, top: anchor.y }` with `position: fixed` places the menu directly at the right-click coordinates with no bounds check. Right-clicking near the bottom-right of the viewport can render the 48-unit-wide/variable-height menu partially or fully off-screen.
**Fix:** Clamp `left`/`top` against `window.innerWidth`/`innerHeight` minus the menu's rendered dimensions (e.g. via a ref + `useLayoutEffect`, or `clamp(anchor.x, 0, window.innerWidth - MENU_WIDTH)`).

### IN-04: Unchecked type cast on dnd-kit's `over.rect`

**File:** `apps/workspaces/src/components/tree/TreeSection.tsx:96,130`
**Issue:** `event.over.rect as DOMRect` force-casts dnd-kit's internal rect type (which is not actually a `DOMRect` — it lacks methods like `toJSON`) to `DOMRect`. It happens to work because only `.top`/`.height` are read, but the cast hides any future mismatch and bypasses TypeScript's structural check.
**Fix:** Define a minimal local type (`{ top: number; height: number }`) for `computeDropZone`'s `overRect` parameter instead of asserting the full `DOMRect` shape.

### IN-05: `countDescendants` has no fallback for unrecognized node types

**File:** `apps/workspaces/src/components/tree/treeArchiveCount.ts:23-28`
**Issue:** `counts[child.node_type] += 1` assumes `child.node_type` is always one of the five keys initialized in `counts`. This is currently true because `TreeNode['node_type']` and `DescendantCounts`'s keys are kept in sync by hand, but there is no compiler or runtime safeguard — if the `TreeNode` union is extended in `folders.api.ts` without updating `DescendantCounts`, this becomes `counts[undefined] += 1` → `NaN`, silently corrupting the archive confirmation count/copy.
**Fix:** Use an exhaustive switch or `Record`-driven increment with a `default` no-op branch, or add a type-level assertion (`node_type extends keyof DescendantCounts`) that fails to compile if the unions diverge.

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
