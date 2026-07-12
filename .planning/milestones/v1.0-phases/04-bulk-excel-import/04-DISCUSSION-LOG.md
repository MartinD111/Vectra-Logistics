# Phase 4: Bulk Excel Import - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 4-bulk-excel-import
**Areas discussed:** Parse location, Transaction model, Duplicates, Template generation, UI location, Employee matching, Staging table, Validation strictness

---

## Parse location

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side parse | Reuses the existing xlsx-in-browser pattern from ExcelAutomationTool.tsx exactly — parse to JSON rows client-side, POST an array of row objects to the existing import endpoint. | ✓ |
| Server-side parse | POST the raw file (multipart/form-data via multer), parse with xlsx in Node. New surface area, no existing precedent in this codebase. | |

**User's choice:** Client-side parse
**Notes:** Recommended option chosen without modification.

---

## Transaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row commit | Each row validated/inserted independently; failures isolated and reported per-row. Matches IMP-03 directly. | ✓ |
| All-or-nothing transaction | Whole import succeeds or fails together; contradicts the phase's own "clear visibility into what succeeded and failed" goal. | |

**User's choice:** Per-row commit
**Notes:** Recommended option chosen without modification.

---

## Duplicates

| Option | Description | Selected |
|--------|-------------|----------|
| Flag as a per-row failure | If a row's VAT ID already exists for this company, mark that row failed with reason "Client with this VAT ID already exists" — surfaces in the report, no silent overwrite. | ✓ |
| Always create (no duplicate check) | Every valid row creates a new client regardless of existing matches — deferred to future phase. | |

**User's choice:** Flag as a per-row failure
**Notes:** Recommended option chosen without modification.

---

## Template gen

| Option | Description | Selected |
|--------|-------------|----------|
| Generate client-side with xlsx | "Download template" button builds a workbook in-browser using the same xlsx package already used for parsing; no backend endpoint, no static asset to keep in sync. | ✓ |
| Static pre-built file | A .xlsx file checked into the repo — risks drifting out of sync with the DTO schema. | |

**User's choice:** Generate client-side with xlsx
**Notes:** Recommended option chosen without modification.

---

## UI location

| Option | Description | Selected |
|--------|-------------|----------|
| Modal from CRM dashboard | An "Import from Excel" button next to the existing "Add client" button on /records opens a modal: upload → preview → confirm → per-row report. No new route. | ✓ |
| Dedicated import page/route | A new route (e.g. /records/import) with more room for a larger preview table — heavier UI lift, new nav path. | |

**User's choice:** Modal from CRM dashboard
**Notes:** Recommended option chosen without modification.

---

## Employee match

| Option | Description | Selected |
|--------|-------------|----------|
| Match by email | Template's "responsible employee" column expects an email; server looks it up against the company's team members. Row fails with a clear reason if no match. | ✓ |
| Out of scope for v1 | Import doesn't set responsible_employee_id at all; users set it manually per-client after import. | |

**User's choice:** Match by email
**Notes:** Recommended option chosen without modification.

---

## Staging table

| Option | Description | Selected |
|--------|-------------|----------|
| Stateless, no staging table | Each row validated and inserted (or rejected) in a single request/response cycle — no import history persisted server-side. Report returned directly in the API response. | ✓ |
| Persist to staging table | Rows staged first (with validation_errors column), enabling a future "import history" view or retry-failed-rows flow. More schema work for a capability nobody has asked for yet. | |

**User's choice:** Stateless, no staging table
**Notes:** Recommended option chosen without modification. Explicitly supersedes the CONCERNS.md staging-table sketch.

---

## Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse CreateClientSchema exactly | Same validation as single-client creation — no new rules invented for import. Keeps behavior consistent between single-add and bulk import. | ✓ |
| Add stricter per-country VAT format checks | New regex validation per country code beyond what single-add enforces today — inconsistent with the single-add path, not prompted by any bug/complaint. | |

**User's choice:** Reuse CreateClientSchema exactly
**Notes:** Recommended option chosen without modification.

---

## Claude's Discretion

- Exact modal step structure (single-step vs. small wizard) as long as preview-before-commit and report-after-commit both exist.
- Exact wording/formatting of per-row failure reasons (must be specific and actionable).
- Column order/header cell styling in the generated template (column set itself is locked).
- Preview table pagination/scroll behavior for large batches.

## Deferred Ideas

- Import history / view past imports — rejected via the staging-table question; no requirement asks for it.
- Retry-failed-rows flow — natural follow-up, not requested.
- Per-country VAT ID format validation — considered and rejected via the validation-strictness question.
- CSV import support — not discussed/requested; Excel (.xlsx) only per IMP-01's wording.
