# Phase 2: CRM Dashboard, Navigation & Client Detail - Research

**Researched:** 2026-07-05
**Domain:** Next.js/Express monorepo — new full-page CRM surface reusing an existing Notion-style block canvas system
**Confidence:** HIGH

## Summary

This phase is almost entirely a "wire existing patterns onto a new subject key" exercise, not a build-from-scratch. The block-canvas system (`blocks.ts`, `LivePageCanvas.tsx`, `PageBlockView.tsx`) already fetches all its widget data keyed on a plain `projectId: string` prop passed down — nothing in the renderer chain assumes SQL joins to `projects`. That means the client-detail canvas can reuse the exact same components by renaming the prop conceptually to a generic subject id and pointing new hooks/API calls at a new `client_pages` table and a new `crm` domain sub-resource, without forking any renderer.

The two things that do NOT already exist and must be built net-new: (1) the `/records` route itself — the sidebar links to it today but no page exists at that path — and (2) an "add page" trigger UI outside a project context. Critically, there is **no existing "add page" menu component** to extend for DET-04's "New client page" entry point — pages today are created via a raw "+ Sub-page" button that calls `useCreateProjectPage` directly (see `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` line 123-126) and via the `PageTree`'s per-row "+" button. There is no dropdown/menu at the "add page" level (the `SlashMenu.tsx`/`InsertBlockMenu` in this codebase is for inserting *content blocks inside* a page, not for creating new *pages*). The planner must treat this as new UI, not a wired-in menu item, and the CONTEXT.md's suggestion to look at "SlashMenu.tsx or PageHeader.tsx/PageTree.tsx" for the entry point should be corrected: the exact location doesn't exist yet — it must be added to the page/sub-page creation surface (most naturally: a new option next to the existing "+ Sub-page" button and/or `PageTree`'s per-row add button).

The `crm` API domain (controller/service/repository/routes/dto) already exists from Phase 1 with clients CRUD, project-link CRUD, and stub `getClientEmails`/`getClientRisk` methods that return empty/unavailable — exactly matching D-11's requirement to render (not hide) empty states. This phase adds `client_pages` CRUD endpoints to the same domain, following identical layering.

**Primary recommendation:** Build `client_pages` as a structural clone of `project_pages` (mirroring migrations 009/012/013), add a `client_pages` CRUD section to the existing `crm` domain (not `projects`), and reuse `LivePageCanvas`/`PageBlockView` by widening their `projectId: string` prop to a more generic name (e.g., add a parallel `subjectId`/keep `projectId` name but document it now means "the entity id blocks fetch data for") — do not fork these components into `ClientPageCanvas`/`ClientPageBlockView` duplicates unless a specific block kind truly needs client-only branching (none currently do, since DET-02/DET-03 are wholly new block kinds this phase must add to the registry).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CRM dashboard listing (table, search, filter) | Frontend Server (SSR/CSR Next.js page) | API/Backend | New `/records` page fetches via `useClients`; filter/search can be client-side (dataset is small — companies' client lists) or server-side query params, either acceptable |
| Sidebar rename "Records"→"CRM" | Browser/Client | — | Pure static nav config change in `WorkspaceSidebar.tsx` |
| New-tab navigation to client detail | Browser/Client | — | Plain `<a target="_blank" rel="noopener noreferrer">` or `window.open`, same-app (workspaces→workspaces), NOT `crossAppUrl` (that helper is only for marketplace/workspaces/cmr cross-subdomain links) |
| `client_pages` CRUD (get/create/update by client_id) | API/Backend | Database/Storage | New endpoints in `apps/api/src/domains/crm`, mirroring `projects.repository.ts`'s page methods |
| Client detail sidebar fields (address, notes, responsible employee) | API/Backend | Database/Storage | Already exist as `clients` table columns + existing `crm` PATCH `/clients/:id` endpoint — no new schema needed for these three fields |
| "Current situation" (last 10 emails) | API/Backend | Database/Storage | Existing `getClientEmails` stub in `crm.service.ts` returns `[]`; this phase keeps that behavior (empty state), Phase 5 fills it in |
| Timeline (unified feed: emails + billing + KPI/chart) | API/Backend | Database/Storage | New aggregation endpoint needed (or client-side merge of 3 already-fetchable arrays); emails will be empty until Phase 5, invoices/billing data exists per client already via billing domain |
| Block canvas rendering (client detail main area) | Browser/Client | — | Reuses `LivePageCanvas`/`PageBlockView`; purely frontend re-parameterization |
| "New client page" creation entry point | Browser/Client | API/Backend | New UI trigger (net-new — no existing menu to extend) that calls new `client_pages` POST endpoint |

## Package Legitimacy Audit

Not applicable — this phase introduces no new external package dependencies. All work reuses already-installed dependencies (`@dnd-kit/*`, `lucide-react`, `recharts`, `dompurify`, `@tanstack/react-query`, `zod`, `pg`) already present in `apps/workspaces` and `apps/api` per `package.json`. No `npm install` step is required for this phase.

## Standard Stack

### Core
No new libraries required. This phase is 100% additive code on the existing stack:

| Library | Version | Purpose | Why Standard (already in use) |
|---------|---------|---------|--------------------------------|
| `@tanstack/react-query` | 5.99.2 | Server state for new `useClientPage`/`useCreateClientPage` hooks | Matches every existing `use*` hook file pattern (`useProjectPages.ts`, `useCrm.ts`) |
| `zod` | 4.3.6 | DTO validation for new `client_pages` endpoints | Matches `apps/api/src/domains/*/dto/*.ts` convention exactly |
| `lucide-react` | 0.294.0 | Icons for timeline entry types (Mail, Receipt, BarChart3, per UI-SPEC) | Already used throughout `CrmClientsBlock.tsx`, `PageBlockView.tsx` |
| `pg` | 8.11.3 | New `client_pages` queries | Existing `db.query` wrapper, no ORM (per CLAUDE.md constraint) |
| `@dnd-kit/core` / `@dnd-kit/sortable` | 6.3.1 / 10.0.0 | Reused as-is via `LivePageCanvas` for the detail-page block canvas | No fork needed |

### Supporting
None beyond the above — no charting library changes (recharts already handles the existing `chart` block kind, reusable for any KPI-derived timeline entries).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `LivePageCanvas`/`PageBlockView` with generalized subject id | Forking a parallel `ClientLivePageCanvas`/`ClientPageBlockView` | Forking duplicates ~700 lines of dnd/settings/slash-menu logic for zero behavioral gain — CONTEXT.md's own D-09/D-05 explicitly call for reuse. Reject fork approach. |
| Server-side dashboard search/filter (API query params) | Client-side filter over full `useClients()` result | Client list size is small per company (SMB CRM); client-side filter (D-03: name search + over-limit toggle) is simpler and avoids new query-param plumbing on `GET /clients`. Acceptable for v1; note as a scaling risk if client counts grow into the thousands. |

**Installation:** None — no new packages.

**Version verification:** Not applicable (no new packages).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│  WorkspaceSidebar.tsx       │  "CRM" nav item → /records (renamed from "Records")
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  /records  (NEW — CRM Dashboard page)        │
│  useClients() → GET /api/v1/crm/clients      │
│  - search box (client-side filter on name)   │
│  - "over limit only" toggle (client-side)    │
│  - table rows: name / country / credit / RE  │
│  - "Add client" modal → useCreateClient()    │
└──────────────┬────────────────────────────────┘
               │ row click → window.open(new tab)
               ▼
┌───────────────────────────────────────────────────────────┐
│  /records/[clientId]  (NEW — Client Detail page, new tab)  │
│                                                             │
│  ┌───────────────┐   ┌───────────────────────────────────┐│
│  │ Sidebar panel │   │ Block canvas (LivePageCanvas reuse)││
│  │ (settings)    │   │                                    ││
│  │ - address     │   │  ┌──────────────────────────────┐ ││
│  │ - notes       │   │  │ current-situation block (NEW│ ││
│  │ - resp. emp.  │   │  │ kind) → GET .../emails       │ ││
│  │ inline edit,  │   │  │ (stub returns [] — empty     │ ││
│  │ autosave      │   │  │ state per D-11)              │ ││
│  │ → PATCH       │   │  └──────────────────────────────┘ ││
│  │ /clients/:id  │   │  ┌──────────────────────────────┐ ││
│  └───────────────┘   │  │ timeline block (NEW kind)     │ ││
│                       │  │ → merges emails + invoices +  │ ││
│                       │  │   KPI results, sorted by date │ ││
│                       │  └──────────────────────────────┘ ││
│                       └────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────┘
                               │ GET/PATCH config (block layout)
                               ▼
                    apps/api/.../crm domain (extended)
                    GET    /clients/:id/page   (client_pages row, create-on-first-view or 404)
                    POST   /clients/:id/page   (create client_pages row)
                    PATCH  /pages/:pageId      (config/title/icon updates — mirrors project_pages PATCH)

┌───────────────────────────────────────────────┐
│  Project page creator (existing project page)  │
│  "+ Sub-page" area → NEW "New client page"      │
│  trigger → picker modal (search/create client)  │
│  → POST client_pages (or open existing) → new tab│
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/api/src/domains/crm/
├── crm.controller.ts       # add: getClientPage, createClientPage, updateClientPage
├── crm.service.ts          # add: getOrImplyClientPage logic (D-08 dedupe-by-client_id)
├── crm.repository.ts       # add: findClientPage, createClientPage, updateClientPage
├── crm.routes.ts           # add: GET/POST /clients/:id/page, PATCH /client-pages/:pageId
├── crm.types.ts            # add: ClientPageRecord
└── dto/
    ├── create-client-page.dto.ts
    └── update-client-page.dto.ts

apps/workspaces/src/
├── app/records/
│   ├── page.tsx                     # NEW — CRM dashboard (table)
│   └── [clientId]/page.tsx          # NEW — client detail page (opens in new tab)
├── lib/api/crm.api.ts               # extend: getClientPage, createClientPage, updateClientPage
├── lib/hooks/useCrm.ts              # extend: useClientPage, useCreateClientPage, useUpdateClientPage
├── lib/projectPage/blocks.ts        # extend PageBlockKind union: 'client-current-situation', 'client-timeline'
│                                     #   (or reuse 'activity-timeline' kind with a client-aware variant — see Pitfall 1)
└── components/projectPage/
    ├── PageBlockView.tsx            # add cases for the 2 new block kinds
    ├── ClientCurrentSituationBlock.tsx   # NEW renderer (empty-state per D-11)
    └── ClientTimelineBlock.tsx           # NEW renderer (unified feed per D-12)
```

### Pattern 1: Generalizing the block canvas subject id
**What:** `LivePageCanvas`, `PageBlockView`, `PageBlockSettings`, and every widget view currently accept a `projectId: string` prop and pass it straight through to per-widget hooks (`useProjectStats(projectId)`, `useProjectActivity(projectId, ...)`, etc.).
**When to use:** For `client_pages`, do NOT rename this prop system-wide (that would touch 15+ files with zero behavioral change for existing project-page block kinds). Instead, the 2 new client-specific block kinds (current-situation, timeline) should accept a `clientId` prop passed down alongside/instead of `projectId` at the point where the client detail page instantiates `LivePageCanvas`. The cleanest minimal-surface-area approach: add an optional second prop `clientId?: string` to `LivePageCanvas`/`PageBlockView`/`BlockEditor`, threaded through only to the 2 new block kinds' views; all existing block kinds continue reading `projectId` untouched.
**Example:**
```typescript
// LivePageCanvas.tsx — additive prop, not a rename
export default function LivePageCanvas({
  config, projectId, clientId, onChange,
}: { config: PageConfig; projectId?: string; clientId?: string; onChange: (c: PageConfig) => void }) {
  // ...pass both down to PageBlockView; existing widgets ignore clientId, new ones ignore projectId
}
```
Source: inferred from `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` (existing prop threading pattern), `apps/workspaces/src/components/projectPage/PageBlockView.tsx` (existing per-kind data-fetch pattern).

### Pattern 2: `client_pages` as a structural mirror of `project_pages`
**What:** Migration 009 (`project_pages`) + 012 (`parent_page_id`) + 013 (`cover_image_url`, `header_settings`) define the full current shape. D-06 requires a `UNIQUE` constraint on `client_id` (one page per client — unlike `project_pages` which allows many pages per project via `parent_page_id` hierarchy). Per CONTEXT.md D-05/D-06, `client_pages` does NOT need `parent_page_id` (no sub-pages for client detail, out of scope) — mirror only `title`, `icon`, `config`, `created_by`, timestamps, plus `cover_image_url`/`header_settings` if the detail page reuses `PageHeader.tsx` (recommended for consistency, since D-09 doesn't forbid a header/cover, and reusing `PageHeader` verbatim is lower-risk than building a new header component).
**When to use:** New migration `022_client_pages.sql`.
**Example:**
```sql
-- Migration: client detail pages (Notion-style canvas per client). Apply after 021. Idempotent.
--
-- Mirrors project_pages (009/012/013) but keyed on client_id instead of
-- project_id, and unique per client (D-06: one detail page per client, no
-- sub-pages / no hierarchy — CLI-04/CLI-05 linked-projects UI is Phase 3).

CREATE TABLE IF NOT EXISTS client_pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'Untitled',
  icon             TEXT,
  config           JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
  cover_image_url  TEXT,
  header_settings  JSONB NOT NULL DEFAULT '{}',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_pages_client_uniq ON client_pages (client_id);
CREATE INDEX IF NOT EXISTS client_pages_company_idx ON client_pages (company_id);
```
Source: `[VERIFIED: codebase]` — direct structural derivation from `database/migrations/009_project_pages.sql`, `012_page_hierarchy.sql`, `013_page_header.sql` (all read in full this session).

### Pattern 3: "Get-or-imply" client page for D-07/D-08 (no duplicate detail pages)
**What:** When a user picks a client in the page-creator's "New client page" flow, the service must look up an existing `client_pages` row by `client_id` first; if found, return it (frontend opens existing page in new tab); if not found, create one.
**When to use:** Service-layer method, not two separate frontend-orchestrated calls (avoids a race where two clicks both see "not found" and both create).
**Example:**
```typescript
// crm.service.ts
async getOrCreateClientPage(clientId: string, companyId: string, createdBy: string | null): Promise<ClientPageRecord> {
  await this.getClient(clientId, companyId); // 404s if client doesn't belong to company
  const existing = await crmRepository.findClientPage(clientId, companyId);
  if (existing) return existing;
  return crmRepository.createClientPage(companyId, clientId, createdBy, {});
}
```
Rely on the `client_pages_client_uniq` unique index as the actual concurrency guard (use `INSERT ... ON CONFLICT (client_id) DO UPDATE SET updated_at = NOW() RETURNING *` or `ON CONFLICT (client_id) DO NOTHING` + re-select, mirroring the `ON CONFLICT` pattern already used in `crmRepository.upsertProjectLink`).
Source: `[VERIFIED: codebase]` — `ON CONFLICT` pattern taken directly from `apps/api/src/domains/crm/crm.repository.ts` line 85-95 (`upsertProjectLink`).

### Anti-Patterns to Avoid
- **Forking `LivePageCanvas`/`PageBlockView` into client-specific duplicates:** Rejected explicitly — CONTEXT.md D-05 says "This reuses the same block-canvas renderer/editor components." Fork only individual block-kind renderers, never the canvas/shell.
- **Routing `client_pages` CRUD through the `projects` domain:** `client_pages` belongs to `clients`, not `projects` — put it in `apps/api/src/domains/crm`, matching REQUIREMENTS.md's API-01 ("dedicated crm API domain... separate from billing") and this phase's CLI-0x/DET-0x requirement grouping.
- **Using `crossAppUrl()` for the new-tab client detail link:** `crossAppUrl` resolves `marketplace`/`workspaces`/`cmr` base URLs for *cross-app* navigation. The client detail page lives in the *same* app (`workspaces`) at `/records/[clientId]`. Use a plain relative `<Link href={...} target="_blank" rel="noopener noreferrer">` (Next.js `Link` supports `target`) or `window.open('/records/'+id, '_blank')`. `crossAppUrl` is irrelevant here — CONTEXT.md's canonical-refs list is slightly misleading on this point; the *pattern* (`target="_blank" rel="noopener noreferrer"`) is reusable, the *helper function* is not applicable.
- **Assuming the "add page" menu exists:** It does not. Do not plan a task as "add an entry to the existing menu" — plan it as "build a small trigger + picker modal," reusing only the *visual affordance style* of the existing "+ Sub-page" button.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block-based canvas editing (drag, slash menu, settings) | A parallel client-page editor | `LivePageCanvas` + `PageBlockView` with the additive `clientId` prop (Pattern 1) | Already handles dnd-kit sortable, slash-menu insert, per-block settings popover, span-cycling — battle-tested in project pages |
| Credit-utilization visual logic | New percentage/color logic for the dashboard table's credit-status column | `CreditBar`'s threshold logic from `CrmClientsBlock.tsx` (`bg-emerald-500` <70%, `bg-amber-500` 70-99%, `bg-red-500` ≥100%) | UI-SPEC explicitly mandates reusing "the exact 3-tier logic from CreditBar" — don't reinvent thresholds |
| Page header (cover/icon/title editing) | A new client-page header component | `PageHeader.tsx` as-is (it already takes a generic `page: ProjectPage`-shaped object and an `onUpdate` callback) — works against any object with `title`/`icon`/`cover_image_url`/`header_settings` fields, which `client_pages` rows will have if migration mirrors 013 | Zero new code if `ClientPage` type shape matches `ProjectPage`'s header-relevant fields |
| Debounced autosave for block config | New debounce/save-flush logic for the client-page canvas | The exact `useEffect` + `setTimeout` + unmount-flush pattern in `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` (lines 63-87) | Already handles the "flush pending save on navigation away" edge case correctly |
| Inline click-to-edit with autosave-on-blur (D-10, sidebar fields) | A new generic inline-edit component from scratch | Adapt the `EditableTitle`/`EditableHeading` `contentEditable` + uncontrolled-DOM pattern from `PageHeader.tsx`/`LivePageCanvas.tsx` (sync only while unfocused, commit on blur) | Same "Notion-like feel" requirement (D-10) as existing title/heading editing — proven pattern for this exact interaction in this codebase |

**Key insight:** Nearly every visual/interaction requirement in this phase already has a proven implementation elsewhere in `projectPage/*`. The main net-new logic is data-shape (client vs. project) and the two new block kinds' data-fetching, not new UI mechanics.

## Runtime State Inventory

Not applicable — this is a greenfield-additive phase (new table, new routes, new UI). No renames, refactors, or migrations of existing runtime state are in scope. `WorkspaceSidebar.tsx`'s `Records`→`CRM` change is a display-label + icon swap only; `href: '/records'` and `module: 'records'` remain unchanged, so no re-registration of workspace `enabled_modules` config is needed (verified: `enabled_modules` values are the `module` key strings like `'records'`, unaffected by the `name` field change — confirmed by reading `WorkspaceSidebar.tsx` in full this session).

## Common Pitfalls

### Pitfall 1: Reusing the generic `activity-timeline` block kind instead of building the D-12 unified feed
**What goes wrong:** `activity-timeline` (existing kind) only reads `activity_events` rows keyed by `project_id`/`tenant_id` via `useProjectActivity`. It has no concept of merging emails + invoices + KPI results, and it's keyed on project, not client.
**Why it happens:** Superficial similarity ("it's a timeline!") tempts reuse without checking the data source.
**How to avoid:** Build genuinely new block kinds (`client-current-situation`, `client-timeline`) with their own hooks that call the new/existing client-scoped endpoints (`GET /clients/:id/emails` already stubbed; a new aggregation for invoices/KPI results). Do not attempt to repoint `activity-timeline` at client data.
**Warning signs:** If a task says "add `projectId` OR `clientId` to `ActivityTimelineView`," that's the wrong direction — it conflates two different data models.

### Pitfall 2: Forgetting the DET-04 dedupe race (D-08)
**What goes wrong:** Two near-simultaneous "New client page" submissions for the same client (e.g., double-click) create two `client_pages` rows, violating D-06's "one detail page per client."
**Why it happens:** A naive "check then insert" in application code has a TOCTOU race.
**How to avoid:** Enforce via the `UNIQUE (client_id)` DB constraint (already in the migration in Pattern 2) and use `INSERT ... ON CONFLICT (client_id) DO NOTHING RETURNING *` followed by a `SELECT` fallback if the insert returned no rows (standard upsert-or-fetch pattern already used in `upsertProjectLink`).
**Warning signs:** A plan step that does "SELECT to check existence" then "INSERT if not found" as two separate non-transactional steps.

### Pitfall 3: Missing the `kpi_results.client_id` nullable-subject constraint when building the timeline's KPI entries
**What goes wrong:** Migration 021 added `kpi_results.client_id` (nullable) with a `CHECK (user_id IS NOT NULL OR client_id IS NOT NULL)` constraint, anticipating Phase 6's risk evaluator. Phase 2's timeline should NOT expect populated `kpi_results.client_id` rows yet — Phase 6 is what writes them. If timeline code queries `kpi_results WHERE client_id = $1` expecting data, it will correctly get zero rows today (not a bug), but a plan/task must not treat "0 KPI timeline entries" as a defect to fix in this phase.
**Why it happens:** The schema already exists (looks "ready"), but the writer (Phase 6 risk evaluator) doesn't exist yet.
**How to avoid:** Timeline's KPI/chart-data entries should query `kpi_results WHERE client_id = $1` (forward-compatible, correct now-and-later) but the empty-state copy ("No activity yet") must cover this gracefully — consistent with D-11's directive to not hide the section.
**Warning signs:** A verification/test step that asserts "timeline shows a KPI entry" without first seeding one via a manual `kpi_results` insert — there is no code path yet that creates client-scoped KPI rows.

### Pitfall 4: Confusing `client_project_links` (Phase 3) with anything in this phase's scope
**What goes wrong:** Migration 021 already defines `client_project_links` (per-project overrides — CLI-05) and the `crm` service already has `listClientProjectLinks`/`upsertClientProjectLink` fully implemented. It would be easy to accidentally surface this on the Phase 2 detail page since the backend already supports it.
**Why it happens:** The API is already there and "looks done," but CONTEXT.md's `<deferred>` section explicitly excludes "linked projects / per-project overrides" from this phase's detail page UI.
**How to avoid:** Do not add a "Linked Projects" section/block to the client detail page in this phase, even though `GET /clients/:id/projects` already works. That surfacing is explicitly Phase 3 (CLI-04/CLI-05).
**Warning signs:** A task that renders `useClientProjectLinks` anywhere in the Phase 2 detail page UI.

## Code Examples

### Existing `crm.repository.ts` upsert pattern to mirror for `client_pages`
```typescript
// Source: apps/api/src/domains/crm/crm.repository.ts (read in full this session)
async upsertProjectLink(companyId: string, d: { client_id: string; project_id: string; /* ... */ }) {
  const { rows } = await db.query<ClientProjectLinkRecord>(
    `INSERT INTO client_project_links (company_id, client_id, project_id, override_rate_eur, override_responsible_employee_id, override_notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (client_id, project_id) DO UPDATE SET
       override_rate_eur = EXCLUDED.override_rate_eur,
       override_responsible_employee_id = EXCLUDED.override_responsible_employee_id,
       override_notes = EXCLUDED.override_notes,
       updated_at = NOW()
     RETURNING *`,
    [companyId, d.client_id, d.project_id, d.override_rate_eur, d.override_responsible_employee_id, d.override_notes]);
  return numProjectLink(rows[0]);
}
```

### Existing `projects.repository.ts` page CRUD to mirror for `client_pages`
```typescript
// Source: apps/api/src/domains/projects/projects.repository.ts (read in full this session)
async createPage(companyId: string, projectId: string, createdBy: string | null, data: {/*...*/}): Promise<ProjectPage> {
  const { rows } = await db.query<ProjectPage>(
    `INSERT INTO project_pages (company_id, project_id, parent_page_id, title, icon, is_default, sort_order, config, cover_image_url, header_settings, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [companyId, projectId, data.parent_page_id ?? null, data.title ?? 'Untitled', data.icon ?? null, data.is_default ?? false,
     sortRows[0].next, JSON.stringify(data.config ?? { version: 1, blocks: [] }),
     data.cover_image_url ?? null, JSON.stringify(data.header_settings ?? {}), createdBy],
  );
  return rows[0];
}
```
`client_pages` drops `parent_page_id`, `is_default`, `sort_order` (no hierarchy, single page per client) but otherwise mirrors this shape.

### Existing team-members hook to reuse for D-13's responsible-employee picker
```typescript
// Source: apps/workspaces/src/lib/hooks/useTeam.ts (read in full this session)
export function useTeam() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.team,
    queryFn: teamApi.list,
    enabled: !!user?.company_id,
    staleTime: 1000 * 30,
  });
}
```
This already returns the full company team list (flat, no role filter) — exactly matching D-13.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `crm-clients` block embedded inside project pages (`CrmClientsBlock.tsx`) | Full-page CRM dashboard at `/records` + dedicated client detail pages | This phase (Phase 2) | `CrmClientsBlock` is NOT removed (still valid inside project pages per its own scope) but is no longer the primary way to browse/manage clients — dashboard becomes primary, per phase description |

**Deprecated/outdated:** None — this is additive; nothing existing is being removed or replaced wholesale.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "New client page" trigger should be placed next to the existing "+ Sub-page" button / `PageTree`'s per-row add button, since no dedicated "add page" menu component exists | Architecture Patterns / Summary | Low — this is a UI placement choice, easily adjusted in review; does not affect data model or API shape |
| A2 | Dashboard search/filter (D-03) can be client-side over the full `useClients()` result rather than server-side query params | Alternatives Considered | Low-Medium — if a company's client list grows very large, client-side filtering could feel slow; easy to move server-side later without API contract changes to other endpoints |
| A3 | `client_pages` should reuse `PageHeader.tsx` (cover/icon/title) rather than a stripped-down header, since D-09 doesn't explicitly forbid a cover/header on the detail page | Pattern 2 / Don't Hand-Roll | Low — if UI-SPEC/discuss-phase intended a header-less detail page, this adds unused columns/UI; reversible by simply not rendering `PageHeader` even if columns exist |
| A4 | The timeline's KPI/chart entries should query `kpi_results WHERE client_id = $1` now (forward-compatible with Phase 6) rather than omitting a KPI entry type until Phase 6 | Pitfall 3 | Low — if Phase 6 changes the KPI-result shape unexpectedly, this query may need adjustment, but querying an empty/nullable column is safe today |

## Open Questions

1. **Should `client_pages` support a header/cover at all in v1, or is the sidebar+canvas layout (D-09) meant to replace the header entirely?**
   - What we know: UI-SPEC describes sidebar + main canvas, no mention of a Notion-style cover image for the client detail page.
   - What's unclear: Whether reusing `PageHeader.tsx` (cover + icon + title) is desired, or whether the detail page should show just a client name heading (per UI-SPEC's "Heading" typography role: "client name on detail page").
   - Recommendation: Default to a simpler heading (client name, no cover/icon picker) matching the UI-SPEC's typography contract literally, and treat full `PageHeader` reuse as a discretionary upgrade if time allows — do not block the phase on this. Migration can still include `cover_image_url`/`header_settings` columns for schema parity/future use even if the UI doesn't expose them yet.

2. **Should the dashboard "Add client" modal be a genuinely new component, or should `CrmClientsBlock`'s inline form be extracted into a shared component used by both?**
   - What we know: CONTEXT.md explicitly leaves this to "Claude's Discretion" ("reuses CrmClientsBlock's existing form fields/validation as-is or is rebuilt standalone").
   - What's unclear: Whether extracting a shared `<AddClientForm>` component (used by both the in-project block and the new dashboard modal) is preferred over duplicating the ~15-line form.
   - Recommendation: Extract a small shared `AddClientForm` component (fields: name, country, VAT ID, credit limit, default rate) to avoid drift between the two entry points — low cost, avoids two copies of validation/defaults logic. Planner should decide based on task-sizing preference; either is acceptable per CONTEXT.md.

## Environment Availability

Skipped — this phase has no new external tool/service dependencies beyond the already-running Postgres/Redis/Node stack established in Phase 1 (confirmed via docker-compose.yml in the existing stack; no new services introduced).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, `vitest.config.*`, or `*.test.ts`/`*.spec.ts` files exist anywhere in `apps/api` or `apps/workspaces` (verified via search this session) |
| Config file | none — see Wave 0 |
| Quick run command | none available yet |
| Full suite command | none available yet |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Sidebar shows "CRM" linking to `/records` | manual/visual | — | ❌ Wave 0 (no framework) |
| NAV-02 | Row click opens client detail in new tab | manual/visual | — | ❌ Wave 0 |
| CLI-01/02/03 | Address/notes/responsible-employee edit + persist | integration (API) | would be `npm test -- crm.service` if framework existed | ❌ Wave 0 |
| DET-01 | Detail page shows address/notes/settings/responsible employee | manual/visual | — | ❌ Wave 0 |
| DET-02 | Current-situation empty state renders | manual/visual | — | ❌ Wave 0 |
| DET-03 | Timeline renders unified feed / empty state | manual/visual | — | ❌ Wave 0 |
| DET-04 | Create client page from project page creator, no duplicates | integration (API) | would test `getOrCreateClientPage` idempotency | ❌ Wave 0 |

Given zero test infrastructure exists in this monorepo (a pre-existing condition, not introduced by this phase), full automated coverage per Nyquist sampling is not achievable without first standing up a framework — which is out of scope for a single feature phase to introduce unilaterally. Recommend the plan use manual verification steps (dev-server click-through, curl/Postman-style API checks) as the sampling mechanism for this phase, and flag "no test framework in repo" as a standing concern (already noted implicitly by its absence from REQUIREMENTS.md's Known Technical Constraints).

### Sampling Rate
- **Per task commit:** Manual smoke check (start dev server, exercise the specific endpoint/UI path touched)
- **Per wave merge:** Full click-through of NAV-01/02, CLI-01/02/03, DET-01..04 against a seeded test client
- **Phase gate:** All 9 requirement IDs manually verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework installed anywhere in the monorepo — installing one (e.g., Vitest for `apps/api`) is a larger cross-cutting decision beyond this phase's scope; flag to project owner rather than silently deciding in this phase
- [ ] No `tests/` directory convention established yet in either `apps/api` or `apps/workspaces`

*(If a future phase or explicit decision introduces a framework, this section should be revisited.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes (inherited) | Existing `authenticateToken` middleware already applied to all `crm.routes.ts` routes (`router.use(authenticateToken)`) — new `client_pages` routes must be added under the same router, inheriting this automatically |
| V3 Session Management | yes (inherited) | JWT bearer pattern, unchanged by this phase |
| V4 Access Control | yes | Every new `client_pages` query must scope by `company_id` (multi-tenancy via WHERE clause, per CLAUDE.md's "Row-level security via companyId" convention) — mirror `crmRepository.findClient`'s `WHERE id = $1 AND company_id = $2` pattern exactly for `findClientPage` |
| V5 Input Validation | yes | New Zod schemas (`create-client-page.dto.ts`, `update-client-page.dto.ts`) mirroring `apps/api/src/domains/projects/dto/page.dto.ts`'s envelope-only validation for `config`/`header_settings` (frontend owns block semantics, backend validates shape only) |
| V6 Cryptography | no | No new secrets/encryption surface introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant client data leakage (fetching another company's client_pages by guessing/enumerating UUIDs) | Elevation of Privilege / Information Disclosure | Every repository method must filter `WHERE company_id = $N` — never trust `client_id`/`page_id` alone, exactly as `crm.repository.ts` already does for every existing query |
| XSS via rich-text/notes fields rendered in the detail sidebar or block canvas | Tampering | Reuse `DOMPurify.sanitize()` exactly as `PageBlockView.tsx`'s `clean()` helper already does for `rich-text`/`list` block HTML — any new free-text notes field rendered as HTML (if rich text) must go through the same sanitizer; if notes are rendered as plain text (not HTML), React's default escaping is sufficient and DOMPurify is unnecessary — confirm notes field render mode during planning |
| IDOR on new-tab client detail URL (`/records/[clientId]`) | Elevation of Privilege | Detail page's data fetch (`useClient(clientId)`, `useClientPage(clientId)`) must 404/403 server-side if the authenticated user's `company_id` doesn't own that client — already the exact behavior of `crmService.getClient` (`throw new AppError(404, 'Client not found')` when repository scoped-query returns nothing) |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `database/migrations/009_project_pages.sql`, `012_page_hierarchy.sql`, `013_page_header.sql`, `021_crm_extensions.sql` — full schema for `project_pages` evolution and existing CRM extensions
- `apps/api/src/domains/crm/*.ts` (controller, service, repository, routes, types, dto) — existing CRM domain layering
- `apps/api/src/domains/projects/projects.repository.ts`, `dto/page.dto.ts`, `projects.routes.ts` — existing page CRUD pattern to mirror
- `apps/workspaces/src/lib/projectPage/blocks.ts` — `PageBlockKind` union, `PAGE_BLOCK_REGISTRY`, extensibility contract
- `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx`, `PageBlockView.tsx`, `PageHeader.tsx`, `PageTree.tsx`, `SlashMenu.tsx`, `CrmClientsBlock.tsx` — full component reads confirming prop-threading pattern and confirming no "add page" menu exists
- `apps/workspaces/src/lib/hooks/useCrm.ts`, `useProjectPages.ts`, `useTeam.ts` — existing hook patterns
- `apps/workspaces/src/lib/api/crm.api.ts`, `projects.api.ts` (`ProjectPage` interface) — existing API client shapes
- `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` — confirmed trivial rename path for NAV-01
- `packages/ui/src/appUrls.ts` — confirmed `crossAppUrl` scope (cross-*app* only, not applicable to same-app new-tab nav)
- `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` — confirmed page-creation entry points and debounced-autosave pattern
- Direct filesystem search confirming `apps/workspaces/src/app/records/` does not yet exist, and no test framework config exists anywhere in the monorepo

### Secondary (MEDIUM confidence)
- None — all findings this session were verified directly against the codebase (no external web research was needed; this phase is entirely internal-pattern-reuse).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all patterns directly observed in codebase
- Architecture: HIGH — every claim backed by a full file read this session
- Pitfalls: HIGH — derived from direct schema/service inspection (migration 021's stub methods and constraints), not speculation

**Research date:** 2026-07-05
**Valid until:** 30 days (stable internal codebase, no external API/library churn risk)
