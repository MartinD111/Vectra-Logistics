---
phase: 25-view-ux-parity
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - apps/workspaces/src/lib/api/records.api.ts
  - apps/workspaces/src/lib/hooks/useRecords.ts
  - apps/workspaces/src/lib/projectPage/viewFilters.ts
  - apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx
  - apps/workspaces/src/components/projectPage/BoardBlock.tsx
  - apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx
  - apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx
  - apps/workspaces/src/components/projectPage/board/BoardCard.tsx
  - apps/workspaces/src/components/projectPage/board/BoardColumn.tsx
  - apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx
  - apps/workspaces/src/components/projectPage/collectionTable/CollectionTableView.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The data-layer foundation (`records.api.ts`, `useRecords.ts`, `viewFilters.ts`) is clean and closely follows the plan/interfaces. The UI layer (toolbar, view-settings menu, aggregation footer, view switcher, table view) is also structurally sound and wires together correctly (D-01/D-03/D-04/D-05 are all present in the code). However, tracing the actual data flow between `PropertyField`'s existing input widgets and `viewFilters.ts`'s evaluation logic surfaces three correctness bugs that make filtering silently wrong for entire classes of property types and operators — this is the phase's headline requirement (VIEWX-01) and it does not work as advertised for `multi-select`/`files`/`relation` properties, `checkbox` properties (in their default state), or the `between` operator on `number`/`date` properties. None of these crash or throw; they fail silently, which is worse for a filter UI, since the user has no way to tell the filter chip is a no-op.

There are also two card-face display bugs (VIEWX-02) where `person` and `multi-select` values render as raw ids instead of resolved labels, and two race-condition-class issues around concurrent config writes / sibling-view creation that were not addressed with any pending-state guard.

## Critical Issues

### CR-01: Filtering on multi-select/files/relation properties never works (contains/not_contains always wrong)

**File:** `apps/workspaces/src/lib/projectPage/viewFilters.ts:94-103` (evaluation) and `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx:113-121` (value input)

**Issue:** The filter condition's value input is rendered via the existing `PropertyField` component. For `multi-select` properties, `PropertyField` delegates to `MultiSelectChips`, whose `onCommit` always fires with the **entire next selection array** (see `PropertyField.tsx:158-161`: `onCommit(next)` where `next` is the full array of selected option ids). The same is true for `files`/`relation` via `StringArrayChips` (`PropertyField.tsx:197-201`: `onCommit([...entries, trimmed])`).

So `condition.value` for these property types ends up as an array (e.g. `['optA', 'optB']`), not a single scalar to test membership against. But `evaluateCondition`'s array-type branch does:
```ts
matches = Array.isArray(recordValue) && recordValue.includes(condition.value);
```
`recordValue.includes(condition.value)` checks whether the record's array contains `condition.value` **as a single element** — since `condition.value` is itself an array, this is an array-in-array reference-equality check that is essentially always `false` (arrays are never `===` unless literally the same object). Consequently:
- `contains` always evaluates to `false` → every record is filtered out.
- `not_contains` always evaluates to `true` (negation of `false`) → every record passes, filter is a silent no-op.

This is the core VIEWX-01 requirement ("D-01: filter builder ... follow what's natural for each property type") and it is broken for 3 of the 12 supported property types, with no error surfaced to the user — the toolbar just silently shows zero or all records.

**Fix:** Either (a) special-case the value input for array-typed filter conditions to select a single option (rather than reusing the full multi-select chip widget), or (b) change `evaluateCondition`'s array branch to test intersection against an array-valued `condition.value`:
```ts
if (ARRAY_TYPES.has(property.type)) {
  const targets = Array.isArray(condition.value) ? condition.value : [condition.value];
  matches = Array.isArray(recordValue) && targets.some((t) => recordValue.includes(t));
}
```

---

### CR-02: Checkbox filter conditions default to a value that never matches any record

**File:** `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx:59` (`addCondition`) and `:97` (property-switch handler); evaluated in `apps/workspaces/src/lib/projectPage/viewFilters.ts:122-123`

**Issue:** Every new filter condition (and every property-type switch on an existing condition) resets `value` to the string `''`:
```ts
onChange([...filters, { propId: prop?.id ?? '', operator, value: '' }]);
```
For a `checkbox` property, `PropertyField`'s checkbox branch renders `checked={!!value}`, so `''` displays as visually unchecked — indistinguishable from an intentional "unchecked" filter. But the underlying stored `condition.value` is still the string `''`, not the boolean `false`. `evaluateCondition`'s `is` branch uses strict equality:
```ts
case 'is': return recordValue === condition.value;
```
Since `recordValue` for a checkbox property is always a real boolean (`true`/`false`), and `condition.value` is `''`, `true === ''` and `false === ''` are both `false`. **A checkbox filter left in its default (apparently valid, "unchecked") state matches zero records**, silently. The user must un-check-then-re-check the box (forcing a real `onCommit(false)`) to get a working filter — nothing in the UI communicates this requirement.

**Fix:** Type-aware defaulting when a condition's property resolves to `checkbox`, e.g. seed `value: false` instead of `''` when `type === 'checkbox'` (in both `addCondition` and the property-switch handler), or normalize in `evaluateCondition`: `const cv = property.type === 'checkbox' ? !!condition.value : condition.value;`.

---

### CR-03: "Between" operator has no matching input UI and silently fails open (matches everything)

**File:** `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx:113-121` (value input) vs. `apps/workspaces/src/lib/projectPage/viewFilters.ts:108-117` (evaluation)

**Issue:** `FILTER_OPERATORS` offers `between` for both `number` and `date` property types, but the condition row's value input is always a single `PropertyField` control — for `number` that's `DebouncedTextField` (one numeric `<input>`), for `date` that's a single `<input type="date">`. There is no two-value (min/max) input rendered anywhere for the `between` operator, so `condition.value` can never become the `[min, max]` array `evaluateCondition` expects:
```ts
case 'between': {
  if (!Array.isArray(condition.value) || condition.value.length !== 2) return true;
  ...
}
```
Since `condition.value` will always be a scalar (whatever the user types into the single input), this guard always fails and the function **returns `true`** — i.e., every record passes. Selecting "Between" as the operator silently disables filtering entirely while the UI still shows an active filter chip (primary-600 highlighted "Filter records" button), giving the user false confidence that records are being filtered.

**Fix:** Either drop `between` from `FILTER_OPERATORS` for this phase (matches D-04's "Claude's discretion, keep it simple" framing) or add a dedicated two-input row (min/max, or a date-range pair) when `condition.operator === 'between'`.

## Warnings

### WR-01: Card-face preview of `person` properties shows a raw id, not the resolved name

**File:** `apps/workspaces/src/components/projectPage/board/BoardCard.tsx:21-26`

**Issue:** `formatCardPropertyValue` resolves `select`/`person` labels via `property.options`:
```ts
case 'select':
case 'person': {
  const options = (property.options ?? []) as { id: string; label: string }[];
  const match = options.find((o) => o.id === value);
  return match ? match.label : (typeof value === 'string' ? value : '');
}
```
But `person` properties don't carry their options on `property.options` — `PropertyField.tsx`'s `PersonField` resolves the display name from the `useTeam()` hook's team roster (`apps/workspaces/src/components/records/PropertyField.tsx:99-104`), a completely separate data source. `property.options` will be empty/undefined for `person` properties, so the `find` always misses and the fallback renders the raw team-member UUID on the card face instead of a name.

**Fix:** Either thread the team roster into `BoardCard`/`formatCardPropertyValue` (via a `useTeam()` call at the `BoardCard` level, passed down as a lookup map) or special-case `person` separately from `select` and resolve the name the same way `PersonField` does.

### WR-02: Card-face preview of `multi-select` properties shows raw option ids, not labels

**File:** `apps/workspaces/src/components/projectPage/board/BoardCard.tsx:27-30`

**Issue:** `multi-select` is grouped with `files`/`relation` in the read-only formatter:
```ts
case 'multi-select':
case 'files':
case 'relation':
  return Array.isArray(value) ? value.join(', ') : '';
```
`files`/`relation` genuinely store freeform strings (no `property.options`), so `.join(', ')` is correct there. But `multi-select` values are option **ids** (selected via `MultiSelectChips`, backed by `property.options`), the same as `select`'s single-value case just above it — which correctly resolves labels via `property.options.find(...)`. Grouping `multi-select` with the raw-string types means its card-face preview shows a comma-joined list of UUIDs instead of the selected option labels.

**Fix:** Split `multi-select` into its own case that maps each id through `property.options` before joining:
```ts
case 'multi-select': {
  const options = (property.options ?? []) as { id: string; label: string }[];
  return Array.isArray(value)
    ? value.map((v) => options.find((o) => o.id === v)?.label ?? String(v)).join(', ')
    : '';
}
```

### WR-03: `ViewSwitcher` has no guard against duplicate sibling-view creation

**File:** `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx:31-48`

**Issue:** `switchTo` looks up `viewsQuery.data?.find((v) => v.type === type)` and only calls `createView.mutateAsync(...)` when nothing is found — but neither button is disabled while a create is in flight (`createView.isPending` is never read), and `viewsQuery.data` can legitimately still be `undefined`/stale immediately after mount or immediately after a first switch (the `useCreateView` `onSuccess` only calls `qc.invalidateQueries`, an async refetch, not a synchronous cache write). Two rapid clicks on "Table" (e.g., a double-click, or a click that lands before `useViews` has resolved) will both see "no existing table view" and both fire `createView.mutateAsync`, producing two `collection_views` rows of `type: 'table'` for the same collection — directly contradicting D-05's "creates a sibling view row once and reuses it thereafter" contract and the phase's own success criterion ("no new `collection_views` row created on repeated toggling").

**Fix:** Disable both buttons while `createView.isPending`, and/or track an in-flight target type in local state to short-circuit a second click for the same type before the mutation resolves.

### WR-04: Lost-update race across rapid `view.config` mutations

**File:** `apps/workspaces/src/components/projectPage/board/FilterSortToolbar.tsx:30-35`, `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx:31-48`

**Issue:** Every add/remove/toggle computes its "next" config purely from the `view` prop (a React Query cache snapshot) with no local buffering or request sequencing:
```ts
const saveFilters = (next: FilterCondition[]) => {
  updateView.mutate({ config: { ...view.config, filters: next } });
};
```
If a user performs two independent edits in quick succession (e.g., toggles two card-face-property checkboxes back-to-back in `ViewSettingsMenu`, or clicks "+ Add condition" twice) before the first `PATCH` response lands and `useUpdateView`'s `onSuccess` writes the updated view back into the query cache, both mutations are computed against the *same* stale `view.config` base. Whichever response is cached last silently wins, and the other edit is dropped — a classic lost-update bug. This is plausible under normal-speed clicking, not just adversarial double-clicks, since there is no `mutationKey`/serialization and no optimistic local reducer merging concurrent updates.

**Fix:** Either serialize these mutations (e.g., a `mutationKey` + `queryClient.isMutating` guard, or disable inputs while `updateView.isPending`), or maintain a local `useState` copy of the config array that both renders from and is mutated optimistically, syncing back only on prop change.

### WR-05: Number filter's `equals`/`gt`/`lt` on an unset value coerces to `0`, matching unintended records

**File:** `apps/workspaces/src/lib/projectPage/viewFilters.ts:88-91, 104-107` (`Number(recordValue)`/`Number(condition.value)`), default seeded in `FilterSortToolbar.tsx:59/97`

**Issue:** New/just-switched-to-number filter conditions default `value: ''`. `Number('')` coerces to `0`, not `NaN`. Before the user has typed anything into the numeric value field, an `equals` condition on a `number` property will actively match every record whose value is exactly `0`, and a `gt`/`lt` condition will actively filter using `0` as the threshold — i.e., the board/table already applies a (probably unintended) filter the instant a number property + operator is selected, before the user has entered a value.

**Fix:** Treat `''`/`undefined` as "not yet configured" and fail-open (`return true`) rather than coercing to `0`, mirroring the `between` guard's `Array.isArray` check, e.g. `if (condition.value === '' || condition.value == null) return true;` at the top of the `equals`/`gt`/`lt` branches for `number`.

## Info

### IN-01: Card-face property checklist doesn't exclude the title property, allowing a duplicate title row

**File:** `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx:67-77`, rendered by `apps/workspaces/src/components/projectPage/board/BoardCard.tsx:113-134`

**Issue:** The "Card properties" checklist iterates all of `collection.schema`, including `collection.schema[0]` (the property already used as the card's title, per `titlePropId = collection.schema[0]?.id`). If a user checks that first property, the card renders the same value twice — once as the bold title, once again as a plain read-only line directly below it.

**Fix:** Filter the checklist (and the resulting `cardProperties` computation in `BoardBlock.tsx`) to exclude `collection.schema[0]?.id` / the current `titlePropId`.

### IN-02: `UpdateViewInput.type` is a loose `string`, weaker than the backend's literal union

**File:** `apps/workspaces/src/lib/api/records.api.ts:73-77`

**Issue:** The backend's `UpdateViewSchema` constrains `type` to `z.enum(['board', 'table', 'calendar', 'gallery', 'list', 'timeline'])`, but the client-side `UpdateViewInput` types it as a bare `string`. `ViewSwitcher.tsx` happens to pass correctly-typed literals today, but nothing at the type level prevents a future caller from sending an invalid `type` and only discovering the mistake via a runtime 400.

**Fix:** `type?: 'board' | 'table' | 'calendar' | 'gallery' | 'list' | 'timeline';` to match the backend contract and catch typos at compile time.

### IN-03: `ColumnAggregation` falls back to `String(value)` (unformatted) whenever the aggregated property has been deleted from the schema

**File:** `apps/workspaces/src/components/projectPage/board/ColumnAggregation.tsx:20-24`

**Issue:** The empty-guard only checks `!agg.propId`, not whether that id still resolves in the current `schema` (e.g., if the number property chosen for the aggregation was later deleted from the collection's schema). In that case `aggregateColumn` returns `0` (no records have that prop anymore) and the footer silently renders "Sum: 0"/"Avg: 0" instead of indicating the configured property no longer exists.

**Fix:** Treat `schema.find((p) => p.id === agg.propId)` returning `undefined` the same as an unset `propId` (render nothing, or a "property removed" hint) rather than falling through to a numeric `0`.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
