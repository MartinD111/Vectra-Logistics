# Phase 29: Event Spine & Durable Outbox - Research

**Researched:** 2026-07-15
**Domain:** Durable domain events, tenant-aware outbox schema, transactional pilot mutation, dispatcher reliability, workflow-facing event contract
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Event Contract Boundary
- **D-01:** The durable outbox event is the primary contract for this phase.
- **D-02:** `activity_events` remains a derived analytics/history read model.
- **D-03:** Domain state and durable events should be written transactionally; analytics/history should derive from that path rather than become a second canonical write path.
- **D-04:** The phase proves the pattern with one production-grade pilot, not a broad migration.
- **D-05:** The contract uses a strict outer envelope with domain-owned payloads.

### Pilot Mutation Choice
- **D-06:** Use a clean architectural pilot rather than a messy operational flow.
- **D-07:** Prefer a mutation that is already transactional today.
- **D-08:** The preferred pilot is records collection creation via `createCollectionWithDefaultView`.
- **D-09:** The emitted event must still be a readable business fact.
- **D-10:** Emit one composite outcome event for the collection creation flow.

### Dispatch / Publish Reliability
- **D-11:** Ship a production-safe baseline for dispatch, not a demo-only loop.
- **D-12:** Duplicate protection should be database-enforced around durable identity and publication state.
- **D-13:** Retries are bounded and end in an observable terminal failed state.
- **D-14:** Operator visibility comes from database status/timestamps/retry metadata plus docs, not a new UI/API.

### Consumer Shape for v1
- **D-15:** Phase 30 workflow execution is the first-class consumer.
- **D-16:** Events stay domain-first even while being workflow-friendly.
- **D-17:** The event catalog must document envelope guarantees, payload versioning, delivery semantics, and the emitted business fact.
- **D-18:** Future integrations are secondary reuse, not equal v1 guarantees.

### Claude's Discretion
- Exact envelope field names, as long as the roadmap-required metadata is explicit and versioned.
- Exact dispatcher implementation shape, as long as claim/publication/idempotency guarantees remain database-anchored.
- Exact retry/backoff intervals, as long as they are bounded and terminal failure is visible.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVENT-01 | A versioned event envelope is defined with tenant, actor, object type/id, project id when applicable, causation id, correlation id, payload version, and payload | The repo has `recordEvent()` and `activity_events`, but no reusable durable envelope. `records` is a good first consumer because the mutation already returns the created collection + default view payload needed for a readable composite event. |
| EVENT-02 | A durable outbox migration exists and is idempotent, tenant-aware, indexed, and compatible with cloud and on-prem deployments | `database/migrations/025_records_views.sql` and `apps/api/src/scripts/migrate.ts` show the expected raw SQL, idempotent, sequential migration style. The outbox can follow the same tenant-aware schema pattern already used across the codebase. |
| EVENT-03 | At least one service mutation writes domain state and outbox event in one transaction | `records.repository.ts#createCollectionWithDefaultView` already opens a transaction and creates two related rows. It is the cleanest place to add a third write for the durable event without redesigning transaction boundaries. |
| EVENT-04 | A dispatcher/worker can publish pending outbox events with retry, duplicate protection, and observable failure state | The repo already uses BullMQ workers (`matching`, `email-sync`) and API bootstrap hooks in `server.ts`, but those patterns alone are not enough. Phase 29 should reuse the worker/bootstrap conventions while keeping publication state transitions enforced in Postgres. |
| EVENT-05 | Event catalog documentation explains emitted events, payload versions, and expected consumers | `docs/specs/core/event-spine.md` already documents today's best-effort analytics spine. Phase 29 needs a companion durable-event contract doc that explains the new canonical outbox envelope and the Phase 30 workflow consumer expectations. |
</phase_requirements>

## Summary

Phase 29 should be planned as two sequential execution packets:

1. define the event envelope, outbox schema, and shared durable-write primitives, then convert the records collection creation path into a transactional state-plus-event pilot
2. add the dispatcher lifecycle, bounded retry/failure handling, derived analytics projection for the pilot, and the workflow-facing event catalog/tests

The codebase already has the right raw ingredients:

- a clean transactional pilot in `records.repository.ts`
- an existing best-effort event read model in `activity_events`
- BullMQ worker/bootstrap patterns in `workers/*.ts` and `server.ts`
- strict SQL migration conventions in `database/migrations/*` plus `scripts/migrate.ts`

What it does not have is a clean separation between:

- durable publication contract
- downstream projections/read models
- worker publication lifecycle
- documented consumer guarantees

Phase 29 should add that separation without pretending the repo is ready for a repo-wide event migration.

## Codebase Findings

### The pilot mutation is already the right shape
- `apps/api/src/domains/records/records.repository.ts#createCollectionWithDefaultView` already wraps collection creation and default-view creation in one transaction.
- `apps/api/src/domains/records/records.service.ts#createCollection` already treats that as one atomic business action.
- `apps/api/src/domains/records/records.controller.ts` already returns both created objects in the response, which makes it easy to shape one composite business event.

This means the pilot can stay focused on durable event plumbing rather than on untangling pre-existing side effects.

### Today's event spine is useful, but intentionally not durable
- `apps/api/src/core/events/activityLog.ts` writes directly to `activity_events` and swallows errors by design.
- `docs/specs/core/event-spine.md` explicitly frames `activity_events` as the source for metrics/KPI reads today, but Phase 29 context intentionally demotes it to a derived read model for the new durable contract.
- Existing service-layer `recordEvent()` call sites are numerous, which reinforces the user's decision to avoid a broad migration in this phase.

The safest path is to leave current direct `recordEvent()` sites alone and prove the new contract on one clean mutation.

### Worker infrastructure exists, but durable publication must stay database-anchored
- `apps/api/src/core/queue/index.ts` provides a shared BullMQ registry and connection config.
- `apps/api/src/server.ts` already starts `matching` and `email-sync` workers during bootstrap.
- Existing workers show healthy conventions for logging, concurrency, and repeatable scheduling.

However, BullMQ should be a transport/convenience layer here, not the source of truth. Duplicate protection and publication lifecycle need to live in the outbox table and SQL transitions so retries or duplicate queue delivery cannot produce double publication.

### The migration and tenancy conventions fit the outbox well
- `database/migrations/025_records_views.sql` shows the expected style: idempotent creation, explicit indexes, tenant-aware columns, and comments explaining the phase contract.
- `apps/api/src/scripts/migrate.ts` runs each SQL file inside a DB transaction and records it in `schema_migrations`.
- `company_id` / `tenant_id` scoping is already the multi-tenant pattern the phase should preserve for both cloud and on-prem installs.

The outbox schema should therefore stay first-class multi-tenant even though on-prem often means a single tenant.

## Recommended Plan Shape

### Wave 1
- **29-01** Event envelope, outbox schema, durable-write primitives, and transactional records pilot

### Wave 2
- **29-02** Dispatcher lifecycle, failure/retry handling, workflow-facing event catalog, derived analytics projection, and regression coverage

This split keeps the dependency chain honest:
- Plan 01 creates the contract and the row that can be dispatched
- Plan 02 proves the publication lifecycle and documents the consumer contract

Trying to do both in one execution packet would blur the exact boundary the phase is supposed to establish.

## Architectural Notes

### Envelope shape
The outer durable envelope should lock:
- event id / durable identity
- event name / domain fact
- tenant id
- actor id (nullable)
- object type / object id
- project id (nullable)
- causation id
- correlation id
- payload version
- payload
- creation/publication timestamps and dispatch metadata

The payload should remain domain-owned and versioned separately from the envelope so later workflow consumers can rely on stable top-level routing metadata while domain payloads evolve intentionally.

### Transaction boundary
The pilot should write:
- `data_collections`
- `collection_views`
- `event_outbox`

inside one database transaction owned by the repository layer. The service/controller layer should provide the actor/request metadata needed to populate the envelope, but should not re-open transaction logic itself.

### Dispatch model
The best fit is a database-anchored dispatcher that may reuse BullMQ/bootstrap conventions, but must claim rows and transition status in SQL. A healthy baseline looks like:
- pending rows inserted transactionally
- worker claims pending rows with a safe state transition
- publication result marks rows published or schedules a bounded retry
- retries stop at a configured terminal failed state
- worker restart or duplicate job delivery cannot cause double publication because the table enforces identity/state transitions

### First downstream consumers
The first-class contract should be documented for Phase 30 workflow execution. For the pilot, a derived analytics projection back into `activity_events` is still valuable because it proves the separation of concerns:
- durable outbox event is canonical
- analytics/history can be rebuilt or projected from it
- direct service-layer `recordEvent()` is not required for the pilot path

## Pitfalls

### Pitfall 1: turning Phase 29 into a repo-wide event rewrite
- There are many existing `recordEvent()` call sites.
- Migrating them all here would add noise and risk while weakening the proof of the clean pilot architecture.

### Pitfall 2: letting Redis/BullMQ become the durability source of truth
- Queue delivery can help wake up workers, but duplicate protection and publication status must be recoverable from Postgres alone.
- The contract cannot depend on lucky in-memory worker behavior.

### Pitfall 3: publishing technical plumbing events
- The user chose a business-readable event, not `collection_row_inserted`-style internals.
- The pilot should emit one composite “collection created” fact with default-view details inside the payload.

### Pitfall 4: keeping analytics writes parallel forever
- Writing both direct `activity_events` and durable outbox rows as co-equal long-term truths would recreate the ambiguity this phase is meant to remove.
- For the pilot path, any `activity_events` row should be clearly derived from the durable event publication path.

### Pitfall 5: documenting only event names without delivery semantics
- Phase 30 needs more than vocabulary.
- The catalog must explicitly state payload versioning, workflow-facing guarantees, and retry/failure semantics.

## Execution Recommendation

Plan two sequential packets. Let Plan 01 establish the durable write seam and produce a real pending event row for the records pilot. Let Plan 02 own the publication lifecycle, projection/catalog, and the regression tests that prove duplicate protection and bounded failure handling. Keep the phase intentionally narrow and prepare Phase 30 to consume one documented contract instead of reverse-engineering implementation details.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/AGENT-WORKSTREAMS.md`
- `.planning/phases/29-event-spine-durable-outbox/29-CONTEXT.md`
- `docs/architecture/current-state-truth-matrix.md`
- `docs/specs/architecture-steering.md`
- `docs/specs/core/event-spine.md`
- `apps/api/src/core/events/activityLog.ts`
- `apps/api/src/core/queue/index.ts`
- `apps/api/src/server.ts`
- `apps/api/src/scripts/migrate.ts`
- `apps/api/src/domains/records/records.controller.ts`
- `apps/api/src/domains/records/records.service.ts`
- `apps/api/src/domains/records/records.repository.ts`
- `apps/api/src/workers/email.worker.ts`
- `apps/api/src/workers/matchingJob.ts`
- `database/migrations/025_records_views.sql`

### Secondary (MEDIUM confidence)
- `apps/api/src/domains/projects/projects.service.ts`
- `apps/api/src/domains/records/records.service.test.ts`
- `docs/architecture/phase-28-security-contract.md`

## Metadata

**Confidence breakdown:**
- Pilot mutation choice and transaction boundary: HIGH
- Outbox schema / migration compatibility: HIGH
- Dispatcher shape using existing worker conventions with DB-anchored guarantees: HIGH
- Derived analytics projection approach: MEDIUM-HIGH

**Research date:** 2026-07-15
**Valid until:** Re-run if worker/bootstrap conventions, records transaction shape, or the Phase 30 workflow contract changes before execution.
