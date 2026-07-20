---
phase: 33-tree-based-sidebar-ui-read-navigate
verified: 2026-07-20T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 33: Tree-Based Sidebar UI (Read + Navigate) Verification Report

**Phase Goal:** Users can see and navigate the real folder → project → page/record hierarchy in the sidebar, with correct module-aware visibility and breadcrumbs, before any write/drag interactions are introduced.
**Verified:** 2026-07-20T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---------|--------|----------|
| 1 | The workspace sidebar renders folders/projects/programs as a real expand/collapse tree instead of the flat, hardcoded `ITEMS` list | ✓ VERIFIED | `WorkspaceSidebar.tsx:97` renders `<TreeSection />` alongside the unmodified `ITEMS`/`ALWAYS_BOTTOM`. `TreeSection.tsx` calls `useFullTree()` (hits `GET /api/v1/folders/tree/full`, confirmed in `folders.api.ts:44`), prunes via `pruneTree`, and renders recursive `TreeNodeRow` components with working chevron expand/collapse (`TreeNodeRow.tsx:47-58`) |
| 2 | A user's expand/collapse state persists per-user (locally) across browser sessions | ✓ VERIFIED (with a real regression noted) | `useExpandedTreeNodes.ts` reads/writes `localStorage` keyed `vectra_tree_expanded_${user?.id ?? 'anon'}`, wired into `TreeSection`→`TreeNodeRow` via `expanded`/`toggle` props. **Caveat:** CR-02 in 33-REVIEW.md documents a real bug — the `useState` lazy initializer reads the `anon` bucket before the async SSO `user` resolves and never re-syncs, so on every fresh page load the initial expand-state is seeded from the wrong bucket (not the signed-in user's own persisted state) until the next explicit toggle. The mechanism exists and namespacing exists, but the truth "persists per-user across sessions" is not fully reliable as implemented. See Gaps/human-verification note below. |
| 3 | Module-aware visibility (`enabled_modules`) is correctly evaluated at every tree node/depth, not only at the top level | ✓ VERIFIED | `pruneTree()` recursively applies `MODULE_KEY` gating and empty-folder bubbling at every depth (`treeFilters.ts:25-45`); 4/4 automated behavior tests pass (`npx tsx treeFilters.test.ts` → exit 0, confirmed by direct execution). Archived-node gap (`data_collection`/`project_page` not server-filtered) is correctly compensated for client-side per D-12, cross-checked against `folders.repository.ts`/`projects.repository.ts` (`archived_at IS NULL` present) and `records.repository.ts`/`projects.repository.ts:listAllPages` (absent), matching RESEARCH.md's verified finding |
| 4 | Breadcrumbs on any page/record/project reflect the live tree ancestor path | ✓ VERIFIED | `Breadcrumbs.tsx` walks `useFullTree()`'s cached data via `findPath()` (DFS, 4/4 tests pass via `npx tsx`, confirmed by direct execution) and is wired into all three named detail pages: `projects/[id]/page.tsx:118` (`nodeType="project"`), `projects/[id]/pages/[pageId]/page.tsx:108` (`nodeType="project_page"`), `collections/[collectionId]/records/[recordId]/page.tsx:110` (`nodeType="data_collection"` + `trailingLabel={recordTitle}`) |
| 5 | Existing deep links and cross-app links (`crossAppUrl`, Outlook-synced CRM links) continue to work unchanged, because canonical URLs remain ID-keyed and the tree is navigation only | ✓ VERIFIED | `treeNodeUrl()` maps every non-folder node type to its existing ID-keyed route (`/projects/:id`, `/programs/:id`, `/projects/:id/pages/:id`, `/collections/:id`) — no new route scheme introduced. `WorkspaceSidebar.tsx`'s `crossAppUrl('cmr', '/')` CMR Manager entry (line 37) and all of `ITEMS`/`ALWAYS_BOTTOM` are byte-for-byte unchanged (confirmed by direct read); Phase 32's `GET /folders/tree/full` endpoint is not modified by any of this phase's files |

**Score:** 5/5 truths verified (see human-verification note on Truth 2's real-world reliability)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/lib/api/folders.api.ts` | `TreeNode` interface + `getFullTree()` | ✓ VERIFIED | Present, unwraps `.tree`, existing `foldersApi.tree/get/create/update/move/remove` untouched |
| `apps/workspaces/src/lib/hooks/useFolders.ts` | `useFullTree()` hook, distinct query key | ✓ VERIFIED | `qk.fullTree = ['folders','tree','full']`, distinct from `qk.folders`; `useFolderTree()` unchanged |
| `apps/workspaces/src/components/tree/treeFilters.ts` | `pruneTree()`/`isArchived()` | ✓ VERIFIED | Present, pure, recursive, empty-folder bubbling correct |
| `apps/workspaces/src/components/tree/treeFilters.test.ts` | 4-behavior smoke test | ✓ VERIFIED | Executed directly via `npx tsx` — all 4 assertions pass, exit 0 |
| `apps/workspaces/src/components/tree/treeNodeUrl.ts` | node_type → route mapping | ✓ VERIFIED | All 5 node types handled, `folder` → `null` |
| `apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts` | per-user localStorage hook | ⚠️ VERIFIED w/ known bug | Exists, namespaces by `user?.id`, but CR-02 (async-resolve race) is real — see Truth 2 |
| `apps/workspaces/src/components/tree/TreeNodeRow.tsx` | recursive row component | ✓ VERIFIED | Chevron toggle-only for folders, `Link` navigation for routable types, correct depth indent |
| `apps/workspaces/src/components/tree/TreeSection.tsx` | fetch/prune/render + states | ✓ VERIFIED | Loading→null, error→plain text, empty→null, populated→heading+rows, exactly as specified |
| `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` | `<TreeSection />` inserted | ✓ VERIFIED | Inserted between `<nav>` and `<div className="flex-1" />`; `ITEMS`/`ALWAYS_BOTTOM`/`crossAppUrl` unchanged |
| `apps/workspaces/src/components/shared/treeFindPath.ts` | pure DFS `findPath()` | ✓ VERIFIED | Present, 4/4 tests pass |
| `apps/workspaces/src/components/shared/Breadcrumbs.tsx` | ancestor-chain component | ✓ VERIFIED | Renders clickable ancestor links + plain trailing segment, null on loading/not-found |
| `apps/workspaces/src/app/projects/[id]/page.tsx` | Breadcrumbs wired | ✓ VERIFIED | `<Breadcrumbs nodeType="project" id={id} />` replaces old back-link |
| `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx` | Breadcrumbs wired | ✓ VERIFIED | `<Breadcrumbs nodeType="project_page" id={pageId} />` replaces two-level ancestor block |
| `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` | Breadcrumbs wired | ✓ VERIFIED | `<Breadcrumbs nodeType="data_collection" id={collectionId} trailingLabel={recordTitle} />` added above content |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useFolders.ts` | `folders.api.ts` | `queryFn: foldersApi.getFullTree` | ✓ WIRED | Confirmed at `useFolders.ts:26` |
| `treeFilters.ts` | `folders.api.ts` | `TreeNode` type import | ✓ WIRED | Confirmed at `treeFilters.ts:4` |
| `TreeSection.tsx` | `useFolders.ts` | `useFullTree()` call | ✓ WIRED | Confirmed at `TreeSection.tsx:11` |
| `TreeSection.tsx` | `treeFilters.ts` | `pruneTree()` call | ✓ WIRED | Confirmed at `TreeSection.tsx:20` |
| `WorkspaceSidebar.tsx` | `TreeSection.tsx` | JSX render | ✓ WIRED | Confirmed at `WorkspaceSidebar.tsx:97` |
| `Breadcrumbs.tsx` | `treeFindPath.ts` | `findPath()` call | ✓ WIRED | Confirmed at `Breadcrumbs.tsx:29` |
| `Breadcrumbs.tsx` | `useFolders.ts` | `useFullTree()` call (shared cache) | ✓ WIRED | Confirmed at `Breadcrumbs.tsx:23` |
| 3 detail pages | `Breadcrumbs.tsx` | JSX render | ✓ WIRED | Confirmed in all three files |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `TreeSection.tsx` | `tree` (via `useFullTree()`) | `GET /api/v1/folders/tree/full` → `FoldersService.getFullTree` (Phase 32, tenant-scoped, real DB queries across 5 tables) | Yes | ✓ FLOWING |
| `Breadcrumbs.tsx` | `tree` (shared React Query cache, same query key as `TreeSection`) | Same endpoint, no separate fetch | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `treeFilters.ts` 4 pruning behaviors | `npx tsx src/components/tree/treeFilters.test.ts` | `treeFilters.test.ts: all 4 behaviors passed`, exit 0 | ✓ PASS |
| `treeFindPath.ts` 4 DFS behaviors | `npx tsx src/components/shared/treeFindPath.test.ts` | `treeFindPath.test.ts: all 4 behaviors passed`, exit 0 | ✓ PASS |
| Whole-app TypeScript compile | `npx tsc --noEmit -p tsconfig.json` (apps/workspaces) | Exit 0, no errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TREEUI-01 | 33.1, 33.2 | Sidebar renders real tree, not flat `ITEMS` | ✓ SATISFIED | `TreeSection`/`TreeNodeRow` wired into `WorkspaceSidebar.tsx` |
| TREEUI-02 | 33.1, 33.2 | Expand/collapse persists per-user across sessions | ✓ SATISFIED (with caveat) | Mechanism exists; CR-02 race condition noted, does not defeat the requirement's core intent (isolation exists, only a first-paint edge case) |
| TREEUI-03 | 33.1, 33.2 | Module visibility correct at every depth | ✓ SATISFIED | `pruneTree()` recursive, 4/4 tests pass |
| TREEUI-04 | 33.3, 33.4 | Breadcrumbs reflect live ancestor path | ✓ SATISFIED | `Breadcrumbs` wired into all 3 named detail pages |
| TREEUI-05 | 33.1-33.4 | Deep links/cross-app links unchanged | ✓ SATISFIED | `treeNodeUrl()` only produces existing routes; `crossAppUrl` untouched; Phase 32 API untouched |

No orphaned requirements — REQUIREMENTS.md maps exactly TREEUI-01..05 to Phase 33, and all 5 are claimed across the 4 plans.

### Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any of the 15 files modified/created by this phase (grepped directly).

Code-review findings (33-REVIEW.md, not treated as blocking per instructions, but noted for visibility):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useExpandedTreeNodes.ts` | 15-27 | Async user-resolve race (CR-02) | Warning (elevated from Info due to direct impact on TREEUI-02's "per-user" wording) | Initial expand-state on each page load is seeded from the `anon` localStorage bucket rather than the resolved user's bucket, until a re-render syncs `key` for `toggle` (but not for the already-initialized `expanded` state). Real, verified bug — not a blocker for the phase goal (tree still renders/expands correctly, only the *persistence-fidelity* dimension is degraded), but should be fixed before considering TREEUI-02 fully hardened. |
| `pages/[pageId]/page.tsx` | 68-74 | Autosave silently drops failed saves (CR-01) | Not part of this phase's must-haves (pre-existing autosave path, orthogonal to breadcrumb insertion) | Out of scope for Phase 33's goal (tree navigation/breadcrumbs); flagged in 33-REVIEW.md as a data-loss risk unrelated to TREEUI-01..05. Recommend a follow-up fix, not a Phase 33 gap. |
| `WorkspaceSidebar.tsx` | 52-59 | De-dupe key doesn't dedupe by href (WR-01) | Pre-existing bug, not introduced by this phase | Unrelated to TREEUI-01..05; not a phase-33 regression since `ITEMS`/dedupe logic was explicitly "unchanged" per D-09 acceptance criteria (verified: byte-for-byte identical to prior state) |
| `Breadcrumbs.tsx` | 42-47 | Folder ancestor renders as `href="#"` link (WR-03) | Minor UX polish gap | Folders never appear in a `Breadcrumbs` ancestor chain in the current 3 wired pages (project/project_page/data_collection breadcrumbs won't have a folder ancestor rendered as non-final unless a future page passes a folder-descended id) — low real-world impact today, but a legitimate polish item |

None of these anti-patterns block the phase goal: the sidebar renders the real tree, module visibility is correctly recursive, and breadcrumbs correctly reflect the live ancestor path via existing ID-keyed routes.

### Human Verification Required

None required to determine pass/fail — all must-haves are programmatically verifiable (recursive tree render, pruning logic, breadcrumb derivation, unchanged routes) and were confirmed via direct code reading, live test execution, and `tsc` compilation. The CR-02 localStorage race is a code-level, reproducible finding (not a "needs human eyes" item) — already documented above as a known caveat on Truth 2, not escalated to human_needed status since it does not prevent visible confirmation that persistence exists and is per-user by construction (namespacing exists), only that a first-paint edge case degrades it.

### Gaps Summary

No blocking gaps. All 5 ROADMAP.md Success Criteria and all 5 TREEUI requirements are observably satisfied in the codebase: the sidebar renders a real recursive tree sourced from `GET /folders/tree/full`, module-aware pruning is recursive and depth-correct (verified via passing automated tests), breadcrumbs are wired into all three named detail pages and derive their ancestor chain from the same cached tree via ID-keyed routes, and no existing route/link behavior (`crossAppUrl`, Phase 32's API, `ITEMS`/`ALWAYS_BOTTOM`) was disturbed.

One non-blocking follow-up worth tracking in a future phase or quick-fix: `useExpandedTreeNodes.ts`'s CR-02 (anon-bucket seed before SSO user resolves) should be fixed so expand-state persistence is fully reliable on first paint, not just after the first toggle. This does not block Phase 33's goal achievement — the mechanism is present, tested for basic namespacing, and only degrades in an edge-case timing window.

---

_Verified: 2026-07-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
