# Phase 29: Event Spine & Durable Outbox - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 29 introduces a durable event publication contract for meaningful backend mutations. It defines a versioned event envelope, adds a tenant-aware outbox table and dispatcher lifecycle, proves the pattern with one transactional pilot mutation, and documents the first consumer contract so Phase 30 workflows can depend on durable backend events instead of best-effort side effects.

</domain>

<decisions>
## Implementation Decisions

### Event Contract Boundary
- **D-01:** The durable outbox event is the **primary domain/integration contract** for this phase.
- **D-02:** `activity_events` remains a **derived analytics/history read model**, not the canonical publication contract.
- **D-03:** Service mutations should write **domain state plus outbox row transactionally**, and analytics/history should derive from that event path rather than permanent parallel direct writes.
- **D-04:** Phase 29 should prove this with **one production-grade pilot**, not a broad migration of existing `recordEvent()` call sites.
- **D-05:** The v1 contract should use a **strict outer envelope with domain-owned payloads**: lock top-level event metadata now, while documenting per-event payload shapes in the catalog.

### Pilot Mutation Choice
- **D-06:** The pilot should be a **clean architectural mutation**, not a messy operational flow with many side effects.
- **D-07:** Prefer a mutation that is **already transactional today**, so Phase 29 proves outbox and dispatcher behavior rather than also redesigning transaction boundaries.
- **D-08:** The preferred pilot is the **records collection creation path** (`createCollectionWithDefaultView`), because it already creates multiple related rows in one transaction.
- **D-09:** Even as a clean pilot, the emitted event should still be a **readable business event**, not a purely technical plumbing marker.
- **D-10:** Emit **one composite outcome event** for successful collection creation, with default-view details captured in the payload instead of publishing separate incidental events.

### Dispatch / Publish Reliability
- **D-11:** Phase 29 should ship a **production-safe baseline** for outbox dispatch, not a minimal demo dispatcher.
- **D-12:** Duplicate protection should be **database-enforced** around durable event identity and publication-state transitions, not rely primarily on worker memory or queue luck.
- **D-13:** Retries should be **bounded**, with scheduled retry behavior and a **visible terminal failed state** rather than infinite retries.
- **D-14:** Operator visibility for v1 should come from **database state plus documentation**: statuses, timestamps, retry counts, and last-error fields are enough; no new API or UI surface is required in this phase.

### Consumer Shape for v1
- **D-15:** The first-class consumer for the Phase 29 contract is the **Phase 30 workflow engine**.
- **D-16:** Events should be **workflow-friendly but domain-first**: expressed as domain facts (for example, collection created), with enough metadata for workflows to react, but without baking workflow-specific language into event names or payloads.
- **D-17:** The event catalog should **explicitly document the workflow consumer contract** for the pilot event: guaranteed envelope fields, payload version, delivery semantics, and the exact business fact emitted.
- **D-18:** Future integrations and other consumers should be **acknowledged as secondary reuse**, but Phase 29 guarantees are defined around internal workflow consumption first.

### Claude's Discretion
- Exact field names for the outer event envelope, as long as the roadmap-required metadata is present and versioning is explicit.
- Exact event naming and payload keys for the records pilot, as long as the event remains domain-first, readable, and composite.
- Exact retry/backoff timing values, as long as retries are bounded and terminal failure is observable.
- Exact dispatcher implementation shape (polling worker, queue-assisted dispatcher, or similar), as long as the durable publication and idempotency guarantees remain database-anchored.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and sequencing
- `.planning/ROADMAP.md` - Phase 29 goal, dependency on Phase 28, success criteria, and the milestone handoff into Phase 30.
- `.planning/REQUIREMENTS.md` - `EVENT-01` through `EVENT-05`, the locked requirements this phase must satisfy.
- `.planning/PROJECT.md` - milestone framing, no-ORM migration constraint, and the durable-execution dependency chain.
- `.planning/STATE.md` - carried-forward decision that durable outbox must land before workflow persistence/manual trigger work.
- `.planning/AGENT-WORKSTREAMS.md` - Data/Event Agent ownership for the outbox/event contract and QA/Release expectations.
- `.planning/phases/28-security-tenancy-capabilities-foundation/28-CONTEXT.md` - inherited request/capability/trust foundation Phase 29 must reuse instead of inventing a second identity model.

### Existing event and architecture contracts
- `docs/specs/core/event-spine.md` - current `activity_events` contract, writing rules, verb conventions, and analytics/KPI expectations that Phase 29 must not silently break.
- `docs/specs/architecture-steering.md` - architectural rule that tenant isolation and event-spine truth must not fork between cloud and on-prem paths.
- `docs/architecture/current-state-truth-matrix.md` - current v5 baseline noting that `activity_events` is best-effort today and that durable outbox is the required next foundation step.

### Existing code surfaces to normalize or build on
- `apps/api/src/core/events/activityLog.ts` - current best-effort direct event writer that Phase 29 is intentionally not treating as the durable publication contract.
- `apps/api/src/domains/records/records.repository.ts` - preferred pilot mutation path with an existing transaction creating a collection and default view together.
- `apps/api/src/domains/projects/projects.service.ts` - representative current pattern of direct post-write `recordEvent()` calls that should inform migration boundaries and catalog wording.
- `database/migrations/025_records_views.sql` - latest verified migration before Phase 29; the next outbox migration must follow this numbering and SQL style.
- `apps/api/src/scripts/migrate.ts` - migration runner behavior and transaction handling that the new outbox migration must stay compatible with.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/domains/records/records.repository.ts` already has `createCollectionWithDefaultView`, a clean transactional write that creates two related rows and returns both entities.
- `apps/api/src/core/events/activityLog.ts` already centralizes current event logging vocabulary and payload expectations, which is useful as a source of existing verbs and analytics continuity rules.
- `apps/api/src/scripts/migrate.ts` already provides the expected idempotent SQL migration execution path; Phase 29 should add one new numbered migration rather than introduce any ORM or schema tooling.

### Established Patterns
- The current codebase treats `activity_events` as the append-only analytics/KPI spine, but writes are best-effort and happen outside domain-state transactions.
- Meaningful business side effects are currently scattered across direct DB writes, realtime emits, and selective queue usage; Phase 29 should unify durable publication without pretending every side effect must migrate at once.
- Tenant isolation remains `company_id`-scoped across SQL and service logic; the outbox schema and dispatcher queries must preserve that same tenant-aware pattern for cloud and on-prem installs.
- Migrations are raw SQL, sequential, and idempotent; any outbox schema, indexes, and uniqueness guarantees must follow the existing migration conventions exactly.

### Integration Points
- The pilot event path will connect domain mutation code in `records.repository.ts` to a new durable outbox schema and dispatcher lifecycle.
- Analytics continuity will connect the new contract back to the expectations documented in `docs/specs/core/event-spine.md`, since `activity_events` remains the read model for KPI/history consumers.
- Phase 30 workflow persistence and manual trigger work will consume the published event contract, so the catalog and envelope decisions here are a direct handoff to that next phase.

</code_context>

<specifics>
## Specific Ideas

The user explicitly wants Phase 29 to establish a **clean separation of concerns**:
- durable domain events are the real contract
- analytics/history is derived from that contract
- the first implementation should prove the architecture on a clean transactional mutation before broader migration

The chosen pilot should still feel like a real business fact:
- use the records collection creation flow
- emit one composite event for the successful outcome
- include the default-view context in payload rather than exposing every internal insert as its own event

The user also wants the first consumer contract written for the next immediate dependency:
- optimize the v1 contract for the Phase 30 workflow engine
- keep the contract domain-first so future integrations can reuse it later without workflow coupling

</specifics>

<deferred>
## Deferred Ideas

- Broad migration of existing `recordEvent()` call sites is deferred. Phase 29 should prove the pattern with one pilot rather than convert multiple domains at once.
- New operator-facing UI or API surfaces for inspecting failed/pending outbox events are deferred. Database state plus documentation is enough for this phase.
- Equal first-class guarantees for external integrations are deferred. Integrations may reuse the contract later, but the explicit v1 guarantees target internal workflow consumption first.

</deferred>

---
*Phase: 29-event-spine-durable-outbox*
*Context gathered: 2026-07-15*
