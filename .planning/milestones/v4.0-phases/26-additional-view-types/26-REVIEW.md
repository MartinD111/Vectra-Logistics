---
phase: 26-additional-view-types
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - apps/workspaces/src/components/projectPage/board/BoardCard.tsx
  - apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx
  - apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx
  - apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx
  - apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx
  - apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx
  - apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx
  - apps/workspaces/src/components/projectPage/BoardBlock.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the 4 new collection-view renderers (List, Calendar, Gallery, Timeline), the extended `ViewSwitcher`/`ViewSettingsMenu`, and their wiring into `BoardBlock.tsx`. No Critical/security-blocking defects found — no injection, no `eval`, no `dangerouslySetInnerHTML`, no hardcoded secrets. The stated reuse goal is **largely honored**: List, Gallery, and Calendar all correctly import and call `formatCardPropertyValue` from `BoardCard.tsx` instead of re-deriving person/select/multi-select label resolution, and `ViewSettingsMenu.tsx` extends the existing property-picker pattern rather than growing parallel settings surfaces. Timeline correctly omits `formatCardPropertyValue` entirely (by design — it never renders card-face properties on bars, matching the UI-SPEC).

That said, several real bugs and one under-addressed race condition surfaced on closer inspection:
- Timeline's Gantt bar geometry has an incomplete clamp (only the left edge is bounded), producing invalid/negative CSS values and stray blank lanes for records outside the visible month.
- Timeline's "no start/end property chosen" empty state shows body copy that was copy-pasted from the unrelated "filtered to zero" case.
- `ViewSettingsMenu`'s four new single-value pickers (calendar date, gallery cover, timeline start/end) reintroduce the exact stale-`view.config`-spread race that WR-04 was written to fix for `cardProperties`/`aggregation` — just now across a larger set of fields.
- Calendar's click-a-day-to-create has no duplicate-creation guard, unlike the equivalent guard `ViewSwitcher` already implements for its own duplicate-write risk.
- Gallery's cover-image feature assumes `files`-type property values are image URLs, but the only existing editor for that property type is a freeform text-tag input with no URL/image validation.

None of these are exploitable security issues or crash-the-app bugs; they are functional/UX correctness defects that should be fixed before this phase is considered done.

## Warnings

### WR-01: Timeline Gantt bar clamp is incomplete — bars outside the visible month render invalid geometry

**File:** `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx:36-51`
**Issue:** `computeBarPosition` clamps `clampedStart` with `Math.max(0, …)` but never bounds it above (`clampedStart` can exceed `daysInMonth` for a record that starts after the visible month), and never bounds `clampedEnd`/`widthPct` below zero (a record that ends entirely before the visible month produces `clampedEnd < clampedStart`, i.e. negative `widthPct`). The function's own comment claims bars are "clamping bars that start before or end after the visible month to the grid's edges" — the code does not actually do this for all four combinations (fully-before, fully-after, straddling-start, straddling-end). Because `qualifying` records are never filtered to the current month before being rendered (every record with both dates set gets a lane every month), this is not a rare edge case — every out-of-range record produces one of these invalid geometries on every month view. The bug is visually contained today only because the container div has `overflow-hidden` (`CONTAINER_CLASS`), but each such record still consumes a `min-h-[36px]` lane row, so paging through months shows blank/near-invisible rows that shouldn't be there.
**Fix:**
```ts
function computeBarPosition(startIso: string, endIso: string, monthStart: Date, daysInMonth: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const rawStart = (new Date(startIso).getTime() - monthStart.getTime()) / dayMs;
  const rawEnd = (new Date(endIso).getTime() - monthStart.getTime()) / dayMs + 1;
  const clampedStart = Math.min(daysInMonth, Math.max(0, rawStart));
  const clampedEnd = Math.max(clampedStart, Math.min(daysInMonth, rawEnd));
  const leftPct = (clampedStart / daysInMonth) * 100;
  const widthPct = ((clampedEnd - clampedStart) / daysInMonth) * 100;
  return { leftPct, widthPct };
}
```
Better still, filter `qualifying` to records whose `[start, end]` range actually intersects `[monthStart, monthStart + daysInMonth)` before mapping, so out-of-range records don't render an empty lane at all.

### WR-02: Timeline's "no properties chosen" empty state has mismatched, copy-pasted body text

**File:** `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx:82-91`
**Issue:** When `timelineStartProperty`/`timelineEndProperty` are unset, the empty state renders heading `"Choose start and end date properties to plot this timeline"` with body `"Try removing a filter condition or adjusting a value to see more records."` — that body text describes the unrelated *filtered-to-zero* state (correctly used lower in the same file for the `qualifying.length === 0` case) and makes no sense next to a "no property configured yet" heading. Calendar's equivalent empty state (`CalendarEmptyState` in `CollectionCalendarView.tsx:49-56`) gets this right with a body that actually references the view settings menu.
**Fix:**
```tsx
<CollectionTimelineEmptyState
  heading="Choose start and end date properties to plot this timeline"
  body="Pick start and end date properties for this view in the view settings menu."
/>
```

### WR-03: New `ViewSettingsMenu` property pickers reintroduce the WR-04 stale-config race across a wider field set

**File:** `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx:69-107`
**Issue:** `toggleCardProperty`/`setAggregationType`/`setAggregationProp` were fixed by WR-04 (Phase 25) to buffer their *display* value in local state, but every mutation body — old and new alike — still composes `{ ...view.config, <field>: next }` from the `view.config` **prop**, not from a merged snapshot of all six locally-buffered fields (`localCardProperties`, `localAggregation`, `localCalendarDateProperty`, `localGalleryCoverProperty`, `localTimelineStartProperty`, `localTimelineEndProperty`). If a user edits two different config keys in quick succession (e.g. toggles a card-face-property checkbox, then immediately picks a calendar date property, both before the first PATCH's `onSuccess` has updated the `view` query cache and re-rendered this component with a fresh `view.config` prop), the second `mutate()` call spreads from a `view.config` that doesn't yet include the first edit. Whichever request's response lands last overwrites `qk.view(id)` with a config that silently drops the other edit — the exact class of lost-update bug WR-04 was written to prevent, now reachable across 6 independently-editable fields instead of 2.
**Fix:** Compose one local `pendingConfig` object from all six locally-buffered values and spread from it (not from the `view.config` prop) in every setter:
```ts
const nextConfigFrom = (patch: Partial<Record<string, unknown>>) => ({
  ...view.config,
  cardProperties: localCardProperties,
  columnAggregation: localAggregation,
  calendarDateProperty: localCalendarDateProperty,
  galleryCoverProperty: localGalleryCoverProperty,
  timelineStartProperty: localTimelineStartProperty,
  timelineEndProperty: localTimelineEndProperty,
  ...patch,
});
```

### WR-04: Calendar's click-a-day-to-create has no duplicate-submission guard

**File:** `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx:261-266`
**Issue:** The day-cell `onClick` unconditionally calls `createRecord.mutateAsync(...)` on every click, with no check against `createRecord.isPending` and no per-cell in-flight tracking. A fast double-click (or a slow network round-trip) fires the mutation twice, creating two blank records for the same day — the same duplicate-write risk `ViewSwitcher.tsx` explicitly guards against with its `pendingType` state (see its own code comment: "a second click … before the mutation resolves is a no-op instead of firing a second … mutateAsync … which would create a duplicate … row").
**Fix:**
```tsx
onClick={() => {
  if (createRecord.isPending) return;
  createRecord.mutateAsync({ props: { [titlePropId]: '', [calendarDateProperty]: dayKey } })
    .then((created) => setAutoFocusId(created.id))
    .catch((err) => console.error('Failed to create calendar record:', err));
}}
```

### WR-05: Gallery cover-image picker assumes `files`-property values are image URLs, but the property editor stores freeform, unvalidated strings

**File:** `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx:48-52` (cross-referenced against `apps/workspaces/src/components/records/PropertyField.tsx:186-226`)
**Issue:** `CollectionGalleryView` takes the first entry of the chosen `files`-type property's array value and renders it directly as `<img src={coverUrl}>`. But the only existing editor for `files`-type properties (`StringArrayChips` in `PropertyField.tsx`) is a plain freeform tag input — `entries` are arbitrary user-typed strings with zero validation that they are URLs, let alone image URLs. In practice, unless a user manually pastes a full `https://…` image URL into a tag field never designed for that purpose, every gallery cover renders a broken `<img>` (silently failing per browser default, so at least no visible broken-image icon per D-05, but no cover image either — defeating the feature). This is a design/data-model mismatch inherited from the phase's decision to reuse the existing `files` property type without an accompanying validation step.
**Fix:** Either validate that the string matches an `http(s)://` URL pattern before rendering `<img>` (falling back to the placeholder block otherwise), or update the property-picker copy/on-record editor to clarify that gallery cover values must be pasted image URLs.

## Info

### IN-01: `collection` prop destructured but unused in three of the four new view components

**File:** `apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx`, `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx`, `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx`
**Issue:** All three components accept a `collection: DataCollection` prop (mirroring `CollectionTableView`'s signature) but never reference it in the component body. `CollectionTimelineView.tsx` is the only one that actually uses it (`collection.schema[0]?.id` for the title property). Dead prop carried over from the Table-view precedent without trimming.
**Fix:** Drop the unused `collection` prop from these three signatures and their call sites in `BoardBlock.tsx`, or use it if a future need (e.g. per-record schema lookups) is anticipated.

### IN-02: `personNames` Map construction duplicated verbatim in 4 files instead of being extracted into a shared hook

**File:** `apps/workspaces/src/components/projectPage/board/BoardCard.tsx:75-76`, `apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx:39-40`, `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx:37-38`, `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx:178-179`
**Issue:** `const { data: team = [] } = useTeam(); const personNames = new Map(team.map((m) => [m.id, ...]));` is copy-pasted identically 4 times. The phase's stated reuse goal explicitly called out consolidating `formatCardPropertyValue` (done correctly) but this equally reusable helper wasn't likewise consolidated into e.g. a `usePersonNames()` hook.
**Fix:**
```ts
// lib/hooks/usePersonNames.ts
export function usePersonNames() {
  const { data: team = [] } = useTeam();
  return useMemo(() => new Map(team.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()])), [team]);
}
```

### IN-03: Zero-record empty state copy is misleading when the collection is empty rather than filtered

**File:** `apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx:42-48`, `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx:40-42`, `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx:129-133`
**Issue:** All three unconditionally show `"No records match these filters" / "Try removing a filter condition…"` whenever `records.length === 0`, even when zero filters are active and the collection genuinely has no records yet. `BoardBlock.tsx`'s own Board branch gates the equivalent message behind `isFilteredEmpty` (`filtered.length === 0 && activeFilters.length > 0`) specifically to avoid this. This pattern is inherited verbatim from Phase 25's `CollectionTableView.tsx` (not new to this phase), but this phase propagated it to 3 more surfaces without adding the same gating.
**Fix:** Thread an `isFilteredEmpty`-equivalent flag (or pass `activeFilters.length` in) so the copy can branch between "no records yet" and "no records match these filters."

### IN-04: `tsc --noEmit` never successfully run against `CollectionCalendarView.tsx` or `CollectionTimelineView.tsx`

**File:** `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx`, `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx`
**Issue:** Per 26-03-SUMMARY.md and 26-04-SUMMARY.md's "Issues Encountered" sections, both worktrees lacked installed `node_modules`, so the plans' own automated `npx tsc --noEmit` verification step could not run for these two files — verification fell back to manual review and grep-based acceptance checks only. Only Plan 26-02's files (List/Gallery) got a live compiler pass. Manual review in this report found no obvious type errors, but no live compiler confirmation exists for Calendar/Timeline as of this review.
**Fix:** Run `cd apps/workspaces && npx tsc --noEmit` once in an environment with dependencies installed, before closing out this phase's verification.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
