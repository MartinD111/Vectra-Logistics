# Phase 1: Schema & CRM Domain Foundation - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

All new persistence (migrations) and a dedicated `crm` API domain exist, so every later phase (2-6) builds on stable ground instead of discovering schema gaps mid-implementation. No user-facing UI in this phase — that's Phase 2 onward. Scope: `clients.address`/`notes`/`responsible_employee_id` columns, a client-project override join table, `email_messages` table, a resolution for the `kpi_results.user_id NOT NULL` constraint, and the `crm` API domain (controller/service/repository/routes) replacing scattered `billing`-based CRM logic.

</domain>

<decisions>
## Implementation Decisions

### Client-Project Override Storage
- **D-01:** Overrides are stored in a new join table with explicit typed columns (e.g. `client_project_links(client_id, project_id, override_rate_eur, override_responsible_employee_id, override_notes)`) — not a JSONB blob. Matches the existing raw-SQL, explicit-column convention used by `clients`/`invoices` (migration `019_crm_billing.sql`).
- **D-02:** Fallback from a blank override to the client's global default is resolved in the service layer (`crm.service.ts`), not via `COALESCE` in SQL. Repository returns raw override + global values; service merges (`override ?? global`) before returning to the frontend. Keeps SQL simple and fallback logic testable in one place.

### Claude's Discretion
The user chose not to deep-dive these — decide based on codebase conventions and the fix-approaches already sketched in `.planning/codebase/CONCERNS.md`:
- **`kpi_results.user_id` NOT NULL fix**: how to let a client-subject risk evaluator write results (e.g. nullable `user_id` + new `client_id` column, or another approach). This must be resolved in this phase since Phase 6 depends on it.
- **billing → crm migration strategy**: whether to move client-related code from `billing` wholesale into the new `crm` domain, or have `crm` wrap `billing` (billing keeps invoicing, crm owns clients). CONCERNS.md recommends moving client operations out of `billing` into `crm`, keeping `billing` focused on settlements/invoicing only.
- **`email_messages` table shape**: exact columns/granularity (full body vs. preview-only storage, retention). CONCERNS.md already sketches a concrete schema (sender, recipients, subject, body_preview, full_body, received_at, outlook_id, synced_at) — use that as the starting point unless research surfaces a reason to diverge.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing schema & domain patterns
- `database/migrations/019_crm_billing.sql` — existing `clients`/`invoices` tables, column conventions, idempotent migration style to follow
- `database/migrations/008_kpi_rules.sql` — existing `kpi_rules`/`kpi_results` schema; `kpi_results.user_id` is `NOT NULL` (line 33) — the constraint that must be resolved in this phase
- `.planning/codebase/STRUCTURE.md` §"New Domain (Clean separation)" (lines 334-340) — exact scaffold pattern for a new API domain (`{domain}.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.types.ts`, `dto/`, mounted in `domains/index.ts`)
- `.planning/codebase/ARCHITECTURE.md` — DDD domain pattern (controller → service → repository), Zod validation, `AppError` error handling, multi-tenancy via `companyId` scoping

### Known concerns & fix approaches already sketched
- `.planning/codebase/CONCERNS.md` §"No Dedicated CRM Domain" (lines 51-76) — current fragmentation across `billing`/`outlook`, missing CRM API surface
- `.planning/codebase/CONCERNS.md` §"Email Message Storage Table Missing" (lines 134-172) — concrete `email_messages` schema sketch to use as a starting point
- `.planning/codebase/CONCERNS.md` §"KPI-CRM Credit Limit Risk Integration Undefined" (lines 176-197) — sketch of a `credit_risk` KPI evaluator/rule approach
- `.planning/codebase/CONCERNS.md` §"Missing Excel Bulk Import" (lines 406-440) — staging table sketch (relevant context for Phase 4, but the `crm` domain scaffolded here should anticipate this)
- `.planning/codebase/CONCERNS.md` §"CrmClientsBlock Tightly Coupled to Billing API" (lines 251-264) — the `useBilling` → `useCrm` hook rename this phase must enable

### Project-level requirements
- `.planning/PROJECT.md` — full project context and decisions log
- `.planning/REQUIREMENTS.md` §"Known Technical Constraints" (bottom of file) — explicit note that the `kpi_results.user_id` fix must be an early decision, not discovered mid-implementation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workspaces/src/lib/hooks/useBilling.ts` — existing `useClients`/`useCreateClient` hooks and `CrmClient` type; logic to migrate into a new `useCrm.ts` hook (API-02)
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` — existing client list UI (credit bar, add-client form) to keep working unchanged through the `useBilling` → `useCrm` swap (regression check for this phase)
- `apps/api/src/domains/kpi/evaluators/` (activityVolume, outlookCalendar) — existing evaluator pattern to model the future client-risk evaluator on (built in Phase 6, but the `kpi_results` schema fix in this phase must accommodate it)

### Established Patterns
- DDD domain layout: every domain is `controller.ts` → `service.ts` → `repository.ts` + `types.ts` + `dto/` (Zod schemas), mounted in `apps/api/src/domains/index.ts`
- All raw SQL migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), versioned `NNN_description.sql`, no ORM
- Multi-tenancy: every table/query scoped by `company_id`; ownership/authorization checks in the service layer

### Integration Points
- New `crm` domain mounts at `/api/v1/crm/*` alongside existing `/api/v1/billing/*`, `/api/v1/kpi/*`
- Frontend: `apps/workspaces/src/lib/hooks/useCrm.ts` (new) replaces `useBilling` imports in CRM-related components
- `pod_requests.client_id` (existing column from migration 019) is the eventual hook point for Phase 6's assignment-blocking risk check — no change needed in this phase, just awareness

</code_context>

<specifics>
## Specific Ideas

No specific product references beyond what's in PROJECT.md/REQUIREMENTS.md — this phase is foundational/infrastructural, not user-facing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-schema-crm-domain-foundation*
*Context gathered: 2026-07-05*
