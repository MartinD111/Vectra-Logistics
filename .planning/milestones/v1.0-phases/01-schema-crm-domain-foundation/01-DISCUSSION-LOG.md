# Phase 1: Schema & CRM Domain Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 01-schema-crm-domain-foundation
**Areas discussed:** Client-project override storage shape

---

## Gray Areas Presented (Selection)

| Area | Description | Selected |
|------|-------------|----------|
| kpi_results client-subject fix | user_id NOT NULL resolution needed for client-risk evaluator | |
| Client-project override storage shape | New table vs JSONB for per-project overrides | ✓ |
| billing → crm migration strategy | Move client code wholesale vs. crm wraps billing | |
| email_messages table shape | Columns/granularity for synced email metadata | |

**Note:** Only "Client-project override storage shape" was selected for deep discussion. The other three areas were left to Claude's discretion, informed by fix-approaches already sketched in `.planning/codebase/CONCERNS.md`.

---

## Client-Project Override Storage

| Option | Description | Selected |
|--------|-------------|----------|
| New join table with explicit columns | `client_project_links(client_id, project_id, override_rate_eur, override_responsible_employee_id, override_notes)`. Type-safe, queryable, matches existing convention. | ✓ |
| Join table with single JSONB overrides column | More flexible for future fields without migration, but loses column-level type safety/query-ability. | |

**User's choice:** New join table with explicit columns

**Follow-up:** Fallback resolution for blank override fields.

| Option | Description | Selected |
|--------|-------------|----------|
| API/service layer resolves fallback | Repository returns raw override + global; service merges (`override ?? global`). Fallback logic testable in one place. | ✓ |
| SQL COALESCE at query level | `COALESCE(override_rate_eur, c.default_rate_eur)` directly in queries. Fewer moving parts, but duplicated across queries. | |

**User's choice:** API/service layer resolves fallback

---

## Claude's Discretion

- `kpi_results.user_id` NOT NULL fix — resolve using codebase conventions and the CONCERNS.md sketch; must be decided in this phase since Phase 6 depends on it
- billing → crm migration strategy — CONCERNS.md recommends moving client operations out of billing into crm
- email_messages table shape — CONCERNS.md already sketches a concrete schema; use as starting point

## Deferred Ideas

None — discussion stayed within phase scope.
