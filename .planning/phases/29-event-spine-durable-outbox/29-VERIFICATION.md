---
phase: 29-event-spine-durable-outbox
status: passed
verified_at: 2026-07-15T21:49:00+02:00
requirements: [EVENT-01, EVENT-02, EVENT-03, EVENT-04, EVENT-05]
summaries:
  - 29-01-SUMMARY.md
  - 29-02-SUMMARY.md
---

# Phase 29 Verification: Event Spine & Durable Outbox

## Result

Status: passed

Phase 29 achieved its goal: meaningful service mutations can emit durable,
versioned events without depending on best-effort UI calls.

## Requirement Traceability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| EVENT-01 | passed | `DurableEventEnvelope` in `apps/api/src/core/events/outbox.ts` includes event id/name, envelope version, tenant, actor, object, project, causation, correlation, payload version, and payload. |
| EVENT-02 | passed | `database/migrations/026_event_outbox.sql` defines idempotent tenant-scoped `event_outbox` schema with uniqueness, indexes, and lifecycle columns. |
| EVENT-03 | passed | `recordsRepository.createCollectionWithDefaultView` inserts collection, default view, and one durable outbox row inside the same `BEGIN`/`COMMIT` block. |
| EVENT-04 | passed | `claimDueEvents`, `publishDurableEvent`, `markEventPublishFailed`, and `dispatchDueEvents` provide duplicate-safe claim, publish, bounded retry, stale publishing recovery, and terminal failure state. |
| EVENT-05 | passed | `docs/specs/core/event-catalog.md` documents `records.collection.created`, payload version, delivery semantics, Phase 30 workflow consumer, and derived `activity_events` projection. |

## Automated Checks

| Check | Status | Notes |
|-------|--------|-------|
| `npm test -- --test-name-pattern="records|event|outbox"` in `apps/api` | passed | 117 tests passed. Existing auth-path DB credential log noise appeared but did not fail the suite. |
| `npm test -- --test-name-pattern="outbox|worker|dispatch|retry"` in `apps/api` | passed | 121 tests passed. |
| `npm test -- --test-name-pattern="records|event|outbox|worker|dispatch|retry"` in `apps/api` | passed | 121 tests passed. |
| `npm test` in `apps/api` | passed | 121 tests passed. Existing auth-path DB credential log noise appeared but did not fail the suite. |
| `npx tsc --noEmit -p apps/api/tsconfig.json` | passed | Typecheck exited 0. |
| `npm run build` in `apps/api` | passed | TypeScript build exited 0. |
| `rg` field/contract checks from both plans | passed | Required migration, envelope, lifecycle, catalog, workflow, and projection terms are present. |
| `gsd-sdk query verify.schema-drift 29` | passed | `drift_detected: false`. |
| `npm run migrate --workspace @vectra/api` | environment blocked | Fails before migration execution with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`, matching the known local credential limitation from the baseline matrix. |

## Must-Haves

- Durable publication source is `event_outbox`; `activity_events` is documented and implemented as a derived analytics/history projection for the pilot.
- The records pilot emits exactly one composite `records.collection.created` event for collection plus default-view creation.
- Dispatcher reliability is anchored in persisted row identity and status transitions, not queue memory.
- Retry/failure visibility is persisted through `attempts`, `max_attempts`, `next_attempt_at`, `failed_at`, and `last_error`.
- Phase 30 has a concrete event catalog entry to consume.

## Residual Risk

- Live migration application was not verified because this environment lacks a usable database password.
- Phase 29 intentionally covers one production-grade pilot only; broad migration of legacy `recordEvent()` call sites remains deferred.

## Human Verification

None required. This phase is backend schema/code/docs with automated coverage.

## Verification Complete
