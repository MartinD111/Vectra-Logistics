# Vectra CRM Rework

## What This Is

A dedicated CRM module inside the Vectra workspaces app, replacing the never-built "Records" sidebar slot. Today the CRM exists only as a `crm-clients` block embedded inside project pages — a client list with a credit-limit bar and an inline add-client form, nothing more. This rework gives clients a proper home: a CRM dashboard, full client detail pages (opened in a new tab), bulk Excel import, per-project overrides, real email history synced from Outlook, and a credit-risk semaphore wired into the KPI engine that hard-blocks dispatchers from assigning loads to over-limit clients.

## Core Value

Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.

## Requirements

### Validated

- ✓ `clients` and `invoices` tables exist with credit_limit/outstanding_balance tracking — existing (migration `019_crm_billing.sql`)
- ✓ Backend already 403s over-limit assignment attempts at the `pod_requests` level — existing
- ✓ CRM block renders client list with green/amber/red credit utilization bar — existing (`CrmClientsBlock.tsx`)
- ✓ Outlook OAuth integration with encrypted credential storage exists (calendar sync only, no message sync) — existing (`apps/api/src/domains/outlook/`)
- ✓ KPI engine exists with a pluggable evaluator pattern (activityVolume, outlookCalendar) — existing (`apps/api/src/domains/kpi/`)
- ✓ Notion-like project page canvas with a block registry (`PAGE_BLOCK_REGISTRY`) supports adding new block kinds — existing (`apps/workspaces/src/lib/projectPage/blocks.ts`)
- ✓ xlsx-based Excel parsing already used elsewhere in the app (`ExcelAutomationTool.tsx`) — existing, reusable
- ✓ Cross-app/new-tab link pattern (`target="_blank" rel="noopener noreferrer"`, `crossAppUrl` helper) — existing, reusable
- ✓ Schema foundation for the CRM rework exists: `clients.address`, `clients.responsible_employee_id`, `client_project_links` override table, `email_messages` table, `kpi_results.user_id` nullable + `client_id` column — Validated in Phase 1 (migration `021_crm_extensions.sql`)
- ✓ Dedicated `crm` API domain (controller/service/repository/routes/types/DTOs) exists at `apps/api/src/domains/crm/`, mounted at `/api/v1/crm`, separate from `billing` — Validated in Phase 1
- ✓ Frontend reads client data via `crm` domain (`useCrm.ts`/`crm.api.ts`) instead of `billing`; `CrmClientsBlock.tsx` behavior unchanged — Validated in Phase 1

### Active

- [ ] Sidebar "Records" nav item is renamed/repurposed to "CRM" at `/records`, becoming the CRM's dedicated home
- [ ] CRM dashboard lists all clients; clicking a client opens its detail page in a new tab
- [ ] Client detail page shows: address, notes, current situation (last 10 emails sent), full timeline (emails/charts/billing), settings
- [ ] Clients support an `address` field (new)
- [ ] Clients support assigning a responsible employee (new)
- [ ] Clients can be attached to one or more projects, with per-project overrides (e.g. rate, responsible employee, notes) layered over client-level defaults
- [ ] Mass import via Excel: downloadable template covering name, country, VAT ID, address, responsible employee, credit limit, default rate (optional columns, blank falls back to system defaults)
- [ ] Client pages are creatable from the existing Notion-like page creator (project page canvas), not just from the CRM dashboard
- [ ] Real Microsoft Graph email sync: fetch sent mail matching a client's email/domain from any team member's connected mailbox, store in a new messages table, show "last 10 emails sent" per client
- [ ] Credit-limit/payment-history risk is evaluated as a first-class KPI evaluator in the existing KPI engine (not an ad-hoc computed flag)
- [ ] Risk semaphore renders as a red "frosted glass" visual warning to dispatchers at load-assignment time when a client is over their credit limit
- [ ] Over-limit assignment attempts remain a hard block (matches existing 403 behavior) — the semaphore is the visual explanation of an already-enforced block, not a new override path

### Out of Scope

- Inbound email reply tracking / two-way email threading — only outbound "sent to client" history requested
- Automated dunning / collections workflows — not requested, would need its own design pass
- Multi-currency invoicing — existing invoices are EUR-only; not part of this rework
- Manager override for over-limit assignment — explicitly rejected in favor of matching the existing hard 403 block

## Context

- Monorepo: `apps/workspaces` (Next.js, tenant-facing app), `apps/api` (backend domains), `apps/cmr` (separate CMR app). See `.planning/codebase/` for full architecture, stack, and conventions docs.
- No ORM — raw idempotent SQL migrations in `database/migrations/`.
- Outlook integration currently syncs calendar events only (`calendar_events` table via Graph categories); no message/email storage exists anywhere in the codebase today. This is genuinely new integration work, not an extension of an existing sync job.
- KPI engine evaluators are currently team/activity-focused (activity volume, calendar). A client-risk evaluator is a new evaluator *type*, following the established pattern but on a different subject (clients, not team members).
- Project pages (the Notion-like canvas) are currently scoped to `project_id` via the `project_pages` table. Making client pages creatable from this canvas requires either a client-scoped pages table or modeling clients so the existing canvas can attach to them — an open design question for the roadmap/planning phase.
- "Per-project client settings" means: a client has global defaults (address, default rate, notes, responsible employee), and each project the client is attached to can override specific fields for that project only.

## Constraints

- **Existing 403 behavior**: The backend already blocks over-limit assignments at the API level — the new semaphore must visually reflect this, not introduce a second enforcement path — Why: avoid duplicate/conflicting business logic between old and new code.
- **No ORM**: All schema changes go through new idempotent SQL migration files following the existing `NNN_description.sql` convention — Why: matches established project convention, no Prisma/ORM in use.
- **Reuse over rebuild**: Excel import should reuse the existing `xlsx` package/pattern from `ExcelAutomationTool.tsx`; new-tab navigation should reuse `crossAppUrl`/existing link patterns — Why: consistency, less new surface area.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Repurpose "Records" sidebar slot → "CRM" at `/records` | That nav slot was never built out; avoids adding a second nav item | — Pending |
| Client detail pages open in a new tab | Matches existing app-wide pattern for entity detail views | — Pending |
| Real Microsoft Graph email sync (not stubbed) | Outlook OAuth integration already exists; delivers real value now rather than a placeholder | — Pending |
| Credit-risk semaphore is a KPI evaluator, not an ad-hoc flag | Matches existing extensible KPI engine architecture; reusable/configurable later | — Pending |
| Over-limit block remains hard, no override | Matches existing enforced 403 behavior; user explicitly rejected a manager-override path | — Pending |
| Per-project client settings are field-level overrides over client-level defaults | Clients can serve multiple projects with different terms (e.g. different rate per project) | — Pending |
| Email matching is by recipient address/domain across any team member's mailbox | No per-user mailbox scoping model exists today; broadest match is simplest and most useful | — Pending |
| Excel import template includes credit limit & default rate as optional columns | Avoids a manual follow-up pass for every imported client; blank falls back to system default | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 — Phase 1 (schema-crm-domain-foundation) complete*
