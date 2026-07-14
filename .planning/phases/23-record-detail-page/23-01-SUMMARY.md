---
phase: 23-record-detail-page
plan: 01
subsystem: frontend-data-layer
tags: [records, react-query, property-editor, workspaces]
dependency-graph:
  requires: []
  provides: [records.api.ts, useRecords.ts, PropertyField.tsx]
  affects: [23-02 (record detail page — consumes all three contracts)]
tech-stack:
  added: []
  patterns:
    - "recordsApi object-of-functions module cloned verbatim from crm.api.ts's shape"
    - "useRecords.ts hooks clone useCrm.ts's qk factory + enabled guard + cache-write (setQueryData, not invalidateQueries) conventions"
    - "PropertyField type-switch cloned from DynamicBlockSettings.tsx's structural pattern, input styling from records/[clientId]/page.tsx"
key-files:
  created:
    - apps/workspaces/src/lib/api/records.api.ts
    - apps/workspaces/src/lib/hooks/useRecords.ts
    - apps/workspaces/src/components/records/PropertyField.tsx
  modified: []
decisions: []
metrics:
  duration: ~25min
  completed: 2026-07-14
---

# Phase 23 Plan 01: Records Data Layer & Property Editor Summary

Typed React Query data layer plus a 12-type schema-driven property editor for the record detail page, consuming the already-shipped `/api/v1/records/*` Phase 22 backend with zero new endpoints.

## What Was Built

**`records.api.ts`** — `CollectionPropertyDef`, `DataCollection`, `CollectionRecord` types (dates as `string`, matching JSON-over-HTTP, unlike the backend's `Date` row types) plus a `recordsApi` object with `getCollection`, `updateCollection`, `getRecord`, `updateRecord`, `createRecord`, all hitting the exact routes from `records.routes.ts` and unwrapping the `{ collection }` / `{ record }` envelope the controller returns.

**`useRecords.ts`** — `useCollection`/`useRecord` query hooks (`enabled: !!user?.company_id && !!id`), `useUpdateCollectionSchema`/`useUpdateRecord` mutations that cache-write via `qc.setQueryData` (not `invalidateQueries`) so other already-open records/collections of the same ID pick up changes immediately, per CARD-03 and the `useUpdateClientPage` precedent. `useCreateRecord` has no `onSuccess` cache write — it exists solely for Plan 02's manual test-data creation.

**`PropertyField.tsx`** — a single component with a 12-way `switch (property.type)`, no default/unhandled branch:
- `checkbox`/`date`/`select` — native inputs, commit immediately on change
- `person` — dropdown-popover cloned from `EmployeeOverrideField` (`records/[clientId]/page.tsx`), backed by `useTeam()`, commits immediately on pick
- `multi-select` — new `MultiSelectChips` sub-component (D-02, "no analog found"): fixed-option pill toggle bound to `property.options`, commits immediately on toggle
- `files`/`relation` — new `StringArrayChips` sub-component: freeform tag input (Enter-to-add, click-to-remove chips), distinct from `MultiSelectChips` since there's no predefined options list
- `text`/`url`/`email`/`phone`/`number` — `DebouncedTextField` sub-component cloned from `InlineTextField`'s `handleChange`/`flush` structure: 800ms debounce-while-typing + commit-on-blur, calling `onCommit` (not a direct mutation call) so the parent (Plan 02's `PropertyPanel`) owns persistence

`PropertyField` renders only the input — the label row is left to the Plan 02 consumer per the PATTERNS.md row-structure convention.

## Deviations from Plan

None — plan executed exactly as written. One infrastructural note: the worktree branch this plan executed in was checked out at the merge-base with `main` (Phase 21-23 planning docs and Phase 22 backend code were not yet present). Resolved with a safe `git merge main --ff-only` before execution began (no destructive operations, no conflicts) — same pattern documented in STATE.md's Phase 18 blocker note.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` exits 0 with all three new files in place.
- All acceptance-criteria `grep` checks pass (interface/export counts, 12-case switch coverage, `MultiSelectChips`/`StringArrayChips` presence, `useTeam` usage, no `any`).
- `npm --prefix apps/api test` could not be run in this environment — `ts-node/register` is not installed under `apps/api/node_modules` (pre-existing environment gap, unrelated to this plan; no backend files were touched by this plan).

## Known Stubs

None — all three artifacts are fully wired to the real backend contract; no placeholder/mock data paths.

## Self-Check: PASSED

- FOUND: apps/workspaces/src/lib/api/records.api.ts
- FOUND: apps/workspaces/src/lib/hooks/useRecords.ts
- FOUND: apps/workspaces/src/components/records/PropertyField.tsx
- FOUND commit 8ec8be3 (records.api.ts)
- FOUND commit c245bbb (useRecords.ts)
- FOUND commit 9f6b0e6 (PropertyField.tsx)
