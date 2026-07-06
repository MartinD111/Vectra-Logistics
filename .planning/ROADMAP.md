# Roadmap: Vectra CRM Rework

**Core Value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.

**Granularity:** Standard (5-8 phases)

## Phases

- [ ] **Phase 1: Schema & CRM Domain Foundation** - Migrations for all new tables/columns and a dedicated `crm` API domain replace the fragmented `billing`-based CRM logic
- [ ] **Phase 2: CRM Dashboard, Navigation & Client Detail** - Sidebar renamed to CRM, dashboard lists clients, full client detail page with address/notes/employee/timeline, creatable from the project page canvas
- [ ] **Phase 3: Per-Project Client Overrides** - Clients attach to projects with field-level overrides layered over client-level defaults
- [ ] **Phase 4: Bulk Excel Import** - Template download, bulk upload, per-row report, default fallbacks
- [ ] **Phase 5: Email History Sync** - Real Microsoft Graph sent-mail sync matched to clients, rendered as "last 10 emails" on the detail page
- [ ] **Phase 6: Credit-Risk KPI Evaluator & Semaphore** - Risk evaluated as a first-class KPI rule; dispatcher sees a hard-blocking red "frosted glass" warning at assignment time

## Phase Details

### Phase 1: Schema & CRM Domain Foundation

**Goal**: All new persistence (schema) and a dedicated CRM API domain exist, so every later phase builds on stable ground instead of discovering schema gaps mid-implementation
**Depends on**: Nothing (first phase)
**Requirements**: API-01, API-02
**Success Criteria** (what must be TRUE):

  1. A dedicated `crm` API domain (controller/service/repository/routes) exists at `apps/api/src/domains/crm/`, separate from `billing`, exposing client CRUD, import, email history, and risk endpoints (even if some return stubs until later phases implement the logic)
  2. Frontend CRM components call a new `useCrm` hook instead of `useBilling` for client data
  3. New migrations exist (idempotent, `NNN_description.sql` convention) adding: `clients.address`, `clients.responsible_employee_id`, `clients.notes`; a client-project attachment/override table; `email_messages` table; and a resolution for `kpi_results.user_id` (e.g. nullable + new `client_id` column) so a client-subject KPI evaluator can write results
  4. Existing client list/credit-bar functionality (`CrmClientsBlock`) continues to work unchanged after the `useBilling` → `useCrm` swap (no regression)

**Plans:** 3 plans

Plans:

- [x] 01-01-PLAN.md — Schema migration (021_crm_extensions.sql): clients.address/responsible_employee_id, client_project_links, email_messages, kpi_results fix + run against dev DB
- [x] 01-02-PLAN.md — Dedicated crm API domain (types/dto/repository/service/controller/routes) mounted at /api/v1/crm
- [x] 01-03-PLAN.md — Frontend useCrm hook + crm.api.ts, swap CrmClientsBlock off useBilling

### Phase 2: CRM Dashboard, Navigation & Client Detail

**Goal**: Users have a dedicated CRM home — a dashboard of clients and a full detail page for each — replacing the never-built "Records" slot and the cramped in-project block as the primary way to work with client data
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, CLI-01, CLI-02, CLI-03, DET-01, DET-02, DET-03, DET-04
**Success Criteria** (what must be TRUE):

  1. User sees "CRM" (not "Records") in the left sidebar, linking to a dashboard at `/records` that lists all clients
  2. Clicking a client on the dashboard opens that client's detail page in a new browser tab
  3. On the detail page, user can view and edit the client's address, free-text notes, and assigned responsible employee
  4. The detail page shows the client's last 10 sent emails under a "current situation" section and a full timeline combining emails, billing/invoice events, and available chart data (email data appears once Phase 5 lands; timeline/section render correctly with empty state until then)
  5. User can create a new client's detail page directly from the existing Notion-like project page creator, not only from the CRM dashboard

**Plans:** 2/4 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — client_pages migration + crm domain backend (get-or-create page, timeline aggregation)
- [x] 02-02-PLAN.md — sidebar rename to CRM + full-page CRM dashboard (search, over-limit filter, add-client modal)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-03-PLAN.md — client detail page (sidebar inline-edit + block canvas: current situation, timeline)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-04-PLAN.md — "New client page" entry point in the project page creator

**UI hint**: yes

### Phase 3: Per-Project Client Overrides

**Goal**: A client serving multiple projects can have project-specific terms without losing its global defaults
**Depends on**: Phase 1, Phase 2 (detail page UI hosts the override settings)
**Requirements**: CLI-04, CLI-05
**Success Criteria** (what must be TRUE):

  1. User can attach a client to one or more projects
  2. User can override rate, responsible employee, and notes for a client on a specific project
  3. Changing a project-level override does not change the client's global (default) values, and other projects the client is attached to remain unaffected

**Plans**: TBD

### Phase 4: Bulk Excel Import

**Goal**: Users can onboard many clients at once instead of one-by-one, with clear visibility into what succeeded and failed
**Depends on**: Phase 1 (crm domain + schema), Phase 2 (dashboard as the natural entry point for import)
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04
**Success Criteria** (what must be TRUE):

  1. User can download an Excel import template with columns: name, country, VAT ID, address, responsible employee, credit limit, default rate
  2. User can upload a filled-in template and have clients created in bulk in one action
  3. After import, user sees a per-row report showing which rows were created vs. failed, with a reason for each failure
  4. Rows with blank credit limit or default rate are created successfully using system defaults (€10,000 limit) rather than failing

**Plans**: TBD

### Phase 5: Email History Sync

**Goal**: Client detail pages show real, current correspondence history without requiring a live fetch from Microsoft Graph on every page view
**Depends on**: Phase 1 (email_messages table, crm domain), Phase 2 (detail page UI slot for "last 10 emails")
**Requirements**: EML-01, EML-02, EML-03
**Success Criteria** (what must be TRUE):

  1. Sent-mail metadata is synced from any team member's connected Outlook mailbox via Microsoft Graph on a recurring basis
  2. Synced emails are correctly matched to the client whose email address/domain appears as a recipient
  3. The client detail page's "last 10 emails sent" section renders instantly from stored metadata (sender, recipients, subject, date, preview) without a live Graph call

**Plans**: TBD

### Phase 6: Credit-Risk KPI Evaluator & Semaphore

**Goal**: Dispatchers get a clear, unmissable visual warning before attempting to assign a load to an over-limit client, and the existing hard block remains the sole enforcement path
**Depends on**: Phase 1 (kpi_results schema fix, crm domain), Phase 2 (detail page can surface risk status)
**Requirements**: RSK-01, RSK-02, RSK-03
**Success Criteria** (what must be TRUE):

  1. A new KPI evaluator computes each client's credit-risk status (utilization vs. credit limit, plus payment history) as a first-class rule using the existing evaluator pattern, and results are queryable like other KPI results
  2. Dispatcher sees a red "frosted glass" visual warning at load-assignment time when the target client is over their credit limit
  3. Attempting to assign a load to an over-limit client is still hard-blocked (403), and the semaphore is confirmed to be reflecting — not replacing or duplicating — that existing enforcement

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema & CRM Domain Foundation | 0/? | Not started | - |
| 2. CRM Dashboard, Navigation & Client Detail | 2/4 | In Progress|  |
| 3. Per-Project Client Overrides | 0/? | Not started | - |
| 4. Bulk Excel Import | 0/? | Not started | - |
| 5. Email History Sync | 0/? | Not started | - |
| 6. Credit-Risk KPI Evaluator & Semaphore | 0/? | Not started | - |

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| NAV-01 | Phase 2 |
| NAV-02 | Phase 2 |
| API-01 | Phase 1 |
| API-02 | Phase 1 |
| CLI-01 | Phase 2 |
| CLI-02 | Phase 2 |
| CLI-03 | Phase 2 |
| CLI-04 | Phase 3 |
| CLI-05 | Phase 3 |
| DET-01 | Phase 2 |
| DET-02 | Phase 2 |
| DET-03 | Phase 2 |
| DET-04 | Phase 2 |
| IMP-01 | Phase 4 |
| IMP-02 | Phase 4 |
| IMP-03 | Phase 4 |
| IMP-04 | Phase 4 |
| EML-01 | Phase 5 |
| EML-02 | Phase 5 |
| EML-03 | Phase 5 |
| RSK-01 | Phase 6 |
| RSK-02 | Phase 6 |
| RSK-03 | Phase 6 |

**Coverage:** 23/23 v1 requirements mapped. No orphans.

---
*Roadmap created: 2026-07-05*
