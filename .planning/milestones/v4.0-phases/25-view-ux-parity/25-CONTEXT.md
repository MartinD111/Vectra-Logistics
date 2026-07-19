# Phase 25: View UX Parity - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The `collection-view` board built in Phase 24 gains real database-view behavior: per-view filters and sorts, a card-face property picker, column aggregations, and the ability to switch a `collection-view` block between view types (board + at least table) on the same collection without duplicating records or losing data. This phase operates entirely on the `collection_views.config` shape already defined in Phase 22's schema (`groupBy`, `subGroupBy`, `filters[]`, `sorts[]`, `cardProperties[]`) — no new migration expected unless the planner finds a gap. Sub-groups/swimlanes (`subGroupBy`) and additional view types beyond table (calendar/gallery/list/timeline) remain out of scope — table is the only second view type required to satisfy VIEWX-04.

</domain>

<decisions>
## Implementation Decisions

### Filters & Sorts (VIEWX-01)
- **D-01:** Filter/sort UI is a toolbar dropdown builder — a "Filter" button and a "Sort" button above the board open a popover where the user adds condition rows (property + operator + value for filters; property + direction for sorts), Notion-style. Multiple conditions are supported, not a single-row-only builder.
- **D-02:** Multiple filter conditions combine with **AND only** — every condition must match. No OR/mixed logic in this phase; keep the evaluation model simple.
- Config persists to `view.config.filters[]` / `view.config.sorts[]` per the Phase 22 schema; no new migration expected for this alone.

### Card Face Properties (VIEWX-02)
- **D-03:** A view settings entry point (e.g. a "•••"/settings icon on the board) opens a checklist of the collection's schema properties, toggle on/off which ones render on the card face below the title. Selection persists to `view.config.cardProperties[]`. This is a new UI surface — no existing analog for a property-picker checklist scoped to a view (the closest precedent is Phase 23's schema-driven property panel, which can inform rendering but not the picker UI itself).

### Column Aggregations (VIEWX-03)
- **D-04:** Placement and interaction (e.g. column-header footer showing "Count: N" or "Sum: $X", with a way to pick aggregation type + which number property) are Claude's discretion. Hard requirement: count is always available per column; sum and avg must work for a user-chosen number property. No other aggregation types (median, min/max, date range, % not empty) required this phase.

### View Switching (VIEWX-04)
- **D-05:** Board and Table are the two view types this phase must support switching between on the same `collection-view` block, without creating duplicate `collection_records` rows — switching changes which saved `collection_views` row (and its `type`) the block points at (or creates a new view row for the target type against the same `collection_id`), it never re-materializes data. Table view reuses the schema-driven property rendering built for Phase 23's record-detail property panel (read-across, not a new editor) rather than inventing a second property-rendering convention.
- Calendar/gallery/list/timeline view types remain explicitly out of scope for this phase — do not build UI entry points for them beyond acknowledging they exist as future `type` values.

### Claude's Discretion
- Exact filter operator set per property type (e.g. `equals`/`contains` for text, `is`/`is not` for select, `>`/`<`/`between` for number/date) — follow what's natural for each property type from Phase 23's schema, not re-litigated here.
- Column aggregation placement/interaction details (see D-04).
- Whether view switching is a dropdown/tab control on the `collection-view` block chrome or another UI location — follow whatever's consistent with the block's existing toolbar (filter/sort buttons, view settings icon) from D-01/D-03.
- Table view's exact column set/ordering when first created (e.g. default to all schema properties) — reasonable default, not a hard requirement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Views spec (source of this phase's scope)
- `docs/specs/core/workspace-blocks.md` §6 — Board interactions checklist: per-view filters & sorts, card preview properties, column aggregations, switch view type without duplicating records — the exact features this phase must ship
- `docs/specs/core/workspace-blocks.md` §3.1 — property type definitions (needed for filter operator selection per property type)
- `docs/specs/core/workspace-blocks.md` §3.2 — `CollectionViewBlock` shape (`collectionId`/`viewId`) — view switching changes which `viewId` the block points at
- `docs/specs/core/workspace-blocks.md` §3.3 — `collection_views.config` JSONB shape (`groupBy`, `subGroupBy`, `filters`, `sorts`, `cardProperties`) — this phase's target config surface, already schema-defined
- `.planning/REQUIREMENTS.md` — VIEWX-01 through VIEWX-04, the requirements this phase must satisfy
- `.planning/ROADMAP.md` Phase 25 section — success criteria and dependency note (depends on Phase 24's `collection-view` block and board view)

### Prior phase deliverables this phase consumes
- `.planning/phases/24-board-view-legacy-kanban-migration/24-CONTEXT.md` — board rendering, drag-and-drop, column management, and inline card creation this phase builds filter/sort/aggregation/view-switching UI on top of; explicitly scoped filters/sorts/aggregations/view-switching OUT of Phase 24 and INTO this phase
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx` and `apps/workspaces/src/components/projectPage/board/*.tsx` — current board renderer (groupBy-only, no filters/sorts/cardProperties/aggregation wiring yet) — this phase extends it, does not replace it
- `.planning/phases/23-record-detail-page/23-CONTEXT.md` — D-01 (title = first schema property), D-02 (multi-chip toggle pattern for multi-select), schema-driven property panel this phase's table view and card-face picker should read across from
- `apps/api/src/domains/records/records.service.test.ts` — confirms `{ groupBy, filters: [], sorts: [], cardProperties: [] }` is already the expected config shape at the type level, just unpopulated by any UI today

### Project-level context
- `.planning/PROJECT.md` — "no ORM" constraint, reuse-over-rebuild constraint, `company_id`-scoping convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workspaces/src/components/projectPage/BoardBlock.tsx` — reads `view.config.groupBy` today; extend to also read/apply `filters`, `sorts`, `cardProperties` when rendering columns/cards.
- `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` — currently renders only the title property; extend to render `cardProperties[]` below the title, following the same read-only/edit-on-click conventions already established (do not turn every card-face property into an inline editor — click-through to record detail remains the edit path).
- `apps/api/src/domains/records/records.routes.ts` — `PATCH /collections/:id/views/:viewId` (or equivalent view-update endpoint) is the likely target for persisting `filters`/`sorts`/`cardProperties` config changes; confirm exact route name during research.
- Phase 23's `PropertyPanel`/`PropertyField` components (`apps/workspaces/src/components/records/`) — schema-driven property rendering to read across for the table view's cell rendering and the card-face picker's property-type-aware controls.

### Established Patterns
- Registry-driven block system (`registry.tsx`) — `collection-view` is already registered from Phase 24; this phase adds view-type-aware rendering (board vs. table) inside that same block, not a new block kind.
- `view.config` is a JSONB blob already typed with `groupBy`/`filters`/`sorts`/`cardProperties` fields per the Phase 22 schema and confirmed by `records.service.test.ts` — no new migration expected, this phase is UI + read/apply logic on an existing shape.

### Integration Points
- View switching UI lives on/near the `collection-view` block chrome, alongside the D-01 filter/sort toolbar and D-03 view-settings entry point.
- Table view is a new render path within the same block for `type: 'table'`, consuming the same `collection_records`/`data_collections` API Phase 24's board already uses — no new backend endpoints for reading records, only for view CRUD (create a second `collection_views` row for the table type, or update `type` on switch — planner's call per D-05).

</code_context>

<specifics>
## Specific Ideas

No new visual references beyond the spec's Notion-parity framing. The user favored the more flexible/robust option where it doesn't add much complexity (toolbar dropdown filter/sort builder with multi-condition support, dedicated view-settings picker for card-face properties) but deferred exact placement/interaction details for aggregations and view-switching to Claude's discretion, and explicitly kept filter logic simple (AND-only, no OR).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Sub-groups/swimlanes (`subGroupBy`) and additional view types beyond table (calendar/gallery/list/timeline) were correctly recognized as out of scope for this phase and not re-discussed here; they remain candidates for a future phase.

### Reviewed Todos (not folded)
None — no todos matched this phase (`gsd-sdk query todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 25-view-ux-parity*
*Context gathered: 2026-07-14*
