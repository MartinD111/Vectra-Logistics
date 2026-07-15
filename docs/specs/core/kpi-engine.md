# kpi-engine.md — KPI rules, evaluators & results

Scope: the pluggable KPI framework that sits on top of the event spine —
rules, evaluators, computed results, and how they reach dashboards/charts. This
documents the system **as it exists in code today**, then specifies the gaps
(scheduling, more evaluators, dashboard wiring) as concrete next steps.

> Suggested location: `docs/specs/core/kpi-engine.md`.
> Reads with: `event-spine.md` (the data source), `workspace-blocks.md`
> (kpi-grid/chart blocks that display results).

---

## 1. What already exists (do not rebuild)

- `apps/api/src/domains/kpi/kpi.types.ts` — `KpiRule`, `KpiResult`,
  `KpiEvaluatorOutput`.
- `apps/api/src/domains/kpi/kpi.repository.ts` — CRUD for rules/results +
  cross-domain lookups evaluators need (project/user company checks, project
  assignment users, `countActivityEvents`).
- `apps/api/src/domains/kpi/kpi.service.ts` — rule CRUD, `runEvaluation`
  orchestration, ownership checks.
- `apps/api/src/domains/kpi/evaluators/` — the pluggable evaluator registry:
  `types.ts` (the `KpiEvaluator` interface), `index.ts` (`getEvaluator`
  registry + graceful `UnimplementedEvaluator` fallback), two real evaluators
  (`activityVolume`, `outlookCalendar`).
- `apps/api/src/domains/kpi/dto/kpiRule.dto.ts` — Zod validation, incl.
  `SOURCE_TYPES` (schema-level, not a DB enum).
- `database/migrations/008_kpi_rules.sql` — `kpi_rules` + `kpi_results` schema.
- Frontend: `lib/hooks/useKpi.ts`, `lib/api/kpi.api.ts`,
  `components/projectPage/blocks` → `kpi-grid` and `chart` (source
  `kpi-results`) page blocks; `app/team/kpis` page.

The extensibility contract is already real and must be preserved: **a new KPI
type = a new evaluator class implementing `KpiEvaluator` + one line in the
`REGISTRY` map + one string in `SOURCE_TYPES`.** No migration, no schema
change, no changes to service/controller/frontend.

---

## 2. The model

**`kpi_rules`** — what to measure, source-agnostic:

```
id, company_id, name, description,
source_type,                 -- plain TEXT, picks an evaluator (see §3)
target_project_id?, target_user_id?,  -- scope (mutually usable; evaluator decides)
condition JSONB,             -- evaluator-specific extra params
weight NUMERIC(5,2),         -- for composite scoring later
threshold NUMERIC(5,2)?,     -- evaluator-specific target/pass line
is_active BOOLEAN
```

**`kpi_results`** — computed values per user/period, one row per (rule, user,
period):

```
id, company_id, rule_id, user_id, period_start, period_end,
actual_value NUMERIC(10,2)?, target_value NUMERIC(10,2)?,
status: pending|computed|unavailable,
detail JSONB,                -- evaluator-specific explanation/inputs
computed_at?
```

`kpi_results` is a **materialised cache of a computation**, not a second event
log — safe to recompute/overwrite (`upsertResult` is an upsert keyed by
rule+user+period in practice). The event spine (`activity_events`) stays the
one source of truth; results are always derivable from it plus whatever other
read-only data an evaluator consults (e.g. `calendar_events`).

**`condition`** exists precisely so new evaluators don't need new columns —
route-specific filters, verb allow-lists, etc. all live here as JSON.

---

## 3. The evaluator registry — how a KPI type is implemented

```ts
export interface KpiEvaluator {
  sourceType: string;
  evaluate(rule: KpiRule, periodStart: Date, periodEnd: Date, companyId: string)
    : Promise<KpiEvaluatorOutput[]>;
}
```

`getEvaluator(sourceType)` looks the type up in a `Record<string, KpiEvaluator>`
map; unknown/not-yet-implemented types fall back to `UnimplementedEvaluator`,
which returns `status: 'unavailable'` with a `detail.reason` explaining why —
**never throws, never blocks the rest of the evaluation run.** Keep this
fallback behaviour; it's what lets `SOURCE_TYPES` list evaluators that don't
exist yet without breaking the API.

### 3.1 Real evaluators today

**`activity_volume`** (`activityVolume.evaluator.ts`) — the reference
implementation. Resolves target users (single user, or every user assigned to
`target_project_id` via `project_assignments`), then
`kpiRepository.countActivityEvents(companyId, userId, periodStart, periodEnd)`
— a straight `COUNT(*)` over `activity_events` scoped by `tenant_id`+
`actor_id`+time range. `actual_value` = the count, `target_value` = the rule's
`threshold`. This is the canonical "read the spine, don't maintain a counter"
pattern from `event-spine.md` §7 — copy this shape for new event-based
evaluators.

**`outlook_calendar`** (`outlookCalendar.evaluator.ts`) — planned-vs-actual
staffing. For each user assigned to `target_project_id`, compares their
`project_assignments.planned_pct` against actual hours summed from
`calendar_events` (synced via Outlook, categorised to the project — see
`outlook.service.syncCalendar`) over the period's workdays (Mon–Fri,
`WORKDAY_HOURS = 8` assumed). Returns `unavailable` when there's no user email
or no synced calendar data for the period, rather than a false zero. This
evaluator shows the pattern for **cross-domain, non-spine data sources** — it's
fine for an evaluator to read another domain's tables (via `kpiRepository`, not
by importing that domain's own repository — see the "kept here, not imported"
comment in `kpi.repository.ts`, to avoid cross-domain coupling).

### 3.2 Declared-but-unimplemented (from `SOURCE_TYPES`)

`task_completion`, `on_time_delivery`, `response_time`, `project_value` are
already valid `source_type` values (rules can be created against them today)
but resolve to `UnimplementedEvaluator` — every result is `unavailable` with a
reason. These are the natural next evaluators to build; each needs entities/
fields that don't fully exist yet:

- **`task_completion`** — needs a generic "task/checklist item" concept with a
  done state and an owner. This lands naturally once the Records/Views model in
  `workspace-blocks.md` (checklist blocks, card properties) exists — a task is a
  record with a `checkbox`/`select` property; the evaluator counts
  done vs. assigned per user/period.
- **`on_time_delivery`** — needs a generic "due date" + "completed date" pair on
  a record/collection, compared per period. Same dependency: Records/Views.
- **`response_time`** — needs timestamped request→response pairs. Candidate
  spine-based approach: measure time between two correlated `activity_events`
  verbs (e.g. `x.requested` → `x.responded`) sharing an `object_id`, scoped by
  `condition` naming the verb pair. This one is spine-only — buildable without
  waiting on Records/Views.
- **`project_value`** — needs a monetary figure attached to a project (revenue,
  margin). Depends on whichever domain ends up owning that number (billing/
  invoicing already has `invoice.*` events — could sum `payload.amount` from
  `invoice.paid` events scoped by `project_id`, if invoices carry one).

When implementing one of these, follow §3.1's shape exactly: a class in
`evaluators/`, registered in `index.ts`, reading data through
`kpiRepository` (add methods there, not ad-hoc queries in the evaluator).

---

## 4. Evaluation lifecycle

Evaluation is **on-demand today**, not scheduled: `POST /kpi/evaluate` with
`{ period_start, period_end }` runs every **active** rule
(`kpiRepository.listActiveRules`) for the company, calls each rule's evaluator,
and **upserts** one `kpi_results` row per output. `kpi.rule.created` is the only
KPI verb currently recorded on the event spine — evaluation runs themselves
don't emit an event (worth adding, see §6).

Frontend triggers this via `useRunKpiEvaluation()` (a mutation, not automatic)
from `app/team/kpis`. There is **no scheduler** — no cron/worker calls
`runEvaluation` automatically. This is the main operational gap: KPIs are only
as fresh as the last time someone opened the KPI page and clicked evaluate.

---

## 5. How results reach the UI

- **`kpi-grid` page block** and **`stat-cards`** — render current KPI state on
  a project/dashboard page (renderer in `components/projectPage`, registered in
  `PAGE_BLOCK_REGISTRY`).
- **`chart` page block** — one of three `ChartSource`s is `'kpi-results'`
  (alongside `'activity-by-day'` / `'activity-by-verb'`, which read the spine
  directly rather than through `kpi_results`). Keep this distinction: a chart
  can visualise either raw spine activity or evaluated KPI results — don't
  collapse them into one source type.
- **`app/team/kpis`** — the rules/summary management page, via `useKpiRules`
  and `useKpiSummary`.

`getSummary`/`listResultsWithRuleInfo` joins results with rule `name` +
`source_type` for these views — reuse this join for any new summary surface
rather than re-joining ad hoc.

---

## 6. Gaps to close (concrete, in priority order)

1. **Scheduled evaluation.** Add a BullMQ recurring job (the queue
   infrastructure already exists — `core/queue`, `Queue`/`Worker` pattern used
   by `workers/matchingJob.ts` and `workers/telematics.worker.ts`) that calls
   `kpiService.runEvaluation` per active company on a fixed cadence (e.g.
   nightly for the previous day, plus a rolling current-period recompute).
   Without this, KPIs described as "live dashboards" in the business plan are
   actually stale-until-clicked. This is the highest-value gap.
2. **Emit an event on evaluation.** Record a `kpi.evaluation.run` (or per-rule
   `kpi.result.computed`) event so evaluation activity itself is visible in
   timelines/audits — consistent with `event-spine.md`'s "every meaningful
   action" rule.
3. **`response_time` evaluator** — buildable now, spine-only (see §3.2);
   highest ROI of the unimplemented types since it needs no new schema.
4. **`task_completion` / `on_time_delivery` evaluators** — sequence after the
   Records/Views model (`workspace-blocks.md`) ships, since they need a generic
   task/due-date concept to read.
5. **Composite/weighted scoring.** `kpi_rules.weight` exists but nothing
   combines multiple rules into one score yet — a per-user "overall KPI score"
   view would use it (`Σ weight × normalized(actual/target)`).
6. **Alerts on threshold breach** — the Power BI proposal's "data-driven
   alerts" (§7 of that doc) naturally hangs off `kpi_results.status` +
   `threshold`: when a result crosses threshold, fire an automation. Not built
   yet; would reuse the automation/integration engine, not a new mechanism.

---

## 7. Cloud vs. On-Premise

Nothing here is cloud-specific — same schema, same evaluators, same queue
mechanism (`core/queue` already reads `REDIS_URL`, which works identically
against a local Redis container On-Premise). The one thing to verify before
On-Prem GA: the scheduled-evaluation job (§6.1) must run **inside** the
customer's own stack (a worker process in their `docker-compose`), not call out
to any Vectra-hosted scheduler — keep it symmetric with the rest of the
On-Premise principle in `CLAUDE.md` §2.

---

## 8. Do / Don't

**Do**
- Implement new KPI types as an `evaluators/*.ts` class + one `REGISTRY` line +
  one `SOURCE_TYPES` string — nothing else changes.
- Read event data through `kpiRepository`, keeping cross-domain queries there
  (not by importing another domain's repository) to avoid coupling.
- Return `status: 'unavailable'` with a `detail.reason` when an evaluator can't
  compute something — never throw, never fabricate a zero.
- Treat `kpi_results` as a recomputable cache; the spine is the source of truth.

**Don't**
- Don't add a DB enum or migration for a new `source_type` — it's validated
  Zod-side only, by design.
- Don't maintain a second live-counter mechanism outside `activity_events` for
  anything an evaluator could compute from the spine.
- Don't block simple wins (scheduling, `response_time`) on the bigger
  Records/Views dependency — sequence per §6's ordering.
