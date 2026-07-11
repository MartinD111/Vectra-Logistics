# Requirements: Workspace Engine v2.0 — Engine Unification

**Milestone Core:** One plugin-driven block engine where rendering is `registry.render(block)` — "add a block = write one plugin entry, change nothing else." Engine unification only; no new user features, no schema change, app fully working after every phase.

## v2.0 Requirements

### Engine (ENG)

- [ ] **ENG-01**: A single generic `WorkspaceBlockRegistry` + `render(block, ctx)` engine exists, parameterized by block type and render context, instantiable by more than one domain
- [ ] **ENG-02**: One `WorkspaceBlockPlugin` contract expresses both native (code-component) plugins and manifest (declarative, sandboxed) plugins, and `render` dispatches to the correct flavor
- [ ] **ENG-03**: The page block registry is exhaustive over every `PageBlockKind`, enforced at compile time (a missing kind fails `tsc`, not production)

### Rendering (RND)

- [ ] **RND-01**: Project-page read-mode rendering dispatches through the registry (no `switch(block.kind)` in `PageBlockView`), and every existing block kind renders identically (including the mini-program/program-link embeds)
- [ ] **RND-02**: Project-page edit-mode dispatches through the registry (no second switch in `LivePageCanvas`), preserving the inline editors and falling back to the read renderer for widgets
- [ ] **RND-03**: The persisted page document (`{version:1, blocks}`) and the autosave PATCH payload are byte-identical before and after the refactor — no data migration

### Palette & Slash (PAL)

- [ ] **PAL-01**: The page slash menu derives its items from the registry while preserving heading→H1/H2/H3 and list→bulleted/numbered variant expansion and keyword search; the bespoke `/` contentEditable trigger is unchanged
- [x] **PAL-02**: Both the page slash/insert menu and the mini-program add-menu derive their available-block lists from one shared `buildPaletteItems` helper

### Mini Program (MPG)

- [ ] **MPG-01**: Mini Program block rendering dispatches through the same registry engine (no `switch(block.kind)` in `BlockView`); existing manifest plugins still render via `DynamicBlockView`
- [ ] **MPG-02**: A v2 mini-program round-trips (load → run → export) identically, and the page-embedded mini-program block still runs

### Extensibility (EXT)

- [ ] **EXT-01**: A developer can add a new native block by adding one `WorkspaceBlockPlugin` entry (union member + interface + registry entry) with zero edits to any dispatch file — proven by adding a trivial block whose `git diff --stat` touches only new/registry files
- [ ] **EXT-02**: A developer can add a new manifest/sandboxed block via the declarative path — proven by one example plugin rendering end-to-end

### Docs & Cleanup (DOC)

- [ ] **DOC-01**: No `switch(block.kind)` remains in any page or mini-program render/edit path
- [ ] **DOC-02**: An ADR documents the engine, the native-vs-manifest split, the `keyOf` seam, and the package-promotion path; the automations `WorkflowBuilder` is documented as explicitly deferred

## Future Requirements (deferred — North Star)

- Document schema v2: page-level properties bag, nested block children, columns/toggle layout
- Notion-style database engine: pages-as-rows, views (table/board/calendar/gallery/timeline), relations, rollups, formulas
- Realtime collaboration: presence, cursors, block locking, CRDT/multiplayer, offline editing
- Expanded block library (media, collaboration, interactive, automation, AI blocks) as plugins
- Company-scoped plugin persistence + marketplace install/uninstall (Mini Program plugins Phase K)
- Migrating the automations `WorkflowBuilder` onto the unified engine

## Out of Scope (v2.0)

- Merging `PageBlock` and `Block` into one global union — churns persisted discriminants for no gain; keep two typed registries over one generic engine
- Any change to `project_pages.config` / `programs.config` JSON shape or backend domains
- New user-facing block types or features (beyond the trivial extensibility-proof block)
- Unifying the two slash/palette **UX surfaces** (page `/` menu vs mini-program drag palette) — only their item derivation is shared
- Touching the bespoke contentEditable editor (`EditableRichText`) internals

## Traceability

| Requirement | Phase |
|-------------|-------|
| ENG-01 | Phase 7 |
| ENG-02 | Phase 7 |
| ENG-03 | Phase 7 |
| RND-01 | Phase 8 |
| RND-03 | Phase 8 |
| RND-02 | Phase 9 |
| PAL-01 | Phase 9 |
| MPG-01 | Phase 10 |
| MPG-02 | Phase 10 |
| PAL-02 | Phase 11 |
| EXT-01 | Phase 12 |
| EXT-02 | Phase 12 |
| DOC-01 | Phase 13 |
| DOC-02 | Phase 13 |

**Coverage:** 14/14 v2.0 requirements mapped. No orphans.

---
*Requirements created: 2026-07-06 for milestone v2.0*
