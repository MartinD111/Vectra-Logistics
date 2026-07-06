---
phase: 03-per-project-client-overrides
plan: 01
subsystem: crm-backend
tags: [crm, projects, access-control, unlink]
dependency-graph:
  requires: []
  provides:
    - "CrmService.assertOwnedProject (private ownership check)"
    - "CrmService.unlinkClientProject"
    - "crmRepository.deleteProjectLink"
    - "DELETE /api/v1/crm/clients/:id/projects/:projectId"
    - "crmApi.unlinkClientProjectLink"
    - "useUnlinkClientProjectLink(clientId)"
  affects:
    - "apps/api/src/domains/crm/crm.repository.ts"
    - "apps/api/src/domains/crm/crm.service.ts"
    - "apps/api/src/domains/crm/crm.controller.ts"
    - "apps/api/src/domains/crm/crm.routes.ts"
    - "apps/workspaces/src/lib/api/crm.api.ts"
    - "apps/workspaces/src/lib/hooks/useCrm.ts"
tech-stack:
  added: []
  patterns:
    - "Cross-domain ownership check (assertOwnedProject) reused from projects.service.ts convention"
    - "Idempotent no-op-delete convention (matches deleteProject/deleteFolder) — 204 unconditional"
key-files:
  created: []
  modified:
    - apps/api/src/domains/crm/crm.repository.ts
    - apps/api/src/domains/crm/crm.service.ts
    - apps/api/src/domains/crm/crm.controller.ts
    - apps/api/src/domains/crm/crm.routes.ts
    - apps/workspaces/src/lib/api/crm.api.ts
    - apps/workspaces/src/lib/hooks/useCrm.ts
decisions: []
metrics:
  duration: "~20 minutes"
  completed: 2026-07-06
---

# Phase 3 Plan 1: Per-Project Client Overrides Backend Gaps Summary

Closed the confirmed V4 Access Control IDOR gap in `crm.service.ts` (cross-tenant `project_id` attach) and built the full unlink vertical slice (repository → service → controller → route → API client → hook) for `DELETE /api/v1/crm/clients/:id/projects/:projectId`.

## What Was Built

### Task 1: Ownership check + repository/service unlink support
- `crm.repository.ts`: added `deleteProjectLink(clientId, projectId, companyId)` — unconditional `DELETE FROM client_project_links WHERE client_id = $1 AND project_id = $2 AND company_id = $3`, modeled on the existing `deleteProject` no-op-delete convention (no row-existence check).
- `crm.service.ts`: imported `projectsRepository` from `../projects/projects.repository`. Added a private `assertOwnedProject(projectId, companyId)` method mirroring `projects.service.ts`'s pattern — throws `AppError(404, 'Project not found')` if the project doesn't exist, `AppError(403, 'Forbidden')` if it belongs to a different company.
- Called `assertOwnedProject` inside `upsertClientProjectLink` right after the existing client-ownership check and before the repository write — this closes the confirmed gap where any authenticated user could attach a client to another company's `project_id`.
- Added public `unlinkClientProject(clientId, projectId, companyId)` that validates both the client and project belong to the company, then deletes the link row.

### Task 2: Full unlink vertical slice
- `crm.controller.ts`: added `unlinkClientProjectLink` handler — delegates to `crmService.unlinkClientProject` and returns 204, matching the 1-3 line handler convention.
- `crm.routes.ts`: added `router.delete('/clients/:id/projects/:projectId', unlinkClientProjectLink)` directly after the existing POST route.
- `crm.api.ts`: added `crmApi.unlinkClientProjectLink(clientId, projectId)` returning `Promise<void>` via `apiFetch(..., 'DELETE')`, matching `projectsApi.remove`'s pattern.
- `useCrm.ts`: added `useUnlinkClientProjectLink(clientId)` mutation hook invalidating the same `qk.projectLinks(clientId)` query key used by `useClientProjectLinks`/`useUpsertClientProjectLink`.

## Verification

No test framework exists project-wide (confirmed in 03-RESEARCH.md/03-VALIDATION.md) — this is manual-UAT-only per established Phase 2 precedent. TypeScript compilation was checked (`npx tsc --noEmit`); the only errors present are pre-existing and unrelated to this change (`redis` module resolution failure in `core/db/redis.ts`, present before this plan's edits — dependencies not installed in this worktree).

Manual smoke test steps (to be run against a live dev server, not executed in this sandboxed worktree):
1. `POST /api/v1/crm/clients/:id/projects` with a same-company `project_id` — expect 200.
2. Repeat with a cross-company/nonexistent `project_id` — expect 403/404, never 200.
3. `DELETE /api/v1/crm/clients/:id/projects/:projectId` on the link from step 1 — expect 204.
4. `GET /api/v1/crm/clients/:id/projects` — confirm the link is gone.
5. Re-`POST` the same `project_id` with no override fields — confirm `is_overridden` is `{ rate: false, responsible_employee: false, notes: false }` (fresh row, D-05 compliance).

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the plan's `<interfaces>` reference code closely; no architectural surprises, no additional bugs found, no scope creep.

## Threat Flags

None — this plan directly implements the two threat-register mitigations (T-03-01, T-03-02) that were already identified in the plan's `<threat_model>`. No new, unaccounted-for surface was introduced.

## Known Stubs

None — this plan is 100% backend/API-surface work with no UI; no stub data paths were introduced.

## Self-Check: PASSED

- FOUND: apps/api/src/domains/crm/crm.repository.ts (deleteProjectLink present)
- FOUND: apps/api/src/domains/crm/crm.service.ts (assertOwnedProject, unlinkClientProject present)
- FOUND: apps/api/src/domains/crm/crm.controller.ts (unlinkClientProjectLink present)
- FOUND: apps/api/src/domains/crm/crm.routes.ts (DELETE route present)
- FOUND: apps/workspaces/src/lib/api/crm.api.ts (unlinkClientProjectLink present)
- FOUND: apps/workspaces/src/lib/hooks/useCrm.ts (useUnlinkClientProjectLink present)
- FOUND commit 6447147 (Task 1)
- FOUND commit ee3e876 (Task 2)
