# Requirements: Vectra CRM Rework

**Defined:** 2026-07-05
**Core Value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.

## v1 Requirements

### Navigation

- [ ] **NAV-01**: User sees "CRM" (not "Records") in the left sidebar, linking to the CRM dashboard at `/records`
- [ ] **NAV-02**: User can click a client on the CRM dashboard and the client's detail page opens in a new browser tab

### CRM API Domain

- [ ] **API-01**: A dedicated `crm` API domain exists (controller/service/repository/routes) separate from `billing`, exposing client CRUD, import, email history, and risk endpoints
- [ ] **API-02**: Frontend CRM components call a `useCrm` hook (not `useBilling`) for client data

### Client Record

- [ ] **CLI-01**: User can view and edit a client's address
- [ ] **CLI-02**: User can view and edit free-text notes on a client
- [ ] **CLI-03**: User can assign a responsible employee to a client
- [ ] **CLI-04**: User can attach a client to one or more projects
- [ ] **CLI-05**: User can override rate, responsible employee, and notes for a client on a specific project, without changing the client's global defaults

### Client Detail Page

- [ ] **DET-01**: User can open a client's detail page showing address, notes, settings, and assigned responsible employee
- [ ] **DET-02**: User can view the client's last 10 sent emails ("current situation") on the detail page
- [ ] **DET-03**: User can view a full timeline combining emails, billing/invoice events, and (where available) chart data for the client
- [ ] **DET-04**: User can create a client's detail page from the existing Notion-like page creator (project page canvas), not only from the CRM dashboard

### Bulk Import

- [ ] **IMP-01**: User can download an Excel import template with columns: name, country, VAT ID, address, responsible employee, credit limit, default rate
- [ ] **IMP-02**: User can upload a filled-in template and have clients created in bulk
- [ ] **IMP-03**: User sees a per-row import report (created / failed, with reason) after import, so partial failures are visible
- [ ] **IMP-04**: Blank credit limit / default rate columns in the import fall back to system defaults (€10,000 limit) rather than failing the row

### Email History

- [ ] **EML-01**: The system syncs sent-mail metadata from any team member's connected Outlook mailbox via Microsoft Graph
- [ ] **EML-02**: Synced emails are matched to a client by recipient email address/domain
- [ ] **EML-03**: Email sync stores metadata (sender, recipients, subject, date, preview) needed to render "last 10 emails sent" without re-fetching from Graph on every page view

### Risk Semaphore

- [ ] **RSK-01**: A new KPI evaluator computes each client's credit-risk status (utilization vs. credit limit, plus payment history) as a first-class KPI rule, following the existing evaluator pattern
- [ ] **RSK-02**: Dispatcher sees a red "frosted glass" visual warning when attempting to assign a load to a client that is over their credit limit
- [ ] **RSK-03**: Over-limit assignment attempts remain hard-blocked (existing 403 behavior preserved) — the semaphore explains an enforced block, it does not introduce a new override path

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Risk Trends

- **RSKV2-01**: Historical credit-risk trend charts per client (week-over-week utilization change)
- **RSKV2-02**: Proactive alerts when a client is trending toward over-limit before they cross it

### Email Integration Depth

- **EMLV2-01**: Two-way email threading (inbound replies, not just sent mail)
- **EMLV2-02**: Per-user mailbox scoping for email matching (currently: any team member's mailbox counts)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Inbound email reply tracking / two-way threading | Only outbound "sent to client" history requested; two-way threading is materially more complex (thread reconciliation, read receipts) |
| Automated dunning / collections workflows | Not requested; would need its own requirements/design pass |
| Multi-currency invoicing | Existing invoices are EUR-only; out of scope for this rework |
| Manager override for over-limit assignment | Explicitly rejected — matches existing hard 403 block, no override path |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 2 | Pending |
| NAV-02 | Phase 2 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| CLI-01 | Phase 2 | Pending |
| CLI-02 | Phase 2 | Pending |
| CLI-03 | Phase 2 | Pending |
| CLI-04 | Phase 3 | Pending |
| CLI-05 | Phase 3 | Pending |
| DET-01 | Phase 2 | Pending |
| DET-02 | Phase 2 | Pending |
| DET-03 | Phase 2 | Pending |
| DET-04 | Phase 2 | Pending |
| IMP-01 | Phase 4 | Pending |
| IMP-02 | Phase 4 | Pending |
| IMP-03 | Phase 4 | Pending |
| IMP-04 | Phase 4 | Pending |
| EML-01 | Phase 5 | Pending |
| EML-02 | Phase 5 | Pending |
| EML-03 | Phase 5 | Pending |
| RSK-01 | Phase 6 | Pending |
| RSK-02 | Phase 6 | Pending |
| RSK-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

## Known Technical Constraints (from codebase concerns audit)

These aren't requirements, but constrain how the roadmap should sequence work — see `.planning/codebase/CONCERNS.md` for full detail:

- `kpi_results.user_id` is currently `NOT NULL` — a client-subject risk evaluator cannot write results under the existing schema as-is. Needs either a nullable `user_id` + new `client_id` column on `kpi_results`, or another resolution — this must be an explicit early decision in planning, not discovered mid-implementation. **Resolved in roadmap: addressed in Phase 1 (Schema & CRM Domain Foundation), ahead of Phase 6's risk evaluator.**
- No `email_messages` table exists yet — required before any email sync work can start. **Resolved in roadmap: table created in Phase 1, ahead of Phase 5 (Email History Sync).**
- No dedicated `crm` API domain exists yet — CRM logic currently lives in `billing`. Should be established early since most other v1 requirements depend on it. **Resolved in roadmap: established in Phase 1, ahead of all feature phases.**
- `integration_credentials` table has no formal migration (schema drift risk) — worth fixing incidentally if touching Outlook integration code.
- Outlook calendar sync lacks Graph pagination handling — not required for this project, but the new email sync work should not repeat this mistake.

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after roadmap creation*
