# Phase 23: Record Detail Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 23-record-detail-page
**Areas discussed:** Record title source, Multi-select property editor style, Design-system override (shadcn)

---

## Record title source

| Option | Description | Selected |
|--------|-------------|----------|
| First schema property | Whatever property is first in the schema array is the title. Zero extra convention, matches Notion's actual behavior, no data-model changes. | ✓ |
| Reserved "title" property id | Every collection must have a property literally id'd "title"; requires collection-creation code (not yet built) to always seed one, plus backfill for existing Phase 22 collections. | |

**User's choice:** First schema property (Recommended)
**Notes:** Matches RESEARCH.md's own recommendation (A1); this convention also governs how Phase 24's board cards will source a display title.

---

## Multi-select property editor style

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox list | Vertical list of checkboxes, all visible at once. Matches the panel's plain-native-input style used elsewhere. | |
| Multi-chip toggle | Options render as clickable pill/chip buttons, filled = selected. More compact, closer to Notion's tag look, but a new UI pattern with no existing analog in this codebase. | ✓ |

**User's choice:** Multi-chip toggle
**Notes:** No existing chip-toggle component in `apps/workspaces` — this will be a small new component, not a clone of an existing pattern. Phase 24+ board columns should reference the same visual treatment.

---

## Design-system override (shadcn)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep hand-rolled Tailwind | No shadcn. Matches UI-SPEC's default, CLAUDE.md's "reuse over rebuild" constraint, and the directly-analogous sibling page this phase clones. | ✓ |
| Introduce shadcn now | Initialize `components.json`, start using shadcn for this phase's new UI. Diverges from every other page in the app mid-milestone. | |

**User's choice:** Keep hand-rolled Tailwind (Recommended)
**Notes:** User confirmed UI-SPEC's flagged default rather than overriding it.

---

## Claude's Discretion

- **Testability entry point** (not discussed) — planner may choose either a minimal temporary record-list scratch view or rely on direct-URL navigation + manual verification, since Phase 24 (board) doesn't exist yet to provide a real entry point.
- Exact `select`/`multi-select` `options` storage shape, person-property picker implementation — already specified in RESEARCH.md/UI-SPEC, not re-litigated.

## Deferred Ideas

None — discussion stayed within phase scope.
