---
phase: 23-record-detail-page
plan: 02
subsystem: ui
tags: [records, react, nextjs, workspaces, block-editor]

requires:
  - phase: 23-record-detail-page (plan 01)
    provides: records.api.ts, useRecords.ts, PropertyField.tsx
provides:
  - "/collections/[collectionId]/records/[recordId] route — full record detail page"
  - PropertyPanel.tsx (title + schema-driven property list + add-property trigger)
  - AddPropertyModal.tsx (two-sequential-PATCH add-property flow)
affects: [records-collections-list-ui (future phase — no collection-list/board UI built this phase)]

tech-stack:
  added: []
  patterns:
    - "D-01 title convention: collection.schema[0] rendered as inline-editable h1, remaining properties (schema.slice(1)) rendered via PropertyField"
    - "Two-sequential-PATCH pattern: schema PATCH awaited to completion before record prop PATCH, to avoid a record referencing an unpersisted property id"
    - "Seed-once + 1500ms debounced-autosave body editor cloned from CRM client-detail-page pattern, minus the default-block-seeding effect (records have no such requirement)"

key-files:
  created:
    - apps/workspaces/src/components/records/PropertyPanel.tsx
    - apps/workspaces/src/components/records/AddPropertyModal.tsx
    - "apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx"
  modified: []

key-decisions:
  - "404/error fallback text uses a literal apostrophe via {\"Couldn't load this record.\"} JSX expression instead of &apos; entity, to satisfy the plan's grep-based acceptance criteria while still rendering identical output"

patterns-established:
  - "Record detail pages compose PropertyPanel (sidebar) + LivePageCanvas (body) with zero new LivePageCanvas props — the canvas is fully generic across CRM client pages, project pages, and now records"

requirements-completed: [CARD-01, CARD-02, CARD-03, CARD-04]

duration: ~20min
completed: 2026-07-14
---

# Phase 23 Plan 02: Record Detail Page Summary

Composed Plan 01's data layer and PropertyField editor into the full `/collections/[collectionId]/records/[recordId]` route: a schema-driven PropertyPanel sidebar, a two-sequential-PATCH AddPropertyModal, and a seed-once debounced-autosave LivePageCanvas body — zero new backend endpoints or LivePageCanvas props.

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 completed
- **Files modified:** 3 created

## Accomplishments
- `PropertyPanel.tsx` — D-01 title convention (first schema property as inline-editable `text-xl font-bold` h1, with "Untitled" placeholder), remaining properties rendered via Plan 01's `PropertyField`, "+ Add property" trigger
- `AddPropertyModal.tsx` — name/type/(options) form; submit handler awaits `useUpdateCollectionSchema` to completion before firing `useUpdateRecord`, per T-23-04's tampering mitigation; type-correct default values matching the backend's `validatePropValue`
- Record detail page route — loading/error states, two-column layout, `LivePageCanvas` called with zero new props (`config`/`onChange` only), body seeded from `record.body` with 1500ms debounced autosave (no default-block-seeding effect, correctly omitted per RESEARCH.md)

## Task Commits

Each task was committed atomically:

1. **Task 1: PropertyPanel — title + schema-driven property list** - `6f517e7` (feat)
2. **Task 2: AddPropertyModal — two-sequential-PATCH add-property flow** - `d3ebc7e` (feat)
3. **Task 3: Record detail page route — wiring, layout, autosave** - `d093bae` (feat)

## Files Created/Modified
- `apps/workspaces/src/components/records/PropertyPanel.tsx` - Sidebar: inline-editable title + property list + add-property trigger
- `apps/workspaces/src/components/records/AddPropertyModal.tsx` - Add-property form running the two-sequential-PATCH flow
- `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` - Route: loading/error states, PropertyPanel + LivePageCanvas composition, autosave

## Decisions Made
- Used a `{"Couldn't load this record."}` JSX text expression (literal apostrophe) instead of the `&apos;` HTML entity used elsewhere in the codebase, purely to satisfy the plan's grep-based acceptance criteria (`grep "Couldn't load this record\|Couldn.t load this record"`, which doesn't match `&apos;`). Rendered output is identical either way.

## Deviations from Plan

None — plan executed exactly as written. One infrastructural note, same class as Plan 01's: this worktree's branch had drifted behind `main` (missing the merged Plan 01 files: `records.api.ts`, `useRecords.ts`, `PropertyField.tsx`, and all Phase 21-23 planning docs). Resolved with a safe `git merge main --ff-only` before execution began (no destructive operations, no conflicts).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification

- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` exits 0.
- `npm --prefix apps/workspaces run build` completes successfully — confirms `/collections/[collectionId]/records/[recordId]` compiles as a dynamic route (`λ`) with no collision against the existing `/records/[clientId]` dynamic segment.
- All Task 1/2/3 acceptance-criteria `grep` checks pass, including the line-number ordering check confirming `onUpdateSchema.mutateAsync` (line 89) precedes `onUpdateRecord.mutateAsync` (line 90) in `AddPropertyModal.tsx`.
- Manual verification (steps in 23-02-PLAN.md `<verification>`, requiring live test data via curl against the running API) was not run in this environment — no dev server was started. Per CONTEXT.md's scope boundary, no collection-list/board UI exists yet to navigate to a record through the UI; this is expected and deferred to a future phase.

## Known Stubs

None — all three artifacts are fully wired to the real backend contract (Plan 01's `records.api.ts`/`useRecords.ts`) with no placeholder/mock data paths.

## Next Phase Readiness
- CARD-01..04 (record detail page: title, property panel, add-property flow, body editor) are implemented and typecheck/build-verified.
- No collection-list/board UI exists yet — a future phase will need to build the entry point for navigating to `/collections/{id}/records/{id}` from the UI (currently reachable only via direct URL or a link built elsewhere).
- `/records/[clientId]` (CRM client detail) confirmed still resolving correctly after this plan — no route collision.

---
*Phase: 23-record-detail-page*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: apps/workspaces/src/components/records/PropertyPanel.tsx
- FOUND: apps/workspaces/src/components/records/AddPropertyModal.tsx
- FOUND: apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx
- FOUND commit 6f517e7 (PropertyPanel.tsx)
- FOUND commit d3ebc7e (AddPropertyModal.tsx)
- FOUND commit d093bae (page.tsx)
