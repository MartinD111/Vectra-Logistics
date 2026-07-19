# Phase 26: Additional View Types - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 26-additional-view-types
**Areas discussed:** Calendar view, Gallery view, Timeline/Gantt view, List view + view switcher UI

---

## Calendar view

| Option | Description | Selected |
|--------|-------------|----------|
| User picks one `date` property per view | View-settings control, persists to view.config | (deferred to "You decide") |
| Always the first `date` property found | No picker, auto-select first date property | |
| You decide | Claude picks based on Phase 25's view-settings pattern | ✓ |

**User's choice:** You decide — resolved to "user picks one `date` property per view" (D-01), matching Phase 25's aggregation-picker precedent.
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden from calendar | Date-less records don't appear | |
| Shown in an "Unscheduled" tray | Sidebar/tray lists date-less records | ✓ |

**User's choice:** Shown in an "Unscheduled" tray (D-02).

| Option | Description | Selected |
|--------|-------------|----------|
| Month view + click-a-day to create | Single month grid, click empty day creates record | ✓ |
| Month view only, no inline create | Just render records, no click-to-create | |

**User's choice:** Month view + click-a-day to create (D-03).

---

## Gallery view

| Option | Description | Selected |
|--------|-------------|----------|
| User picks a `files` property per view | View-settings picker for cover image | ✓ |
| No cover image support this phase | Card grid without cover images | |

**User's choice:** User picks a `files` property per view (D-04).

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder block with title only | Plain placeholder header, no broken-image icon | ✓ |
| You decide | Claude picks a reasonable fallback | |

**User's choice:** Placeholder block with title only (D-05).

---

## Timeline/Gantt view

| Option | Description | Selected |
|--------|-------------|----------|
| Two `date` properties, user picks both | No new property type, no migration | ✓ |
| New `date-range` property type | Matches spec literally but needs schema/migration + editor UI | |

**User's choice:** Two `date` properties, user picks both (D-06).
**Notes:** Confirms the schema only has single-value `date` today; explicitly avoided adding a new property type to keep scope down.

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden from timeline | Records missing start or end don't render a bar | ✓ |
| Rendered as a point if only one is set | Single-day marker fallback | |

**User's choice:** Hidden from timeline (D-07).

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed month-wide horizontal scale, no zoom | Simplest Gantt, prev/next like calendar | ✓ |
| You decide | Claude picks simplest-to-build-well option | |

**User's choice:** Fixed month-wide horizontal scale, no zoom (D-08).

---

## List view + view switcher UI

| Option | Description | Selected |
|--------|-------------|----------|
| Single-column rows, title + cardProperties inline | Reuses Phase 25's cardProperties config | ✓ |
| Identical to Table minus grouping | Render CollectionTableView without groupBy | |

**User's choice:** Single-column rows, title + cardProperties inline (D-09).

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown/menu | Compact dropdown, scales to 6 view types | ✓ |
| Keep segmented buttons, just add more | Extend existing button-row to 6 icons | |

**User's choice:** Dropdown/menu (D-10).

---

## Claude's Discretion

- Calendar's date property picker (resolved from "You decide" to D-01)
- "Unscheduled" tray visual layout (sidebar vs. collapsible panel vs. bottom drawer)
- ViewSwitcher dropdown styling (hand-rolled Tailwind, no shadcn)
- Whether the Timeline start/end-date picker extends `ViewSettingsMenu` or gets a dedicated panel (planner's call, prefer extending existing menu)
- Gantt bar visual styling and calendar day-cell density
- Whether "Unscheduled" tray records are click-to-open (assumed yes, consistent with all other views)

## Deferred Ideas

- A genuine `date-range` property type (as opposed to two separate `date` properties) — considered and explicitly deferred; candidate for a future phase if the two-property representation proves limiting.
- Day/week/quarter zoom controls for Timeline, multi-month Calendar navigation — implicitly raised, deferred as out of scope (D-08 fixes single month-wide scale for this phase).
