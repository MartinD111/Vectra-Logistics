# Roadmap: Vectra

## Milestones

- ✅ **v1.0 CRM Rework** — Phases 1-6 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Workspace Engine — Engine Unification** — Phases 7-13 (shipped 2026-07-12) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 On-Premise GA** — Phases 14-20 (shipped 2026-07-13) — [archive](milestones/v3.0-ROADMAP.md)
- 🚧 **v4.0 Workspace Records & Views** — Phases 21-26 (active)

## Phases

<details>
<summary>✅ v1.0 CRM Rework (Phases 1-6) — SHIPPED 2026-07-06</summary>

- [x] Phase 1: Schema & CRM Domain Foundation (3/3 plans) — completed 2026-07-05
- [x] Phase 2: CRM Dashboard, Navigation & Client Detail (4/4 plans) — completed 2026-07-06
- [x] Phase 3: Per-Project Client Overrides (2/2 plans) — completed 2026-07-06
- [x] Phase 4: Bulk Excel Import (2/2 plans) — completed 2026-07-06
- [x] Phase 5: Email History Sync (2/2 plans) — completed 2026-07-06
- [x] Phase 6: Credit-Risk KPI Evaluator & Semaphore (2/2 plans) — completed 2026-07-06

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Workspace Engine — Engine Unification (Phases 7-13) — SHIPPED 2026-07-12</summary>

- [x] Phase 7: Engine Foundation + Page Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 8: Page Read-Rendering → Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 9: Page Edit-Mode + Slash → Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 10: Mini Program onto the Engine (1/1 plans) — completed 2026-07-06
- [x] Phase 11: Palette Derivation Unification (1/1 plans) — completed 2026-07-11
- [x] Phase 12: Extensibility Proof (2/2 plans) — completed 2026-07-11
- [x] Phase 13: Cleanup, ADR & Park WorkflowBuilder (1/1 plans) — completed 2026-07-12

Full detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Milestone audit: [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) — status: tech_debt (14/14 requirements satisfied, no functional gaps; missing VERIFICATION.md for phases 7-11 backfillable via `/gsd:validate-phase`)

</details>

<details>
<summary>✅ v3.0 On-Premise GA (Phases 14-20) — SHIPPED 2026-07-13</summary>

- [x] Phase 14: Security Hardening (2/2 plans) — completed 2026-07-12
- [x] Phase 15: Migration Runner (1/1 plans) — completed 2026-07-12
- [x] Phase 16: Production Compose + DEPLOYMENT_MODE (2/2 plans) — completed 2026-07-12
- [x] Phase 17: Installer / First-Run Flow (3/3 plans) — completed 2026-07-12
- [x] Phase 18: Backend-side Local AI Provider (1/1 plans) — completed 2026-07-12
- [x] Phase 19: Release Versioning & Upgrade Docs (3/3 plans) — completed 2026-07-13
- [x] Phase 20: Deploy Hardening + Connectivity Doc (4/4 plans) — completed 2026-07-13

Full detail: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)
Milestone audit: [milestones/v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) — status: passed (17/17 requirements satisfied; 2 cross-phase integration blockers found and fixed inline during audit — see report)

</details>

<details open>
<summary>🚧 v4.0 Workspace Records & Views (Phases 21-26) — ACTIVE</summary>

- [ ] **Phase 21: Missing Content Blocks** - Card bodies get a complete generic block palette (checklist, toggle, quote, code, media, table, columns, sub-page, mention)
- [ ] **Phase 22: Records + Views Data Model** - New `records` API domain with a schema-driven collections/records/views database
- [ ] **Phase 23: Record Detail Page** - Records open as full pages with a schema-driven property panel and the existing block editor as body
- [ ] **Phase 24: Board View & Legacy Kanban Migration** - `collection-view` block renders a real drag-and-drop board; legacy `kanban` blocks auto-migrate with zero data loss
- [ ] **Phase 25: View UX Parity** - Filters/sorts, card preview properties, column aggregations, and view switching match the parity bar for a real Views engine
- [ ] **Phase 26: Additional View Types** - Table, list, calendar, and gallery/timeline views render over the same collection

</details>

## Phase Details

### Phase 21: Missing Content Blocks

**Goal**: A page/record body can express every generic block kind from the spec's Basic/Media/Database "missing" set — `callout` already exists and is excluded
**Depends on**: Nothing (first phase, pure block-registry additions)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08, CONT-09
**Success Criteria** (what must be TRUE):

  1. User can insert a checklist/to-do block via the slash menu and toggle individual items complete
  2. User can insert a toggle block that collapses/expands its nested child blocks
  3. User can insert a quote block, a fenced code block with a language picker, and each of image/file/video/bookmark/embed media blocks
  4. User can insert a simple inline table block and a multi-column layout block, distinct from any collection-view table
  5. User can insert a sub-page link block and type `@` inline to mention a person, page, or date

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 21-01-PLAN.md — Foundation (nestable flag) + Checklist, Quote, Code blocks (CONT-01, CONT-03, CONT-04)
- [x] 21-02-PLAN.md — @mention system: person/page/date (CONT-09)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-03-PLAN.md — Table + media blocks, URL-only (CONT-05, CONT-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 21-04-PLAN.md — Sub-page link block (CONT-08)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 21-05-PLAN.md — Toggle + Columns nesting (CONT-02, CONT-07)

**UI hint**: yes

### Phase 22: Records + Views Data Model

**Goal**: A company-scoped, schema-driven records database exists as a new API domain, independent of any UI
**Depends on**: Nothing (parallel-safe with Phase 21; pure backend)
**Requirements**: REC-01, REC-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):

  1. A collection can be created with an ordered schema of typed properties (text, number, date, select, multi-select, checkbox, person, url, email, phone, files, relation), scoped to a company
  2. A record can be created against a collection storing both `props` (property values) and a `body` block document in the same shape as `PageConfig`
  3. A view can be saved against a collection with `type`/`groupBy`/`subGroupBy`/`filters`/`sorts`/`cardProperties` config and later retrieved unchanged
  4. A record can reference another record as its parent via `parent_record_id`, and children can be queried for a given parent

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 22-01-PLAN.md — Migration 025 + records.types.ts + DTOs (REC-01, REC-02, REC-03, REC-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02-PLAN.md — Repository layer: CRUD + D-03 transaction + REC-04 parent/child query (REC-01, REC-02, REC-03, REC-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-03-PLAN.md — Service layer: Zod validation, D-02 prop-type checking, D-03 default-view wiring (REC-01, REC-02, REC-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 22-04-PLAN.md — Controller + routes + domain registration (REC-01, REC-02, REC-03, REC-04)

**UI hint**: no

### Phase 23: Record Detail Page

**Goal**: A record opens as a full page — title, schema-driven property panel, and body — using the existing editor with zero new editor code
**Depends on**: Phase 21 (body content blocks), Phase 22 (data model)
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04
**Success Criteria** (what must be TRUE):

  1. Clicking a record opens a detail page/panel showing its title, a property panel, and its body content
  2. User can edit a record's properties inline via type-appropriate editors (select dropdown, person picker, date picker, checkbox, etc.) and see the change persist
  3. Adding a new property from the record detail panel adds it to the collection's schema, and it appears on other records of that collection
  4. User can edit the record body with the full existing page editor (slash menu, headings, checklists, and all Phase 21 blocks) — no bespoke record-body editor code

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Frontend data layer (records.api.ts, useRecords.ts) + schema-driven PropertyField editor, all 12 property types (CARD-02, CARD-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — PropertyPanel + AddPropertyModal + record detail page route wiring LivePageCanvas body (CARD-01, CARD-02, CARD-03, CARD-04)

**UI hint**: yes

### Phase 24: Board View & Legacy Kanban Migration

**Goal**: Boards are real, drag-and-drop database views over a collection, and no existing page loses kanban data in the transition
**Depends on**: Phase 22 (data model), Phase 23 (record detail page cards open into)
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04
**Success Criteria** (what must be TRUE):

  1. A `collection-view` page block renders a board whose columns are the live values of any chosen select-type property, never hand-authored
  2. User can drag a card to a different column (updating its `groupBy` property value) and reorder cards within a column (updating `sort_order`), using `@dnd-kit`
  3. User can create a new card inline within a column, pre-set to that column's `groupBy` value
  4. Opening a page with a legacy `kanban` block and making any edit auto-migrates it to a `collection-view`/board with all existing cards and data intact

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 24-01-PLAN.md — Data layer: records.api.ts + useRecords.ts extensions, createRecord bug fix (BOARD-01, BOARD-02, BOARD-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-02-PLAN.md — collection-view block kind, board rendering, drag-and-drop, column/card management (BOARD-01, BOARD-02, BOARD-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 24-03-PLAN.md — Legacy kanban migration transform + gate + toast (BOARD-04)

**Gap closure**

- [x] 24-04-PLAN.md — Board provisioning (D-04 stale-closure fix) + inline card cache write (BOARD-01, BOARD-03)

**UI hint**: yes

### Phase 25: View UX Parity

**Goal**: Views behave like a real database view layer, not a static board — filtering, sorting, customizable card faces, aggregations, and switching without data duplication
**Depends on**: Phase 24 (collection-view block and board view established)
**Requirements**: VIEWX-01, VIEWX-02, VIEWX-03, VIEWX-04
**Success Criteria** (what must be TRUE):

  1. User can apply filters and sorts to a view and see the record list update accordingly
  2. User can choose which properties display on a card's face preview
  3. User can see column aggregations on a board (count, and sum/avg for a chosen number property)
  4. User can switch a `collection-view` block between view types on the same collection without creating duplicate records

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 25-01-PLAN.md — Data-layer foundation: updateView API/hook + viewFilters.ts pure filter/sort/aggregate logic (VIEWX-01, VIEWX-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 25-02-PLAN.md — FilterSortToolbar + BoardBlock wiring (VIEWX-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 25-03-PLAN.md — ViewSettingsMenu (card-face picker + aggregation config) + ColumnAggregation footer + BoardCard/BoardColumn/BoardBlock wiring (VIEWX-02, VIEWX-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 25-04-PLAN.md — CollectionTableView + ViewSwitcher + BoardBlock view-type branching (VIEWX-04)

**UI hint**: yes

### Phase 26: Additional View Types

**Goal**: The same collection can be viewed as a table, list, calendar, or gallery/timeline — all reading the same records
**Depends on**: Phase 24 (collection-view block scaffold), can run alongside Phase 25
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05
**Success Criteria** (what must be TRUE):

  1. User can view a collection as a sortable/filterable table of rows and columns
  2. User can view a collection as a flat list
  3. User can view a collection as a calendar, with records plotted by a chosen date property
  4. User can view a collection as a gallery (card grid, optional cover image) and as a timeline/Gantt plotted by a date-range property

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order (v4.0):**
Phases execute in numeric order: 21 → 22 (parallel-safe with 21) → 23 → 24 → 25 → 26 (can run alongside 25)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema & CRM Domain Foundation | v1.0 | 3/3 | Complete | 2026-07-05 |
| 2. CRM Dashboard, Navigation & Client Detail | v1.0 | 4/4 | Complete | 2026-07-06 |
| 3. Per-Project Client Overrides | v1.0 | 2/2 | Complete | 2026-07-06 |
| 4. Bulk Excel Import | v1.0 | 2/2 | Complete | 2026-07-06 |
| 5. Email History Sync | v1.0 | 2/2 | Complete | 2026-07-06 |
| 6. Credit-Risk KPI Evaluator & Semaphore | v1.0 | 2/2 | Complete | 2026-07-06 |
| 7. Engine Foundation + Page Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 8. Page Read-Rendering → Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 9. Page Edit-Mode + Slash → Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 10. Mini Program onto the Engine | v2.0 | 1/1 | Complete | 2026-07-06 |
| 11. Palette Derivation Unification | v2.0 | 1/1 | Complete | 2026-07-11 |
| 12. Extensibility Proof | v2.0 | 2/2 | Complete | 2026-07-11 |
| 13. Cleanup, ADR & Park WorkflowBuilder | v2.0 | 1/1 | Complete | 2026-07-12 |
| 14. Security Hardening | v3.0 | 2/2 | Complete    | 2026-07-12 |
| 15. Migration Runner | v3.0 | 1/1 | Complete   | 2026-07-12 |
| 16. Production Compose + DEPLOYMENT_MODE | v3.0 | 2/2 | Complete    | 2026-07-12 |
| 17. Installer / First-Run Flow | v3.0 | 3/3 | Complete   | 2026-07-12 |
| 18. Backend-side Local AI Provider | v3.0 | 1/1 | Complete   | 2026-07-12 |
| 19. Release Versioning & Upgrade Docs | v3.0 | 3/3 | Complete    | 2026-07-13 |
| 20. Deploy Hardening + Connectivity Doc | v3.0 | 4/4 | Complete    | 2026-07-13 |
| 21. Missing Content Blocks | v4.0 | 5/5 | Complete   | 2026-07-13 |
| 22. Records + Views Data Model | v4.0 | 4/4 | Complete   | 2026-07-14 |
| 23. Record Detail Page | v4.0 | 2/2 | Complete   | 2026-07-14 |
| 24. Board View & Legacy Kanban Migration | v4.0 | 4/4 | Complete    | 2026-07-14 |
| 25. View UX Parity | v4.0 | 3/4 | In Progress|  |
| 26. Additional View Types | v4.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-05 · v1.0 archived: 2026-07-06 · v2.0 archived: 2026-07-12 · v3.0 archived: 2026-07-13 · v4.0 roadmap added: 2026-07-13*
