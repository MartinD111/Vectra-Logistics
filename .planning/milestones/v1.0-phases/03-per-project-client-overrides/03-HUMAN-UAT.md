---
status: partial
phase: 03-per-project-client-overrides
source: [03-VERIFICATION.md]
started: 2026-07-06T00:00:00Z
updated: 2026-07-06T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Attach flow and picker UX
expected: Open a client detail page in the browser. The "Linked Projects" section renders in the main column above the canvas (not inside the 320px sidebar). Empty-state copy shows when no projects are attached. Clicking "Attach project" opens a dropdown popover (not a full-screen modal) with a working search filter. Selecting a project shows the row appear without a page reload, and re-opening the picker shows that project deprioritized (checkmark, greyed) rather than removed from the list.
result: [pending]

### 2. Per-field override contract and unlink flow
expected: Expand a linked project card. Each of the 3 fields (rate, responsible employee, notes) independently shows "Override"/"Reset to default" correctly reflecting `is_overridden`. Overriding only the Rate field, saving, and reloading the page shows employee/notes still with inherited/global values (not cleared) and Rate showing the overridden value with the primary-600 left-border accent. Clicking "Reset to default" on Rate reverts it to the greyed inherited display showing the client's actual global default value. Clicking "Unlink" on a project with overrides set shows a dialog matching UI-SPEC copy exactly; confirming removes the row; re-attaching that same project via the picker shows all 3 fields back in the inherited state (no residual overrides, per D-05).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
