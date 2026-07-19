# Phase 22: Records + Views Data Model - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 12 (new domain: 5 core files + 5 DTOs + 1 migration + 1 registration edit)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/api/src/domains/records/records.types.ts` | model (row interfaces) | CRUD | `apps/api/src/domains/crm/crm.types.ts` | exact |
| `apps/api/src/domains/records/records.repository.ts` | service (data access) | CRUD | `apps/api/src/domains/crm/crm.repository.ts` | exact |
| `apps/api/src/domains/records/records.service.ts` | service (business logic) | CRUD | `apps/api/src/domains/crm/crm.service.ts` | exact |
| `apps/api/src/domains/records/records.controller.ts` | controller | request-response | `apps/api/src/domains/crm/crm.controller.ts` | exact |
| `apps/api/src/domains/records/records.routes.ts` | route | request-response | `apps/api/src/domains/crm/crm.routes.ts` | exact |
| `apps/api/src/domains/records/dto/create-collection.dto.ts` | utility (Zod schema) | request-response | `apps/api/src/domains/crm/dto/create-client.dto.ts` | exact |
| `apps/api/src/domains/records/dto/update-collection.dto.ts` | utility (Zod schema) | request-response | `apps/api/src/domains/crm/dto/update-client.dto.ts` | exact |
| `apps/api/src/domains/records/dto/create-record.dto.ts` | utility (Zod schema, incl. PageConfig envelope) | request-response | `apps/api/src/domains/projects/dto/page.dto.ts` | exact (for `body` field) |
| `apps/api/src/domains/records/dto/update-record.dto.ts` | utility (Zod schema) | request-response | `apps/api/src/domains/crm/dto/update-client-page.dto.ts` | role-match |
| `apps/api/src/domains/records/dto/create-view.dto.ts` | utility (Zod schema) | request-response | `apps/api/src/domains/crm/dto/create-client.dto.ts` | role-match |
| `database/migrations/025_records_views.sql` | migration | batch | `database/migrations/024_kpi_target_client.sql` (header/idempotency convention); `docs/specs/core/workspace-blocks.md` §3.3 (verbatim schema source) | exact (convention) / exact (content) |
| `apps/api/src/domains/index.ts` | config (router registration) | request-response | itself — existing file, edit only (add 2 lines) | exact |

## Pattern Assignments

### `apps/api/src/domains/records/records.types.ts` (model, CRUD)

**Analog:** `apps/api/src/domains/crm/crm.types.ts` (read in full — 81 lines)

**Pattern:** Plain exported interfaces per DB row shape, snake_case fields matching columns exactly, `Date` type for `TIMESTAMPTZ` columns, `| null` for nullable columns, JSDoc comment above interfaces that need extra context.

```typescript
// Source: apps/api/src/domains/crm/crm.types.ts lines 1-16 (ClientRecord)
export interface ClientRecord {
  id: string;
  company_id: string;
  name: string;
  country: string;
  vat_id: string | null;
  email: string | null;
  credit_limit: number;
  outstanding_balance: number;
  default_rate_eur: number | null;
  notes: string | null;
  address: string | null;
  responsible_employee_id: string | null;
  created_at: Date;
  updated_at: Date;
}
```

**Apply to new file as:**
```typescript
export interface DataCollectionRow {
  id: string;
  company_id: string;
  project_id: string | null;
  name: string;
  schema: CollectionPropertyDef[]; // JSONB, typed at the app layer
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CollectionRecordRow {
  id: string;
  company_id: string;
  collection_id: string;
  parent_record_id: string | null;
  props: Record<string, unknown>;
  body: Record<string, unknown>; // PageConfig-shaped, see page.dto.ts
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CollectionViewRow {
  id: string;
  company_id: string;
  collection_id: string;
  name: string;
  type: string; // 'board' | 'table' | 'calendar' | 'gallery' | 'list' | 'timeline'
  config: Record<string, unknown>;
  sort_order: number;
  created_at: Date;
}

export interface CollectionPropertyDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'checkbox'
    | 'person' | 'url' | 'email' | 'phone' | 'files' | 'relation';
  // per-type config (select options, relation target collection id, etc.) — freeform
  [key: string]: unknown;
}
```

---

### `apps/api/src/domains/records/records.repository.ts` (service/data-access, CRUD)

**Analog:** `apps/api/src/domains/crm/crm.repository.ts` (read in full — 199 lines)

**Imports pattern** (lines 1-2):
```typescript
import { db } from '../../core/db';
import { ClientRecord, ClientProjectLinkRecord, ClientPageRecord } from './crm.types';
```

**Core CRUD pattern — findOne scoped by company_id** (lines 28-32):
```typescript
async findClient(id: string, companyId: string): Promise<ClientRecord | null> {
  const { rows } = await db.query<ClientRecord>(
    `SELECT * FROM clients WHERE id = $1 AND company_id = $2`, [id, companyId]);
  return rows[0] ? numClient(rows[0]) : null;
}
```

**Core CRUD pattern — insert with RETURNING** (lines 40-50):
```typescript
async createClient(companyId: string, d: { name: string; /* ... */ }): Promise<ClientRecord> {
  const { rows } = await db.query<ClientRecord>(
    `INSERT INTO clients (company_id, name, country, vat_id, email, credit_limit, default_rate_eur, notes, address, responsible_employee_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [companyId, d.name, d.country, d.vat_id, d.email, d.credit_limit, d.default_rate_eur, d.notes, d.address, d.responsible_employee_id]);
  return numClient(rows[0]);
}
```

**Partial-patch update pattern (dynamic SET clause)** (lines 52-69):
```typescript
async updateClient(id: string, companyId: string, patch: Partial<{...}>): Promise<ClientRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, companyId];
  for (const [col, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  }
  if (sets.length === 0) return this.findClient(id, companyId);
  sets.push('updated_at = NOW()');
  const { rows } = await db.query<ClientRecord>(
    `UPDATE clients SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params);
  return rows[0] ? numClient(rows[0]) : null;
}
```
Use this exact dynamic-SET pattern for `updateRecord`/`updateCollection` PATCH semantics (avoids hand-writing COALESCE for every optional field when the patch is a flat key-value object). For `updateRecord`, `props` and `body` are JSONB columns — when included in `patch`, `JSON.stringify()` the value before pushing to `params` (see JSONB write pattern below).

**JSONB column write pattern (from a different analog, needed for `props`/`body`/`schema`/`config`)** — source: `apps/api/src/domains/crm/crm.repository.ts` lines 117-133 (`createClientPage`):
```typescript
async createClientPage(companyId: string, clientId: string, createdBy: string | null,
  data: { title?: string; icon?: string | null; config?: Record<string, unknown> },
): Promise<ClientPageRecord> {
  const { rows } = await db.query<ClientPageRecord>(
    `INSERT INTO client_pages (company_id, client_id, title, icon, config, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (client_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [
      companyId, clientId, data.title ?? 'Untitled', data.icon ?? null,
      JSON.stringify(data.config ?? { version: 1, blocks: [] }), createdBy,
    ]);
  return rows[0];
}
```
Apply identically: `schema` on `createCollection`, `props`/`body` on `createRecord`, `config` on `createView` must all be passed through `JSON.stringify(...)` as query parameters — never string-concatenated into SQL (ASVS V5/SQLi mitigation per RESEARCH.md).

**Nullable-field CASE/COALESCE update pattern** — source: `crm.repository.ts` lines 144-160 (`updateClientPage`), for fields that must support explicit-null-clears:
```typescript
icon = CASE WHEN $4::boolean THEN $5 ELSE icon END,
```
Only needed if `records.service.ts` ends up calling a dedicated `updateCollection`/`updateRecord`/`updateView` repo method with named params instead of the dynamic-SET loop above — pick one style per method, don't mix within a single query.

**Scoped child-list query pattern (for `parent_record_id` / REC-04)** — first-party design per RESEARCH.md Code Examples, following the exact shape of existing scoped-list queries such as `crm.repository.ts` lines 164-173 (`listClientEmails`):
```typescript
async listChildren(parentRecordId: string, companyId: string): Promise<CollectionRecordRow[]> {
  const { rows } = await db.query<CollectionRecordRow>(
    `SELECT * FROM collection_records
     WHERE parent_record_id = $1 AND company_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [parentRecordId, companyId],
  );
  return rows;
}
```

**D-03 atomicity note:** No transaction helper exists anywhere in `apps/api/src/core/db` — `db` (`apps/api/src/core/db/index.ts`) is a raw `pg.Pool` exporting only the inherited `.query()`/`.connect()`. No repository in the codebase currently uses `db.connect()` for a manual `BEGIN`/`COMMIT` transaction (verified via grep — zero domain repositories use it). For `createCollectionWithDefaultView` (D-03), use `db.connect()` to check out a client and wrap both INSERTs in `BEGIN`/`COMMIT`/`ROLLBACK` — this will be new-pattern code, not copied from an existing repo method:
```typescript
async createCollectionWithDefaultView(companyId: string, d: {...}): Promise<DataCollectionRow> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: collRows } = await client.query<DataCollectionRow>(
      `INSERT INTO data_collections (company_id, name, schema, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [companyId, d.name, JSON.stringify(d.schema), d.createdBy]);
    const collection = collRows[0];
    await client.query(
      `INSERT INTO collection_views (company_id, collection_id, name, type, config)
       VALUES ($1,$2,'Table','table','{}')`,
      [companyId, collection.id]);
    await client.query('COMMIT');
    return collection;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

### `apps/api/src/domains/records/records.service.ts` (service, CRUD)

**Analog:** `apps/api/src/domains/crm/crm.service.ts` (read in full — 251 lines)

**Imports pattern** (lines 1-11):
```typescript
import { AppError } from '../../core/errors/AppError';
import { crmRepository } from './crm.repository';
import { CreateClientSchema } from './dto/create-client.dto';
import { UpdateClientSchema } from './dto/update-client.dto';
```

**Core create pattern — Zod validate then delegate to repo** (lines 25-40):
```typescript
async createClient(companyId: string, body: unknown): Promise<ClientRecord> {
  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return crmRepository.createClient(companyId, {
    name: d.name,
    // ...defaults applied here (?? fallback), not in the DTO or repo
  });
}
```

**404-on-missing pattern** (lines 19-23):
```typescript
async getClient(id: string, companyId: string): Promise<ClientRecord> {
  const client = await crmRepository.findClient(id, companyId);
  if (!client) throw new AppError(404, 'Client not found');
  return client;
}
```
Use identically for `getCollection`/`getRecord`/`getView` — 404 before any dependent operation (Pitfall 2 in RESEARCH.md: fetch the collection first, then validate props against its schema).

**D-02 prop-type validation — no direct analog exists (new pattern).** Follow RESEARCH.md's Pattern 3 illustrative design; place as a private method or free function in `records.service.ts`, called between DTO-parse and repository-insert, mirroring where `crm.service.ts` composes cross-domain checks (see `assertOwnedProject` below) as a private helper:
```typescript
// Analog for "private helper called mid-method before repo call":
// Source: apps/api/src/domains/crm/crm.service.ts lines 105-109
private async assertOwnedProject(projectId: string, companyId: string): Promise<void> {
  const p = await projectsRepository.findProject(projectId);
  if (!p) throw new AppError(404, 'Project not found');
  if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
}
```
Apply the same shape for `validateProps(schema: CollectionPropertyDef[], props: Record<string, unknown>): void` — throw `AppError(400, ...)` per RESEARCH.md's Pattern 3 switch function, called from `createRecord`/`updateRecord` after `repo.findCollection(...)`.

**Error handling pattern:** All service methods use `AppError(400 | 403 | 404, message)` thrown synchronously inline — no try/catch wrapping needed at this layer; `asyncHandler` at the controller layer forwards to the global error handler.

---

### `apps/api/src/domains/records/records.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/domains/crm/crm.controller.ts` (read in full — 71 lines)

**Full pattern — `requireCompany` guard + `asyncHandler` wrap + thin delegation** (lines 1-23):
```typescript
import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { crmService } from './crm.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ clients: await crmService.listClients(requireCompany(req)) });
});

export const createClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ client: await crmService.createClient(requireCompany(req), req.body) });
});
```
Copy `requireCompany` verbatim into `records.controller.ts` (each domain redefines it locally rather than importing — confirmed convention, no shared `requireCompany` utility exists). Response envelope key matches the resource name singular/plural (`{ clients: [...] }`, `{ client: {...} }`) — use `{ collections }`/`{ collection }`, `{ records }`/`{ record }`, `{ views }`/`{ view }`, `{ children }` for the parent/child listing (REC-04).

---

### `apps/api/src/domains/records/records.routes.ts` (route, request-response)

**Analog:** `apps/api/src/domains/crm/crm.routes.ts` (read in full — 34 lines)

**Full pattern:**
```typescript
import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import { listClients, getClient, createClient, updateClient, /* ... */ } from './crm.controller';

const router = Router();
router.use(authenticateToken);

router.get('/clients', listClients);
router.post('/clients', createClient);
router.get('/clients/:id', getClient);
router.patch('/clients/:id', updateClient);

export default router;
```
Apply as, e.g. (mount path `/records` per RESEARCH.md A4, discretionary):
```typescript
router.get('/collections', listCollections);
router.post('/collections', createCollection);
router.get('/collections/:id', getCollection);
router.patch('/collections/:id', updateCollection);

router.get('/collections/:id/records', listRecords);
router.post('/collections/:id/records', createRecord);
router.get('/records/:id', getRecord);
router.patch('/records/:id', updateRecord);
router.get('/records/:id/children', listRecordChildren); // REC-04

router.get('/collections/:id/views', listViews);
router.post('/collections/:id/views', createView);
router.patch('/views/:id', updateView);
```

---

### `apps/api/src/domains/records/dto/create-collection.dto.ts` and sibling DTOs (utility, request-response)

**Analog:** `apps/api/src/domains/crm/dto/create-client.dto.ts` (read in full — 15 lines)

**Full pattern:**
```typescript
import { z } from 'zod';

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(160),
  country: z.string().min(2).max(2),
  vat_id: z.string().max(20).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  credit_limit: z.number().min(0).max(10_000_000).optional(),
  default_rate_eur: z.number().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  responsible_employee_id: z.string().uuid().nullable().optional(),
});
export type CreateClientDto = z.infer<typeof CreateClientSchema>;
```
`create-collection.dto.ts` should validate `name` + a `schema` array (RESEARCH.md's Common Pitfalls flags adding `.max(100)` on the schema array for defense-in-depth):
```typescript
const PropertyDefSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  type: z.enum(['text','number','date','select','multi-select','checkbox','person','url','email','phone','files','relation']),
}).catchall(z.unknown());

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(160),
  schema: z.array(PropertyDefSchema).max(100).optional(),
});
export type CreateCollectionDto = z.infer<typeof CreateCollectionSchema>;
```

**`create-record.dto.ts` — reuse the `PageConfigSchema` envelope pattern verbatim** (source: `apps/api/src/domains/projects/dto/page.dto.ts` lines 3-8):
```typescript
const PageConfigSchema = z.object({
  version: z.number().int(),
  blocks: z.array(z.unknown()),
}).catchall(z.unknown());

export const CreateRecordSchema = z.object({
  collection_id: z.string().uuid(),
  props: z.record(z.string(), z.unknown()).optional(),
  body: PageConfigSchema.optional(),
  parent_record_id: z.string().uuid().nullable().optional(),
});
export type CreateRecordDto = z.infer<typeof CreateRecordSchema>;
```
Per RESEARCH.md's Pattern 2 note: `crm` does not import from `projects` today, so duplicate `PageConfigSchema` locally in the `records` domain's `dto/` folder rather than cross-importing from `projects/dto/page.dto.ts`.

**`update-record.dto.ts` role-match analog:** `apps/api/src/domains/crm/dto/update-client-page.dto.ts` (not read in full — same partial-patch shape as `update-client.dto.ts`; follow the `.optional()` pattern on every field, mirroring `CreateClientSchema` fields made optional).

**`create-view.dto.ts`:**
```typescript
export const CreateViewSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['board','table','calendar','gallery','list','timeline']).default('table'),
  config: z.record(z.string(), z.unknown()).optional(), // groupBy/subGroupBy/filters/sorts/cardProperties — opaque per REC-03
});
export type CreateViewDto = z.infer<typeof CreateViewSchema>;
```

---

### `database/migrations/025_records_views.sql` (migration, batch)

**Analog (convention):** `database/migrations/024_kpi_target_client.sql` (read in full — 9 lines) — header comment style: purpose, "Apply after NNN", "Idempotent."; `IF NOT EXISTS` on every `ALTER`/`CREATE INDEX`.

**Analog (content, spec-locked verbatim):** `docs/specs/core/workspace-blocks.md` §3.3 — copy the three `CREATE TABLE`/index statements exactly as given in RESEARCH.md's Code Examples section, adding `IF NOT EXISTS` to `CREATE TABLE`/`CREATE INDEX` (RESEARCH.md Assumption A1 — near-certain correction, not a real ambiguity, since every other migration in the folder uses `IF NOT EXISTS`).

**Header comment pattern to copy:**
```sql
-- Migration: kpi_rules gains target_client_id so a rule can target a single
-- client (client-subject evaluators, e.g. credit_risk) the same way
-- target_project_id/target_user_id already target a project or user.
-- Apply after 023. Idempotent.
```
Apply as:
```sql
-- Migration: data_collections / collection_records / collection_views —
-- Records + Views data model (Phase 22, v4.0). Apply after 024. Idempotent.
-- Schema locked in docs/specs/core/workspace-blocks.md §3.3 — do not redesign.
```
Full SQL body: see RESEARCH.md "Code Examples > Migration file" section — already transcribed there with `IF NOT EXISTS` applied; copy that block directly into `025_records_views.sql`.

---

### `apps/api/src/domains/index.ts` (config, request-response) — EDIT existing file

**Pattern:** Add one import line (alphabetical-ish grouping not strictly enforced — new domains appended at the bottom of both the import block and the `router.use` block, per `crmRouter`/`ltlRouter` being last):

```typescript
// Existing tail of the file (lines 21-22, 45-46):
import crmRouter from './crm/crm.routes';
import ltlRouter from './ltl/ltl.routes';
// ...
router.use('/crm', crmRouter);
router.use('/ltl', ltlRouter);
```

Add:
```typescript
import recordsRouter from './records/records.routes';
// ...
router.use('/records', recordsRouter);
```
Insert both lines after the `ltl` lines, before the "Future domains mount here" comment (lines 48-49).

---

## Shared Patterns

### Auth + Company Scoping
**Source:** `apps/api/src/core/auth/middleware.ts` (`authenticateToken`), applied via `router.use(authenticateToken)` in every `*.routes.ts` file (verified in `crm.routes.ts` line 11).
**Apply to:** `records.routes.ts` — mount `router.use(authenticateToken)` immediately after `const router = Router();`.

### `requireCompany` guard
**Source:** `apps/api/src/domains/crm/crm.controller.ts` lines 7-11 (duplicated per-domain, not shared):
```typescript
const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};
```
**Apply to:** `records.controller.ts` — copy verbatim at top of file.

### Error Handling
**Source:** `apps/api/src/core/errors/AppError.ts` (`AppError` class, `status` + `message`) and `apps/api/src/core/errors/asyncHandler.ts` (`asyncHandler` wrapper).
**Apply to:** All `records.service.ts` methods (throw `AppError`) and all `records.controller.ts` handlers (wrap in `asyncHandler`).

### Zod Validation + AppError(400) convention
**Source:** `apps/api/src/domains/crm/crm.service.ts` lines 26-27:
```typescript
const parsed = CreateClientSchema.safeParse(body);
if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
```
**Apply to:** Every `records.service.ts` create/update method, before any repository call.

### JSONB write safety (parameterized `JSON.stringify`)
**Source:** `apps/api/src/domains/crm/crm.repository.ts` line 130 — `JSON.stringify(data.config ?? ...)` passed as a query parameter, never string-concatenated.
**Apply to:** All `schema`/`props`/`body`/`config` column writes in `records.repository.ts` — mandatory per RESEARCH.md's SQLi threat pattern (ASVS V5).

### Company-scoped SELECT/UPDATE/DELETE
**Source:** Every method in `crm.repository.ts` — `WHERE ... AND company_id = $N` on every query touching `clients`/`client_project_links`/`client_pages`.
**Apply to:** All three new tables (`data_collections`, `collection_records`, `collection_views`) — RESEARCH.md Pitfall 1 explicitly flags `collection_views` needing its own `company_id` filter (not just the `collection_id` FK join) since the schema gives it a redundant `company_id` column for defense-in-depth.

## No Analog Found

None — every file in this phase has a strong (exact or role-match) analog in the existing `crm`/`projects` domains. The one genuinely new piece of logic (D-02 prop-type validation function, D-03 transactional collection+default-view create) has no direct copy-source but is fully specified as first-party design in RESEARCH.md's "Pattern 3" and "Common Pitfalls > Pitfall 4" sections, with a synthesized code sketch included above.

## Metadata

**Analog search scope:** `apps/api/src/domains/crm/`, `apps/api/src/domains/projects/`, `apps/api/src/domains/index.ts`, `apps/api/src/core/{db,errors,auth}`, `database/migrations/`
**Files scanned:** crm.types.ts, crm.repository.ts, crm.service.ts, crm.controller.ts, crm.routes.ts, crm/dto/create-client.dto.ts, projects/dto/page.dto.ts, projects.repository.ts (partial), domains/index.ts, core/db/index.ts, core/errors/AppError.ts, core/errors/asyncHandler.ts, database/migrations/024_kpi_target_client.sql
**Pattern extraction date:** 2026-07-14
