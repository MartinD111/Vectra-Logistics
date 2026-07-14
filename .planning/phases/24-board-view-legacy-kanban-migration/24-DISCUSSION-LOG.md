# Phase 24: Board View & Legacy Kanban Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 24-board-view-legacy-kanban-migration
**Areas discussed:** Migration trigger, New board creation, Column management, Inline card creation

---

## Migration Trigger & Notice (BOARD-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Silent, on first edit | Auto-migrate on first interaction with an old kanban block, no visible notice | |
| Silent, on page load | Migrate as soon as the page is opened in edit mode | |
| Visible one-time notice | Same auto-migration, but show a small one-time toast/banner | ✓ |

**User's choice:** Visible one-time notice.

**Follow-up — notice UX:**

| Option | Description | Selected |
|--------|-------------|----------|
| Toast, auto-dismiss | Small toast appears once, auto-dismisses after a few seconds, no persistent state to track | ✓ |
| Inline banner, dismissible | Banner above the board, stays until dismissed, requires tracking a dismissed flag | |

**User's choice:** Toast, auto-dismiss.
**Notes:** Migration itself still triggers on first edit (from the first question), not on page load. No dismissed-state tracking needed since it's a fire-and-forget toast.

---

## New Board Creation From Scratch (BOARD-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-provision defaults | Immediately create a new collection with a default "Status" select property + board view, Trello-style zero-config start | ✓ |
| Picker: existing collection or new | Show a picker to attach to an existing collection or create fresh | |

**User's choice:** Auto-provision defaults.
**Notes:** No "pick existing collection" UI in this phase.

---

## Column Management (BOARD-01 scope boundary)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, from the board | Lightweight "+ Add column" + renamable headers directly on the board | ✓ |
| No, edit via property/schema only | Column set fixed to whatever exists; editing happens via property editor or a later phase | |

**User's choice:** Yes, from the board.

**Follow-up — column deletion with existing cards:**

| Option | Description | Selected |
|--------|-------------|----------|
| Block deletion if non-empty | Disable/warn on removing a column that still has cards; forces moving cards out first | ✓ |
| Move cards to "No value" | Deleting the option clears the property value on affected cards, falling into the "no value" bucket | |

**User's choice:** Block deletion if non-empty.

---

## Inline Card Creation (BOARD-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Create + open detail page | Matches spec §6 wording exactly — create then immediately open the full record detail page | |
| Create inline, stay on board | Notion/Trello-style quick-add: type a title, card appears, focus stays on the board | ✓ |

**User's choice:** Create inline, stay on board.

**Follow-up — minimal input for quick-add:**

| Option | Description | Selected |
|--------|-------------|----------|
| Title only | Single line of text becomes the title property, card appears static once committed | |
| Title + immediately editable in column | Same, but the new card's title stays inline-editable on the card face rather than appearing static | ✓ |

**User's choice:** Title + immediately editable in column.
**Notes:** New inline-edit-on-card-face UI, no existing analog in the codebase — follow Phase 23's blur/Enter-commit conventions for text fields.

---

## Claude's Discretion

- Exact visual/interaction polish of the "+ Add column" control and inline-editable new-card title (colors, debounce/commit timing) — follow existing hand-rolled Tailwind system, no shadcn (per Phase 23 precedent).
- `@dnd-kit/sortable` (`SortableContext`/`useSortable`) vs. manual `useDraggable`/`useDroppable` composition for drag-and-drop implementation — no existing analog for within-column reordering specifically.
- Exact default starter option set/labels for a new board's Status property (e.g. "To Do / In Progress / Done") — any similarly minimal generic starter set is acceptable.

## Deferred Ideas

None — discussion stayed within phase scope. Filters/sorts/sub-groups/column aggregations/view-switching (Phase 25) and additional view types (Phase 26) were recognized as out of scope and not re-discussed.
