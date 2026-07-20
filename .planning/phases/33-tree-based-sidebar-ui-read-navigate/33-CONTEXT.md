# Phase 33: Tree-Based Sidebar UI (Read + Navigate) - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Read-only navigation UI only — no drag/create/rename/archive (that's Phase 34).

Delivers:
- Sidebar renders the real folder → project → program/page/record hierarchy as an expand/collapse tree, sourced from Phase 32's `GET /folders/tree/full`.
- Per-user, per-browser (local, not synced) persistence of expand/collapse state across sessions.
- Module-aware visibility (`enabled_modules`) correctly evaluated at every tree node/depth, not just top-level.
- Breadcrumbs reflecting the live tree ancestor path.
- Existing deep links, `crossAppUrl`, and Outlook-synced CRM links keep working unchanged (tree is navigation only, URLs stay ID-keyed).

</domain>

<decisions>
## Implementation Decisions

### Depth-Aware Module Visibility
- **D-01 (Claude's discretion, exercised):** When a node's module is disabled, prune the node **and its entire subtree** — this is also the natural outcome of a recursive client-side filter (removing a node removes everything beneath it without needing to hoist children up).
- **D-02 (Claude's discretion, exercised):** Folders are module-agnostic containers, never gated themselves. If every child of a folder is filtered out by module rules, the folder becomes empty and should also be hidden, recursively bubbling up (no dead-end empty branches in the nav).
- **D-03:** Filtering happens **client-side** over the already-fetched `GET /folders/tree/full` response — same approach as today's `ITEMS` filtering against `workspace.enabled_modules`. Do not touch Phase 32's API (already shipped/Complete).
- **D-04 (confirmed by user):** Tree `node_type` → module key is a 1:1 mapping onto existing `enabled_modules` keys: `data_collection`/`project_page` → `records`, `program` → `programs`, `project` → always visible (not module-gated today, same as current behavior).

### Breadcrumb Behavior
- **D-05:** Breadcrumb segments are **clickable links** — each ancestor (folder/project name) navigates to that node. Matches the "navigation only, canonical URLs are ID-keyed" framing from TREEUI-05.
- **D-06 (Claude's discretion):** Placement — render on project/page/record detail views where ancestors exist (deferred to planner/researcher to fit existing page layouts; TREEUI-04 says "any page/record/project").
- **D-07 (Claude's discretion):** Truncation — given the max realistic chain is 3 folder levels (depth limit from Phase 31/D-04) + project + page ≈ 5 segments, decide at planning time whether that's short enough to just wrap/scroll, or whether an ellipsis-collapse pattern is still worth building.
- **D-08 (Claude's discretion):** Ancestor path source — decide whether to walk the already-fetched full tree client-side (no new API) or request a lightweight ancestor-path endpoint, based on whether the full tree is reliably loaded on every page that needs breadcrumbs (e.g. a direct deep link with the sidebar not yet mounted/fetched).

### Sidebar Shape
- **D-09 (Claude's discretion, exercised):** The tree does **not** replace the entire flat `ITEMS` list. Fixed, module-level nav items (Dashboard, Fleet, Automations, Marketplace, Metrics, Documents, Team/Settings, CMR Manager external link) are not folders/projects/programs — they represent app-level features, not organizational content — so they stay exactly as-is. The tree is a **new section** inserted between the top fixed items and the `ALWAYS_BOTTOM` group, replacing whatever `ITEMS` previously lacked for organizational content (there was no "Records"/tree slot before this).
- **D-10 (Claude's discretion, exercised):** The tree section gets a small non-interactive section heading (matching the existing visual separation pattern already used for `ALWAYS_BOTTOM`), rather than tree roots rendering with no label.
- **D-11 (Claude's discretion, exercised):** External `crossAppUrl` links (e.g. CMR Manager) keep their current position — purely additive change, no relocation.

### Archived-Node Handling
- **D-12 (Claude's discretion — user deferred this area, not deep-dived):** Default assumption for planning: this read-only tree should exclude nodes with `archived_at` set, matching the eventual TREEOPS-06 default view, rather than surfacing archived nodes with no way to act on them. Researcher/planner should confirm this is the simplest correct default (e.g. check whether Phase 32's `GET /folders/tree/full` already filters archived nodes server-side, in which case there's nothing to do here).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §"Read + Navigate (TREEUI)" — TREEUI-01 through TREEUI-05, the locked requirements for this phase.
- `.planning/ROADMAP.md` §"Phase 33: Tree-Based Sidebar UI (Read + Navigate)" — goal, success criteria, dependency on Phase 32.
- `.planning/phases/31-data-model-modernize-folders-domain/31-CONTEXT.md` — depth limit (3 levels), archive semantics, ancestor-index background from the prior phase.

### Phase 32 API to Consume (already shipped)
- `apps/api/src/domains/folders/folders.routes.ts` — `GET /folders/tree/full` route registration (must precede `/:id` catch-all).
- `apps/api/src/domains/folders/folders.controller.ts` — `getFullTree` handler.
- `apps/api/src/domains/folders/folders.service.ts` — `FoldersService.getFullTree` / `assembleTree` (lines ~28-38, ~382-474), tagged `TREEAPI-01`.
- `apps/api/src/domains/folders/folders.types.ts` — `TreeNode` shape (lines ~31-38): `{ node_type, id, company_id, name, children, raw }`. No `parent_id`/`depth`/ancestor path on the node itself — only on `raw`.

### Existing Sidebar/Nav Code
- `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` — current flat `ITEMS` array (lines ~26-36), `enabled_modules` filtering (lines ~51-60), `ALWAYS_BOTTOM` visual separation pattern, `renderItem` (lines ~66-84).
- `packages/ui/src/appUrls.ts` (lines ~33-36) — `crossAppUrl(app, path)` definition, used at `WorkspaceSidebar.tsx:36` for the CMR Manager external link.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkspaceSidebar.tsx`'s existing `enabled_modules` Set-filtering logic — same client-side filtering approach extends naturally to the recursive tree-node case (D-03).
- `crossAppUrl` (`packages/ui/src/appUrls.ts`) — reuse unchanged for any tree-node-triggered cross-app navigation, consistent with CLAUDE.md's "reuse over rebuild" constraint.

### Established Patterns
- `apps/cmr/src/components/cmr/CmrWorkspace.tsx` uses `idb-keyval` (`get`/`set`) for local persistence — the only working example of `idb-keyval` in the monorepo (it's declared in `apps/workspaces/package.json` but currently unused there). This is the closest existing pattern for per-user expand/collapse persistence (TREEUI-02), though a simpler `localStorage` key (as used in `apps/cmr`'s `hide_cmr_onboarding` flag) may also fit given expand/collapse state is small and synchronous-read-friendly.
- No breadcrumb component or logic exists anywhere in `apps/workspaces` or `packages/ui` today — this phase builds it from scratch.

### Integration Points
- `GET /folders/tree/full` returns a fully aggregated cross-entity tree (folders + projects + programs + collections + pages nested together), root array mixes root folders with root-level non-folder nodes — the sidebar tree renderer needs to handle mixed root-level node types, not just folders.
- Separate `GET /folders/` (`listFolders`/`listFolderTree`) exists returning a folders-only tree — not the one this phase should use; the aggregated `/folders/tree/full` is correct per the Phase 32 canonical refs above.

</code_context>

<specifics>
## Specific Ideas

- Tree node → module mapping is 1:1 with existing `enabled_modules` keys (no new keys needed): `data_collection`/`project_page` → `records`, `program` → `programs`, `project` → always visible.
- Breadcrumb segments must be clickable, navigating via existing ID-keyed URLs (not new tree-relative routes).
- Sidebar keeps all existing fixed nav items unchanged; the tree is additive, not a replacement.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Archived-node handling was raised as a gray area but not deep-dived (user deferred to Claude's discretion, captured as D-12); it is not a new capability, just an implementation default for planning to confirm.

</deferred>

---

*Phase: 33-Tree-Based Sidebar UI (Read + Navigate)*
*Context gathered: 2026-07-20*
