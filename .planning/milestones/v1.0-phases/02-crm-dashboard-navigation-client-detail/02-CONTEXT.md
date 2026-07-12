# Phase 2: CRM Dashboard, Navigation & Client Detail - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Give clients a dedicated home in the app: rename the never-built "Records" sidebar slot to "CRM" (linking to `/records`), build a full-page CRM dashboard listing all clients, and build a client detail page (address, notes, responsible employee, current situation, timeline) that opens in a new tab. Client detail pages must also be creatable from the existing Notion-like project page creator, not only from the dashboard. Per-project client overrides and linked-projects UI are explicitly out of scope — deferred to Phase 3.

</domain>

<decisions>
## Implementation Decisions

### CRM Dashboard
- **D-01:** Dashboard is a full-page data table (not the compact card style used by the existing `CrmClientsBlock`). Row click opens the client's detail page in a new tab.
- **D-02:** Default visible columns: name, country, credit status (utilization bar/badge, green/amber/red), responsible employee.
- **D-03:** Dashboard supports a name search box plus an over-limit filter toggle. No full filter bar in v1.
- **D-04:** Keep a simple "Add client" button/modal for single-client creation. Bulk creation via Excel import remains a separate Phase 4 workflow — do not remove single-add in this phase.

### Client Detail Page Data Model
- **D-05:** `project_pages.project_id` is `NOT NULL` today — client detail pages CANNOT be plain `project_pages` rows. Create a new `client_pages` table mirroring `project_pages`' structure (title, icon, `config` JSONB block-document), keyed by `client_id` instead of `project_id`. This reuses the same block-canvas renderer/editor components against the new table.
- **D-06:** `client_pages` is unique on `client_id` — one detail page per client, no duplicates.
- **D-07:** DET-04 (create from page creator) is implemented as a "New client page" entry point inside the existing project page creator's add-page menu. Selecting it prompts for a client (existing or quick-create), then opens/creates that client's `client_pages` row.
- **D-08:** If a user picks an already-paged client again from the creator, open the existing detail page — do not create a duplicate.

### Detail Page Section Layout
- **D-09:** Layout is sidebar + main canvas: sidebar is a persistent settings panel for editable fields (address, notes, responsible employee); main area is the block canvas holding "current situation" (last 10 emails) and "timeline" as blocks — consistent with how project pages already mix fixed structure with block content.
- **D-10:** Sidebar fields use inline click-to-edit with autosave on blur/debounce — no explicit Edit/Save mode, matching the Notion-like feel of the rest of the page canvas.
- **D-11:** Email data doesn't exist until Phase 5. "Current situation" and the timeline's email entries render now with a visible empty state (e.g., "No emails synced yet") — do not hide these sections. This satisfies the roadmap's "timeline/section render correctly with empty state" success criterion directly.
- **D-12:** Timeline is a single unified chronological feed (emails + billing/invoice events + chart data interleaved by date), each entry visually tagged by type (icon per type). No filter tabs in v1.
- **D-13:** Responsible-employee picker lists all team members in the company (reuses the existing team/users list) — no role-based filtering in v1.

### Claude's Discretion
- Exact table/column widths, icon choices for timeline entry types, and empty-state copy wording.
- Whether the "Add client" modal reuses `CrmClientsBlock`'s existing form fields/validation as-is or is rebuilt standalone (should still be simple, no new fields beyond what's already there: name, country, VAT ID, credit limit, default rate).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema
- `database/migrations/021_crm_extensions.sql` — client address/responsible_employee_id columns, `client_project_links` (Phase 3 concern, not this phase), `email_messages` table (Phase 5 consumer, but `client_pages` timeline must handle its absence gracefully now)
- `database/migrations/009_project_pages.sql` — existing `project_pages` table structure this phase's new `client_pages` table must mirror (title, icon, is_default, sort_order, config JSONB, created_by)

### Existing Block Canvas System (to be reused for client_pages)
- `apps/workspaces/src/lib/projectPage/blocks.ts` — `PageBlockKind` union, `PAGE_BLOCK_REGISTRY`, extensibility contract (add block kind → renderer → registry entry)
- `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` — live editor (drag, edit, slash menu) to be adapted/reused for client pages
- `apps/workspaces/src/components/projectPage/PageBlockView.tsx` — read-only block renderer
- `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx` — block config panel pattern

### Navigation & Existing CRM UI
- `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` — existing `{ name: 'Records', href: '/records', icon: Boxes, module: 'records' }` nav entry to rename/repoint to "CRM"
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` — existing compact client list + credit bar UI; reference for credit-bar visual logic, add-client form fields (name, country, VAT ID, credit limit, default rate), and client card styling to inform (not directly reuse) the new full-page table
- `apps/workspaces/src/lib/hooks/useCrm.ts` — existing `useClients`, `useCreateClient` hooks (frontend CRM hook layer)
- `apps/workspaces/src/lib/api/crm.api.ts` — `CrmClient` type and API wrapper functions

### New-Tab Navigation Pattern
- `packages/ui/src/appUrls.ts` — `crossAppUrl()` helper and existing new-tab link conventions (`target="_blank" rel="noopener noreferrer"`) to reuse for opening client detail pages

No external ADRs/PRDs beyond the above — requirements fully captured in REQUIREMENTS.md (NAV-01, NAV-02, CLI-01, CLI-02, CLI-03, DET-01, DET-02, DET-03, DET-04) and this document.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CrmClientsBlock.tsx`: credit-bar computation logic (`CreditBar` component: utilization %, green/amber/red thresholds, over-limit warning) — reusable in the new dashboard table's credit-status column.
- `useClients`/`useCreateClient` hooks in `useCrm.ts`: reusable as-is for dashboard data fetching and the "Add client" modal.
- Project page block canvas (`blocks.ts`, `PAGE_BLOCK_REGISTRY`, `LivePageCanvas.tsx`, `PageBlockView.tsx`): the extensibility contract (add block kind → renderer → registry) is designed to be reused; this phase's `client_pages` canvas should follow the same block-kind pattern, potentially sharing renderer components where block kinds overlap (e.g., a generic timeline/activity block).
- `crossAppUrl()` / existing `target="_blank"` link pattern: reusable for new-tab client detail page navigation.

### Established Patterns
- Blocks fetch their own data independently, keyed on a subject id (currently always `project id`) — this phase extends that pattern to also key on `client id` for client_pages blocks, without needing to change the block fetching contract itself, only which id gets passed.
- No ORM — all schema changes via new idempotent numbered SQL migration files (`NNN_description.sql`).
- Frontend CRM components already call the `crm` domain (not `billing`) per Phase 1 — this phase's dashboard/detail page must continue using `useCrm`/`crm.api.ts`, not reintroduce any billing-domain client fetching.

### Integration Points
- `WorkspaceSidebar.tsx` — nav item rename/repoint (`Records` → `CRM`, same `/records` href and `module: 'records'` gate).
- Project page creator's "add page" menu — new "New client page" entry point (exact file location for this menu should be identified during planning/research, not assumed here).
- `apps/api/src/domains/crm/` — new endpoints needed for `client_pages` CRUD (get/create/update by client_id) and dashboard listing with search/filter; must follow existing controller/service/repository/routes/dto layering.

</code_context>

<specifics>
## Specific Ideas

- Full-page table dashboard (not cards) — explicit rejection of reusing `CrmClientsBlock`'s visual style at the dashboard level, even though its computation logic (credit bar) is reused.
- "New client page" should feel like a natural extension of the existing page creator menu, not a bolted-on separate flow.
- Timeline entries should be visually tagged by type (icon-based), not separated into different UI regions.

</specifics>

<deferred>
## Deferred Ideas

- **Linked projects / per-project overrides on the detail page** — explicitly deferred to Phase 3, which already covers CLI-04 (attach client to projects) and CLI-05 (per-project overrides). This phase's detail page shows client-level fields only.
- **Role-based responsible-employee picker** — all team members are eligible in v1; a role-scoped picker (e.g., only dispatchers/sales) was considered and rejected as unnecessary scope for now. Could resurface as a v2 refinement if the flat list proves too noisy.
- **Timeline type-filter tabs** — considered and rejected in favor of a single unified feed for v1; could be added later if users want to narrow by event type.

### Reviewed Todos (not folded)
None — no todos matched this phase.

</deferred>

---

*Phase: 2-crm-dashboard-navigation-client-detail*
*Context gathered: 2026-07-05*
