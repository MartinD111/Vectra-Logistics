# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Workspace Engine (Engine Unification)

**Shipped:** 2026-07-12
**Phases:** 7 | **Plans:** 8 | **Timeline:** 2026-07-06 → 2026-07-12 (6 days)

### What Was Built
- A generic `WorkspaceBlockRegistry` + `WorkspaceBlockPlugin` contract (native + manifest flavors) and an exhaustive `pageBlockRegistry` over all 30 `PageBlockKind`s, enforced at compile time
- Registry-driven read and edit dispatch replacing both of `PageBlockView`'s and `LivePageCanvas`'s hand-maintained `switch(block.kind)` statements
- Mini Program's `BlockView` folded onto the same shared `WorkspaceBlockRegistry` class (not a parallel copy)
- A shared `buildPaletteItems` helper deriving both the page slash menu and mini-program add-menu from registry data
- Proof of the core extensibility promise: a native `callout` block (3 files touched, zero dispatch edits) and a manifest `rowCountCallout` plugin (zero new vocabulary, zero dispatch edits)
- `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` documenting the engine, plus explicit parking of the automations `WorkflowBuilder.tsx` as a deferred future migration target

### What Worked
- Generalizing the existing Mini Program plugin architecture instead of designing a new engine from scratch kept the milestone genuinely tight (7 phases, 8 plans, 6 days)
- Keeping `PageBlock` and `Block` as two typed registries over one shared generic class (rather than merging unions) avoided persisted-JSON churn while still proving "one engine"
- The extensibility proof phase (12) was a strong forcing function — it caught that the claim ("add a block = one plugin entry") needed to be demonstrated, not just asserted
- Phase 13's cleanup verification (re-reading all 6 touched files, re-running `tsc --noEmit`, re-grepping for `switch(block.kind)`) caught nothing — confirming Phases 7-12's work was already clean, which is itself a good signal about execution discipline in those phases

### What Was Inefficient
- Phases 7-11 never ran `verify_phase_goal` — no VERIFICATION.md was produced, and REQUIREMENTS.md checkboxes were left stale for 8 of 14 requirements. This wasn't caught until the milestone audit, which had to re-verify those phases from scratch via direct code inspection instead of trusting an existing verification trail
- Two consecutive phase-13 executor attempts failed because `isolation="worktree"` kept branching from a stale cached commit (weeks old) instead of current `main` — cost ~5 minutes and two discarded worktrees before falling back to sequential execution on the main tree

### Patterns Established
- ADR-writing as the explicit final phase of an engine-unification-style milestone, paired with a "sweep for leftover cruft" verification task — worked well as a closing ritual
- When a milestone's own audit needs to independently re-verify prior phases' claims (due to missing VERIFICATION.md), the gsd-integration-checker agent doing direct source-and-git inspection (not just reading SUMMARY.md) is an effective backfill

### Key Lessons
1. Missing VERIFICATION.md is a silent debt generator — REQUIREMENTS.md checkboxes and audit trails degrade together. Watch for the executor completing tasks and writing SUMMARY.md without a corresponding verifier pass; that gap compounds across phases before anyone notices.
2. If `isolation="worktree"` produces a worktree branched from an unexpectedly old commit, don't retry the same isolation mode blind — verify the worktree's HEAD against the expected base before doing any work, and fall back to sequential execution on the main tree if the isolation mechanism can't be trusted in the moment.
3. "Generalize the existing pattern, don't invent a new one" (reusing Mini Program's plugin architecture for the shared engine) kept scope genuinely tight — worth defaulting to this when a similar system already exists in the codebase.

### Cost Observations
- Sessions: 1 (this execute-phase + complete-milestone session covered Phase 13 execution through milestone archival)
- Notable: two wasted worktree-isolation attempts before falling back to sequential execution added rework but no lasting cost — worktrees were discarded before any bad commits landed

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 6 | Initial CRM Rework — first milestone, no retrospective captured |
| v2.0 | 1 (Phase 13 + close) | 7 | First milestone with a formal RETROSPECTIVE.md; surfaced the missing-VERIFICATION.md pattern for the first time |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | — | — | — |
| v2.0 | `tsc --noEmit` + `next build` per phase (no new automated test suite) | — | 0 (zero new dependencies added) |

### Top Lessons (Verified Across Milestones)

1. Missing phase-level verification (VERIFICATION.md) creates compounding documentation debt that's expensive to reconstruct retroactively — first observed in v2.0 (Phases 7-11).
