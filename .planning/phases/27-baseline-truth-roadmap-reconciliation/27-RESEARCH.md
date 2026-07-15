# Phase 27: Baseline Truth & Roadmap Reconciliation - Research

**Researched:** 2026-07-15
**Domain:** Repository-truth audit, roadmap reconciliation, operator baseline documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Status Taxonomy and Evidence Bar
- **D-01:** Status calls must use a strict audit bar. `shipped` requires a real code path, a real product surface, and repository-visible evidence.
- **D-02:** Only repository-visible evidence counts. Use code, scripts, migrations, routes, package metadata, and committed docs in this repo.
- **D-03:** Mock data, stubs, disabled workers, fake runtime behavior, or incomplete end-to-end contracts downgrade status to `partial`.
- **D-04:** On ambiguity, bias downward rather than upward.

### Inventory Boundary
- **D-05:** Inventory must cover apps, packages, services, route domains, migrations/tables, queues/workers, public endpoints, and operational entrypoints.
- **D-06:** Demo/stub caveats belong inline with the affected surface, not in a separate side-list.
- **D-07:** Inventory should stay grouped and maintainable, not become a giant file dump.

### Claude's Discretion
- Whether the grouped inventory, command baseline, and ADR gaps live in one hardened artifact or a small companion set, as long as Phase 27 success criteria are directly satisfied.
- Exact wording of rubric notes, provided the `shipped | partial | demo | absent | deferred` evidence standard remains strict.
- Exact ADR-gap formatting, provided it clearly blocks architecture-changing work until the missing decisions are made.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BASE-01 | Maintainer can read a current inventory of apps, packages, services, database migrations/tables, queues, and public route domains | Reuse `.planning/codebase/STRUCTURE.md`, route scans, worker scans, and migration list to build a grouped repo-surface inventory inside `docs/architecture/current-state-truth-matrix.md` |
| BASE-02 | Maintainer can read a feature truth matrix marking each imported roadmap phase/capability as shipped, partial, demo, absent, or deferred | Existing `docs/architecture/current-state-truth-matrix.md` already has a draft imported-phase mapping, but it needs stricter evidence notes and normalization against live repo truth |
| BASE-03 | Maintainer can run or read a documented baseline for lint, typecheck, tests, builds, migrations, and local boot commands without hiding failures | Package manifests expose real command surfaces; the artifact must document exact commands, scope, and pass/fail/not-available outcomes rather than smoothing over missing scripts or failures |
| BASE-04 | Maintainer can see the ADR gap list needed before architecture-changing PRs proceed | Existing architecture docs and v5 roadmap already imply several unresolved decisions; Phase 27 should name them explicitly as ADR prerequisites for Phases 28-30 |
</phase_requirements>

## Summary

Phase 27 should not create a brand-new documentation tree. The repo already has the right anchor artifact in `docs/architecture/current-state-truth-matrix.md`, plus supporting codebase-intel docs in `.planning/codebase/*`. The most efficient and lowest-risk execution path is to harden that truth-matrix document into a single audit-grade baseline artifact with four explicit sections:

1. grouped repository inventory
2. imported roadmap phase truth matrix
3. baseline command matrix with pass/fail/not-available outcomes
4. ADR gaps required before Phase 28-30 architecture-changing work

The current truth-matrix draft already covers imported-roadmap reconciliation and immediate risks, but it does **not** yet satisfy the full Phase 27 contract. It lacks an explicit grouped inventory, lacks a command baseline section, and does not present ADR gaps as a named precondition list. That makes Phase 27 primarily a documentation-and-evidence pass, not a feature implementation pass.

One important finding from live repo inspection: some older internal docs are already stale. `.planning/codebase/TESTING.md` says there are no tests or test scripts, but `apps/api/package.json` now exposes a real `test` script and the repo contains API health tests. That drift is exactly why Phase 27 needs to privilege live repository evidence over earlier summaries.

## Recommended Artifact Shape

### Keep one primary artifact
- `docs/architecture/current-state-truth-matrix.md`
  - Add `## Grouped Repository Inventory`
  - Add `## Baseline Command Matrix`
  - Add `## ADR Gaps Before Architecture-Changing PRs`
  - Preserve and tighten the imported roadmap mapping already present

### Avoid parallel “truth” docs
- Do not split the same truth across README, a new checklist doc, and the matrix unless a section becomes too large.
- If supporting notes are needed during execution, they can live temporarily in the plan summary, but the durable Phase 27 output should resolve into the matrix artifact.

## Architectural Responsibility Map

| Concern | Primary Evidence | Why it belongs in Phase 27 |
|---------|------------------|----------------------------|
| Apps/packages/services inventory | `.planning/codebase/STRUCTURE.md`, `package.json`, app package manifests | Gives maintainers a grouped surface map before foundation changes start |
| Route/public endpoint truth | `apps/api/src/server.ts`, `apps/api/src/routes/*.ts`, `apps/api/src/domains/**/*.routes.ts`, `apps/api/src/domains/pod/pod.public.routes.ts` | Needed to distinguish authenticated domain surfaces from public and legacy edges |
| Queue/worker truth | `apps/api/src/core/queue/index.ts`, `apps/api/src/workers/*.ts`, API bootstrap wiring | Separates “worker exists” from “worker actually runs” |
| Migration/schema truth | `database/migrations/*.sql`, code references to undeclared tables, current matrix risk notes | Needed before security/outbox work assumes schema reality |
| Imported roadmap mapping | Existing `docs/architecture/current-state-truth-matrix.md`, v1-v4 shipped artifacts, current v5 roadmap | Converts imported roadmap ambition into repo-truth status |
| Baseline command truth | root/app package scripts, Docker Compose files, direct command execution during plan execution | Makes failures visible instead of optimistic |
| ADR gaps | `.planning/ROADMAP.md`, `.planning/STATE.md`, `docs/specs/architecture-steering.md`, current matrix risk list | Defines what must be decided before Phases 28-30 mutate architecture |

## Repo-Truth Findings

### Existing truth artifact is usable, but incomplete
- `docs/architecture/current-state-truth-matrix.md` already contains imported roadmap mapping, shipped spine, and immediate risks.
- It does **not** yet provide an explicit grouped inventory or command baseline.
- Its “Agent Findings Snapshot” is useful source material, but still reads like notes rather than a finalized audit artifact.

### Command truth must come from live manifests and command runs
- Root `package.json` exposes `build`, `migrate`, and `install:on-prem`, but no root `lint`, `typecheck`, or `test`.
- `apps/api/package.json` exposes `build`, `test`, `migrate`, and `install:on-prem`.
- `apps/workspaces`, `apps/cmr`, and `apps/marketplace` expose `build` and `lint`, but no test script.
- This means the final command baseline must document missing commands honestly instead of implying a unified root workflow exists when it does not.

### Worker and public-surface truth must be statused carefully
- Matching and email workers are started from `apps/api/src/server.ts`.
- `telematics.worker.ts` exists, but current repo notes already flag that it is not started from API bootstrap; this is a real example of “code exists, contract incomplete,” which should remain `partial`.
- Public edge surfaces include `/health`, `/api/webhooks/*`, and public POD token routes; these should be inventoried separately from authenticated `/api/v1/*` domains.

### Migration truth remains a live risk
- The visible migration range is `002` through `025`; there is no visible `001`.
- Existing v5 risk notes already flag code references to `integration_credentials`, `api_credentials`, `internal_api_keys`, `vehicle_locations`, and `assignment_scores` without a complete visible migration trail.
- Phase 27 should verify and document this truth, not silently resolve it in code.

## ADR Gap Candidates

The repo evidence and v5 roadmap strongly suggest these ADRs or equivalent locked decisions are needed before Phases 28-30 proceed:

1. **Request context and capability boundary**
   - One typed `RequestContext`
   - Capability model for workspace, records, programs, workflows, integrations, and public edges
2. **Public endpoint trust model**
   - Signed-token/API-key/HMAC strategy for webhooks, POD/public links, and legacy public routes
3. **Demo-mode versus production-mode behavior**
   - One explicit policy for stubs, synthetic data, disabled integrations, and operator-visible capability status
4. **Schema truth for credentials and runtime tables**
   - Canonical answer on whether referenced tables are intentionally external, missing migrations, or dead references
5. **Event envelope and durable outbox contract**
   - Versioned event shape, transaction boundary, dispatcher semantics, and retry/idempotency rules
6. **Workflow persistence and run model**
   - Canonical schema and lifecycle for workflow drafts, runs, steps, manual triggers, and idempotency keys
7. **Matching-engine/service boundary**
   - Reconciled contract between Node worker expectations and FastAPI routes before event/outbox work builds on it

## Pitfalls

### Pitfall 1: treating “real code exists” as “shipped”
- Workers, integrations, and vertical surfaces often have partial implementations.
- Phase 27 must classify by real runtime contract, not by file presence.

### Pitfall 2: using older planning docs as the truth source
- `.planning/codebase/*.md` is useful scouting material, but some of it is already stale.
- Final status calls must always be verified against current source files and manifests.

### Pitfall 3: hiding missing command surfaces
- A missing root `test` or `lint` script is itself a baseline finding.
- The command matrix should record “not available” or “surface-specific only,” not silently substitute a different command without saying so.

### Pitfall 4: opportunistic fixes during the audit
- Phase 27 is about baseline truth.
- If commands fail, the artifact should record the failure and likely cause, not turn into an unplanned cleanup phase.

## Execution Recommendation

Use one execution plan, not multiple waves. The work is tightly coupled around a single truth artifact:

1. inventory the repo surfaces and public/worker seams
2. normalize the imported roadmap status table using strict evidence
3. run/document baseline commands and append ADR gaps

That keeps the phase aligned with ROADMAP’s current `0/1` plan count and avoids unnecessary fragmentation.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/AGENT-WORKSTREAMS.md`
- `.planning/phases/27-baseline-truth-roadmap-reconciliation/27-CONTEXT.md`
- `docs/architecture/current-state-truth-matrix.md`
- `docs/specs/architecture-steering.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/INTEGRATIONS.md`
- `README.md`
- `package.json`
- `apps/api/package.json`
- `apps/workspaces/package.json`
- `apps/cmr/package.json`
- `apps/marketplace/package.json`
- `apps/api/src/server.ts`
- `apps/api/src/workers/*.ts`
- `apps/api/src/routes/*.ts`
- `apps/api/src/domains/**/*.routes.ts`
- `apps/api/src/domains/pod/pod.public.routes.ts`
- `database/migrations/*.sql`

### Secondary (MEDIUM confidence)
- `docs/specs/modules/external-systems.md`
- `docs/specs/deployment/cloud-deployment.md`
- `docs/specs/deployment/on-premise-deployment.md`
- `docs/DEPLOYMENT.md`

## Metadata

**Confidence breakdown:**
- Imported-roadmap mapping: HIGH
- Inventory structure: HIGH
- Baseline command surface: HIGH
- ADR-gap list: MEDIUM-HIGH (clear from roadmap and risks, but still meant to become explicit decisions during or after Phase 27)

**Research date:** 2026-07-15
**Valid until:** Re-run if package scripts, worker bootstrap wiring, or v5 roadmap intent changes before execution.
