# Phase 32: Aggregated Tree Read API + Reorder/Move Endpoints - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 8 (3 modified existing domain files + 1 new dto file + 2 modified repository files + 1 new migration + test files reuse existing suites)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/api/src/domains/folders/folders.controller.ts` (add `getFullTree`, `reorderNodes`, `moveNode`) | controller | request-response | Same file, existing `listFolders`/`moveFolder` handlers (lines 6-8, 23-25) | exact — same file, extend in place |
| `apps/api/src/domains/folders/folders.routes.ts` (add 3 routes) | route | request-response | Same file, existing route table (lines 11-17) | exact — same file, extend in place |
| `apps/api/src/domains/folders/folders.service.ts` (add `getFullTree`, `reorderSiblings`, `moveNode`) | service | CRUD (read-aggregate for tree; transactional write for reorder/move) | Same file, existing `listFolderTree` (aggregate-read shape), `archiveFolder` (cross-domain transaction shape), `moveFolder` (dispatch/validate shape) | exact — same file, extend in place |
| `apps/api/src/domains/folders/dto/tree.dto.ts` (new) | config (Zod DTO schema) | request-response (validation) | `apps/api/src/domains/folders/dto/folder.dto.ts` | exact — same domain's DTO convention |
| `apps/api/src/domains/projects/projects.repository.ts` (add `reorderProjects`, `reorderPrograms`, `reorderPages` — lock-safe renumber helpers) | service/repository | CRUD (transactional write) | `apps/api/src/core/events/outbox.ts`'s `claimDueEvents` (`FOR UPDATE SKIP LOCKED` idiom — closest lock precedent) + same file's `updateProject`/`updateProgram`/`updatePage` (COALESCE update shape) | role-match — no reorder precedent exists; combines lock idiom from outbox + update shape from same file |
| `apps/api/src/domains/records/records.repository.ts` (add `reorderCollections`) | service/repository | CRUD (transactional write) | Same as above; also `updateCollection`'s dynamic-column-list pattern (lines 74-89) | role-match — same reasoning as projects repository |
| `database/migrations/029_tree_sort_order.sql` (new) | migration | batch (additive schema change) | `database/migrations/028_folder_hierarchy_invariants.sql` | exact — immediately preceding migration in the same hierarchy-modernization arc |
| Integration/unit test additions (`folders.service.test.ts`, `folders.integration.test.ts`) | test | request-response / CRUD | Same files, existing `moveFolder`/`archiveFolder` test cases | exact — same test files, extend in place |

## Pattern Assignments

### `apps/api/src/domains/folders/folders.controller.ts` — add `getFullTree`, `reorderNodes`, `moveNode`

**Analog:** same file, lines 1-33 (existing handlers)

**Imports pattern** (lines 1-4, unchanged, reuse as-is):
```typescript
import { Response } from 'express';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireRequestContext, RequestWithContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';
```

**Core pattern — every handler is a 1-3 line delegate to the service** (lines 6-8 for a GET, 23-25 for a mutation taking `req.body`):
```typescript
export const listFolders = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folders: await foldersService.listFolderTree(requireRequestContext(req)) });
});

export const moveFolder = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ folder: await foldersService.moveFolder(requireRequestContext(req), req.params.id, req.body) });
});
```

**Apply as:**
```typescript
export const getFullTree = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ tree: await foldersService.getFullTree(requireRequestContext(req)) });
});

export const reorderNodes = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ ok: true, ...(await foldersService.reorderSiblings(requireRequestContext(req), req.body)) });
});

export const moveNode = asyncHandler(async (req: RequestWithContext, res: Response) => {
  res.json({ node: await foldersService.moveNode(requireRequestContext(req), req.body) });
});
```
No try/catch needed at controller layer — `asyncHandler` forwards rejections (including thrown `AppError`) to the global error handler. Controllers never inspect `err`.

---

### `apps/api/src/domains/folders/folders.routes.ts` — add 3 routes

**Analog:** same file, full contents (19 lines)

**Full existing pattern:**
```typescript
import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { requireCapability } from '../../core/capabilities';
import {
  listFolders, getFolder, createFolder, updateFolder, moveFolder, archiveFolder, unarchiveFolder,
} from './folders.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', listFolders);
router.post('/', requireCapability('workspace.admin'), createFolder);
router.get('/:id', getFolder);
router.patch('/:id', requireCapability('workspace.admin'), updateFolder);
router.patch('/:id/move', requireCapability('workspace.admin'), moveFolder);
router.post('/:id/archive', requireCapability('workspace.admin'), archiveFolder);
router.post('/:id/unarchive', requireCapability('workspace.admin'), unarchiveFolder);

export default router;
```

**Apply as** (per RESEARCH.md's Open Question 3 — RESOLVED: mount under `/tree/*`, add to the import list, TREEAPI-04 gates only the two mutations, the read is capability-free like `listFolders`):
```typescript
import { getFullTree, reorderNodes, moveNode /* + existing imports */ } from './folders.controller';
// ...
router.get('/tree/full', getFullTree);
router.post('/tree/reorder', requireCapability('workspace.admin'), reorderNodes);
router.post('/tree/move', requireCapability('workspace.admin'), moveNode);
```
**IMPORTANT — route ordering:** Express matches routes in registration order. `/tree/full` etc. must be registered *before* `router.get('/:id', getFolder)` or `/:id` will greedily capture `tree` as a folder id. Register the three new `/tree/*` routes immediately after `router.get('/', listFolders)` and before `router.get('/:id', getFolder)`.

---

### `apps/api/src/domains/folders/folders.service.ts` — add `getFullTree`, `reorderSiblings`, `moveNode`

**Analog:** same file (249 lines) — three separate sub-patterns needed from three separate existing methods.

**Imports pattern** (lines 1-11, extend with `MAX` unchanged, add new DTO imports):
```typescript
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { assertCapability } from '../../core/capabilities';
import { RequestContext, requireCompanyId, requireUserId } from '../../core/auth/request-context';
import { createDurableEventEnvelope, insertDurableEvent } from '../../core/events/outbox';
import { foldersRepository } from './folders.repository';
import { projectsRepository } from '../projects/projects.repository';
import { recordsRepository } from '../records/records.repository';
import { Folder, FolderTree } from './folders.types';
import { CreateFolderSchema, UpdateFolderSchema, MoveFolderSchema } from './dto/folder.dto';
// add: import { ReorderNodesSchema, MoveNodeSchema } from './dto/tree.dto';
```

**Sub-pattern A — aggregate read (`getFullTree`).** Analog: `listFolderTree` (lines 15-19) for the tenant-scope + delegate shape, extended per RESEARCH.md Pattern 1's `Promise.all` of the 5 existing list methods:
```typescript
// EXISTING (lines 15-19):
async listFolderTree(ctx: RequestContext): Promise<FolderTree[]> {
  const tenantId = requireCompanyId(ctx);
  const flat = await foldersRepository.listFolders(tenantId);
  return this.buildTree(flat, null);
}

// NEW — apply this shape:
async getFullTree(ctx: RequestContext) {
  const tenantId = requireCompanyId(ctx);
  const [folders, projects, programs, pages, collections] = await Promise.all([
    foldersRepository.listFolders(tenantId),
    projectsRepository.listProjects(tenantId),
    projectsRepository.listPrograms(tenantId), // no projectId arg = ALL programs for tenant
    projectsRepository.listAllPages(tenantId),
    recordsRepository.listCollections(tenantId),
  ]);
  return this.assembleTree(folders, projects, programs, pages, collections);
}
```
The `buildTree` private helper (lines 236-240) is the existing in-memory nesting technique to extend/reuse for `assembleTree`:
```typescript
private buildTree(flat: Folder[], parentId: string | null): FolderTree[] {
  return flat
    .filter((f) => f.parent_id === parentId)
    .map((f) => ({ ...f, children: this.buildTree(flat, f.id) }));
}
```

**Sub-pattern B — transactional cross-domain write (`reorderSiblings`, `moveNode` where a transaction is needed).** Analog: `archiveFolder` (lines 96-200) for the `db.connect()` / `BEGIN` / try-catch-finally / `ROLLBACK` shape, and `moveFolder` (lines 53-94) for the capability-gate + Zod-parse + `assertOwnedFolder` + dispatch shape:
```typescript
// EXISTING moveFolder validation/dispatch opening (lines 53-60):
async moveFolder(ctx: RequestContext, id: string, body: unknown): Promise<Folder> {
  assertCapability(ctx, 'workspace.admin');
  const tenantId = requireCompanyId(ctx);
  const folder = await this.assertOwnedFolder(id, tenantId);
  const parsed = MoveFolderSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  // ...

// EXISTING archiveFolder transaction shape (lines 102-199, abbreviated):
const client = await db.connect();
try {
  await client.query('BEGIN');
  // ... repository calls taking `client` as first arg, each emitting insertDurableEvent(client, ...)
  await client.query('COMMIT');
  return updated;
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```
**Apply for `reorderSiblings`** — same transaction skeleton, but the body is the `FOR UPDATE` lock-then-renumber technique (see repository pattern below), plus the 409-on-stale-set check from RESEARCH.md Pitfall 1. Note the `'program'` branch must thread the parsed `project_id` disambiguator through to `reorderPrograms`' `{ folderId, projectId }` scope object — both folder-filed and project-filed program siblings must be reachable, not just folder-filed ones:
```typescript
async reorderSiblings(ctx: RequestContext, body: unknown) {
  assertCapability(ctx, 'workspace.admin');
  const tenantId = requireCompanyId(ctx);
  const parsed = ReorderNodesSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  const { node_type, parent_id, project_id, ordered_ids } = parsed.data;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await this.reorderByType(client, tenantId, node_type, parent_id, project_id, ordered_ids); // dispatches to
    // foldersRepository / projectsRepository / recordsRepository's new reorder* method
    // (each throws AppError(409, ...) internally on stale sibling-set mismatch — see repository pattern)
    // for node_type 'program': project_id set -> { folderId: null, projectId: project_id };
    //                          project_id omitted/null -> { folderId: parent_id, projectId: null }
    await client.query('COMMIT');
    return { node_type, parent_id, project_id: project_id ?? null, ordered_ids };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```
**Apply for `moveNode`** — thin dispatcher by `node_type`, per RESEARCH.md Pattern 3, delegating folder moves straight to the existing `moveFolder` (do not reimplement cycle check) and other types to existing repository `update*` methods with ownership pre-checks. The `'program'` branch must likewise use the parsed `project_id` disambiguator to select between a project-scoped or folder-scoped destination:
```typescript
async moveNode(ctx: RequestContext, body: unknown) {
  assertCapability(ctx, 'workspace.admin');
  const tenantId = requireCompanyId(ctx);
  const parsed = MoveNodeSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  const { node_type, node_id, new_parent_id, project_id } = parsed.data;

  switch (node_type) {
    case 'folder':
      return this.moveFolder(ctx, node_id, { parent_id: new_parent_id }); // reuse verbatim — cycle/depth check included
    case 'project': {
      if (new_parent_id) await this.assertOwnedFolder(new_parent_id, tenantId); // existing 404-on-cross-tenant helper
      const updated = await projectsRepository.updateProject(node_id, { folder_id: new_parent_id });
      if (!updated) throw new AppError(404, 'Project not found');
      return updated;
    }
    case 'program': {
      // project_id set -> project-scoped destination; omitted/null -> folder-scoped destination.
      if (project_id) {
        const project = await projectsRepository.findProjectForCompany(project_id, tenantId);
        if (!project) throw new AppError(404, 'Project not found');
        return projectsRepository.updateProgram(node_id, { project_id, folder_id: null });
      }
      if (new_parent_id) await this.assertOwnedFolder(new_parent_id, tenantId);
      return projectsRepository.updateProgram(node_id, { folder_id: new_parent_id, project_id: null });
    }
    // data_collection follows the identical shape, calling recordsRepository.updateCollection
  }
}
```

**Error handling pattern** (same convention throughout the file): `AppError(400, ...)` on Zod parse failure, `AppError(404, '<Entity> not found')` on missing-row after a scoped update, `AppError(409, ...)` for stale/conflicting state (new for this phase — no existing 409 in this file, but RESEARCH.md confirms the 409 convention exists elsewhere: `invoicing.service.ts`, `pod.service.ts`, `marketplace.service.ts`).

**Ownership/ private helper reused as-is** (lines 242-246):
```typescript
private async assertOwnedFolder(id: string, companyId: string): Promise<Folder> {
  const f = await foldersRepository.findFolderForCompany(id, companyId);
  if (!f) throw new AppError(404, 'Folder not found');
  return f;
}
```

---

### `apps/api/src/domains/folders/dto/tree.dto.ts` (new)

**Analog:** `apps/api/src/domains/folders/dto/folder.dto.ts` (full file, 34 lines)

**Full existing convention:**
```typescript
import { z } from 'zod';

export const MoveFolderSchema = z.object({
  parent_id: z.string().uuid().nullable(),
});

export type MoveFolderDto = z.infer<typeof MoveFolderSchema>;
```

**Apply as** (note the `project_id` disambiguator on both schemas — required because `programs` rows carry both `folder_id` and `project_id`, and a single `parent_id`/`new_parent_id` field cannot address both scopes unambiguously; see 32-01's Task 2 and RESEARCH.md Pattern 3):
```typescript
import { z } from 'zod';

const NodeType = z.enum(['folder', 'project', 'program', 'data_collection']);
// Per RESEARCH.md Open Question 2 (RESOLVED): 'page' intentionally excluded from
// move scope this phase — page reparenting stays on the existing
// PATCH /projects/pages/:pageId.

export const ReorderNodesSchema = z.object({
  node_type: NodeType,
  parent_id: z.string().uuid().nullable(),
  // Program-scope disambiguator: non-null -> project-scoped siblings
  // (project_id-scoped, folder_id null); omitted/null -> folder-scoped siblings
  // (folder_id-scoped via parent_id, project_id null). Unused by other node types.
  project_id: z.string().uuid().nullable().optional(),
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export const MoveNodeSchema = z.object({
  node_type: NodeType,
  node_id: z.string().uuid(),
  new_parent_id: z.string().uuid().nullable(),
  // Same program-scope disambiguator as ReorderNodesSchema.project_id.
  project_id: z.string().uuid().nullable().optional(),
});

export type ReorderNodesDto = z.infer<typeof ReorderNodesSchema>;
export type MoveNodeDto = z.infer<typeof MoveNodeSchema>;
```

---

### `apps/api/src/domains/projects/projects.repository.ts` — add `reorderProjects`, `reorderPrograms`, `reorderPages`

**Analog 1 (lock idiom):** `apps/api/src/core/events/outbox.ts`, `claimDueEvents` (lines 114-141) — the only `FOR UPDATE` precedent in the codebase:
```typescript
const { rows } = await db.query<EventOutboxRow>(
  `WITH due AS (
     SELECT id FROM event_outbox
     WHERE attempts < max_attempts AND (...)
     ORDER BY created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT $1
   )
   UPDATE event_outbox e SET status = 'publishing', ... FROM due WHERE e.id = due.id RETURNING e.*`,
  [limit, workerId],
);
```
Note: this uses `SKIP LOCKED` (queue-claim semantics, non-blocking). Reorder must NOT skip locked rows — it must block until the previous transaction commits (per RESEARCH.md Pattern 2), so use plain `FOR UPDATE` with no `SKIP LOCKED`.

**Analog 2 (update shape):** same file's `updateProject` (lines 48-63) for the COALESCE-update / parameterized-query shape.

**Apply as** (from RESEARCH.md Code Examples, adapted per-table):
```typescript
async reorderProjects(
  client: PoolClient, companyId: string, folderId: string | null, orderedIds: string[],
): Promise<void> {
  const { rows: locked } = await client.query<{ id: string }>(
    `SELECT id FROM projects WHERE company_id = $1 AND folder_id IS NOT DISTINCT FROM $2
       AND archived_at IS NULL FOR UPDATE`,
    [companyId, folderId],
  );
  const lockedIds = new Set(locked.map((r) => r.id));
  if (lockedIds.size !== orderedIds.length || !orderedIds.every((id) => lockedIds.has(id))) {
    throw new AppError(409, 'Sibling set has changed since last read — refresh and retry');
  }
  const values = orderedIds.map((id, i) => `('${id}'::uuid, ${i})`).join(',');
  await client.query(
    `UPDATE projects AS p SET sort_order = v.pos, updated_at = NOW()
     FROM (VALUES ${values}) AS v(id, pos) WHERE p.id = v.id`,
  );
}
```
Repeat the identical shape for `reorderPrograms` — note `reorderPrograms` takes a `{ folderId, projectId }` scope object (not a single parent id) since `programs` siblings can share either column — scoped by `folder_id IS NOT DISTINCT FROM $2 AND project_id IS NOT DISTINCT FROM $3`, per RESEARCH.md's `programs_parent_sort_idx` — and `reorderPages` in `projects.repository.ts`, and `reorderCollections` in `records.repository.ts` (parent-scope `folder_id`). **Use parameterized values, not string-interpolated UUIDs**, in the actual implementation — the RESEARCH.md example inlines the UUID literals directly into the `VALUES` clause for brevity, but every other query in this codebase uses `$n` placeholders (see `updateProject` above); prefer building the `VALUES` list with numbered placeholders and a flat params array to stay consistent with the rest of the file and avoid any injection surface, even though UUIDs are validated by Zod beforehand.

**Import needed:** `AppError` is not currently imported in `projects.repository.ts` or `records.repository.ts` — add `import { AppError } from '../../core/errors/AppError';` to both.

---

### `database/migrations/029_tree_sort_order.sql` (new)

**Analog:** `database/migrations/028_folder_hierarchy_invariants.sql` (full file, 188 lines) — immediately-preceding migration in the same modernization arc; establishes the header-comment convention, `ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` idempotency idioms.

**Header comment pattern** (lines 1-18):
```sql
-- Migration: Folder hierarchy invariants. Apply after 027. Idempotent.
--
-- Gives the folder/project/program/data_collection/project_page hierarchy a
-- tenant-safe, cycle-safe, archive-capable schema:
--   - <bullet list of what this migration does and why>
```

**Additive column + index pattern** (lines 22-35):
```sql
ALTER TABLE folders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
...
CREATE INDEX IF NOT EXISTS folders_ancestor_ids_gin_idx ON folders USING GIN (ancestor_ids);
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS folder_id UUID;
CREATE INDEX IF NOT EXISTS data_collections_folder_idx ON data_collections (folder_id);
```

**Apply as** (full content per RESEARCH.md Code Examples, already verified against this exact convention):
```sql
-- Migration: Tree node sort_order columns. Apply after 028. Idempotent.
--
-- folders and project_pages already have sort_order (006_folders.sql,
-- 009_project_pages.sql). projects, programs, and data_collections do not —
-- add it additively so TREEAPI-02 sibling reorder can cover all five node
-- types the aggregated tree (TREEAPI-01) exposes.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE data_collections ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS projects_folder_sort_idx ON projects (folder_id, sort_order);
CREATE INDEX IF NOT EXISTS programs_parent_sort_idx ON programs (folder_id, project_id, sort_order);
CREATE INDEX IF NOT EXISTS data_collections_folder_sort_idx ON data_collections (folder_id, sort_order);
```

---

### Test files — extend existing suites, don't create new files

**Analog:** `apps/api/src/domains/folders/folders.integration.test.ts` (fixture scaffolding lines 1-60) — `adminCtx(companyId)` factory building a full `RequestContext`, `before`/`after` hooks provisioning throwaway `company_id`s, real-DB assertions on triggers/constraints that unit tests (mocked repos) cannot cover.

```typescript
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { db } from '../../core/db';
import { RequestContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';

function adminCtx(companyId: string): RequestContext {
  return {
    user: { id: adminUserId, role: 'admin', company_id: companyId, is_verified: true },
    companyId, roles: ['admin'], workspaceId: companyId, requestId: 'integration-test',
    deploymentMode: 'cloud',
    deploymentCapabilities: { mode: 'cloud', allowsLocalAiProxy: false, allowsSelfSignup: true, allowsExplicitFallbacks: true, requiresTrustedPublicEdges: true },
  };
}
```
Extend `folders.service.test.ts` (unit, mocked repos) for TREEAPI-04's capability-gate assertions and TREEAPI-01's "exactly 5 calls" assertion; extend `folders.integration.test.ts` (live DB) for TREEAPI-02's lock-safety and TREEAPI-03's cross-tenant/cycle cases, per RESEARCH.md's Test Map. RESEARCH.md flags (Wave 0 Gaps) that a genuinely-concurrent two-`PoolClient` test harness does not exist yet in this codebase — this is new test infrastructure, not an existing pattern to copy; plan it as its own task.

---

## Shared Patterns

### Capability gate (`workspace.admin`)
**Source:** `apps/api/src/domains/folders/folders.routes.ts` line 15-16 (route-level `requireCapability`) and `folders.service.ts` line 54/97/203 (service-level `assertCapability`) — **both** layers gate every mutation, redundantly by design.
**Apply to:** `reorderNodes`/`moveNode` routes AND `reorderSiblings`/`moveNode` service methods. `getFullTree`/`GET /tree/full` stays capability-free (read), matching `listFolders`.
```typescript
// route:
router.post('/tree/reorder', requireCapability('workspace.admin'), reorderNodes);
// service:
assertCapability(ctx, 'workspace.admin');
```

### Zod validation + 400 on parse failure
**Source:** `apps/api/src/domains/folders/folders.service.ts` (every mutation method), e.g. line 57-58:
```typescript
const parsed = MoveFolderSchema.safeParse(body);
if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
```
**Apply to:** `reorderSiblings` (`ReorderNodesSchema`), `moveNode` (`MoveNodeSchema`).

### Transaction shape (`db.connect()` / BEGIN / try-catch-finally / ROLLBACK)
**Source:** `apps/api/src/domains/folders/folders.service.ts`, `archiveFolder` (lines 102-199) and `unarchiveFolder` (lines 210-229).
**Apply to:** `reorderSiblings` (whole reorder must be one transaction so `FOR UPDATE` + renumber are atomic), `moveNode` if the durable event needs to be emitted in the same transaction as the underlying repository write (matches RESEARCH.md's Architectural Responsibility Map: "Durable event emission on reorder/move ... same transaction").
```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  // ... work using `client`, not `db` ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Durable event emission
**Source:** `apps/api/src/core/events/outbox.ts` (`createDurableEventEnvelope` + `insertDurableEvent`), used throughout `folders.service.ts`'s `archiveFolder` (e.g. lines 110-119).
**Apply to:** `reorderSiblings` (RESEARCH.md Open Question 1 — RESOLVED: ONE batched `tree.<node_type>.reordered` event per call, not one per sibling — a documented exception to Phase 31's per-row convention) and `moveNode` (one `tree.<node_type>.moved` event, matching the per-row precedent since move affects a single node).
```typescript
await insertDurableEvent(client, createDurableEventEnvelope({
  eventName: 'tree.project.reordered',
  tenantId,
  actorId: userId,
  objectType: 'project', // or node_type
  objectId: parentId ?? 'root', // batched event has no single object_id — flag for plan-check
  correlationId: ctx.requestId,
  payloadVersion: 1,
  payload: { ordered_ids: orderedIds },
}));
```

### `FOR UPDATE` lock-then-renumber (new pattern, no strong precedent — only `SKIP LOCKED` queue-claim exists)
**Source:** `apps/api/src/core/events/outbox.ts` lines 114-141 (lock idiom only, NOT the renumber technique — the renumber `UPDATE ... FROM (VALUES ...)` itself has zero precedent anywhere in this codebase and must be built fresh per RESEARCH.md's MEDIUM confidence rating).
**Apply to:** `reorderProjects`/`reorderPrograms`/`reorderPages` (`projects.repository.ts`), `reorderCollections` (`records.repository.ts`), and optionally `reorderFolders` (`folders.repository.ts`, if folder-level reorder is also needed — folders already have `sort_order`, so no migration needed for that one type).

### Tenant-ownership 404 pattern
**Source:** `apps/api/src/domains/folders/folders.service.ts` lines 242-246 (`assertOwnedFolder`); equivalent `findProjectForCompany` in `projects.repository.ts` line 28.
**Apply to:** `moveNode`'s destination-validation step for every `node_type` branch, per RESEARCH.md Pattern 3 — reuse existing helpers, do not write new ones. For `node_type: 'program'`, this includes the `project_id`-scoped destination check (`findProjectForCompany`) as well as the `new_parent_id`-scoped one (`assertOwnedFolder`), depending on which disambiguator field is set.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Concurrent two-`PoolClient` race test harness (for TREEAPI-02 verification) | test | event-driven / concurrency | RESEARCH.md Wave 0 Gaps: no genuinely-concurrent (two overlapping transactions) test shape exists anywhere in this codebase yet — must be designed fresh, not copied from an analog |
| `UPDATE ... FROM (VALUES ...)` renumber statement itself | service/repository (SQL technique) | batch write | Zero precedent in this codebase (RESEARCH.md: "no fractional-position scheme, no SELECT...FOR UPDATE outside the outbox worker") — the lock idiom is borrowed from `outbox.ts` but the renumber statement is standard-PostgreSQL reasoning, not an in-repo pattern |

## Metadata

**Analog search scope:** `apps/api/src/domains/folders/`, `apps/api/src/domains/projects/`, `apps/api/src/domains/records/`, `apps/api/src/core/events/`, `apps/api/src/core/errors/`, `database/migrations/028_folder_hierarchy_invariants.sql`
**Files scanned:** 10 (folders.controller.ts, folders.routes.ts, folders.service.ts, folders.repository.ts, folders.types.ts, dto/folder.dto.ts, projects.repository.ts, records.repository.ts, core/events/outbox.ts, core/errors/AppError.ts, folders.integration.test.ts, 028_folder_hierarchy_invariants.sql)
**Pattern extraction date:** 2026-07-17
