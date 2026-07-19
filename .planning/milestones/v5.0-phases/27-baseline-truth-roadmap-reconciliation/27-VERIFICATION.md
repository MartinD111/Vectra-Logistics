---
phase: 27-baseline-truth-roadmap-reconciliation
verified: 2026-07-15T00:00:00Z
status: passed
score: 4/4 requirements verified
overrides_applied: 0
human_verification: []
---

# Phase 27: Baseline Truth & Roadmap Reconciliation Verification Report

**Phase Goal:** Maintainers can see exactly what exists, what is partial or demo-backed, what the baseline command surfaces actually do, and which ADRs must be decided before v5 architecture-changing work proceeds.
**Verified:** 2026-07-15
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| BASE-01 | Maintainer can read a current inventory of apps, packages, services, database migrations/tables, queues, and public route domains | ✓ VERIFIED | `docs/architecture/current-state-truth-matrix.md` now contains `## Grouped Repository Inventory`, covering apps, packages, standalone services, canonical `/api/v1` domains, legacy/public edges, queue/worker surfaces, database migrations, and operator entrypoints. |
| BASE-02 | Maintainer can read a feature truth matrix marking each imported roadmap phase/capability as shipped, partial, demo, absent, or deferred | ✓ VERIFIED | `## Imported Roadmap Phase Mapping` now uses single strict status labels and tighter repo-visible evidence for all imported phases 0-14. |
| BASE-03 | Maintainer can run or read a documented baseline for lint, typecheck, tests, builds, migrations, and local boot commands without hiding failures | ✓ VERIFIED | `## Baseline Command Matrix` documents root/app command surfaces and actual outcomes from execution: API test/build pass, root build pass, typecheck spot-runs pass, Workspaces lint fails, CMR/Marketplace lint are interactive, migrate fails, and Docker local-boot validation is blocked by environment/tooling. |
| BASE-04 | Maintainer can see the ADR gap list needed before architecture-changing PRs proceed | ✓ VERIFIED | `## ADR Gaps Before Architecture-Changing PRs` names the missing decisions around request context, public trust, demo policy, schema truth, events/outbox, workflow persistence, matching-engine contract, and migration/bootstrap policy. |

**Score:** 4/4 requirements verified

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase 27 output stayed concentrated in one primary truth artifact rather than fragmenting the baseline across multiple competing docs | ✓ VERIFIED | `docs/architecture/current-state-truth-matrix.md` now contains grouped inventory, roadmap mapping, command baseline, and ADR gaps in one document; Phase 27 execution touched that file as the core artifact and summarized it in `27-01-SUMMARY.md`. |
| 2 | Status calls were biased downward and grounded in repo-visible evidence | ✓ VERIFIED | Imported roadmap rows now use singular `Partial`, `Demo`, `Absent`, or `Deferred` style labels instead of mixed optimistic labels; evidence cites visible routes, workers, builds, manifests, and migrations. |
| 3 | Demo/stub/runtime caveats were attached inline to the affected surfaces | ✓ VERIFIED | Worker wiring, public-route risk, lint interactivity, migration drift, and local-boot failure are all documented where those surfaces are inventoried, not hidden in a detached appendix. |
| 4 | Operational drift affecting future phases was surfaced explicitly | ✓ VERIFIED | The matrix now records development Compose mounting only through migration `020`, skipping `017` and omitting `021-025`, making schema/bootstrap drift visible before Phase 28-30. |

### Artifact Verification

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/architecture/current-state-truth-matrix.md` | Grouped inventory section | ✓ VERIFIED | `## Grouped Repository Inventory` present |
| `docs/architecture/current-state-truth-matrix.md` | Imported roadmap truth matrix | ✓ VERIFIED | `## Imported Roadmap Phase Mapping` present and rewritten |
| `docs/architecture/current-state-truth-matrix.md` | Baseline command matrix | ✓ VERIFIED | `## Baseline Command Matrix` present |
| `docs/architecture/current-state-truth-matrix.md` | ADR gap register | ✓ VERIFIED | `## ADR Gaps Before Architecture-Changing PRs` present |
| `.planning/phases/27-baseline-truth-roadmap-reconciliation/27-01-SUMMARY.md` | Execution summary with task commits and findings | ✓ VERIFIED | Summary present, references the docs commit and baseline findings |

### Behavioral Spot-Checks

| Check | Result | Status |
|-------|--------|--------|
| `npm run test --workspace @vectra/api` | 102 tests passing | ✓ PASS |
| `npm run build --workspace @vectra/api` | exit 0 | ✓ PASS |
| `npm run build` | root workspace build exits 0 across API, CMR, Marketplace, Workspaces | ✓ PASS |
| `npm run lint --workspace @vectra/workspaces` | exits non-zero with existing lint findings | ✓ PASS - failure preserved as truth |
| `npm run migrate --workspace @vectra/api` | exits non-zero with SCRAM/password setup error | ✓ PASS - failure preserved as truth |
| `docker compose config` | environment cannot invoke `docker.exe` successfully | ✓ PASS - blocked local-boot truth recorded honestly |

### Commits Verified

| Commit | Purpose | Status |
|--------|---------|--------|
| `2a666b5` | Harden current-state truth matrix | ✓ VERIFIED |
| `d8401f4` | Record execution summary and execution-state update | ✓ VERIFIED |

### Gaps Summary

No execution gaps remain for Phase 27's planned scope. This phase was intentionally an audit/documentation phase, and the resulting artifact now directly satisfies all four roadmap success criteria.

The remaining issues surfaced by Phase 27 are not verification failures for this phase; they are the intended outputs of the phase:

- security/tenancy/capability ADR debt
- public-endpoint trust-model debt
- migration/bootstrap drift
- durable event/workflow contract debt
- uneven command/operator readiness across apps and environments

Those are now explicit inputs to later phases, not hidden blockers inside Phase 27.

---

*Verified: 2026-07-15*
*Verifier: Codex inline verification*
