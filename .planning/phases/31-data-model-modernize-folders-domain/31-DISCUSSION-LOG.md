# Phase 31: Data Model + Modernize Folders Domain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 31-Data Model + Modernize Folders Domain
**Areas discussed:** Delete vs archive, Depth limit, Archive events, Unarchive scope, Scope of archive across node types

---

## Delete vs Archive Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Archive replaces delete | Archiving becomes the only removal path for a folder with descendants; hard DELETE stays only for a truly empty folder | ✓ |
| Keep both, archive is new/separate | Hard delete stays available as-is; archive is purely additive | |
| Remove hard delete entirely | Drop the delete endpoint/method now, even for empty folders | |

**User's choice:** Archive replaces delete
**Notes:** Followed up separately on whether this extends to projects/programs (see below).

---

## Depth Limit

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce now in Phase 31 | Add depth-limit enforcement while the mutation path is already being touched | ✓ |
| Defer to a later phase | Leave enforcement for Phase 34 (create/move UI) | |

**User's choice:** Enforce now in Phase 31
**Notes:** Follow-up fixed the number at 3 levels (top-level folder = depth 1), the tighter bound of REQUIREMENTS.md's "3-4 bounded levels" range.

---

## Archive Event Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One event per affected node | N durable events, one per row touched by the cascade | ✓ |
| One root event with descendant list | Single event on the acted-upon node, with descendant IDs in the payload | |

**User's choice:** One event per affected node
**Notes:** Matches the per-object event granularity already used in `workflows.service.ts` (`workflow.manual_triggered`).

---

## Unarchive Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include unarchive now | Build the restore path alongside archive in this phase | ✓ |
| Archive only, defer restore | Only build the archive/cascade direction now | |

**User's choice:** Include unarchive now
**Notes:** Avoids a second migration-adjacent change later, even though there's no "view archived" UI until Phase 34.

---

## Scope of Archive Across Node Types

| Option | Description | Selected |
|--------|-------------|----------|
| Folders, projects, and programs all get archive-only | Consistent archive-only behavior across all three modernized node types | ✓ |
| Folders only for now | Only folders' delete path is replaced; projects/programs keep current (non-existent) removal behavior | |

**User's choice:** Folders, projects, and programs all get archive-only
**Notes:** Projects/programs currently have no delete/removal endpoint at all — archive is their first removal mechanism.

---

## Claude's Discretion

- Ancestor-index representation (materialized path vs. ancestor-ID array) — left to the research phase, already flagged in STATE.md.
- Mechanism for the composite `(id, company_id)` FK invariant (composite FK vs. trigger vs. check constraint) — left to research phase.
- Whether the depth-limit guard is backed by a DB check constraint or is service-layer only — Claude's call during planning.

## Deferred Ideas

None — discussion stayed entirely within the Phase 31 schema/domain-modernization boundary.
