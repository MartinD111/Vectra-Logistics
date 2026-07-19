---
phase: 25-view-ux-parity
fixed_at: 2026-07-15T05:16:46Z
review_path: .planning/phases/25-view-ux-parity/25-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 25: Code Review Fix Report

**Fixed at:** 2026-07-15T05:16:46Z
**Source review:** .planning/phases/25-view-ux-parity/25-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (Critical: 3, Warning: 5)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Filtering on multi-select/files/relation properties never works (contains/not_contains always wrong)

**Files modified:** `apps/workspaces/src/lib/projectPage/viewFilters.ts`
**Commit:** c934006
**Applied fix:** `evaluateCondition`'s array-typed branch now treats `condition.value` as a possible array (the full selection from `MultiSelectChips`/`StringArrayChips`) and tests intersection (`targets.some((t) => recordValue.includes(t))`) instead of a reference-equality `Array.includes(condition.value)`, which was essentially always `false`.

### CR-02: Checkbox filter conditions default to a value that never matches any record

**Files modified:** `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx`
**Commit:** 6e3f527
**Applied fix:** Added a `defaultConditionValue(type)` helper that seeds `false` for checkbox properties (instead of `''` for every type). Wired into both `addCondition` and the property-switch `onChange` handler.

### CR-03: "Between" operator has no matching input UI and silently fails open (matches everything)

**Files modified:** `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx`
**Commit:** b350b6e
**Applied fix:** Added a dedicated `BetweenField` component rendering two number/date inputs, shown when `condition.operator === 'between'` instead of the single-value `PropertyField`. Committing produces the `[min, max]` array `evaluateCondition`'s between branch expects. Also resets `condition.value` to a shape-appropriate default whenever the operator changes (to/from `between`), so a stale scalar/array can't leak across operator switches.

### WR-01: Card-face preview of `person` properties shows a raw id, not the resolved name

**Files modified:** `apps/workspaces/src/components/projectPage/board/BoardCard.tsx`
**Commit:** d057b96
**Applied fix:** Wired `useTeam()` into `BoardCard`, built an `id -> display name` lookup map, and split `person` into its own case in `formatCardPropertyValue` that resolves via the team roster (matching `PersonField`'s data source) instead of the empty `property.options`.

### WR-02: Card-face preview of `multi-select` properties shows raw option ids, not labels

**Files modified:** `apps/workspaces/src/components/projectPage/board/BoardCard.tsx`
**Commit:** b880f11
**Applied fix:** Split `multi-select` out of the `files`/`relation` raw-string-join case into its own branch that maps each selected id through `property.options` before joining, matching `select`'s existing label-resolution pattern.

### WR-03: `ViewSwitcher` has no guard against duplicate sibling-view creation

**Files modified:** `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx`
**Commit:** 82ebb93
**Applied fix:** Added local `pendingType` state tracking the in-flight target view type; `switchTo` now short-circuits if `createView.isPending` or if the same type is already pending, and both buttons are disabled while a create is in flight.

### WR-04: Lost-update race across rapid `view.config` mutations

**Files modified:** `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx`, `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx`
**Commit:** 65749f8
**Applied fix:** Both components now buffer their slice of `view.config` (filters/sorts in the toolbar; cardProperties/columnAggregation in the settings menu) in local `useState`, mutated optimistically on every edit and re-synced from the `view` prop only when the view itself changes (view switch). Consecutive edits now compose off the immediately-preceding local edit instead of off a shared stale `view.config` snapshot from the render that started them.

### WR-05: Number filter's `equals`/`gt`/`lt` on an unset value coerces to `0`, matching unintended records

**Files modified:** `apps/workspaces/src/lib/projectPage/viewFilters.ts`
**Commit:** 2e63305
**Applied fix:** Added a guard (`if (condition.value === '' || condition.value == null) return true;`) at the top of the `equals`, `gt`, and `lt` branches for number properties, mirroring the existing `between` operator's `Array.isArray` fail-open guard — an unset value is now treated as "not configured yet" rather than coerced via `Number('')` to `0`.

## Skipped Issues

None — all 8 in-scope findings (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, WR-05) were fixed. The 3 Info-level findings (IN-01, IN-02, IN-03) were intentionally excluded per the requested scope (critical + warning only) and were not touched.

---

_Fixed: 2026-07-15T05:16:46Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
