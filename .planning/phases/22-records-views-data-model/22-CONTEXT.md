# Phase 22: Records + Views Data Model - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A company-scoped, schema-driven records database exists as a new API domain, independent of any UI. This phase delivers the data model and API only: `data_collections` (property schema), `collection_records` (props + PageConfig-shaped body, with `parent_record_id` for sub-items), and `collection_views` (saved board/table/calendar/gallery/list/timeline lenses with groupBy/subGroupBy/filters/sorts/cardProperties). No frontend, no `collection-view` page block, no board drag-and-drop — those are Phases 23-26.

</domain>

<decisions>
## Implementation Decisions

### Collection Scoping
- **D-01:** Collections are company-wide only in this phase. `data_collections.project_id` exists per the spec's schema (nullable FK) but stays unused/NULL for all Phase 22 API paths — project-scoped collections are a later phase's concern, not built or tested now.

### Props Validation
- **D-02:** The API type-checks each prop value against the collection's schema on record create/update and rejects the write (400) on a type mismatch (e.g. a `number` property given a non-numeric value). Loose/unchecked JSONB storage was explicitly rejected — validating now keeps data clean for the view/filter phases that read `props` later.

### Default View Creation
- **D-03:** Creating a collection also auto-creates one default `collection_views` row (type `table`, empty/default config) in the same operation, so a collection always has at least one queryable view without a separate explicit call.

### Claude's Discretion
- **Relation property behavior** — the spec lists `relation` (→ another collection) as a property type but Phase 22 doesn't need to fully resolve single-vs-multi or bidirectionality; the planner/researcher should pick the simplest storage that satisfies REC-01 (an array of referenced record ids is a reasonable default) and note it as an assumption, not re-ask the user.
- Exact validation error shape/messages, DTO/Zod schema structure, and repository/service file layout — follow existing domain conventions (see Code Context below).
- `rollup`/`formula` property types are explicitly "later" per the spec — not in scope for Phase 22's type set.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Records + Views schema and product spec (primary — schema is already locked here)
- `docs/specs/core/workspace-blocks.md` §3.1 — property types, Record/View concept definitions
- `docs/specs/core/workspace-blocks.md` §3.3 — the exact `data_collections`/`collection_records`/`collection_views` SQL schema this phase must implement (copy verbatim into the migration; do not redesign)
- `docs/specs/core/workspace-blocks.md` §9 — build order confirms Records+Views (this phase) comes after content blocks (Phase 21, done) and before the card page/board view (Phases 23-24)
- `docs/specs/core/workspace-blocks.md` §10 — Do/Don't list (don't keep card data as page JSON; model boards as views over a records collection; keep every property/block generic)

### Project-level context
- `.planning/PROJECT.md` — milestone goal, "no ORM" constraint, `company_id`-scoping convention, steering rule that generic core primitives (record, template, etc.) stay generic vs. named vertical modules

### Reference shape for `body` (PageConfig)
- `apps/api/src/domains/projects/dto/page.dto.ts` — existing `PageConfig` shape that `collection_records.body` must match exactly (same version/blocks structure)
- `apps/api/src/domains/projects/projects.repository.ts` — existing pattern for storing/reading a JSONB page-shaped column

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/domains/projects/dto/page.dto.ts` — the `PageConfig` type/Zod schema to reuse as-is for `collection_records.body`, per the spec's "same shape as project_pages.config" requirement.
- Existing domain scaffolding pattern (`[domain].controller/service/repository/routes/types.ts` + `dto/`) used across `projects`, `crm`, `kpi` domains — this phase should add a new `apps/api/src/domains/records/` (or `collections/`) domain following that exact layout.

### Established Patterns
- Idempotent numbered SQL migrations (`NNN_description.sql`) in `database/migrations/`, `company_id`-scoped with `ON DELETE CASCADE`, `TIMESTAMPTZ DEFAULT NOW()` — the spec's §3.3 schema already follows this; the migration file just needs the next sequential number.
- Zod `.safeParse()` in services before repository calls, `AppError(400, message)` on validation failure — this is the mechanism to use for the props-schema type-check decision (D-02).
- All domain routes protected by `authenticateToken` + company scoping via `req.companyId`.

### Integration Points
- No dependency on Phase 21 (missing content blocks) — ROADMAP.md marks Phase 22 as "parallel-safe with Phase 21; pure backend." The `body` PageConfig shape is independent of which block kinds exist; new block kinds from Phase 21 just become renderable inside `body` for free once Phase 23 wires up the card page.

</code_context>

<specifics>
## Specific Ideas

No specific UI/behavior references — this phase is explicitly backend-only ("independent of any UI" per the ROADMAP goal). The three decisions above (scoping, validation, default view) are the concrete asks; everything else follows the spec schema and existing domain conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Project-scoped collections, relation bidirectionality, and rollup/formula properties were explicitly named as later-phase/discretion items above rather than new scope creep.

</deferred>

---

*Phase: 22-records-views-data-model*
*Context gathered: 2026-07-13*
