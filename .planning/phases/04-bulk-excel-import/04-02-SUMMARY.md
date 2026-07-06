---
phase: 04-bulk-excel-import
plan: 02
subsystem: web
tags: [react, react-query, xlsx, crm, nextjs]

# Dependency graph
requires:
  - phase: 04-bulk-excel-import
    plan: 01
    provides: "Real POST /api/v1/crm/clients/import backend logic, ImportRowResult/ImportClientsResult types"
provides:
  - "Frontend bulk-import flow: template download + upload/parse/preview/confirm/report modal"
  - "importClients API function + useImportClients mutation hook"
  - "Import from Excel button on the CRM dashboard toolbar"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side xlsx template generation via xlsx.utils.json_to_sheet + xlsx.writeFile (new direction of the already-installed xlsx package, no new dependency)"
    - "Object-mode xlsx.utils.sheet_to_json parsing (no header:1) since the 7-column template is fixed, simpler than ExcelAutomationTool's generic column-remap"
    - "Explicit key-rename (responsible_employee -> responsible_employee_email) at POST-payload construction time, not in the template headers, to match the backend's expected row shape"

key-files:
  created:
    - apps/workspaces/src/components/projectPage/ImportClientsModal.tsx
  modified:
    - apps/workspaces/src/lib/api/crm.api.ts
    - apps/workspaces/src/lib/hooks/useCrm.ts
    - apps/workspaces/src/app/records/page.tsx

key-decisions:
  - "Three-step modal state (upload -> preview -> report), with template download combined into the upload step, per CONTEXT.md's Claude's Discretion"
  - "credit_limit/default_rate_eur only coerced to Number() when non-blank; blank values pass through untouched so the backend's existing ?? 10000 / ?? null defaulting applies (D-06), not duplicated client-side"
  - "Import button styled as a secondary/outline action, visually distinct from the primary 'Add client' button, placed before it in the toolbar row"

requirements-completed: [IMP-01, IMP-02, IMP-03]

duration: 18min
completed: 2026-07-06
---

# Phase 4 Plan 2: Bulk Excel Import Frontend Summary

**Dashboard-launched modal that downloads a locked 7-column .xlsx template, parses an uploaded file client-side via `xlsx`, previews parsed rows, POSTs them to the real `/clients/import` backend endpoint from Plan 04-01, and renders a per-row created/failed report with specific reasons.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-06
- **Completed:** 2026-07-06
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Added `ImportRowResult` / `ImportClientsResult` types and `crmApi.importClients` to `crm.api.ts`, posting a raw JSON row array to `/api/v1/crm/clients/import` and returning the report object unwrapped (matching the backend's `res.status(200).json(...)` contract from Plan 04-01)
- Added `useImportClients()` hook to `useCrm.ts`, mirroring `useCreateClient`'s shape, invalidating the existing `qk.clients` query key on success
- Built `ImportClientsModal.tsx`: a `'use client'` modal component with `open`/`onClose` props, mirroring `AddClientModal`'s overlay/card shell (widened to `max-w-3xl`) with three internal steps:
  - **Upload:** "Download template" button generates a 7-column `.xlsx` (`name`, `country`, `vat_id`, `address`, `responsible_employee`, `credit_limit`, `default_rate_eur`) via `xlsx.utils.json_to_sheet`/`xlsx.writeFile`; a file input parses an uploaded `.xlsx` via `xlsx.read`/`xlsx.utils.sheet_to_json` (object mode)
  - **Preview:** scrollable table showing all parsed rows before submission; "Back" returns to upload without submitting
  - **Report:** summary line (`N created, M failed`) plus a per-row table showing row number, colored status badge, and either the created client's name or the backend's exact failure reason
- Wired "Import from Excel" button into `records/page.tsx`'s toolbar, positioned before the existing "Add client" button with a visually distinct outline/secondary style; mounted `ImportClientsModal` alongside the existing `AddClientModal`

## Task Commits

1. **Task 1: Add importClients API function + useImportClients hook** - `23a8dc8` (feat)
2. **Task 2: Build ImportClientsModal.tsx** - `88ec6ea` (feat)
3. **Task 3: Wire "Import from Excel" button into the CRM dashboard** - `40b36d8` (feat)

**Plan metadata:** (this commit, SUMMARY.md)

## Files Created/Modified

- `apps/workspaces/src/lib/api/crm.api.ts` - added `ImportRowResult`/`ImportClientsResult` interfaces and `crmApi.importClients`
- `apps/workspaces/src/lib/hooks/useCrm.ts` - added `useImportClients` mutation hook
- `apps/workspaces/src/components/projectPage/ImportClientsModal.tsx` (new) - full upload -> preview -> confirm -> report modal
- `apps/workspaces/src/app/records/page.tsx` - added `importOpen` state, "Import from Excel" button, and `ImportClientsModal` mount

## Decisions Made

- Followed the plan's exact field-mapping instructions: template header key `responsible_employee` is renamed to `responsible_employee_email` only at POST-payload construction time (in `confirmImport`), keeping the template's column headers and the parsed-row preview using the friendlier `responsible_employee` key throughout the UI.
- `credit_limit`/`default_rate_eur` are only included in the POST payload (coerced via `Number(...)`) when the parsed cell value is non-blank; blank cells are omitted from the payload entirely so the backend's existing `?? 10000`/`?? null` defaulting (established in Plan 04-01) applies without duplicating that logic client-side, per D-06.
- Plan executed as written — no deviation in behavior from the `<action>` blocks.

## Deviations from Plan

None - plan executed exactly as written. All three tasks match their acceptance criteria: types/hook added without duplicating existing patterns, modal implements the full upload/preview/report flow with the exact key-rename mapping, and the dashboard button is visually distinct and wired correctly.

## Issues Encountered

- No live PostgreSQL/backend instance was available in this execution environment to run the plan's manual UI verification steps (downloading the template, filling test rows including a duplicate VAT and bad employee email, uploading, and confirming the resulting report). Verification was limited to `npx tsc --noEmit` passing cleanly (no new type errors) across all three tasks, plus manual code-path tracing against Plan 04-01's documented `ImportClientsResult` contract and the plan's exact field-mapping/defaulting instructions.
- This is a documented gap for whoever performs live QA/staging verification — the frontend flow is implemented as specified and type-checks cleanly against the real backend contract, but the end-to-end upload -> preview -> confirm -> report loop was not exercised against a live server in this session (same limitation noted in the Plan 04-01 SUMMARY for its own backend-only verification).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IMP-01, IMP-02, IMP-03 are implemented end-to-end (backend from Plan 04-01, frontend from this plan). Recommend a live smoke test against a seeded dev database/company before considering the phase's 4 success criteria fully closed out — specifically: template download producing exactly 7 correct headers, upload/preview/confirm creating clients in bulk, and the per-row report showing accurate created/failed counts with the exact backend-provided reason strings ("Client with this VAT ID already exists", "No team member found with this email").
- No remaining work identified for this plan's scope; IMP-04 (blank credit-limit/rate defaulting) was already completed in Plan 04-01 and is exercised correctly by this frontend (blank cells omitted from payload, letting backend defaults apply).

---
*Phase: 04-bulk-excel-import*
*Completed: 2026-07-06*
