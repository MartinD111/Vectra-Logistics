# Phase 31: Data Model + Modernize Folders Domain - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 12 (5 rewritten in-place, 4 edited, 1 new migration, 2 test files to extend/create)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/api/src/domains/folders/folders.service.ts` | service | CRUD + event-driven | `apps/api/src/domains/workflows/workflows.service.ts` | exact (this is the explicitly-named v5 template) |
| `apps/api/src/domains/folders/folders.repository.ts` | model/repository | CRUD + transactional | `apps/api/src/domains/workflows/workflows.repository.ts` (transaction/client params) + `apps/api/src/domains/records/records.repository.ts` (durable-event-in-transaction) | role-match (composite of two analogs) |
| `apps/api/src/domains/folders/folders.controller.ts` | controller | request-response | `apps/api/src/domains/workflows/workflows.controller.ts` | exact |
| `apps/api/src/domains/folders/folders.routes.ts` | route | request-response | `apps/api/src/domains/workflows/workflows.routes.ts` | exact |
| `apps/api/src/domains/folders/folders.types.ts` | model/types | — | `apps/api/src/domains/projects/projects.types.ts` (for `archived_at` field precedent) | role-match |
| `apps/api/src/domains/folders/dto/folder.dto.ts` | utility (validation) | request-response | `apps/api/src/domains/workflows/dto/workflows.dto.ts` (existing `folder.dto.ts` is itself the immediate base to extend) | exact |
| `apps/api/src/domains/projects/projects.service.ts` (edit: archive/unarchive replacing delete) | service | CRUD + event-driven (cascade transaction) | `apps/api/src/domains/records/records.repository.ts` `createCollectionWithDefaultView` (transaction + durable event pattern) + `workflows.service.ts` (RequestContext shape, for the *new* direct archive endpoint only) | role-match |
| `apps/api/src/domains/projects/projects.repository.ts` (edit: add archive/unarchive queries) | model/repository | CRUD | `apps/api/src/domains/folders/folders.repository.ts` (`updateFolder`/`moveFolder` COALESCE-update shape) | exact |
| `apps/api/src/domains/projects/projects.types.ts` (edit: add `archived_at`) | model/types | — | existing file itself (add field following `Folder`/`Project` interface conventions) | exact |
| `apps/api/src/domains/records/records.types.ts` / `records.repository.ts` (edit: add `folder_id`) | model | CRUD | existing `data_collections` handling in `records.repository.ts` (`updateCollection` dynamic-patch pattern) | exact |
| `database/migrations/028_folder_hierarchy_invariants.sql` | migration | batch/schema | `database/migrations/026_event_outbox.sql` (idempotent additive migration, header-comment convention) + `006_folders.sql` (tree/FK precedent) | exact |
| `apps/api/src/domains/folders/folders.service.test.ts` | test | — | (existing file; extend using `node:test` + `mock.method` convention already in file) | exact |

## Pattern Assignments

### `apps/api/src/domains/folders/folders.service.ts` (service, CRUD + event-driven)

**Analog:** `apps/api/src/domains/workflows/workflows.service.ts`

**Imports pattern** (lines 1-11 of workflows.service.ts):
```typescript
import { randomUUID } from 'crypto';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { assertCapability } from '../../core/capabilities';
import { RequestContext, requireCompanyId, requireUserId } from '../../core/auth/request-context';
import { createDurableEventEnvelope } from '../../core/events/outbox';
import { notificationsService } from '../notifications/notifications.service'; // (folders: no cross-domain service call needed unless cascading into projects)
import { ManualRunSchema, SaveWorkflowSchema } from './dto/workflows.dto';
import { workflowsRepository } from './workflows.repository';
import type { NotificationActionNode, WorkflowGraphV1, WorkflowRunDetail, WorkflowRow } from './workflows.types';
```
For folders, replace with: `foldersRepository`, `CreateFolderSchema`/`UpdateFolderSchema`/`MoveFolderSchema`/(new `ArchiveFolderSchema` if needed), `Folder`/`FolderTree` types. Also import `insertDurableEvent` from `../../core/events/outbox` (folders needs multi-row inserts inside one transaction, unlike workflows' single-envelope create).

**Capability + RequestContext pattern** (lines 50-58, 95-104):
```typescript
async create(ctx: RequestContext, body: unknown): Promise<WorkflowRow> {
  assertCapability(ctx, 'workflow.build');
  const tenantId = requireCompanyId(ctx);
  const userId = requireUserId(ctx);
  const parsed = SaveWorkflowSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, validationMessage(parsed.error));
  ...
}
```
Folders rewrite: `assertCapability(ctx, 'workspace.admin')` (reuse existing capability per RESEARCH.md A3 — no new `CapabilityName` needed), `requireCompanyId(ctx)`, `requireUserId(ctx)` in every mutation (`createFolder`, `updateFolder`, `moveFolder`, `archiveFolder`, `unarchiveFolder`). Reads (`listFolderTree`, `getFolder`) only need `requireCompanyId(ctx)`, no capability assertion — mirrors `list`/`get` in workflows.service.ts (lines 45-48, 60-65) which skip `assertCapability`.

**Transactional multi-row write + durable event pattern** (lines 113-135, and full `manualRun` 95-190):
```typescript
const event = createDurableEventEnvelope({
  eventName: 'workflow.manual_triggered',
  tenantId, actorId: userId, objectType: 'workflow', objectId: workflow.id,
  correlationId: ctx.requestId, payloadVersion: 1, payload: { /* ... */ },
});

const client = await db.connect();
try {
  await client.query('BEGIN');
  // ... repository writes using `client` ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```
Folders' `archiveFolder` must adapt this to **cascade** across N descendant rows (D-05: one durable event per affected node, not one root event). Use the two-pass cascade from RESEARCH.md Pitfall 5: pass 1 walks the folder subtree (`ancestor_ids @> ARRAY[id]`) and archives folders + directly-filed projects/programs/collections (event per row); pass 2 takes just-archived project IDs and archives their `project_id`-attached programs/pages/collections (event per row). All INSERT/UPDATE + `insertDurableEvent(client, event)` calls happen inside one `BEGIN`/`COMMIT` block, same shape as above but looped.

**Error handling pattern:** `AppError(400, ...)` for validation/business-rule violations (e.g., cycle, depth-limit), `AppError(404, ...)` for not-found, matching `workflows.service.ts` lines 24-31, 63, 79, 91, 103, 110, 140.

**Ancestor-index lookup (replaces recursive loop)** — current folders.service.ts anti-pattern to remove:
```typescript
// apps/api/src/domains/folders/folders.service.ts lines 76-84 (CURRENT — being replaced)
private async assertNotDescendant(folderId: string, newParent: Folder, companyId: string): Promise<void> {
  let cursor: Folder | null = newParent;
  while (cursor) {
    if (cursor.id === folderId) {
      throw new AppError(400, 'Cannot move a folder into its own descendant');
    }
    cursor = cursor.parent_id ? await this.assertOwnedFolder(cursor.parent_id, companyId) : null;
  }
}
```
Replace with a single read of `newParent.ancestor_ids` (already includes the full chain to root) checked via `.includes(folderId)` or `folderId === newParent.id` — O(1), no loop, no extra queries. Depth check: `(newParent.ancestor_ids?.length ?? 0) + 1 + 1 > 3` per RESEARCH.md Pitfall 4 (off-by-one — top-level folder = depth 1).

---

### `apps/api/src/domains/folders/folders.repository.ts` (repository, CRUD + transactional)

**Analog 1 (transaction/PoolClient parameter shape):** `apps/api/src/domains/workflows/workflows.repository.ts`

**Client-param method pattern** (lines 91-129, 131-143, 166-201):
```typescript
async createOrFindManualRun(client: PoolClient, input: {...}): Promise<{...}> {
  const { rows } = await client.query<WorkflowRunRow>(`INSERT INTO ... VALUES (...) RETURNING *`, [...]);
  ...
}
```
Folders repository needs equivalent `client`-taking methods for cascade archive: `archiveFolderSubtree(client, folderId, companyId)`, `archiveProjectsInFolders(client, folderIds, companyId)`, etc. — every write inside the cascade transaction takes `client: PoolClient` as first arg exactly like `workflowsRepository.insertStep`/`markRunComplete`.

**Analog 2 (durable event insert inside a repository-owned transaction):** `apps/api/src/domains/records/records.repository.ts` lines 7-59 (`createCollectionWithDefaultView`):
```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  const collectionResult = await client.query<DataCollectionRow>(`INSERT INTO data_collections (...) VALUES (...) RETURNING *`, [...]);
  const collection = collectionResult.rows[0];
  ...
  await insertDurableEvent(client, createDurableEventEnvelope({
    eventName: 'records.collection.created',
    tenantId: companyId,
    actorId: d.actorId ?? d.createdBy,
    objectType: 'data_collection',
    objectId: collection.id,
    projectId: collection.project_id,
    payloadVersion: 1,
    payload: { /* ... */ },
  }));
  await client.query('COMMIT');
  return { collection, view };
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```
This is the closest existing example of "repository method owns the whole transaction including `insertDurableEvent` calls" — useful if the cascade-archive transaction is driven from the repository layer rather than the service layer (either is consistent with existing precedent; RESEARCH.md leans service-layer-owns-transaction like `workflows.service.ts.manualRun`, but this repository-owns-transaction shape is the fallback if the service method gets too large).

**Existing folders.repository.ts CRUD shape to preserve for non-cascade methods** (lines 4-67, full file) — `listFolders`, `findFolderForCompany`, `createFolder`, `updateFolder` (COALESCE-based partial update) all stay structurally the same; only `deleteFolder`'s raw `DELETE FROM folders WHERE id = $1` (line 62-64) is removed/replaced by `archiveFolder`/`unarchiveFolder` (`UPDATE folders SET archived_at = NOW() WHERE id = $1` / `SET archived_at = NULL`).

**Ancestor-index maintenance on move** — new method needed, no direct analog exists (this is genuinely new logic per RESEARCH.md Pattern 2); base its SQL shape on the existing `moveFolder` method (lines 54-60):
```typescript
async moveFolder(id: string, parentId: string | null): Promise<Folder | null> {
  const { rows } = await db.query<Folder>(
    `UPDATE folders SET parent_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, parentId],
  );
  return rows[0] ?? null;
}
```
Extend to also set `ancestor_ids = $3` (computed in the service layer from the new parent's `ancestor_ids || parent.id`), and add a second query to patch descendants' `ancestor_ids` prefix in the same transaction (bounded to depth ≤ 3 per RESEARCH.md).

---

### `apps/api/src/domains/folders/folders.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/domains/workflows/workflows.controller.ts` (full file, 39 lines)

**RequestContext handler pattern:**
```typescript
export const createWorkflow = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const workflow = await workflowsService.create(requireRequestContext(req), req.body);
  res.status(201).json({ workflow });
});
```
Folders controller today mixes both shapes (some handlers use `requireCompanyId(req)` directly — legacy shape; `createFolder` already uses `requireRequestContext(req)` — line 15-19 of current `folders.controller.ts`, the transitional shape). The rewrite standardizes **every** handler on `requireRequestContext(req)` → pass `ctx` straight through to the service, matching workflows.controller.ts exactly (no more `requireCompanyId(req)` shortcut in the controller — that call moves inside the service via `requireCompanyId(ctx)`).

---

### `apps/api/src/domains/folders/folders.routes.ts` (route, request-response)

**Analog:** `apps/api/src/domains/workflows/workflows.routes.ts` (full file, 26 lines)

```typescript
const router = Router();
router.use(authenticateToken);

router.get('/', listWorkflows);
router.post('/', requireCapability('workflow.build'), createWorkflow);
```
Folders routes already gate mutations on `requireCapability('workspace.admin')` (current `folders.routes.ts` lines 12, 14-16) — this shape is unchanged; just add routes for the new archive/unarchive endpoints (e.g., `router.post('/:id/archive', requireCapability('workspace.admin'), archiveFolder)`, `router.post('/:id/unarchive', requireCapability('workspace.admin'), unarchiveFolder)`), replacing the current `router.delete('/:id', ...)` line if hard-delete is dropped per D-01/Open-Question-1 recommendation (archive-only).

---

### `apps/api/src/domains/projects/projects.service.ts` / `projects.repository.ts` (edit: replace hard delete with archive)

**Analog for the COALESCE-style archive/unarchive queries:** existing `updateFolder`/`updateProject` methods (`folders.repository.ts` lines 38-52; `projects.repository.ts` lines 47-62) — same file, same table, just a new narrower method:
```typescript
async archiveProject(id: string): Promise<Project | null> {
  const { rows } = await db.query<Project>(
    `UPDATE projects SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}
async unarchiveProject(id: string): Promise<Project | null> {
  const { rows } = await db.query<Project>(
    `UPDATE projects SET archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}
```
**Current hard-delete being replaced** (`projects.service.ts` lines 46-49, `projects.repository.ts` lines 64-66):
```typescript
async deleteProject(id: string, companyId: string): Promise<void> {
  await this.assertOwnedProject(id, companyId);
  await projectsRepository.deleteProject(id); // programs.project_id ON DELETE SET NULL
}
```
Per RESEARCH.md's D-02 correction, this is an **edit in place**, not net-new code. Per Pitfall 3, do NOT migrate all of `projects.service.ts` onto RequestContext/event_outbox — only the archive/unarchive methods (and only if a direct, non-cascade-triggered archive endpoint is added) should use `createDurableEventEnvelope`/`insertDurableEvent`; keep `recordEvent()` for all other unrelated project mutations (create/update) to avoid a mixed-pattern seam beyond phase scope (per REQUIREMENTS.md, RequestContext modernization is folders-domain-scoped only).

---

### `database/migrations/028_folder_hierarchy_invariants.sql` (migration, batch/schema)

**Analog for idempotent additive style:** `database/migrations/026_event_outbox.sql` (full file) — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, header comment block describing purpose + "Apply after NNN. Idempotent."

**Analog for column-add + index style:** `database/migrations/006_folders.sql` lines 24-28:
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_folder_idx ON projects (folder_id);
CREATE INDEX IF NOT EXISTS programs_folder_idx ON programs (folder_id);
```
Directly reusable shape for `data_collections.folder_id` (new), `archived_at` on folders/projects/programs/data_collections/project_pages.

**Header comment convention** (`025_records_views.sql` lines 1-16) — describes purpose, cites schema-lock notes; the new migration's header should explicitly note per Pitfall 2: "Only adds `folder_id` to `data_collections` — does not touch `project_id`/`schema` per the lock in `025_records_views.sql`."

**Constraint-name-safe drop pattern** — no direct existing analog (no prior migration drops/renames an inline FK); RESEARCH.md's own Code Examples section supplies the needed skeleton (composite `(id, company_id)` UNIQUE + FK re-point, `DO $$ ... EXCEPTION WHEN undefined_object THEN NULL; END $$;` wrapping per Pitfall 1) — use that as the primary source since no in-repo precedent exists for this specific operation.

---

## Shared Patterns

### RequestContext + Capability Assertion
**Source:** `apps/api/src/core/auth/request-context.ts` (`RequestContext`, `requireCompanyId`, `requireUserId`, `requireRequestContext`) + `apps/api/src/core/capabilities/index.ts` (`assertCapability`, `CapabilityName` — `workspace.admin` at line 10)
**Apply to:** `folders.service.ts` (every method), `folders.controller.ts` (every handler)
```typescript
// core/capabilities/index.ts lines 148-157
export function assertCapability(
  ctx: RequestContext,
  capability: CapabilityName,
  metadata: Record<string, unknown> = {},
): void {
  const result = capabilityService.can(ctx, capability, metadata);
  if (!result.allowed) {
    throw new AppError(403, `Forbidden: missing capability ${capability}`);
  }
}
```
No new `CapabilityName` needed — `workspace.admin` (line 10 of `core/capabilities/index.ts`) already covers folder mutations; do not add a finer-grained capability (REQUIREMENTS.md explicitly rules this out).

### Durable Event Outbox (replaces recordEvent/activityLog)
**Source:** `apps/api/src/core/events/outbox.ts` — `createDurableEventEnvelope` (lines 62-79), `insertDurableEvent` (lines 81-112)
**Apply to:** every folders-domain mutation, plus the cascade-archive writes into projects/programs/data_collections/project_pages tables (still written via `insertDurableEvent` inside the folders-domain transaction, per Pitfall 3's resolution — those tables' own `.service.ts` files are NOT modernized, only this one transaction's calls use event_outbox).
```typescript
const event = createDurableEventEnvelope({
  eventName: 'folder.archived', // one of: folder.archived / project.archived / program.archived / data_collection.archived / project_page.archived — per D-05, one event per node
  tenantId, actorId: userId, objectType: 'folder', objectId: folder.id,
  correlationId: ctx.requestId, payloadVersion: 1, payload: { name: folder.name },
});
await insertDurableEvent(client, event); // inside the same BEGIN/COMMIT as the archived_at UPDATE
```
**Explicitly forbidden pattern (HIER-06):** `recordEvent()` (`apps/api/src/core/events/activityLog.ts`) — currently used in `folders.service.ts` line 2, 23-27 and must be fully removed, not just supplemented.

### Transaction Pattern (db.connect / BEGIN / COMMIT / ROLLBACK)
**Source:** `apps/api/src/domains/workflows/workflows.service.ts` lines 124-189 (service-owns-transaction) and `apps/api/src/domains/records/records.repository.ts` lines 11-58 (repository-owns-transaction)
**Apply to:** `archiveFolder`/`unarchiveFolder` (cascade across multiple tables), any multi-row folder mutation
```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  // ... writes ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Zod DTO Validation
**Source:** `apps/api/src/domains/folders/dto/folder.dto.ts` (existing — `CreateFolderSchema`, `UpdateFolderSchema`, `MoveFolderSchema`) and `apps/api/src/domains/workflows/dto/workflows.dto.ts` (`ManualRunSchema` as the shape for a body-less/optional-body action schema)
**Apply to:** new `ArchiveFolderSchema`/`UnarchiveFolderSchema` if a request body is needed (likely empty `z.object({})` matching `ManualRunSchema`'s optional-body pattern, since archive/unarchive take no payload beyond the `:id` param)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `folders.repository.ts` ancestor-index maintenance methods (compute/patch `ancestor_ids` on create/move) | repository | transform | Genuinely new logic — no prior domain in this codebase maintains a denormalized ancestor array; RESEARCH.md Pattern 2/Code Examples is the primary source instead of an in-repo analog. |
| DB trigger `folders_prevent_cycle()` (+ depth check) | migration (trigger function) | event-driven (DB-level) | No existing migration in this repo defines a `BEFORE INSERT OR UPDATE` trigger function; RESEARCH.md Pattern 4 supplies the full skeleton directly — use it as the primary source. |
| Composite `(id, company_id)` FK re-pointing across 5 tables | migration | schema | No existing migration performs a FK-drop-and-recreate; RESEARCH.md Pattern 3 + Pitfall 1 (constraint-name-safety) is the primary source. |
| `folders.repository.test.ts` (new file, per RESEARCH.md Wave 0 gap) | test | — | Does not exist yet; base its `node:test` + `mock.method` shape on the existing `folders.service.test.ts` structure (same domain, adjacent layer) since no repository-level test file exists anywhere in this domain to copy from directly. |

## Metadata

**Analog search scope:** `apps/api/src/domains/{workflows,folders,projects,records}/`, `apps/api/src/core/{auth,capabilities,events}/`, `database/migrations/{004,006,009,012,025,026,027}*.sql`
**Files scanned:** 19 (14 TypeScript, 5 SQL migrations)
**Pattern extraction date:** 2026-07-16
