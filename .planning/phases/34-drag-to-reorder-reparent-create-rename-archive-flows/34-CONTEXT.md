# Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can fully organize the workspace tree from the sidebar UI shipped in Phase 33 (read-only) — creating, renaming, reordering, reparenting, and archiving folders/projects — with safe, clearly-communicated handling of illegal actions. This phase is UI + wiring only: the backend (create/rename/reorder/move/archive/unarchive endpoints, cycle/depth validation) already shipped in Phases 31–32.

Only folders and projects are draggable/create/rename/archive targets this phase. Programs, pages, and data_collections stay non-draggable (TREEOPS2-01 deferral).

</domain>

<decisions>
## Implementation Decisions

### Drag Affordances & Scope
- **D-01:** Whole tree row is draggable (not a dedicated grip handle) — matches existing dnd-kit Board usage patterns (whole-card draggable) already in the codebase.
- **D-02:** Position-based drop distinction — dropping near the top/bottom edge of a row = reorder (line indicator between rows); dropping over the middle of a folder row = reparent into it (folder highlight). Standard pattern (Notion, VS Code explorer).
- **D-03 (confirmed):** Only folders and projects are draggable this phase. Programs/pages/collections are not drag targets — matches TREEOPS-03/04 wording and the REQUIREMENTS.md TREEOPS2-01 deferral.
- **D-04 (confirmed):** Dropping a project at root level un-files it (`folder_id` → null) — matches existing supported behavior; `moveNode`'s project branch already supports clearing `folder_id` via `setProjectFolder`.

### Archive Confirmation UX
- **D-05:** Confirmation dialog shows a descendant-count breakdown by type (e.g. "3 folders, 5 projects, 12 pages"), not just a single total. The full tree is already loaded client-side via Phase 33's `useFullTree()`, so per-type counts cost nothing extra over a single total — compute via a tree-walk (same technique as `treeFindPath.ts`), no new API call needed.
- **D-06:** Same `ArchiveConfirmDialog` component handles both folder and project archiving — the descendant breakdown is naturally empty/zero for a leaf project with no children, so no separate dialog variant is needed.
- **D-07 (Undo, revised after backend check):** `unarchiveFolder`/`unarchiveProject` only restore the single node — they do **not** cascade-restore descendants that were archived along with it (confirmed by reading `folders.service.ts`/`projects.service.ts`; no cascade-unarchive endpoint exists). Given that, show an "Undo" toast **only when the archived node has zero descendants** (empty folder or leaf project with no children). When descendants exist, skip Undo entirely — the confirmation dialog's descendant-count breakdown is the safety net instead. Do NOT build a cascade-unarchive endpoint this phase (avoids backend scope creep beyond what TREEOPS-05/06 ask for).

### Context Menu Design
- **D-08:** Context menu triggers via right-click AND a visible "⋮" kebab button that appears on row hover — right-click serves desktop power users, the kebab ensures discoverability and gives touch/keyboard/accessibility users a clickable target. No context-menu component exists in the codebase yet; this phase builds the first one.
- **D-09 (confirmed):** Menu actions are exactly: New Folder, New Project, Rename, Archive (New Folder/New Project only on folder rows and root; Rename/Archive on folder and project rows). No "Move to..." picker or other actions added — matches TREEOPS-01/02/05 exactly, no scope beyond locked requirements.
- **D-10:** "New Folder"/"New Project" from a folder's context menu creates the new node as a **child of the right-clicked folder**. Triggering from empty tree space / the tree section root creates a root-level node. Matches "at any level of the tree" wording in TREEOPS-01.

### Claude's Discretion
- **Illegal-drop feedback mechanism (not deep-dived):** TREEOPS-04 requires a clear inline reason for illegal drops (cycles, permission, depth-limit) rather than a silent snap-back. The API already returns clean, user-presentable error messages for the two known illegal-move cases: `"Cannot move a folder into its own descendant"` (400, cycle) and `"Folder nesting cannot exceed depth 3"` (400, depth limit) — both from `apps/api/src/domains/folders/folders.service.ts` `moveFolder`. Researcher/planner should decide the exact presentation (toast vs. inline tooltip near the drop point vs. shake+message) but MUST surface the API's actual error message text, not a generic "invalid move" string.
- Inline rename trigger/interaction details (double-click vs. menu-only trigger, Enter/Escape/blur handling, empty-name validation) — follow existing inline-edit patterns already in the codebase (`EditableRichText.tsx`, `PageHeader.tsx`) rather than inventing a new pattern.
- Exact visual styling of drag indicators (line color/thickness, folder highlight style) — implementation detail, follow existing Tailwind/design tokens used elsewhere in the sidebar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §"Organize: Create/Rename/Move/Archive + Drag (TREEOPS)" — TREEOPS-01 through TREEOPS-06, the locked requirements for this phase.
- `.planning/REQUIREMENTS.md` §"v2 Requirements" — TREEOPS2-01 (deeper cross-entity drag) and TREEOPS2-02 (bulk multi-select) are explicitly deferred beyond this phase.
- `.planning/ROADMAP.md` §"Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows" — goal, success criteria, dependency on Phase 33.
- `.planning/phases/31-data-model-modernize-folders-domain/31-CONTEXT.md` — depth limit (3 levels), archive/cascade semantics, ancestor-index background.

### Phase 32 API to Consume (already shipped — do not duplicate or re-implement)
- `apps/api/src/domains/folders/folders.routes.ts` — `POST /folders`, `PATCH /folders/:id`, `POST /folders/:id/archive`, `POST /folders/:id/unarchive`, `POST /folders/tree/reorder`, `POST /folders/tree/move`, `PATCH /folders/:id/move`.
- `apps/api/src/domains/projects/projects.routes.ts` — `POST /projects`, `PATCH /projects/:id`, `POST /projects/:id/archive`, `POST /projects/:id/unarchive`.
- `apps/api/src/domains/folders/folders.service.ts` — `moveFolder` (lines ~70-98, cycle/depth checks + exact error messages), `moveNode` (lines ~120+, dispatch by node_type), `archiveFolder` (lines ~232+, cascade archive), `unarchiveFolder` (lines ~338+, single-node restore only — no cascade).
- `apps/api/src/domains/folders/dto/tree.dto.ts` — `ReorderNodesSchema`, `MoveNodeSchema` request shapes.

### Phase 33 UI Foundation to Consume (already shipped — do not duplicate)
- `apps/workspaces/src/lib/api/folders.api.ts` + `apps/workspaces/src/lib/hooks/useFolders.ts` — `useFullTree()` React Query hook wrapping `GET /folders/tree/full`.
- `apps/workspaces/src/components/tree/treeFilters.ts` — `pruneTree()`/`isArchived()` client-side filtering (archived nodes already excluded from the default tree view — TREEOPS-06's "hidden from default view" half is already handled here).
- `apps/workspaces/src/components/tree/treeNodeUrl.ts` — `node_type` → route mapping.
- `apps/workspaces/src/components/tree/TreeNodeRow.tsx` / `TreeSection.tsx` — the recursive tree row component this phase extends with drag/context-menu/inline-rename behavior.
- `apps/workspaces/src/components/shared/treeFindPath.ts` — pure DFS tree-walk utility; the same technique should be reused for computing archive descendant-count breakdowns (D-05) instead of writing a new traversal.
- `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` — where `TreeSection` is currently rendered.

### Existing Patterns to Reuse
- `apps/workspaces/src/components/projectPage/board/BoardCard.tsx`, `BoardColumn.tsx`, `apps/workspaces/src/components/projectPage/BoardBlock.tsx` — existing `@dnd-kit` usage in this codebase; reuse the same drag primitives/patterns for tree drag-and-drop rather than introducing a second DnD library.
- `apps/workspaces/src/components/projectPage/EditableRichText.tsx`, `apps/workspaces/src/components/projectPage/PageHeader.tsx` — existing inline-edit interaction patterns to follow for inline rename.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useFullTree()` (Phase 33) — already loads the full tree client-side; archive descendant counts and illegal-drop-adjacent checks can be computed from this cached data without new API calls.
- `treeFindPath.ts` (Phase 33) — pure, dependency-free DFS pattern to mirror for the descendant-count walk.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers` (already in `apps/workspaces/package.json`, used by Board views) — reuse for tree drag-and-drop.

### Established Patterns
- No context-menu component exists anywhere in `apps/workspaces` or `packages/ui` today — this phase builds it from scratch (D-08).
- Inline-edit patterns exist in `EditableRichText.tsx`/`PageHeader.tsx` — follow their trigger/commit/cancel conventions for tree-row rename rather than inventing new ones.
- Archive/unarchive endpoints follow a consistent `POST /:id/archive` + `POST /:id/unarchive` pair per domain (folders, projects, programs) — no new endpoint pattern needed.

### Integration Points
- `POST /folders/tree/reorder` and `POST /folders/tree/move` (Phase 32) are the two endpoints all drag operations funnel through — reorder within same parent uses `/tree/reorder`, reparent across parents uses `/tree/move`.
- `moveFolder`'s cycle/depth-limit checks return `AppError(400, message)` with exact user-presentable text — surface this text directly in the illegal-drop UI feedback (see Claude's Discretion above), don't write a parallel client-side validation message.

</code_context>

<specifics>
## Specific Ideas

- Descendant-count breakdown copy example: "This will also archive 3 folders, 5 projects, 12 pages." — by node type, not a flat number.
- Illegal-drop feedback must surface the API's actual error text ("Cannot move a folder into its own descendant" / "Folder nesting cannot exceed depth 3"), not a generic "invalid move" message.

</specifics>

<deferred>
## Deferred Ideas

- **"Move to..." picker as a non-drag alternative** — considered during Context menu design discussion, not added this phase; drag-and-drop plus the existing per-row context menu cover TREEOPS-01/02/04/05 as scoped. Could be revisited as an accessibility improvement in a future phase.
- **Cascade-unarchive endpoint** — surfaced while resolving the Undo-affordance gray area (D-07); `unarchiveFolder`/`unarchiveProject` currently restore only the single node, not cascaded descendants. Explicitly deferred rather than added to this phase's backend scope; noted here so a future phase doesn't rediscover this gap from scratch.
- TREEOPS2-01 (deeper cross-entity drag: pages/records directly into projects) and TREEOPS2-02 (bulk multi-select archive/move) — already tracked in REQUIREMENTS.md as v2/deferred, reconfirmed out of scope during this discussion.

</deferred>

---

*Phase: 34-Drag-to-Reorder/Reparent + Create/Rename/Archive Flows*
*Context gathered: 2026-07-20*
