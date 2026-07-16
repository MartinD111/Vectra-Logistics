# Architecture Research

**Domain:** Unified workspace hierarchy (folder/project/page/record tree) integration into an existing DDD monorepo
**Researched:** 2026-07-16
**Confidence:** HIGH (based entirely on direct inspection of the current repo — this is an integration question, not a greenfield ecosystem survey)

## Key Finding: Most of the "new" data model already exists

Before recommending anything, the repo was inspected directly. The premise that v6 needs a brand-new tree domain is **wrong** — a `folders` domain, `projects.folder_id`, `programs.folder_id`, and `project_pages.parent_page_id` already exist and already form most of the tree. v6's real gap is almost entirely **frontend** (no tree UI consumes any of this) plus a few **data model seams** (records/collections have no folder attachment) and **consistency debt** (folders domain predates the v5 capability/event-outbox conventions and doesn't follow them).

### What already exists (verified in code)

| Piece | Where | Shape |
|-------|-------|-------|
| `folders` table | `database/migrations/006_folders.sql` | `id, company_id, parent_id → folders(id) ON DELETE CASCADE, name, icon, color, sort_order, created_by, timestamps`. Nestable tree, tenant-scoped. |
| `folders` domain | `apps/api/src/domains/folders/{folders.controller,service,repository,types,routes}.ts` + `dto/folder.dto.ts` | Full CRUD + `listFolderTree` (recursive `buildTree` in the service), `moveFolder` with cycle-guard (`assertNotDescendant`), `deleteFolder` (non-cascading to contents — children just go `folder_id = NULL`). Mounted at `/api/v1/folders` in `apps/api/src/domains/index.ts`. |
| `projects.folder_id` / `programs.folder_id` | Same migration, `ALTER TABLE ... ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL` | Projects and programs (mini programs/automations) can already be filed into a folder. `apps/api/src/domains/projects/projects.types.ts` already has `folder_id` on `Project` and `Program`. |
| Page-level tree | `apps/api/src/domains/projects/projects.types.ts` — `ProjectPage` | Already has `parent_page_id` (self-referential) and `sort_order` — a page tree *within* a project already exists and is unrelated to the folder tree. |
| Frontend API/hooks for folders | `apps/workspaces/src/lib/api/folders.api.ts`, `apps/workspaces/src/lib/hooks/useFolders.ts` | `foldersApi.tree/get/create/update/move/remove`; `useFolderTree`, `useCreateFolder`, `useUpdateFolder`, `useMoveFolder`, `useDeleteFolder` (React Query, cross-invalidates `folders`/`projects`/`programs` query keys). **None of this is rendered anywhere** — `WorkspaceSidebar.tsx` never imports `useFolderTree`. |

### What is genuinely missing

1. **No tree UI.** `WorkspaceSidebar.tsx` renders a flat, hardcoded `ITEMS` array filtered by `workspace.enabled_modules`; it has no concept of folders, projects, or pages at all.
2. **No drag-to-reorder anywhere** — `sort_order` columns exist on folders/pages/programs but nothing currently exposes a reorder endpoint or UI (`folders.dto.ts` should be checked for a `reorder`/`sort_order` field — confirm before building; if absent, add one).
3. **Records/collections (`data_collections`) have no folder attachment.** `apps/api/src/domains/records/records.types.ts` — `DataCollectionRow` has `project_id` (nullable) but no `folder_id`. Collections are either standalone or attached to a project; they cannot currently sit directly under a folder in the tree the way a project can.
4. **The `folders` domain predates the v5 foundation and does not follow its conventions** — this is the most important architectural risk for v6:
   - `folders.service.ts` takes `(companyId, actorId, body)` primitives, not `RequestContext`. Newer domains (`workflows`) take `ctx: RequestContext` end to end: `requireRequestContext(req)` in the controller → passed straight into the service → `assertCapability(ctx, ...)` inside the service, in addition to `requireCapability(...)` at the route layer (belt-and-braces).
   - `folders.service.ts` calls `recordEvent()` (the plain, non-durable `activityLog.ts` writer) for `folder.created`, not the versioned `event_outbox` (`insertDurableEvent`/`createDurableEventEnvelope` from `core/events`) that `records.repository.ts` uses transactionally for `records.collection.created`.
   - Route-level capability checks on folders already reuse `workspace.admin` — that part is correct and should NOT be duplicated with a new check.

## Recommended Approach: Extend, Don't Duplicate

**Do not create a new `apps/api/src/domains/workspace-tree/` domain.** The tree is not a new bounded context — it is the existing `folders` domain (parent/child structure) plus existing `folder_id`/`project_id`/`parent_page_id`/`parent_record_id` references on `projects`, `programs`, `data_collections`, `collection_records`, and `project_pages`. A new domain would either (a) duplicate the folder CRUD that already exists, or (b) become a thin read-only aggregation layer that reads across four other domains' tables — which is architecturally fine as a *composition* concern but should live as an **aggregation endpoint inside `folders`** (e.g. `GET /api/v1/folders/tree?expand=projects,pages,collections`), not as a sibling domain that owns nothing.

### Concrete plan by area

| Area | Action | Why |
|------|--------|-----|
| `folders` domain | **Modify, don't replace.** Bring `folders.service.ts` up to v5 conventions: switch signatures to accept `RequestContext`, call `assertCapability(ctx, 'workspace.admin', ...)` inside the service (route already has `requireCapability`), and replace the `recordEvent()` call in `createFolder` with `insertDurableEvent`/`createDurableEventEnvelope` inside a transaction in the repository, matching `records.repository.ts`'s `createCollection` pattern exactly. Add the same for `moveFolder`/`deleteFolder`/rename if v6 requirements want those events audited/reacted to by workflows. | Reuses the *existing* domain instead of a parallel one; brings it in line with the one authorization/event contract v5 established, closing the pre-v5 tech debt instead of adding a second inconsistent pattern next to it. |
| `data_collections.folder_id` | **New migration** `028_records_folder_attachment.sql` (or next free number — check `database/migrations/` at build time; `027_workflows.sql` is the latest as of this research): `ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;` plus an index. Mirrors the exact pattern `006_folders.sql` used for `projects`/`programs`. | Only real data-model gap: records/collections currently can't be a direct child of a folder in the unified tree. Everything else (projects, programs, pages) already supports it. |
| Aggregated tree read endpoint | **New route on the existing `folders` domain**, e.g. `GET /folders/tree/full` returning folders (recursive, as today) with `projects[]`, `programs[]`, `data_collections[]` arrays attached per folder node (each already queryable by `folder_id`), and each project additionally carrying its `project_pages` (queried by `project_id`, ordered by `sort_order`). Implement as a `foldersRepository` method doing 4 scoped queries (folders, projects, programs, collections) + an in-memory pages fetch per project, not a giant JOIN — matches the "repository returns raw rows, service assembles" split already used by `buildTree`. | Avoids a second domain; keeps the query fan-out cheap and cacheable (React Query can cache the whole tree with a single query key). |
| Sidebar UI | **Modify `WorkspaceSidebar.tsx`, do not replace it wholesale.** Keep `ALWAYS_BOTTOM` (Team/Settings) and the always-on Dashboard entry as-is. Replace the flat `ITEMS.map(renderItem)` block with a new `WorkspaceTree` component that consumes the aggregated tree query and renders `FolderNode`/`ProjectNode`/`PageNode` recursively, still filtering module-gated leaves (e.g. hide a project's CRM-only children if `records` module isn't enabled) using the same `enabled_modules` set. Module-only nav items with no folder home (Marketplace Intelligence, My Fleet, CMR Manager cross-app link) stay as fixed top-level entries above/below the tree, unchanged — they are workspace-level modules, not folder/project content. | Preserves the module-gating behavior (`enabled_modules`) v6 explicitly requires to keep; avoids a risky full sidebar rewrite when only the middle section needs to become a tree. |
| Hooks | **Add `apps/workspaces/src/lib/hooks/useWorkspaceTree.ts`** wrapping the new aggregated endpoint, following the exact shape of `useFolders.ts` (`qk.workspaceTree`, `invalidate` helper that also busts `folders`/`projects`/`programs`/`records` keys). **Keep `useFolders.ts`, `useProjects.ts` as-is** — the tree hook composes their query keys for invalidation, it does not replace their mutations (rename/move/delete still go through `useUpdateFolder`, `useMoveFolder`, etc.). | `useProjects.ts` and `useFolders.ts` already have working mutations with correct capability-gated endpoints; duplicating them under a new hook would fork the source of truth. |
| Drag-to-reorder | **Extend, don't invent.** `sort_order` already exists on `folders`, `project_pages`; add it to `data_collections`/`programs` reorder only if the UI needs siblings reordered within a folder (projects/programs currently have no `sort_order` column — check before assuming; add via the same migration as `folder_id` if needed). Reuse `@dnd-kit/core` + `@dnd-kit/sortable` (already a Workspaces dependency, used elsewhere per the stack) rather than adding a new DnD library. New endpoints: `PATCH /folders/:id/reorder` and equivalent on `projects`/`programs`/`data_collections`, all gated by the same `workspace.admin` (or a narrower `folder.edit`-style capability if v6 wants finer granularity — see below). | `@dnd-kit/*` is already in the stack (per project's technology stack notes) — introducing a second DnD library would be an unjustified dependency. |
| Capability model | **Reuse `workspace.admin` for structural mutations (create/rename/move/delete folder or project), do not invent a parallel per-tree-node ACL.** The existing `CapabilityName` union in `apps/api/src/core/capabilities/index.ts` is a fixed union type — if v6 needs finer-grained tree permissions (e.g. a non-admin "project lead" allowed to reorder/rename their own project but not delete folders), **add a new named capability to the existing union** (e.g. `'tree.organize'`) and a new `can()` branch, rather than building a bespoke ACL/RBAC layer next to it. Do this only if the v6 requirements actually call for non-admin tree edits; otherwise ship with `workspace.admin` everywhere, matching what `folders.routes.ts` already does. | The `CapabilityService.can()` switch is the single source of truth for all authorization in the app (v5's whole point). Introducing a second checking mechanism for tree operations would violate the "no parallel authorization path" scope note in `PROJECT.md`. |
| Events | **Reuse `event_outbox` (`core/events`), do not reuse the older `recordEvent`/`activityLog` path for new event types**, and do not build a second dispatcher. Emit `folder.created`, `folder.moved`, `folder.deleted`, `folder.renamed` as durable events (transactionally, alongside the mutation) so v5's workflow engine can eventually react to tree changes (e.g. "notify on project move") without new plumbing. | `publishDurableEvent` in `apps/api/src/core/events/outbox.ts` already special-cases `records.collection.created` to also project into `activity_events`; the same switch should grow a `folder.*` case if the activity feed needs to show tree events, instead of writing directly to `activity_events` from the folders service as it does today. |
| Breadcrumbs | **New, small, frontend-only.** No existing breadcrumb component was found in `apps/workspaces`. Build a `useBreadcrumbTrail(folderId | projectId | pageId)` hook that walks up via the already-cached tree query (folders have `parent_id`, pages have `parent_page_id`) rather than making a new API call per breadcrumb — the aggregated tree endpoint already has everything needed client-side. | Avoids a chatty new "get ancestors" endpoint; the tree is small enough (workspace-scoped, not global) to walk client-side once fetched. |
| `crossAppUrl` | **Not directly relevant to the tree itself** — `crossAppUrl` (in `packages/ui/src/appUrls.ts`) resolves absolute URLs across the three *separate Next.js apps* (marketplace/workspaces/cmr subdomains), used today only for the always-on "CMR Manager" sidebar link. The folder/project/page tree lives entirely inside the Workspaces app, so tree nodes should link with plain Next.js `<Link href="/projects/[id]">` / `<Link href="/records/[collectionId]">`, not `crossAppUrl`. Reserve `crossAppUrl` only if a tree node needs to deep-link into CMR or Marketplace (unlikely for v6's scope). | Prevents conflating two different navigation concerns — in-app tree routing vs. cross-subdomain SSO-aware navigation. |

## Suggested Build Order

Ordered strictly by dependency — each step is buildable/testable in isolation before the next starts.

1. **Data model gap-fill** — migration `028_...sql` adding `data_collections.folder_id` (+ index), and `sort_order` on `projects`/`programs` if reorder is in scope. Idempotent, additive, no breaking changes to existing `folders`/`projects` rows.
2. **Bring `folders` domain to v5 conventions** — refactor `folders.service.ts`/`folders.controller.ts` to the `RequestContext` + `assertCapability` pattern (matching `workflows`), and switch its event write from `recordEvent()` to `insertDurableEvent` inside the repository transaction (matching `records.repository.ts`). This must land before new folder mutation endpoints (reorder, collection attachment) are added, so all new code is written against the corrected pattern rather than copying the stale one.
3. **API: aggregated tree read + reorder endpoints** — `GET /folders/tree/full` (or similar) assembling folders+projects+programs+collections+pages; `PATCH .../reorder` endpoints per node type. Capability-gated with existing `workspace.admin` (read can stay open to any authenticated company member, same as today's `GET /folders`).
4. **Frontend: `useWorkspaceTree` hook** consuming the new endpoint, with proper query-key invalidation wired to existing `folders`/`projects`/`programs`/`records` keys so existing pages (project list, CRM dashboard, etc.) stay in sync without their own hooks changing.
5. **Sidebar tree UI** — replace the middle section of `WorkspaceSidebar.tsx` with the recursive tree renderer, preserving `enabled_modules` gating and the always-on top/bottom items.
6. **Drag-to-reorder** — wire `@dnd-kit/core`/`sortable` (already a dependency) into the new tree renderer, calling the reorder endpoints from step 3.
7. **Create/rename/move/delete/archive flows** — modals/menus in the sidebar calling the existing `useCreateFolder`/`useUpdateFolder`/`useMoveFolder`/`useDeleteFolder` (folders) and equivalent existing project/program mutations (`useProjects`) — these mutations already exist; only the trigger UI is new. "Archive" is the one genuinely new state — check `folders`/`projects`/`programs` schemas for an existing `archived_at`/`status` column before adding one; if absent, add via the step-1 migration rather than a separate later one.
8. **Breadcrumbs** — client-side ancestor walk over the cached tree query from step 4, added last since it has no backend dependency and is purely a consumer of the tree shape established in steps 1–4.

## Anti-Patterns to Avoid

### Anti-Pattern 1: New `workspace-tree` domain that re-owns folder data
**What people do:** Create `apps/api/src/domains/workspace-tree/` with its own tree table/service because "the tree is a new feature."
**Why it's wrong:** `folders` already is the tree domain; a second domain either duplicates its table (data integrity split) or becomes a read-only shell with no reason to exist as a separate bounded context. It also invites a second capability/event convention to grow up alongside it.
**Do this instead:** Extend `folders` domain with the aggregation endpoint and bring it to v5 conventions.

### Anti-Pattern 2: Bespoke ACL for "who can rename/move this folder/project"
**What people do:** Add a `folder_permissions` table or a per-node ACL check separate from `CapabilityService`.
**Why it's wrong:** Violates the v6 scope note explicitly ("reuses the request/capability/event/action contract shipped in v5 rather than introducing a parallel authorization... path") and duplicates enforcement logic that must now be kept in sync in two places.
**Do this instead:** Add a new `CapabilityName` value to the existing union if finer granularity than `workspace.admin` is genuinely needed; otherwise reuse `workspace.admin` as `folders.routes.ts` already does.

### Anti-Pattern 3: Writing new tree events via `recordEvent()`/`activityLog.ts` instead of `event_outbox`
**What people do:** Copy `folders.service.ts`'s existing (pre-v5) pattern for new event types because "that's what the folders domain already does."
**Why it's wrong:** `recordEvent()` is fire-and-forget, non-durable, and not visible to the workflow engine's event-driven triggers (Phase 30). New tree mutations (especially move/archive, which downstream automations may want to react to) should be durable from day one.
**Do this instead:** Use `insertDurableEvent`/`createDurableEventEnvelope` transactionally, as `records.repository.ts` already demonstrates for `records.collection.created`; extend `publishDurableEvent`'s switch in `outbox.ts` with a `folder.*` case if the activity feed still needs the row projected into `activity_events`.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `folders` ↔ `projects` | Direct FK (`projects.folder_id → folders.id`) queried per-domain, no cross-domain calls | Already established; the aggregated tree endpoint should query both repositories and assemble in the `folders` service, not import project repository logic inline without a clear seam. |
| `folders` ↔ `records` | New FK (`data_collections.folder_id`), same pattern as `projects` | Requires the new migration; no existing coupling today. |
| `folders`/`projects` ↔ `core/capabilities` | `requireCapability('workspace.admin')` at route layer + `assertCapability(ctx, ...)` in service (post-refactor) | This is the single authorization seam for all tree mutations — do not add a second one. |
| `folders`/`projects` ↔ `core/events` (`event_outbox`) | Transactional insert in the repository alongside the row mutation, dispatched later by the existing worker/dispatcher | This is the single event-emission seam for anything the workflow engine or activity feed should see. |
| `WorkspaceSidebar.tsx` ↔ backend | New `useWorkspaceTree` hook → aggregated `GET /folders/tree/full` | Sidebar should not fan out to 4 separate hooks (`useFolderTree` + `useProjects` + `usePrograms` + collections) to build one tree view — that recreates client-side joins the aggregated endpoint should already do server-side. |

## Sources

- Direct repository inspection (HIGH confidence, no external sources needed for this integration question):
  - `apps/api/src/domains/folders/*`
  - `apps/api/src/domains/projects/projects.types.ts`
  - `apps/api/src/domains/records/records.types.ts`, `records.repository.ts`
  - `apps/api/src/domains/workflows/workflows.controller.ts`, `workflows.routes.ts`, `workflows.service.ts`
  - `apps/api/src/core/auth/request-context.ts`
  - `apps/api/src/core/capabilities/index.ts`
  - `apps/api/src/core/events/outbox.ts`, `activityLog.ts`
  - `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx`
  - `apps/workspaces/src/lib/hooks/useFolders.ts`, `apps/workspaces/src/lib/api/folders.api.ts`, `projects.api.ts`
  - `packages/ui/src/appUrls.ts`
  - `database/migrations/006_folders.sql`, `009_project_pages.sql`, `025_records_views.sql`, `026_event_outbox.sql`, `027_workflows.sql`
  - `.planning/PROJECT.md`

---
*Architecture research for: Vectra v6.0 Unified Workspace Hierarchy*
*Researched: 2026-07-16*
