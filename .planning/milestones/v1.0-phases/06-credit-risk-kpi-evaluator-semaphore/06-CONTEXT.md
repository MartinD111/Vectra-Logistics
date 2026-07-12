# Phase 6: Credit-Risk KPI Evaluator & Semaphore - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Two connected deliverables:
1. A new `credit_risk` KPI evaluator (following the existing pluggable evaluator pattern in `apps/api/src/domains/kpi/evaluators/`) that computes each client's risk status — credit utilization vs. limit, plus overdue-invoice payment history — and writes queryable `kpi_results` rows scoped to a client (not a user).
2. A dispatcher-facing red "frosted glass" visual warning in the load-assignment UI, shown when the selected client is over their credit limit — reflecting the existing hard 403 block (`invoicingService.assertCreditOk()` in `apps/api/src/domains/billing/invoicing.service.ts`, called from `apps/api/src/domains/pod/pod.service.ts`'s `create()`), never replacing or duplicating it.

</domain>

<decisions>
## Implementation Decisions

### Payment History Definition
- **D-01:** "Bad payment history" = the client has one or more invoices with `status = 'approved'` (i.e. unpaid) and `due_at` in the past. A simple boolean/count overdue-invoice check — no new schema, no ratio/threshold tuning. This is the only invoice-lifecycle signal that exists (`invoices.due_at` vs `paid_at`), and it's what a dispatcher could already see on the invoices dashboard.

### KPI Targeting & Storage
- **D-02:** Add `kpi_rules.target_client_id` (nullable UUID, same shape as existing `target_project_id`/`target_user_id`) via a new idempotent migration. The credit-risk rule targets clients this way, not projects or users.
- **D-03:** `KpiRepository.upsertResult()` needs a client-shaped path: either extend its input to accept `client_id` alongside `user_id` (both optional, exactly one populated — matches the existing `kpi_results_subject_check` CHECK constraint from migration 021), or add a parallel method. `kpi_results.client_id` and the nullable `user_id` already exist from Phase 1 — this phase does not need further schema changes to `kpi_results` itself, only to `kpi_rules`.
- **D-04:** `KpiEvaluatorOutput`/`KpiResult` types currently type `user_id: string` (non-nullable) even though the DB column is nullable — this needs fixing so a client-subject evaluator can produce a well-typed output shape (`user_id: string | null`, `client_id: string | null`).
- **D-05:** No new evaluator trigger/scheduler. The credit-risk rule runs on-demand exactly like `activityVolume` and `outlookCalendar` — via the existing `POST /kpi/evaluate` (`kpiService.runEvaluation`). No BullMQ job is introduced for KPI evaluation. The semaphore itself does NOT depend on `kpi_results` freshness — it reads live `credit_limit`/`outstanding_balance` directly (see D-07), so evaluator cadence doesn't affect the dispatcher-facing block at all.

### Semaphore UI
- **D-06:** The load-assignment surface is `apps/workspaces/src/components/projectPage/PodTrackerBlock.tsx` — the client `<select>` dropdown at its "+ Request" form. This is the only load-assignment UI in the app; no other component creates POD requests with a `client_id`.
- **D-07:** Show the frosted-glass red warning **inline in the form, before submit** — as soon as an over-limit client is selected in the dropdown, computed client-side from data already available via `useClients` (credit_limit/outstanding_balance, same numbers `CrmClientsBlock.tsx`'s `CreditBar` already uses). This is a pre-submit UX improvement layered on top of the existing 403, not a replacement — the backend `assertCreditOk()` 403 remains the sole enforcement path and still fires on submit if bypassed client-side.
- **D-08:** Restyle the existing on-submit error (`create.isError` block, currently plain red text) to also use the frosted-glass treatment for consistency, so both the pre-submit warning and the post-403-failure message look like the same semaphore, not two different error styles.

### Stale Hook Fix (folded into this phase)
- **D-09:** `PodTrackerBlock.tsx` currently imports `useClients` from `apps/workspaces/src/lib/hooks/useBilling.ts` (the pre-Phase-1 hook) instead of `apps/workspaces/src/lib/hooks/useCrm.ts`. Since this phase is already editing this exact file to add the semaphore, swap the import to `useCrm`'s `useClients` as part of this work — avoids leaving a known-stale reference in the one place being touched anyway. Verify `useCrm`'s `CrmClient` type shape matches what the form needs (id, name, country, credit_limit, outstanding_balance, default_rate_eur) before swapping.

### Claude's Discretion
- Exact frosted-glass CSS treatment (backdrop-blur + red tint) — no specific visual reference given beyond "red frosted glass warning" from REQUIREMENTS.md; match the app's existing dark/light mode conventions (see `CrmClientsBlock.tsx`'s existing amber/red utilization styling for a starting palette).
- Exact evaluator `detail` payload shape (e.g. whether to include the overdue invoice count/list) — follow the existing evaluators' pattern of a small JSON-serializable object.
- Whether `target_client_id`-targeted rules apply company-wide (all clients) when `target_client_id` is null, mirroring how `target_user_id`/`target_project_id` are both optional today (a rule with all-null targets currently resolves to an empty user list in evaluators) — Claude should decide the most consistent resolution given the existing `resolveTargetUsers`-style pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing enforcement (must not duplicate)
- `apps/api/src/domains/billing/invoicing.service.ts` (`assertCreditOk`, lines 67-79) — the existing hard 403 credit-limit guardrail; the semaphore must visually reflect this, not introduce a second enforcement path
- `apps/api/src/domains/pod/pod.service.ts` (`create`, lines 48-64) — the only call site of `assertCreditOk`; this is where load assignment happens

### KPI evaluator pattern to follow
- `apps/api/src/domains/kpi/evaluators/types.ts` — `KpiEvaluator` interface
- `apps/api/src/domains/kpi/evaluators/activityVolume.evaluator.ts` — reference implementation of a real (non-stub) evaluator
- `apps/api/src/domains/kpi/evaluators/index.ts` — evaluator registry (`REGISTRY` map keyed by `sourceType`)
- `apps/api/src/domains/kpi/kpi.types.ts` — `KpiRule`, `KpiResult`, `KpiEvaluatorOutput` types (need `target_client_id` / nullable `user_id`+`client_id` additions per D-02/D-04)
- `apps/api/src/domains/kpi/kpi.repository.ts` — `upsertResult()` (needs client-shaped variant per D-03), `listResults()`/`listResultsWithRuleInfo()` (may need a `clientId` filter alongside existing `userId`/`projectId` filters for RSK-01's "queryable" requirement)
- `apps/api/src/domains/kpi/kpi.service.ts` — `runEvaluation()`, `assertOwnedRule()` pattern (will need an `assertOwnedClient` sibling to `assertOwnedProject`/`assertOwnedUser` if `target_client_id` validation is added)

### Schema
- `database/migrations/021_crm_extensions.sql` (lines 56-69) — `kpi_results.user_id` made nullable, `client_id` column added, `kpi_results_subject_check` CHECK constraint (`user_id IS NOT NULL OR client_id IS NOT NULL`) — already satisfies this phase's storage needs; only `kpi_rules.target_client_id` is new

### Semaphore UI
- `apps/workspaces/src/components/projectPage/PodTrackerBlock.tsx` — the file to edit; client dropdown at lines 72-76, error display at lines 82-84
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` (`CreditBar`, lines 17-37) — existing reference implementation of the amber/red utilization visual logic to reuse/extend for the semaphore's over-limit detection
- `apps/workspaces/src/lib/hooks/useCrm.ts` — the correct hook to import (replacing the stale `useBilling` import per D-09)
- `apps/workspaces/src/lib/api/crm.api.ts` — `CrmClient` type shape to confirm compatibility

### Project-level
- `.planning/PROJECT.md` — Core value statement, Constraints (existing-403 must-not-duplicate, no-ORM migrations)
- `.planning/REQUIREMENTS.md` — RSK-01, RSK-02, RSK-03 full requirement text

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CrmClientsBlock.tsx`'s `CreditBar` component: already computes `pct`, `over` (boolean), and color logic (`bg-red-500` / `bg-amber-500` / `bg-emerald-500`) from `client.outstanding_balance`/`client.credit_limit` — the semaphore's over-limit detection can reuse this exact logic rather than reinventing it.
- `activityVolume.evaluator.ts`'s `resolveTargetUsers` pattern — a private method resolving a rule's target(s) before evaluating each — the credit-risk evaluator should follow the same shape but resolve clients instead of users.

### Established Patterns
- Evaluators are pure computation + a private target-resolution helper; they call `kpiRepository` methods directly (no cross-domain repository imports — the file's own comment notes "kept here, not imported from other domains' repositories, to avoid cross-domain coupling"). The credit-risk evaluator will need client credit-limit/invoice data — likely requires new `kpiRepository` methods (e.g. `listClientsForCompany`, `countOverdueInvoices`) rather than importing `crmRepository`/`billingRepository`, to preserve this established boundary.
- `kpi.service.ts`'s `assertOwnedProject`/`assertOwnedUser` pattern for rule-target validation — a `assertOwnedClient` sibling would follow the same shape if `target_client_id` validation on rule create/update is added.

### Integration Points
- `pod.service.ts`'s `create()` is the sole 403 call site — the semaphore reads the same underlying data (`credit_limit`, `outstanding_balance`) but via the frontend's `useClients` hook, not the KPI evaluator's results, so there's no dependency between "does the KPI rule exist/run" and "does the semaphore show."
- `kpi_rules`/`kpi_results` are already wired to `/api/v1/kpi` routes and a generic dashboard-agnostic result store — RSK-01's "queryable like other KPI results" is satisfied by the existing `listResults`/`getSummary` endpoints once a `clientId` filter is added.

</code_context>

<specifics>
## Specific Ideas

No specific visual reference beyond "red frosted glass warning" (REQUIREMENTS.md RSK-02 wording) — translate that literally: a semi-transparent red panel with backdrop blur, consistent with the app's existing dark/light mode dual-styling convention seen throughout `CrmClientsBlock.tsx` and `PodTrackerBlock.tsx` (e.g. `dark:bg-slate-800/60`, `dark:text-red-400` patterns already in use).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)

None — no pending todos matched this phase.

</deferred>

---

*Phase: 6-credit-risk-kpi-evaluator-semaphore*
*Context gathered: 2026-07-06*
