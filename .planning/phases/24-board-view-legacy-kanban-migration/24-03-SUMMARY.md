---
phase: 24-board-view-legacy-kanban-migration
plan: 03
subsystem: frontend
tags: [migration, kanban, collection-view, board]

# Dependency graph
requires:
  - phase: 24-board-view-legacy-kanban-migration
    plan: 02
    provides: "collection-view PageBlockKind + BoardBlock.tsx D-04 auto-provisioning pattern; recordsApi/useRecords.ts extensions from plan 01"
provides:
  - "kanbanMigration.ts: pure buildMigrationPlan(kanban) transform + async migrateOnFirstEdit(kanban) orchestration"
  - "KanbanMigrationGate.tsx: ref-gated first-edit migration trigger with one-time toast, wired into registry.tsx's kanban editor entry"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Column-identity-preserving migration: Status select option ids reuse the source kanban column's own id (never a freshly generated id), so grouping/rename stays stable post-migration — same convention as BoardBlock.tsx's rename handling from plan 24-02"
    - "sort_order can only be persisted via a dedicated updateRecord call after createRecord — CreateRecordInput has no sort_order field and the backend silently strips it from create bodies"

key-files:
  created:
    - apps/workspaces/src/lib/projectPage/kanbanMigration.ts
    - apps/workspaces/src/components/projectPage/KanbanMigrationGate.tsx
  modified:
    - apps/workspaces/src/lib/projectPage/registry.tsx

key-decisions:
  - "On migration failure, the gate still applies the user's triggering edit to the legacy kanban block locally (via onUpdate(nextKanbanBlock)) so no in-progress edit is lost, resets migratingRef so the next edit retries, and shows no toast — matches the plan's T-24-07 partial-failure mitigation."

requirements-completed: [BOARD-04]

# Metrics
duration: 12min
completed: 2026-07-14
---

# Phase 24 Plan 03: Legacy Kanban Migration Summary

**Legacy `kanban` page blocks now auto-migrate to the real `collection-view` board engine on their first edit — a pure `buildMigrationPlan` transform preserves per-column card order and column identity (option id === column id), `migrateOnFirstEdit` orchestrates the sequential createCollection→createView→(createRecord+updateRecord) calls, and a ref-gated `KanbanMigrationGate` fires the migration exactly once with a one-time auto-dismissing toast, leaving `drafts-kanban` completely untouched.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-14T12:37:00Z
- **Completed:** 2026-07-14T12:49:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `kanbanMigration.ts` exports a pure `buildMigrationPlan(kanban)`: builds a 2-property schema (Title text + Status select), reuses each column's own `id` as its select option's `id` (never a freshly generated id, per RESEARCH.md Pitfall 4), and computes each card's `records` entry with `sort_order` reset to its 0-based position within its own column (not a global index). Zero network calls inside this function — verified by grep showing no `recordsApi`/`apiFetch`/`await` references in the function body.
- `migrateOnFirstEdit(kanban)` sequences `createCollection` → `createView` → (per-card `createRecord` then `updateRecord(created.id, { sort_order })`), never spreading `sort_order` into the `createRecord` call's body since the backend's `CreateRecordSchema` silently strips it there. Per-card create+update pairs run inside `Promise.all`, so different cards can interleave, but each card's own create→update sequencing is preserved via `await`.
- `KanbanMigrationGate.tsx` renders the legacy `KanbanBoardView` unchanged, so viewing a kanban block (no edit) never triggers migration. On the first `onChange` fired by an edit, a `migratingRef` ref-gate ensures the migration only starts once; on success it swaps the block to `kind: 'collection-view'` via `onUpdate` and shows a one-time "Board upgraded to the new view engine." toast (`fixed bottom-6 right-6 z-50`, auto-dismiss after 4000ms, no manual dismiss, copy exactly as specified). On failure, the user's triggering edit is preserved locally on the still-`kanban` block, no toast shown, and `migratingRef` resets so the next edit retries.
- `registry.tsx`'s `'kanban'` entry's editor arrow now renders `KanbanMigrationGate` instead of `KanbanBoardView` directly; the view-mode (renderer) arrow is untouched and still uses `KanbanBoardView` directly, so migration can never fire from a read-only view. The `'drafts-kanban'` entry is byte-identical to its pre-task state (confirmed via grep).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure migration transform + orchestration function** - `31b1fd5` (feat)
2. **Task 2: Migration gate component + one-time toast + registry wiring** - `a108bb1` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/workspaces/src/lib/projectPage/kanbanMigration.ts` (new) - `buildMigrationPlan` pure transform + `migrateOnFirstEdit` async orchestration
- `apps/workspaces/src/components/projectPage/KanbanMigrationGate.tsx` (new) - ref-gated first-edit migration trigger, one-time toast, failure-safe retry
- `apps/workspaces/src/lib/projectPage/registry.tsx` - `'kanban'` entry's editor arrow now uses `KanbanMigrationGate`; renderer arrow and `'drafts-kanban'` entry unchanged

## Decisions Made
On migration network failure, the gate still applies the user's in-progress edit locally to the legacy `kanban` block (rather than dropping it) and resets the ref gate so the very next edit retries the migration — this directly implements the plan's T-24-07 threat-model mitigation (no orphaned/partially-migrated `collection-view` block pointing at an incomplete collection).

## Deviations from Plan

None — plan executed exactly as written. `npx tsc --noEmit -p apps/workspaces/tsconfig.json` passed with zero errors after every task.

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required. Manual dev-server verification (open a page with an existing kanban block, confirm no migration on load; add/move/remove a card, confirm exactly one migration with correct card/column/order preservation and a one-time toast; confirm drafts-kanban unaffected) was not run in this session, consistent with the "manual-only, no frontend test runner" note carried over from plan 24-02 — recommend a manual pass before merge per the plan's `<verification>` section.

## Next Phase Readiness

All 4 phase requirements (BOARD-01..04) are now satisfied across plans 24-01, 24-02, 24-03. This closes out Phase 24 (board-view-legacy-kanban-migration) — no further plans are needed in this phase.

---
*Phase: 24-board-view-legacy-kanban-migration*
*Completed: 2026-07-14*

## Self-Check: PASSED
