---
phase: 25-view-ux-parity
verified: 2026-07-15T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (code-level); live UI behavior not exercised in this environment
overrides_applied: 0
human_verification:
  - test: "Open a board's Filter popover, add a condition on each property type (text, number, date, select, multi-select, checkbox, person), confirm the record list updates accordingly and persists across a page refresh"
    expected: "Board columns show only matching records immediately; after refresh, `view.config.filters` round-trips via PATCH /views/:id and the same filtered set renders"
    why_human: "Requires a running dev server + live DB records to observe DOM re-render and network round-trip; not observable via static grep/tsc"
  - test: "Add a Sort condition (asc and desc) on a number and a date property, confirm card order changes within columns"
    expected: "Cards reorder within each column per the chosen property/direction"
    why_human: "Visual ordering outcome, requires live rendering"
  - test: "Open View settings ('...'), toggle 2-3 card-face properties across different property types (checkbox, person, multi-select, select), confirm each renders correctly below the card title (Yes/No, resolved team member name, comma-joined resolved labels)"
    expected: "No raw UUIDs appear on any card face; toggling is instant and persists after refresh"
    why_human: "Visual correctness of resolved labels requires live team-roster/schema data, not just source inspection"
  - test: "Set column aggregation to Sum and to Average against a real number property with several records per column, confirm each column footer shows the arithmetically correct value"
    expected: "Footer 'Sum: X' / 'Avg: X' values match manual sum/average of the visible cards' numeric prop values per column"
    why_human: "Requires live numeric data across multiple columns to confirm correctness end-to-end"
  - test: "Switch a collection-view block from Board to Table and back several times (including rapid double-clicks on Table), then check the collection's view list (e.g. via listViews or DB query) for exactly 2 rows (one board, one table) — no growth on repeated toggling. Also confirm collection_records count is unchanged before/after switching"
    expected: "Exactly one sibling `collection_views` row of type 'table' is created on first switch; every subsequent switch reuses it; zero new collection_records rows are ever created"
    why_human: "Requires live mutation + DB/API introspection (row counts) to confirm no duplication, not just code-path tracing"
---

# Phase 25: View UX Parity Verification Report

**Phase Goal:** Views behave like a real database view layer, not a static board — filtering, sorting, customizable card faces, aggregations, and switching without data duplication
**Verified:** 2026-07-15
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can apply filters and sorts to a view and see the record list update accordingly (VIEWX-01) | ✓ VERIFIED (code-level) | `viewFilters.ts` `applyFilters`/`applySorts`/`evaluateCondition` correctly implemented (incl. all CR-01/CR-02/CR-03/WR-05 review fixes verified in-place); `BoardBlock.tsx` calls `applyFilters(records,...)` → `applySorts(filtered,...)` → `groupRecordsByColumn(sorted,...)`; `FilterSortToolbar.tsx` mounted in header, autosaves via `useUpdateView`, local-state buffering (WR-04 fix) prevents lost updates |
| 2 | User can choose which properties display on a card's face preview (VIEWX-02) | ✓ VERIFIED (code-level) | `ViewSettingsMenu.tsx` renders a checklist over `collection.schema`, persists to `view.config.cardProperties` via `useUpdateView`; `BoardBlock.tsx` resolves ids to full `CollectionPropertyDef[]` and passes down through `BoardColumn`→`BoardCard`; `BoardCard.tsx`'s `formatCardPropertyValue` correctly resolves `person` (via `useTeam()`, WR-01 fix) and `multi-select` (via `property.options`, WR-02 fix) labels instead of raw ids |
| 3 | User can see column aggregations (count, sum/avg for a chosen number property) on a board (VIEWX-03) | ✓ VERIFIED (code-level) | `ColumnAggregation.tsx` delegates to `aggregateColumn`, renders Count always, Sum/Avg only when a number `propId` is chosen; mounted once per column in `BoardColumn.tsx`; `ViewSettingsMenu.tsx`'s aggregation-type property picker is filtered to `p.type === 'number'` only |
| 4 | User can switch a `collection-view` block between view types on the same collection without creating duplicate records (VIEWX-04) | ✓ VERIFIED (code-level) | `ViewSwitcher.tsx` looks up an existing sibling view by type before creating one, guards against duplicate creation with `pendingType` state + `createView.isPending` disable (WR-03 fix); `ViewSwitcher` file contains no `createRecord`/record-mutation import; `BoardBlock.tsx` branches render on `view.type` between board columns and `CollectionTableView`, reusing the same `sorted` records array and same `useUpdateAnyRecord` instance (no re-fetch/re-materialization) |

**Score:** 4/4 truths verified at the code level (data flow traced from UI → pure functions → mutation hooks → API). Live browser/DB behavioral confirmation flagged as human verification below (no dev server or test runner available in this environment; this matches the phase's own SUMMARY.md admissions of un-run live smoke tests).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/lib/api/records.api.ts` | `updateView` + `UpdateViewInput` | ✓ VERIFIED | Present at lines 73-77 (type), 104 (function); mirrors `updateCollection` exactly |
| `apps/workspaces/src/lib/hooks/useRecords.ts` | `useUpdateView`, `useViews`, `useCreateView`, `useUpdateAnyRecord` | ✓ VERIFIED | All present and correctly shaped (lines 81, 90, 99, 113, 121) |
| `apps/workspaces/src/lib/projectPage/viewFilters.ts` | `applyFilters`/`applySorts`/`aggregateColumn`/`evaluateCondition`/`FILTER_OPERATORS` | ✓ VERIFIED | All 12 property types covered in `FILTER_OPERATORS`; fail-open semantics correct; all 3 Critical review bugs (CR-01/02/03) fixed in-place; WR-05 fix present |
| `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx` | Filter/Sort popovers, D-01/D-02 | ✓ VERIFIED | Both popovers present, autosave-on-change, `BetweenField` added for CR-03, local-state buffer for WR-04 |
| `apps/workspaces/src/components/projectPage/BoardBlock.tsx` | Filters/sorts wired, toolbar mounted, view.type branching | ✓ VERIFIED | `applyFilters`→`applySorts`→`groupRecordsByColumn` chain correct; `ViewSwitcher`/`FilterSortToolbar`/`ViewSettingsMenu` all mounted; `view.type === 'table'` branch renders `CollectionTableView` |
| `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` | Card-face checklist + aggregation picker, D-03/D-04 | ✓ VERIFIED | Checklist + type/property selects present, number-only filter for sum/avg property picker, local-state buffer for WR-04 |
| `apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx` | Count/sum/avg footer | ✓ VERIFIED | Delegates to `aggregateColumn`; renders nothing when sum/avg has no `propId` |
| `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` | Renders `cardProperties[]` read-only | ✓ VERIFIED | `formatCardPropertyValue` present with WR-01 (`useTeam()`-resolved person names) and WR-02 (`multi-select` label resolution) fixes applied; no `onCommit`/mutation wired into card-face elements |
| `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` | Forwards cardProperties/aggregation, mounts ColumnAggregation | ✓ VERIFIED | Props threaded correctly, `ColumnAggregation` mounted once per column footer |
| `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` | Create-once-then-remember segmented control | ✓ VERIFIED | `useViews`/`useCreateView` used correctly; WR-03 `pendingType` guard present; no record-mutation import |
| `apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx` | Editable table render path | ✓ VERIFIED | Lives in own `collectionTable/` subfolder (no naming collision with `TableBlock.tsx`); columns from `collection.schema`, cells via `PropertyField` wired to passed-in `updateRecord`; shared empty-state copy |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useRecords.ts` | `records.api.ts` | `useUpdateView` calls `recordsApi.updateView` | ✓ WIRED | Confirmed at `useRecords.ts:99-111` |
| `FilterSortToolbar.tsx` | `useRecords.ts` | `useUpdateView(view.id).mutate(...)` | ✓ WIRED | Confirmed, buffered locally per WR-04 fix |
| `BoardBlock.tsx` | `viewFilters.ts` | `applyFilters(records...)` / `applySorts(filtered...)` | ✓ WIRED | Confirmed at `BoardBlock.tsx:144-146` |
| `ViewSettingsMenu.tsx` | `useRecords.ts` | `useUpdateView(view.id).mutate(...)` | ✓ WIRED | Confirmed, buffered locally per WR-04 fix |
| `BoardColumn.tsx` | `ColumnAggregation.tsx` | `<ColumnAggregation records={column.cards} ... />` | ✓ WIRED | Confirmed at `BoardColumn.tsx:149` |
| `ViewSwitcher.tsx` | `useRecords.ts` | `useViews`/`useCreateView` | ✓ WIRED | Confirmed, plus WR-03 pending-state guard |
| `BoardBlock.tsx` | `CollectionTableView.tsx` | conditional render `view.type === 'table'` | ✓ WIRED | Confirmed at `BoardBlock.tsx:196-197`, reusing `sorted` + shared `updateRecord` instance |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `BoardBlock.tsx` columns | `records` (`recordsQuery.data`) | `useRecords(block.collectionId)` → live `GET /records` | Yes — real query, no static fallback | ✓ FLOWING |
| `FilterSortToolbar`/`ViewSettingsMenu` config | `view.config.*` | `useView(block.viewId)` → live `GET /views/:id`, mutated via `useUpdateView` PATCH | Yes | ✓ FLOWING |
| `ColumnAggregation` value | `column.cards` (subset of live records) | passed down from `BoardBlock`'s `columns` (derived from filtered/sorted live records) | Yes | ✓ FLOWING |
| `CollectionTableView` rows | `records` prop (`sorted`) | Same live `recordsQuery.data`, filtered/sorted | Yes | ✓ FLOWING |

### Anti-Patterns Found

None. Grep across all 11 touched/created files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` returned zero matches. `npx tsc --noEmit` (full project) exits 0 with no errors.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEWX-01 | 25-02-PLAN.md | Filter/sort a view, see record list update | ✓ SATISFIED (code-level) | `FilterSortToolbar.tsx` + `viewFilters.ts` + `BoardBlock.tsx` wiring, all 3 Critical filter bugs fixed |
| VIEWX-02 | 25-03-PLAN.md | Choose card-face properties | ✓ SATISFIED (code-level) | `ViewSettingsMenu.tsx` + `BoardCard.tsx`, both label-resolution bugs fixed |
| VIEWX-03 | 25-03-PLAN.md | Column aggregations (count/sum/avg) | ✓ SATISFIED (code-level) | `ColumnAggregation.tsx` + `aggregateColumn` |
| VIEWX-04 | 25-04-PLAN.md | Switch view type without duplicating records | ✓ SATISFIED (code-level) | `ViewSwitcher.tsx` create-once-then-remember + duplicate-creation guard |

No orphaned requirements — `.planning/REQUIREMENTS.md` lists exactly VIEWX-01..04 mapped to Phase 25, and all four appear in the `requirements:` frontmatter across Plans 25-01 through 25-04. (Note: `.planning/REQUIREMENTS.md`'s checkbox/status column still shows these as unchecked/"Pending" — this is a documentation bookkeeping gap, not a code gap, and does not block phase goal achievement; the orchestrator should update it as part of phase close-out.)

### Human Verification Required

See YAML frontmatter `human_verification` block above for the 5 items (filter/sort live update + persistence, sort ordering, card-face label rendering, aggregation arithmetic correctness, and view-switch duplicate-row guarantee). These require a running dev server and live data and could not be executed in this static-analysis environment; the phase's own SUMMARY.md files independently flag the same live-smoke-test gap ("not run in this environment — flagged as a manual follow-up").

### Gaps Summary

No code-level gaps found. All 4 ROADMAP success criteria are backed by correctly wired, correctly-fixed implementation code. The prior code review (25-REVIEW.md) found 3 Critical + 5 Warning bugs; all 8 were re-verified in the current codebase state (not just trusted from 25-REVIEW-FIX.md's claims) and confirmed fixed:
- CR-01 (multi-select/files/relation contains bug) — fixed, intersection logic present in `viewFilters.ts`
- CR-02 (checkbox default value `''` vs `false`) — fixed via `defaultConditionValue()` in `FilterSortToolbar.tsx`
- CR-03 (between operator no UI) — fixed via `BetweenField` component
- WR-01 (person raw id on card face) — fixed via `useTeam()` lookup in `BoardCard.tsx`
- WR-02 (multi-select raw ids on card face) — fixed via dedicated label-resolving branch
- WR-03 (ViewSwitcher duplicate-view race) — fixed via `pendingType` state + disabled buttons
- WR-04 (lost-update race on rapid config edits) — fixed via local-state buffering in both `FilterSortToolbar.tsx` and `ViewSettingsMenu.tsx`
- WR-05 (number filter coercing `''` to `0`) — fixed via explicit unset-value guard

The 3 Info-level findings (IN-01 title-property duplication on card face, IN-02 loose `UpdateViewInput.type` string, IN-03 aggregation footer showing stale "0" for a deleted property) were intentionally left unfixed per the review-fix scope (critical+warning only) and remain low-severity, non-blocking cosmetic/type-safety gaps — noted here for visibility, not treated as gaps against this phase's goal.

Status is `human_needed` rather than `passed` solely because live browser/DB behavior (filter round-trip persistence, sort visual ordering, label rendering correctness, aggregation arithmetic, and duplicate-row prevention under real concurrent clicks) has not been exercised against a running instance — only traced through source code. This is consistent with this phase's own established testing precedent (no FE test runner, no dev server available), not a sign of missing implementation.

---

_Verified: 2026-07-15_
_Verifier: Claude (gsd-verifier)_
