---
phase: 29-event-spine-durable-outbox
plan: 02
subsystem: events
tags: [bullmq, postgres, outbox, workflow, activity-events]
requires:
  - phase: 29-event-spine-durable-outbox
    provides: event_outbox schema and records collection-created pilot row
provides:
  - Worker bootstrap and repeatable dispatch schedule for durable events
  - Database-anchored claim/publish/retry/failure lifecycle
  - Durable event catalog for the records collection-created pilot
affects: [phase-30-workflow-engine, records, activity-events, workers]
tech-stack:
  added: []
  patterns: [outbox-dispatcher, bounded-retry, derived-activity-projection]
key-files:
  created:
    - apps/api/src/core/events/outbox.test.ts
    - apps/api/src/workers/eventOutbox.worker.ts
    - docs/specs/core/event-catalog.md
  modified:
    - apps/api/src/core/events/outbox.ts
    - apps/api/src/server.ts
    - docs/specs/core/event-spine.md
    - docs/architecture/current-state-truth-matrix.md
key-decisions:
  - "The dispatcher claims rows with database status transitions, not worker memory."
  - "records.collection.created is projected into activity_events only after the durable event is claimed for publication."
  - "Phase 29 documents one pilot event contract and explicitly defers broad recordEvent migration and inspection UI/API."
patterns-established:
  - "Durable event rows move through pending, publishing, published, and failed states with bounded retry metadata."
  - "activity_events projections are derived from durable publication for workflow-facing pilot events."
requirements-completed: [EVENT-04, EVENT-05]
duration: 39min
completed: 2026-07-15
---

# Phase 29 Plan 02: Durable Dispatcher and Catalog Summary

**Database-anchored outbox dispatcher with bounded retry and a workflow-ready records event catalog**

## Performance

- **Duration:** 39 min
- **Started:** 2026-07-15T21:09:00+02:00
- **Completed:** 2026-07-15T21:48:00+02:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added due-row claiming with `FOR UPDATE SKIP LOCKED`, stale publishing recovery, persisted attempts, and worker ownership metadata.
- Added publication logic that projects `records.collection.created` into `activity_events`, then marks the outbox row published in the same publish transaction.
- Added bounded retry and terminal failure updates using `attempts`, `max_attempts`, `next_attempt_at`, `failed_at`, and `last_error`.
- Wired `eventOutbox.worker.ts` into API bootstrap with a repeatable dispatch schedule.
- Added `docs/specs/core/event-catalog.md` and updated event-spine/truth docs for the durable-vs-derived boundary.

## Task Commits

1. **Task 1 and Task 2: Dispatcher lifecycle, derived projection, and catalog docs** - `79cc9ed` (feat)

## Files Created/Modified

- `apps/api/src/core/events/outbox.ts` - Claim, publish, retry, failure, and dispatch lifecycle.
- `apps/api/src/core/events/outbox.test.ts` - Claim, projection, retry, and terminal failure tests.
- `apps/api/src/workers/eventOutbox.worker.ts` - BullMQ worker and repeatable schedule.
- `apps/api/src/server.ts` - Worker bootstrap and schedule call.
- `docs/specs/core/event-catalog.md` - Durable event catalog and records pilot contract.
- `docs/specs/core/event-spine.md` - Canonical outbox plus derived activity-events documentation.
- `docs/architecture/current-state-truth-matrix.md` - Updated worker/schema truth.

## Decisions Made

- Used a 30-second repeatable BullMQ dispatch job for the baseline worker, keeping pending rows discoverable after process restart.
- Used database claim state and stale lock recovery instead of relying on queue delivery uniqueness.
- Projected only the records pilot event, leaving broad legacy `recordEvent()` migration out of scope.

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

Phase 30 can consume the documented `records.collection.created` durable event contract and rely on visible outbox status/retry/failure semantics.

## Self-Check: PASSED

- `npm test -- --test-name-pattern="outbox|worker|dispatch|retry"` passed in `apps/api`.
- `npm test -- --test-name-pattern="records|event|outbox|worker|dispatch|retry"` passed in `apps/api`.
- `npx tsc --noEmit -p apps/api/tsconfig.json` passed.
- Documentation grep found workflow, payload version, delivery semantics, `activity_events`, `records.collection`, and outbox references.

---
*Phase: 29-event-spine-durable-outbox*
*Completed: 2026-07-15*
