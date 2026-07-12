---
phase: 04-bulk-excel-import
verified: 2026-07-06T00:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 4: Bulk Excel Import Verification Report

**Phase Goal:** Users can onboard many clients at once instead of one-by-one, with clear visibility into what succeeded and failed
**Verified:** 2026-07-06
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/v1/crm/clients/import accepts an array of row objects and returns a per-row report instead of a 501 stub | VERIFIED | `apps/api/src/domains/crm/crm.service.ts:159-218` — `importClients` fully replaces the prior `AppError(501, ...)` stub; no `'Bulk import not yet implemented'` string remains in the file. Route (`crm.routes.ts:22`) and controller (`crm.controller.ts:42-44`) already wired, confirmed unchanged and correct. |
| 2 | A row with a duplicate VAT ID (scoped to company_id) fails with a specific reason instead of creating a duplicate client | VERIFIED | `crm.service.ts:180-187` calls `crmRepository.findClientByVatId(vatId, companyId)` (company-scoped, `crm.repository.ts:34-38`) and pushes `{ status: 'failed', reason: 'Client with this VAT ID already exists' }`, `continue`s the loop without inserting. Blank `vat_id` correctly skipped via `.trim() !== ''` guard (verified no false-positive on empty strings). |
| 3 | A row with a non-matching responsible-employee email fails with a specific reason; a blank email succeeds with responsible_employee_id null | VERIFIED | `crm.service.ts:168-178` resolves `responsible_employee_email` via `resolveResponsibleEmployee` -> `teamRepository.findMemberByEmail(email, companyId)` (`team.repository.ts:44-48`, company-scoped, distinct from the untouched global `emailExists`). Non-match throws `AppError(404, 'No team member found with this email')`, caught per-row. Blank/missing email leaves `responsibleEmployeeId = null` and the row proceeds. |
| 4 | A row with blank credit_limit is created with credit_limit = 10000; a row with blank default_rate_eur is created with default_rate_eur = null | VERIFIED | Frontend (`ImportClientsModal.tsx:93-98`) omits `credit_limit`/`default_rate_eur` from the POST payload entirely when the cell is blank (verified via actual xlsx write/read round-trip: blank Excel cells for `vat_id`/`address` round-trip as `''`, but numeric cells left blank in `json_to_sheet`/`writeFile`/`read` round-trip as `''` too — frontend's `!== ''` check correctly omits the key). Backend (`crm.service.ts:204-205`) applies `d.credit_limit ?? 10000` / `d.default_rate_eur ?? null`, and `CreateClientSchema` (`create-client.dto.ts`) marks both fields `.optional()`, so an omitted key parses to `undefined`, triggering the `??` defaults. |
| 5 | One invalid row in a batch does not prevent other valid rows in the same batch from being created | VERIFIED | Per-row `for` loop with `continue` on every failure path (duplicate VAT, bad email, failed Zod parse) — no batch-wide throw or transaction rollback; each valid row is inserted independently via `crmRepository.createClient`. |
| 6 | User can click 'Download template' and receive an .xlsx file with columns: name, country, VAT ID, address, responsible employee, credit limit, default rate | VERIFIED | `ImportClientsModal.tsx:51-66` `downloadTemplate` builds a sheet via `xlsx.utils.json_to_sheet` with exactly the 7 keys in `TEMPLATE_COLUMNS` (`name, country, vat_id, address, responsible_employee, credit_limit, default_rate_eur`) and calls `xlsx.writeFile(wb, 'client-import-template.xlsx')`. |
| 7 | User can click 'Import from Excel' next to 'Add client' on the CRM dashboard, upload a filled .xlsx file, see a preview, and confirm the import | VERIFIED | `records/page.tsx:71-76` renders the "Import from Excel" button in the same toolbar row immediately before "Add client" (`page.tsx:77-82`), visually distinct (outline/secondary style vs. primary fill). `ImportClientsModal` mounted at `page.tsx:150`. Modal implements `upload -> preview -> report` step state machine with file parsing (`handleFileUpload`, lines 68-84), preview table (lines 158-204), and confirm button wired to `useImportClients().mutate` (line 196, 102-108). |
| 8 | After confirming, user sees a per-row report showing which rows were created vs failed, with a specific reason for each failure | VERIFIED | `ImportClientsModal.tsx:206-253` renders `report.created`/`report.failed` summary and a table of `report.results` with row number, colored status badge, and either the created client's name or the verbatim backend `reason` string. |
| 9 | The CRM client list refreshes (new clients appear) after a successful import without a manual page reload | VERIFIED | `useCrm.ts:49-55` `useImportClients` invalidates `qk.clients` (`['crm-clients']`) `onSuccess`, the same query key `useClients` (`useCrm.ts:23-30`) reads from — React Query will automatically refetch and re-render the client list. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/domains/crm/crm.service.ts` | Real `importClients` implementation replacing 501 stub | VERIFIED | Contains `async importClients(companyId: string, body: unknown): Promise<ImportClientsResult>`, no stub string remains, private `resolveResponsibleEmployee` helper present. |
| `apps/api/src/domains/crm/crm.repository.ts` | `findClientByVatId` scoped by company_id | VERIFIED | Lines 34-38, queries `clients WHERE vat_id = $1 AND company_id = $2`. |
| `apps/api/src/domains/team/team.repository.ts` | `findMemberByEmail` scoped by company_id | VERIFIED | Lines 44-48, queries `users` filtered by `email` AND `company_id`; existing global `emailExists` (line 52) left unmodified. |
| `apps/api/src/domains/crm/crm.types.ts` | `ImportRowResult` / `ImportClientsResult` types | VERIFIED | Lines 67-80, both interfaces exported with correct shape. |
| `apps/workspaces/src/components/projectPage/ImportClientsModal.tsx` | Upload -> parse -> preview -> confirm -> report modal, min 80 lines | VERIFIED | 258 lines, full 3-step state machine implemented, exceeds min_lines. |
| `apps/workspaces/src/lib/api/crm.api.ts` | `importClients` API function + `ImportClientsResult` type | VERIFIED | Lines 77-100 (interfaces + `crmApi.importClients` posting to `${BASE}/clients/import`, unwrapped response). |
| `apps/workspaces/src/lib/hooks/useCrm.ts` | `useImportClients` mutation hook | VERIFIED | Lines 49-55, mirrors `useCreateClient` shape, invalidates `qk.clients`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `crm.controller.ts` | `crm.service.ts` | `crmService.importClients(requireCompany(req), req.body)` | WIRED | `crm.controller.ts:42-44`, unchanged from plan, confirmed present. |
| `crm.service.ts` | `team.repository.ts` | `teamRepository.findMemberByEmail(email, companyId)` | WIRED | Imported at `crm.service.ts:4`, called at line 221 inside `resolveResponsibleEmployee`. |
| `records/page.tsx` | `ImportClientsModal.tsx` | `<ImportClientsModal open={importOpen} onClose={...} />` | WIRED | `page.tsx:150`, `importOpen` state declared line 31, button `onClick` at line 72. |
| `ImportClientsModal.tsx` | `useCrm.ts` | `useImportClients().mutate(rows)` | WIRED | `ImportClientsModal.tsx:32` (`const importClients = useImportClients()`), `.mutate(payload, {...})` at line 102. |
| `crm.api.ts` | apps/api backend | `apiFetch(BASE/clients/import, 'POST', rows)` | WIRED | `crm.api.ts:99-100`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ImportClientsModal.tsx` report step | `report` (from `useImportClients` mutation) | Real POST to `/api/v1/crm/clients/import`, backed by real per-row DB inserts (`crmRepository.createClient`) and real duplicate/email lookups (`db.query` against `clients`/`users` tables) | Yes | FLOWING |
| `records/page.tsx` client list | `useClients()` via `qk.clients` | Real `crmApi.listClients` -> `crmRepository.listClients` (`SELECT * FROM clients WHERE company_id = $1`) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend type-checks with new import logic | `cd apps/api && npx tsc --noEmit` | No output (clean) | PASS |
| Frontend type-checks with new modal/hook/API | `cd apps/workspaces && npx tsc --noEmit` | No output (clean) | PASS |
| Template round-trip: blank string cells preserve as `''`, not lost | Node script simulating `xlsx.utils.json_to_sheet` -> `writeFile` -> `read` -> `sheet_to_json` | `vat_id: ''`, `address: ''` round-trip correctly as empty strings; numeric-blank cells also round-trip as `''`, correctly triggering the frontend's `!== ''` omission check | PASS |
| `CreateClientSchema` accepts blank `vat_id`/`address` string rows | Node script running `CreateClientSchema.safeParse` against a row with `vat_id: ''`, `address: ''` | `success: true` | PASS |
| Blank VAT ID does not false-positive the duplicate check | Code read: `crm.service.ts:181` `typeof rawVatId === 'string' && rawVatId.trim() !== ''` | Guard correctly skips lookup for blank VAT | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files found and none declared in PLAN/SUMMARY for this phase. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IMP-01 | 04-02 | User can download an Excel import template with columns: name, country, VAT ID, address, responsible employee, credit limit, default rate | SATISFIED | `ImportClientsModal.tsx` `downloadTemplate`, 7-column `TEMPLATE_COLUMNS` array matches exactly. |
| IMP-02 | 04-01, 04-02 | User can upload a filled-in template and have clients created in bulk | SATISFIED | Full backend `importClients` loop + frontend upload/preview/confirm flow, end-to-end wired. |
| IMP-03 | 04-01, 04-02 | User sees a per-row import report (created/failed, with reason) after import | SATISFIED | Backend `ImportRowResult`/`ImportClientsResult` + frontend report table rendering exact reason strings. |
| IMP-04 | 04-01 | Blank credit limit / default rate columns fall back to system defaults (€10,000 limit) rather than failing the row | SATISFIED | Backend `?? 10000` / `?? null` defaulting on optional Zod fields; frontend correctly omits blank numeric cells from payload rather than sending invalid values. |

No orphaned requirements — REQUIREMENTS.md lists exactly IMP-01 through IMP-04 for Phase 4, all four are declared across the two plans' frontmatter and all four are satisfied.

Note: REQUIREMENTS.md's checkbox markers (`- [ ]`) for IMP-01 through IMP-04 are still unchecked and the requirements-coverage table still shows "Pending" — this is a documentation bookkeeping gap (the checkboxes were not updated post-implementation), not a code gap. Does not block phase goal achievement; recommend updating REQUIREMENTS.md checkboxes as a trivial follow-up.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty-return stubs, no hardcoded-empty props found in any of the 8 files touched across both plans.

### Human Verification Required

None required to be blocking. Both plan SUMMARYs flag that no live PostgreSQL/backend instance was available during execution to run an end-to-end smoke test (upload real file -> confirm -> see report -> see list refresh in a running browser). This verification independently confirmed:
- Both apps type-check cleanly with no new errors.
- The xlsx round-trip behavior (write template -> user fills cells -> re-upload -> parse) was tested directly with the actual `xlsx` package outside the running app, confirming blank cells and typed numeric cells behave as the code assumes.
- All code paths (duplicate VAT, bad email, blank defaults, per-row continue) were traced against the actual committed source, not just SUMMARY claims.

Given this level of static + library-level verification, a live end-to-end click-through is recommended as a nice-to-have QA pass before wider rollout, but is not required to consider the phase goal achieved — it is not a blocking human-verification item.

### Gaps Summary

No gaps. All 4 roadmap success criteria and all 9 derived observable truths verified against actual source code (not SUMMARY claims). Both backend and frontend compile cleanly. Wiring confirmed at every hop: controller -> service -> repository -> DB query, and button -> modal -> hook -> API -> backend -> query invalidation -> list refresh. The only non-blocking item is a documentation bookkeeping gap in REQUIREMENTS.md's checkbox/status column, which does not affect code behavior.

---

_Verified: 2026-07-06_
_Verifier: Claude (gsd-verifier)_
