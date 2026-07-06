---
phase: 02-crm-dashboard-navigation-client-detail
plan: 02
subsystem: frontend-crm-dashboard
tags: [nav, dashboard, crm, workspaces]
dependency_graph:
  requires: []
  provides:
    - "/records CRM dashboard page (full-page client table, search, over-limit filter, add-client modal, new-tab row nav)"
    - "AddClientModal shared component"
    - "Sidebar 'CRM' nav label"
  affects:
    - "Plan 03 (client detail page): consumes the /records/{clientId} link target this plan wires but does not build"
tech_stack:
  added: []
  patterns:
    - "Client-side search + boolean filter composition (AND) over useClients() data"
    - "Shared modal component extraction to avoid drift between CrmClientsBlock's inline form and the new dashboard"
key_files:
  created:
    - apps/workspaces/src/app/records/page.tsx
    - apps/workspaces/src/components/projectPage/AddClientModal.tsx
  modified:
    - apps/workspaces/src/components/layout/WorkspaceSidebar.tsx
decisions:
  - "Reused useTeam() to resolve responsible_employee_id -> 'First Last' display name on the dashboard table, since the hook was trivially available (per plan's conditional guidance)"
metrics:
  duration: "~25 minutes"
  completed: 2026-07-06
---

# Phase 2 Plan 2: CRM Dashboard, Navigation Rename & Shared Add-Client Modal Summary

Renamed the sidebar's dormant "Records" slot to "CRM" and built the full-page `/records` dashboard — a bordered client table (name, country, credit-status dot+percentage badge, responsible employee) with client-side name search, an "over limit only" toggle, and a shared `AddClientModal` extracted from `CrmClientsBlock`'s inline form, with row clicks opening `/records/{clientId}` in a new tab for Plan 03's detail page to fill in.

## What Was Built

**Task 1 — Sidebar rename + AddClientModal extraction**
- `WorkspaceSidebar.tsx`: `ITEMS` entry `name: 'Records'` → `name: 'CRM'`, href (`/records`) and module gate (`records`) untouched.
- New `apps/workspaces/src/components/projectPage/AddClientModal.tsx`: standalone modal (`{ open, onClose }` props) reusing `CrmClientsBlock.tsx`'s exact field set (name, country select defaulting `'DE'`, VAT ID, credit limit defaulting `'10000'`, default rate) and the same `COUNTRIES` list. Uses `useCreateClient()`; on success resets fields and calls `onClose()`. Modal shell: `fixed inset-0 z-40 bg-black/40` backdrop (click closes), `saas-card max-w-md w-full mx-4` surface, `X` icon close button. `CrmClientsBlock.tsx` was left untouched, per plan instructions.

**Task 2 — `/records` CRM dashboard page**
- New `apps/workspaces/src/app/records/page.tsx` (client component). Page heading "CRM Dashboard" (`text-3xl font-semibold`). Toolbar: search input (280px, placeholder "Search clients by name…"), "Over limit only" checkbox toggle, "Add client" primary button opening `AddClientModal`.
- Data: `useClients()` for the client list, `useTeam()` to build an id→"First Last" name map for the Responsible-employee column (falls back to the raw id if not found in the team list, and to italic "Unassigned" text when `responsible_employee_id` is null).
- Table: flatter bordered `<table>` (not card grid) with columns Name, Country, Credit status, Responsible employee in that fixed order. Credit-status cell uses the exact 3-tier color logic from `CreditBar` (`emerald`/`amber`/`red`) condensed to a colored dot + percentage.
- Row click: `window.open('/records/{id}', '_blank', 'noopener,noreferrer')` — explicitly not `crossAppUrl`, matching RESEARCH.md's correction that this is a same-app new-tab navigation.
- Loading state: `Loader2` spinner + "Loading…" text. Empty state (zero clients): `Building2` icon + "No clients yet" heading + Copywriting Contract body copy + inline "Add client" CTA. Empty state (zero results after filtering): "No clients match your search." text.
- Filtering: client-side, `name.toLowerCase().includes(search.toLowerCase())` AND (`overLimitOnly` ? `outstanding_balance >= credit_limit` : true), composed with `useMemo`.

## Verification

- `npx tsc --noEmit` passed with no errors after both tasks.
- Confirmed via grep: `page.tsx` contains `useClients`, `window.open`, `AddClientModal`, "Search clients by name", "Over limit only"; does not import `crossAppUrl`.
- Confirmed `WorkspaceSidebar.tsx` contains `name: 'CRM'`, no longer contains `name: 'Records'`, and still contains `href: '/records'` and `module: 'records'`.
- No dev server was started for manual browser verification (no test framework in repo per RESEARCH.md; this is consistent with the plan's documented "MISSING — manual" verification note). TypeScript compilation is the automated check available in this repo for frontend changes.

## Deviations from Plan

None — plan executed exactly as written, including the conditional `useTeam()` reuse for the responsible-employee display name, which the plan explicitly called out as available and preferred over rendering a raw id.

## Requirements Coverage

- NAV-01 (rename sidebar to CRM): satisfied.
- NAV-02 (row click opens detail page in new tab): satisfied at the link-wiring level; target route `/records/[clientId]` is built in Plan 03 (Wave 2) and will currently 404, as expected per this plan's scope.
- CLI-01/02/03 (dashboard-glance client info + add-client): satisfied at the dashboard level (columns surface country/credit-status/responsible-employee; full field editing lands on Plan 03's detail page).

## Self-Check: PASSED

- FOUND: apps/workspaces/src/app/records/page.tsx
- FOUND: apps/workspaces/src/components/projectPage/AddClientModal.tsx
- FOUND: apps/workspaces/src/components/layout/WorkspaceSidebar.tsx (modified)
- FOUND commit cbd1ddd (Task 1)
- FOUND commit 6c3dc25 (Task 2)
