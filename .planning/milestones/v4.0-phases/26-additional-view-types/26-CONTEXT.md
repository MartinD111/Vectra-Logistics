# Phase 26: Additional View Types - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The same `data_collection` gains four new lenses beyond Board and Table (shipped in Phase 25): List, Calendar, Gallery, and Timeline/Gantt. Each is a new `type` value on `collection_views` (`list | calendar | gallery | timeline`), rendered by the same `collection-view` block via the same view-switching create-once-then-remember mechanism Phase 25's `ViewSwitcher` already established — no new block kind, no data duplication. All four reuse the existing `collection_records`/`data_collections` read API; none require new backend endpoints beyond the existing view CRUD. Filters/sorts (Phase 25's `viewFilters.ts`) apply uniformly across all view types where relevant. Sub-groups/swimlanes remain out of scope (unchanged from Phase 24/25).

</domain>

<decisions>
## Implementation Decisions

### Calendar View (VIEW-03)
- **D-01:** The date property that plots records is user-chosen per view (Claude's discretion confirmed this direction) — a view-settings picker (following Phase 25's `ViewSettingsMenu` aggregation-property-picker pattern) lets the user select which `date`-type schema property drives calendar placement. Persists to `view.config` (new field, e.g. `calendarDateProperty`).
- **D-02:** Records with no value set for the chosen date property are **not silently hidden** — they render in an "Unscheduled" tray/sidebar alongside the calendar grid, so nothing disappears without explanation.
- **D-03:** Scope for this phase is a single **month view** with prev/next navigation, plus click-an-empty-day-to-create: clicking a day cell creates a new record with that date pre-set on the chosen date property (mirrors Phase 24's D-07 inline "+ New" pattern — title enters inline-editable state, no auto-navigation to record detail).

### Gallery View (VIEW-04)
- **D-04:** Cover image is user-chosen per view — a view-settings picker lets the user select which `files`-type schema property supplies the cover image (same picker pattern as D-01). First file in that property's value renders as the card's cover image.
- **D-05:** When a record has no cover image (property unset, no `files`-type property picked for the view, or the picked property is empty for that record), the card shows a plain placeholder header block (no broken-image icon) with the card-face properties (Phase 25's `cardProperties[]`) rendered below, same as today's board cards.

### Timeline/Gantt View (VIEW-05)
- **D-06:** The spec's "date-range property" is represented as **two separately-chosen existing `date`-type properties** — a view-settings picker lets the user pick a "Start date" property and an "End date" property (both ordinary `date` types already in the schema). **No new `date-range` property type, no schema/migration change.** The timeline draws a bar from start value to end value per record.
- **D-07:** A record needs both the start and end date values set to render a bar on the timeline. If either is absent, the record does not render on the timeline (user chose "hidden" over a single-day point-marker fallback) — still visible in other views (board/table/list/calendar).
- **D-08:** Scope for this phase is a **fixed month-wide horizontal scale** with prev/next month navigation (mirroring Calendar's D-03 navigation) — bars render proportionally within the visible month. No day/week/quarter zoom controls, no infinite horizontal scroll.

### List View (VIEW-02)
- **D-09:** List is visually and structurally distinct from Table — single-column rows, not a grid. Each row shows the record's title (bold, left) plus Phase 25's `cardProperties[]` rendered as inline chips/text to the right of the title (reusing the card-face property picker and `formatCardPropertyValue` logic from `BoardCard.tsx`, not table's column-per-property layout).

### View Switcher UI (cross-cutting, all view types)
- **D-10:** The `ViewSwitcher` component (currently a 2-button segmented control for Board/Table) is replaced with a **dropdown/menu** showing the current view type + icon, opening a menu listing all 6 types (Board, Table, List, Calendar, Gallery, Timeline) on select. This replaces, not supplements, the existing segmented buttons. The underlying create-once-then-remember mechanism (look up existing sibling view by type before creating; `pendingType` in-flight guard from Phase 25's WR-03 fix) carries over unchanged — only the trigger UI changes.

### Claude's Discretion
- Exact visual layout/spacing of the "Unscheduled" tray (D-02) — sidebar vs. collapsible panel vs. bottom drawer; follow whatever is simplest given the calendar grid's layout.
- Exact dropdown menu styling for the new ViewSwitcher (D-10) — follow the existing hand-rolled Tailwind design system (no shadcn), consistent with Phase 23/24's established conventions.
- Whether the two-date-property picker for Timeline (D-06) lives in the same `ViewSettingsMenu` component extended with new view-type-conditional sections, or a small dedicated settings panel per view type — planner's call, but prefer extending the existing menu over creating parallel settings surfaces per view type.
- Gantt bar visual styling (color, rounding, hover states) and calendar day-cell density — reasonable defaults, not hard requirements.
- Whether "Unscheduled" tray records are click-to-open (same as any card) — assume yes, consistent with every other view's card-click behavior, not re-litigated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Views spec (source of this phase's scope)
- `docs/specs/core/workspace-blocks.md` §3.1 — property type definitions (confirms only single-value `date` exists today, no date-range type — informs D-06)
- `docs/specs/core/workspace-blocks.md` §3.3 — `collection_views.type` enum (`board|table|calendar|gallery|list|timeline`) — this phase adds the remaining 4 values
- `docs/specs/core/workspace-blocks.md` §6 — "Switch view type... without duplicating records" and "Card preview properties... optional cover image (gallery-style)" — the exact behaviors this phase must preserve/extend
- `.planning/REQUIREMENTS.md` — VIEW-01 through VIEW-05 (VIEW-01/table already satisfied by Phase 25)
- `.planning/ROADMAP.md` Phase 26 section — success criteria and dependency note (depends on Phase 24's collection-view block scaffold; can run alongside Phase 25 but in practice follows it since it reuses Phase 25's cardProperties/ViewSettingsMenu/filters)

### Prior phase deliverables this phase consumes
- `.planning/phases/25-view-ux-parity/25-CONTEXT.md` — D-03/D-04 view-settings picker pattern (property checklist + aggregation-property picker), D-05 create-once-then-remember view-switching mechanism this phase extends from 2 to 6 types
- `.planning/phases/25-view-ux-parity/25-SUMMARY.md` files — `ViewSwitcher.tsx` (pendingType guard, WR-03 fix), `ViewSettingsMenu.tsx` (card-face + aggregation pickers), `BoardCard.tsx`'s `formatCardPropertyValue` (label resolution for person/multi-select — List view's inline chips reuse this), `CollectionTableView.tsx` (Table view precedent, lives in its own `collectionTable/` subfolder to avoid naming collisions)
- `.planning/phases/24-board-view-legacy-kanban-migration/24-CONTEXT.md` — D-07 inline "+ New" card-creation pattern (title inline-editable, blur/Enter-commit) that Calendar's click-a-day-to-create (D-03) follows
- `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` — current 2-button segmented control; read in full before extending to a dropdown (D-10)
- `apps/workspaces/src/lib/projectPage/viewFilters.ts` — `applyFilters`/`applySorts`/`aggregateColumn` — reused unchanged across all new view types where filters/sorts apply

### Project-level context
- `.planning/PROJECT.md` — "no ORM" constraint, reuse-over-rebuild constraint, `company_id`-scoping convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` — `useViews`/`useCreateView` hooks and the `pendingType` duplicate-guard pattern extend directly to 4 more `type` values; only the trigger UI (segmented buttons → dropdown) changes.
- `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` — card-face checklist + aggregation-property picker pattern is the direct precedent for Calendar's date-property picker (D-01), Gallery's cover-image-property picker (D-04), and Timeline's start/end-date pickers (D-06) — all are "pick a schema property of type X" pickers, same shape as the existing aggregation picker filtered to `type === 'number'`.
- `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` — `formatCardPropertyValue` (person/multi-select label resolution, fixed in Phase 25's WR-01/WR-02) is reused as-is by List view's inline property chips (D-09) and Gallery's card-face properties (D-05).
- `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` — Table view's precedent for a new sibling view-type component living in its own subfolder; List/Calendar/Gallery/Timeline should follow the same "new file per view type, mounted via `view.type` branching in `BoardBlock.tsx`" structure rather than growing one mega-component.
- `apps/workspaces/src/lib/projectPage/viewFilters.ts` — `applyFilters`/`applySorts` apply before handing records to any of the 4 new view renderers, same as Table/Board today.

### Established Patterns
- Registry-driven block system unchanged — `collection-view` is already registered; this phase only adds render branches inside it (`view.type === 'calendar' | 'gallery' | 'list' | 'timeline'`), same pattern as Phase 25's `view.type === 'table'` branch in `BoardBlock.tsx`.
- View-settings pickers are per-view-type-conditional sections inside (or extending) `ViewSettingsMenu.tsx` — new pickers only show when relevant to the current view's type.
- `view.config` is a JSONB blob; new fields (`calendarDateProperty`, `galleryCoverProperty`, `timelineStartProperty`, `timelineEndProperty`) are additive keys on the same shape — no migration needed per Phase 22/25 precedent (config is untyped JSONB).

### Integration Points
- All 4 new view renderers mount inside `BoardBlock.tsx`'s existing `view.type` branch alongside Board/Table, consuming the same `sorted`/filtered records array and the same `useUpdateAnyRecord` instance (no re-fetch, no re-materialization) — same integration contract Phase 25's Table view already proved out.
- Calendar's click-a-day and any future inline-create paths route through the same record-creation flow Phase 24 established for board's "+ New" column button.
- Cards/rows across all 4 new views open the same record-detail page click-through Phase 23 established (`/collections/{collectionId}/records/{recordId}`), never becoming an inline editor.

</code_context>

<specifics>
## Specific Ideas

No new visual references beyond the spec's Notion-parity framing. The user consistently favored the "recommended" option in every question — user-chosen property pickers over hard-coded auto-selection (Calendar's date property, Gallery's cover property, Timeline's start/end properties), an explicit "Unscheduled" tray over silently hiding date-less records on Calendar, and a dropdown/menu switcher over a crowded 6-button row. The one deliberate divergence from a hard default: Timeline's missing-date handling is "hidden" (not point-marker fallback), which is consistent with the "don't invent forgiving logic beyond what's asked" principle already established in Phase 24 (D-06, blocking non-empty column deletion rather than silent reassignment).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. A genuine `date-range` property type (as opposed to two separate `date` properties) was considered (D-06) and explicitly deferred as unnecessary scope for this phase; it remains a candidate for a future phase if a two-property representation proves limiting. Day/week/quarter zoom controls for Timeline and multi-month Calendar navigation were also raised implicitly and deferred as out of scope (D-08 fixes the phase to single month-wide scale).

### Reviewed Todos (not folded)
None — no todos matched this phase (no `.planning/todos/` entries referencing view types, calendar, gallery, or timeline were found).

</deferred>

---

*Phase: 26-additional-view-types*
*Context gathered: 2026-07-15*
