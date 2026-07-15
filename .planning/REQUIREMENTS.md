# Requirements: Vectra — v4.0 Workspace Records & Views

**Defined:** 2026-07-13
**Core Value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion. (Unchanged platform Core Value; this milestone extends the Workspace Engine, not the CRM.)

**Milestone goal:** Elevate Kanban from a page-JSON placeholder into a real Records+Views database engine (`data_collections`/`collection_records`/`collection_views`), with cards that open as full pages reusing the existing editor. Scoped entirely to `docs/specs/core/workspace-blocks.md`'s gap.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Content Blocks

- [x] **CONT-01**: User can add a checklist/to-do block with checkable items
- [x] **CONT-02**: User can add a collapsible toggle block containing child blocks
- [x] **CONT-03**: User can add a quote block
- [x] **CONT-04**: User can add a fenced code block with language selection
- [x] **CONT-05**: User can add media blocks (image, file, video, bookmark, embed)
- [x] **CONT-06**: User can add a simple inline table block (distinct from a collection-view table)
- [x] **CONT-07**: User can add a multi-column layout block
- [x] **CONT-08**: User can add an inline sub-page link block
- [x] **CONT-09**: User can @mention a person/page/date inline in rich text

### Records + Views Data Model

- [x] **REC-01**: A collection has a company-scoped, ordered schema of generic properties (text, number, date, select, multi-select, checkbox, person, url, email, phone, files, relation)
- [x] **REC-02**: A record stores property values (`props`) and a body (block document) in the same shape as a page's `PageConfig`
- [x] **REC-03**: A view is a saved lens (board/table/list/calendar/gallery/timeline) with `groupBy`/`subGroupBy`/`filters`/`sorts`/`cardProperties` config
- [x] **REC-04**: Records support sub-items (nested records via `parent_record_id`)

### Record Detail Page

- [x] **CARD-01**: User can open a record as a detail page/panel showing title + property panel + body
- [x] **CARD-02**: User can edit a record's properties via schema-driven inline editors (select, person, date, checkbox, etc.)
- [x] **CARD-03**: Adding a new property from the record detail panel adds it to the collection's schema
- [x] **CARD-04**: User can edit the record body using the full existing page editor (slash menu, headings, checklists, etc.) — zero new editor code

### Board View

- [x] **BOARD-01**: A `collection-view` page block renders a board grouped by any select-type property (columns are the property's values, never hand-authored)
- [x] **BOARD-02**: User can drag-and-drop a card between columns (updates the `groupBy` property) and reorder within a column (updates `sort_order`)
- [x] **BOARD-03**: User can create a new card inline within a column, pre-set to that column's `groupBy` value
- [x] **BOARD-04**: Legacy `kanban` blocks auto-migrate to `collection-view`/board on first edit with zero data loss

### View UX Parity

- [x] **VIEWX-01**: User can filter and sort a view's records
- [x] **VIEWX-02**: User can choose which properties preview on a card face
- [x] **VIEWX-03**: User can see column aggregations (count, sum/avg of a number property, etc.) on a board
- [x] **VIEWX-04**: User can switch between view types on the same collection without duplicating records

### Additional View Types

- [x] **VIEW-01**: User can view a collection as a table (rows/columns, sortable/filterable) — delivered by Phase 25 plan 25-04 (`CollectionTableView.tsx`)
- [x] **VIEW-02**: User can view a collection as a flat list
- [x] **VIEW-03**: User can view a collection as a calendar, plotted by a date property
- [x] **VIEW-04**: User can view a collection as a gallery (card grid with optional cover image)
- [x] **VIEW-05**: User can view a collection as a timeline/Gantt, plotted by a date-range property

## v2 Requirements

Deferred to a future release. Tracked but not in this milestone's roadmap.

### Realtime Collaboration

- **RTSYNC-01**: Record edits broadcast live to other users viewing the same collection (debounced autosave + `collection:record:updated` via the existing `emitToRoom` socket.io bus, optimistic apply, last-write-wins)
- **RTSYNC-02**: Full multi-caret co-editing (CRDT) — explicitly a later, separate effort per `workspace-blocks.md` §7

### Advanced Blocks

- **SYNCBLK-01**: Synced blocks (Loop-style content mirrored in multiple places)

## Out of Scope

Explicitly excluded from v4.0. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Realtime record sync | Deferred to v2 Requirements — v4.0 is scoped to the core Records+Views engine; single-user editing still saves/reloads correctly without it |
| Full CRDT co-editing | Explicitly deferred in the spec itself (`workspace-blocks.md` §7) — last-write-wins is the v4.0 target, not concurrent multi-caret editing |
| Synced blocks | Higher-effort Loop-signature feature, explicitly called out as "later" in the spec |
| KPI scheduler + `response_time` evaluator (`kpi-engine.md`) | Different core spec, deliberately deferred to keep this milestone narrow (per the user's explicit scope decision) |
| Program-builder generic blocks (`program-builder.md`) | Different core spec, same reasoning |
| Document AI/OCR real wiring (`ai-integration.md` §6.2/§5) | Different core spec, same reasoning |
| Event-spine retention/partitioning strategy (`event-spine.md` §8) | Different core spec, same reasoning |
| `task_completion`/`on_time_delivery` KPI evaluators | Explicitly depend on this milestone's Records+Views model shipping first — candidate for whichever future milestone picks up `kpi-engine.md` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 21 | Done |
| CONT-02 | Phase 21 | Done |
| CONT-03 | Phase 21 | Done |
| CONT-04 | Phase 21 | Done |
| CONT-05 | Phase 21 | Done |
| CONT-06 | Phase 21 | Done |
| CONT-07 | Phase 21 | Done |
| CONT-08 | Phase 21 | Done |
| CONT-09 | Phase 21 | Done |
| REC-01 | Phase 22 | Complete |
| REC-02 | Phase 22 | Complete |
| REC-03 | Phase 22 | Complete |
| REC-04 | Phase 22 | Complete |
| CARD-01 | Phase 23 | Complete (code-verified; human verification pending) |
| CARD-02 | Phase 23 | Complete (code-verified; human verification pending) |
| CARD-03 | Phase 23 | Complete (code-verified; human verification pending) |
| CARD-04 | Phase 23 | Complete (code-verified; human verification pending) |
| BOARD-01 | Phase 24 | Complete |
| BOARD-02 | Phase 24 | Complete |
| BOARD-03 | Phase 24 | Complete |
| BOARD-04 | Phase 24 | Complete |
| VIEWX-01 | Phase 25 | Complete |
| VIEWX-02 | Phase 25 | Complete |
| VIEWX-03 | Phase 25 | Complete |
| VIEWX-04 | Phase 25 | Complete |
| VIEW-01 | Phase 25 | Complete |
| VIEW-02 | Phase 26 | Complete |
| VIEW-03 | Phase 26 | Complete |
| VIEW-04 | Phase 26 | Complete |
| VIEW-05 | Phase 26 | Complete |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30/30 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 — ROADMAP.md created (Phases 21-26), full traceability populated*
