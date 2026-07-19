# Phase 22: Records + Views Data Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 22-records-views-data-model
**Areas discussed:** Collection scoping, Props validation strictness, Default view creation

---

## Collection Scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Company-wide only for now | project_id column exists per spec but stays unused/NULL in this phase; project-scoping is a later phase's concern | ✓ |
| Support both from day one | API accepts an optional project_id on collection creation | |

**User's choice:** Company-wide only for now
**Notes:** Simplest API surface now; matches "pure backend" narrow scope of this phase.

---

## Props Validation Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side type validation | Reject a write if a prop value doesn't match its schema-declared type | ✓ |
| Loose storage, no validation | props is just JSONB, API stores whatever is sent | |

**User's choice:** Server-side type validation (Recommended option)
**Notes:** Catches bugs early, keeps data clean for later view/filter phases.

---

## Default View on Collection Creation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create one default view | Collection creation also inserts one collection_views row (type='table', empty config) | ✓ |
| Always explicit — no auto-create | Collection creation only creates the data_collections row | |

**User's choice:** Auto-create one default view (Recommended option)
**Notes:** Ensures downstream phases always have a view to render against without an extra step.

---

## Claude's Discretion

- Relation property representation (single vs multi, bidirectionality) — planner/researcher picks the simplest storage satisfying REC-01 (array of record ids), documented as an assumption.
- Exact validation error shape, DTO/Zod structure, repository/service file layout — follow existing domain conventions.
- `rollup`/`formula` property types — explicitly out of scope per spec ("later").

## Deferred Ideas

None — discussion stayed within phase scope.
