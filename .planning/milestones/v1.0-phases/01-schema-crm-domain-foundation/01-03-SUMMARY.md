---
phase: 01-schema-crm-domain-foundation
plan: 03
subsystem: ui
tags: [react-query, nextjs, crm, typescript]

# Dependency graph
requires:
  - phase: 01-schema-crm-domain-foundation (plan 02)
    provides: "Dedicated crm API domain at apps/api/src/domains/crm/, mounted at /api/v1/crm/*, client CRUD + project-link override endpoints"
provides:
  - "apps/workspaces/src/lib/api/crm.api.ts: typed fetch wrappers (crmApi) for /api/v1/crm/clients endpoints"
  - "apps/workspaces/src/lib/hooks/useCrm.ts: React Query hooks (useClients, useClient, useCreateClient, useUpdateClient, useClientProjectLinks, useUpsertClientProjectLink) with distinct 'crm-clients' cache namespace"
  - "CrmClientsBlock.tsx now sources client data from the crm domain instead of billing, with zero behavioral change"
affects: [02-crm-dashboard-detail-pages, 03-project-overrides, 04-excel-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frontend API wrapper mirrors billing.api.ts pattern exactly: apiFetch import + BASE const + object export of typed fetch functions"
    - "React Query hook file mirrors useBilling.ts pattern: qk key-factory object, useQuery/useMutation, useAuth() gating via enabled: !!user?.company_id"
    - "Distinct query-key namespace ('crm-clients' vs 'billing-clients') keeps caches from colliding while both hooks coexist during the domain migration"

key-files:
  created:
    - apps/workspaces/src/lib/api/crm.api.ts
    - apps/workspaces/src/lib/hooks/useCrm.ts
  modified:
    - apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx

key-decisions:
  - "useBilling.ts and billing.api.ts left completely untouched — they still serve invoice/settlement flows (VAT evaluator, invoice board) elsewhere in the app; only CrmClientsBlock's client-data consumer was swapped to the new crm domain"
  - "useCrm.ts additionally exposes useClient, useUpdateClient, useClientProjectLinks, useUpsertClientProjectLink beyond the plan's minimum useClients/useCreateClient, matching the plan's own interface spec so Phase 2 (dashboard/detail pages) has a ready-made hook surface instead of needing another pass"

patterns-established:
  - "CRM frontend data access: crm.api.ts (fetch wrappers) -> useCrm.ts (React Query hooks) -> component, mirroring the existing billing.api.ts/useBilling.ts split"

requirements-completed: [API-02]

# Metrics
duration: 6min
completed: 2026-07-05
---

# Phase 01 Plan 03: Frontend CRM Domain Swap Summary

**Swapped CrmClientsBlock.tsx's client-data source from the `billing` domain to a new dedicated `crm.api.ts`/`useCrm.ts` pair backed by `/api/v1/crm`, with zero behavioral change to the existing client list/credit-bar UI.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-05T08:47:00Z
- **Completed:** 2026-07-05T08:53:26Z
- **Tasks:** 3/3 complete
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Created `crm.api.ts` mirroring `billing.api.ts`'s structure, exposing `crmApi` typed fetch wrappers against `/api/v1/crm/clients*` endpoints (CRUD, project-link overrides, email/risk stubs)
- Created `useCrm.ts` mirroring `useBilling.ts`'s hook pattern, exposing `useClients`/`useCreateClient` (drop-in replacements) plus `useClient`, `useUpdateClient`, `useClientProjectLinks`, `useUpsertClientProjectLink` for Phase 2+
- Swapped `CrmClientsBlock.tsx`'s two import lines from `useBilling`/`billing.api` to `useCrm`/`crm.api` — no other line in the file changed
- Confirmed zero new TypeScript errors across the entire `apps/workspaces` app after all three changes
- Confirmed `useBilling.ts`/`billing.api.ts` remain byte-identical (untouched) and their `'billing-clients'` cache key is distinct from `useCrm.ts`'s `'crm-clients'` key

## Task Commits

Each task was committed atomically:

1. **Task 1: Create crm.api.ts** - `72e638b` (feat)
2. **Task 2: Create useCrm.ts hook** - `045f7c9` (feat)
3. **Task 3: Swap CrmClientsBlock.tsx to useCrm and verify no regression** - `28f632d` (feat)

**Plan metadata:** (this commit, made by orchestrator per plan instructions — STATE.md/ROADMAP.md not touched by this executor)

## Files Created/Modified
- `apps/workspaces/src/lib/api/crm.api.ts` - Typed fetch wrappers (`crmApi`) for client CRUD, project-link overrides, email/risk stubs against `/api/v1/crm`
- `apps/workspaces/src/lib/hooks/useCrm.ts` - React Query hooks (`useClients`, `useClient`, `useCreateClient`, `useUpdateClient`, `useClientProjectLinks`, `useUpsertClientProjectLink`) with `'crm-clients'` cache namespace
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` - Two import lines changed (`useBilling`→`useCrm`, `billing.api`→`crm.api`); all rendering/form/credit-bar logic unchanged

## Decisions Made
- Kept `useBilling.ts`/`billing.api.ts` completely unmodified — they remain the correct source for invoice/VAT/settlement flows; only the CRM client-list consumer moved to the new domain
- Included the full hook surface from the plan's `<interfaces>` spec (project-link hooks, `useClient`, `useUpdateClient`) rather than only the minimum `useClients`/`useCreateClient`, since the plan's own action block specified them and Phase 2 will need them immediately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Acceptance criteria in the plan stated `CrmClientsBlock.tsx` should remain "118 lines" after the swap; the actual pre-existing file was 117 lines both before and after the two-line replacement (line count unchanged by the edit, just a differing baseline than the plan's estimate). Confirmed via `git diff --stat` that only 2 lines changed (2 insertions, 2 deletions) — no regression, this is a documentation estimate discrepancy in the plan, not an execution issue.

## User Setup Required

None - no external service configuration required. Both new files call the already-mounted `/api/v1/crm` endpoints from Plan 02.

## Next Phase Readiness
- `CrmClientsBlock.tsx` is fully decoupled from `billing` and sources all client data through `crm.api.ts`/`useCrm.ts`.
- `useCrm.ts` already exposes `useClient`, `useClientProjectLinks`, and `useUpsertClientProjectLink`, so Phase 2 (CRM dashboard + client detail pages) and later per-project override work can consume these hooks directly without another API-wiring pass.
- `useBilling.ts`/`billing.api.ts` remain intact for invoice/VAT/settlement components elsewhere in the app.
- No blockers carried forward from this plan. Phase 01 (schema-crm-domain-foundation) is now fully executed across all 3 plans.

---
*Phase: 01-schema-crm-domain-foundation*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: apps/workspaces/src/lib/api/crm.api.ts
- FOUND: apps/workspaces/src/lib/hooks/useCrm.ts
- FOUND: apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx (modified)
- FOUND: 72e638b (Task 1 commit)
- FOUND: 045f7c9 (Task 2 commit)
- FOUND: 28f632d (Task 3 commit)
