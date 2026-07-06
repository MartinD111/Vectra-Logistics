---
status: partial
phase: 02-crm-dashboard-navigation-client-detail
source: [02-VERIFICATION.md]
started: 2026-07-06T00:00:00Z
updated: 2026-07-06T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Apply the client_pages migration to a live dev database
expected: Apply `database/migrations/022_client_pages.sql` to a live dev Postgres instance (twice, to confirm idempotency), then start the API + workspaces dev servers. Migration applies cleanly both times (no error on re-run); `client_pages` table exists with a unique index on `client_id`.
result: [pending]

### 2. Browser-test the CRM dashboard
expected: Visit `/records` with the sidebar visible; confirm "CRM" label routes to the dashboard; seed 2+ clients (one over-limit) and confirm the table renders, search filters by name, and the "Over limit only" toggle filters correctly. Table renders with Name/Country/Credit status/Responsible employee columns; filters compose correctly; empty states render when applicable.
result: [pending]

### 3. Browser-test client detail page navigation
expected: Click a client row on `/records`; confirm a new browser tab opens at `/records/{clientId}` and renders the sidebar + canvas without crashing. New tab opens; sidebar shows address/notes/responsible-employee; canvas auto-seeds current-situation + timeline blocks with their empty-state copy on first visit.
result: [pending]

### 4. Reproduce and confirm the autosave fix
expected: Edit the address field on the detail page sidebar, wait ~800ms, confirm the value persists on page reload. Then simulate a failed PATCH (e.g. stop the API mid-edit) and confirm the UI does not silently mark the edit as saved. Successful edits persist. Failed edits show "Couldn't save — try again" and do NOT lose the user's input. **Fixed in commit e68b28e:** `InlineTextField` and the canvas autosave now use `mutate()`'s `onSuccess`/`onError` callbacks instead of a dead-code try/catch; failed inline-field saves revert to last-known-good and show an error; failed canvas saves keep the dirty flag set and show an inline error banner. Still needs a live-DB/browser pass to confirm the fix behaves as intended under a real failed request.
result: [pending]

### 5. Confirm get-or-create dedupe guarantee against a live DB
expected: From an existing project page, click "New client page", search for / quick-create a client, confirm the resulting new tab opens the correct detail page, and repeat the flow for the same client to confirm no duplicate `client_pages` row is created (`SELECT COUNT(*) FROM client_pages WHERE client_id = $1` should remain 1). Single row per client under repeated get-or-create calls; new tab opens correctly both times.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
