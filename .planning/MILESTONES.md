# Milestones

## v1.0 CRM Rework (Shipped: 2026-07-06)

**Phases completed:** 6 phases, 15 plans, 33 tasks

**Key accomplishments:**

- "Linked Projects" section on the client detail page: searchable attach picker, collapsed per-project cards with an override-count badge, and three independently toggleable rate/employee/notes override editors following the D-04 grey-italic-vs-primary-accent visual contract.
- Domain-based email-to-client matcher with free-mail denylist, composite-unique email_messages migration, and upsert repository — the building blocks syncEmails() (plan 02) will call
- syncEmails() Graph orchestration with pagination and domain-based client matching, wired into a 15-minute BullMQ repeatable job started at API bootstrap
- credit_risk KPI evaluator computing utilization + overdue-invoice risk per client, with kpi_rules.target_client_id and a real (non-stub) GET /crm/clients/:id/risk response
- Red frosted-glass warning in the load-assignment form, shown the instant an over-limit client is selected, plus a fix for a stale pre-Phase-1 hook import

**Known deferred items at close:** 4 (see STATE.md → Deferred Items) — 7 pending human-UAT scenarios (Phase 02/03) and 2 verification sign-offs, all manual checks on shipped CRM features.

---
