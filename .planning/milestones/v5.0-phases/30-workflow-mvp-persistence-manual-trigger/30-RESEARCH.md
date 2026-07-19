# Phase 30 Research: Workflow MVP Persistence & Manual Trigger

**Researched:** 2026-07-15
**Status:** Complete

## Phase Boundary

Phase 30 should turn the existing Workspaces automation surface from mock UI into a durable MVP:

- persist workflow drafts server-side with tenant scope, version/status, graph JSON, and audit metadata
- load/save real workflows from the automation list and builder
- manually run one supported workflow shape containing a notification action
- persist workflow runs and step logs with attempt, timestamp, error, correlation, and event identifiers
- reject unsupported/capability-denied triggers/actions before publish or run
- protect duplicate manual triggers with a persisted idempotency key

It should not become a full connector platform, scheduler, event subscription engine, or generalized workflow orchestrator yet.

## Existing Surfaces

- `apps/workspaces/src/app/automations/page.tsx` is a mock-only list with hardcoded workflow rows and a non-functional Run Now button.
- `apps/workspaces/src/app/automations/builder/page.tsx` stores only the workflow name in local React state; Save and Publish buttons are presentational.
- `apps/workspaces/src/components/automations/WorkflowBuilder.tsx` stores nodes in local state with a fixed starter trigger.
- `apps/workspaces/src/components/automations/NodeSidebar.tsx` exposes broad demo trigger/action options, most of which are not safe to support in the MVP.
- `apps/api/src/domains/workspace/automation.service.ts` is legacy shipment communication generation, not workflow persistence/execution.
- `apps/api/src/domains/index.ts` is the canonical DDD route mount point for a new `/api/v1/workflows` domain.
- `apps/api/src/core/capabilities/index.ts` already exposes `workflow.build` and `workflow.run`.
- `apps/api/src/core/events/outbox.ts` and `database/migrations/026_event_outbox.sql` provide the Phase 29 durable event contract and correlation vocabulary, but no workflow run storage.
- `apps/api/src/domains/notifications/*` already provides a simple durable notification action target with realtime delivery.

## Technical Approach

### Data Model

Add `database/migrations/027_workflows.sql` with idempotent raw SQL:

- `workflows`: tenant-scoped workflow drafts/versions, status, graph JSON, validation metadata, created/updated audit fields.
- `workflow_runs`: one durable run record per manual trigger attempt, with status, trigger type, idempotency key, correlation id, event id, started/completed timestamps, and error text.
- `workflow_run_steps`: ordered step logs with node/action identity, status, attempt count, started/completed timestamps, error text, and output JSON.
- unique index on `(tenant_id, idempotency_key)` or equivalent to prevent duplicate manual trigger rows.
- tenant/status/recent-run indexes for list and detail pages.

### Backend Domain

Create `apps/api/src/domains/workflows/` using the existing controller/service/repository/routes/dto pattern:

- DTOs should validate graph shape with Zod before persistence and before execution.
- The MVP supported graph should be intentionally narrow: one manual trigger plus one notification action.
- `workflow.build` gates create/update/publish/save paths.
- `workflow.run` gates manual trigger paths.
- Repository methods must always scope by `tenant_id`.
- Manual trigger execution should create a run and step logs transactionally enough that failure is inspectable.

### Manual Execution

For the MVP, the notification action can call `notificationsService.create` for the authenticated user or a validated target user. This makes the action real, durable, and observable without introducing external connector dependencies.

Execution should record:

- run started/completed/failed status
- one step row for the notification action
- attempts and retry ceiling
- correlation id from request context or generated UUID
- event id if the implementation emits a workflow-specific durable event through the outbox, otherwise `NULL` with correlation still present

### Frontend

Add `apps/workspaces/src/lib/api/workflows.api.ts` and React Query usage in the automation pages:

- dashboard lists real workflows, statuses, last run, and success/failure summary
- builder can create/load/save draft graph JSON
- palette should disable or hide unsupported MVP nodes so validation matches backend truth
- Run Now should call manual trigger and link to a run detail view
- run detail route should display durable run and step logs

## Risks and Guardrails

- Do not reuse the legacy `workspace/automation.service.ts` as the workflow engine; its existing shipment-message responsibilities are unrelated.
- Do not hand-roll broad orchestration. Support only the graph shapes Phase 30 promises.
- Do not trust frontend node labels. Backend validation must enforce supported trigger/action kinds and capability checks.
- Do not rely on browser state for workflow identity or graph state.
- Do not create a second event-spine contract. Use Phase 29 correlation/outbox vocabulary and document any workflow events added.

## Suggested Verification

- API tests for tenant-scoped CRUD, graph validation, capability denial, manual run idempotency, and persisted step logs.
- Frontend typecheck/build plus targeted tests or smoke checks for save/load/run flows where available.
- Grep checks proving mock workflow arrays no longer drive the dashboard as the primary data source.

## Research Complete

Phase 30 can be implemented as one vertical MVP plan covering schema, backend domain, frontend wiring, manual notification execution, idempotency, and run-log inspection.
