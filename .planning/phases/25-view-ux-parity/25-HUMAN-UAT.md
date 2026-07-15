---
status: partial
phase: 25-view-ux-parity
source: [25-VERIFICATION.md]
started: 2026-07-15T00:00:00Z
updated: 2026-07-15T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Filter conditions apply and persist across refresh
expected: Open a board's Filter popover, add a condition on each property type (text, number, date, select, multi-select, checkbox, person). Board columns show only matching records immediately; after refresh, `view.config.filters` round-trips via PATCH /views/:id and the same filtered set renders.
result: [pending]

### 2. Sort ordering (asc/desc, number and date)
expected: Add a Sort condition (asc and desc) on a number and a date property; cards reorder within each column per the chosen property/direction.
result: [pending]

### 3. Card-face property rendering resolves labels, not raw ids
expected: Open View settings ("..."), toggle 2-3 card-face properties across different property types (checkbox, person, multi-select, select). No raw UUIDs appear on any card face (Yes/No, resolved team member name, comma-joined resolved labels); toggling is instant and persists after refresh.
result: [pending]

### 4. Column aggregation arithmetic correctness
expected: Set column aggregation to Sum and to Average against a real number property with several records per column. Footer "Sum: X" / "Avg: X" values match manual sum/average of the visible cards' numeric prop values per column.
result: [pending]

### 5. Board/Table view switch creates no duplicate rows
expected: Switch a collection-view block from Board to Table and back several times (including rapid double-clicks on Table). Exactly one sibling `collection_views` row of type 'table' is created on first switch; every subsequent switch reuses it; `collection_records` count is unchanged before/after switching.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
