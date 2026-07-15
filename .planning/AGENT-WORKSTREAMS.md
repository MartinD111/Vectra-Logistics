# Agent Workstreams: v5 Platform Foundation & Durable Execution

**Created:** 2026-07-15
**Purpose:** Assign focused Codex workstreams for the continuation plan without losing ownership boundaries.

## Active v5 Agents

| Agent | Ownership | First Deliverable |
|-------|-----------|-------------------|
| Lead Architect Agent | Roadmap reconciliation, ADR decisions, dependency gates, milestone acceptance | v5 ADR gap list and phase dependency review |
| Repo Auditor Agent | Apps/packages/services, migrations, public routes, queues, demo/stub inventory, baseline commands | `docs/architecture/current-state-truth-matrix.md` updates during Phase 27 |
| Backend Security Agent | `RequestContext`, capability checks, tenant hardening, signed public endpoints, credential safety | Security/tenancy design and pilot implementation in Phase 28 |
| Data/Event Agent | SQL migrations, event envelope, outbox, idempotency, dispatcher/worker behavior | `026_event_outbox.sql` or next verified migration in Phase 29 |
| Workspace UX Agent | Unified navigation/tree UX, sidebar replacement, page/record polish, manual UAT surfaces | v6 workspace hierarchy UI contract after v5 foundation |
| Programs/Automation Agent | Mini Program v3 contracts, workflow persistence, manual trigger/action registry, run logs | Persisted Workflow MVP in Phase 30 |
| Integration Agent | Outlook/webhook/polling connectors, credentials, sync cursors, capability status | Connector/capability audit feeding v7 |
| Logistics Vertical Agent | Inquiry to RFQ to shipment to driver/POD/invoice slice | v8 vertical-slice design after action/event contracts stabilize |
| QA/Release Agent | Cross-tenant tests, migration dry-runs, builds, smoke tests, release gates | Baseline build/test report and reusable tenant test harness |
| Docs/Ops Agent | ADRs, truth matrix, deployment docs, operator runbooks, capability matrix, archives | v4 closeout archives and v5 planning documentation |

## Coordination Rules

- Agents work in disjoint file scopes unless the Lead Architect explicitly merges ownership.
- All implementation packets preserve unrelated user changes and avoid rebuilding v1-v4 shipped surfaces.
- Every backend write packet must include tenant-scope tests or explicitly explain why the touched path is tenant-neutral.
- Event/outbox, workflow, and integration work must share one capability and idempotency model; no parallel action systems.
- App Store/package work remains blocked until the action/capability boundary is enforced.

