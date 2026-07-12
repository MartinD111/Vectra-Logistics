# Phase 3: Per-Project Client Overrides - Research

**Researched:** 2026-07-06
**Domain:** Express/DDD backend CRUD extension + Next.js client-detail-page UI, no new schema
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All attach/override UI lives in a new "Linked Projects" section on the client detail page (extends the existing sidebar/canvas built in Phase 2). The project page is not touched in this phase — no reverse "attached clients" view on the project side (explicitly deferred).
- **D-02:** Attaching a client to a project uses a searchable project picker (dropdown/modal) listing all company projects. User selects a project to create the `client_project_links` row. Not gated on the client already appearing in that project's existing `CrmClientsBlock`.
- **D-03:** Override granularity is per-field, matching the `client_project_links` schema's three independent override columns (`override_rate_eur`, `override_responsible_employee_id`, `override_notes`). A client can override just rate on Project A while leaving employee/notes on global default.
- **D-04:** Each of the 3 fields shows an explicit override affordance: the global value renders greyed out/placeholder by default; an explicit action sets an override (switches to editable/entered state); a clear/reset action removes the override and reverts display to the global value. This is a deliberate contrast with Phase 2's client-sidebar pattern (always-editable, blank-means-default) — the toggle must make "this is overridden vs. this is inherited" visually unambiguous per field.
- **D-05:** A client can be detached from a project via an explicit unlink/remove action on the linked-project row. This deletes the `client_project_links` row entirely (all overrides for that project discarded). Re-attaching afterward starts fresh (no override history retained).

### Claude's Discretion

- Exact layout/visual treatment of the "Linked Projects" section (list vs. cards, expand/collapse per project row).
- Whether the project picker is a modal or inline dropdown.
- Exact interaction pattern for the per-field override toggle (e.g., pencil icon vs. explicit "Override" button vs. click-to-override) — must satisfy D-04's "visually unambiguous" requirement but the precise widget is unconstrained.
- Confirmation UX for unlink (e.g., whether a confirm dialog is needed given overrides are discarded).

### Deferred Ideas (OUT OF SCOPE)

- **Attached-clients view on the project page** — explicitly deferred; this phase only builds the client-detail-page side. A future phase could add a read-only or editable list of attached clients to the project page itself.
- **Override history / audit trail on unlink** — not requested; unlinking simply deletes the row with no retained history.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-04 | User can attach a client to one or more projects | Backend list/upsert endpoints already exist (`crm.service.ts`); missing: project-picker UI, project-ownership validation on attach, and a DELETE/unlink endpoint (net-new this phase) |
| CLI-05 | User can override rate, responsible employee, and notes for a client on a specific project, without changing the client's global defaults | Fallback-merge logic already implemented in `crmService.listClientProjectLinks`/`upsertClientProjectLink` (`override ?? global`, D-02 from Phase 1); missing: per-field override UI with explicit toggle (D-04) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No ORM** — all schema changes via idempotent `NNN_description.sql` migrations. Not applicable this phase: the `client_project_links` table already exists (migration 021); no new migration is anticipated unless a gap below requires one (see Common Pitfalls).
- **Existing 403 behavior** — the credit-risk semaphore constraint is unrelated to this phase's scope (Phase 6), but the general principle of "don't introduce a second enforcement path" extends to reusing `assertOwnedProject`-style checks rather than inventing new authorization logic.
- **DDD backend layering** — controller → service → repository, one domain (`crm`) per bounded context; new endpoints must follow this file/folder convention exactly.
- **snake_case DB columns**, **Zod DTO validation**, **React Query hooks in `apps/workspaces/src/lib/hooks`** — all must be followed; see Code Examples below for the exact existing shape to extend.

## Summary

This phase is a **gap-filling exercise, not new construction**. Phase 1 (schema-crm-domain-foundation) already built roughly 70% of what CLI-04/CLI-05 need: the `client_project_links` table (migration 021), the full `ResolvedClientProjectView` fallback-merge type, `crmRepository.listProjectLinks`/`findProjectLink`/`upsertProjectLink`, `crmService.listClientProjectLinks`/`upsertClientProjectLink` (the exact `override ?? global` merge pattern per D-02), a `LinkProjectDto`/`LinkProjectSchema`, controller handlers `listClientProjectLinks`/`upsertClientProjectLink`, routes `GET/POST /clients/:id/projects`, and matching frontend `crm.api.ts` functions + `useCrm.ts` hooks (`useClientProjectLinks`, `useUpsertClientProjectLink`). All of this was written ahead of schedule as part of Phase 1's foundation work.

What is **missing** and must be built this phase:
1. **Unlink/detach**: no DELETE endpoint exists anywhere in the stack (repository, service, controller, routes, api client, or hook). D-05 requires a real delete of the `client_project_links` row — this is 100% net-new, one full layer stack (repo → service → controller → route → api client → hook).
2. **Project-ownership validation on attach**: `crmService.upsertClientProjectLink` validates the *client* belongs to the company (via `getClient`) but never validates that `project_id` belongs to the same company. Any authenticated user could currently link a client to another company's project ID if they guessed/obtained it. This must be fixed using the `assertOwnedProject`-style pattern already established in `projects.service.ts`.
3. **Project picker UI**: `projectsApi.list()` / `useProjects()` already exist and return all company projects — directly reusable for the D-02 searchable picker, no new list/search endpoint needed.
4. **"Linked Projects" section UI** on the client detail page, including the per-field override toggle (D-04) — entirely new component, structurally informed by but not reusing Phase 2's `InlineTextField`/`ResponsibleEmployeeField` (interaction contract differs: those are always-editable/blank-means-default, this needs an explicit override-vs-inherited state machine per field).

**Primary recommendation:** Add one repository method (`deleteProjectLink`), one service method (`unlinkClientProject` with an `assertOwnedProject`-equivalent check reused/added to `crm.service.ts`, and add the same ownership check retroactively to `upsertClientProjectLink`), one controller handler, one route (`DELETE /clients/:id/projects/:projectId`), one API client function, and one mutation hook — then build the "Linked Projects" section as new frontend UI reusing `useProjects()` for the picker and `useClientProjectLinks`/`useUpsertClientProjectLink`/new unlink hook for data.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attach client to project (create link row) | API/Backend | Database/Storage | `crm.service.ts` upsert already exists; needs added cross-company ownership check |
| Project picker (search/list company projects) | Browser/Client | API/Backend | Pure read via already-existing `useProjects()`/`projectsApi.list()` — no new backend work |
| Per-field override read (merged view) | API/Backend | Database/Storage | Already implemented: `crmService.listClientProjectLinks` merge logic (`override ?? global`) |
| Per-field override write (set/clear one field) | API/Backend | Database/Storage | Reuses existing `upsertClientProjectLink` — partial-field updates already supported since DTO fields are all optional/nullable |
| Unlink (delete link row) | API/Backend | Database/Storage | Net-new this phase — full repo→service→controller→route stack |
| "Linked Projects" section rendering + override toggle UI | Browser/Client | — | New React component on `apps/workspaces/src/app/records/[clientId]/page.tsx`; pure client-side state machine for override-vs-inherited display |

## Package Legitimacy Audit

Not applicable — this phase introduces no new external package dependencies. All work extends already-installed dependencies (`zod`, `pg`, `@tanstack/react-query`, `lucide-react`) already present in `apps/api` and `apps/workspaces` per `package.json`. No `npm install` step required.

## Standard Stack

No new libraries. 100% additive code on the existing stack already used by the `crm` and `projects` domains.

**Installation:** None required.

## Architecture Patterns

### System Architecture Diagram

```
Client Detail Page (apps/workspaces/.../records/[clientId]/page.tsx)
  │
  ├─ "Linked Projects" section (NEW component this phase)
  │     │
  │     ├─ Project picker (searchable dropdown/modal)
  │     │     └─ useProjects() ──────────────► GET /api/v1/projects (EXISTING, unchanged)
  │     │
  │     ├─ Linked project row (per project_id already attached)
  │     │     ├─ per-field override toggle × 3 (rate, employee, notes)
  │     │     │     └─ useUpsertClientProjectLink(clientId) ──► POST /api/v1/crm/clients/:id/projects (EXISTING)
  │     │     │            → crmService.upsertClientProjectLink
  │     │     │                 → [NEW] assertOwnedProject(project_id, companyId) check
  │     │     │                 → crmRepository.upsertProjectLink (EXISTING, ON CONFLICT DO UPDATE)
  │     │     │
  │     │     └─ Unlink button
  │     │           └─ [NEW] useUnlinkClientProject(clientId) ──► [NEW] DELETE /api/v1/crm/clients/:id/projects/:projectId
  │     │                → [NEW] crmService.unlinkClientProject
  │     │                     → [NEW] assertOwnedProject check (same as attach)
  │     │                     → [NEW] crmRepository.deleteProjectLink
  │     │
  │     └─ useClientProjectLinks(clientId) ──► GET /api/v1/crm/clients/:id/projects (EXISTING)
  │            → crmService.listClientProjectLinks → merge (override ?? global) → ResolvedClientProjectView[]
```

### Recommended Project Structure

No new files/folders — all changes are edits to existing files:

```
apps/api/src/domains/crm/
├── crm.repository.ts     # ADD: deleteProjectLink(clientId, projectId, companyId)
├── crm.service.ts        # ADD: unlinkClientProject(); ADD ownership check to upsertClientProjectLink
├── crm.controller.ts     # ADD: unlinkClientProjectLink handler
├── crm.routes.ts         # ADD: DELETE /clients/:id/projects/:projectId
apps/workspaces/src/lib/api/crm.api.ts      # ADD: unlinkClientProjectLink(clientId, projectId)
apps/workspaces/src/lib/hooks/useCrm.ts     # ADD: useUnlinkClientProjectLink(clientId)
apps/workspaces/src/app/records/[clientId]/page.tsx  # ADD: LinkedProjectsSection component
```

### Pattern 1: Reusing the established fallback-merge pattern (already implemented)

**What:** Override resolution (`override ?? global`) happens in the service layer, never in SQL. This is D-02 from Phase 1 and is fully implemented already in `crmService.listClientProjectLinks`/`upsertClientProjectLink`.
**When to use:** Any new read/write path this phase touches for override fields must call through these existing service methods — do not add a parallel merge implementation.
**Example (existing code, `apps/api/src/domains/crm/crm.service.ts` lines 47-88):**
```typescript
// ── Client-Project Links (D-02: override ?? global) ──
async listClientProjectLinks(clientId: string, companyId: string): Promise<ResolvedClientProjectView[]> {
  const client = await this.getClient(clientId, companyId);
  const links = await crmRepository.listProjectLinks(clientId, companyId);
  return links.map((l) => ({
    client_id: l.client_id,
    project_id: l.project_id,
    rate_eur: l.override_rate_eur ?? client.default_rate_eur,
    responsible_employee_id: l.override_responsible_employee_id ?? client.responsible_employee_id,
    notes: l.override_notes ?? client.notes,
    is_overridden: {
      rate: l.override_rate_eur !== null,
      responsible_employee: l.override_responsible_employee_id !== null,
      notes: l.override_notes !== null,
    },
  }));
}
```
`is_overridden` is exactly the flag the frontend's D-04 override toggle needs to decide "greyed out placeholder" vs "editable override" per field — no new backend computation required for the UI state machine.

### Pattern 2: `assertOwnedProject` cross-domain ownership check (established in `projects.service.ts`, NOT yet applied in `crm.service.ts`)

**What:** Every mutation that accepts a foreign-key ID belonging to another domain (e.g., `project_id`, `folder_id`, `user_id`) must verify that ID belongs to the same `company_id` before writing. `projects.service.ts` and `kpi.service.ts` both implement this as a private method.
**When to use:** Add an equivalent check to `crm.service.ts` before the `upsertProjectLink` call, and reuse it in the new `unlinkClientProject` method.
**Example (existing code, `apps/api/src/domains/projects/projects.service.ts` lines 181-186):**
```typescript
private async assertOwnedProject(id: string, companyId: string): Promise<Project> {
  const p = await projectsRepository.findProject(id);
  if (!p) throw new AppError(404, 'Project not found');
  if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
  return p;
}
```
`crm.service.ts` cannot call this private method directly (it's private to `ProjectsService`), but `projectsRepository.findProject(id)` is a public export and can be imported into `crm.service.ts` to build an equivalent local check — this is the same cross-domain pattern `kpi.service.ts` uses (`kpi.service.ts` imports project lookups the same way for its own `assertOwnedProject`).

### Pattern 3: Upsert-as-idempotent-attach (already implemented, confirm behavior for D-02's "attach" semantics)

**What:** `crmRepository.upsertProjectLink` uses `INSERT ... ON CONFLICT (client_id, project_id) DO UPDATE`. This means attaching a client to a project it's already attached to is a **silent update**, not an error — re-selecting the same project in the picker overwrites (or preserves, if fields sent are the same) the existing overrides rather than throwing a duplicate-key error.
**When to use:** The planner should decide whether "attach" (D-02, no overrides yet) and "set override" (D-03/D-04, specific field) share the same upsert call or need separate intents. Current backend only exposes one endpoint (`upsertClientProjectLink`) for both — the frontend must be careful not to send `override_rate_eur: null` etc. when the user is only trying to attach (which would silently clear an existing override on re-attach-with-no-fields, though the unique constraint prevents true duplicate rows). See Common Pitfalls below.

### Anti-Patterns to Avoid

- **Do not add a second endpoint for "attach without overrides"** — the existing `upsertClientProjectLink` endpoint already accepts a body where all three override fields are optional (`z...nullable().optional()` in `LinkProjectSchema`), so a bare `{ project_id }` POST is a valid "attach with no overrides yet" call. Adding a separate `POST /attach` endpoint would duplicate logic already covered.
- **Do not implement the override-merge logic in the frontend** — `is_overridden` and merged `rate_eur`/`responsible_employee_id`/`notes` are already computed server-side per `ResolvedClientProjectView`. The frontend should trust these fields as the single source of truth for what to render, not recompute `override ?? global` client-side.
- **Do not use SQL COALESCE for the merge** — explicitly rejected by Phase 1's D-02; would violate the established pattern if a planner is tempted to "simplify" via a JOIN query.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Fallback resolution (override vs global) | A new merge function or SQL COALESCE | `crmService.listClientProjectLinks`/`upsertClientProjectLink` (existing) | Already implemented and tested against D-02; a second implementation risks drift |
| Project ownership validation | Ad-hoc `if` checks scattered in controller | `projectsRepository.findProject(id)` + explicit `company_id` compare, following the `assertOwnedProject` pattern from `projects.service.ts`/`kpi.service.ts` | Matches CLAUDE.md's "row-level security via company_id" convention; consistent 403/404 semantics |
| Project search/list for the picker | A new project-search/autocomplete endpoint | `useProjects()` (`apps/workspaces/src/lib/hooks/useProjects.ts`) → `projectsApi.list()` | Already fetches all company projects; company project counts are small (SME logistics tenants), client-side filter/search in the picker is sufficient — no server-side search needed |

**Key insight:** This phase's backend surface area is almost entirely additive to already-existing, already-tested code from Phase 1. The main risk is *not* under-building but *duplicating* logic that already exists — always grep `crm.service.ts`/`crm.repository.ts`/`crm.api.ts`/`useCrm.ts` before adding a new function, since Phase 1 built ahead of its own stated scope.

## Common Pitfalls

### Pitfall 1: Missing project-ownership check on attach (confirmed gap)
**What goes wrong:** A malicious or buggy client could POST `{ project_id: "<uuid from another company>" }` to `/clients/:id/projects` and successfully create a `client_project_links` row pointing at a project outside the tenant's company — the FK constraint (`REFERENCES projects(id)`) only checks the project *exists*, not that it belongs to the same `company_id`.
**Why it happens:** `crmService.upsertClientProjectLink` currently calls `this.getClient(clientId, companyId)` (validates the client) but never validates `parsed.data.project_id` against `companyId`.
**How to avoid:** Add an ownership check (import `projectsRepository.findProject` or add a lightweight local lookup) before calling `crmRepository.upsertProjectLink`, throwing `AppError(404, 'Project not found')` / `AppError(403, 'Forbidden')` matching the existing pattern.
**Warning signs:** Any planner task that touches `upsertClientProjectLink` without adding this check should be flagged in review.

### Pitfall 2: Confusing "attach" with "set override" in the frontend
**What goes wrong:** If the "attach to project" picker action sends `override_rate_eur: null, override_responsible_employee_id: null, override_notes: null` for a link that's already partially overridden (unlikely on fresh attach, but relevant if the picker is reused for re-attach-after-unlink or accidentally re-submits stale form state), it would silently clear existing overrides via the `ON CONFLICT DO UPDATE` upsert.
**Why it happens:** The single upsert endpoint serves both "create the link" and "update one override field" intents; the DTO always expects/overwrites all three override fields together (whatever isn't sent becomes `null` per the service's `?? null` fallback in `upsertClientProjectLink`).
**How to avoid:** When implementing the per-field override toggle (D-04), the frontend mutation must always send the *current* full override state (all three fields) on every save, not just the field being edited — otherwise editing "rate" alone would wipe an existing "notes" override. This must read the current `ResolvedClientProjectView`'s raw override values (not the merged `rate_eur`/`notes` display values) before constructing the PATCH-equivalent POST body.
**Warning signs:** A per-field "Save" button that only sends the one field being edited will silently corrupt other fields' override state on that link row.

### Pitfall 3: No unlink endpoint exists — must be built as a full vertical slice
**What goes wrong:** Assuming "the backend is basically done" (true for attach/override) and treating unlink as a small addition. It requires new work at every layer: repository (`deleteProjectLink`), service (`unlinkClientProject` + ownership check), controller (handler), routes (new `DELETE` route), API client (`unlinkClientProjectLink`), and hook (`useUnlinkClientProjectLink`).
**Why it happens:** Phase 1 built ahead of scope for read/upsert but D-05 (unlink) wasn't part of Phase 1's stated foundation goals.
**How to avoid:** Plan this as its own task/wave — it's the single largest remaining backend chunk in this phase despite being conceptually simple (one `DELETE FROM client_project_links WHERE ...`).
**Warning signs:** None currently — just confirmed absent via full-file reads of `crm.repository.ts`, `crm.service.ts`, `crm.controller.ts`, `crm.routes.ts`, `crm.api.ts`, `useCrm.ts`.

### Pitfall 4: Route path collision risk for DELETE
**What goes wrong:** The existing routes are `GET/POST /clients/:id/projects`. A new `DELETE /clients/:id/projects/:projectId` route must be added carefully — Express route ordering matters only if there were ambiguous wildcard routes, but here it's safe since `:projectId` is a distinct path segment. No pitfall in practice, but the planner should place the new route directly after the existing `POST /clients/:id/projects` line in `crm.routes.ts` for readability, matching the file's existing "commented section" grouping style.
**Why it happens:** N/A — flagged as a non-issue after inspection, included for completeness since route ordering is a known Express footgun in other codebases.
**How to avoid:** N/A.

## Code Examples

### Existing: full override upsert flow (reuse as-is for D-03 write path)
```typescript
// Source: apps/api/src/domains/crm/crm.service.ts lines 65-88
async upsertClientProjectLink(clientId: string, companyId: string, body: unknown): Promise<ResolvedClientProjectView> {
  const parsed = LinkProjectSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  const client = await this.getClient(clientId, companyId);
  const link = await crmRepository.upsertProjectLink(companyId, {
    client_id: clientId,
    project_id: parsed.data.project_id,
    override_rate_eur: parsed.data.override_rate_eur ?? null,
    override_responsible_employee_id: parsed.data.override_responsible_employee_id ?? null,
    override_notes: parsed.data.override_notes ?? null,
  });
  return { /* merged ResolvedClientProjectView, as above */ };
}
```

### Needed: unlink repository method (net-new, following the `deleteProject`/`deleteFolder` convention)
```typescript
// Model on apps/api/src/domains/projects/projects.repository.ts deleteProject():
// async deleteProject(id: string): Promise<void> {
//   await db.query(`DELETE FROM projects WHERE id = $1`, [id]);
// }
// crm.repository.ts equivalent, scoped by BOTH client_id and company_id (no separate ownership
// check needed at the repository layer if the service already validated the client):
async deleteProjectLink(clientId: string, projectId: string, companyId: string): Promise<void> {
  await db.query(
    `DELETE FROM client_project_links WHERE client_id = $1 AND project_id = $2 AND company_id = $3`,
    [clientId, projectId, companyId]);
}
```

### Needed: project-ownership check for `crm.service.ts` (mirrors `projects.service.ts` private method)
```typescript
// New private method in CrmService, importing projectsRepository:
import { projectsRepository } from '../projects/projects.repository';
// ...
private async assertOwnedProject(projectId: string, companyId: string): Promise<void> {
  const p = await projectsRepository.findProject(projectId);
  if (!p) throw new AppError(404, 'Project not found');
  if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
}
// Call this at the top of both upsertClientProjectLink and the new unlinkClientProject,
// before touching crmRepository.
```

### Existing: project picker data source (reuse as-is, no changes needed)
```typescript
// Source: apps/workspaces/src/lib/hooks/useProjects.ts lines 37-45
export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
  });
}
```

## State of the Art

Not applicable — this is an internal, greenfield domain extension within an established in-house convention, not a public library/framework choice subject to ecosystem drift.

## Assumptions Log

No claims in this research are tagged `[ASSUMED]`. All findings were verified by directly reading the current repository source (migrations, backend domain files, frontend API/hook/page files) rather than relying on training knowledge or web search — this phase required zero external research since it is 100% internal codebase extension with no new libraries.

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (Table intentionally empty.)

## Open Questions

1. **Should the unlink endpoint validate project ownership, or is client + company scoping on the DELETE query sufficient?**
   - What we know: The DELETE query already scopes by `client_id`, `project_id`, AND `company_id` together — a cross-tenant delete attempt would simply affect 0 rows (no row matches all three conditions for another company's data), which is safe.
   - What's unclear: Whether the service layer should still return 404 for "link not found" vs. silently succeed on a no-op delete (idempotent delete semantics, similar to how `crmRepository.upsertProjectLink`'s conflict handling works).
   - Recommendation: Follow the existing `deleteProject`/`deleteFolder` convention in this codebase, which does not check row-existence before/after delete and returns 204 unconditionally (see `projects.controller.ts` `deleteProject`). Match that exact behavior for consistency — no special-casing needed.

2. **Does the per-field override toggle need a "confirm reset" step when clearing an override (D-04's "clear/reset action")?**
   - What we know: D-04 says clearing an override "reverts display to the global value" — a straightforward client-side + one API call.
   - What's unclear: Whether losing an override value should have any confirmation step, given CONTEXT.md's "Claude's Discretion" section explicitly leaves the unlink confirmation UX open but does not mention per-field reset confirmation.
   - Recommendation: No confirmation needed for per-field reset (it's a fast, low-consequence, reversible-by-re-entering-the-value action) — reserve any confirm dialog for the unlink action (D-05), which is comparatively higher-consequence (drops all three fields for a project at once). This is a recommendation for the planner/discuss-phase to ratify, not a locked decision.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the already-running Node/PostgreSQL stack used by every other phase. No new packages, no new infrastructure.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, `vitest.config.*`, or `*.test.ts`/`*.spec.ts` files exist anywhere in `apps/api` or `apps/workspaces` |
| Config file | none |
| Quick run command | — (no automated test runner configured) |
| Full suite command | — (no automated test runner configured) |

This matches Phase 2's precedent: `.planning/phases/02-crm-dashboard-navigation-client-detail/02-HUMAN-UAT.md` was used in lieu of automated tests, with manual verification items tracked as UAT. Phase 3 should follow the same pattern.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| CLI-04 | Attach client to project via picker; row appears in Linked Projects | manual-only | — (no framework) | ❌ Wave 0 — no test infra project-wide |
| CLI-04 | Cross-company project_id attach attempt is rejected (403/404) | manual-only | — | ❌ Wave 0 |
| CLI-05 | Setting an override on one field doesn't affect the other two fields on the same link | manual-only | — | ❌ Wave 0 |
| CLI-05 | Clearing an override reverts display to the global default value | manual-only | — | ❌ Wave 0 |
| CLI-05 | Overriding a field on Project A doesn't change the client's global value nor Project B's resolved values | manual-only | — | ❌ Wave 0 |
| D-05 | Unlink deletes the row; re-attach starts with no prior overrides | manual-only | — | ❌ Wave 0 |

**Justification for manual-only:** No test framework exists anywhere in this monorepo (confirmed via `apps/api/package.json` scripts — only `start`/`dev`/`build`, no `test` script). Introducing a test framework is out of scope for this phase per CLAUDE.md's "reuse over rebuild" constraint and Phase 2's own precedent of using manual UAT instead. Bootstrapping Jest/Vitest for this single phase would be disproportionate; if the project decides to adopt automated testing, that should be its own dedicated phase/decision, not smuggled into Phase 3's scope.

### Sampling Rate

- **Per task commit:** Manual smoke test of the specific endpoint/UI just built (e.g., curl the new DELETE route, or click through the new picker).
- **Per wave merge:** Full manual click-through of attach → override each field independently → verify global/other-project isolation → unlink → re-attach, matching the Phase Requirements → Test Map rows above.
- **Phase gate:** Human UAT checklist (mirroring `02-HUMAN-UAT.md`'s format) completed before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] No test framework installed project-wide — **not a gap to fix in this phase** (see justification above); flagged only for visibility.
- [ ] No fixtures/seed data helper for "two projects, one client, override on project A only" scenario — recommend the planner include a short manual UAT script (matching `02-HUMAN-UAT.md`'s style) as a phase deliverable instead of automated fixtures.

*(No automated test infrastructure gaps are being remediated this phase — manual UAT is the established and accepted verification method per Phase 2 precedent.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | no | Unchanged — existing `authenticateToken` middleware on all `crm` routes (`crm.routes.ts` line 11), not touched this phase |
| V3 Session Management | no | Unchanged |
| V4 Access Control | **yes** | Multi-tenant row-level scoping by `company_id` — this phase's core gap (Pitfall 1) is exactly a V4 access-control issue: cross-tenant `project_id` was not being validated. Fix: `assertOwnedProject`-equivalent check in `crm.service.ts`, mirroring `projects.service.ts`/`kpi.service.ts`. |
| V5 Input Validation | yes | Already covered by existing `LinkProjectSchema` (Zod) for the upsert body; the new unlink endpoint takes only path params (`clientId`, `projectId`) which should still be validated as UUID-shaped (Express route param, no body to validate, but consider a lightweight UUID format check to fail fast with 400 rather than a DB error on malformed input) |
| V6 Cryptography | no | Not applicable — no secrets/crypto touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Insecure Direct Object Reference (IDOR) — attaching a client to another tenant's project by guessing/obtaining a `project_id` UUID | Elevation of Privilege / Tampering | `assertOwnedProject`-equivalent check before every write that accepts a foreign `project_id` — this is the concrete, confirmed gap this phase must close (see Pitfall 1) |
| IDOR — unlinking another tenant's link row via crafted `clientId`/`projectId` path params | Tampering | DELETE query already scopes by `company_id` in addition to `client_id`/`project_id` — confirm the new `deleteProjectLink` repository method includes all three params (see Code Examples) |

## Sources

### Primary (HIGH confidence — direct source-file reads this session)
- `database/migrations/021_crm_extensions.sql` — `client_project_links` schema (columns, types, constraints, indexes) verified line-by-line
- `database/migrations/019_crm_billing.sql` — `clients.default_rate_eur` verified
- `apps/api/src/domains/crm/crm.types.ts`, `crm.repository.ts`, `crm.service.ts`, `crm.controller.ts`, `crm.routes.ts`, `dto/link-project.dto.ts`, `dto/create-client.dto.ts` — full contents read
- `apps/api/src/domains/projects/projects.repository.ts`, `projects.service.ts` (assertOwnedProject block), `projects.controller.ts` — full/partial contents read for pattern reuse
- `apps/api/src/core/errors/AppError.ts` — error class shape confirmed
- `apps/workspaces/src/lib/hooks/useCrm.ts`, `useProjects.ts` — full contents read
- `apps/workspaces/src/lib/api/crm.api.ts`, `projects.api.ts` — full contents read
- `apps/workspaces/src/app/records/[clientId]/page.tsx` — full contents read (ClientSidebar, InlineTextField, ResponsibleEmployeeField)
- `.planning/phases/03-per-project-client-overrides/03-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement IDs and project history
- `.planning/config.json` — confirmed `nyquist_validation: true`, no test-relevant overrides
- `apps/api/package.json` — confirmed no `test` script, no test framework dependency
- `.planning/phases/02-crm-dashboard-navigation-client-detail/02-RESEARCH.md` — house style / precedent for Validation Architecture section under no-test-framework conditions

### Secondary / Tertiary
None — no WebSearch or Context7 lookups were needed; this phase is entirely internal codebase extension with zero new external dependencies.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack decisions, 100% reuse of already-verified existing code
- Architecture: HIGH — all patterns directly observed in the current repository, not inferred
- Pitfalls: HIGH — Pitfall 1 (missing ownership check) and Pitfall 3 (missing unlink) are confirmed by direct code inspection, not speculation

**Research date:** 2026-07-06
**Valid until:** No external expiry — this research is tied to the current state of the repository, not to any external library version. Re-verify only if Phase 1's `crm` domain files are modified by other work before this phase executes.
