# Phase 3: Per-Project Client Overrides - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A client can be attached to one or more projects. Each attachment (a `client_project_links` row) can independently override rate, responsible employee, and notes for that project only — the client's global defaults are untouched, and other projects the client is attached to are unaffected. All UI for this phase lives on the client detail page; the project page side is out of scope.

</domain>

<decisions>
## Implementation Decisions

### UI Location
- **D-01:** All attach/override UI lives in a new "Linked Projects" section on the client detail page (extends the existing sidebar/canvas built in Phase 2). The project page is not touched in this phase — no reverse "attached clients" view on the project side (explicitly deferred).

### Attach Flow
- **D-02:** Attaching a client to a project uses a searchable project picker (dropdown/modal) listing all company projects. User selects a project to create the `client_project_links` row. Not gated on the client already appearing in that project's existing `CrmClientsBlock`.

### Override UX
- **D-03:** Override granularity is **per-field**, matching the `client_project_links` schema's three independent override columns (`override_rate_eur`, `override_responsible_employee_id`, `override_notes`). A client can override just rate on Project A while leaving employee/notes on global default.
- **D-04:** Each of the 3 fields shows an explicit override affordance: the global value renders greyed out/placeholder by default; an explicit action sets an override (switches to editable/entered state); a clear/reset action removes the override and reverts display to the global value. This is a deliberate contrast with Phase 2's client-sidebar pattern (always-editable, blank-means-default) — the toggle must make "this is overridden vs. this is inherited" visually unambiguous per field.

### Unlink
- **D-05:** A client can be detached from a project via an explicit unlink/remove action on the linked-project row. This deletes the `client_project_links` row entirely (all overrides for that project discarded). Re-attaching afterward starts fresh (no override history retained).

### Claude's Discretion
- Exact layout/visual treatment of the "Linked Projects" section (list vs. cards, expand/collapse per project row).
- Whether the project picker is a modal or inline dropdown.
- Exact interaction pattern for the per-field override toggle (e.g., pencil icon vs. explicit "Override" button vs. click-to-override) — must satisfy D-04's "visually unambiguous" requirement but the precise widget is unconstrained.
- Confirmation UX for unlink (e.g., whether a confirm dialog is needed given overrides are discarded).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (already exists — Phase 1)
- `database/migrations/021_crm_extensions.sql` (lines 22-35) — `client_project_links` table: `client_id`, `project_id`, `override_rate_eur`, `override_responsible_employee_id`, `override_notes`; unique on `(client_id, project_id)`; indexed on `project_id` and `company_id`. This phase does NOT need a new migration for the join table itself — only backend CRUD + frontend UI.
- `database/migrations/019_crm_billing.sql` (line 22) — `clients.default_rate_eur` is the global default this phase's rate override falls back to when unset.

### Fallback Resolution Pattern (established — Phase 1)
- `.planning/phases/01-schema-crm-domain-foundation/01-CONTEXT.md` (D-02) — fallback from blank override to client global default resolved in `crm.service.ts`, NOT via SQL COALESCE. Repository returns raw override + global values; service merges (`override ?? global`).

### Client Detail Page (existing — Phase 2, to extend)
- `apps/workspaces/src/app/records/[clientId]/page.tsx` — client detail page: `ClientSidebar` (address/notes/responsible-employee inline fields), `LivePageCanvas` block canvas. New "Linked Projects" section attaches here, following the `InlineTextField`/`ResponsibleEmployeeField` visual conventions but with the D-04 override-affordance behavior layered on top (not a direct reuse — the interaction contract differs).
- `apps/workspaces/src/lib/hooks/useCrm.ts` — existing `useClient`, `useUpdateClient`, `useClientPage`, `useUpdateClientPage` hooks; new hooks for linked-projects CRUD follow this same file/pattern.
- `apps/workspaces/src/lib/api/crm.api.ts` — `CrmClient`/`CreateClientInput` types and API wrapper functions; extend with linked-project types and calls.

### Backend CRM Domain (existing — Phase 1, to extend)
- `apps/api/src/domains/crm/` (`crm.controller.ts`, `crm.service.ts`, `crm.repository.ts`, `crm.types.ts`, `crm.routes.ts`, `dto/`) — new endpoints for linking/unlinking a client to a project and reading/writing per-project overrides belong here, following the existing controller → service → repository layering.
- `apps/api/src/domains/projects/` (`projects.repository.ts`) — reference for querying/validating project existence/ownership when attaching a client (project must belong to the same company).

### Project Requirements
- `.planning/REQUIREMENTS.md` — CLI-04 ("attach client to one or more projects"), CLI-05 ("override rate, responsible employee, and notes for a client on a specific project, without changing the client's global defaults")

No external ADRs/PRDs beyond the above — requirements fully captured in REQUIREMENTS.md and this document.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client_project_links` table (schema only, no CRUD yet): ready for the repository layer to query/insert/update/delete against.
- `ClientSidebar`'s `InlineTextField` and `ResponsibleEmployeeField` components in `page.tsx`: visual/structural reference for building the per-field override editors, though the interaction pattern is new (override toggle vs. always-editable).
- Fallback resolution pattern from Phase 1 (`override ?? global` in service layer): directly applicable — the same pattern resolves what to *display* for each field per project link.

### Established Patterns
- DDD domain layering (controller → service → repository) for all new `crm` domain endpoints.
- No ORM — if any new SQL is needed beyond what Phase 1 already created (e.g., indexes, minor adjustments), it goes in a new idempotent `NNN_description.sql` migration.
- Multi-tenancy: every query scoped by `company_id` — attaching a client to a project must validate both belong to the same company.

### Integration Points
- New endpoints in `apps/api/src/domains/crm/` for: list projects a client is linked to (with resolved override/global values), attach client to project, update override fields, detach/unlink.
- Client detail page (`apps/workspaces/src/app/records/[clientId]/page.tsx`) gains a new "Linked Projects" section — likely alongside or below the existing `ClientSidebar`, exact placement is Claude's discretion.
- Project picker needs a projects-list endpoint/hook to search across company projects — check if `apps/workspaces/src/lib/api/projects.api.ts` (or equivalent) already exposes a suitable list/search call before adding a new one.

</code_context>

<specifics>
## Specific Ideas

- The override toggle must make "overridden" vs. "inherited from global" visually obvious per field — this was explicitly called out as a deliberate departure from Phase 2's blank-means-default sidebar pattern.
- Unlinking is a real delete of the link row (overrides are discarded, not archived) — re-attaching starts fresh.

</specifics>

<deferred>
## Deferred Ideas

- **Attached-clients view on the project page** — explicitly deferred; this phase only builds the client-detail-page side. A future phase could add a read-only or editable list of attached clients to the project page itself.
- **Override history / audit trail on unlink** — not requested; unlinking simply deletes the row with no retained history.

### Reviewed Todos (not folded)
None — no todos matched this phase.

</deferred>

---

*Phase: 3-per-project-client-overrides*
*Context gathered: 2026-07-06*
