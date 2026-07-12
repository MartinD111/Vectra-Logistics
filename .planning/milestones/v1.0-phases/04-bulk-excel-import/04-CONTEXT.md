# Phase 4: Bulk Excel Import - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can onboard many clients at once instead of one-by-one: download an Excel template, fill it in, upload it, and see a per-row report of what succeeded and what failed. The backend already has a reserved-but-stubbed endpoint (`POST /api/v1/crm/clients/import` — currently throws `501 Bulk import not yet implemented — lands in Phase 4`); this phase implements that stub. No import history/audit view, no retry-failed-rows flow, no CSV support — Excel (.xlsx) only, single upload → single report, matching the roadmap's 4 success criteria exactly.

</domain>

<decisions>
## Implementation Decisions

### Parsing & Data Flow
- **D-01:** Parsing happens client-side, reusing the exact pattern already in `ExcelAutomationTool.tsx` (`xlsx.read` → `sheet_to_json` → JS row objects). The frontend POSTs an array of parsed row objects (JSON) to the import endpoint — not the raw file. No multipart/multer upload path, no server-side xlsx parsing introduced.
- **D-02:** No staging table. Explicitly rejected the `crm_import_staging` table CONCERNS.md sketches. Each import request is validated and inserted in a single request/response cycle; the per-row report is returned directly in the API response and rendered in the modal. No import history is persisted — there is no requirement asking for "view past imports."

### Transaction Model & Validation
- **D-03:** Per-row commit, not all-or-nothing. Each row is validated and inserted independently in its own operation; one bad row does not roll back or block any other row. This directly implements IMP-03's "per-row report" requirement — a 200-row batch with 3 bad rows still creates the other 197.
- **D-04:** Validation reuses `CreateClientSchema` (`apps/api/src/domains/crm/dto/create-client.dto.ts`) exactly, as-is — no new/stricter per-country VAT format regex, no rules beyond what the existing single-client "Add client" path already enforces. A row that would succeed via `AddClientModal` also succeeds via import, and vice versa. Country stays the existing 2-letter check; VAT ID stays the existing max-20-chars check with no pattern validation.
- **D-05:** Duplicate clients (matched by VAT ID, scoped to `company_id`) are flagged as a per-row failure with a clear reason (e.g. "Client with this VAT ID already exists") — not silently skipped, not overwritten, not created as a second row. This surfaces in the per-row report like any other validation failure.
- **D-06 (IMP-04, already in roadmap, reaffirmed):** Blank `credit_limit` defaults to €10,000; blank `default_rate_eur` stays `null` (falls back to system default same as single-add) rather than failing the row.

### Responsible Employee Column
- **D-07:** The template's "responsible employee" column expects an email address. Server-side, each row's email is looked up against the company's team members (existing team/users list, same one Phase 2's responsible-employee picker uses). If the email doesn't match any team member in the company, that specific row fails with a clear reason (e.g. "No team member found with this email") — the whole row fails, not just that field, since `responsible_employee_id` isn't nullable-then-silently-dropped for this column per the user's chosen behavior. Blank column value is allowed (client created with no responsible employee) — only a *non-matching* email is a failure.

### Template Generation
- **D-08:** The "Download template" button generates the `.xlsx` file client-side using the `xlsx` package (`xlsx.utils.json_to_sheet` with a header row: name, country, VAT ID, address, responsible employee, credit limit, default rate), then triggers a browser download. No backend endpoint for the template, no static asset file checked into the repo — this keeps the template in sync with the schema by construction (same file that defines the column list also generates the sheet).

### UI Location
- **D-09:** The entire import flow (upload → client-side parse/preview → confirm → per-row report) lives in a modal launched from the CRM dashboard (`/records`), via a new "Import from Excel" button placed next to the existing "Add client" button. No new route/page. Single-add and bulk-add remain sibling actions on the same dashboard.

### Claude's Discretion
- Exact modal step structure (e.g. single-step upload+preview+confirm vs. a small wizard) — as long as the user sees a preview before committing and a per-row report after.
- Exact wording/formatting of per-row failure reasons, as long as they're specific enough to act on (e.g. name the row number and the concrete reason, not a generic "Row 5: invalid").
- Column order/exact header cell styling in the generated template — column set itself is locked (D-08's 7 columns), presentation isn't.
- How the modal's preview table paginates/scrolls for large batches (100+ rows) — no specific UX was requested beyond "clear visibility into what succeeded and failed."

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — existing stub to implement
- `apps/api/src/domains/crm/crm.service.ts` (lines 158-160) — `importClients(_companyId, _body)` currently throws `AppError(501, 'Bulk import not yet implemented — lands in Phase 4')`. This phase replaces the stub body; the method signature/route are already wired.
- `apps/api/src/domains/crm/crm.routes.ts` (line 21) — `router.post('/clients/import', importClients)` already registered; no new route needed.
- `apps/api/src/domains/crm/crm.controller.ts` (lines 42-44) — `importClients` controller already calls `crmService.importClients(requireCompany(req), req.body)` and returns the result as-is; response shape is whatever the service returns (per-row report array).
- `apps/api/src/domains/crm/dto/create-client.dto.ts` — `CreateClientSchema` (name, country 2-letter, vat_id, email, credit_limit, default_rate_eur, notes, address, responsible_employee_id) — the exact validation contract each import row must satisfy (D-04). Reuse this Zod schema per-row, do not write new validation rules.

### Reference implementations for reused patterns
- `apps/workspaces/src/components/workspaces/ExcelAutomationTool.tsx` (lines 1-85) — the existing client-side `xlsx.read` → `sheet_to_json` → JS objects parsing pattern (D-01) to mirror for reading the uploaded file. Not a direct import of this component — it's a different workflow (rate parser automation), but the parsing mechanics are the pattern to follow.
- `apps/workspaces/src/components/projectPage/AddClientModal.tsx` — the existing single-client "Add client" modal: field set (name, country, VAT ID, credit limit defaulting to "10000", default rate), `useCreateClient` hook usage, `saas-card`/`saas-input` styling conventions. The import modal should feel like a sibling of this, not a different visual language.
- `apps/workspaces/src/app/records/page.tsx` — CRM dashboard where the existing "Add client" button lives; "Import from Excel" (D-09) is added alongside it here.

### Known concerns (superseded by this discussion's decisions — kept for traceability)
- `.planning/codebase/CONCERNS.md` §"Excel Bulk Import Not Implemented" — sketches a `crm_import_staging` table and a `POST /api/crm/clients/import` endpoint. The endpoint already exists (see above); the staging table sketch is explicitly NOT used per D-02 (stateless per-request validation chosen instead).

### Project Requirements
- `.planning/REQUIREMENTS.md` — IMP-01 (download template), IMP-02 (bulk upload/create), IMP-03 (per-row report), IMP-04 (blank credit-limit/rate defaults)
- `.planning/ROADMAP.md` §"Phase 4: Bulk Excel Import" — 4 success criteria this phase must satisfy exactly

No external ADRs/PRDs beyond the above — requirements fully captured in REQUIREMENTS.md and this document.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `xlsx` package (already a dependency, used in `ExcelAutomationTool.tsx`) — both for parsing the uploaded file (D-01) and generating the downloadable template (D-08); same library, two directions.
- `CreateClientSchema` (Zod) — reusable as-is for per-row validation (D-04); no new schema needed, just applied in a loop.
- `useCreateClient` hook (`apps/workspaces/src/lib/hooks/useCrm.ts`) — the existing single-client creation hook; the import flow's per-row insert logic on the backend mirrors what this hook already calls, though import likely needs its own service-layer loop rather than N individual HTTP requests from the frontend.
- Team/users list (already queried by Phase 2's responsible-employee picker) — reusable for the email-to-`responsible_employee_id` lookup (D-07).

### Established Patterns
- DDD domain layering: `importClients` stays in `crm.service.ts`/`crm.repository.ts`, following the same controller → service → repository chain as every other CRM endpoint.
- No ORM — if any schema change is needed (unlikely, given D-02 rejects the staging table and no other new persistence was identified), it goes in a new idempotent `NNN_description.sql` migration.
- Multi-tenancy: import rows are scoped to `company_id` from the authenticated request; duplicate-VAT check (D-05) and employee-email lookup (D-07) must both be scoped to the same company, not global.

### Integration Points
- `apps/workspaces/src/app/records/page.tsx` — dashboard gains the "Import from Excel" button (D-09) next to "Add client."
- New import modal component (name/location: Claude's discretion, likely `apps/workspaces/src/components/projectPage/ImportClientsModal.tsx` sibling to `AddClientModal.tsx`) — handles upload, client-side parse (D-01), preview, POST to `/clients/import`, and renders the per-row report from the response.
- `crm.service.ts`'s `importClients` method — replace the stub body with: iterate rows → validate each via `CreateClientSchema` → check duplicate VAT (D-05) → resolve responsible-employee email (D-07) → insert via repository → accumulate per-row result → return `{ created, failed, results: [...] }`-shaped report.

</code_context>

<specifics>
## Specific Ideas

- The import modal should feel like continuation of `AddClientModal`'s visual language (same `saas-card`/`saas-input` conventions) — this is a sibling bulk-creation flow, not a separate subsystem.
- "Clear visibility into what succeeded and failed" (from the phase goal) is the single most important UX bar — per-row failure reasons must be specific and actionable, not generic.

</specifics>

<deferred>
## Deferred Ideas

- **Import history / view past imports** — considered via the CONCERNS.md staging-table sketch and explicitly rejected for this phase (D-02); no requirement asks for it. Could resurface as a future phase if users want an audit trail of bulk operations.
- **Retry-failed-rows flow** — a natural follow-up to a per-row report (re-upload just the failed rows after fixing them), but not requested; the user re-runs the whole template after corrections in v1.
- **Per-country VAT ID format validation** — considered and rejected (D-04) in favor of reusing `CreateClientSchema`'s existing lenient rule; could be added later as a shared improvement to both single-add and import if data quality becomes an issue.
- **CSV import support** — not discussed/requested; Excel (.xlsx) only, matching IMP-01's explicit "Excel import template" wording.

### Reviewed Todos (not folded)
None — no todos matched this phase (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 4-bulk-excel-import*
*Context gathered: 2026-07-06*
