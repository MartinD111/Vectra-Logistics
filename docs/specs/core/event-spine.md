# event-spine.md — `activity_events` specification

Scope: the append-only event log that is the single source of truth for all
statistics and KPIs in Vectra. This document describes the spine **as it
actually exists in the code today**, plus the rules any Claude Code session
must follow when writing to it or reading from it.

Referenced by code comments as **CLAUDE.md §3** and **§4**. Keep those section
references intact.

> Suggested location in repo: `docs/specs/core/event-spine.md`.

---

## 1. Purpose & core principle

`activity_events` is a **single, append-only table** that every meaningful
action writes one row to. Metrics, per-project stats, per-user stats, KPI
evaluation, and activity timelines are all **reads over this log** — there are
no separate per-project or per-user counters to maintain.

The governing rule (already stated in `004_projects_and_programs.sql`):

> per-project / per-user stats are a read over `activity_events`, not
> maintained counters.

**Do not introduce parallel counting mechanisms** (increment columns, cached
totals, per-entity tallies) under time pressure. If a statistic is needed, it
is a query over this table. This holds under On-Premise as much as Cloud.

---

## 2. Schema (source of truth)

Defined in `database/migrations/003_workspaces_and_presets.sql`. Do **not**
redefine it elsewhere; extend only via a new numbered, idempotent migration.

```sql
CREATE TABLE IF NOT EXISTS activity_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  verb          VARCHAR(100) NOT NULL,
  object_type   VARCHAR(100) NOT NULL,
  object_id     UUID,
  project_id    UUID,
  payload       JSONB NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_events_tenant_idx ON activity_events (tenant_id, occurred_at DESC);
CREATE INDEX activity_events_verb_idx   ON activity_events (tenant_id, verb, occurred_at DESC);
```

### Column contract

| Column        | Rule |
|---------------|------|
| `tenant_id`   | **Always required.** This is the `companyId`. Every read is scoped by it. On-Premise = one tenant, but the column is never dropped or made optional — it keeps Cloud and On-Prem on one schema. |
| `actor_id`    | The user who caused the action, or `NULL` for system/automation-generated events (e.g. `ltl.scan.suggested` has no actor). `ON DELETE SET NULL` so deleting a user never deletes their history. |
| `verb`        | Dotted action name, past tense. See §4. |
| `object_type` | Generic noun for the thing acted on. See §4. |
| `object_id`   | UUID of the object when it has one; `NULL` is allowed (e.g. a scan batch). |
| `project_id`  | Set whenever the action belongs to a project, so per-project stats work. `NULL` for workspace-/tenant-level actions. Not a FK by design (an event may outlive its project). |
| `payload`     | Generic JSONB. **Capture generously** — see §5. |
| `occurred_at` | Event time, defaults to `NOW()`. Never back-date except in explicit data-import scenarios. |

**Never add domain-specific columns to this table.** Anything vertical goes in
`payload`. Adding e.g. a `shipment_status` column would violate CLAUDE.md §1.

---

## 3. Writing events — the only sanctioned path

All writes go through **one helper**: `apps/api/src/core/events/activityLog.ts`.

```ts
import { recordEvent } from '../../core/events/activityLog';

await recordEvent({
  tenantId: companyId,          // required
  actorId,                      // user id or null
  verb: 'project.created',      // see §4
  objectType: 'project',
  objectId: project.id,
  projectId: project.id,        // omit/null if not project-scoped
  payload: { name: project.name },
});
```

Hard rules — these are already how the code behaves, keep them true:

1. **Write from the SERVICE layer only.** Never from controllers, repositories,
   or the frontend. Every current call site is in a `*.service.ts`.
2. **`recordEvent` never throws into the caller's happy path.** It catches and
   `console.error`s internally. A metrics-log failure must not break the action
   that triggered it. Do not `await` it inside a transaction in a way that would
   roll back the real work if logging fails, and do not add `throw` to it.
3. **One row per meaningful action.** Log the business fact (`invoice.paid`),
   not every incidental DB touch.
4. **Fire after the action succeeds**, using the persisted object's real id.

### Current write sites (for orientation, not exhaustive going forward)

Services that already emit events: `projects`, `team`, `folders`, `workspaces`,
`ltl`, `yard`, `outlook`, `kpi`, `billing/invoicing`, `pod`, `inbox`,
`campaigns`, plus `authController` (login). When you add a feature that a user
or manager would reasonably expect to see in stats/timelines, add a
`recordEvent` call in that feature's service.

---

## 4. Verb & object_type conventions

`verb` is `domain.action` (or `domain.subthing.action`), **past tense**,
lower-case, dot-separated. `object_type` is the generic noun. Neither is a DB
enum — both are free `VARCHAR`, validated only by convention — so **new verbs
need no migration**. This mirrors how `programs.type` / `kpi_rules.source_type`
are plain TEXT validated in the API layer.

### Existing catalogue (verb → object_type)

Keep new verbs consistent with these; reuse an existing verb rather than
inventing a near-duplicate.

```
workspace.created                  -> workspace
workspace.branding.updated         -> workspace
workspace.preset.applied           -> preset
workspace.preset.removed           -> preset
project.created                    -> project
program.created                    -> program
program.published                  -> program
page.created                       -> page
page.updated                       -> page
page.deleted                       -> page
folder.created                     -> folder
team.member.added                  -> user
team.member.removed                -> user
team.member.role_changed           -> user
team.member.custom_role_updated    -> user
team.member.assigned_project       -> project_assignment
kpi.rule.created                   -> kpi_rule
integration.connected              -> integration
integration.disconnected           -> integration
integration.calendar_synced        -> integration
outlook / email.opened             -> email_campaign
email_campaign.sent                -> email_campaign
invoice.drafted                    -> invoice
invoice.approved                   -> invoice
invoice.paid                       -> invoice
pod.requested                      -> pod_request
pod.delivered                      -> pod_request
ltl.scan.suggested                 -> ltl_scan        (actor_id NULL: system)
ltl.accepted                       -> ltl_suggestion
yard.gate.checkin                  -> yard_asset
shipment.draft.created             -> shipment_draft
```

### Naming a new verb

- Past tense: `x.created`, `x.updated`, `x.deleted`, `x.published`,
  `x.approved`, `x.completed` …
- Prefix with the domain: `fleet.`, `cmr.`, `procurement.`, etc.
- System-generated (no human actor) → set `actorId: null`, same as
  `ltl.scan.suggested`.

Optional but recommended: as the catalogue grows, keep a `VERBS` constant per
domain (string union) so verbs are discoverable and typo-safe. Not required by
current code, but a good next step before the list gets much longer.

---

## 5. Payload discipline

From `activityLog.ts`:

> payloads should be generous — capture whatever a future metric might need;
> under-capturing is the most expensive mistake to fix later.

Guidelines:

- Put anything a future stat/KPI/timeline might slice on into `payload`
  (amounts, labels, counts, statuses, relation ids).
- `payload` is **generic JSON** — no schema is enforced, but keep keys stable
  and snake_case-ish per domain so aggregation queries stay simple.
- Do **not** put secrets, raw document contents, or PII beyond what a stat
  needs. This matters more On-Premise where the customer owns the DB and may
  export/audit it.
- Examples already in use: `{ name }`, `{ count, top_margin }`,
  `{ route, partial, margin }`, `{ source_type }`.

---

## 6. Reading events — established query patterns

All reads are `tenant_id`-scoped. Existing consumers to copy from:

**Per-project stats** — `projects.repository.ts`:
- total events: `COUNT(*) WHERE tenant_id = $1 AND project_id = $2`
- last 7 days: same + `AND occurred_at > NOW() - INTERVAL '7 days'`
- top verbs: `GROUP BY verb ORDER BY count DESC LIMIT 10`
- last activity: `MAX(occurred_at)`
- timeline feed: `SELECT ... ORDER BY occurred_at DESC LIMIT $n`

**Per-user stats** — `team.repository.ts`: same four shapes, keyed on
`actor_id` instead of `project_id`; plus a `LEFT JOIN activity_events` for
`last_activity_at` in member lists.

**KPI evaluation** — `kpi.repository.countActivityEvents(...)`:
`COUNT(*) WHERE tenant_id AND actor_id AND occurred_at >= start AND < end`.

When you need a new statistic, add a query in the relevant repository following
these shapes. Reuse the two existing indexes (`tenant_id, occurred_at` and
`tenant_id, verb, occurred_at`); if a new access pattern can't use them,
add an index in a new migration rather than scanning.

---

## 7. Relationship to the KPI engine

The KPI framework (migration `008_kpi_rules.sql`, domain `kpi/`) sits **on top
of** the spine:

- `kpi_rules` define what to measure; `source_type` is plain TEXT so new
  evaluator types need no migration.
- Evaluators (`kpi/evaluators/`) read `activity_events` and write computed
  numbers into `kpi_results`. The reference implementation
  `activityVolume.evaluator.ts` counts events per user per period.
- `kpi_results` is a **materialised computation cache**, not a second event
  log — it's fine to recompute/overwrite it. The spine stays the source of
  truth; results are derived.

New evaluators should read the spine the same way and must not bypass it with
ad-hoc counters. Detail of the KPI layer belongs in `kpi-engine.md`, not here.

---

## 8. Cloud vs. On-Premise notes

- The spine is **deployment-mode agnostic** — identical schema and code paths
  in both. `tenant_id` scoping means an On-Prem single-tenant install is just
  "one company" with no special casing.
- On-Premise implication: this table is the customer's own audit/analytics
  asset, living entirely on their server. That's a selling point — treat it as
  data the customer may inspect, export, and retain. Keep payloads clean
  (§5) and never write anything to it that must not leave the customer's box.
- **Retention/growth**: append-only means unbounded growth. There is no
  partitioning or archival today. Before an On-Prem GA, decide a retention /
  partition strategy (e.g. monthly partitions or an archival job) so a
  long-running customer install doesn't degrade. Track this as an explicit
  task; do not silently start deleting events, since stats read historically.

---

## 9. Do / Don't summary

**Do**
- Write every meaningful business action via `recordEvent` from the service layer.
- Set `tenant_id` always, `project_id` whenever project-scoped.
- Put sliceable detail in `payload`, generously.
- Read stats via `tenant_id`-scoped queries over this table.

**Don't**
- Don't add domain-specific columns — use `payload`.
- Don't maintain parallel counters or cached totals for anything derivable here.
- Don't let `recordEvent` throw or roll back the real action.
- Don't write events from controllers or the frontend.
- Don't back-date `occurred_at` outside explicit imports.
- Don't delete/truncate events without a decided retention strategy.
