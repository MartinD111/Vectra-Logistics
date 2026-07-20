# Phase 34: Drag-to-Reorder/Reparent + Create/Rename/Archive Flows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 34-Drag-to-Reorder/Reparent + Create/Rename/Archive Flows
**Areas discussed:** Drag affordances & scope, Archive confirmation UX, Context menu design

---

## Drag Affordances & Scope

| Question | Option | Selected |
|---|---|---|
| Whole row draggable vs. dedicated grip handle | Whole row draggable | ✓ |
| | Dedicated grip handle | |
| Reorder vs. reparent distinction | Position-based (edge = reorder, middle = reparent) | ✓ |
| | Modifier key (Alt to reparent) | |
| Drag scope confirmation | Folders + projects only | ✓ |
| | Also allow program reordering | |
| Can a project be un-filed to root via drag | Yes, dropping in root un-files it | ✓ |
| | No, must always stay in a folder | |

**Notes:** All four questions resolved on the recommended option in a single batch. Confirmed drag scope matches TREEOPS-03/04 and REQUIREMENTS.md's TREEOPS2-01 deferral. Confirmed `moveNode`'s project branch already supports clearing `folder_id` to null.

---

## Archive Confirmation UX

| Question | Option | Selected |
|---|---|---|
| Count style | Breakdown by type (e.g. "3 folders, 5 projects, 12 pages") | ✓ |
| | Single total count | |
| Undo affordance | Yes, toast with Undo | ✓ (revised, see below) |
| | No undo | |
| Folder vs. project dialog | Same dialog, count adapts | ✓ |
| | Two separate dialog variants | |

**Follow-up:** Before locking in "Undo", the agent flagged that `unarchiveFolder`/`unarchiveProject` (read from `folders.service.ts`/`projects.service.ts`) only restore the single node — no cascade-restore of descendants archived alongside it. Re-asked with three options:

| Option | Description | Selected |
|---|---|---|
| Undo only for leaf nodes | Show Undo toast only when the archived node has zero descendants | ✓ |
| Add cascade-unarchive to the plan | New backend endpoint mirroring archiveFolder's cascade logic | |
| Undo always shown, top-node-only restore | Simplest but misleading for cascaded archives | |

**Notes:** Final decision (D-07): Undo toast appears only for zero-descendant archives (empty folder, leaf project). No new backend cascade-unarchive endpoint this phase — descendant-count confirmation dialog is the safety net for cascaded archives instead.

---

## Context Menu Design

| Question | Option | Selected |
|---|---|---|
| Trigger mechanism | Right-click + visible kebab (⋮) on hover | ✓ |
| | Right-click only | |
| Menu actions | Just New Folder / New Project / Rename / Archive | ✓ |
| | Also add "Move to..." picker | |
| Create target from folder context menu | Child of the right-clicked folder | ✓ |
| | Always root-level, drag into place after | |

**Notes:** No existing context-menu component in the codebase — this phase builds the first one. "Move to..." picker considered and explicitly deferred (see Deferred Ideas).

---

## Claude's Discretion

- **Illegal-drop feedback mechanism** — not deep-dived as its own area. TREEOPS-04 requires a clear inline reason for illegal drops. The API already returns presentable error text (`"Cannot move a folder into its own descendant"`, `"Folder nesting cannot exceed depth 3"`) from `folders.service.ts`'s `moveFolder`. Researcher/planner decide exact presentation (toast/tooltip/shake) but must surface the real API message.
- Inline rename trigger/interaction mechanics — follow existing `EditableRichText.tsx`/`PageHeader.tsx` patterns rather than a new one.
- Exact visual styling of drag indicators — follow existing sidebar design tokens.

## Deferred Ideas

- **"Move to..." picker** — a non-drag, accessibility-friendly alternative to drag-reparent, raised during Context menu design. Not added this phase; could be a future accessibility follow-up.
- **Cascade-unarchive endpoint** — surfaced while resolving the Undo-affordance gray area. `unarchiveFolder`/`unarchiveProject` only restore the single node today. Explicitly deferred rather than expanding this phase's backend scope.
- **TREEOPS2-01 / TREEOPS2-02** — deeper cross-entity drag (pages/records into projects) and bulk multi-select archive/move. Already tracked as v2 requirements in REQUIREMENTS.md; reconfirmed out of scope during this discussion.
