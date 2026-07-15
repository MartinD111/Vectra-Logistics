---
phase: 26-additional-view-types
verified: 2026-07-15T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cycle through all 6 view types (Board → Table → List → Calendar → Gallery → Timeline → back to Board) on a single live collection via ViewSwitcher"
    expected: "Each view type renders correctly with the collection's real records; exactly one collection_views row per type exists after the first full cycle (verify via network tab / listViews); no duplicate collection_records are created"
    why_human: "Real-time UI behavior and duplicate-row absence over repeated interaction cannot be confirmed by static code analysis alone — the plans' own <verification> sections call for this live smoke test and 26-05-SUMMARY.md explicitly states it was not run during execution ('a verification-phase follow-up, not run in this execution session')"
  - test: "Open ViewSettingsMenu on a Calendar/Gallery/Timeline view, set the property picker(s), refresh the page, and confirm the selection persisted"
    expected: "calendarDateProperty/galleryCoverProperty/timelineStartProperty/timelineEndProperty values survive a page reload"
    why_human: "Persistence-after-refresh is a runtime/network behavior, not verifiable via grep"
  - test: "Double-click (or click twice quickly) an empty Calendar day cell before the first record-creation request resolves"
    expected: "Ideally only one record is created — but code review (WR-04, confirmed present in current code) shows no isPending guard on the day-cell onClick, so this will likely create two blank records for the same day"
    why_human: "Confirms in practice the severity/frequency of the WR-04 warning already documented in 26-REVIEW.md; a human should decide whether this warning-level defect needs a follow-up fix before moving on"
---

# Phase 26: Additional View Types Verification Report

**Phase Goal:** The same `collection-view` block renders all 6 view types (Board, Table, List, Calendar, Gallery, Timeline) over the same `collection_records`, with zero new block kind and zero data duplication.
**Verified:** 2026-07-15
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ViewSwitcher shows a dropdown listing all 6 view types; create-once-then-remember mechanism unchanged (D-10) | ✓ VERIFIED | `ViewSwitcher.tsx` — `VIEW_TYPES` array has 6 entries (board/table/list/calendar/gallery/timeline); `switchTo` preserves `pendingType` in-flight guard, existing-sibling lookup via `viewsQuery.data?.find`, and `createView.mutateAsync(...).then(...).catch(...).finally(...)` chain verbatim |
| 2 | ViewSettingsMenu offers Calendar/Gallery/Timeline property pickers, each shown only for matching view.type, autosaving to view.config (D-01, D-04, D-06) | ✓ VERIFIED | `ViewSettingsMenu.tsx` lines 165-226 — three conditional sections gated on `view.type === 'calendar'/'gallery'/'timeline'`, each `<select>` calling a setter that does `updateView.mutate({ config: { ...view.config, <key>: value } })` |
| 3 | formatCardPropertyValue reusable by other view renderers without duplication | ✓ VERIFIED | `BoardCard.tsx:24` — `export function formatCardPropertyValue`; imported and called (not re-derived) in `CollectionListView.tsx`, `CollectionGalleryView.tsx`, `CollectionCalendarView.tsx` |
| 4 | User can view a collection as a flat list — single-column rows, title left, card-face properties as inline chips right (D-09) | ✓ VERIFIED | `CollectionListView.tsx` — one row per record (`records.map`), title + `formatCardPropertyValue`-driven chips, structurally distinct from `CollectionTableView`'s grid |
| 5 | User can view a collection as a gallery with optional cover image per card (D-04); no cover shows a plain placeholder, never a broken-image icon (D-05) | ✓ VERIFIED | `CollectionGalleryView.tsx` — `coverUrl` only rendered as `<img>` when a non-empty string is resolved from the chosen `files`-property's first entry; falls back to a plain `<div className="w-full h-32 bg-gray-100...">` placeholder block otherwise |
| 6 | User can view a collection as a calendar plotted by a chosen date property (VIEW-03, D-01); date-less records render in an "Unscheduled" tray, not hidden (D-02); single month view with prev/next nav and click-a-day-to-create (D-03) | ✓ VERIFIED | `CollectionCalendarView.tsx` — `scheduled`/`unscheduled` split by `calendarDateProperty` presence; `unscheduled` rendered in a dedicated "Unscheduled" panel; month grid with `ChevronLeft`/`ChevronRight` nav; day-cell `onClick` calls `createRecord.mutateAsync` with the date pre-set and enters inline-edit via `autoFocusId` |
| 7 | User can view a collection as a timeline/Gantt plotted by two chosen start/end date properties (VIEW-05, D-06); record only renders a bar when both are set (D-07); fixed month-wide scale with prev/next nav (D-08) | ✓ VERIFIED | `CollectionTimelineView.tsx` — `qualifying = records.filter(r => r.props[start] && r.props[end])` (both required); `computeBarPosition` plots proportionally within `daysInMonth`; `ChevronLeft`/`ChevronRight` month nav |
| 8 | Calendar/Timeline prev/next nav buttons carry accessible labels | ✓ VERIFIED | Both files: `aria-label="Previous month"` / `aria-label="Next month"` present on the nav buttons |
| 9 | The same data_collection can be viewed as List/Calendar/Gallery/Timeline via the same collection-view block, all reading the same collection_records — no new block kind, no data duplication | ✓ VERIFIED | `BoardBlock.tsx` — single `view.type` ternary chain mounts `CollectionListView`/`CollectionCalendarView`/`CollectionGalleryView`/`CollectionTimelineView`, all fed the same `sorted` records array computed once at the top of `BoardBlock`; only one `useUpdateAnyRecord(` call in the file (confirmed via read); no new block `kind` registered — `BoardBlock` continues to render for the existing `collection-view` block kind |
| 10 | Switching between all 6 view types never creates duplicate records | ✓ VERIFIED | `ViewSwitcher.switchTo` never calls any record-creation hook (only `createView.mutateAsync` for a `collection_views` row, guarded by `pendingType`/existing-sibling lookup) — confirmed no `useCreateRecord`/`recordsApi.create` call exists anywhere in `ViewSwitcher.tsx` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/components/projectPage/board/BoardCard.tsx` | Exported `formatCardPropertyValue` | ✓ VERIFIED | `export function formatCardPropertyValue` present, body unchanged |
| `apps/workspaces/src/components/projectPage/board/ViewSwitcher.tsx` | 6-type dropdown | ✓ VERIFIED | `'timeline'` present, dropdown markup (`fixed inset-0 z-20` backdrop, `ChevronDown`) present |
| `apps/workspaces/src/components/projectPage/board/ViewSettingsMenu.tsx` | Property pickers for calendar/gallery/timeline | ✓ VERIFIED | `calendarDateProperty`/`galleryCoverProperty`/`timelineStartProperty`/`timelineEndProperty` read+write present |
| `apps/workspaces/src/components/projectPage/collectionList/CollectionListView.tsx` | Flat list renderer | ✓ VERIFIED | 77 lines, substantive, reuses `formatCardPropertyValue` |
| `apps/workspaces/src/components/projectPage/collectionGallery/CollectionGalleryView.tsx` | Card-grid gallery renderer | ✓ VERIFIED | 84 lines, substantive, cover-image + placeholder logic present |
| `apps/workspaces/src/components/projectPage/collectionCalendar/CollectionCalendarView.tsx` | Month-grid calendar renderer | ✓ VERIFIED | 317 lines, substantive, Unscheduled tray + click-to-create present |
| `apps/workspaces/src/components/projectPage/collectionTimeline/CollectionTimelineView.tsx` | Month-wide Gantt renderer | ✓ VERIFIED | 183 lines, substantive, `computeBarPosition` present |
| `apps/workspaces/src/components/projectPage/BoardBlock.tsx` | `view.type` branch covering all 6 types | ✓ VERIFIED | All 4 new components imported and conditionally rendered; existing Board/Table paths and single `useUpdateAnyRecord` instance unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ViewSwitcher.tsx` | `useRecords.ts` (`useViews`/`useCreateView`) | create-once-then-remember + `pendingType` guard | ✓ WIRED | Confirmed unchanged from Phase 25's mechanism |
| `ViewSettingsMenu.tsx` | `useUpdateView(view.id)` | `updateView.mutate({ config: {...} })` | ✓ WIRED | All 4 new pickers call it independently |
| `CollectionListView.tsx` | `BoardCard.tsx` | `import { formatCardPropertyValue }` | ✓ WIRED | Confirmed |
| `CollectionGalleryView.tsx` | `BoardCard.tsx` | `import { formatCardPropertyValue }` | ✓ WIRED | Confirmed |
| `CollectionCalendarView.tsx` | `BoardCard.tsx` | `import { formatCardPropertyValue }` | ✓ WIRED | Confirmed |
| `CollectionCalendarView.tsx` | `useRecords.ts` | `useCreateRecord`, `useUpdateAnyRecord` | ✓ WIRED | Confirmed, constructed internally (not passed as prop from `BoardBlock`) |
| `BoardBlock.tsx` | `CollectionListView.tsx` | `view.type === 'list'` conditional render | ✓ WIRED | Confirmed |
| `BoardBlock.tsx` | `CollectionCalendarView.tsx` | `view.type === 'calendar'` conditional render | ✓ WIRED | Confirmed |
| `BoardBlock.tsx` | `CollectionGalleryView.tsx` | `view.type === 'gallery'` conditional render | ✓ WIRED | Confirmed |
| `BoardBlock.tsx` | `CollectionTimelineView.tsx` | `view.type === 'timeline'` conditional render | ✓ WIRED | Confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CollectionListView`/`CollectionCalendarView`/`CollectionGalleryView`/`CollectionTimelineView` | `records` prop | `BoardBlock`'s `sorted` (derived from `recordsQuery.data` via `useRecords(block.collectionId)` → `applyFilters`/`applySorts`) | Yes | ✓ FLOWING — same live `collection_records` fetch used by Board/Table, no separate/duplicate fetch, no static fallback |
| Backend acceptance of new `view.type` values | `type` field | `apps/api/src/domains/records/dto/create-view.dto.ts` / `update-view.dto.ts` | Yes | ✓ FLOWING — `z.enum(['board', 'table', 'calendar', 'gallery', 'list', 'timeline'])` already accepts all 6 values (no backend change needed for this phase, consistent with the "reuse existing view CRUD" constraint) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full monorepo TypeScript compiles with zero errors after Phase 26 changes | `cd apps/workspaces && npx tsc --noEmit` | Exit code 0, empty output | ✓ PASS — this resolves 26-REVIEW.md's IN-04 finding (no prior live `tsc` pass existed for Calendar/Timeline); `node_modules` is now installed in this environment and the full compile succeeded with zero errors across all touched files |
| Backend view-type enum accepts all 6 types | Read `create-view.dto.ts`/`update-view.dto.ts` | `z.enum(['board','table','calendar','gallery','list','timeline'])` | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in the 4 new view components or 3 modified shared files | `grep -inE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon"` | 2 incidental matches (an `placeholder="Untitled"` input attribute and a comment using the word "placeholder" in an unrelated sentence — neither is a debt marker) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEW-02 | 26-01, 26-02, 26-05 | User can view a collection as a flat list | ✓ SATISFIED | `CollectionListView.tsx` implemented and wired |
| VIEW-03 | 26-01, 26-03, 26-05 | User can view a collection as a calendar, plotted by a date property | ✓ SATISFIED | `CollectionCalendarView.tsx` implemented and wired — **note:** `.planning/REQUIREMENTS.md` line 56 still shows `[ ]` unchecked and its traceability table (line 119) says "Pending" for VIEW-03; this is a stale-documentation gap, not a code gap (see Anti-Patterns/Gaps note below) |
| VIEW-04 | 26-01, 26-02, 26-05 | User can view a collection as a gallery (card grid with optional cover image) | ✓ SATISFIED | `CollectionGalleryView.tsx` implemented and wired |
| VIEW-05 | 26-01, 26-04, 26-05 | User can view a collection as a timeline/Gantt, plotted by a date-range property | ✓ SATISFIED | `CollectionTimelineView.tsx` implemented and wired (via two independently-chosen `date` properties, per D-06's deliberate divergence from a literal date-range property type) — **note:** same stale-documentation gap as VIEW-03 (REQUIREMENTS.md line 58/121 still shows unchecked/"Pending") |

No orphaned requirements found — REQUIREMENTS.md maps exactly VIEW-02 through VIEW-05 to Phase 26, and all four appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CollectionTimelineView.tsx` | 36-51 (`computeBarPosition`) | Incomplete clamp — only the left edge of a Gantt bar is bounded; records starting after or ending before the visible month produce out-of-range/negative `widthPct` | ⚠️ Warning (carried from 26-REVIEW.md WR-01, confirmed still present) | Visually contained by `overflow-hidden`, but every out-of-range record still consumes a blank `min-h-[36px]` lane row when paging through months |
| `CollectionTimelineView.tsx` | 86-87 | "No properties chosen" empty state body copy is copy-pasted from the unrelated "filtered to zero" case | ⚠️ Warning (26-REVIEW.md WR-02, confirmed still present) | Cosmetic/copy mismatch only |
| `ViewSettingsMenu.tsx` | 89-107 | New pickers spread from the `view.config` prop (not a merged local snapshot), reintroducing the WR-04-class stale-config race across 6 fields | ⚠️ Warning (26-REVIEW.md WR-03, confirmed still present) | Only reachable if a user edits two different config fields within one PATCH round-trip window — narrow edge case |
| `CollectionCalendarView.tsx` | 261-266 | Day-cell `onClick` has no `createRecord.isPending` guard | ⚠️ Warning (26-REVIEW.md WR-04, confirmed still present) | Fast double-click can create two blank records for the same day |
| `CollectionGalleryView.tsx` | 48-52 | Cover-image feature assumes `files`-property values are image URLs, but the only editor for that property type is a freeform unvalidated text-tag input | ⚠️ Warning (26-REVIEW.md WR-05, confirmed still present) | Cover images will typically fail to render in practice unless a user manually pastes a full image URL; degrades gracefully to placeholder per D-05, so no visible broken-image icon |
| `.planning/REQUIREMENTS.md` | 56, 58, 119, 121 | VIEW-03/VIEW-05 checkboxes and traceability table still show unchecked/"Pending" despite being implemented and wired in this phase | ℹ️ Info | Documentation staleness only — does not reflect a code-level gap; recommend updating REQUIREMENTS.md as part of phase close-out |

None of these are blocker-level per the review's own classification (0 critical) and per this verification's independent code reading — all 5 warnings from 26-REVIEW.md were re-confirmed present in the current code, none newly discovered, none contradicting a must-have truth.

### Human Verification Required

### 1. Full 6-view-type cycle smoke test

**Test:** On a single live collection, use `ViewSwitcher` to cycle through all 6 view types (Board → Table → List → Calendar → Gallery → Timeline → back to Board).
**Expected:** Each view renders the collection's real records correctly; exactly one `collection_views` row per type exists after the first full cycle; no duplicate `collection_records` are created.
**Why human:** This is the plans' own documented `<verification>` smoke test, explicitly **not run** during execution — 26-05-SUMMARY.md states it is "a verification-phase follow-up, not run in this execution session." Runtime duplicate-row absence over repeated interaction cannot be fully confirmed by static code reading alone, even though the code path (`switchTo`'s existing-sibling lookup + `pendingType` guard) supports the claim.

### 2. View-config persistence across refresh

**Test:** Open `ViewSettingsMenu` on a Calendar/Gallery/Timeline view, set the property picker(s), refresh the page.
**Expected:** The selected `calendarDateProperty`/`galleryCoverProperty`/`timelineStartProperty`/`timelineEndProperty` value(s) persist.
**Why human:** Persistence-after-reload is a runtime/network round-trip behavior.

### 3. Calendar duplicate-create risk (WR-04) — severity confirmation

**Test:** Rapidly click (or double-click) an empty Calendar day cell.
**Expected (per current code):** Two blank records will likely be created, since `createRecord.mutateAsync` has no `isPending` guard on the day-cell `onClick`.
**Why human:** This is a known, already-documented warning (26-REVIEW.md WR-04) confirmed still present in the code. A human should decide whether this warning-level defect is acceptable to ship as-is or needs a follow-up fix before Phase 26 is considered fully closed, per the instruction to not treat review warnings as automatic blockers.

### Gaps Summary

No must-have truth, artifact, or key link failed. All 4 new view renderers (List, Calendar, Gallery, Timeline) exist, are substantive (not stubs), are wired into `BoardBlock.tsx`'s `view.type` branch, and consume the same `sorted` records array/`collection_records` fetch as Board/Table — satisfying the phase goal's "same block, same data, zero duplication" contract. `ViewSwitcher` and `ViewSettingsMenu` were extended (not duplicated) to support all 6 types. `tsc --noEmit` now passes cleanly across the whole app, resolving the one open item (IN-04) from 26-REVIEW.md.

Five warning-level defects from 26-REVIEW.md (WR-01 through WR-05) were independently re-confirmed present in the current code via direct file reading. Per the verification instructions, warnings do not block phase completion, but three of them (WR-01 Timeline clamp bug, WR-03 stale-config race, WR-04 Calendar duplicate-create) are genuine functional-correctness issues a human should weigh in on before treating this phase as fully closed — hence `status: human_needed` rather than `passed`. Additionally, `.planning/REQUIREMENTS.md`'s checkboxes for VIEW-03/VIEW-05 are stale (still unchecked) despite the code satisfying both requirements — a documentation-only fix, not a code gap.

---

*Verified: 2026-07-15*
*Verifier: Claude (gsd-verifier)*
