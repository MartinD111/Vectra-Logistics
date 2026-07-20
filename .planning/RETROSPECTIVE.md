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

## Milestone: v5.0 - Platform Foundation & Durable Execution

**Shipped:** 2026-07-15
**Phases:** 4 | **Plans:** 8

### What Was Built
- Baseline truth matrix and imported-roadmap reconciliation for the live v1-v4 platform.
- Typed request context and reusable capability service for future actions and integrations.
- Pilot cross-tenant/trust regression coverage and a documented Phase 28 security contract.
- Versioned durable event outbox, records collection-created transactional pilot, and dispatcher retry lifecycle.
- Persisted workflow drafts, manual notification-action runs, idempotent run rows, step logs, and real automation UI state.

### What Worked
- Sequencing security/capability work before event and workflow work made Phase 30 much cleaner: the workflow domain reused `workflow.build`, `workflow.run`, and RequestContext.
- Keeping Phase 30 to one supported graph avoided accidental platform sprawl while still proving persistence, validation, execution, and observability.
- The event catalog and workflow docs made the boundary between durable publication and durable run inspection explicit.

### What Was Inefficient
- Phase 28 artifacts were present but uncommitted at milestone close, forcing a late recovery/commit pass before tagging.
- GSD archive generation counted the full project state instead of the v5 phase range, requiring manual correction of v5 archive stats.
- Old v4 human-UAT/verification debt continues to appear in open-artifact audits during later milestone closeouts.

### Patterns Established
- Foundation milestones should include a final archive sanity check before tag creation: phase counts, plan counts, requirement traceability, and whether earlier phase artifacts are actually committed.
- A narrow MVP graph contract is a useful way to prove workflow infrastructure without committing to scheduler/connector scope too early.
- Capability names should be created before feature domains consume them; this kept workflow authorization boring in the best way.

### Key Lessons
1. Before closing a milestone, run `git status` scoped to every phase in the milestone, not only the latest phase.
2. If archived stats look suspicious, trust the phase directories and summaries over generated counters.
3. Carrying old human-UAT debt is manageable when it is explicitly acknowledged, but it will keep surfacing until resolved or archived as permanent tech debt.

### Cost Observations
- Sessions: 1 closeout session after Phase 30 execution.
- Notable: late Phase 28 commit recovery added time, but prevented tagging a milestone that would have omitted shipped foundation code.

---

## Milestone: v6.0 — Unified Workspace Hierarchy

**Shipped:** 2026-07-20
**Phases:** 4 | **Plans:** 21 | **Timeline:** 2026-07-16 → 2026-07-20 (4 days)

### What Was Built
- Tenant-safe, cycle-safe folder/project/program/collection schema with an ancestor-index, DB-level cycle/depth trigger, composite `(id, company_id)` FKs, and full migration to the v5 `RequestContext`/capability/`event_outbox` pattern.
- One aggregated `GET /folders/tree/full` read API (5 parallel flat queries, no fan-out) plus lock-safe (`FOR UPDATE`, 409-on-stale-set) reorder and move/reparent endpoints, capability-gated.
- Real expand/collapse sidebar tree replacing the flat hardcoded `ITEMS` list, with per-user persisted expand state, depth-aware module visibility, and live-tree breadcrumbs.
- Full organize flow: context-menu create + inline rename (the codebase's first context-menu component), drag-to-reorder/reparent via `@dnd-kit` with exact-server-text illegal-drop rejection, and archive with descendant-count confirmation + zero-descendant Undo.

### What Worked
- Wave-based parallel execution (4 waves, 2 plans in parallel where file scope didn't overlap) kept the milestone to 4 days despite 21 plans across 4 phases — the orchestrator's `files_modified` overlap check correctly serialized the two plans that did share files (34-04/34-06 both touching `TreeNodeRow.tsx`/`TreeSection.tsx`) by putting them in separate waves.
- Running phase-level verification (`gsd-verifier`) and code review (`gsd-code-reviewer`) immediately after each phase's waves merged — not deferred to milestone close — caught two real bugs (a missing `qk.fullTree` cache invalidation, and a cross-parent drag-drop misclassification) while the fix was still cheap and well-scoped, rather than compounding into the audit.
- Deferring `checkpoint:human-verify` tasks to end-of-phase (the project's `workflow.human_verify_mode` default) and consolidating all three phase-34 checklists into one UAT pass in the final VERIFICATION.md avoided three separate interruption points during otherwise-autonomous execution.

### What Was Inefficient
- The single most expensive gap this milestone was self-inflicted: Phase 31's own code review (`31-REVIEW.md`) found a critical folder-move atomicity/depth-validation bug, but phase 31 was signed off with `status: gaps_found` and the fix was never applied — it sat unresolved through phases 32-34 until the milestone audit's integration checker re-discovered it and confirmed it was reachable via the exact drag-to-reparent feature phase 34 shipped. A `gaps_found` phase verification should be a harder stop before advancing to the next phase, not a status that can be silently carried forward for 3 more phases.
- `REQUIREMENTS.md`'s traceability table stayed "Pending" for phases 31-33 throughout their execution (only phase 33's rows were ever flipped to "Complete") — a purely cosmetic staleness that both phase 34's and the milestone's own verification had to explicitly call out and route around rather than trust.

### Patterns Established
- When an integration checker confirms a phase-review-flagged bug is live and reachable through a shipped feature, fix it inline during the milestone audit (with regression tests) rather than opening a closure phase — this was fast (one function, one repository method, 3 tests) because the fix mirrored an existing correct pattern already in the same file (`archiveFolder`'s transaction shape).
- Frontend cache-invalidation parity checks (does the new mutation hook invalidate the same query key its sibling hooks do?) are a recurring, cheap-to-verify class of bug in this codebase — worth a standing check whenever a new `useMutation` hook is added alongside existing ones that share a cache key.

### Key Lessons
1. A phase verification result of `gaps_found` on a **data-integrity** finding (not a UI polish item) should block phase sign-off / next-phase start, not just get logged and carried forward — this milestone got lucky that the gap was caught before shipping to real users, not because the process caught it early.
2. Integration checkers are effective at re-surfacing previously-known-but-unfixed gaps when explicitly pointed at "is this still true, and is it reachable from the newest feature" — don't only ask them to find *new* wiring gaps.
3. Keep REQUIREMENTS.md traceability checkboxes in sync with phase completion in real time; treating them as "fix at audit time" means every verification pass downstream has to manually route around stale data instead of trusting it.

### Cost Observations
- Sessions: 1 (Phase 34 wave execution through milestone archival, continuous).
- Model mix: Sonnet 5 throughout (executor, verifier, code-reviewer, integration-checker subagents all inherited orchestrator model).
- Notable: fixing the CR-01/CR-02 gap inline during the audit (rather than a separate closure-phase round trip) cost roughly one extra tool-call cycle (read code, write fix, write tests, run tests) and avoided a second planning/discuss/execute cycle entirely.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 6 | Initial CRM Rework — first milestone, no retrospective captured |
| v2.0 | 1 (Phase 13 + close) | 7 | First milestone with a formal RETROSPECTIVE.md; surfaced the missing-VERIFICATION.md pattern for the first time |
| v5.0 | 1 (closeout) | 4 | First milestone to catch uncommitted phase artifacts at close via scoped `git status` |
| v6.0 | 1 (Phase 34 execution + close, continuous) | 4 | First milestone to fix a critical, audit-confirmed-reachable data-integrity gap inline during the audit itself, with regression tests, instead of deferring to a closure phase |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | — | — | — |
| v2.0 | `tsc --noEmit` + `next build` per phase (no new automated test suite) | — | 0 (zero new dependencies added) |
| v6.0 | `tsc --noEmit` (both apps) + `node --test` for the folders domain (48/48 passing after audit fix) per phase/audit | — | 0 (reused existing `@dnd-kit`, `xlsx`-style reuse-over-rebuild convention) |

### Top Lessons (Verified Across Milestones)

1. Missing phase-level verification (VERIFICATION.md) creates compounding documentation debt that's expensive to reconstruct retroactively — first observed in v2.0 (Phases 7-11).
2. A phase verification result of `gaps_found` on a data-integrity finding must block advancement, not just get logged — v6.0's Phase 31 folder-move bug sat unresolved through 3 more phases before the milestone audit caught it, by which point it was reachable through a shipped user-facing feature.
