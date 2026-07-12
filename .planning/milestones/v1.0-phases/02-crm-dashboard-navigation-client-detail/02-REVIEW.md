---
phase: 02-crm-dashboard-navigation-client-detail
reviewed: 2026-07-06T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - apps/api/src/domains/crm/crm.controller.ts
  - apps/api/src/domains/crm/crm.repository.ts
  - apps/api/src/domains/crm/crm.routes.ts
  - apps/api/src/domains/crm/crm.service.ts
  - apps/api/src/domains/crm/crm.types.ts
  - apps/api/src/domains/crm/dto/create-client-page.dto.ts
  - apps/api/src/domains/crm/dto/update-client-page.dto.ts
  - apps/workspaces/src/app/projects/[id]/pages/[pageId]/page.tsx
  - apps/workspaces/src/app/records/[clientId]/page.tsx
  - apps/workspaces/src/app/records/page.tsx
  - apps/workspaces/src/components/layout/WorkspaceSidebar.tsx
  - apps/workspaces/src/components/projectPage/AddClientModal.tsx
  - apps/workspaces/src/components/projectPage/ClientCurrentSituationBlock.tsx
  - apps/workspaces/src/components/projectPage/ClientTimelineBlock.tsx
  - apps/workspaces/src/components/projectPage/LivePageCanvas.tsx
  - apps/workspaces/src/components/projectPage/NewClientPageModal.tsx
  - apps/workspaces/src/components/projectPage/PageBlockSettings.tsx
  - apps/workspaces/src/components/projectPage/PageBlockView.tsx
  - apps/workspaces/src/lib/api/crm.api.ts
  - apps/workspaces/src/lib/hooks/useCrm.ts
  - apps/workspaces/src/lib/projectPage/blocks.ts
  - database/migrations/022_client_pages.sql
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21 (API domain, DTOs, migration, frontend dashboard/detail pages, canvas/block plumbing)
**Status:** issues_found

## Summary

This phase adds a CRM dashboard, a client detail page (Notion-style canvas reused via `LivePageCanvas`/`PageBlockView`), a client-pages backend domain, and navigation entry points (sidebar, new-tab links, a "New client page" picker from the project page canvas). The backend layering (controller → service → repository), company-scoping on every query (verified: every repository method takes and applies `companyId` in its `WHERE` clause, including the `client_pages` UPDATE), and DTO validation via fixed Zod schemas (no dynamic column names reach SQL, so no injection risk from the patch-building logic in `updateClient`) are solid and consistent with project conventions. Route registration order in `crm.routes.ts` was checked for path-collision hazards and is correct — no shadowing bug found there.

The main defect found is a silent-failure risk in the client detail page's autosave wiring: the page-config update mutation is constructed with a possibly-empty `pageId` before the page has loaded, and it fails without ever surfacing an error to the user. Several other issues degrade robustness or maintainability: a risk-semaphore stub that returns nothing useful with no phase cross-reference (unlike the `importClients` stub, which documents its target phase), a swallowed-error branch in the inline-edit autosave that can never execute, a non-normalized timeline sort that assumes uniform timestamp string formats across three different data sources, and duplicated client-creation form markup across two modals that contradicts the stated intent of having extracted a shared component.

## Critical Issues

### CR-01: Client-page autosave mutation is constructed against a possibly-empty `pageId`, and failures are never surfaced to the user

**File:** `apps/workspaces/src/app/records/[clientId]/page.tsx:28, 70-91`
**Issue:** `updatePage` is created unconditionally with `page?.id ?? ''`:
```ts
const updatePage = useUpdateClientPage(page?.id ?? '', clientId);
```
Both the debounced autosave effect (line 70-81) and the unmount-flush effect (line 84-91) call `updatePageRef.current.mutate({ config: ... })` with no `onError` handler and no check that `page?.id` is actually set. Today this is only *incidentally* safe because `clientLoading || pageLoading` gates the whole render (line 93-99) so the canvas can't mount, and thus `config` can't change, until `page` has resolved. But the hook is still constructed with `''` on the render(s) before `page` resolves, and nothing in this file structurally prevents a future edit (e.g. loosening the loading gate, or a refetch that transiently clears `page`) from firing `PATCH /api/v1/crm/client-pages/` (empty path segment) again. Independent of that race: **there is no error handling at all on this mutation** — if the PATCH fails for any reason (network blip, 404, 500), `dirtyRef.current = false` is set unconditionally before the mutate call resolves, so a failed save is treated as flushed and the user's edit is silently lost with zero UI feedback. This is a data-loss risk for a debounced-autosave-only page (there is no manual "Save" button anywhere in this component).
**Fix:**
```ts
saveTimer.current = setTimeout(() => {
  if (!page?.id) return; // don't PATCH against an empty path segment
  dirtyRef.current = false;
  updatePageRef.current.mutate(
    { config: config as unknown as Record<string, unknown> },
    { onError: () => { dirtyRef.current = true; /* surface a save-failed indicator */ } },
  );
}, 1500);
```
Also surface `updatePage.isError` (or similar) in the UI, mirroring the "Couldn't save" pattern already used in `InlineTextField` (see WR-02 — that pattern itself is currently broken too).

## Warnings

### WR-01: `getClientRisk` always returns a hardcoded stub with no linkage to the credit-limit blocking described in CLAUDE.md's core value, and no phase cross-reference

**File:** `apps/api/src/domains/crm/crm.service.ts:149-152`
**Issue:** The project's stated core value is "Dispatchers must never be able to assign a load to a client who is over their credit limit... the risk semaphore is a hard, visible block." `getClientRisk` unconditionally returns `{ status: 'unavailable', utilization_pct: null }` regardless of the client's actual `credit_limit`/`outstanding_balance`, even though those fields are already available on `ClientRecord` and are already used correctly client-side in `records/page.tsx`'s `creditStatus()` helper. Unlike the `importClients` stub two lines below it (which explicitly documents `// Bulk import not yet implemented — lands in Phase 4`), this stub has no comment indicating which phase actually wires it up, making it easy to forget that the "hard, visible block" described in CLAUDE.md is not yet implemented anywhere in this domain.
**Fix:** Add a comment matching the `importClients` stub's convention (e.g. `// TODO: wire to KPI engine credit-risk semaphore — later phase`), and consider deriving `utilization_pct` from the already-available `credit_limit`/`outstanding_balance` now (cheap, correct today) instead of returning `null` for data that already exists.

### WR-02: `flush()` in `InlineTextField` wraps a React Query `.mutate()` call in try/catch, but `.mutate()` never throws synchronously — the catch branch and "Couldn't save" UI are dead code

**File:** `apps/workspaces/src/app/records/[clientId]/page.tsx:191-202`
**Issue:**
```ts
const flush = (next: string) => {
  ...
  setSaveState('saving');
  try {
    onSave(next);
    setSaveState('idle');
  } catch {
    setSaveState('error');
  }
};
```
`onSave` calls `onUpdateClient.mutate({...})`. `useMutation`'s `.mutate()` does not throw synchronously on failure — errors are delivered asynchronously through the mutation's own `onError` callback or `isError`/`error` state, never as an exception at the call site. As written, `setSaveState('saving')` is immediately followed by `setSaveState('idle')` on every call regardless of whether the underlying PATCH actually succeeds, and the `catch` branch is unreachable. The "Couldn't save — try again" text (line 246-248) will never render, giving false confidence that saves are being verified when they aren't.
**Fix:** Drive `saveState` from the mutation's actual async result, e.g. attach per-call callbacks:
```ts
onSave(next); // becomes:
onUpdateClient.mutate({ id: client.id, data: { address: next } }, {
  onError: () => setSaveState('error'),
  onSuccess: () => setSaveState('idle'),
});
```

### WR-03: `NewClientPageModal`'s quick-create flow performs no duplicate-name check before creating a new client

**File:** `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx:75-95`
**Issue:** A user can search for an existing client, find nothing due to a typo/casing mismatch, then use "Create new client" to create a second client record with an equivalent name. `quickCreate` calls `create.mutate(...)` with no check against the already-fetched `clients` list. Since `client_pages` and `client_project_links` are both keyed by `client_id`, an accidental duplicate fragments a customer's history across two separate detail pages with no way to merge them from this UI. This directly undercuts the CRM's purpose of being the canonical client registry (replacing the old ad hoc per-project block).
**Fix:** Before calling `create.mutate(...)`, check `clients` for a case-insensitive near-match on `name` and prompt for confirmation ("A client named X already exists — create anyway?") rather than creating unconditionally.

### WR-04: Client timeline sort compares `occurred_at` strings lexicographically across three heterogeneous date sources without normalizing to a common format

**File:** `apps/api/src/domains/crm/crm.service.ts:107-137`
**Issue:**
```ts
return entries.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));
```
`occurred_at` is populated from `email_messages.received_at`, `invoices.issued_at`, and `kpi_results.period_start` (see `crm.repository.ts` lines 152-184). These are different columns that may be different SQL types (e.g. `period_start` reads like it could be a `DATE` rather than `TIMESTAMPTZ`); `pg` serializes those to different string shapes (`"2026-07-06T10:00:00.000Z"` vs `"2026-07-06"`). Lexicographic `<`/`>` comparison of differently-shaped ISO strings does not reliably reproduce chronological order once the two formats interleave (a `DATE`-only value sorts by its truncated prefix, not by the instant it actually represents relative to same-day timestamped entries).
**Fix:** Parse into real `Date` instances before comparing:
```ts
return entries.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
```

### WR-05: Dashboard silently displays a raw employee UUID if the responsible employee is missing from the team roster

**File:** `apps/workspaces/src/app/records/page.tsx:110-112`
**Issue:**
```ts
const responsibleName = client.responsible_employee_id
  ? teamNameById.get(client.responsible_employee_id) ?? client.responsible_employee_id
  : null;
```
If a client's `responsible_employee_id` refers to a team member no longer in the `useTeam()` result (deactivated/removed), the table falls back to rendering the raw UUID string instead of a human-readable placeholder. This is a real, if minor, UX defect in an admin-facing table.
**Fix:** Fall back to a labeled placeholder instead of the raw ID, e.g. `?? 'Unknown employee'`.

### WR-06: `AddClientModal` and `NewClientPageModal` duplicate the entire "create client" form (state + markup) instead of sharing a component, despite `AddClientModal`'s own header comment stating that extraction's purpose was reuse by future entry points

**File:** `apps/workspaces/src/components/projectPage/AddClientModal.tsx:20-107`, `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx:28-32, 169-206`
**Issue:** `AddClientModal.tsx`'s file header explicitly says it was "extracted from CrmClientsBlock.tsx's inline form so the CRM dashboard (and any future entry point) can reuse the same field set/validation without duplicating the form markup." `NewClientPageModal`, added in this same phase, is exactly such a "future entry point" but instead re-implements its own copy of the 5-field form (`name`/`country`/`vatId`/`limit`/`rate` state plus nearly identical JSX), directly contradicting the stated intent of the earlier extraction. Any future required-field change now has to be made in two places.
**Fix:** Extract the shared field markup into a small presentational component (e.g. `ClientFormFields`) that both modals render, or have `NewClientPageModal`'s create step literally reuse `AddClientModal`'s form body via composition.

## Info

### IN-01: `CrmClientsBlock`'s slash-menu description asserts enforcement behavior ("over-limit clients are blocked from new loads") that isn't implemented by anything in this phase

**File:** `apps/workspaces/src/lib/projectPage/blocks.ts:443-446`
**Issue:** The `crm-clients` block registry entry's user-facing description states over-limit clients "are blocked from new loads." Per WR-01, `getClientRisk` is a stub that returns no real risk data, and nothing in the reviewed file set shows any block reading/enforcing the existing 403 the backend already returns (per the CLAUDE.md constraint that the new semaphore should visually reflect — not duplicate — that existing enforcement). The copy overstates what's true today.
**Fix:** Soften the copy to be phase-accurate, or add a code comment cross-referencing which block/phase is responsible for actually surfacing that block.

### IN-02: `useUpdateClientPage` diverges from every other mutation hook in the file by using `setQueryData` instead of `invalidateQueries`, with no comment explaining the deliberate difference

**File:** `apps/workspaces/src/lib/hooks/useCrm.ts:83-89`
**Issue:** `useCreateClient`, `useUpdateClient`, and `useUpsertClientProjectLink` all call `qc.invalidateQueries(...)` in `onSuccess`. `useUpdateClientPage` instead calls `qc.setQueryData(qk.clientPage(clientId), page)` directly. This is a reasonable optimization (avoids an extra round-trip for a potentially large page-config payload) but breaks the file's otherwise consistent pattern without any comment explaining the divergence, which will read as an inconsistency to future maintainers scanning this file.
**Fix:** Add a one-line comment noting the deliberate use of `setQueryData` to avoid re-fetching the full page config on every autosave.

### IN-03: `uid()` uses `Math.random().toString(36)` for block IDs — informational only, pre-existing helper reused (not introduced) by this phase's two new block kinds

**File:** `apps/workspaces/src/lib/projectPage/blocks.ts:302`
**Issue:** Not part of this phase's diff — flagged only because the two new `client-current-situation`/`client-timeline` block factories (lines 478-486) rely on it. `Math.random().toString(36).slice(2, 10)` is not collision-resistant; a collision would cause silent block-identity confusion in dnd-kit/React reconciliation. No action expected from this phase since the helper predates it.
**Fix:** N/A — out of scope for this phase; noting for awareness only.

### IN-04: `NewClientPageModal.openClientPage` awaits and discards the `crmApi.getClientPage(clientId)` response purely for its get-or-create side effect, without an inline comment at the call site

**File:** `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx:62-73`
**Issue:** The component's file-level header comment explains the overall intent, but the specific call `await crmApi.getClientPage(clientId)` (result discarded) isn't self-explanatory in isolation — a future refactor could easily "clean up" this call as dead code, since its only purpose is to force the backend's idempotent get-or-create to run before the new tab opens.
**Fix:** Add a short inline comment at the call site, e.g. `// result discarded — this call exists only to force get-or-create before opening the tab`.

---

_Reviewed: 2026-07-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
