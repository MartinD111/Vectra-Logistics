# Phase 27: Baseline Truth & Roadmap Reconciliation - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 27 is a repository-truth reconciliation pass for the newly opened v5.0 foundation milestone. It does not add new platform capabilities. Instead, it establishes an audit-grade baseline of what the monorepo currently contains and how that maps onto the imported implementation roadmap: grouped inventory of runtime and operational entrypoints, a strict truth matrix for shipped/partial/demo/absent/deferred capability status, documented baseline commands with pass/fail outcomes, and an ADR-gap list that unblocks architecture-changing work in Phases 28-30.

</domain>

<decisions>
## Implementation Decisions

### Status Taxonomy and Evidence Bar
- **D-01:** The truth matrix uses a **strict audit bar**. A capability is only `shipped` if a real code path exists, is wired into a real product surface, and is supported by repository-visible evidence.
- **D-02:** **Repository-visible evidence only** counts for status assignment. Use code, scripts, migrations, routes, package metadata, and committed docs visible in this repository; do not rely on tribal knowledge or assumed behavior.
- **D-03:** If a capability has real code but depends on mock data, stub connectors, disabled workers, fake runtime behavior, or an incomplete end-to-end contract, classify it as **`partial`** rather than `shipped`.
- **D-04:** When evidence is mixed or ambiguous, **bias downward**. Prefer `partial` over `shipped`, and prefer a lower-confidence status until stronger repo proof exists.

### Inventory Boundary
- **D-05:** The inventory must cover **core runtime surfaces plus operational entrypoints**: apps, packages, services, route domains, migrations/tables, queues/workers, public endpoints, and the scripts/boot/build/install/migrate/local-run entrypoints that materially affect how the platform operates.
- **D-06:** Demo/stub behavior is **not** a separate top-level inventory artifact. Instead, note it under the app/service/route/integration surface it affects so inventory stays structural while still truthfully flagging caveats.
- **D-07:** The inventory stays at a **grouped surface level**, not exhaustive item-by-item dumping. Summarize maintainable domains and entrypoint families, and only break out exceptional/risky items individually where that materially changes the baseline.

### Claude's Discretion
- Exact grouping shape of the inventory document, as long as it preserves D-05 through D-07 and clearly separates runtime surfaces from operational entrypoints.
- Exact naming/wording for the `shipped | partial | demo | absent | deferred` rubric notes, as long as the strict evidence bar in D-01 through D-04 is preserved.
- Whether baseline command truth lands in the current-state matrix, an adjacent section, or a companion doc, provided the Phase 27 success criteria remain directly satisfiable from the final artifacts.
- Exact ADR-gap presentation format, provided it names the architectural decisions required before v5 architecture-changing PRs proceed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and milestone contract
- `.planning/ROADMAP.md` - Phase 27 goal, dependencies, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `BASE-01` through `BASE-04`, the requirements this phase must satisfy.
- `.planning/PROJECT.md` - v5 milestone framing, preserved v1-v4 shipped spine, and foundation-first milestone constraints.
- `.planning/STATE.md` - carried-forward v5 kickoff decisions and known risks that Phase 27 is expected to baseline truthfully.
- `.planning/AGENT-WORKSTREAMS.md` - explicit ownership for Repo Auditor, Lead Architect, QA/Release, and Docs/Ops roles feeding this phase.

### Existing truth and architecture steering docs
- `docs/architecture/current-state-truth-matrix.md` - existing Phase 27 target artifact that already maps imported roadmap phases to current repo status and should be reconciled/hardened rather than replaced blindly.
- `docs/specs/architecture-steering.md` - structural source of truth for architectural direction and fork-avoidance constraints; relevant when identifying ADR gaps.

### Runtime and operator entrypoints
- `README.md` - current top-level quick-start and product-shape narrative; useful as evidence and as a source of drift against repo reality.
- `package.json` - root workspace scripts (`build`, `migrate`, `install:on-prem`) and monorepo shape.
- `apps/api/package.json` - backend `dev`, `build`, `test`, `migrate`, and `install:on-prem` scripts that matter to the baseline command audit.
- `apps/workspaces/package.json` - frontend `dev`, `build`, and `lint` scripts for the main workspace surface.
- `docker-compose.yml` - local boot topology and service orchestration surface.
- `docker-compose.prod.yml` - production-oriented compose surface that may affect baseline operator truth.

### Existing codebase maps for repo scouting
- `.planning/codebase/STRUCTURE.md` - grouped monorepo inventory and entrypoint map.
- `.planning/codebase/TESTING.md` - current test reality and gaps; important for honest baseline command reporting.
- `.planning/codebase/INTEGRATIONS.md` - external-service and public-surface map, including demo-mode and integration caveats.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/architecture/current-state-truth-matrix.md` already exists and contains imported-roadmap mapping, immediate v5 risks, and agent findings; Phase 27 can extend and normalize it instead of inventing a new artifact from scratch.
- `.planning/codebase/STRUCTURE.md` already groups apps, packages, services, domains, workers, and migrations at a useful summary level that aligns with D-07's grouped-surface requirement.
- `package.json`, `apps/api/package.json`, and frontend package manifests provide directly inspectable operational entrypoints for the baseline command inventory.
- `.planning/codebase/TESTING.md` already documents that testing coverage is uneven/minimal in many areas, which supports a truthful baseline rather than optimistic assumptions.

### Established Patterns
- The repo is a monorepo with four app surfaces (`api`, `workspaces`, `cmr`, `marketplace`), shared packages, raw SQL migrations, and one Python matching service; grouped inventory should respect those existing seams instead of flattening them.
- Legacy and domain-routed API surfaces coexist in `apps/api/src/routes` and `apps/api/src/domains/*/*.routes.ts`; inventory and risk notes need to acknowledge both rather than pretending the migration is complete.
- Operational truth is partially encoded in scripts and compose files, not only in app code. Phase 27 should treat those entrypoints as first-class evidence per D-05.

### Integration Points
- Route/domain inventory work will connect to `apps/api/src/server.ts`, legacy `apps/api/src/routes/*.ts`, and domain routers in `apps/api/src/domains/**`.
- Migration/table truth will connect to `database/migrations/*.sql` and any code references that imply missing schema (`integration_credentials`, `api_credentials`, `internal_api_keys`, `vehicle_locations`, `assignment_scores`).
- Baseline command truth will connect to root and workspace package scripts plus local boot via compose, without opportunistically fixing failures inside this phase.

</code_context>

<specifics>
## Specific Ideas

The user explicitly chose an audit-style baseline over a narrative one:
- status labels should be strict, evidence-backed, and biased downward on ambiguity
- mock/stub/incomplete end-to-end behavior should fall to `partial`, not be inflated to `shipped`
- the inventory should include operational entrypoints, but remain grouped and maintainable rather than becoming a giant exhaustive registry
- demo/stub caveats should be attached to the affected surface, not duplicated into a standalone inventory section

The repo already contains `docs/architecture/current-state-truth-matrix.md`, so Phase 27 should treat that as an in-progress source artifact rather than assuming the phase starts from zero.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope. Baseline command policy and ADR-gap output format were not user-locked in this session and remain planner/researcher discretion within the Phase 27 success criteria.

</deferred>

---
*Phase: 27-baseline-truth-roadmap-reconciliation*
*Context gathered: 2026-07-15*
