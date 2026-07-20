---
phase: 33-tree-based-sidebar-ui-read-navigate
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/workspaces/src/lib/api/folders.api.ts
  - apps/workspaces/src/lib/hooks/useFolders.ts
  - apps/workspaces/src/components/tree/treeFilters.ts
  - apps/workspaces/src/components/tree/treeFilters.test.ts
  - apps/workspaces/src/components/tree/treeNodeUrl.ts
  - apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts
  - apps/workspaces/src/components/tree/TreeNodeRow.tsx
  - apps/workspaces/src/components/tree/TreeSection.tsx
  - apps/workspaces/src/components/layout/WorkspaceSidebar.tsx
  - apps/workspaces/src/components/shared/treeFindPath.ts
  - apps/workspaces/src/components/shared/treeFindPath.test.ts
  - apps/workspaces/src/components/shared/Breadcrumbs.tsx
  - apps/workspaces/src/app/projects/[id]/page.tsx
  - apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx
  - apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-07-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the tree-based sidebar read/navigate feature (folders API client, tree filtering/pruning, expand-state persistence, tree row rendering, sidebar wiring, breadcrumbs, and the three page integrations that consume `Breadcrumbs`/`useFullTree`). The pure-function utilities (`pruneTree`, `findPath`, `treeNodeUrl`) are well-tested and correct for the cases exercised. However, the project-page autosave path (`pages/[pageId]/page.tsx`) has a real data-loss risk — it silently swallows save failures, unlike the sibling client-detail-page pattern it claims to mirror. The per-user expand-state hook also fails to re-sync once the async-loaded SSO user resolves, undermining the multi-user isolation the code's own comment promises. Several smaller consistency and dead-prop issues round out the findings below.

## Critical Issues

### CR-01: Project-page autosave silently drops failed saves (no error handling, dirty flag cleared before mutate resolves)

**File:** `apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx:68-74`
**Issue:** The debounced autosave effect clears `dirtyRef.current = false` *before* calling `update.mutate(...)`, and the mutation call has no `onError` handler:

```ts
saveTimer.current = setTimeout(() => {
  dirtyRef.current = false;
  update.mutate({ config: config as unknown as Record<string, unknown> }, {
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 1500); },
  });
}, 1500);
```

If the PATCH request fails (network blip, 5xx, auth expiry), the user sees no error indicator (no `canvasSaveError`-equivalent state exists on this page) and `dirtyRef` is already `false`, so the unmount-flush effect (lines 81-88) will not retry the save either. The user's edits are silently lost with a UI that never reports the failure. This is a regression relative to the sibling implementation this file was supposedly modeled after: `apps/workspaces/src/app/records/[clientId]/page.tsx` (and the reviewed `collections/[collectionId]/records/[recordId]/page.tsx`) both track a `pending` snapshot, only clear `dirtyRef` `onSuccess`, and surface a `canvasSaveError` state to the user on `onError`.

**Fix:**
```ts
saveTimer.current = setTimeout(() => {
  const pending = config;
  update.mutate({ config: pending as unknown as Record<string, unknown> }, {
    onSuccess: () => {
      if (configRef.current === pending) dirtyRef.current = false;
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    },
    onError: () => setSaveError(true), // and render an error indicator, mirroring records/[recordId]/page.tsx
  });
}, 1500);
```

### CR-02: Per-user tree expand-state hook doesn't re-sync once the async SSO user resolves, defeating its own multi-user isolation goal

**File:** `apps/workspaces/src/lib/hooks/useExpandedTreeNodes.ts:15-27`
**Issue:** The hook's header comment states: "this is a multi-user SSO app, so a single global storage key would leak one user's expand state into another user's session on a shared browser profile." However, `useAuth()` resolves the user asynchronously (see `apps/workspaces/src/context/AuthContext.tsx`, wrapping `@vectra/auth`'s `SharedAuthProvider`). The `expanded` state is seeded via a `useState` **lazy initializer**, which runs exactly once on mount:

```ts
const key = storageKey(user?.id); // user is undefined on first render(s)
const [expanded, setExpanded] = useState<Set<string>>(() => {
  ...
  const raw = window.localStorage.getItem(key); // reads the "anon" bucket
  ...
});
```

On first mount `user` is `undefined`, so `key` resolves to `vectra_tree_expanded_anon` and the initial `expanded` set is read from the anon bucket — not the real signed-in user's bucket. Once `user` resolves on a later render, `key` is recomputed (used by `toggle`'s `useCallback` deps) but the already-initialized `expanded` state is never re-read from the correct per-user key. Net effect: on every page load, expand state is seeded from the shared "anon" bucket (not the user's own persisted state), and on a shared machine with multiple SSO users hitting this before auth resolves, expand-state can genuinely leak across accounts via the anon bucket — the exact scenario the comment says this design prevents.

**Fix:** Re-read from storage when `user?.id` changes, e.g. add a `useEffect` that resyncs `expanded` from `key` whenever `key` changes (skip until `user` has resolved, or key it explicitly on `user === undefined` vs a real id), instead of relying solely on the one-time lazy initializer.

## Warnings

### WR-01: Sidebar nav de-dupe key does not actually de-dupe by href, contradicting its own comment

**File:** `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx:52-59`
**Issue:** The comment says: "De-dupe by href so overlapping module keys don't double-list a route," but the dedupe key concatenates `href + name`:

```ts
if (seen.has(it.href + it.name)) return false;
seen.add(it.href + it.name);
```

`ITEMS` contains both `{ name: 'Programs', href: '/automations', module: 'programs' }` and `{ name: 'Automations', href: '/automations', module: 'automations' }`. If a workspace type enables both the `programs` and `automations` modules, both entries pass the module gate and both keys (`'/automationsPrograms'`, `'/automationsAutomations'`) are distinct, so **both** nav items render, pointing to the identical `/automations` route — the exact double-listing the comment says this logic prevents.
**Fix:** De-dupe on `href` alone: `if (seen.has(it.href)) return false; seen.add(it.href);`

### WR-02: `Breadcrumbs` accepts a `nodeType` prop it never uses — no verification the resolved node matches the expected type

**File:** `apps/workspaces/src/components/shared/Breadcrumbs.tsx:16-22`
**Issue:** `BreadcrumbsProps` declares `nodeType: TreeNode['node_type']`, and every call site (`page.tsx:118`, `pages/[pageId]/page.tsx:108`, `records/[recordId]/page.tsx:110`) passes it, implying it is used to validate or select the correct node. The component destructures only `{ id, trailingLabel }` — `nodeType` is dropped entirely and never checked against `path[path.length - 1].node_type`. This is misleading: a caller could pass the wrong `nodeType` (e.g. copy-paste error) for a given `id` and nothing would catch it; the prop exists purely as documentation with no runtime effect.
**Fix:** Either remove the unused prop, or use it defensively:
```ts
const current = path[path.length - 1];
if (current.node_type !== nodeType) return null; // or log a dev warning
```

### WR-03: Breadcrumb ancestor folders render as clickable links to `#`

**File:** `apps/workspaces/src/components/shared/Breadcrumbs.tsx:42-47`
**Issue:** `treeNodeUrl` returns `null` for `folder` nodes (folders have no detail page). The breadcrumb still renders every ancestor — including folders — as a `<Link href={treeNodeUrl(node) ?? '#'}>`, making folder crumbs appear clickable while doing nothing useful (`href="#"` navigates to the top of the current page and adds a no-op history entry).
**Fix:** Render non-navigable ancestors (where `treeNodeUrl(node)` is `null`) as plain `<span>` text instead of a `Link`, consistent with how `TreeNodeRow` already treats folders.

### WR-04: Unsafe cast on `project_page.raw.project_id` with no runtime validation

**File:** `apps/workspaces/src/components/tree/treeNodeUrl.ts:12`
**Issue:** `(node.raw as { project_id: string }).project_id` is a compile-time-only assertion. If the backend `tree/full` payload for a `project_page` node ever omits `project_id` (schema drift, partial migration, bad row), this silently produces `/projects/undefined/pages/<id>` with no error surfaced anywhere — a broken link generated at render time rather than caught early.
**Fix:** Guard the cast, e.g. `const projectId = (node.raw as { project_id?: string }).project_id; return projectId ? \`/projects/${projectId}/pages/${node.id}\` : null;`

## Info

### IN-01: Folder row toggle (`<span onClick>`) has no keyboard affordance

**File:** `apps/workspaces/src/components/tree/TreeNodeRow.tsx:64-71`
**Issue:** When a node has no `href` (folders), the row content renders as a `<span onClick={...}>` with `cursor-pointer` but no `role="button"`, `tabIndex`, or `onKeyDown` handler — keyboard-only users cannot expand/collapse folders via this element (only the separate chevron `<button>` is keyboard-accessible, and it's only rendered `hasChildren`).
**Fix:** Add `role="button" tabIndex={0}` and an `onKeyDown` handler (Enter/Space) to the fallback `<span>`, or render a `<button>` instead.

### IN-02: Chevron expand/collapse button has no accessible label

**File:** `apps/workspaces/src/components/tree/TreeNodeRow.tsx:47-58`
**Issue:** The toggle `<button>` contains only a `ChevronRight` icon with no `aria-label` (e.g. "Expand"/"Collapse") and no `aria-expanded` state, making its purpose opaque to screen reader users.
**Fix:** Add `aria-label={isOpen ? 'Collapse' : 'Expand'}` and `aria-expanded={isOpen}`.

### IN-03: `isActive` prefix-match logic duplicated verbatim across two files

**File:** `apps/workspaces/src/components/tree/TreeSection.tsx:16-17`, `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx:61-62`
**Issue:** Both files define an identical `isActive` closure:
```ts
const isActive = (href: string) =>
  pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
```
Any future change to active-route matching semantics (e.g. adding a boundary check after the prefix) has to be made in two places and can silently drift.
**Fix:** Extract to a shared helper (e.g. `lib/navActive.ts`) and import it from both components.

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
