# Milestones

## v2.0 Workspace Engine — Engine Unification (Shipped: 2026-07-12)

**Phases completed:** 7 phases, 8 plans, 10 tasks
**Timeline:** 2026-07-06 → 2026-07-12 (6 days) · 47 files changed, +4584/-1021 lines

**Key accomplishments:**

- Added a generic `WorkspaceBlockRegistry` + `WorkspaceBlockPlugin` contract (native code + manifest/sandboxed flavors) and an exhaustive `pageBlockRegistry` over all 30 `PageBlockKind`s, enforced at compile time
- Replaced `PageBlockView`'s 30-case switch with registry dispatch and `LivePageCanvas`'s edit-mode switch with `pageBlockRegistry.renderEditor` — both hand-maintained page switches eliminated with zero behavior change
- Replaced Mini Program's `BlockView` 15-case switch with `miniProgramBlockRegistry.render`, an instance of the same `WorkspaceBlockRegistry` class pages use — proving one genuinely shared engine, not parallel copies
- Extracted a shared `buildPaletteItems(registry)` helper so the page slash menu and mini-program add-menu both derive their palettes from registry data
- Proved the core extensibility promise end-to-end: added a native `callout` block via one plugin entry (3 files touched, zero dispatch edits) and a manifest `rowCountCallout` plugin via the declarative path (zero new vocabulary, zero dispatch edits)
- Closed out the milestone with `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` (engine contract, native/manifest split, `keyOf` seam, package-promotion path) and confirmed the automations `WorkflowBuilder.tsx` remains untouched and explicitly parked as a deferred future migration target

**Known deferred items at close:** Milestone audit (`.planning/v2.0-MILESTONE-AUDIT.md`) found all 14/14 requirements satisfied and cross-phase wiring fully confirmed, but flagged tech debt: Phases 7-11 are missing formal `VERIFICATION.md` (never run after execution, though independently re-confirmed wired by the audit's integration check), and REQUIREMENTS.md checkboxes are stale for 8 of 14 requirements as a result. No functional gaps — backfill via `/gsd:validate-phase` per phase if desired. Also carrying forward v1.0's 4 pre-existing deferred items (7 human-UAT scenarios + 2 verification sign-offs, Phase 02/03) — see STATE.md → Deferred Items.

---

## v3.0 On-Premise GA (Queued)

**Plan:** [milestones/v3.0-on-premise-ga.md](milestones/v3.0-on-premise-ga.md) — 7 phases, 17 requirements, derived from the `docs/specs/deployment/*` specs + `ai-integration.md` §6.1.

**Goal:** Ship Vectra as a first-class On-Premise deployment of the same codebase — migration runner, production compose, installer/first-run, `DEPLOYMENT_MODE`, backend-side local Gemma, release versioning + upgrade procedure, and the committed-secret/hardening fixes that also help Cloud. Activate after v2.0 closes (see plan → Activation).

---

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
