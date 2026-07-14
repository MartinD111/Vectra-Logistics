# Phase 25: View UX Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 25-view-ux-parity
**Areas discussed:** Filter/sort UI, Card face properties, Column aggregations, View switching, Filter combining logic

---

## Filter/sort UI (VIEWX-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar dropdown builder | A 'Filter' and 'Sort' button above the board opens a popover to add condition rows (property + operator + value), Notion-style. Most flexible, more UI to build. | ✓ |
| Simple single-property filter/sort | One filter row and one sort row max, picked from dropdowns directly in the toolbar — no popover, no multi-condition builder. | |
| Claude's discretion | Let the planner/researcher pick. | |

**User's choice:** Toolbar dropdown builder
**Notes:** User favored the more flexible/robust option despite the extra UI surface.

---

## Card face properties (VIEWX-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-view picker in a view settings menu | A '•••' / settings icon on the board opens a checklist of collection properties to toggle on/off as card-face fields — stored in view.config.cardProperties. | ✓ |
| Claude's discretion | Let the planner decide the exact entry point. | |

**User's choice:** Per-view picker in a view settings menu
**Notes:** None.

---

## Column aggregations (VIEWX-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Column header footer/badge | Each column header shows a small aggregation line the user can click to pick aggregation + number property, per column. | |
| Claude's discretion | Let the planner decide exact placement and interaction, as long as count is always available and sum/avg work for a chosen number property. | ✓ |

**User's choice:** Claude's discretion
**Notes:** Hard requirement carried into CONTEXT.md: count always available; sum/avg must work for a chosen number property.

---

## View switching (VIEWX-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Board + Table | Table is the most common Notion-parity second view and reuses the schema-driven property rendering already built for Phase 23's record detail panel. | ✓ |
| Claude's discretion | Let the planner pick the second view type based on what's cheapest to build well. | |

**User's choice:** Board + Table
**Notes:** None.

---

## Filter combining logic

| Option | Description | Selected |
|--------|-------------|----------|
| AND only (Recommended) | All filter conditions must match — simplest to build and reason about, no OR/mixed logic in this phase. | ✓ |
| Claude's discretion | Let the planner decide based on what's cheapest given the filter builder UI chosen. | |

**User's choice:** AND only
**Notes:** Keeps the filter builder's evaluation model simple given the toolbar dropdown builder choice.

---

## Claude's Discretion

- Exact filter operator set per property type (text/select/number/date).
- Column aggregation placement/interaction details.
- Whether view switching is a dropdown/tab control on the block chrome or another location.
- Table view's default column set/ordering when first created.

## Deferred Ideas

None — discussion stayed within phase scope. Sub-groups/swimlanes (`subGroupBy`) and additional view types beyond table (calendar/gallery/list/timeline) were recognized as out of scope for this phase.
