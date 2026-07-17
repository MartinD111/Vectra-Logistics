---
phase: 31-data-model-modernize-folders-domain
reviewed: 2026-07-17T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - apps/api/src/domains/folders/dto/folder.dto.ts
  - apps/api/src/domains/folders/folders.controller.ts
  - apps/api/src/domains/folders/folders.integration.test.ts
  - apps/api/src/domains/folders/folders.repository.test.ts
  - apps/api/src/domains/folders/folders.repository.ts
  - apps/api/src/domains/folders/folders.routes.ts
  - apps/api/src/domains/folders/folders.service.test.ts
  - apps/api/src/domains/folders/folders.service.ts
  - apps/api/src/domains/folders/folders.types.ts
  - apps/api/src/domains/projects/projects.controller.ts
  - apps/api/src/domains/projects/projects.repository.ts
  - apps/api/src/domains/projects/projects.routes.ts
  - apps/api/src/domains/projects/projects.service.test.ts
  - apps/api/src/domains/projects/projects.service.ts
  - apps/api/src/domains/projects/projects.types.ts
  - apps/api/src/domains/records/dto/create-collection.dto.ts
  - apps/api/src/domains/records/dto/update-collection.dto.ts
  - apps/api/src/domains/records/records.repository.test.ts
  - apps/api/src/domains/records/records.repository.ts
  - apps/api/src/domains/records/records.service.test.ts
  - apps/api/src/domains/records/records.service.ts
  - apps/api/src/domains/records/records.types.ts
  - database/migrations/028_folder_hierarchy_invariants.sql
findings:
  critical: 4
  warning: 6
  info: 0
  total: 10
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the folders/projects/records domain rework that introduces the folder hierarchy (`ancestor_ids`, cascade-archive, depth/cycle invariants) plus the `folder_id` wiring into projects/programs/data_collections. The migration's composite-FK + trigger design is solid and the cascade-archive transaction (folders → projects → programs/pages → collections) is well tested at the integration level. However, the depth-3 invariant that the migration enforces at the DB layer for direct `parent_id` changes is **not** enforced for the folder-move cascade path, the move operation itself is not atomic across the folder's own row and its descendants, several `UPDATE ... COALESCE` patches silently ignore explicit `null` intended to clear a field, and one cross-domain ownership check is inconsistent with its siblings (allows assigning a project into an archived folder). Also found dead code (unused DTO schemas, an unused repository method) and a couple of UX/error-semantics rough edges.

## Critical Issues

### CR-01: Folder move does not re-validate depth for descendants — can silently exceed MAX_FOLDER_DEPTH

**File:** `apps/api/src/domains/folders/folders.service.ts:67-70` (also see the trigger in `database/migrations/028_folder_hierarchy_invariants.sql:154-187`)

**Issue:** `moveFolder` only checks that the *moved folder itself* doesn't exceed depth 3:
```ts
const newDepth = parent.ancestor_ids.length + 1 + 1;
if (newDepth > MAX_FOLDER_DEPTH) {
  throw new AppError(400, 'Folder nesting cannot exceed depth 3');
}
```
It never checks the depth of the moved folder's *descendants* after the move. The DB trigger (`folders_prevent_cycle_and_depth_trg`) only fires `BEFORE INSERT OR UPDATE OF parent_id ON folders` — but `patchDescendantAncestors` rewrites descendants' `ancestor_ids` directly without touching `parent_id`, so the trigger never runs for them.

Concrete repro: folder A (depth 1) → B (depth 2) → C (depth 3, leaf). Move B under another depth-2 folder D. `newDepth` for B = `D.ancestor_ids.length + 1 + 1` = 3, which passes the check. But C, which stays a child of B, is now at depth 4 — silently violating the documented "nesting cannot exceed depth 3" invariant with zero validation or error.

**Fix:** Before committing the move, compute the max depth among descendants (e.g. `MAX(array_length(ancestor_ids,1))` for all ids in `descendantFolderIds`) and reject the move if `newDepth + (maxDescendantRelativeDepth) > MAX_FOLDER_DEPTH`, or equivalently walk `descendantFolderIds` and compare the length of each patched `ancestor_ids` against the limit before applying `patchDescendantAncestors`.

### CR-02: Folder move is not atomic — folder's own row and descendant ancestor patch run outside a shared transaction

**File:** `apps/api/src/domains/folders/folders.service.ts:74-91`

**Issue:**
```ts
const updated = await foldersRepository.moveFolder(id, parentId, ancestorIds); // uses module `db` pool, auto-commits
...
const client = await db.connect();
try {
  await client.query('BEGIN');
  await foldersRepository.patchDescendantAncestors(client, id, folder.ancestor_ids, ancestorIds, tenantId);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```
`moveFolder` (the write to the folder's own `parent_id`/`ancestor_ids`) commits immediately via the module-level pool. The descendant-ancestor rewrite is a *separate* transaction on a separate connection. If `patchDescendantAncestors` throws (deadlock, transient DB error, connection drop) after `moveFolder` has already committed, the folder itself is moved but every descendant retains stale `ancestor_ids` — breaking the invariant the whole `ancestor_ids` design exists to guarantee (fast, correct descendant lookups via `ancestor_ids @>`).

**Fix:** Wrap both the folder's own move and the descendant patch in one transaction/client, e.g.:
```ts
const client = await db.connect();
try {
  await client.query('BEGIN');
  const updated = await foldersRepository.moveFolderTx(client, id, parentId, ancestorIds);
  if (hasDescendants) {
    await foldersRepository.patchDescendantAncestors(client, id, folder.ancestor_ids, ancestorIds, tenantId);
  }
  await client.query('COMMIT');
  return updated;
} catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
```

### CR-03: `UPDATE ... COALESCE` patterns silently drop explicit `null` meant to clear nullable fields

**Files:**
- `apps/api/src/domains/folders/folders.repository.ts:56-70` (`icon`, `color`)
- `apps/api/src/domains/projects/projects.repository.ts:48-63` (`description`, `color`, `folder_id`)
- `apps/api/src/domains/projects/projects.repository.ts:128-148` (`description`, `project_id`, `folder_id`)

**Issue:** `UpdateFolderSchema`, `UpdateProjectSchema`, and `UpdateProgramSchema` all declare `icon`/`color`/`description`/`folder_id`/`project_id` as `.nullable().optional()` — i.e. the API contract explicitly supports "send `null` to clear this field." But the repository writes use `COALESCE($n, column)`:
```ts
`UPDATE folders SET
   name  = COALESCE($2, name),
   icon  = COALESCE($3, icon),
   color = COALESCE($4, color),
   ...`,
[id, data.name ?? null, data.icon ?? null, data.color ?? null],
```
Because the service converts "not provided" (`undefined`) and "explicitly clear" (`null`) into the same SQL parameter (`null`), and `COALESCE(NULL, column)` always evaluates to the existing `column` value, a client can never clear `icon`, `color`, `description`, `folder_id` (to detach a project from a folder), or `project_id` (to detach a program from a project) via these endpoints — the request appears to succeed (200, returns the *old* value) but silently no-ops.

Note this exact pitfall was already solved correctly elsewhere in the same PR, in `projects.repository.ts:303-341` (`updatePage`), using a provided-flag + `CASE WHEN` pattern, and in `records.repository.ts:74-89`/`179-195` (`updateCollection`/`updateRecord`), using a dynamic `Object.entries(patch)` builder that only skips `undefined` (not `null`). The folders/projects `update*` methods below that were not migrated to either pattern.

**Fix:** Apply the same provided-flag/`CASE WHEN` (or dynamic-patch) pattern used in `updatePage`/`updateCollection` to `folders.repository.updateFolder`, `projects.repository.updateProject`, and `projects.repository.updateProgram`, e.g.:
```ts
icon = CASE WHEN $x::boolean THEN $y ELSE icon END
```
with `data.icon !== undefined` passed as the flag.

### CR-04: Project/program folder assignment allows filing into an archived folder (inconsistent with records/folders domains)

**File:** `apps/api/src/domains/projects/projects.service.ts:259-263`

**Issue:**
```ts
private async assertOwnedFolder(id: string, companyId: string): Promise<void> {
  const f = await foldersRepository.findFolder(id);       // NOT scoped by archived_at
  if (!f) throw new AppError(404, 'Folder not found');
  if (f.company_id !== companyId) throw new AppError(403, 'Forbidden');
}
```
`foldersRepository.findFolder` has no `archived_at IS NULL` filter, unlike `findFolderForCompany` (used by `foldersService` itself for create/move, and by `recordsService.assertOwnedFolder` for collections — `records.repository.ts` / `records.service.ts:186-189`). This means `createProject`/`updateProject`/`createProgram`/`updateProgram` will happily file a project or program into an already-archived folder, while `records` and `folders` domains reject the same operation with 404. This is both an inconsistency across domains and a real state-integrity gap — a project can end up referencing a folder that will never appear in `listFolderTree` (which excludes archived rows), and if that folder is later hard-deleted, the FK is `ON DELETE SET NULL` so no error surfaces to explain the disappearance.

**Fix:** Use `foldersRepository.findFolderForCompany(id, companyId)` in `projects.service.assertOwnedFolder` for parity with the other two domains, and drop the now-redundant manual `company_id` check.

## Warnings

### WR-01: Re-archiving an already-archived folder/project returns a misleading 404

**File:** `apps/api/src/domains/folders/folders.service.ts:189-190`; `apps/api/src/domains/projects/projects.repository.ts:65-72` + `projects.service.ts:46-56`

**Issue:** `archiveFolderSubtree`/`archiveProject` filter `WHERE archived_at IS NULL`, so calling archive on an already-archived folder/project returns no row. The service then throws `AppError(404, 'Folder not found')` / `'Project not found'` even though the row exists and ownership was already asserted moments earlier by `assertOwnedFolder`/`assertOwnedProjectAnyState`. This is confusing: a client polling "archive if not already archived" gets a 404 that looks like the id is invalid, not "already archived."

**Fix:** Either make archive idempotent (return the existing archived row with 200 instead of erroring) or throw a distinct `AppError(409, 'Already archived')` so the client can tell the difference from a genuine missing-id 404.

### WR-02: Descendant-id reads for archive/move cascades happen outside the write transaction (TOCTOU window)

**File:** `apps/api/src/domains/folders/folders.service.ts:77` (`moveFolder`) and `:106` (`archiveFolder`)

**Issue:** `foldersRepository.descendantFolderIds(tenantId, id)` runs on the module-level `db` pool, not on the `client` used for the subsequent transactional writes. Between that read and the transactional archive/patch, a concurrent request could reparent a new folder under `id`, and that folder would be excluded from the cascade (left un-archived, or left with stale `ancestor_ids` after a move) even though it is logically inside the subtree being archived/moved.

**Fix:** Either take the descendant-id read inside the same transaction (`client.query` with appropriate isolation/locking), or accept the race and document it explicitly as a known limitation.

### WR-03: Dead code — `foldersRepository.findFoldersByIds` is never called

**File:** `apps/api/src/domains/folders/folders.repository.ts:27-33`

**Issue:** `findFoldersByIds` is defined but not referenced anywhere in `folders.service.ts`, `projects.service.ts`, or `records.service.ts` (verified via repo-wide search — only the definition itself matches).

**Fix:** Remove it, or wire it in wherever bulk-folder lookups were intended (e.g. resolving multiple `folder_id`s for a listing view).

### WR-04: Dead code — `ArchiveFolderSchema`/`UnarchiveFolderSchema` (and their inferred types) are unused

**File:** `apps/api/src/domains/folders/dto/folder.dto.ts:26-27, 32-33`

**Issue:** Both `ArchiveFolderSchema`/`UnarchiveFolderSchema` are exported but never imported/parsed by `folders.controller.ts` or `folders.service.ts` — `archiveFolder`/`unarchiveFolder` take no body at all. Same for the derived `ArchiveFolderDto`/`UnarchiveFolderDto` types.

**Fix:** Delete the unused exports, or if body validation was intended (e.g. future audit-note/reason field), wire the schema into the controller/service.

### WR-05: Path params (`req.params.id`) are never format-validated before hitting the DB

**File:** `apps/api/src/domains/folders/folders.controller.ts:10-33`, `apps/api/src/domains/projects/projects.controller.ts:13-108`

**Issue:** None of `getFolder`, `updateFolder`, `moveFolder`, `archiveFolder`, `unarchiveFolder`, `getProject`, `getProgram`, `getPage`, etc. validate that `req.params.id` (or `pageId`) is a well-formed UUID before passing it straight into a parameterized `WHERE id = $1` query. Postgres will throw `invalid input syntax for type uuid` for a malformed id, which is an unhandled error path bubbling up through `asyncHandler` → `errorHandler` as a generic 500 instead of a clean 400/404. This is pre-existing pattern elsewhere in the codebase too, but is exercised heavily by this phase's new folder/move/archive endpoints.

**Fix:** Add a small `z.string().uuid()` guard (or a shared middleware) applied to route params before dispatching to the service layer.

### WR-06: Redundant capability check performed twice per admin-gated request

**File:** `apps/api/src/domains/folders/folders.routes.ts:12-17` + `apps/api/src/domains/folders/folders.service.ts:27, 43, 54, 97, 203`

**Issue:** Every admin-gated folder route already applies `requireCapability('workspace.admin')` middleware, and the corresponding service method also calls `assertCapability(ctx, 'workspace.admin')` immediately afterward. This isn't wrong (defense in depth), but it's duplicated logic with two different enforcement points that must be kept in sync; if one is updated (e.g. capability renamed) without the other, the check silently becomes inconsistent (harmless if names stay identical, but a latent maintenance hazard). `projects.controller.ts`/`projects.service.ts` do not follow the same double-check pattern (only route-level middleware), so the folders domain is inconsistent with its sibling domain here too.

**Fix:** Pick one enforcement layer (route middleware is sufficient given `RequestContext` is already populated by `authenticateToken`) and drop the duplicate `assertCapability` calls in the service, for consistency with `projects.service.ts`.

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
