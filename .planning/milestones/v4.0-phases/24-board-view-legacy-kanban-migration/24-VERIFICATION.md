---
phase: 24-board-view-legacy-kanban-migration
verified: 2026-07-14T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "A collection-view page block renders a board whose columns are the live values of any chosen select-type property, never hand-authored (BOARD-01, including D-04's zero-picker auto-provisioning)"
    - "User can create a new card inline within a column, pre-set to that column's groupBy value (BOARD-03)"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification: []
---

# Phase 24: Board View & Legacy Kanban Migration Verification Report

**Phase Goal:** Boards are real, drag-and-drop database views over a collection, and no existing page loses kanban data in the transition
**Verified:** 2026-07-14T00:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 24-04)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `collection-view` page block renders a board whose columns are the live values of any chosen select-type property, never hand-authored (BOARD-01), including D-04's zero-picker auto-provisioning of a brand-new board from the slash menu | ✓ VERIFIED | `BoardBlock.tsx`'s D-04 provisioning effect (lines 78-102) no longer constructs `useCreateView(block.collectionId ?? '')`. It now calls `recordsApi.createView(collection.id, {...})` directly inside the `.then` chain after `createCollection.mutateAsync(...)` resolves — `collection.id` is the real, just-created id resolved at call time, not a stale hook-construction-time closure. `grep -c "useCreateView"` on the file returns 0; `grep -c "recordsApi.createView(collection.id"` returns 1. `groupRecordsByColumn` (unchanged, proven correct in the prior pass) derives columns purely from the live `options` array of the chosen select property — no hand-authored columns. |
| 2 | User can drag a card to a different column (updating its `groupBy` property value) and reorder cards within a column (updating `sort_order`), using `@dnd-kit` (BOARD-02) | ✓ VERIFIED (unchanged from prior pass — untouched by 24-04) | `BoardBlock.tsx handleDragEnd` resolves the target column via matching card id or direct `column.id` match (empty-column case) and calls `useUpdateAnyRecord(collectionId).mutate({ id, data: { props: {...}, sort_order } })`. `useUpdateAnyRecord`'s `onSuccess` writes both `qk.record(id)` and splices into `qk.records(collectionId)`. `BoardColumn.tsx` registers `useDroppable({ id: column.id })` distinct from each card's `useSortable`. `git diff` for plan 24-04 confirms zero changes to `handleDragEnd`, `BoardColumn.tsx`'s droppable/sortable wiring, or `BoardCard.tsx`. |
| 3 | User can create a new card inline within a column, pre-set to that column's `groupBy` value, and the card immediately shows an autofocused inline-editable title on the card face (BOARD-03) | ✓ VERIFIED | `useCreateRecord(collectionId)` in `useRecords.ts` (lines 53-61) now obtains `useQueryClient()` and has an `onSuccess: (created) => qc.setQueryData(qk.records(collectionId), (prev) => prev ? [...prev, created] : [created])`. This appends the newly created record into the exact cache key (`qk.records(collectionId)`) that `useRecords(collectionId)` reads from, which is what `BoardBlock.tsx`'s `groupRecordsByColumn` consumes to build `column.cards`. `BoardColumn.tsx`'s `handleAddCard` calls `createRecord.mutate({ props: { [titlePropId]: '', [groupByPropId]: column.id } }, { onSuccess: (created) => setEditingNewCardId(created.id) })` — React Query composes hook-level `onSuccess` (cache write) and call-level `onSuccess` (local state), both fire, hook-level first. Because the card is now present in `column.cards` on next render, `BoardCard`'s `autoFocusEdit={editingNewCardId === card.id}` prop resolves true and its `useEffect` sets `editing=true`, rendering the autofocused `<input autoFocus>`. No navigation occurs (click-to-open only fires from the non-editing card face). |
| 4 | Opening a page with a legacy `kanban` block and making any edit auto-migrates it to a `collection-view`/board with all existing cards and data intact (BOARD-04) | ✓ VERIFIED (unchanged from prior pass — untouched by 24-04) | `KanbanMigrationGate.tsx` renders unchanged `KanbanBoardView` for view-mode; gates the first `onChange` with synchronous `migratingRef`. On first edit, calls `migrateOnFirstEdit(nextKanbanBlock)` (`kanbanMigration.ts`), which sequences `createCollection` → `createView` (direct `recordsApi.createView(collection.id, ...)` call — this file was never affected by the D-04 bug since it never used the hook) → per-card `createRecord`+`updateRecord(sort_order)`, reusing each source column's own `id` as its Status option id (preserves grouping identity). On success, `onUpdate(migratedBlock)` swaps `kind` to `collection-view` and shows the one-time toast (4000ms auto-dismiss). On failure, edit is preserved locally and gate resets for retry. `registry.tsx`'s `'kanban'` view-mode renderer is untouched — migration never fires on page load. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/components/projectPage/BoardBlock.tsx` | board renderer, D-04 provisioning via direct `recordsApi.createView`, DndContext root | ✓ VERIFIED | `useCreateView` import/usage fully removed; `recordsApi` imported directly alongside its existing type imports; provisioning effect calls `recordsApi.createView(collection.id, {...})` with the call-time-resolved id. Rendering/DnD logic unchanged and correct. |
| `apps/workspaces/src/lib/hooks/useRecords.ts` | useCreateRecord with cache write; useCreateView (still used by nothing now, retained for API symmetry) | ✓ VERIFIED | `useCreateRecord` has `onSuccess` writing into `qk.records(collectionId)` via `setQueryData`, mirroring `useUpdateAnyRecord`'s established splice pattern. `useCreateView` remains defined (unused elsewhere in the codebase now that BoardBlock and kanbanMigration both call `recordsApi.createView` directly) — not a regression, just now dead code; no functional impact. |
| `apps/workspaces/src/components/projectPage/board/BoardColumn.tsx` | droppable column, SortableContext, rename, blocked-delete, + New | ✓ VERIFIED | Unchanged from prior pass; "+ New" now functions end-to-end because the upstream cache-write gap is closed. |
| `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` | useSortable card, inline-editable title, click-to-open | ✓ VERIFIED | Unchanged; now reachable in practice for newly-created cards. |
| `apps/workspaces/src/components/projectPage/board/AddColumnControl.tsx` | + Add column control | ✓ VERIFIED (unchanged) | Appends a select option via `useUpdateCollectionSchema.mutateAsync`. |
| `apps/workspaces/src/lib/projectPage/kanbanMigration.ts` | pure `buildMigrationPlan` + async `migrateOnFirstEdit` | ✓ VERIFIED (unchanged) | Calls `recordsApi.createView` directly; never shared the BoardBlock bug. |
| `apps/workspaces/src/components/projectPage/KanbanMigrationGate.tsx` | ref-gated migration trigger + one-time toast | ✓ VERIFIED (unchanged) | `migratingRef` gate, exact toast copy, failure-path preserves edit and resets gate. |
| `apps/workspaces/src/lib/projectPage/registry.tsx` | `'collection-view'` -> BoardBlock; `'kanban'` editor -> KanbanMigrationGate | ✓ VERIFIED (unchanged) | Confirmed lines 243-250. |
| `apps/workspaces/src/lib/api/records.api.ts` | `createView(collectionId, data)` signature | ✓ VERIFIED (unchanged) | Matches both call sites' usage exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `BoardBlock.tsx` provisioning effect | `records.api.ts` | direct `recordsApi.createView(collection.id, {...})` call inside `.then` chain | ✓ WIRED | Confirmed: call-time id, not hook-construction-time closure. Fixes gap #1. |
| `useCreateRecord` mutation success | `qk.records(collectionId)` cache | `onSuccess -> qc.setQueryData` | ✓ WIRED | Confirmed: appends created record into the exact cache array `BoardBlock`'s `groupRecordsByColumn` reads from. Fixes gap #2. |
| `BoardBlock.tsx handleDragEnd` | `useUpdateAnyRecord` | `.mutate({ id, data: { props, sort_order } })` | ✓ WIRED (unchanged) | Confirmed. |
| `BoardColumn.tsx` | `@dnd-kit/core` useDroppable | column-level drop target | ✓ WIRED (unchanged) | Confirmed. |
| `registry.tsx` | `KanbanMigrationGate.tsx` | `'kanban'` editor entry | ✓ WIRED (unchanged) | Confirmed. |
| `KanbanMigrationGate.tsx` | `kanbanMigration.ts` | `migrateOnFirstEdit` on first onUpdate | ✓ WIRED (unchanged) | Confirmed. |
| `kanbanMigration.ts` | `records.api.ts` | direct `recordsApi.createCollection/createView/createRecord/updateRecord` calls | ✓ WIRED (unchanged) | Confirmed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No remaining reference to `useCreateView` in `BoardBlock.tsx` | `grep -c "useCreateView" apps/workspaces/src/components/projectPage/BoardBlock.tsx` | `0` | ✓ PASS |
| Direct `recordsApi.createView(collection.id` call present exactly once | `grep -c "recordsApi.createView(collection.id" apps/workspaces/src/components/projectPage/BoardBlock.tsx` | `1` | ✓ PASS |
| `npx tsc --noEmit -p apps/workspaces/tsconfig.json` (project's own stated automated gate) | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | Exit 0, no errors | ✓ PASS |
| Grep for debt markers (TODO/FIXME/XXX/HACK/PLACEHOLDER) in the two files modified by plan 24-04 | `grep -n "TODO\|FIXME\|XXX\|HACK\|PLACEHOLDER"` on both files | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist for this phase (confirmed in the prior verification pass via `24-VALIDATION.md`: "No frontend test runner exists... Wave 0 deliberate skip"). Step 7c: SKIPPED — no conventional probes declared or discovered.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BOARD-01 | 24-01, 24-02, 24-04 | Board renders live columns from a select property, never hand-authored; D-04 zero-picker creation completes | ✓ SATISFIED | Provisioning bug fixed — `recordsApi.createView(collection.id, ...)` called with real id at call time. |
| BOARD-02 | 24-01, 24-02 | Drag-and-drop between/within columns updates `groupBy`/`sort_order` | ✓ SATISFIED | Verified unchanged. |
| BOARD-03 | 24-01, 24-02, 24-04 | Inline "+ New" card creation pre-set to column, inline-editable, immediate | ✓ SATISFIED | Cache-write bug fixed — created record appears in `qk.records(collectionId)` immediately. |
| BOARD-04 | 24-03 | Legacy kanban auto-migrates on first edit, zero data loss | ✓ SATISFIED | Verified unchanged; migration path never shared the D-04 bug. |

### Anti-Patterns Found

None. Both fixes are narrow, mechanical corrections matching the plan's stated approach exactly (route around the stale-closure hook via a direct API call; add a `setQueryData` cache write mirroring an already-established pattern in the same file). No new TODO/FIXME/placeholder/stub patterns introduced. `useCreateView` in `useRecords.ts` is now unused dead code (no call sites remain in the codebase) — not a functional issue, flagged for awareness only; not a blocker since it introduces no incorrect behavior and the hook itself is not broken, just orphaned.

### Human Verification Required

None. Both fixes are deterministically verifiable from static code reading (hook-closure elimination, cache-key match between write and read sites) plus a clean `tsc --noEmit`. The underlying defects were previously proven via a live Express route-matching test (double-slash 404) and query-cache staleness configuration — both root causes are now structurally eliminated (no `useCreateView` construction-time binding to defeat; no missing `onSuccess` to leave the cache stale), not merely worked around.

### Gaps Summary

Both gaps from the prior verification pass are closed:

1. **BOARD-01 (D-04 zero-config board creation)** — Previously permanently stuck on "Creating board…" because `useCreateView(block.collectionId ?? '')` bound the mutation's target collection id at hook-construction time, when `block.collectionId` was still `null`. Fixed by removing the hook entirely and calling `recordsApi.createView(collection.id, {...})` directly inside the provisioning effect's `.then` chain, using the collection id resolved from `createCollection.mutateAsync`'s response at call time. This exactly mirrors the already-correct pattern in `kanbanMigration.ts`.

2. **BOARD-03 (inline card creation)** — Previously created cards were persisted server-side but invisible on the board for up to 5 minutes because `useCreateRecord` had no cache write into `qk.records(collectionId)`, the exact key the board reads from. Fixed by adding an `onSuccess: (created) => qc.setQueryData(qk.records(collectionId), (prev) => prev ? [...prev, created] : [created])`, mirroring `useUpdateAnyRecord`'s already-established splice pattern.

BOARD-02 (drag-and-drop) and BOARD-04 (legacy kanban migration) were previously verified and are confirmed untouched by plan 24-04's `git diff` scope (only `BoardBlock.tsx`'s `createView` call site and `useRecords.ts`'s `useCreateRecord` function changed).

All four Phase 24 success criteria now hold. Phase goal achieved: boards are real, drag-and-drop database views over a collection, and no existing page loses kanban data in the transition.

---

*Verified: 2026-07-14T00:00:00Z*
*Verifier: Claude (gsd-verifier)*
