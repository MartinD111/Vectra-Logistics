# Current-State Truth Matrix

**Created:** 2026-07-15
**Source:** `Vectra_Codex_Implementation_Roadmap.md`, current `.planning/` state, and repository inspection.

## Imported Roadmap Phase Mapping

| Imported phase | Current repo status | Evidence | v5 decision |
|----------------|---------------------|----------|-------------|
| Phase 0: repository truth, ADRs, executable baseline | Partial | `.planning/codebase/*`, existing ROADMAP/PROJECT state, package scripts, migrations exist; no consolidated imported-roadmap matrix yet | Reopen as Phase 27 baseline truth |
| Phase 1: security, tenancy, deployment | Partial | v3 shipped secret hardening, migration runner, deployment mode, CORS/rate limits; no single typed `RequestContext` or complete tenant test harness yet | Continue as Phase 28 security/tenancy |
| Phase 2: unified workspace hierarchy | Absent/partial | Folders/projects/pages/programs exist, but no unified node projection/tree for every artifact | Defer to v6 after v5 foundation |
| Phase 3: page/collaboration engine | Partial | v2 registry and v4 content blocks shipped; comments/revisions/search/collaboration still incomplete | Defer until hierarchy and events are stable |
| Phase 4: canonical records engine | Partial/shipped foundation | v4 added records/views model and UI; formulas, rollups, record history, permissions, import/export remain future | Extend after event/permission model |
| Phase 5: Mini Programs v3 | Partial | v2 shared engine exists; runtime remains largely browser-local | Defer to v7 after workflow/action contracts |
| Phase 6: durable automation engine | Mostly absent | `WorkflowBuilder.tsx` is parked/demo; no durable workflow schema/runs | Start MVP in Phase 30 |
| Phase 7: integration platform/actions | Partial | Outlook and webhooks exist in domain-specific form; connector lifecycle/capability model incomplete | Defer to v7 after v5 actions/events |
| Phase 8: shipment/procurement backbone | Partial | Marketplace, inbox, LTL, POD, billing pieces exist but not one canonical shipment/RFQ lifecycle | Defer to v8 vertical slice |
| Phase 9: CMR/PWA/POD/billing closure | Partial | CMR app and POD/billing domains exist; lifecycle is not fully unified | Defer to v8 vertical slice |
| Phase 10: fleet/telematics/dispatch | Partial/demo | Fleet, exceptions, telematics paths exist with demo/stub behavior | Defer until integration platform |
| Phase 11: routing/delivery | Partial/demo | Routes UI and matching service exist; deterministic route planning contract not complete | Defer after fleet/integration maturity |
| Phase 12: module/app store | Premature | Plugin seams exist, but install/capability lifecycle not enforced | Blocked until action/capability boundary |
| Phase 13: on-prem productization | Partial/shipped foundation | v3 shipped installer, migration runner, deployment docs; offline licensing/backup/support bundle incomplete | Continue later as operations milestone |
| Phase 14: scale/reliability/commercial readiness | Partial | Health checks and release docs exist; SLOs/metrics/chaos/retention incomplete | Continuous, becomes release gate later |

## Current Shipped Spine

- v1 CRM Rework: dedicated CRM, client detail pages, Excel import, Outlook sent-mail sync, per-project overrides, credit-risk KPI semaphore.
- v2 Workspace Engine: shared registry powering pages and mini programs, native and manifest plugin paths, extensibility documentation.
- v3 On-Premise GA: deployment mode, migration runner, installer, local AI dispatch, production compose, release/upgrade docs, health hardening.
- v4 Workspace Records & Views: records API, record detail pages, collection-view block, board/table/list/calendar/gallery/timeline views.

## Immediate v5 Risks

- Tenant isolation is implemented by convention in many domains, but lacks a shared cross-tenant test harness.
- `activity_events` exists, but service writes are not yet backed by a durable outbox/dispatcher.
- Automations are still a UI/demo surface rather than a persisted workflow runtime.
- Public/integration endpoints need a unified signed/keyed framework before more connectors are added.
- Demo/stub behavior needs a single explicit capability/demo-mode story so production cannot synthesize operational data silently.
- Legacy `/api/shipments` and `/api/capacity` appear unauthenticated and accept caller-supplied `user_id`; Phase 28 should quarantine or migrate them.
- Code references `integration_credentials`, `api_credentials`, `internal_api_keys`, `vehicle_locations`, and `assignment_scores` without a complete visible migration trail; Phase 27 should verify schema truth before Phase 28/29 changes.
- Matching worker and FastAPI matching-engine route contracts disagree (`/api/predict` vs `/match`/`batch-match`/`ltl-match`); durable job work should not build on that contract until reconciled.
- `telematics.worker.ts` exists but is not started/scheduled from API bootstrap; telematics capability status should be honest until real adapter execution is wired.

## Agent Findings Snapshot

- **Repo Auditor Agent:** confirmed apps/packages/services inventory, current `/api/v1` domains, legacy route surfaces, migration range `002`-`025`, BullMQ workers, and major demo/stub candidates in matching, LTL, yard, fleet/telematics, Outlook demo mode, inbox, document AI, CMR generation, and marketplace UI.
- **Backend Security Agent:** confirmed auth context lives in `core/auth`, no outbox exists, `activity_events` is best-effort, public endpoints are mixed, legacy shipment/capacity routes are risky, and credential schemas are split.
- **Programs/Automation Agent:** confirmed programs persist config but not runs, automations dashboard/builder are static/browser-local, notifications are persisted and can be reused for the first workflow action, and server-owned workflow run tables/API should come before broader automation work.
