# analytics-reporting.md — Power BI-style analytics (cross-filtering, drill-down, paginated reports, forecasting, anomaly detection)

Scope: the second uploaded business document's Power BI feature proposal,
assessed precisely against the actual chart/KPI implementation rather than
against the general shape of the codebase. The key correction this document
makes to the earlier high-level analysis: **cross-filtering/drill-down is not
"an incremental UI upgrade to the Chart block"** — the current chart data flow
has a specific architectural limit that must be fixed first, or interactivity
gets built on too narrow a data window to be meaningful.

> Suggested location: `docs/specs/business/analytics-reporting.md`.
> Reads with: `kpi-engine.md` (the evaluated-results half of what charts can
> show), `event-spine.md` §6 (the raw query patterns this document's fix
> extends), `ai-integration.md` §6.4 (NL Q&A, scoped there not here),
> `app-store.md` §2 (Custom Visuals — page-block plugins don't exist, scoped
> there not here), `program-builder.md` §3 (the `export`/`document` blocks
> this document's PDF-report proposal builds on).

---

## 1. How chart data actually flows today — the finding that reframes everything else

`ChartWidgetView` (`PageBlockView.tsx`) is real and works, but its data path
matters precisely:
- It calls `useProjectActivity(projectId, 100)` — fetches the **last 100 raw
  `activity_events` rows** for the project (no date-range parameter; the
  underlying endpoint supports only `limit`/`before` pagination, per
  `event-spine.md` §6's "timeline feed" shape).
- Grouping by day or by verb (`activity-by-day`/`activity-by-verb`) happens
  **entirely client-side**, in a `useMemo` over whatever those 100 rows
  happen to contain.
- `kpi-results` source reads `useKpiSummary` (a real server aggregation, via
  `kpi_results` — this path is fine as-is).

**Consequence**: for an active project, 100 raw events might cover a few
hours; for a quiet one, months. The chart's implicit "time window" is
**row-count-bounded, not date-bounded** — there is no way today to ask for
"activity by day for Q1 2026," only "whatever the last 100 events show,
bucketed." This is the fact that changes the shape of every feature below —
before building cross-filtering, drill-down, or richer charts on top of this,
the data layer needs to become a real parameterized aggregation, not a
client-side reduction over a capped raw feed.

---

## 2. Cross-filtering & drill-down — the proposal's own top priority, correctly, but bigger than it looks

### What's needed, precisely
1. **A server-side aggregation endpoint**, parameterized by date range,
   `project_id`, and optionally `verb`/`object_type` — e.g.
   `GET /kpi/activity-summary?project_id=&from=&to=&group_by=day|verb`,
   returning pre-aggregated `{name, value}` pairs via `GROUP BY` over
   `activity_events` (the existing `tenant_id, occurred_at` and
   `tenant_id, verb, occurred_at` indexes from `event-spine.md` §2 already
   support this well). This **replaces**, not extends, the current
   client-side `useMemo` grouping — the 100-row cap goes away entirely once
   the server does the aggregation.
2. **Page-level shared filter state** — a page's charts/tables need to read
   from and write to one shared filter object (date range, selected category)
   rather than each block independently fetching its own data. This is new
   frontend state management scoped to a page, not present today (each block
   in `PageBlockView.tsx` currently fetches independently).
3. **Cross-filtering interaction**: clicking a bar/segment sets the shared
   filter; every other chart/table block on the page re-queries the new
   aggregation endpoint with that filter applied.
4. **Drill-down** (year → quarter → month): a `group_by` parameter escalation
   on the same aggregation endpoint — no new concept, just a finer grain.
5. **Drill-through**: click a data point → open the underlying record's full
   page. This one is **cheap and mostly already solved** once
   `workspace-blocks.md`'s Records/Views model ships — a drill-through target
   is just "open this record's card page" (§4 of that document), reusing the
   card-as-page pattern rather than building a bespoke detail view. Sequence
   drill-through after Records/Views, not before.

Do this as one unit (server aggregation + shared page filter state) rather
than adding cross-filter UI on top of the current per-block client-side
fetch — the latter would need rebuilding once the data layer is fixed anyway.

---

## 3. NL Q&A ("/ask-ai") — already scoped, not re-specified here
`ai-integration.md` §6.4 covers this in full: a schema-driven prompt (mirroring
how the mini-program generator derives its prompt from `BLOCK_REGISTRY`,
per `program-builder.md` §5) turning a question into a query over the same
aggregation endpoint §2 proposes. Building §2's real aggregation endpoint is
also a **prerequisite** for this — an NL query has nowhere reliable to
resolve to without it (today it would have to resolve to "the last 100
events," which isn't a meaningful target for "top 5 customers in 2025").

---

## 4. Decomposition Tree & Key Influencers — need a real stats layer that doesn't exist

Confirmed: no forecasting, anomaly detection, or ML-adjacent library
(LightGBM or otherwise) exists anywhere in the codebase — this is genuinely
net-new infrastructure, not a gap in an existing service.

- **Decomposition Tree** ("why were March shipments more expensive?" —
  ad-hoc breakdown by any dimension) can actually be built as a **pure
  aggregation feature** on top of §2's endpoint — repeatedly `GROUP BY` a
  chosen dimension and rank by contribution to the metric. This doesn't need
  ML; it needs the same aggregation endpoint with a flexible `group_by`
  dimension list. Cheaper than it sounds, once §2 exists.
- **Key Influencers** (rank which variables most affect a metric, e.g.
  delivery delays) genuinely needs a real statistical/ML step — this is the
  one item in the whole Power BI proposal that can't be reduced to smarter
  SQL. `services/matching-engine` is already a real Python FastAPI service
  (`program-builder.md`/`marketplace-ltl.md` reference it) — extending it
  with a `/analyze/influencers` endpoint (a simple regression or feature-
  importance model, not necessarily LightGBM specifically) is more sensible
  than a new service, reusing existing Python infrastructure and deployment.

---

## 5. Paginated (print-ready) reports — partial building blocks exist, but not the report-layout piece

`jsPDF` is already used in three places: `apps/cmr`'s CMR generator
(`cmr-workflow.md` §1), and two Program Builder pieces
(`programBuilder/exporter.ts`, `miniProgram/docExport.ts` — the `export`
and `document` block kinds from `program-builder.md` §3). **All three are
single-document, per-run, client-side generators** — filling a template or
laying out one structured document — not a "multi-page business report with
repeating headers/footers/page breaks over an arbitrary dataset" system,
which is what Power BI's Paginated Reports (RDL) actually are.

**What's missing specifically**: page-break-aware layout logic (a table that
correctly repeats its header row across pages, a report that repeats a
company letterhead per page) — none of the three existing `jsPDF` call sites
attempt this; they each lay out one bounded document. Build this as an
extension of the **`export`** block (`program-builder.md` §3) — add a
`report` mode with header/footer/repeat-row config — rather than a new block
kind or a separate reporting subsystem, since the underlying primitive
(dataset → `jsPDF`) is identical; only the page-layout logic is new.

---

## 6. Forecasting & Anomaly Detection — the two cheapest "advanced" items

Both are lighter than Decomposition Tree/Key Influencers and don't need
`services/matching-engine`:

- **Forecasting**: Power BI itself uses simple exponential smoothing, not
  heavy ML — this is implementable as a small, pure JS function over the
  same aggregated time series §2's endpoint produces (or even client-side, as
  a `chart` block option: "add forecast"). Start here before reaching for
  anything heavier; matches the proposal's own framing.
- **Anomaly Detection**: a Z-score check over a time series is a handful of
  lines, not a model — could live as a `transform`-style option
  (`program-builder.md` §4's typed-op philosophy: this would be a good
  candidate for a new typed transform op, `flag_outliers`, rather than a
  bespoke chart feature) or directly in the chart aggregation response as an
  `is_anomaly` flag per point.

---

## 7. Data-driven alerts — already scoped, cheapest of the "advanced" asks
`kpi-engine.md` §6 item 6 already names this: once a `kpi_results` row
crosses its `threshold`, fire the automation engine. This needs **no new
stats infrastructure at all** — only wiring already-computed KPI evaluation
output to an already-existing automation trigger. Genuinely the cheapest item
in the whole Power BI proposal to ship, once `kpi-engine.md` §6's scheduled
evaluation (item 1) exists to produce results on a cadence for a threshold
crossing to be detected against.

---

## 8. Custom Visuals Marketplace — scoped elsewhere, not duplicated here
Fully covered in `app-store.md` §2's finding: the plugin system only reaches
mini-program blocks, not page-level blocks (Charts, Kanban, etc.), so a
Sankey/Heatmap-as-a-page-block marketplace has no foundation today. Don't
re-scope it here — `app-store.md` §3's build order already places "extend
plugin support to page blocks" as its own deliberate step.

---

## 9. Revised priority order (supersedes the original proposal's table with what's actually been verified)

1. **Server-side aggregation endpoint + shared page filter state** (§2) —
   unlocks cross-filtering, drill-down, decomposition tree, and NL Q&A alike;
   build once, benefits four proposal items.
2. **Data-driven alerts** (§7) — trivial once `kpi-engine.md` §6's scheduler
   exists; no new stats needed.
3. **Anomaly detection** (§6) — a few lines of math once §1's aggregation
   exists.
4. **Forecasting** (§6) — simple exponential smoothing, same prerequisite.
5. **Decomposition Tree** (§4) — pure aggregation once §2 ships.
6. **Drill-through** (§2.5) — sequenced after `workspace-blocks.md`'s
   Records/Views, reuses the card-as-page pattern.
7. **Paginated reports** (§5) — extend the `export` block with report-layout
   mode.
8. **Key Influencers** (§4) — the one item needing a real stats/ML step;
   extend `services/matching-engine`.
9. **Custom Visuals Marketplace** — depends on `app-store.md`'s page-block
   plugin extension; not started until that lands.

---

## 10. Do / Don't

**Do**
- Fix the chart data layer (§1–§2) before building any interactivity on top
  of it — the current 100-row client-side aggregation isn't a foundation to
  extend, it needs replacing.
- Treat Decomposition Tree and Key Influencers as different in kind — one is
  smarter SQL, the other genuinely needs a stats/ML endpoint.
- Extend the existing `export` block for paginated reports rather than
  building a parallel reporting subsystem.
- Ship data-driven alerts early — it's nearly free once `kpi-engine.md`'s
  scheduler exists.

**Don't**
- Don't add cross-filter UI to the current per-block client-side fetch
  pattern — it will need rebuilding once §2's real aggregation endpoint
  exists anyway.
- Don't reach for LightGBM/heavy ML for forecasting or anomaly detection —
  both are cheaply solvable with simple math, matching Power BI's own
  approach.
- Don't build Custom Visuals Marketplace work here — it's gated on
  `app-store.md`'s separate page-block plugin extension.
- Don't build a second PDF/reporting pipeline alongside the three existing
  `jsPDF` call sites — extend the `export` block instead.
