# Phase 4: Bulk Excel Import - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 7 (3 backend modify, 4 frontend create/modify)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `apps/api/src/domains/crm/crm.service.ts` (`importClients` method) | service | batch (per-row CRUD) | `crm.service.ts` `createClient` (same file, same class) | exact |
| `apps/api/src/domains/crm/crm.repository.ts` (new lookup methods) | model/repository | CRUD | `team.repository.ts` (`findMember`/`emailExists` by-email lookup) + `crm.repository.ts` `createClient`/`findClient` | exact (self) + role-match (email lookup) |
| `apps/api/src/domains/crm/crm.controller.ts` | controller | request-response | itself — no change needed, confirmed pass-through | exact (no-op) |
| `apps/api/src/domains/crm/crm.routes.ts` | route | request-response | itself — no change needed, confirmed already registered | exact (no-op) |
| `apps/api/src/domains/crm/dto/create-client.dto.ts` | validation schema | CRUD | itself — reused as-is per row, no change | exact (no-op) |
| `apps/workspaces/src/components/projectPage/ImportClientsModal.tsx` (new) | component | file-I/O + batch request-response | `apps/workspaces/src/components/projectPage/AddClientModal.tsx` (modal shell/style) + `apps/workspaces/src/components/workspaces/ExcelAutomationTool.tsx` (xlsx parse mechanics) | role-match (modal) + role-match (parsing) |
| `apps/workspaces/src/app/records/page.tsx` | component (page) | request-response | itself — modify to add button + modal mount | exact (self) |
| `apps/workspaces/src/lib/api/crm.api.ts` (new `importClients` fn) | utility (API client) | request-response | `crm.api.ts` existing functions (same file) | exact |
| `apps/workspaces/src/lib/hooks/useCrm.ts` (new `useImportClients` hook) | hook | request-response | `useCrm.ts` `useCreateClient` (same file) | exact |

## Pattern Assignments

### `apps/api/src/domains/crm/crm.service.ts` — `importClients` method (service, batch)

**Analog:** same file, `createClient` method (lines 22-37), plus `assertOwnedProject`-style cross-domain lookup pattern (lines 98-106).

**Imports pattern already in file** (lines 1-8):
```typescript
import { AppError } from '../../core/errors/AppError';
import { crmRepository } from './crm.repository';
import { projectsRepository } from '../projects/projects.repository';
import { ClientRecord, ResolvedClientProjectView, ClientPageRecord, ClientTimelineEntry } from './crm.types';
import { CreateClientSchema } from './dto/create-client.dto';
```
Add: `import { teamRepository } from '../team/team.repository';` (or a new `crmRepository.findMemberByEmail` — see repository section) for the D-07 email lookup, scoped by `companyId`.

**Single-row create pattern to replicate per-row** (lines 22-37):
```typescript
async createClient(companyId: string, body: unknown): Promise<ClientRecord> {
  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return crmRepository.createClient(companyId, {
    name: d.name,
    country: d.country.toUpperCase(),
    vat_id: d.vat_id ?? null,
    email: d.email ?? null,
    credit_limit: d.credit_limit ?? 10000,
    default_rate_eur: d.default_rate_eur ?? null,
    notes: d.notes ?? null,
    address: d.address ?? null,
    responsible_employee_id: d.responsible_employee_id ?? null,
  });
}
```
**Replace the stub with a loop over this same shape** — reuse `CreateClientSchema.safeParse` per row (D-04), same `?? 10000` / `?? null` defaulting (D-06), but:
1. Resolve `responsible_employee_id` from the row's raw "email" column via team lookup (D-07) BEFORE Zod validation of the UUID field (the schema expects a resolved UUID, not an email string — so pre-resolve, then feed the resolved id into `CreateClientSchema.safeParse`).
2. Check duplicate VAT ID within `companyId` scope (D-05) before insert.
3. Catch failures per-row (do not let one row's `AppError` throw abort the loop — this is the antipattern of `createClient`'s single-shot throw; import needs to catch per iteration).

**Stub being replaced** (lines 158-160):
```typescript
async importClients(_companyId: string, _body: unknown): Promise<{ created: number; failed: number; errors: string[] }> {
  throw new AppError(501, 'Bulk import not yet implemented — lands in Phase 4');
}
```
New return shape per CONTEXT.md D-03: `{ created: number; failed: number; results: Array<{ row: number; status: 'created' | 'failed'; client?: ClientRecord; reason?: string }> }` — richer than the current stub's `{created, failed, errors}` signature; update `crm.types.ts` accordingly (or inline the type in the service, matching the existing convention of return types declared directly on service methods, e.g. `getClientRisk`'s inline `Promise<{ status: 'unavailable'; ... }>` at line 167).

**Cross-domain lookup pattern to mirror for employee-email resolution** (lines 98-106):
```typescript
private async assertOwnedProject(projectId: string, companyId: string): Promise<void> {
  const p = await projectsRepository.findProject(projectId);
  if (!p) throw new AppError(404, 'Project not found');
  if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
}
```
Add a private helper `resolveResponsibleEmployee(email: string | undefined, companyId: string): Promise<string | null>` in `CrmService` following this same style — call `teamRepository.listMembers(companyId)` (or add a targeted `findMemberByEmail`, see below) and return `null` for blank email (allowed per D-07), throw/flag failure for non-matching email.

---

### `apps/api/src/domains/crm/crm.repository.ts` — new lookup method (repository, CRUD)

**Analog:** `apps/api/src/domains/team/team.repository.ts` lines 44-47 (`emailExists`) — same shape of email-scoped lookup, and `crm.repository.ts` lines 28-32 (`findClient`) for the query style already in this file.

**Existing email-lookup pattern in `team.repository.ts`** (lines 44-47):
```typescript
async emailExists(email: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
  return rows.length > 0;
}
```
This is NOT company-scoped (global uniqueness check for signup) — the new lookup needed for D-07 must be company-scoped. Add a new method to `team.repository.ts` (or call directly from `crm.service.ts`), e.g.:
```typescript
async findMemberByEmail(email: string, companyId: string): Promise<TeamMember | null> {
  const { rows } = await db.query<TeamMember>(
    `SELECT ${MEMBER_COLS} FROM users WHERE email = $1 AND company_id = $2`,
    [email, companyId],
  );
  return rows[0] ?? null;
}
```
This mirrors `findMember(id, companyId)` (lines 36-42 of `team.repository.ts`) exactly, just keyed by email instead of id.

**Existing findClient pattern in `crm.repository.ts`** (lines 28-32) — mirror for the D-05 duplicate-VAT check, add:
```typescript
async findClientByVatId(vatId: string, companyId: string): Promise<ClientRecord | null> {
  const { rows } = await db.query<ClientRecord>(
    `SELECT * FROM clients WHERE vat_id = $1 AND company_id = $2`, [vatId, companyId]);
  return rows[0] ? numClient(rows[0]) : null;
}
```
Note: only meaningful when `vat_id` is non-null on the row — a row with no VAT ID skips the duplicate check (nothing to match on).

**createClient pattern to call per successful row** (lines 34-44, `crm.repository.ts`) — call this exactly as `createClient` already does, no new insert logic needed; the loop in the service is the only new orchestration.

---

### `apps/api/src/domains/crm/crm.controller.ts` and `crm.routes.ts` — no change needed

**Confirmed as-is.** Controller (lines 42-44) already delegates and returns the service result verbatim:
```typescript
export const importClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await crmService.importClients(requireCompany(req), req.body));
});
```
Route (line 22) already registered: `router.post('/clients/import', importClients);`. Both match CONTEXT.md's canonical_refs claim — no edits required to either file.

---

### `apps/workspaces/src/components/projectPage/ImportClientsModal.tsx` (new component, file-I/O + batch request-response)

**Analog 1 (modal shell/styling):** `apps/workspaces/src/components/projectPage/AddClientModal.tsx` (full file, 119 lines)

**Modal shell pattern** (lines 55-69):
```tsx
return (
  <div
    className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
    onClick={onClose}
  >
    <div
      className="saas-card max-w-md w-full mx-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add client</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>
```
Widen `max-w-md` to something like `max-w-3xl` for a preview table with 7 columns; keep the same overlay/card/close-button convention. Props interface pattern (lines 13-16):
```tsx
interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
}
```

**Field/input styling convention** (`saas-input !py-1.5 text-sm`, lines 76-106) — reuse for any manual-entry-style controls in the modal (e.g., file picker button), though most of the modal will be a preview table, not form inputs.

**Submit + hook usage pattern** (lines 36-53) — reuse the `mutate(..., { onSuccess: () => { reset(); onClose(); } })` structure, but for import the mutation is a single batch POST (array of rows) rather than one row — see `useCreateClient` vs the new `useImportClients` hook below.

**Analog 2 (client-side xlsx parsing mechanics):** `apps/workspaces/src/components/workspaces/ExcelAutomationTool.tsx` lines 1-85

**Imports** (lines 1-22):
```tsx
'use client';
import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { UploadCloud, FileSpreadsheet, ... } from 'lucide-react';
```

**File upload → parse pattern** (lines 42-64):
```tsx
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const uploadedFile = e.target.files?.[0];
  if (uploadedFile) {
    setFile(uploadedFile);
    processFile(uploadedFile);
  }
};

const processFile = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target?.result as ArrayBuffer);
    const wb = xlsx.read(data, { type: 'array' });
    setWorkbook(wb);
    setSheets(wb.SheetNames);
    if (wb.SheetNames.length > 0) {
      selectSheet(wb, wb.SheetNames[0]);
    }
    setStep('structure');
  };
  reader.readAsArrayBuffer(file);
};
```

**Sheet → row objects pattern** (lines 66-85) — this is the core mechanic to mirror for D-01, but simplified: `ImportClientsModal` doesn't need column mapping/selection (fixed 7-column template), so skip the generic header-remap logic and go straight from `sheet_to_json` to typed row objects matching `CreateClientInput` + email column:
```tsx
const selectSheet = (wb: xlsx.WorkBook, sheetName: string) => {
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
  // ImportClientsModal: instead of generic headerRow indexing, use
  // xlsx.utils.sheet_to_json(ws) directly (object mode, header:undefined)
  // since the column set/order is fixed (D-08's 7 columns), producing
  // row objects keyed by header text directly.
};
```
Recommend using `xlsx.utils.sheet_to_json<Record<string, unknown>>(ws)` (object mode, no `header: 1`) since the template's header row is fixed and known — simpler than `ExcelAutomationTool`'s generic column-remapping, appropriate given D-01 says "mirror the parsing mechanics," not the column-mapping UI.

**Template generation (D-08) — new usage of the same `xlsx` package, inverse direction:**
```tsx
import * as xlsx from 'xlsx';
const ws = xlsx.utils.json_to_sheet([
  { name: '', country: '', vat_id: '', address: '', responsible_employee_email: '', credit_limit: '', default_rate_eur: '' },
]);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Clients');
xlsx.writeFile(wb, 'client-import-template.xlsx');
```
No existing analog for `json_to_sheet`/`writeFile` (template generation direction) exists in the codebase — `ExcelAutomationTool.tsx` only reads. Use `xlsx.writeFile` (browser download trigger) per the `xlsx` package's documented API; this is new code, not a copy, but follows the same import/package convention (D-08).

---

### `apps/workspaces/src/app/records/page.tsx` (page, request-response) — modify

**Analog:** itself. Existing "Add client" button + modal-open state pattern (lines 29, 69-75, 141) is the exact pattern for the new button:
```tsx
const [addOpen, setAddOpen] = useState(false);
...
<button
  onClick={() => setAddOpen(true)}
  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
>
  <Plus className="w-4 h-4" /> Add client
</button>
...
<AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
```
Add sibling state `const [importOpen, setImportOpen] = useState(false)` and a second button (D-09: "next to the existing Add client button"), using a distinct icon (e.g. `Upload` or `FileSpreadsheet` from `lucide-react`, already imported in `ExcelAutomationTool.tsx`) but identical button styling — swap `bg-primary-600` for a secondary style (e.g. `border border-gray-300` outline button) to visually distinguish primary (Add) vs secondary (Import) actions, consistent with typical dashboard button hierarchy conventions elsewhere in the codebase (not explicitly required by CONTEXT.md, Claude's discretion).

---

### `apps/workspaces/src/lib/api/crm.api.ts` (API client, request-response) — add `importClients` function

**Analog:** same file, `createClient` (lines 82-83):
```typescript
createClient: (data: CreateClientInput) =>
  apiFetch<{ client: CrmClient }>(`${BASE}/clients`, 'POST', data).then((r) => r.client),
```
New function, same style:
```typescript
importClients: (rows: Record<string, unknown>[]) =>
  apiFetch<ImportClientsResult>(`${BASE}/clients/import`, 'POST', rows),
```
Add a new exported interface `ImportClientsResult` near the top of the file alongside `CrmClient`/`CreateClientInput` (lines 3-30 convention), matching whatever shape `crm.service.ts`'s `importClients` returns (see service section above — `{ created, failed, results }`).

---

### `apps/workspaces/src/lib/hooks/useCrm.ts` (hook, request-response) — add `useImportClients` hook

**Analog:** same file, `useCreateClient` (lines 41-47):
```typescript
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientInput) => crmApi.createClient(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients }),
  });
}
```
New hook, same style:
```typescript
export function useImportClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => crmApi.importClients(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clients }),
  });
}
```
Same `qk.clients` invalidation key (line 15) — bulk import affects the same list the single-create mutation invalidates, no new query key needed.

---

## Shared Patterns

### Auth / Multi-tenancy
**Source:** `apps/api/src/domains/crm/crm.controller.ts` lines 7-11 (`requireCompany`) + `crm.routes.ts` line 11 (`router.use(authenticateToken)`)
**Apply to:** No change needed — `importClients` controller/route already wired through the same auth chain as every other CRM endpoint. All new repository/service logic must take `companyId` as an explicit scoping parameter (never trust a body-supplied company id), matching every other method in `crm.repository.ts` and `crm.service.ts`.

### Error Handling
**Source:** `apps/api/src/core/errors/AppError.ts` + `crm.service.ts`'s `parsed.error.issues[0].message` convention (lines 24, 41, 68)
**Apply to:** Per-row validation failures inside the import loop should NOT throw `AppError` (that would abort the whole batch, violating D-03's per-row independence) — instead catch `AppError`s thrown by the same Zod-parse-and-throw pattern per iteration and push a `{ row, status: 'failed', reason: err.message }` entry into the results array. Only a request-level failure (e.g., malformed body, not an array) should throw `AppError` up to `asyncHandler`.

### Validation
**Source:** `apps/api/src/domains/crm/dto/create-client.dto.ts` (`CreateClientSchema`, full file) + `crm.service.ts` lines 23-24 (`safeParse` + first-issue-message extraction)
**Apply to:** Every import row, applied identically to `createClient`'s single-row path (D-04) — same schema instance, same `.safeParse(body)` → `parsed.error.issues[0].message` extraction for the per-row failure reason.

### React Query Hook Structure
**Source:** `apps/workspaces/src/lib/hooks/useCrm.ts` (`qk` key factory lines 14-21, `useMutation` + `invalidateQueries` convention throughout)
**Apply to:** `useImportClients` new hook — same `qk.clients` invalidation, same `useMutation` shape, no new query key needed since import doesn't need its own cache entry (D-02: no import history persisted).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Template generation code (`xlsx.utils.json_to_sheet` + `xlsx.writeFile`, inside `ImportClientsModal.tsx`) | utility (client-side file generation) | file-I/O | No existing code in the repo generates a downloadable `.xlsx` file from scratch — `ExcelAutomationTool.tsx` only reads/parses uploaded files, never writes one. This is genuinely new usage of the already-installed `xlsx` package (D-08), following the package's own documented API rather than an in-repo analog. |

## Metadata

**Analog search scope:** `apps/api/src/domains/crm/`, `apps/api/src/domains/team/`, `apps/workspaces/src/components/projectPage/`, `apps/workspaces/src/components/workspaces/`, `apps/workspaces/src/lib/hooks/`, `apps/workspaces/src/lib/api/`, `apps/workspaces/src/app/records/`
**Files scanned:** 11 (crm.service.ts, crm.repository.ts, crm.controller.ts, crm.routes.ts, create-client.dto.ts, team.repository.ts, useTeam.ts, useCrm.ts, crm.api.ts, records/page.tsx, AddClientModal.tsx, ExcelAutomationTool.tsx)
**Pattern extraction date:** 2026-07-06
