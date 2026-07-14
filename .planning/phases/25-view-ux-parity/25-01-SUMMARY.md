---
phase: 25-view-ux-parity
plan: 01
status: complete
---

# 25-01 Summary: Data-layer foundation (updateView + viewFilters)

## What was built

**Task 1 — `updateView` API function + `useUpdateView` mutation hook**
- `apps/workspaces/src/lib/api/records.api.ts`: added `UpdateViewInput` interface (`name?`, `type?`, `config?`) and `recordsApi.updateView(id, data)`, mirroring `updateCollection`'s exact `apiFetch` call shape (`PATCH /api/v1/records/views/:id`).
- `apps/workspaces/src/lib/hooks/useRecords.ts`: added `useUpdateView(id)`, mirroring `useUpdateCollectionSchema`'s structure — `useMutation` calling `recordsApi.updateView`, with `onSuccess` writing the result into the existing `qk.view(id)` cache key (no new query key needed).

**Task 2 — `viewFilters.ts` pure filter/sort/aggregate logic**
- New file `apps/workspaces/src/lib/projectPage/viewFilters.ts` exporting:
  - Types: `FilterCondition`, `SortCondition`, `AggregationConfig`
  - `FILTER_OPERATORS`: a `Record<CollectionPropertyDef['type'], {value,label}[]>` covering all 12 property types (text/url/email/phone → equals+contains; number → equals/gt/lt/between; date → equals/before/after/between; select/person → is/is_not; multi-select/files/relation → contains/not_contains; checkbox → is)
  - `evaluateCondition`: per-operator evaluation, fail-open (returns `true`) on unknown operator or missing property, so a malformed condition never hides a record
  - `applyFilters`: AND-only combination per D-02, with a no-op fast path returning the same array reference when `filters` is empty
  - `applySorts`: multi-condition sort (first = primary, rest = tiebreakers), returns a new array via spread when sorting, returns the same reference (no-op) when `sorts` is empty — never mutates input
  - `aggregateColumn`: `count`/`sum`/`avg`, always returns `0` (never `NaN`) when no numeric values are present

## Verification

- `cd apps/workspaces && npx tsc --noEmit` — no errors introduced in `records.api.ts`, `useRecords.ts`, or `viewFilters.ts`.
- No test runner exists in `apps/workspaces` (per 25-RESEARCH.md's Wave 0 Gaps note), so per the plan's `<verify>` instructions the pure functions were manually traced: compiled `viewFilters.ts` to plain JS via `tsc --target es2020 --module commonjs` into a scratch dir and ran a fixture script covering all 15 acceptance-criteria assertions (12-type operator map, AND-only filtering, gt/contains/multi-select operators, no-op reference identity for both `applyFilters` and `applySorts`, non-mutation of input, `count`/`sum`/`avg` aggregation correctness including the "no NaN" case, and fail-open behavior for unknown operators/missing properties). All 15 assertions passed.

## Files modified

- `apps/workspaces/src/lib/api/records.api.ts`
- `apps/workspaces/src/lib/hooks/useRecords.ts`
- `apps/workspaces/src/lib/projectPage/viewFilters.ts` (new)

## Commits

1. `feat(25-01): add updateView API function + useUpdateView mutation hook`
2. `feat(25-01): add viewFilters.ts pure filter/sort/aggregate logic`

## Notes for downstream plans (25-02..25-04)

- `recordsApi.updateView` / `useUpdateView(id)` are ready to call for persisting `view.config` changes (filters/sorts/cardProperties/aggregation).
- Import `applyFilters`, `applySorts`, `aggregateColumn`, `FILTER_OPERATORS`, and the condition types from `@/lib/projectPage/viewFilters`.
- No visual/behavioral change to the running app in this plan — foundation only, as scoped.
