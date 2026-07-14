# Phase 22: Records + Views Data Model - Research

**Researched:** 2026-07-13
**Domain:** Backend DDD domain (Express/TypeScript/PostgreSQL), no ORM, no frontend
**Confidence:** HIGH

## Summary

This phase is a pure backend addition: three new tables (`data_collections`,
`collection_records`, `collection_views`) plus a new DDD domain
(`apps/api/src/domains/records/`) exposing CRUD over them. The exact SQL schema
is already locked in `docs/specs/core/workspace-blocks.md` §3.3 and must be
copied verbatim — no schema design work remains. Everything else is mechanical
repetition of patterns already used four times in this codebase (`crm`,
`projects`, `kpi`, `folders` domains): Zod DTOs → service `.safeParse()` →
`AppError(400, ...)` → repository raw-SQL with `company_id` scoping →
`asyncHandler`-wrapped controllers → `authenticateToken`-protected router
mounted in `domains/index.ts`.

No new npm packages are required — `zod`, `pg`, `express`, `uuid` are already
project dependencies. The only genuinely new design work is (1) how prop-type
validation walks the collection's `schema` JSONB against a record's `props`
JSONB at write time (D-02) and (2) wiring default-view auto-creation into
`createCollection` (D-03) — both are service-layer logic, not schema or
framework questions.

**Primary recommendation:** Copy the §3.3 SQL into
`database/migrations/025_records_views.sql` unmodified, scaffold
`apps/api/src/domains/records/` mirroring the `crm` domain's five-file layout,
reuse `PageConfigSchema`'s permissive-envelope pattern from
`projects/dto/page.dto.ts` for `collection_records.body`, and write prop-type
validation as a small pure function keyed by the schema's declared property
`type` per property id.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Collection schema storage/CRUD | API / Backend | Database / Storage | New DDD domain owns business rules (D-01 scoping, D-03 default view); Postgres owns persistence |
| Record props type validation | API / Backend | — | D-02 requires server-side rejection (400) before any write reaches storage — cannot be delegated to DB constraints (JSONB has no per-key typing) |
| Record body (PageConfig) storage | API / Backend | Database / Storage | Server validates only the envelope shape (version/blocks), exactly like `project_pages.config` — block semantics stay frontend-owned per existing convention |
| View config storage/retrieval | API / Backend | Database / Storage | Views are opaque JSONB (`config`) round-tripped unchanged, same as `programs.config` — no server-side interpretation needed in this phase |
| Parent/child record queries | API / Backend | Database / Storage | `parent_record_id` self-FK + indexed query; pure SQL, no business logic beyond scoping |

No browser/frontend/CDN tier involvement in this phase — confirmed by CONTEXT.md ("independent of any UI").

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.3.6 (already pinned in `apps/api/package.json`) | DTO validation for create/update collection, record, view payloads | Project-wide convention; every domain's `dto/` folder uses it |
| `pg` | 8.11.3 (already pinned) | Raw SQL execution via `db.query()` | No ORM per CLAUDE.md constraint; `core/db` wrapper already used by every repository |
| `express` | 4.18.2 (already pinned) | Router/controller layer | Existing server framework |
| `uuid` / `gen_random_uuid()` | n/a (Postgres built-in, used via `DEFAULT gen_random_uuid()`) | Primary keys | Matches every existing table in the schema |

No new packages need to be installed. `[VERIFIED: package.json]` — all four are already dependencies of `apps/api`, confirmed by grep of the existing `crm`/`projects` domains which import them identically.

### Supporting
None. This phase needs no new supporting libraries — validation, auth middleware (`authenticateToken`), error handling (`AppError`/`asyncHandler`) are all internal `core/` modules already present.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled JSONB schema-vs-props type checker | A JSON-Schema validation library (ajv) | Rejected: schema is small (11 fixed property types), a ~40-line switch function is simpler than introducing a new dependency and translating the collection's own schema format into JSON Schema on every write |
| Storing `relation` values as an array of record ids in `props` | A separate `record_relations` join table | Rejected for Phase 22: CONTEXT.md's Claude's-discretion note explicitly asks for the simplest storage (array in `props[propId]`); a join table is join-target-collection-aware complexity that belongs to a later phase if bidirectionality/rollups are ever built |

**Installation:**
No installation needed — all runtime dependencies already present in `apps/api/package.json`.

**Version verification:** Skipped (no new packages). Confirmed via direct inspection of `apps/api/package.json` and working imports in `apps/api/src/domains/crm/*` that `zod`, `pg`, `express` are already resolvable in this workspace.

## Package Legitimacy Audit

No external packages are installed by this phase — the Package Legitimacy Gate protocol is not applicable. All libraries used (`zod`, `pg`, `express`, `uuid`) are pre-existing project dependencies used identically by the `crm`, `projects`, and `kpi` domains.

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages evaluated — none installed)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
HTTP request (Bearer JWT)
   │
   ▼
authenticateToken middleware (core/auth/middleware.ts)
   │  sets req.user.company_id
   ▼
records.routes.ts  (router.use(authenticateToken))
   │
   ▼
records.controller.ts
   │  requireCompany(req) → companyId
   │  asyncHandler wraps each handler
   ▼
records.service.ts
   │  1. Zod .safeParse(req.body) → AppError(400) on failure
   │  2. [collections] D-03: on create, also insert default view (table type)
   │  3. [records]     D-02: validate props against collection.schema types → AppError(400) on mismatch
   │  4. call repository
   ▼
records.repository.ts
   │  raw SQL via core/db, all queries WHERE company_id = $N
   ▼
PostgreSQL: data_collections / collection_records / collection_views
```

Data flow for a single "create record" request: controller extracts companyId
→ service validates envelope (Zod) → service loads the parent collection's
`schema` (repository call) → service validates each `props[propId]` against
that property's declared `type` → on success, repository inserts the row → 201
response. A type mismatch short-circuits before any DB write (D-02).

### Recommended Project Structure
```
apps/api/src/domains/records/
├── records.types.ts        # DataCollection, CollectionRecord, CollectionView row interfaces
├── records.repository.ts   # raw SQL: collections/records/views CRUD, scoped by company_id
├── records.service.ts      # Zod validation, D-02 prop-type check, D-03 default-view wiring
├── records.controller.ts   # asyncHandler-wrapped handlers, requireCompany() guard
├── records.routes.ts       # authenticateToken + route table
└── dto/
    ├── create-collection.dto.ts   # name, schema[] (ordered property defs)
    ├── update-collection.dto.ts   # partial patch of name/schema
    ├── create-record.dto.ts       # collection_id, props, body?, parent_record_id?
    ├── update-record.dto.ts       # partial patch of props/body/parent_record_id/sort_order
    └── create-view.dto.ts         # name, type, config (groupBy/subGroupBy/filters/sorts/cardProperties)
```

Then register in `apps/api/src/domains/index.ts`:
```ts
import recordsRouter from './records/records.routes';
// ...
router.use('/records', recordsRouter);
```
Mount path choice (`/records` vs `/collections`) is Claude's discretion per
CONTEXT.md — `/records` reads naturally for `POST /records/collections`,
`POST /records/collections/:id/records`, `POST /records/collections/:id/views`.

### Pattern 1: Company-scoped DTO → Service → Repository (existing convention)
**What:** Every write path validates with Zod in the service, throws
`AppError(400, parsed.error.issues[0].message)` on failure, then calls a
repository method that parameterizes `company_id` into every query.
**When to use:** Every collection/record/view mutation in this phase.
**Example:**
```typescript
// Source: apps/api/src/domains/crm/crm.service.ts (existing pattern, verified in this session)
async createClient(companyId: string, body: unknown) {
  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  return this.repo.createClient(companyId, parsed.data);
}
```

### Pattern 2: Envelope-only validation for frontend-owned JSONB (PageConfig)
**What:** The server validates only the outer shape (`version: number`,
`blocks: unknown[]`), never individual block contents — block semantics are
frontend-owned. This is the exact pattern `collection_records.body` must
follow per CONTEXT.md's canonical ref to `page.dto.ts`.
**When to use:** `body` field on `collection_records` (REC-02).
**Example:**
```typescript
// Source: apps/api/src/domains/projects/dto/page.dto.ts (verified in this session)
const PageConfigSchema = z.object({
  version: z.number().int(),
  blocks: z.array(z.unknown()),
}).catchall(z.unknown());
```
Reuse this exact schema (import or duplicate — duplicating avoids a
cross-domain import; both are acceptable, follow whichever existing
cross-domain pattern the planner finds, e.g. `crm` does not import from
`projects` today so duplication is the safer default).

### Pattern 3: Prop-type validation against a dynamic schema (new, D-02)
**What:** A pure function that takes the collection's `schema` (array of
`{ id, type, name, ... }`) and a `props` object (`{ [propId]: value }`), and
for every key present in `props`, checks the value against the declared
`type`'s expected shape.
**When to use:** `records.service.ts` on record create/update, before calling
the repository.
**Example (illustrative, not from an external source — first-party design for this phase):**
```typescript
type PropType = 'text' | 'number' | 'date' | 'select' | 'multi-select'
  | 'checkbox' | 'person' | 'url' | 'email' | 'phone' | 'files' | 'relation';

function validatePropValue(type: PropType, value: unknown): boolean {
  switch (type) {
    case 'text': case 'url': case 'email': case 'phone': case 'select':
      return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'checkbox': return typeof value === 'boolean';
    case 'date': return typeof value === 'string'; // ISO date/date-range string
    case 'multi-select': case 'files': case 'relation':
      return Array.isArray(value) && value.every((v) => typeof v === 'string');
    case 'person': return typeof value === 'string'; // single user id
    default: return true;
  }
}
```
Service loop: for each `propId` in `props`, find its schema entry by `id`; if
not found, reject (AppError 400 — "unknown property"); if found, run
`validatePropValue(entry.type, props[propId])` and reject on failure with the
property name in the message.

### Anti-Patterns to Avoid
- **Redesigning the §3.3 schema:** CONTEXT.md explicitly says "copy verbatim
  into the migration; do not redesign." Do not add columns, rename fields, or
  change types even if they look improvable — this is spec-locked.
- **Enforcing 403 credit-risk logic here:** Out of scope; this phase has
  nothing to do with the CRM semaphore despite living in the same monorepo's
  CLAUDE.md constraints section — those constraints target the CRM rework, not
  this milestone.
- **Building a JSON-Schema validator dependency for D-02:** Overkill for 11
  fixed property types; a switch statement is simpler, has zero new attack
  surface, and matches the codebase's "no over-engineering" style (see Function
  Design conventions — 20-50 line service methods).
- **Skipping `project_id` entirely from the migration:** D-01 says the column
  exists (nullable FK) but stays unused — do not omit it from the table, only
  from the DTOs/API surface for this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID generator | Postgres `gen_random_uuid()` (already the convention in every table) | Consistency; `pgcrypto`/`pgcore` extension already enabled elsewhere in the schema |
| JSONB envelope validation for `body` | Custom recursive block validator | `z.object({...}).catchall(z.unknown())` pattern from `page.dto.ts` | Already solved identically for `project_pages.config`; block semantics are explicitly frontend-owned |
| Auth/company scoping | Custom per-route auth checks | `authenticateToken` middleware + `requireCompany(req)` helper | Existing, tested, used by all 19 domains |
| Error response shaping | Custom try/catch per handler | `asyncHandler` + global `errorHandler` + `AppError` | Existing infrastructure; consistent JSON error shape across the API |

**Key insight:** Nothing in this phase requires a new library or generic
solution — the entire job is applying four already-proven internal patterns
(DTO/service/repository/route) to three new tables. The only original code is
the D-02 prop-type switch function, which is intentionally small.

## Common Pitfalls

### Pitfall 1: Forgetting `company_id` on `collection_views`
**What goes wrong:** The §3.3 schema gives `collection_views` its own
`company_id` column (not just inherited via `collection_id` join) — a repo
method that only filters by `collection_id` would leak cross-tenant reads if
`collection_id` were ever guessable/enumerable.
**Why it happens:** Easy to assume the FK to `data_collections` is enough
scoping and skip the redundant `company_id` filter.
**How to avoid:** Every repository SELECT/UPDATE/DELETE on all three tables
must include `AND company_id = $N`, matching every other domain's convention
(verified in `crm.repository.ts`, `projects.repository.ts`).
**Warning signs:** A query that joins `data_collections`/`collection_records`
but doesn't repeat `company_id =` on the child table.

### Pitfall 2: `props` validation running before the collection is loaded
**What goes wrong:** D-02 validation needs the *current* schema of the
collection to know each property's `type`. If a record create/update handler
tries to validate `props` using a stale or missing schema (e.g., collection
not found), it will throw a confusing error or silently skip validation.
**Why it happens:** Ordering — Zod-validating the DTO shape first (fine) but
forgetting the second DB round-trip to fetch `collection.schema` before the
type-check step.
**How to avoid:** Service method order: (1) Zod-validate the envelope of the
create/update payload, (2) `repo.findCollection(collectionId, companyId)` — 404
if missing, (3) run `validatePropValue` per key using that schema, (4) only
then call `repo.createRecord`/`updateRecord`.
**Warning signs:** Tests where an unknown `collection_id` on record-create
produces a Postgres FK violation instead of a clean `AppError(404, ...)`.

### Pitfall 3: `sort_order` not defaulted per-collection on record insert
**What goes wrong:** `collection_records.sort_order INTEGER NOT NULL DEFAULT 0`
means every record without an explicit value gets `0` — fine for REC-01..04
(no ordering requirement stated), but if the planner adds ordering behavior
prematurely, all-zero `sort_order` will look broken later (Phase 24's board
drag-reorder needs distinct values).
**Why it happens:** The schema's `DEFAULT 0` is a safe minimal default, not an
auto-increment.
**How to avoid:** For Phase 22, it's acceptable to leave `sort_order` at the
DB default (0) unless CONTEXT.md's decisions require otherwise — they don't.
Note this explicitly as intentionally deferred to Phase 24, not a gap in this
phase's plan.
**Warning signs:** A verification task incorrectly demanding per-collection
auto-incrementing `sort_order` in Phase 22 — out of REC-01..04 scope.

### Pitfall 4: Default view auto-creation (D-03) not atomic with collection create
**What goes wrong:** If `createCollection` and the default-view insert are two
separate, un-transacted calls, a crash between them leaves a collection with
zero views, contradicting D-03's guarantee ("always has at least one queryable
view without a separate explicit call").
**Why it happens:** `core/db`'s `db.query()` wrapper is used per-statement in
every existing repository (no visible transaction helper in the files read
this session); it's tempting to just do two sequential awaits.
**How to avoid:** Check `core/db` for a transaction helper (e.g., a `withTx`
or pool client acquire/release pattern) before implementing D-03 — if none
exists, the simplest safe option is a single repository method
`createCollectionWithDefaultView` that runs both INSERTs inside one
`BEGIN`/`COMMIT` using a client checked out from the pool. The planner should
verify `core/db`'s exported surface (`db.query`, and whether `db.pool` or
`db.getClient()` is exposed) before committing to an implementation.
**Warning signs:** A collection row exists with zero rows in
`collection_views` after a create call — should never be observable per D-03.

## Code Examples

### Migration file (copy verbatim, source: docs/specs/core/workspace-blocks.md §3.3)
```sql
-- Migration: data_collections / collection_records / collection_views —
-- Records + Views data model (Phase 22, v4.0). Apply after 024. Idempotent.
-- Schema locked in docs/specs/core/workspace-blocks.md §3.3 — do not redesign.

CREATE TABLE IF NOT EXISTS data_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  parent_record_id UUID REFERENCES collection_records(id) ON DELETE CASCADE,
  props JSONB NOT NULL DEFAULT '{}',
  body JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collection_records_coll_idx ON collection_records (collection_id, sort_order);
CREATE INDEX IF NOT EXISTS collection_records_parent_idx ON collection_records (parent_record_id);

CREATE TABLE IF NOT EXISTS collection_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'board',
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Note: the spec's §3.3 snippet omits `IF NOT EXISTS` on the table/index
statements — every other migration in `database/migrations/` (verified:
`009_project_pages.sql`, `024_kpi_target_client.sql`) uses `IF NOT EXISTS`
throughout for idempotency. `[ASSUMED]` — adding `IF NOT EXISTS` is consistent
with codebase convention and does not change the locked schema's columns or
types, only its idempotency guarantee; flagged in Assumptions Log below since
it's a minor addition to the "copy verbatim" instruction.

### Parent/child query for REC-04
```typescript
// New — first-party design for this phase, follows repository patterns
// verified in projects.repository.ts / crm.repository.ts
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

## State of the Art

Not applicable — this phase implements a spec that was authored in this same
session/milestone (`docs/specs/core/workspace-blocks.md`, part of the v4.0
"Workspace Records & Views" milestone). There is no prior version of this
feature to compare against; `KanbanBlock`'s `{id, text}` page-JSON storage
(§2.2 of the spec) is the "old approach" being replaced, but that replacement
happens in Phases 23-24, not this phase.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Kanban cards as `{id, text}` in `project_pages.config` JSON | Cards as `collection_records` rows with typed `props` + `PageConfig` body | This milestone (v4.0), starting Phase 22 | Enables real properties, multiple views, sub-items — none of which existed before; Phase 22 only lays the data model, UI wiring is Phases 23-26 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `IF NOT EXISTS` should be added to the §3.3 migration's `CREATE TABLE`/`CREATE INDEX` statements even though the spec snippet omits it | Code Examples | Low — matches every other migration's idempotency convention; if the planner instead copies the spec's exact text without `IF NOT EXISTS`, a re-run of the migration would fail, which is itself a deviation from every other migration in the folder, so this should be treated as a near-certain correction, not a real ambiguity |
| A2 | `core/db` does not expose a transaction/client-checkout helper beyond `db.query()` (based on repository files read this session, none used a transaction) | Common Pitfalls (D-03 atomicity) | Medium — if a transaction helper does exist and the planner doesn't check, D-03 might be implemented as two non-atomic inserts; the planner must verify `apps/api/src/core/db`'s exports before finalizing the create-collection service method |
| A3 | `person` property values are stored as a single string user id (not an array) in `props` | Code Examples (Pattern 3) | Low — spec §3.1 says `person (→ users)` without specifying single/multi; REC-01/REC-02 don't require multi-person support, and this is analogous to the `relation` array-of-ids default the user already blessed as "simplest storage" — if wrong, a later phase can widen `person` to accept an array with a minor validator change |
| A4 | Mount path for the new domain router is `/records` (e.g. `/api/v1/records/collections`), not `/collections` or `/data-collections` | Recommended Project Structure | Low — explicitly Claude's discretion per CONTEXT.md; any reasonable naming works since no frontend consumes this API yet in this phase |

## Open Questions (RESOLVED)

1. **Does `core/db` expose a transaction/client-checkout helper for D-03's atomic collection+default-view create?**
   - What we know: Every repository read this session (`projects.repository.ts`, `crm.repository.ts`) uses only `db.query()` per statement, no visible transaction wrapping.
   - What's unclear: Whether `apps/api/src/core/db/index.ts` (not read this session) exports a pool client / `withTransaction` helper.
   - Recommendation: Planner should read `apps/api/src/core/db/index.ts` directly before writing the create-collection service method; if no transaction helper exists, either add a minimal one (`BEGIN`/`COMMIT`/`ROLLBACK` via `pool.connect()`) or accept two sequential inserts as a documented, low-risk gap (crash window is a single INSERT/INSERT sequence with no external side effects).
   - **RESOLVED:** `apps/api/src/core/db/index.ts` confirmed to be a raw `pg.Pool` with no transaction helper (verified via grep during pattern mapping and plan-checker cross-check). Plan 22-02 implements a first-party `db.connect()`-based `BEGIN`/`COMMIT`/`ROLLBACK` wrapper for the atomic collection+default-view create.

2. **Exact validation message format for D-02 type mismatches**
   - What we know: The convention is `AppError(400, parsed.error.issues[0].message)` for Zod failures, but D-02's prop-type check is not itself a Zod schema (it's dynamic per-collection).
   - What's unclear: Whether to construct a Zod schema dynamically per-collection (more consistent with codebase style) vs. the illustrative switch-function approach shown above (simpler, no Zod dependency for this specific check).
   - Recommendation: Either is acceptable; CONTEXT.md explicitly defers "exact validation error shape/messages" to Claude's discretion. A dynamic Zod object built from the schema (`z.object(Object.fromEntries(schema.map(p => [p.id, zodSchemaForType(p.type)])))`) would be more idiomatic given the codebase's heavy Zod usage — planner should pick one and note it as a plan-level decision, not re-research.
   - **RESOLVED:** Plan 22-03 implements a switch-based `validateProps` function (per-type case) rather than a dynamically-built Zod object, surfaced through `AppError(400, ...)` on mismatch and wired into `records.controller.ts` error handling in Plan 22-04.

## Environment Availability

Skipped — this phase has no external dependencies beyond the already-running
PostgreSQL instance and existing Node.js/npm toolchain used by every other
domain in this monorepo (no new services, no new CLIs, no new package
installs).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) via `ts-node/register` |
| Config file | none — driven by `apps/api/package.json` `"test"` script: `node --require ts-node/register --test src/**/*.test.ts` |
| Quick run command | `npm --prefix apps/api test -- src/domains/records/*.test.ts` (once test files exist) |
| Full suite command | `npm --prefix apps/api test` |

`[VERIFIED: apps/api/package.json]` — confirmed via direct read of the `test`
script; existing test files use this pattern (e.g.
`apps/api/src/domains/kpi/evaluators/creditRisk.evaluator.test.ts`,
`apps/api/src/domains/outlook/email.matcher.test.ts`), both colocated
`*.test.ts` files next to the module under test, using Node's built-in
`node:test`/`node:assert` (not Jest/Vitest — no jest.config or vitest.config
found in `apps/api`).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REC-01 | Create collection with ordered typed-property schema, company-scoped | unit (service) | `node --require ts-node/register --test src/domains/records/records.service.test.ts` | ❌ Wave 0 |
| REC-02 | Create record with `props` + `body` (PageConfig shape) | unit (service) | same file as above | ❌ Wave 0 |
| REC-03 | Save and retrieve a view unchanged (type/groupBy/subGroupBy/filters/sorts/cardProperties round-trip) | unit (service) | same file as above | ❌ Wave 0 |
| REC-04 | `parent_record_id` set on create; children queryable for a given parent | unit (service or repository) | `node --require ts-node/register --test src/domains/records/records.repository.test.ts` | ❌ Wave 0 |
| D-02 | Prop-type mismatch rejected with 400 | unit (service) | `records.service.test.ts` | ❌ Wave 0 |
| D-03 | Collection create auto-creates default table view | unit (service) | `records.service.test.ts` | ❌ Wave 0 |

No integration/e2e harness with a live Postgres was available in this research
session (consistent with prior phases' noted blocker: "no live PostgreSQL
container was available in the execution environment" — see STATE.md Phase 5
blocker). Repository-level tests will likely need either a test DB connection
or mocking `core/db`'s `query` — check how existing repository tests (if any)
handle this; none of the `*.test.ts` files found this session test a
`.repository.ts` file directly (they test parsers/evaluators/services), so
this is a new pattern for this phase. `[ASSUMED]` this is solvable by mocking
`core/db.query` in unit tests rather than requiring a live DB connection —
planner/executor should confirm no existing repository-test convention is
being missed.

### Sampling Rate
- **Per task commit:** `node --require ts-node/register --test src/domains/records/*.test.ts`
- **Per wave merge:** `npm --prefix apps/api test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/domains/records/records.service.test.ts` — covers REC-01, REC-02, REC-03, D-02, D-03
- [ ] `apps/api/src/domains/records/records.repository.test.ts` — covers REC-04 (parent/child queries); needs a decision on DB-mocking vs. live-DB strategy (Open Question above)
- [ ] Framework install: none — `node --test` + `ts-node` already present and used elsewhere

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | `authenticateToken` middleware (JWT Bearer), reused unchanged from every other domain |
| V3 Session Management | no | No new session mechanism introduced; relies on existing JWT/SSO cookie infra |
| V4 Access Control | yes | `company_id` scoping on every query (multi-tenant isolation) — see Pitfall 1; no role-based restriction is specified in REC-01..04, so any authenticated user in the company can CRUD collections/records/views (matches the permissiveness of the `crm`/`projects` domains today) |
| V5 Input Validation | yes | Zod DTOs for envelope shape; first-party dynamic prop-type validation for `props` (D-02) |
| V6 Cryptography | no | No secrets, tokens, or encrypted fields in this schema |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SQL injection via string-built queries | Tampering | Parameterized queries (`$1, $2, ...`) via `pg` — mandatory, already the convention in every repository read this session; never string-concatenate `props`/`config`/`schema` JSON into SQL text (always pass as a parameter with `JSON.stringify(...)`) |
| Cross-tenant data leak via missing `company_id` filter | Elevation of Privilege / Information Disclosure | Every SELECT/UPDATE/DELETE across all three tables must filter `company_id = $N` — see Pitfall 1 |
| JSONB `props`/`config`/`schema` accepting arbitrary nested objects (DoS via huge payloads, prototype pollution in JS consumers) | Denial of Service / Tampering | Zod envelope validation caps shape but not size; consider a reasonable max on `schema` array length and `props` object key count if the planner wants defense-in-depth — not explicitly required by REC-01..04 but low-cost to add (e.g. `z.array(...).max(100)` on schema) |

## Sources

### Primary (HIGH confidence)
- `docs/specs/core/workspace-blocks.md` (read in full this session) — canonical schema (§3.3), property type list (§3.1), build order (§9), do/don't (§10)
- `apps/api/src/domains/projects/dto/page.dto.ts` (read this session) — `PageConfig` envelope-validation pattern
- `apps/api/src/domains/projects/projects.repository.ts` (read this session) — JSONB page-column storage/read pattern
- `apps/api/src/domains/crm/{crm.routes,crm.controller,crm.repository,crm.service*,dto/create-client.dto}.ts` (read this session) — full DDD domain pattern reference, Zod/AppError convention, `requireCompany` helper
- `apps/api/src/domains/index.ts` (read this session) — router registration pattern
- `apps/api/src/core/errors/AppError.ts` (read this session) — error class shape
- `database/migrations/009_project_pages.sql`, `024_kpi_target_client.sql` (read this session) — migration header/idempotency convention, confirms `IF NOT EXISTS` usage
- `apps/api/package.json` `test` script (read this session) — confirms Node built-in test runner, not Jest/Vitest
- `.planning/phases/22-records-views-data-model/22-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (read this session) — locked decisions, requirement IDs, prior-phase history/blockers

### Secondary (MEDIUM confidence)
None — no external web sources were needed; this phase is entirely internal-convention research against a spec that already exists in-repo.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all verified present via direct `package.json`/import inspection
- Architecture: HIGH — schema is spec-locked verbatim; domain layout mirrors 4+ existing domains inspected directly
- Pitfalls: HIGH for scoping/ordering issues (directly observed conventions); MEDIUM for the D-03 transaction question (core/db internals not directly read — flagged as Open Question)

**Research date:** 2026-07-13
**Valid until:** 30 days (stable internal codebase conventions; no fast-moving external dependency)

## RESEARCH COMPLETE
