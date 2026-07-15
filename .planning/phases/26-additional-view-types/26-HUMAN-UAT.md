---
status: partial
phase: 26-additional-view-types
source: [26-VERIFICATION.md]
started: 2026-07-15T00:00:00Z
updated: 2026-07-15T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full 6-view-type cycle smoke test
expected: On a single live collection, cycling ViewSwitcher through all 6 view types (Board → Table → List → Calendar → Gallery → Timeline → back to Board) renders each view correctly with the collection's real records; exactly one collection_views row per type exists after the first full cycle; no duplicate collection_records are created.
result: [pending]

### 2. View-config persistence across refresh
expected: Setting property picker(s) on Calendar/Gallery/Timeline in ViewSettingsMenu and refreshing the page shows the calendarDateProperty/galleryCoverProperty/timelineStartProperty/timelineEndProperty values persisted.
result: [pending]

### 3. Calendar duplicate-create risk (WR-04) — severity confirmation
expected: Rapidly clicking (or double-clicking) an empty Calendar day cell should ideally create only one record, but current code has no isPending guard on the day-cell onClick, so it will likely create two blank records. Human should decide whether this is acceptable to ship or needs a follow-up fix.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
