# Phase 13: Cleanup, ADR & Park WorkflowBuilder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 13-cleanup-adr-park-workflowbuilder
**Areas discussed:** Switch-cleanup scope, WorkflowBuilder deferral note

---

## Switch-cleanup scope

### Q1: Do the settings-panel switches (BlockSettings.tsx, PageBlockSettings.tsx) count as "dead duplication" to remove in Phase 13, or are they explicitly kept as-is?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep them, out of scope | Success criteria only requires no switch in render/edit paths (already done in Phases 8-10). Settings forms are inherently per-kind bespoke UI — forcing them onto the registry would be a new abstraction, not cleanup. Note this explicitly in the ADR as an intentional exception. | ✓ |
| Fold into registry too | Extend WorkspaceBlockPlugin with an optional settings renderer per kind, and migrate both switches onto it — more thorough but adds new scope/risk not covered by Phase 12's proof and not in the roadmap success criteria. | |

**User's choice:** Keep them, out of scope.
**Notes:** Confirmed these two files (`BlockSettings.tsx`, `PageBlockSettings.tsx`) are settings-form switches, not render/edit dispatch — DOC-01's `rg` check is scoped to render/edit paths only.

### Q2: Besides the two `switch(block.kind)` statements, should this phase also sweep for other now-dead leftovers from Phases 7-12?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, grep and remove obvious leftovers | Quick sweep of the touched files (PageBlockView.tsx, BlockView.tsx, LivePageCanvas.tsx, registry files) for anything the switch-removal left behind — keeps the ADR's "clean slate" claim honest. | ✓ |
| No, strictly just the two success criteria | Only verify `rg 'switch (block.kind)'` is clean and write the ADR — don't go hunting for unrelated dead code, keep the phase tight. | |

**User's choice:** Yes, grep and remove obvious leftovers.
**Notes:** Scope bounded to files already touched by Phases 7-12's engine-unification work.

---

## WorkflowBuilder deferral note

### Q1: Should WorkflowBuilder.tsx get anything added to it, or stay 100% untouched?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay untouched, ADR-only | Matches success criterion #3 literally ("compiles unchanged"). Zero risk of breaking the demo component; the ADR is the single source of truth for the deferral note. | ✓ |
| Add a short header comment | One or two lines at the top of WorkflowBuilder.tsx pointing future readers at the ADR — slightly more discoverable in-place, but technically "changes" the file even if behavior is identical. | |

**User's choice:** Stay untouched, ADR-only.

### Q2: How much detail should the ADR's WorkflowBuilder section give?

| Option | Description | Selected |
|--------|-------------|----------|
| Fuller: why deferred + future migration shape | Name it as the 3rd parallel system (demo-only, hardcoded initialNodes, no registry/persistence), explain why it's out of v2.0 scope (Automation Engine is its own future milestone per PROJECT.md), and sketch how a WorkflowNode could someday become a WorkspaceBlockPlugin ('trigger'/'condition'/'action' as plugin kinds). | ✓ |
| Brief pointer only | One or two sentences: WorkflowBuilder.tsx is demo-only, not yet on the engine, deferred to a future automations milestone. No migration sketch. | |

**User's choice:** Fuller — why deferred + future migration shape.

---

## Claude's Discretion

- ADR file location/format (single `docs/` file vs. starting a `docs/adr/NNNN-title.md` series) — not discussed, left to planner/executor.
- Depth of the "package-promotion path" ADR section (DOC-02) — not discussed; `packages/*` cited as existing precedent to reference.

## Deferred Ideas

None — discussion stayed within phase scope.
