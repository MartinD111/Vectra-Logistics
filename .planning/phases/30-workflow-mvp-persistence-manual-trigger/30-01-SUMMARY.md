---
phase: 30-workflow-mvp-persistence-manual-trigger
plan: 01
subsystem: workflows
tags: [workflows, postgres, express, react, idempotency, notifications]

requires:
  - phase: 28-security-tenancy-capabilities-foundation
    provides: RequestContext and workflow build/run capabilities
  - phase: 29-event-spine-durable-outbox
    provides: durable event vocabulary with correlation and event identifiers
provides:
  - Tenant-scoped workflow draft, run, and step-log persistence
  - Authenticated workflow CRUD/publish/manual-run API
  - Manual notification-action execution with persisted idempotency protection
  - Workspaces automation dashboard and builder backed by real workflow API state
  - Workflow MVP tests and documentation
affects: [automation-ui, workflow-engine, notifications, durable-events]

tech-stack:
  added: []
  patterns:
    - Raw SQL migration with tenant-scoped repository methods
    - Service-level capability assertions using RequestContext
    - Narrow graph contract validated before save/publish/run

key-files:
  created:
    - database/migrations/027_workflows.sql
    - apps/api/src/domains/workflows/workflows.types.ts
    - apps/api/src/domains/workflows/dto/workflows.dto.ts
    - apps/api/src/domains/workflows/workflows.repository.ts
    - apps/api/src/domains/workflows/workflows.service.ts
    - apps/api/src/domains/workflows/workflows.controller.ts
    - apps/api/src/domains/workflows/workflows.routes.ts
    - apps/api/src/domains/workflows/workflows.service.test.ts
    - apps/workspaces/src/lib/api/workflows.api.ts
  modified:
    - apps/api/src/domains/index.ts
    - apps/workspaces/src/app/automations/page.tsx
    - apps/workspaces/src/app/automations/builder/page.tsx
    - apps/workspaces/src/components/automations/WorkflowBuilder.tsx
    - apps/workspaces/src/components/automations/NodeSidebar.tsx
    - docs/specs/core/event-spine.md
    - docs/specs/core/event-catalog.md
    - docs/architecture/current-state-truth-matrix.md

key-decisions:
  - "Phase 30 keeps the workflow graph deliberately narrow: trigger.manual -> action.notification.create."
  - "Manual run duplicate protection is enforced by unique (tenant_id, workflow_id, idempotency_key)."
  - "Run correlation reuses Phase 29 event vocabulary while run inspection lives in workflow_runs/workflow_run_steps."

patterns-established:
  - "Workflow domain routes use authenticateToken plus RequestContext capability assertions."
  - "Unsupported graph nodes are rejected by backend validation even if a client sends them."
  - "Automation UI treats persisted workflows as the source of truth and only exposes supported MVP nodes."

requirements-completed: [WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-04, WFLOW-05, WFLOW-06]

duration: 2h 15m
completed: 2026-07-15
---

# Phase 30 Plan 01: Workflow MVP Persistence & Manual Trigger Summary

**Persisted workflow drafts and manual notification runs with tenant-scoped logs, idempotency, and real automation UI state**

## Performance

- **Duration:** 2h 15m
- **Started:** 2026-07-15T20:01:07+02:00
- **Completed:** 2026-07-15T22:16:26+02:00
- **Tasks:** 4/4
- **Files modified:** 18

## Accomplishments

- Added `027_workflows.sql` with tenant-scoped `workflows`, `workflow_runs`, and `workflow_run_steps`.
- Mounted `/api/v1/workflows` with list/create/get/update/publish/manual-run/run-detail endpoints.
- Enforced `workflow.build` and `workflow.run` capabilities from RequestContext.
- Implemented backend graph validation for the supported MVP graph only.
- Wired manual runs to `notificationsService.create`, durable run/step logs, correlation/event ids, and database-backed idempotency.
- Replaced automation dashboard/builder mock source of truth with real workflow API state.
- Documented the Phase 30 MVP boundary and `workflow.manual_triggered` event vocabulary.

## Task Commits

1. **Task 1: Add tenant-scoped workflow, run, and step-log persistence** - `f0e7349`
2. **Task 2: Implement workflow validation, CRUD, publish, and manual notification execution** - `770e08d`
3. **Task 3: Replace automation dashboard and builder mocks with real workflow API state** - `72410cd`
4. **Task 4: Add regression coverage and durable workflow documentation** - `68e3dea`

## Verification

- `rg -n "CREATE TABLE IF NOT EXISTS workflows|workflow_runs|workflow_run_steps|idempotency|correlation|event_id|tenant_id" database/migrations/027_workflows.sql apps/api/src/domains/workflows` - passed.
- `rg -n "mockWorkflows|workflows.api|manual-runs|workflow_runs|correlation|idempotency" apps/workspaces/src/app/automations apps/workspaces/src/components/automations apps/workspaces/src/lib/api` - passed; no `mockWorkflows` remains.
- `rg -n "manual trigger|notification action|idempotency|workflow.run|workflow.build|workflow run" docs apps/api/src/domains/workflows` - passed.
- `cd apps/api && npm test -- --test-name-pattern="workflow|notification|capability|idempotency"` - passed, 126/126.
- `cd apps/api && npx tsc --noEmit -p tsconfig.json` - passed.
- `npx tsc --noEmit -p apps/workspaces/tsconfig.json` - passed.
- `npm run -w apps/workspaces lint` - failed on pre-existing unrelated `react/no-unescaped-entities` errors in billing/company/how-it-works pages; Phase 30 files did not add lint errors.

## Decisions Made

- Kept the MVP graph to exactly one manual trigger, one notification action, and one edge between them.
- Made publish require a valid graph and active status before manual runs can execute.
- Used generated idempotency keys when the client omits one, but preserved client-provided keys for retry/double-click protection.
- Exposed unsupported frontend nodes by removal rather than disabled placeholders so the builder cannot advertise rejected actions.

## Deviations from Plan

None - plan executed within the intended MVP boundary.

## Issues Encountered

- Zod v4 requires `z.record(keySchema, valueSchema)`; fixed the DTO record schema during verification.
- Workspaces lint remains blocked by unrelated existing errors outside Phase 30 files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 30 proves the durable workflow foundation with persisted drafts, manual notification runs, and inspectable logs. Future phases can build connector actions, event subscriptions, scheduling, retries/workers, and richer run history on top of this contract.

---
*Phase: 30-workflow-mvp-persistence-manual-trigger*
*Completed: 2026-07-15*
