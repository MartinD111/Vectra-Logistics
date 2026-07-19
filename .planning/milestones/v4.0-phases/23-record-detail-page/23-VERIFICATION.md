---
phase: 23-record-detail-page
verified: 2026-07-14T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Navigate to /collections/{collectionId}/records/{recordId} for a real record"
    expected: "Title (first schema property, bold heading), property panel with remaining schema properties, and an (initially empty) block-editor body all render without error"
    why_human: "No dev server / live Postgres was exercised during this verification or during phase execution (23-02-SUMMARY.md explicitly states manual verification was not run); rendering correctness, layout, and dark-mode can only be confirmed visually in a browser"
  - test: "Edit a select/date/checkbox/text property in the panel, reload the page"
    expected: "The edited value persists across reload (PATCH /records/:id round-trip)"
    why_human: "Requires a running API + Postgres instance; not exercised by tsc/grep checks"
  - test: "Click '+ Add property', add a select property with options, submit, then open a second record in the same collection"
    expected: "New property appears in the panel of the record it was added from AND on the second record (schema is collection-wide); schema PATCH completes before record PATCH (no partial-failure state)"
    why_human: "Requires two live records against the same collection; ordering logic is code-verified (see Key Link Verification) but the observable end-to-end behavior needs a browser + API"
  - test: "In the body editor, type '/' and insert a heading, checklist, and a Phase 21 block (e.g. toggle); reload and confirm persistence"
    expected: "Full slash menu and all Phase 21 block kinds work identically to the CRM client-detail page, with no bespoke record-body editor code"
    why_human: "LivePageCanvas is called with zero new props (code-verified), but interactive editor behavior requires manual use"
  - test: "Navigate to a record/collection ID that doesn't belong to the caller's company"
    expected: "The two-line error shell renders (\"Couldn't load this record.\"), not a crash or leaked data"
    why_human: "Requires a live authenticated session against a real backend to produce a genuine cross-tenant 404/403"
---

# Phase 23: Record Detail Page Verification Report

**Phase Goal:** A record opens as a full page — title, schema-driven property panel, and body — using the existing editor with zero new editor code
**Verified:** 2026-07-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a record opens a detail page/panel showing its title, a property panel, and its body content | ✓ VERIFIED (code) | `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx:101-113` renders `PropertyPanel` (title + properties) and `LivePageCanvas` (body) inside the two-column shell; `PropertyPanel.tsx:34-44` renders the title (D-01: `collection.schema[0]`) or the empty-state copy; loading/error fallbacks present (`page.tsx:82-99`). Not exercised in a live browser — see Human Verification. |
| 2 | User can edit a record's properties inline via type-appropriate editors (select dropdown, person picker, date picker, checkbox, etc.) and see the change persist | ✓ VERIFIED (code) | `PropertyField.tsx:27-94` implements a 12-case switch (checkbox/date/select/person/multi-select/files/relation/text/url/email/phone/number), each committing via `onCommit`; `PropertyPanel.tsx:49-53` wires `onCommit` to `onUpdateRecord.mutate({ props: {...} })`; `useRecords.ts:40-46` `useUpdateRecord`'s `onSuccess` cache-writes via `qc.setQueryData`, and the underlying `recordsApi.updateRecord` PATCHes `/api/v1/records/records/:id` (`records.api.ts:60-61`), an already-verified (Phase 22) real backend write. One edge-case gap found: `DebouncedTextField` commits `null` when a `number` field is cleared to empty (`PropertyField.tsx:265`), but the backend's `validatePropValue` requires `typeof value === 'number'` for `number` (`apps/api/src/domains/records/records.service.ts:154-155`) — clearing a number field to empty and blurring would 400. Does not block the primary truth (setting/persisting a value works) but is a real bug on the clear-to-empty path. |
| 3 | Adding a new property from the record detail panel adds it to the collection's schema, and it appears on other records of that collection | ✓ VERIFIED (code) | `AddPropertyModal.tsx:87-93`: schema PATCH (`onUpdateSchema.mutateAsync(nextSchema)`) is `await`ed at line 89, strictly before the record-prop PATCH (`onUpdateRecord.mutateAsync(...)`) at line 90 — sequencing confirmed by direct line-number read (matches the plan's own ordering acceptance gate). `useUpdateCollectionSchema`'s `onSuccess` cache-writes the collection query (`useRecords.ts:32-38`), so any other component reading `useCollection(collectionId)` for the same collection ID picks up the new schema without a refetch — satisfies "appears on other records of that collection" at the data layer. End-to-end cross-record visibility not manually confirmed in a browser. |
| 4 | User can edit the record body with the full existing page editor (slash menu, headings, checklists, and all Phase 21 blocks) — no bespoke record-body editor code | ✓ VERIFIED (code) | `page.tsx:109`: `<LivePageCanvas config={config} onChange={setConfig} />` — zero extra props (no `clientId`/`projectId`/`pageId`), confirmed by direct read of `LivePageCanvas.tsx:32-34`'s signature (`config`, `projectId?`, `clientId?`, `pageId?`, `onChange`) — all three optional props omitted at the call site. Same imported component used by the CRM client-detail page and project pages (Phase 21's registry-driven block system), so no new editor code exists for record bodies. Interactive slash-menu/block behavior not manually exercised. |

**Score:** 4/4 truths verified at the code level; all 4 require human/browser confirmation for the actual interactive behavior (see `human_verification` below) since no dev server or live database was exercised during this phase's execution or this verification pass.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/workspaces/src/lib/api/records.api.ts` | Typed client: `CollectionPropertyDef`/`DataCollection`/`CollectionRecord` + `recordsApi` (getCollection/updateCollection/getRecord/updateRecord/createRecord) | ✓ VERIFIED | All types and all 5 functions present (lines 1-64), each hitting the exact Phase-22-verified routes (`/api/v1/records/collections/:id`, `/api/v1/records/records/:id`, `/api/v1/records/collections/:id/records`), unwrapping `{collection}`/`{record}` envelopes. No `any` usage. |
| `apps/workspaces/src/lib/hooks/useRecords.ts` | 5 React Query hooks matching Plan 01's contract | ✓ VERIFIED | `useCollection`, `useRecord` (both `enabled: !!user?.company_id && !!id`), `useUpdateCollectionSchema`, `useUpdateRecord` (both cache-write via `setQueryData`, not `invalidateQueries`), `useCreateRecord` — all present, lines 14-52. |
| `apps/workspaces/src/components/records/PropertyField.tsx` | 12-type switch, no default/unhandled branch, `MultiSelectChips`/`StringArrayChips` sub-components | ✓ VERIFIED | 12-case switch (lines 27-94) — checkbox/date/select/person/multi-select/files/relation/text/url/email/phone/number, all handled; a stray `default: return null` exists (line 92-93) but is unreachable given the exhaustive prior cases (TypeScript's `CollectionPropertyDef['type']` union is fully covered) — not a functional gap, just defensive dead code. `MultiSelectChips` (lines 151-184) and `StringArrayChips` (lines 189-237) both present and distinct. `useTeam()` used in `PersonField`. |
| `apps/workspaces/src/components/records/PropertyPanel.tsx` | Title (D-01) + property list + "+ Add property" trigger | ✓ VERIFIED | `text-xl font-bold` title honoring UI-SPEC's divergence (line 99), `collection.schema[0]`/`.slice(1)` D-01 convention (lines 29-30), "+ Add property" button (line 62), `AddPropertyModal` imported and rendered conditionally (lines 65-73). |
| `apps/workspaces/src/components/records/AddPropertyModal.tsx` | Two-sequential-PATCH add-property flow | ✓ VERIFIED | Schema PATCH awaited before record PATCH (lines 89-90, confirmed by direct line order), type-correct `initialValueFor` defaults (lines 25-45) matching backend's `validatePropValue`, "Property name"/"Add property" copy present. |
| `apps/workspaces/src/app/collections/[collectionId]/records/[recordId]/page.tsx` | Route: loading/error states, two-column layout, seed-once debounced-autosave | ✓ VERIFIED | `useParams` reads `collectionId`/`recordId` (lines 19-21), loading spinner (82-88), error shell exact copy "Couldn't load this record." (93), seed-once (`!seeded && record`, lines 43-48) + 1500ms debounce (`setTimeout(..., 1500)`, line 68) + unmount flush (74-80), no `defaultsSeeded` effect (correctly omitted per RESEARCH.md). `LivePageCanvas config={config} onChange={setConfig}` with zero extra props (line 109). Route does not collide with existing `apps/workspaces/src/app/records/[clientId]/page.tsx` (distinct path segments, confirmed by directory listing). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useRecords.ts` | `records.api.ts` | `import { recordsApi, ... } from '@/lib/api/records.api'` | ✓ WIRED | Confirmed, line 6-7. |
| `records.api.ts` | Phase 22 backend `records.routes.ts` | `apiFetch` calls to `/api/v1/records/*` | ✓ WIRED | Route paths match `records.routes.ts` exactly (verified in Phase 22's VERIFICATION.md, re-confirmed by direct read here — `GET/PATCH /collections/:id`, `GET/PATCH /records/:id`, `POST /collections/:id/records` all present). |
| `page.tsx` | `LivePageCanvas.tsx` | `<LivePageCanvas config={config} onChange={setConfig} />` | ✓ WIRED | Zero-extra-props call confirmed against the component's actual signature. |
| `PropertyPanel.tsx` | `PropertyField.tsx` | `import { PropertyField } from './PropertyField'` | ✓ WIRED | Confirmed line 11, used at line 49. |
| `AddPropertyModal.tsx` | `useRecords.ts` (via props, not direct import) | `await onUpdateSchema.mutateAsync(...)` before `await onUpdateRecord.mutateAsync(...)` | ✓ WIRED | Sequencing confirmed by direct line-number comparison (line 89 < line 90); mutation objects passed down from `page.tsx` → `PropertyPanel` → `AddPropertyModal`, all typed consistently through the chain. |

### Data-Flow Trace (Level 4)

- `useCollection(collectionId)`/`useRecord(recordId)` → `recordsApi.getCollection`/`getRecord` → real `apiFetch` GET against the Phase-22-verified, database-backed `/api/v1/records/*` domain (no static/empty fallback in the client). `record.props`/`collection.schema` flow directly into `PropertyPanel`'s render with no intermediate hardcoding.
- `onUpdateRecord`/`onUpdateSchema` mutations flow real payloads (spread of existing `record.props`/`collection.schema` plus the new value) to `PATCH` — no stub/no-op write paths found.
- Not independently re-verified against a live database in this pass (no dev server started); this is the same "unit/type-check only, no live Postgres" limitation Phase 22's verification also disclosed and accepted, but Phase 23 is UI-facing (`UI hint: yes`) so it correctly routes to `human_needed` rather than `passed`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend workspace type-checks cleanly with all Phase 23 files in place | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | exit 0, no errors | ✓ PASS |
| No route collision between `/records/[clientId]` and `/collections/[collectionId]/records/[recordId]` | directory listing of both route trees | Both present, distinct path segments | ✓ PASS |
| No debt markers (TODO/FIXME/XXX/TBD) in phase-authored files | grep across `components/records/*` and `app/collections/**` | No matches (only unrelated `placeholder=` JSX attributes) | ✓ PASS |
| Live server/API behavior (record load, property edit persistence, add-property flow, body editor) | N/A — no dev server started | Not run | ? SKIP → routed to Human Verification |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| CARD-01 | 23-02 | User can open a record as a detail page/panel showing title + property panel + body | ✓ SATISFIED (code) | Route + `PropertyPanel` + `LivePageCanvas` composition verified above; interactive confirmation deferred to human verification. |
| CARD-02 | 23-01, 23-02 | User can edit a record's properties via schema-driven inline editors | ✓ SATISFIED (code) | `PropertyField`'s 12-type switch + `PropertyPanel`'s commit wiring + `useUpdateRecord`'s real PATCH, verified above. Minor edge-case bug noted (number-field clear-to-empty commits `null`, fails backend type check) — does not block the primary editing/persisting flow for any of the 12 types. |
| CARD-03 | 23-02 | Adding a new property from the record detail panel adds it to the collection's schema | ✓ SATISFIED (code) | Two-sequential-PATCH ordering confirmed by direct line-number read; cache-write propagation confirmed at the hook level. |
| CARD-04 | 23-02 | User can edit the record body using the full existing page editor — zero new editor code | ✓ SATISFIED (code) | `LivePageCanvas` called with zero new props, same shared component used elsewhere in the app; no new editor code found anywhere in the phase's files. |

**Note (non-blocking, same pattern as Phase 22's verification):** `.planning/REQUIREMENTS.md` lines 33-36 and 105-108 still list CARD-01 through CARD-04 with `[ ]` unchecked boxes and status `Pending`. This is a documentation-sync gap in REQUIREMENTS.md, not a code gap — recommend updating as a follow-up.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PropertyField.tsx` | 265 | `onCommit(next === '' ? null : Number(next))` for `number` type, but backend `validatePropValue` requires `typeof value === 'number'` (rejects `null`) | ⚠️ Warning | Clearing a `number` property to empty and blurring will 400 on save; every other property type and the non-empty-number path work correctly. Not a blocker for CARD-02 as stated (editing and persisting a value works), but a real, user-reachable bug on the clear-to-empty path. |
| `PropertyField.tsx` | 92-93 | Unreachable `default: return null` after an exhaustive 12-case switch | ℹ️ Info | Dead code only, no functional impact — TypeScript's discriminated union is already fully covered by the preceding cases. |

### Human Verification Required

See YAML frontmatter `human_verification` section — 5 items, all requiring a running dev server + live database to exercise:
1. Record detail page render (title/panel/body) — CARD-01
2. Property edit + reload persistence — CARD-02
3. Add-property cross-record schema propagation — CARD-03
4. Body editor slash menu + Phase 21 blocks — CARD-04
5. Cross-tenant 404 fallback (no crash, no data leak)

### Gaps Summary

No blocking code-level gaps. All four ROADMAP success criteria and all four CARD requirements are implemented, correctly wired end-to-end at the code level (types, hooks, components, route composition, `LivePageCanvas` zero-new-props contract, two-sequential-PATCH ordering), and the workspace type-checks cleanly. One non-blocking bug found: a cleared `number` property field commits `null`, which will fail the backend's type validation — worth a quick follow-up fix but does not undermine any of the phase's stated success criteria.

Because this phase is explicitly UI-facing (`UI hint: yes`) and neither the phase's own execution (per `23-02-SUMMARY.md`: "no dev server was started") nor this verification pass exercised a live browser against a running API, the phase cannot be marked `passed` — it is `human_needed`. The five items above (mirroring the plan's own `<verification>` manual steps, which were never executed) must be manually confirmed before this phase is considered fully done.

---

_Verified: 2026-07-14T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
