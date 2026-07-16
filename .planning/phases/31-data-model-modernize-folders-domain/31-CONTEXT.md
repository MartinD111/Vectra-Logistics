# Phase 31: Data Model + Modernize Folders Domain - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Schema and backend-domain modernization only — no UI in this phase (that's Phases 32-34).

Delivers:
- `data_collections.folder_id` column, mirroring `projects.folder_id`/`programs.folder_id`.
- Composite `(id, company_id)` FK invariant across folders/projects/programs/collections/pages so no row can be reparented cross-tenant, enforced at the DB level.
- Cycle rejection (moving a node into its own descendant) at both DB and API level.
- `archived_at` on folders/projects/programs (and cascaded to collections/pages), with cascade archiving in a single transaction.
- Ancestor-index (materialized path or ancestor array) replacing per-request recursive lookups for tree/breadcrumb queries.
- Full `folders` domain migration to the v5 `RequestContext` + capability assertion + `event_outbox` pattern (no `recordEvent()`/`activityLog` calls remain).

</domain>

<decisions>
## Implementation Decisions

### Archive vs. Delete Semantics
- **D-01:** Archive replaces delete as the primary removal path for folders, projects, and programs that have content/descendants. Hard `DELETE` may remain only for a genuinely empty node (no children, no attached projects/collections/pages) — the researcher/planner should confirm whether keeping a hard-delete path for empty nodes is still worth the extra code path or whether archive-only is simpler to implement uniformly.
- **D-02:** This is a behavior change across all three node types being modernized (folders, projects, programs) — not folders-only. Projects/programs currently have no delete/removal endpoint at all; this phase introduces archive as their first removal mechanism.
- **D-03:** Unarchive (restore `archived_at` to `NULL`) is in scope for this phase at the repository/service level, even though there's no "view archived" UI until Phase 34. Build the restore path now alongside archive to avoid a second migration-adjacent change later.

### Depth Limit
- **D-04:** Enforce a max nesting depth of **3 levels** for folders (a top-level folder = depth 1) now, in Phase 31, at the point create/move mutations are already being touched for the v5 pattern migration. Reject creates/moves that would exceed depth 3, at the service layer (DB constraint optional, service-level guard is the minimum bar).

### Event Granularity for Cascading Archive
- **D-05:** When archiving a folder cascades `archived_at` to N descendant folders/projects/programs/collections/pages, emit **one durable event per affected node** (e.g., `folder.archived`, `project.archived`, `program.archived`, `data_collection.archived`, `project_page.archived`) rather than a single root event carrying a descendant-ID list. Matches the existing per-object event granularity pattern seen in `workflows.service.ts` (`workflow.manual_triggered`) and keeps downstream event consumers (notifications, future automations) simple — no list-unpacking required.

### Claude's Discretion
- Whether the ancestor-index is a materialized path string or an ancestor-ID array is intentionally left to the research phase (already flagged in STATE.md) — not decided here.
- The exact mechanism for the composite `(id, company_id)` FK invariant (composite FK vs. trigger vs. check constraint) is left to the research phase.
- Whether the depth-limit guard lives purely in the service layer or is backed by a DB check constraint is Claude's call during planning — D-04 only fixes the number (3) and that it's enforced now, not later.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §"Data Model & Folders Domain (HIER)" — HIER-01 through HIER-07, the locked requirements for this phase.
- `.planning/ROADMAP.md` §"Phase 31: Data Model + Modernize Folders Domain" — goal, success criteria, dependency on Phase 30.
- `.planning/PROJECT.md` §"Out of Scope" — confirms "Unlimited nesting depth" is explicitly out of scope, converging on 3-4 bounded levels (informed D-04).

### v5 Pattern to Replicate
- `apps/api/src/domains/workflows/workflows.service.ts` — canonical example of the `RequestContext` + `assertCapability` + `createDurableEventEnvelope`/`event_outbox` pattern this phase must bring the folders domain onto.
- `apps/api/src/core/auth/request-context.ts` — `RequestContext`, `requireCompanyId`, `requireUserId` helpers.
- `apps/api/src/core/capabilities/index.ts` — capability assertion (`workspace.admin` already defined here; TREEAPI-04 gates tree mutation endpoints on it, so folders mutations should align).
- `apps/api/src/core/events/outbox.ts` — `createDurableEventEnvelope` and the durable event_outbox mechanism.

### Existing Schema to Modernize
- `database/migrations/006_folders.sql` — current `folders` table, `parent_id` with `ON DELETE CASCADE`, no `archived_at`, no ancestor-index.
- `database/migrations/004_projects_and_programs.sql` — `projects`/`programs` tables, no `archived_at` today.
- `database/migrations/025_records_views.sql` — `data_collections` (has `project_id`, needs `folder_id`), `collection_records`, `collection_views`.
- `database/migrations/009_project_pages.sql` — `project_pages` table (needs `archived_at` for cascade target per HIER-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/domains/workflows/workflows.service.ts` — direct template for RequestContext/capability/event_outbox usage; the folders domain rewrite should mirror its shape (assertCapability calls, requireCompanyId/requireUserId, createDurableEventEnvelope before/around repository writes).
- `apps/api/src/core/capabilities/index.ts` — `workspace.admin` capability already exists and is used elsewhere; reuse rather than defining a new folder-specific capability (REQUIREMENTS.md explicitly rules out a finer-grained `tree.organize` capability for this milestone).

### Established Patterns
- Idempotent numbered SQL migrations (`NNN_description.sql`) — new migration file needed for `archived_at` columns, `data_collections.folder_id`, and whatever ancestor-index column the research phase selects.
- Current `folders.service.ts` `assertNotDescendant` walks one parent at a time via sequential DB queries in a loop — this is the per-request lookup pattern HIER-07 requires replacing with an ancestor-index.
- `foldersRepository.deleteFolder` currently issues a raw `DELETE FROM folders WHERE id = $1` relying on the DB's `ON DELETE CASCADE` on `parent_id` to remove subfolders; this hard-delete cascade path is being replaced by soft-archive per D-01/D-02.

### Integration Points
- `folders.controller.ts` / `folders.routes.ts` will need their handler signatures updated from `(companyId, actorId, body)` to accept `RequestContext` per HIER-05 — check current route wiring for auth middleware before assuming `req.user`/`req.companyId` shape carries over unchanged.
- `data_collections` already has a nullable `project_id` FK (locked schema per `docs/specs/core/workspace-blocks.md` §3.3, noted in `025_records_views.sql`'s header comment) — adding `folder_id` alongside it should not require touching that lock; confirm during planning that `folder_id` wasn't intentionally deferred there for a reason not visible in the migration file.

</code_context>

<specifics>
## Specific Ideas

- Archive should behave uniformly across folders, projects, and programs — same column name (`archived_at`), same cascade transaction, same event-per-node emission pattern.
- Depth limit is a hard 3, not 4 — pick the tighter bound from REQUIREMENTS.md's "3-4" range.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The "view archived" UI, restore-via-UI, and finer depth-limit UX messaging are already correctly sequenced into Phase 33/34 per REQUIREMENTS.md and were not re-litigated here.)

</deferred>

---

*Phase: 31-Data Model + Modernize Folders Domain*
*Context gathered: 2026-07-16*
