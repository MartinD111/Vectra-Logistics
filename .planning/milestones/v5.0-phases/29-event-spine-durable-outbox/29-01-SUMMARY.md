---
phase: 29-event-spine-durable-outbox
plan: 01
subsystem: events
tags: [postgres, outbox, records, request-context]
requires:
  - phase: 28-security-tenancy-capabilities-foundation
    provides: typed request context and tenant metadata
provides:
  - Versioned durable event envelope and insert helper
  - Tenant-scoped event_outbox migration with lifecycle columns
  - Records collection-created pilot event written inside the collection transaction
affects: [phase-30-workflow-engine, records, event-spine, activity-events]
tech-stack:
  added: []
  patterns: [transactional-outbox, versioned-event-envelope, request-correlation]
key-files:
  created:
    - database/migrations/026_event_outbox.sql
    - apps/api/src/core/events/outbox.ts
    - apps/api/src/core/events/index.ts
  modified:
    - apps/api/src/domains/records/records.controller.ts
    - apps/api/src/domains/records/records.service.ts
    - apps/api/src/domains/records/records.repository.ts
    - apps/api/src/domains/records/records.repository.test.ts
    - apps/api/src/domains/records/records.service.test.ts
key-decisions:
  - "event_outbox is the durable publication source; activity_events remains a derived analytics/history model."
  - "The records pilot emits one composite records.collection.created event inside createCollectionWithDefaultView."
patterns-established:
  - "Domain mutations build a v1 DurableEventEnvelope and insert it through the outbox helper inside the existing transaction."
requirements-completed: [EVENT-01, EVENT-02, EVENT-03]
duration: 42min
completed: 2026-07-15
---

# Phase 29 Plan 01: Durable Outbox Foundation Summary

**Versioned event_outbox envelope with a records collection-created transaction pilot**

## Performance

- **Duration:** 42 min
- **Started:** 2026-07-15T21:06:00+02:00
- **Completed:** 2026-07-15T21:48:00+02:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `026_event_outbox.sql` with tenant, actor, object, project, causation, correlation, payload version, retry, published, and failed lifecycle fields.
- Added shared durable event envelope helpers in `apps/api/src/core/events/outbox.ts`.
- Converted records collection creation to persist collection state, default view state, and one pending `records.collection.created` outbox row in the same transaction.

## Task Commits

1. **Task 1 and Task 2: Durable envelope, schema, and transactional records pilot** - `a1cb3d4` (feat)

## Files Created/Modified

- `database/migrations/026_event_outbox.sql` - Durable outbox schema and indexes.
- `apps/api/src/core/events/outbox.ts` - Envelope types and outbox insert helper.
- `apps/api/src/core/events/index.ts` - Events barrel export.
- `apps/api/src/domains/records/records.repository.ts` - Transactional outbox insert for collection creation.
- `apps/api/src/domains/records/records.service.ts` - Request actor/correlation metadata threading.
- `apps/api/src/domains/records/records.controller.ts` - Request context passed into collection creation.
- `apps/api/src/domains/records/records.repository.test.ts` - Transaction order and outbox payload assertions.
- `apps/api/src/domains/records/records.service.test.ts` - Actor/correlation metadata assertion.

## Decisions Made

- Used `records.collection.created` with `data_collection` as the pilot business fact.
- Kept the event payload domain-owned and composite, including both collection and default-view context.
- Kept transaction ownership in the records repository, matching the existing atomic default-view pattern.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

None. Targeted tests and API typecheck passed. Test output still includes pre-existing auth-path DB credential log noise, but the suite exits 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 29-02 can consume the pending outbox rows and publish the records pilot through a dispatcher lifecycle.

## Self-Check: PASSED

- `npm test -- --test-name-pattern="records|event|outbox"` passed in `apps/api`.
- `npx tsc --noEmit -p apps/api/tsconfig.json` passed.
- Grep verification found required envelope and lifecycle fields in the migration and event code.

---
*Phase: 29-event-spine-durable-outbox*
*Completed: 2026-07-15*
