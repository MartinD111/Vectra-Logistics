# Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows - Research

**Researched:** 2026-07-20
**Domain:** React/Next.js tree UI — drag-and-drop reordering/reparenting, first-ever context menu component, inline rename, archive confirmation + toast, all wired to already-shipped backend endpoints
**Confidence:** HIGH

## Summary

This is a UI-only phase. Every backend capability it needs already exists and was verified by reading the source directly: `folders.routes.ts` / `folders.service.ts` (Phase 31/32) expose `POST /folders`, `PATCH /folders/:id`, `POST /folders/:id/archive`, `POST /folders/:id/unarchive`, `POST /folders/tree/reorder`, `POST /folders/tree/move`; `projects.routes.ts` exposes the equivalent create/update/archive/unarchive set for projects. All are gated by `requireCapability('workspace.admin')` and return `AppError(400/403/404, message)` serialized as `{ error: message }` by the global `errorHandler` — `apiFetch`'s `ApiError.message` already carries that exact string, so surfacing "Cannot move a folder into its own descendant" or "Folder nesting cannot exceed depth 3" verbatim requires zero extra plumbing.

The critical gap this research surfaces: **none of this backend surface is wrapped on the frontend yet.** `apps/workspaces/src/lib/api/folders.api.ts` has no `archive`, `unarchive`, `reorder`, or tree `move` (node-dispatch) wrappers — only the older single-folder `move()` (`PATCH /:id/move`). `apps/workspaces/src/lib/api/projects.api.ts` has no `archive`/`unarchive` wrappers at all. `useFolders.ts`/`useProjects.ts` mirror that gap. **Building these API/hook wrappers is Wave 0 work for this phase**, not incidental — every subsequent task (context menu, drag, archive dialog) depends on them existing first.

For drag-and-drop, the codebase already uses `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (all pre-installed, versions pinned below) in `BoardBlock.tsx`/`BoardColumn.tsx`/`BoardCard.tsx` for a two-level (column → card) Kanban board. That pattern (`DndContext` + `useSortable` per draggable row + a custom `handleDragEnd` that inspects `active`/`over` ids) is directly reusable, but the Board pattern has no notion of "drop near the edge = reorder, drop in the middle = reparent" — the tree needs a small bespoke addition (pointer-Y-relative-to-row-bounds detection) layered on top of the same primitives. No official dnd-kit tree preset exists as a maintained first-party package; the community pattern (confirmed via web search) is to flatten the visible (expanded) tree into one flat list with a depth attribute and run a single `DndContext`/`SortableContext` over that flat list — this is the right shape for D-02's edge/middle distinction and avoids introducing a new third-party dependency (`dnd-kit-sortable-tree`), consistent with the "reuse over rebuild" project constraint.

There is no context-menu component anywhere in this codebase (`packages/ui` or any app) — confirmed by search. The closest existing pattern is the `ViewSettingsMenu.tsx`-style anchored popover: a trigger button, `useState` open/close, an `absolute`-positioned panel, and a `fixed inset-0 z-20` invisible backdrop `<div>` for click-outside-to-close. That pattern covers the kebab-button trigger (D-08) directly; the right-click trigger needs a small variant that positions the same panel at cursor coordinates (`e.clientX/clientY`) instead of anchoring to a button, captured via `onContextMenu` with `e.preventDefault()`.

There is no toast/notification library in the codebase either. The one existing "toast" is a bespoke one-off in `KanbanMigrationGate.tsx`: local `useState<boolean>`, a `fixed bottom-6 right-6` styled `<div>`, and a `setTimeout(() => setShowToast(false), 4000)`. This is the pattern to replicate for the Undo-toast (D-07), not a new dependency.

**Primary recommendation:** Add the missing frontend API/hook wrappers first (Wave 0), then build three new leaf components — `TreeContextMenu` (kebab + right-click, reusing the anchored-popover pattern), `TreeDropIndicator`/drag logic layered onto the existing dnd-kit primitives via a flattened-visible-tree approach, and `ArchiveConfirmDialog` (descendant-count breakdown via a `treeFindPath.ts`-style DFS walk) — then wire them into `TreeNodeRow.tsx`/`TreeSection.tsx` without disturbing Phase 33's read-only rendering contract.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Create/rename/archive folder or project | Frontend Server (Next.js client component) | API / Backend | UI triggers via context menu + inline input; all validation/mutation happens through existing `folders`/`projects` domain services — no new backend logic |
| Drag-to-reorder siblings | Browser / Client | API / Backend | Pure client-side drag interaction (dnd-kit) computing a new `ordered_ids` array; persisted via `POST /folders/tree/reorder` |
| Drag-to-reparent | Browser / Client | API / Backend | Client detects reparent vs. reorder via drop-position geometry; persisted via `POST /folders/tree/move`; cycle/depth validation is 100% server-side (already shipped, do not duplicate client-side) |
| Illegal-drop error surfacing | Browser / Client | — | Client reads `ApiError.message` from the rejected mutation and renders it — no client-side pre-validation logic needed for cycles/depth (server is source of truth) |
| Archive descendant-count breakdown | Browser / Client | — | Computed from the already-cached `useFullTree()` result via a tree walk; no new API call |
| Archived-node hiding from default view | Browser / Client | API / Backend (partial) | `folders`/`projects`/`programs` are filtered server-side already (queries exclude `archived_at IS NOT NULL`); `treeFilters.ts`'s `pruneTree()` already handles the two node types (`data_collection`, `project_page`) where server-side filtering is absent — no change needed to this filter, just confirm the newly-archived folder/project disappears via the standard `useFullTree()` re-fetch/cache-invalidation |

## User Constraints

<user_constraints>
### Locked Decisions (from CONTEXT.md)

- **D-01:** Whole tree row is draggable (not a dedicated grip handle) — matches existing dnd-kit Board usage patterns (whole-card draggable) already in the codebase.
- **D-02:** Position-based drop distinction — dropping near the top/bottom edge of a row = reorder (line indicator between rows); dropping over the middle of a folder row = reparent into it (folder highlight). Standard pattern (Notion, VS Code explorer).
- **D-03 (confirmed):** Only folders and projects are draggable this phase. Programs/pages/collections are not drag targets — matches TREEOPS-03/04 wording and the REQUIREMENTS.md TREEOPS2-01 deferral.
- **D-04 (confirmed):** Dropping a project at root level un-files it (`folder_id` → null) — matches existing supported behavior; `moveNode`'s project branch already supports clearing `folder_id` via `setProjectFolder`.
- **D-05:** Confirmation dialog shows a descendant-count breakdown by type (e.g. "3 folders, 5 projects, 12 pages"), not just a single total. Computed via a tree-walk (same technique as `treeFindPath.ts`), no new API call needed.
- **D-06:** Same `ArchiveConfirmDialog` component handles both folder and project archiving — the descendant breakdown is naturally empty/zero for a leaf project with no children, so no separate dialog variant is needed.
- **D-07 (Undo, revised after backend check):** `unarchiveFolder`/`unarchiveProject` only restore the single node — they do **not** cascade-restore descendants. Show an "Undo" toast **only when the archived node has zero descendants**. When descendants exist, skip Undo entirely. Do NOT build a cascade-unarchive endpoint this phase.
- **D-08:** Context menu triggers via right-click AND a visible "⋮" kebab button that appears on row hover. No context-menu component exists in the codebase yet; this phase builds the first one.
- **D-09 (confirmed):** Menu actions are exactly: New Folder, New Project, Rename, Archive (New Folder/New Project only on folder rows and root; Rename/Archive on folder and project rows). No "Move to..." picker or other actions added.
- **D-10:** "New Folder"/"New Project" from a folder's context menu creates the new node as a **child of the right-clicked folder**. Triggering from empty tree space / the tree section root creates a root-level node.

### Claude's Discretion

- **Illegal-drop feedback mechanism (not deep-dived):** TREEOPS-04 requires a clear inline reason for illegal drops (cycles, permission, depth-limit) rather than a silent snap-back. The API already returns clean, user-presentable error messages for the two known illegal-move cases: `"Cannot move a folder into its own descendant"` (400, cycle) and `"Folder nesting cannot exceed depth 3"` (400, depth limit) — both from `moveFolder`. Researcher/planner should decide the exact presentation (toast vs. inline tooltip near the drop point vs. shake+message) but MUST surface the API's actual error message text, not a generic "invalid move" string.
- Inline rename trigger/interaction details (double-click vs. menu-only trigger, Enter/Escape/blur handling, empty-name validation) — follow existing inline-edit patterns already in the codebase (`EditableRichText.tsx`, `PageHeader.tsx`) rather than inventing a new pattern.
- Exact visual styling of drag indicators (line color/thickness, folder highlight style) — implementation detail, follow existing Tailwind/design tokens used elsewhere in the sidebar.

### Deferred Ideas (OUT OF SCOPE)

- **"Move to..." picker as a non-drag alternative** — not added this phase; drag-and-drop plus the existing per-row context menu cover TREEOPS-01/02/04/05 as scoped.
- **Cascade-unarchive endpoint** — `unarchiveFolder`/`unarchiveProject` currently restore only the single node, not cascaded descendants. Explicitly deferred, not added to this phase's backend scope.
- **TREEOPS2-01** (deeper cross-entity drag: pages/records directly into projects) and **TREEOPS2-02** (bulk multi-select archive/move) — already tracked in REQUIREMENTS.md as v2/deferred.
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| TREEOPS-01 | Create new folder/project at any level via context menu | `TreeContextMenu` component (new) + existing `POST /folders`, `POST /projects` (already client-wrapped via `foldersApi.create`/`projectsApi.create`) |
| TREEOPS-02 | Rename folder/project inline from the tree | Inline `<input>` pattern lifted from `BoardColumn.tsx`'s `commitRename` (closer fit than `EditableRichText`'s contentEditable) + existing `PATCH /folders/:id`/`PATCH /projects/:id` (already wrapped via `foldersApi.update`/`projectsApi.update`) |
| TREEOPS-03 | Drag-to-reorder siblings within same parent | Flattened-visible-tree + dnd-kit `DndContext`/`SortableContext`, persisted via **new** `foldersApi.reorderNodes()` wrapper around `POST /folders/tree/reorder` (not yet client-wrapped) |
| TREEOPS-04 | Drag-to-reparent with illegal drops surfaced inline (not silent snap-back) | Same drag infra, edge-vs-middle geometry (D-02) decides reorder vs. reparent; reparent persisted via **new** `foldersApi.moveNode()` wrapper around `POST /folders/tree/move`; `ApiError.message` from a rejected mutation is the exact server error string (verified format: `{ error: "..." }`) |
| TREEOPS-05 | Archive with descendant-count confirmation | `ArchiveConfirmDialog` (new) walking the cached `useFullTree()` result (same DFS technique as `treeFindPath.ts`), persisted via **new** `foldersApi.archive()`/`projectsApi.archive()` wrappers around `POST /folders/:id/archive`/`POST /projects/:id/archive` (not yet client-wrapped) |
| TREEOPS-06 | Archived nodes hidden from default tree, not deleted | Already handled server-side (folders/projects/programs queries exclude archived rows) + `treeFilters.ts`'s existing `pruneTree()`/`isArchived()` for the two node types needing client-side filtering — verify but do not rebuild |
</phase_requirements>

## Standard Stack

### Core (already installed — verified in `apps/workspaces/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | ^6.3.1 [VERIFIED: apps/workspaces/package.json] | Drag context, sensors, collision detection | Already the sole DnD library in this codebase (Board views) |
| `@dnd-kit/sortable` | ^10.0.0 [VERIFIED: apps/workspaces/package.json] | `useSortable`, `SortableContext`, `arrayMove` | Already used for within-column card reorder |
| `@dnd-kit/modifiers` | ^9.0.0 [VERIFIED: apps/workspaces/package.json] | Drag constraint modifiers (e.g. `restrictToWindowEdges`, `restrictToVerticalAxis`) | Already used in `dispatch/page.tsx`; `restrictToVerticalAxis` is directly applicable to a vertical tree list |
| `@dnd-kit/utilities` | ^3.2.2 [VERIFIED: apps/workspaces/package.json] | `CSS.Transform.toString` for drag transform styling | Already used in `BoardCard.tsx` |
| `@tanstack/react-query` | (workspace-pinned, per project stack doc) | Server state for the new archive/reorder/move mutations | Established pattern (`useMutation` + `invalidateFolderAffectedQueries`) already in `useFolders.ts` |
| `lucide-react` | 0.294.0 [CITED: package.json across apps] | Icons for context menu items (Folder, FolderKanban, Pencil, Archive, MoreVertical) | Consistent with `ICON_BY_TYPE` map already in `TreeNodeRow.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new required | — | — | This phase should not add new npm dependencies — every UI primitive it needs (drag, popover, toast, inline edit) has a directly analogous existing in-house pattern (Board views, `ViewSettingsMenu`, `KanbanMigrationGate`, `BoardColumn`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bespoke flattened-tree drag logic on top of existing dnd-kit primitives | `dnd-kit-sortable-tree` (npm) [ASSUMED — found via WebSearch, not verified against Context7/official docs; would need slopcheck + registry verification before use] | Ready-made but: (1) violates "reuse over rebuild" constraint since equivalent primitives are already installed and used elsewhere in the codebase, (2) its `SortableTree`/`TreeItemComponent` API doesn't natively express D-02's "edge = reorder, middle = reparent" distinction without still writing custom collision logic, (3) new dependency surface for a one-phase feature. **Not recommended.** |
| Bespoke context menu | A UI library's `DropdownMenu`/`ContextMenu` primitive (e.g. Radix) | No such library exists in `packages/ui` today; introducing one is a larger decision than this phase's scope (D-08 explicitly frames this as "this phase builds it from scratch") |
| Bespoke toast | A toast library (e.g. `sonner`, `react-hot-toast`) | No toast library exists in the codebase; the one precedent (`KanbanMigrationGate.tsx`) is a bespoke one-off `fixed` div + `setTimeout`, which is sufficient for this phase's single Undo-toast use case |

**Installation:** None — no new packages required.

**Version verification:** All four `@dnd-kit/*` packages and `lucide-react` were confirmed present via direct read of `apps/workspaces/package.json` (not a registry lookup, since these are already-installed pinned dependencies, not new additions).

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. All required drag-and-drop, state-management, and icon primitives are already present in `apps/workspaces/package.json` and used elsewhere in the codebase (see Standard Stack above). If the planner's "Alternatives Considered" review revisits `dnd-kit-sortable-tree`, it MUST run the full Package Legitimacy Gate protocol before adding it — it has not been vetted in this research pass.

## Architecture Patterns

### System Architecture Diagram

```
User right-clicks a tree row  ─┐
User hovers row → clicks "⋮"  ─┴──► TreeContextMenu opens (anchored popover
                                      or cursor-positioned panel)
                                      │
                          ┌───────────┼────────────────┬───────────────┐
                          ▼           ▼                ▼               ▼
                    "New Folder"  "New Project"     "Rename"       "Archive"
                          │           │                │               │
                          ▼           ▼                ▼               ▼
                 foldersApi.create projectsApi.create  Inline <input>  ArchiveConfirmDialog
                 (parent_id =      (folder_id =         mode on row    (walks cached tree →
                  right-clicked     right-clicked        │              descendant counts)
                  folder.id)        folder.id)           ▼                    │
                          │           │            foldersApi.update /        ▼
                          │           │            projectsApi.update    User confirms
                          └─────┬─────┘                  │                    │
                                ▼                         │                    ▼
                    useFullTree() cache invalidated ◄─────┴───── foldersApi.archive() /
                    (React Query) → sidebar re-renders          projectsApi.archive()
                                                                       │
                                                                       ▼
                                                          If zero descendants: show
                                                          Undo toast (calls unarchive)

User drags a tree row  ──────► DndContext (flattened visible-tree list)
                                      │
                          onDragMove: compute pointer-Y position within
                          the hovered row's bounding rect
                                      │
                          ┌───────────┴────────────┐
                          ▼                         ▼
                 near top/bottom edge         over middle of a folder row
                 → show line indicator        → show folder highlight
                 (reorder mode)               (reparent mode)
                          │                         │
                          ▼                         ▼
                 onDragEnd: build new        onDragEnd: call
                 ordered_ids for the         foldersApi.moveNode()
                 affected parent →           (or projectsApi/programsApi
                 foldersApi.reorderNodes()   equivalent dispatch)
                          │                         │
                          └────────────┬────────────┘
                                       ▼
                         On 400 (cycle/depth/permission):
                         read ApiError.message verbatim,
                         surface as toast/inline message —
                         NOT a generic "invalid move" string
                                       ▼
                         On success: invalidate useFullTree()
                         cache → sidebar re-renders with new order/parent
```

### Recommended Project Structure
```
apps/workspaces/src/
├── lib/
│   ├── api/
│   │   ├── folders.api.ts       # EXTEND: add archive/unarchive/reorder/moveNode wrappers
│   │   └── projects.api.ts      # EXTEND: add archive/unarchive wrappers
│   └── hooks/
│       ├── useFolders.ts        # EXTEND: add useArchiveFolder/useUnarchiveFolder/useReorderTree/useMoveTreeNode
│       └── useProjects.ts       # EXTEND: add useArchiveProject/useUnarchiveProject
├── components/
│   └── tree/
│       ├── TreeSection.tsx      # EXTEND: wrap rows in DndContext, render ArchiveConfirmDialog
│       ├── TreeNodeRow.tsx      # EXTEND: add drag handle/listeners, hover kebab, right-click handler, inline rename mode
│       ├── TreeContextMenu.tsx  # NEW: anchored popover + cursor-positioned variant
│       ├── ArchiveConfirmDialog.tsx  # NEW: descendant-count breakdown + confirm/cancel
│       ├── treeDragUtils.ts     # NEW: flatten-visible-tree, edge/middle geometry detection
│       ├── treeArchiveCount.ts  # NEW: DFS descendant-count-by-type walk (mirrors treeFindPath.ts)
│       └── treeFilters.ts       # UNCHANGED — already handles archived-node hiding for the two gap node types
```

### Pattern 1: Flattened-visible-tree drag list (not nested SortableContext)
**What:** Before rendering the draggable tree, compute a flat array of `{ id, node_type, parentKey, depth }` for only the currently *visible* rows (respecting each folder's expand/collapse state from `useExpandedTreeNodes()`), and drive a single top-level `DndContext` + `SortableContext` over that flat array's ids — the same shape `BoardBlock.tsx` already uses for its single-level card list, just computed dynamically from the tree + expand state instead of a fixed `records` array.
**When to use:** Any time the number of active `SortableContext` regions needs to stay at exactly one (nested `SortableContext`s do not support cross-context drags without extra coordinatation code — confirmed via web research on dnd-kit tree patterns).
**Example:**
```typescript
// Source: pattern adapted from apps/workspaces/src/components/projectPage/board/BoardBlock.tsx
// (existing DndContext + closestCenter + handleDragEnd usage), generalized to a
// dynamically-flattened tree instead of a static records array.
function flattenVisibleTree(
  nodes: TreeNode[],
  expanded: Set<string>,
  depth = 0,
  parentKey: string | 'root' = 'root',
): FlatTreeRow[] {
  return nodes
    .filter((n) => n.node_type === 'folder' || n.node_type === 'project') // D-03: only these are drag targets
    .flatMap((n) => {
      const row: FlatTreeRow = { id: n.id, node_type: n.node_type, parentKey, depth };
      const childRows = n.node_type === 'folder' && expanded.has(n.id)
        ? flattenVisibleTree(n.children, expanded, depth + 1, n.id)
        : [];
      return [row, ...childRows];
    });
}
```

### Pattern 2: Edge-vs-middle drop-zone detection (D-02)
**What:** On `DndContext`'s `onDragMove` (fires continuously during drag, unlike `onDragEnd`), read the `over.rect` bounding box and the pointer's current Y position, then compute the pointer's fractional position within that row (e.g. `(pointerY - over.rect.top) / over.rect.height`). Values in roughly the top/bottom 25% → reorder-before/reorder-after; the middle 50% → reparent-into (only valid when the hovered row is a folder, per D-03/D-04 semantics — projects can't contain children).
**When to use:** Every drag-move tick while a row is hovered; store the computed zone in local state to drive the line-indicator vs. folder-highlight visual and to determine which mutation `onDragEnd` should call.
**Example:**
```typescript
// Source: geometry pattern is standard (VS Code Explorer / Notion), no direct
// dnd-kit official recipe exists for this exact split — synthesized from
// dnd-kit's documented onDragMove/over.rect API (docs.dndkit.com/api-documentation/context-provider).
function computeDropZone(pointerY: number, overRect: DOMRect, overIsFolder: boolean): 'before' | 'after' | 'into' {
  const relative = (pointerY - overRect.top) / overRect.height;
  if (overIsFolder && relative > 0.25 && relative < 0.75) return 'into';
  return relative < 0.5 ? 'before' : 'after';
}
```

### Pattern 3: Anchored popover for kebab trigger (reuse `ViewSettingsMenu.tsx` shape)
**What:** `useState<boolean>` open/close, a trigger `<button>`, an `absolute`-positioned panel plus a `fixed inset-0 z-20` invisible backdrop `<div onClick={close}>` for click-outside dismissal. This exact shape is already proven in `ViewSettingsMenu.tsx` and should be copied structurally for `TreeContextMenu`'s kebab-trigger variant.
**When to use:** Kebab-button trigger (D-08 discoverability path).
**Example:**
```tsx
// Source: apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx (lines 109-121)
<div className="relative">
  <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Row actions">
    <MoreVertical className="w-4 h-4" />
  </button>
  {open && (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
      <div className="absolute right-0 top-full mt-1 z-30 ...">{/* menu items */}</div>
    </>
  )}
</div>
```

### Pattern 4: Cursor-positioned variant for right-click trigger
**What:** Same panel content as Pattern 3, but positioned via `style={{ position: 'fixed', left: e.clientX, top: e.clientY }}` instead of `absolute`-anchored to a button, triggered from `onContextMenu={(e) => { e.preventDefault(); openAt(e.clientX, e.clientY); }}` on the row.
**When to use:** Right-click trigger (D-08 desktop power-user path). Both triggers should render the *same* menu-item list/component — only the positioning wrapper differs — so `TreeContextMenu` should accept an `anchor: { type: 'button', ref } | { type: 'point', x, y }` prop rather than being two separate components.

### Pattern 5: Inline rename via a controlled `<input>` swapped in for row text (D-02/TREEOPS-02)
**What:** `BoardColumn.tsx`'s `commitRename` pattern (a boolean `renaming` state, a `titleDraft` string state, `autoFocus` input, commit-on-blur, Enter commits, Escape reverts) is the closer, simpler fit for tree-row rename than `EditableRichText.tsx`'s contentEditable+DOMPurify rich-text machinery — a folder/project name is plain text, not rich HTML.
**Example:**
```tsx
// Source: apps/workspaces/src/components/projectPage/board/BoardColumn.tsx (lines 46-63, 86-107)
const [renaming, setRenaming] = useState(false);
const [draft, setDraft] = useState(node.name);
const commitRename = () => {
  setRenaming(false);
  const trimmed = draft.trim();
  if (!trimmed || trimmed === node.name) return; // empty-name validation: revert, don't submit
  updateMutation.mutate({ id: node.id, data: { name: trimmed } });
};
// <input autoFocus value={draft} onChange={...} onBlur={commitRename}
//   onKeyDown={(e) => {
//     if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
//     if (e.key === 'Escape') { setDraft(node.name); setRenaming(false); }
//   }} />
```

### Pattern 6: Bespoke auto-dismiss toast (D-07 Undo)
**What:** `KanbanMigrationGate.tsx`'s exact shape — local boolean state, `fixed bottom-6 right-6 z-50` styled div, `setTimeout(() => setShow(false), N)`. For the Undo toast, add a click handler that calls `unarchiveFolder`/`unarchiveProject` and clears the timeout/state immediately on click.
**Example:**
```tsx
// Source: apps/workspaces/src/components/projectPage/KanbanMigrationGate.tsx (lines 46-56)
{showUndoToast && (
  <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 rounded-xl text-sm border bg-white dark:bg-slate-900 shadow-lg">
    <span>"{archivedName}" archived.</span>
    <button onClick={handleUndo} className="font-semibold text-primary-600 hover:opacity-70">Undo</button>
  </div>
)}
```

### Anti-Patterns to Avoid
- **Client-side cycle/depth pre-validation before calling `moveNode`:** The server (`moveFolder`) is the sole source of truth for cycle/depth legality (Phase 31). Do not reimplement `ancestor_ids.includes(id)` checks client-side "for a snappier UX" — it risks drifting out of sync with the server's actual rule and duplicates logic the CLAUDE.md constraint explicitly warns against ("avoid duplicate/conflicting business logic between old and new code" — same principle applies here even though this is a new/new conflict, not old/new).
- **Nested `SortableContext` per folder level:** Mirroring `BoardColumn`'s one-`SortableContext`-per-column shape naively (one per tree folder) breaks cross-parent drags (reparent) because dnd-kit's sortable strategy assumes same-context reordering; use the single flattened-list approach instead (Pattern 1).
- **Generic "Invalid move" toast text:** TREEOPS-04 explicitly requires the *specific* reason. Always propagate `ApiError.message` from the rejected mutation, never a hardcoded fallback string except for genuinely non-AppError failures (network errors, etc.).
- **A second full-screen modal library for `ArchiveConfirmDialog`:** `FolderModal.tsx` already demonstrates the exact modal shell pattern used in this codebase (`fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm` wrapper, `rounded-2xl bg-white dark:bg-dark-card` card) — reuse that shell, don't invent new modal chrome.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Cycle/depth-limit validation for reparent | A client-side ancestor-chain walker mirroring `moveFolder`'s logic | The server's existing `AppError(400, ...)` responses from `moveFolder`/`moveNode` | Single source of truth already exists and is tested; duplicating it client-side is exactly the kind of "second enforcement path" the project's CLAUDE.md constraint warns against for the 403 case, and the same reasoning generalizes to 400s here |
| Descendant-count computation for archive confirmation | A new API endpoint (`GET /folders/:id/descendant-count`) | A pure DFS walk over the already-cached `useFullTree()` data, same technique as `treeFindPath.ts` | D-05 explicitly calls this out: the full tree is already loaded client-side, so a new network round-trip is pure waste |
| Tree-structured drag-and-drop | A new npm package (`dnd-kit-sortable-tree` or similar) | The already-installed `@dnd-kit/core`+`sortable`+`modifiers`, flattened to a single-level list (Pattern 1) | Reuse-over-rebuild constraint; the existing Board usage already proves the team's established dnd-kit idiom |
| Context menu / popover positioning | A generic "floating UI" library (e.g. `@floating-ui/react`) for anchor positioning | Manual `absolute`/`fixed` positioning matching `ViewSettingsMenu.tsx`'s existing shape | No positioning library exists in the codebase; the existing popovers work fine with simple CSS positioning for this UI's scale (sidebar tree, not a complex viewport-constrained overlay) |

**Key insight:** Every piece of this phase's UI surface has a near-identical precedent already shipped somewhere in `apps/workspaces` (Board views for drag, `ViewSettingsMenu` for popovers, `BoardColumn`/`FolderModal` for inline-edit/modal shells, `KanbanMigrationGate` for toasts). The research task here was locating those precedents, not evaluating third-party libraries — the codebase's own idioms are the correct "standard stack" for this phase.

## Common Pitfalls

### Pitfall 1: Forgetting the missing frontend API/hook layer
**What goes wrong:** A plan jumps straight to "build the drag handler" or "build the archive dialog" assuming `foldersApi.archive()` or `foldersApi.reorderNodes()` already exist (since the backend routes do).
**Why it happens:** `folders.api.ts`/`useFolders.ts` look complete at a glance (they cover create/update/move/tree-read) but were verified by direct read to be missing archive/unarchive/reorder/moveNode wrappers entirely; `projects.api.ts`/`useProjects.ts` are missing archive/unarchive entirely.
**How to avoid:** Treat "extend `folders.api.ts`, `projects.api.ts`, `useFolders.ts`, `useProjects.ts` with the 6 missing wrappers" as an explicit Wave 0 task before any UI component work.
**Warning signs:** A plan task references `useArchiveFolder()` or `foldersApi.reorderNodes` without a prior task that creates them.

### Pitfall 2: Empty `SortableContext` hit-testing gap (same issue Board views already solved)
**What goes wrong:** Dropping into a folder with zero visible children (either genuinely empty, or collapsed) has no sortable item to hit-test against, so the drop silently fails or falls through to the wrong target.
**Why it happens:** `BoardColumn.tsx`'s own code comment documents this exact issue for empty Kanban columns and its fix (a `useDroppable`-wrapped container around the `SortableContext`, independent of the per-card `useSortable` registrations).
**How to avoid:** Every folder row (even ones with no visible children) needs its own `useDroppable` registration so a reparent-into-empty-folder drop has a target to land on, mirroring `BoardColumn.tsx`'s `setNodeRef`/`isOver` pattern.
**Warning signs:** Dragging a node onto a collapsed or empty folder does nothing, while dragging onto a folder with visible children works.

### Pitfall 3: Reorder scope must match the backend's node_type + parent_id/project_id disambiguation
**What goes wrong:** `POST /folders/tree/reorder` and `POST /folders/tree/move` both require `node_type` plus a `parent_id` (and, for programs, a separate `project_id` disambiguator per `tree.dto.ts`'s documented reasoning). A reorder/move payload built from just "the dragged id and the new position" without threading through the correct `node_type`/`parent_id` scope will 400.
**Why it happens:** The flattened drag list mixes node types (folders + projects, per D-03); it's easy to forget that a reorder call is scoped to *one* `node_type` + `parent_id` pair at a time — folders and projects sharing a parent are reordered via two *separate* `ordered_ids` arrays/calls, not one combined array (confirmed: `ReorderNodesSchema.node_type` is a single enum value per call, and `reorderSiblings` dispatches to one repository method per call).
**How to avoid:** When building the `ordered_ids` payload after a drag-end, filter to only the siblings of the same `node_type` as the dragged node before computing the new order.
**Warning signs:** Reordering appears to work for same-type siblings but folders and projects "jump" relative to each other unexpectedly, or the API 400s with a Zod validation error mentioning `node_type`.

### Pitfall 4: `useFullTree()` staleTime causes a visible lag after a mutation
**What goes wrong:** `useFullTree()` has `staleTime: 1000 * 60` (60s). After a create/rename/archive/reorder/move mutation, if the new mutation hooks don't explicitly call `qc.invalidateQueries({ queryKey: qk.fullTree })`, the sidebar can show stale data for up to a minute.
**Why it happens:** The existing `invalidateFolderAffectedQueries` helper in `useFolders.ts` invalidates `qk.folders` (the legacy flat-folder-list query) and `['projects']`/`['programs']`, but does **not** currently invalidate `qk.fullTree` — that query key was introduced by Phase 33 after this helper was written.
**How to avoid:** Every new mutation hook this phase adds (archive, unarchive, reorder, moveNode) must explicitly invalidate `['folders', 'tree', 'full']` in its `onSuccess`, and this phase should also patch `invalidateFolderAffectedQueries` itself to include it, since existing create/update/move mutations have the same gap.
**Warning signs:** After creating/renaming/archiving a node, the sidebar doesn't visually update until a manual refresh or ~60s passes.

### Pitfall 5: No client-side capability gating exists — a non-admin sees drag handles/menus that will 403
**What goes wrong:** There is no `useCapability`/`hasCapability` hook anywhere in `apps/workspaces` (confirmed via search). Every mutation this phase adds is gated server-side by `requireCapability('workspace.admin')`. A non-admin user will see the full context menu, drag affordance, and rename input, and only discover they lack permission when the mutation 403s.
**Why it happens:** This mirrors the project's existing accepted pattern for the 403-on-assign-over-limit case (CLAUDE.md constraint: "the semaphore must visually reflect this, not introduce a second enforcement path") — the precedent in this codebase is "let the API be the enforcement point, surface its rejection," not "hide UI based on a client-side permission model."
**How to avoid:** This is consistent with existing project convention, not a bug to fix — but the illegal-drop/action toast mechanism (Claude's Discretion item) should be generic enough to also present a clean message for a 403 response (e.g. "You don't have permission to do this"), not just the two documented cycle/depth 400 messages, since a non-admin will hit exactly this path.
**Warning signs:** Skipped if the toast/error-surfacing component only special-cases the two known 400 messages and falls through to something ugly (raw JSON, unhandled promise rejection) for a 403.

## Code Examples

### Extending `folders.api.ts` with the missing wrappers
```typescript
// Source: pattern matches existing foldersApi shape in
// apps/workspaces/src/lib/api/folders.api.ts — new methods only, same conventions
export const foldersApi = {
  // ...existing methods unchanged...
  archive: (id: string) =>
    apiFetch<{ folder: Folder }>(`${BASE}/${id}/archive`, 'POST').then((r) => r.folder),
  unarchive: (id: string) =>
    apiFetch<{ folder: Folder }>(`${BASE}/${id}/unarchive`, 'POST').then((r) => r.folder),
  reorder: (data: { node_type: string; parent_id: string | null; project_id?: string | null; ordered_ids: string[] }) =>
    apiFetch<{ node_type: string; parent_id: string | null; ordered_ids: string[] }>(`${BASE}/tree/reorder`, 'POST', data),
  moveNode: (data: { node_type: string; node_id: string; new_parent_id: string | null; project_id?: string | null }) =>
    apiFetch<unknown>(`${BASE}/tree/move`, 'POST', data),
};
```

### Reading the exact server error message on a rejected move
```typescript
// Source: packages/api-client/src/client.ts (ApiError class, lines 9-18) +
// apps/api/src/core/errors/errorHandler.ts (lines 4-16) — confirmed the
// response body shape `{ error: string }` maps 1:1 to ApiError.message.
try {
  await foldersApi.moveNode({ node_type: 'folder', node_id: draggedId, new_parent_id: targetFolderId });
} catch (err) {
  if (err instanceof ApiError) {
    showErrorToast(err.message); // e.g. "Cannot move a folder into its own descendant"
  } else {
    showErrorToast('Something went wrong moving this item.');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single-folder `PATCH /:id/move` (pre-existing, already wrapped as `foldersApi.move`) | `POST /folders/tree/move` (generic node-type dispatch, added Phase 32) | Phase 32 | This phase's reparent drag should call the **new** `tree/move` endpoint (via `moveNode`), not the older `foldersApi.move` — the older one only handles folders, not the cross-node-type dispatch (folder/project/program/data_collection) this phase's drag surface needs for projects |

**Deprecated/outdated:** None within this phase's scope — Phase 32's tree endpoints are the current, intended API surface; the older single-folder `move` endpoint remains valid for folder-only callers but isn't the right fit for a UI that also drags projects.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dnd-kit-sortable-tree` exists as an npm package matching the description found via WebSearch (not independently verified against npm registry or Context7) | Alternatives Considered | Low — this package is explicitly NOT recommended for use, so misinformation here has no execution impact; flagged only so the planner doesn't independently decide to adopt it without running the legitimacy gate |
| A2 | No client-side capability/permission-gating hook exists anywhere in `apps/workspaces` | Pitfall 5 | Medium — if a hook does exist under a name not matched by the grep pattern used (`capability|workspace.admin`), the planner might redundantly propose building one; low actual risk since even if missed, following the existing 403-passthrough pattern is still correct per CLAUDE.md constraints |

## Open Questions (RESOLVED)

1. **Should the `ArchiveConfirmDialog` also cover programs/data_collections/pages in its descendant-count breakdown, or only the two draggable node types?**
   - What we know: D-05's example copy is "3 folders, 5 projects, 12 pages" — explicitly includes pages, which are NOT a draggable/create/rename/archive target this phase (D-03). The backend's `archiveFolder` cascades to folders, projects, programs, data_collections, AND pages in one transaction (Phase 31 `HIER-04`).
   - What's unclear: Whether the count breakdown UI should enumerate all 5 cascaded types or just summarize non-folder/non-project types more loosely.
   - RESOLVED: Follow D-05's literal example — break down by all node types actually present among descendants (folders, projects, programs, data_collections, pages), since the backend cascade already returns/affects all of them and the count is a pure client-side tree-walk with no extra cost either way. 34-03/34-04 implemented this.

2. **Where exactly does "New Folder"/"New Project" triggered from empty tree space (not a specific row) get its context menu affordance?**
   - What we know: D-10 says "Triggering from empty tree space / the tree section root creates a root-level node." `TreeSection.tsx` currently renders only the mapped rows with no empty-space click target.
   - What's unclear: Whether this needs a persistent "+" affordance at the top of the Workspace tree section (visible always) or only via right-click on the empty area below the last row.
   - RESOLVED: A small persistent "+" button next to the "Workspace" section header (visible always, not hover-gated) is the more discoverable and more standard pattern (matches how most tree UIs expose root-level creation) — this avoids relying on an easy-to-miss right-click-on-empty-space gesture as the *only* path. 34-03/34-04 implemented this.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies. All required packages are already installed in the working `apps/workspaces` npm workspace (verified via direct `package.json` read).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in `apps/workspaces` — no `*.test.*`/`*.spec.*` files, no `jest.config.*`/`vitest.config.*` found for this app [ASSUMED based on file search during this research pass; not exhaustively re-verified for this write-up] |
| Config file | none — see Wave 0 |
| Quick run command | none available |
| Full suite command | none available |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREEOPS-01 | Create folder/project via context menu at correct parent | manual-only | — | ❌ no test infra |
| TREEOPS-02 | Inline rename persists and reverts correctly on Escape/empty | manual-only | — | ❌ no test infra |
| TREEOPS-03 | Sibling reorder persists correct `ordered_ids` scoped by node_type+parent | manual-only | — | ❌ no test infra |
| TREEOPS-04 | Illegal reparent shows exact server error text, not silent snap-back | manual-only | — | ❌ no test infra |
| TREEOPS-05 | Archive confirmation shows correct per-type descendant counts | manual-only | — | ❌ no test infra |
| TREEOPS-06 | Archived node disappears from default tree view | manual-only | — | ❌ no test infra |

### Sampling Rate
- **Per task commit:** manual browser verification (no automated frontend test runner exists in this app)
- **Per wave merge:** manual click-through of the full create → rename → drag-reorder → drag-reparent → archive → (optional) undo flow
- **Phase gate:** Full manual walkthrough before `/gsd:verify-work`, given the total absence of frontend test infrastructure in `apps/workspaces`

### Wave 0 Gaps
- No `apps/workspaces` test framework exists at all — introducing one (Jest/Vitest + React Testing Library) is out of scope for this UI phase per its framing, but the planner should flag this explicitly rather than silently defaulting to "manual-only" for every requirement without calling out the gap.
- `treeArchiveCount.ts` (the new DFS descendant-count walker) is pure, dependency-free logic (mirrors `treeFindPath.ts`) and is the one piece of this phase most amenable to a lightweight unit test if any test runner is introduced — flagged as the highest-value target if Wave 0 does add minimal test infra.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unchanged — existing JWT bearer auth via `authenticateToken` middleware, already applied to all folders/projects routes |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Server-side `requireCapability('workspace.admin')` on every mutating endpoint this phase calls (create/rename/archive/reorder/move) — already shipped, this phase must not attempt to duplicate or weaken this with client-side-only gating (see Pitfall 5) |
| V5 Input Validation | yes | Zod schemas (`CreateFolderSchema`, `UpdateFolderSchema`, `MoveFolderSchema`, `ReorderNodesSchema`, `MoveNodeSchema`) already validate all payloads server-side; client-side should mirror minimal UX validation only (non-empty name on rename/create) — not attempt to replicate full schema validation |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant reparent (moving a node under a folder belonging to a different company) | Tampering / Elevation of Privilege | Already mitigated server-side — `assertOwnedFolder`/`findProjectForCompany` scope every lookup by `tenantId` before allowing a move (Phase 31 `HIER-02`); this phase's client code must not bypass these checks by, e.g., constructing move payloads from unvalidated/user-suppliable folder ids outside the tree the user can already see via `useFullTree()` |
| Privilege escalation via UI affordance alone (a non-admin user's browser rendering drag handles/context menu despite lacking `workspace.admin`) | Elevation of Privilege | Not a real elevation risk since the server re-checks capability on every mutation (see Pitfall 5) — UI visibility without capability gating is a UX rough edge, not a security hole, consistent with this project's existing 403-passthrough precedent |

## Sources

### Primary (HIGH confidence)
- Direct file reads (this session): `apps/api/src/domains/folders/folders.routes.ts`, `folders.service.ts`, `folders/dto/tree.dto.ts`, `apps/api/src/domains/projects/projects.routes.ts`, `apps/api/src/core/errors/errorHandler.ts`, `apps/api/src/core/capabilities/index.ts`
- Direct file reads (this session): `apps/workspaces/src/lib/api/folders.api.ts`, `projects.api.ts`, `apps/workspaces/src/lib/hooks/useFolders.ts`, `useProjects.ts`, `apps/workspaces/src/lib/api/client.ts`, `packages/api-client/src/client.ts`
- Direct file reads (this session): `apps/workspaces/src/components/tree/TreeNodeRow.tsx`, `TreeSection.tsx`, `treeFilters.ts`, `apps/workspaces/src/components/shared/treeFindPath.ts`
- Direct file reads (this session): `apps/workspaces/src/components/projectPage/board/BoardCard.tsx`, `BoardColumn.tsx`, `apps/workspaces/src/components/projectPage/BoardBlock.tsx`, `ViewSettingsMenu.tsx`, `KanbanMigrationGate.tsx`, `EditableRichText.tsx`, `PageHeader.tsx`, `apps/workspaces/src/components/folders/FolderModal.tsx`, `apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts`
- `.planning/phases/34-.../34-CONTEXT.md` — canonical_refs section, verified against actual file line numbers where checked

### Secondary (MEDIUM confidence)
- `apps/workspaces/package.json` — direct read confirming installed `@dnd-kit/*` versions (not a registry lookup, since not new installs)

### Tertiary (LOW confidence)
- WebSearch: "dnd-kit sortable tree drag reorder reparent implementation pattern" — used only to confirm no official first-party dnd-kit tree preset exists and that the flatten-to-single-list community pattern is standard; not independently verified against dnd-kit's own docs site in this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages directly verified as already-installed via `package.json` read; no new dependencies proposed
- Architecture: HIGH — every recommended pattern is a direct citation of existing, working code in this exact codebase
- Pitfalls: HIGH — Pitfalls 1, 2, 3, 4 are all grounded in direct source reads (missing wrappers, `BoardColumn`'s own documented empty-SortableContext fix, `tree.dto.ts`'s documented node_type/project_id scoping, `useFolders.ts`'s actual invalidation list); Pitfall 5 is MEDIUM (absence-of-evidence claim, flagged as Assumption A2)

**Research date:** 2026-07-20
**Valid until:** 30 days (stable internal codebase, no external API drift risk since all backend endpoints are already shipped and frozen for this phase)
