# Phase 24: Board View & Legacy Kanban Migration - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Boards become a real, drag-and-drop database view over a `data_collection`, not config-local JSON. A `collection-view` page block renders a board grouped by any select-type property, columns are generated from that property's live option values (never hand-authored), and drag-and-drop (via `@dnd-kit`, already a dependency — `@dnd-kit/sortable` is new ground, not yet used anywhere in the app) moves cards between columns and reorders within a column. Legacy `kanban` blocks auto-migrate to `collection-view`/board on first edit with zero data loss. Filters, sorts, sub-groups, column aggregations, and switching between view types (table/calendar/gallery/etc.) are explicitly Phase 25/26 — this phase only needs board rendering + drag interactions + migration + minimal column/card creation to satisfy BOARD-01..04.

</domain>

<decisions>
## Implementation Decisions

### Legacy Kanban Migration (BOARD-04)
- **D-01:** Migration is silent and automatic — triggered on first edit to an existing `kanban` block (not on page load/view). On first edit, Claude auto-creates a `data_collection` (schema: a text "title" property first, then a `select` "Status" property whose options are the kanban's existing column titles), a `collection_views` row (type `board`, `groupBy` = the Status property), and one `collection_records` row per existing card (title property = `KanbanCard.text`, Status = its column), then swaps the block from `kanban` to `collection-view` pointing at the new collection/view. No data loss, no user-visible flag day beyond the notice below.
- **D-02:** A one-time toast notice appears when the migration runs ("Board upgraded to the new view engine"), auto-dismissing after a few seconds. No persistent dismissed-state needs to be tracked in block config or elsewhere — it's fire-and-forget, shown once at the moment of migration, not on every subsequent load.
- **D-03:** The migrated collection is company-wide, consistent with Phase 22's D-01 (`project_id` stays unused/NULL for all API paths in this milestone) — do not scope migrated collections to a project even though the source page may be project-scoped. This is inherited from Phase 22, not re-litigated.

### New Board Creation From Scratch (BOARD-01)
- **D-04:** Inserting a brand-new `collection-view` board block via the slash menu (i.e., not from a migration) auto-provisions defaults immediately: a new `data_collection` with a default "Status" select property (options: To Do / In Progress / Done, or equivalent minimal starter set) and a board view grouped by it — Trello-style zero-config start. No "pick an existing collection" picker in this phase. The property/options can be renamed later via Phase 23's record-detail property editor and/or the column management described below.

### Column Management (BOARD-01 scope boundary)
- **D-05:** Users CAN add and rename columns directly from the board in this phase (this is in scope, not deferred to Phase 25) — a lightweight "+ Add column" control appends a new select option; column headers are renamable inline. This keeps the board usable standalone without requiring a trip to the record-detail property editor for basic column setup.
- **D-06:** Deleting a column (removing a select option) that still has cards in it is **blocked** — disable or warn the user, forcing them to move cards out of the column first. Do not silently reassign affected cards to a "no value"/orphan bucket; do not implement move-to-no-value logic in this phase.

### Inline Card Creation (BOARD-03)
- **D-07:** A "+ New" control within a column creates a record with that column's `groupBy` value pre-set. The new card's title immediately enters an inline-editable state directly on the card face within the column (not just appearing as a static card, and not auto-navigating to the full record detail page) — the user types the title, commits it (matching Phase 23's title = first schema property convention), and stays on the board. This is new inline-edit-on-card-face UI with no existing analog in the codebase — build it as needed, following the same blur/Enter-commit conventions Phase 23 established for text property fields.

### Claude's Discretion
- Exact visual/interaction polish of the inline "+ Add column" control and the inline-editable new-card title (colors, exact debounce/commit timing) — follow the existing hand-rolled Tailwind system (`saas-card`, `saas-input`, etc.) per Phase 23's established design system decision (no shadcn), not re-litigated here.
- Whether drag-and-drop is implemented via `@dnd-kit/sortable`'s `SortableContext`/`useSortable` (new pattern) vs. composing `useDraggable`/`useDroppable` manually (existing pattern from `dispatch/page.tsx`) — planner/researcher's call; `@dnd-kit/sortable` is available as a dependency but genuinely unused today, so there's no existing analog to clone for within-column reordering specifically.
- Exact default starter option set/labels for a brand-new board's Status property (D-04) — "To Do / In Progress / Done" is a reasonable default, not a hard requirement; any similarly minimal generic starter set is acceptable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Board/migration spec (source of this phase's scope)
- `docs/specs/core/workspace-blocks.md` §2 — the core gap this phase closes ("Kanban is a toy, not a database")
- `docs/specs/core/workspace-blocks.md` §3.2 — `CollectionViewBlock` shape and the exact migration contract ("kanban stays as a legacy alias that auto-migrates... no data loss, no flag day")
- `docs/specs/core/workspace-blocks.md` §6 — Board interactions checklist (drag-and-drop, group by property, "no value" column, add-a-column = add-a-select-option, new-card-inline, switch view type) — note §6 also lists sub-groups/filters/sorts/aggregations/view-switching, which are explicitly Phase 25/26, NOT this phase
- `docs/specs/core/workspace-blocks.md` §3.1 — property type definitions (this phase specifically needs `select` and `text`)
- `.planning/REQUIREMENTS.md` — BOARD-01 through BOARD-04, the requirements this phase must satisfy
- `.planning/ROADMAP.md` Phase 24 section — success criteria and dependency note (depends on Phase 22 data model, Phase 23 record detail page)

### Prior phase deliverables this phase consumes
- `.planning/phases/22-records-views-data-model/22-VERIFICATION.md` — confirms `data_collections`/`collection_records`/`collection_views` API contracts are shipped and tested
- `.planning/phases/23-record-detail-page/23-CONTEXT.md` — D-01 (title = first schema property, explicitly says this convention governs board cards too), D-02 (multi-chip toggle pattern), established property-field editing conventions (blur-commit + debounce)
- `.planning/phases/23-record-detail-page/23-RESEARCH.md` and `23-UI-SPEC.md` — property panel patterns, `AddPropertyModal` two-sequential-request rule (schema PATCH before record PATCH) that this phase's inline "+ Add column" must also follow

### Project-level context
- `.planning/PROJECT.md` — "no ORM" constraint, reuse-over-rebuild constraint, `company_id`-scoping convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/domains/records/records.routes.ts` — `PATCH /records/:id` already accepts both `props` (for column/groupBy moves) and `sort_order` (for within-column reordering) in one call per `apps/api/src/domains/records/dto/update-record.dto.ts` — no new backend endpoint needed for BOARD-02.
- `apps/api/src/domains/records/records.routes.ts` — `PATCH /collections/:id` (schema update) exists for adding a new select option (column) to the groupBy property; `POST /collections/:id/records` for creating migrated/new cards.
- `apps/workspaces/src/app/(routes)/dispatch/page.tsx` — existing `@dnd-kit/core` usage pattern (`DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `closestCenter`) for drag interactions in this codebase; clone the overall wiring style even though it doesn't cover sortable-within-a-list reordering.
- `apps/workspaces/src/lib/projectPage/blocks.ts` — `KanbanBlock`/`KanbanColumn`/`KanbanCard` types (lines ~227-244) define exactly what legacy data must be read and converted during migration. `DraftsKanbanBlock`/`drafts-kanban` is a distinct, unrelated block (derives columns from live shipment data) and must NOT be touched or migrated — only the generic `kanban` kind migrates.
- `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` — current `KanbanBoardView` renderer/editor for the legacy block; this is what gets replaced by the new `collection-view` board renderer once migrated.
- `apps/workspaces/src/lib/projectPage/registry.tsx` — where `'kanban'` is registered today (`entry('kanban', ...)`); the new `'collection-view'` kind needs its own registry entry following the same pattern.

### Established Patterns
- Registry-driven block system: new block kinds are `PageBlockKind` union member + renderer + one `entry()` call in `registry.tsx`, per the v2.0 `WorkspaceBlockRegistry` engine — `collection-view` is a new kind, not a variant of `kanban`.
- Two-sequential-request rule from Phase 23: schema mutations (`PATCH /collections/:id`) must complete before dependent record mutations — applies to this phase's "+ Add column" (schema PATCH) before any card move into a newly-added column.
- `@dnd-kit/sortable` (`^10.0.0`) is an installed dependency but has zero current usage anywhere in the app — genuinely new ground for within-column reordering, no existing pattern to clone.

### Integration Points
- New block kind `collection-view` registers in `blocks.ts` (`PageBlockKind` union + `CollectionViewBlock` interface) and `registry.tsx` (renderer + editor entry), replacing/aliasing `kanban`'s slot in the slash menu once migration exists.
- Board component reads `collection_views.config` (`groupBy`, eventually `subGroupBy`/`filters`/`sorts`/`cardProperties` in later phases) and `collection_records` scoped to `collectionId` via the Phase 22 API, plus renders cards using the same title convention Phase 23 established.
- Cards created/edited on the board and opened via click route into Phase 23's `/collections/[collectionId]/records/[recordId]` detail page.

</code_context>

<specifics>
## Specific Ideas

No specific visual/UX references beyond what the spec's Notion/Trello parity framing already implies. The user consistently favored the option that keeps the board usable end-to-end on its own (column add/rename in-board, inline card creation) over deferring those to a separate schema-editing surface, while still keeping guardrails simple (blocking non-empty column deletion rather than building reassignment logic).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Filters/sorts/sub-groups/column aggregations/view-switching (Phase 25) and additional view types — table/list/calendar/gallery/timeline (Phase 26) were correctly recognized as out of scope and not re-discussed here.

### Reviewed Todos (not folded)
None — no todos matched this phase (`gsd-sdk query todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 24-board-view-legacy-kanban-migration*
*Context gathered: 2026-07-14*
