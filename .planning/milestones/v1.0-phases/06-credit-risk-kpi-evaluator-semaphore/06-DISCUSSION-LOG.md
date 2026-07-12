# Phase 6: Credit-Risk KPI Evaluator & Semaphore - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 6-credit-risk-kpi-evaluator-semaphore
**Areas discussed:** Payment history definition, KPI targeting/storage, Semaphore UI location & timing, Stale hook fix, Evaluation trigger cadence

---

## Payment History Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Any overdue invoice | Client has ≥1 invoice with status 'approved' (unpaid) and due_at passed — simple boolean, no new schema | ✓ |
| Overdue count/ratio threshold | Count overdue invoices vs total; flag above a ratio threshold | |
| Utilization only, defer payment history | Ship RSK-01 with only credit_limit/outstanding_balance; treat payment history as v2 | |

**User's choice:** Any overdue invoice (Recommended)
**Notes:** Matches the only real signal in the schema (invoices.due_at vs paid_at); no new columns needed.

---

## KPI Targeting & Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Add target_client_id + client-shaped upsert | New migration adds kpi_rules.target_client_id (nullable, mirrors target_user_id/target_project_id); upsertResult() gets a client-shaped path | ✓ |
| Reuse target_project_id, resolve clients via project links | No schema change; evaluator resolves clients attached to the targeted project via client_project_links | |

**User's choice:** Add target_client_id + client-shaped upsert (Recommended)
**Notes:** Reusing target_project_id would conflate "which project" with "which client" and doesn't fit a company-wide credit policy. kpi_results.client_id already exists from Phase 1 — only kpi_rules needs a new column.

---

## Semaphore UI

| Option | Description | Selected |
|--------|-------------|----------|
| Warn inline in the assign form before submit | Show red frosted-glass banner client-side as soon as an over-limit client is selected in the dropdown, before Create is clicked | ✓ |
| Only show it after the 403 comes back | Keep current flow; just restyle the existing on-submit error message | |

**User's choice:** Warn inline in the assign form before submit (Recommended)
**Notes:** PodTrackerBlock.tsx is the only load-assignment UI found. The 403 remains the actual enforcement; this is a pre-submit UX layer on top, computed from data already available via useClients.

---

## Stale Hook Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix it as part of this phase | Swap PodTrackerBlock.tsx's useClients import from useBilling to useCrm while adding the semaphore | ✓ |
| Leave it, note as separate cleanup | Keep phase strictly scoped; log the swap as deferred cleanup | |

**User's choice:** Fix it as part of this phase (Recommended)
**Notes:** Same file is already being edited for the semaphore; avoids leaving a known-stale reference (flagged in PROJECT.md as something Phase 1 should have caught) untouched.

---

## Evaluation Trigger Cadence

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand only, matching existing evaluators | No new scheduler; runs via existing POST /kpi/evaluate, same as activityVolume/outlookCalendar | ✓ |
| Add a recurring BullMQ job for KPI evaluation | New scheduled sweep (15-60 min) running runEvaluation for all active rules | |

**User's choice:** On-demand only, matching existing evaluators (Recommended)
**Notes:** No existing evaluator has a scheduler today (unlike email/telematics sync). The semaphore doesn't depend on kpi_results freshness anyway — it reads live credit_limit/outstanding_balance directly, so evaluator cadence is orthogonal to the dispatcher-facing block.

---

## Claude's Discretion

- Exact frosted-glass CSS treatment (backdrop-blur + red tint) — match existing dark/light mode conventions in CrmClientsBlock.tsx
- Exact evaluator `detail` payload shape — follow existing evaluators' small JSON-serializable object pattern
- Resolution behavior when target_client_id is null on a rule (company-wide vs. no-op) — follow the existing resolveTargetUsers-style pattern for consistency

## Deferred Ideas

None — discussion stayed within phase scope.
