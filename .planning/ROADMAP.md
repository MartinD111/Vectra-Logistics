# Roadmap: Vectra

## Milestones

- ✅ **v1.0 CRM Rework** — Phases 1-6 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Workspace Engine — Engine Unification** — Phases 7-13 (in progress)
- 📋 **v3.0 On-Premise GA** — 7 phases (queued) — [plan](milestones/v3.0-on-premise-ga.md) · derived from `docs/specs/deployment/*`

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

### 🚧 v2.0 Workspace Engine — Engine Unification (Phases 7-13)

- [x] **Phase 7: Engine Foundation + Page Registry** - Generic registry + `WorkspaceBlockPlugin` contract; page registry populated (exhaustive), zero behavior change (completed 2026-07-06)
- [x] **Phase 8: Page Read-Rendering → Registry** - `PageBlockView` switch replaced by `registry.render`; every kind renders identically; no JSON drift (completed 2026-07-06)
- [x] **Phase 9: Page Edit-Mode + Slash → Registry** - `LivePageCanvas` edit switch and slash-menu derivation move to the registry; contentEditable/slash behavior preserved (completed 2026-07-06)
- [x] **Phase 10: Mini Program onto the Engine** - `BlockView` switch replaced by the same registry; manifest plugins + v2 round-trip intact (completed 2026-07-06)
- [x] **Phase 11: Palette Derivation Unification** - Shared `buildPaletteItems`; both builders' block lists derive from the registry (completed 2026-07-11)
- [ ] **Phase 12: Extensibility Proof** - Add one native + one manifest block via a single plugin entry, no dispatch-file edits
- [ ] **Phase 13: Cleanup, ADR & Park WorkflowBuilder** - Remove dead switches; write engine ADR; document automations WorkflowBuilder as deferred

## Phase Details

### Phase 7: Engine Foundation + Page Registry

**Goal**: A single generic block engine and a populated, compile-time-exhaustive page registry exist, so later phases can swap rendering onto registry dispatch with a proven safety net — with zero behavior change this phase.
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: ENG-01, ENG-02, ENG-03
**Success Criteria** (what must be TRUE):

  1. `apps/workspaces/src/lib/workspaceEngine/{types,registry,index}.ts` define a generic `WorkspaceBlockRegistry<B,Ctx>` and a `WorkspaceBlockPlugin<B,Ctx>` contract supporting `source: 'native' | 'manifest'`
  2. `apps/workspaces/src/lib/projectPage/registry.tsx` defines `pageBlockRegistry` as `Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>>`, reusing the existing `create()` closures and pointing `renderer`/`editor` at the existing components
  3. `tsc --noEmit` passes and `Object.keys(pageBlockRegistry)` equals the `PageBlockKind` union (exhaustive by construction)
  4. No file under `components/projectPage/` is changed; a fixture page renders byte-identical DOM

### Phase 8: Page Read-Rendering → Registry

**Goal**: Project-page read rendering goes through the registry instead of a 30-case switch, with no visible change and no persisted-JSON drift.
**Depends on**: Phase 7
**Requirements**: RND-01, RND-03
**Success Criteria** (what must be TRUE):

  1. The `switch(block.kind)` in `PageBlockView.tsx` is gone; rendering calls `pageBlockRegistry.render(block, ctx)` (incl. the `DragOverlay` path)
  2. Every existing block kind — including `mini-program`/`program-link` embeds — renders identically in read-only `PageView` and the live canvas
  3. An unknown kind renders nothing (parity with the old `default → null`)
  4. The persisted `{version:1, blocks}` document is untouched; no migration

### Phase 9: Page Edit-Mode + Slash → Registry

**Goal**: Edit-mode dispatch and slash-menu derivation are registry-driven, the last page-side switches removed, with identical editing/slash UX.
**Depends on**: Phase 8
**Requirements**: RND-02, PAL-01
**Success Criteria** (what must be TRUE):

  1. `LivePageCanvas`'s `BlockEditor` switch is gone; edit rendering uses `registry.renderEditor` (only rich-text/list/heading/kanban carry an `editor`; others fall back to `render`)
  2. `slashMenu.ts` derives items from the registry while preserving Heading 1/2/3 and Bulleted/Numbered variant expansion and `EXTRA_KEYWORDS`
  3. Typing `/` still transforms an empty text block in place for content items and inserts-below for widgets; `EditableRichText`, `handleSlashSelect`, phantom-first-block untouched
  4. The autosave PATCH payload for an edited page is byte-identical to pre-refactor

### Phase 10: Mini Program onto the Engine

**Goal**: Mini Program blocks render through the same registry engine as pages, proving the engine is genuinely shared, with existing programs unaffected.
**Depends on**: Phase 7 (engine); independent of Phases 8-9
**Requirements**: MPG-01, MPG-02
**Success Criteria** (what must be TRUE):

  1. `miniProgramBlockRegistry` (new `lib/miniProgram/registry.tsx`) uses `keyOf` resolving `plugin`→`pluginId` and a `renderManifest` → `DynamicBlockView`; `BlockView.tsx` has no `switch(block.kind)`
  2. Existing example manifest plugins still render via `DynamicBlockView`; the `runtime.tsx` fold and `useRuntime` are untouched
  3. A v2 program round-trips (load → run → export) identically; the page-embedded mini-program block still runs
  4. Both `pageBlockRegistry` and `miniProgramBlockRegistry` are instances of the same `WorkspaceBlockRegistry` class

### Phase 11: Palette Derivation Unification

**Goal**: Both builders' available-block lists come from one shared registry-driven helper, so a new registry entry appears in the right palette with no menu-code edits.
**Depends on**: Phases 9, 10
**Requirements**: PAL-02
**Success Criteria** (what must be TRUE):

  1. `lib/workspaceEngine/palette.ts` exposes `buildPaletteItems(registry)`; the page slash/insert menu and the mini-program add-menu both derive their lists from it
  2. Adding a registry entry makes the block appear in the correct palette with no edits to menu components
  3. Page slash variant expansion (headings/lists) still works; the two UX surfaces remain separate components

### Phase 12: Extensibility Proof

**Goal**: Demonstrate the core promise — a new block is one plugin entry, nothing else changes — for both the native and manifest flavors.
**Depends on**: Phase 11
**Requirements**: EXT-01, EXT-02
**Success Criteria** (what must be TRUE):

  1. A trivial native page block (e.g. `callout`) is added purely via a `WorkspaceBlockPlugin` entry (union member + interface + ~15-line renderer/editor + registry entry)
  2. It renders (read + edit), appears in the slash palette, autosaves and reloads — with zero changes to `PageBlockView`/`BlockView`/`LivePageCanvas`/`slashMenu` logic
  3. `git diff --stat` for the feature touches only the block's own module + registry files
  4. One trivial manifest plugin (added to `examples.ts`) renders end-to-end via the declarative path

### Phase 13: Cleanup, ADR & Park WorkflowBuilder

**Goal**: Remove the now-dead duplication, document the engine, and explicitly defer the third (automations) system.
**Depends on**: Phase 12
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):

  1. `rg 'switch \(block\.kind\)'` returns no hits in page/mini-program render or edit paths
  2. An ADR under `docs/` documents the engine, the native-vs-manifest split, the `keyOf` seam, and the package-promotion path
  3. `components/automations/WorkflowBuilder.tsx` compiles unchanged and is referenced in the ADR as an explicitly deferred future migration target

## Progress

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
| 11. Palette Derivation Unification | v2.0 | 1/1 | Complete   | 2026-07-11 |
| 12. Extensibility Proof | v2.0 | 0/? | Not started | - |
| 13. Cleanup, ADR & Park WorkflowBuilder | v2.0 | 0/? | Not started | - |

## Requirement Coverage (v2.0)

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
*Roadmap created: 2026-07-05 · v1.0 archived: 2026-07-06 · v2.0 roadmap added: 2026-07-06*
