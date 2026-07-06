---
phase: 05-email-history-sync
plan: 02
subsystem: api
tags: [outlook, graph-api, bullmq, email, worker]

requires:
  - phase: 05-email-history-sync
    plan: 01
    provides: email.matcher.ts, email.repository.ts, outlook.repository.ts watermark methods
provides:
  - syncEmails() on OutlookService — Graph fetch, pagination, client matching, upsert, watermark
  - email.worker.ts with startEmailWorker() and scheduleEmailSync() (BullMQ, 15-min repeatable job)
  - server.ts bootstrap wiring so email sync runs automatically on API startup
affects: []

tech-stack:
  added: []
  patterns: ["BullMQ single-job-iterates-all-companies sweep, mirroring telematics.worker.ts"]

key-files:
  created:
    - apps/api/src/workers/email.worker.ts
    - apps/api/src/domains/outlook/outlook.service.test.ts
  modified:
    - apps/api/src/domains/outlook/outlook.service.ts
    - apps/api/src/server.ts

key-decisions:
  - "syncEmails() mirrors syncCalendar()'s exact guard sequence and return shape for consistency and to avoid a second enforcement/skip pattern in the same file"
  - "Pagination follows @odata.nextLink directly (already contains its own query params) rather than reconstructing query strings per page"

patterns-established:
  - "email-sync BullMQ worker follows the same single-job-sweeps-all-companies + Promise.allSettled pattern as telematics.worker.ts — future recurring sync jobs should follow this shape"

requirements-completed: [EML-01, EML-03]

duration: 30min
completed: 2026-07-06
---

# Phase 5 Plan 2: Email sync orchestration and scheduling Summary

**syncEmails() Graph orchestration with pagination and domain-based client matching, wired into a 15-minute BullMQ repeatable job started at API bootstrap**

## Performance

- **Duration:** 30 min
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `syncEmails()` fetches sent mail from `/mailfolders/sentitems/messages`, follows `@odata.nextLink` pagination, matches each message's recipients to clients via `matchClientsForRecipients()`, and upserts one row per matched client (a single message to two clients' domains produces two rows)
- Incremental sync via watermark: first sync backfills 90 days, later syncs use `last_sync_at`
- `email.worker.ts` registers a BullMQ `email-sync` queue worker + 15-minute repeatable job mirroring `telematics.worker.ts`'s design; wired into `server.ts` bootstrap
- 6 new unit tests (12 total across the phase) cover the not-connected/demo/no-token skip paths, pagination aggregation, multi-client row splitting, and the watermark/audit-event side effects on success

## Task Commits

1. **Task 1: syncEmails() on OutlookService** - `2e454a2` (feat)
2. **Task 2: BullMQ email-sync worker + scheduler + bootstrap wiring** - `11bdf47` (feat)

## Files Created/Modified
- `apps/api/src/domains/outlook/outlook.service.ts` - Added syncEmails() method
- `apps/api/src/domains/outlook/outlook.service.test.ts` - 6 unit tests mocking repositories, crmRepository, fetch, and recordEvent
- `apps/api/src/workers/email.worker.ts` - startEmailWorker() + scheduleEmailSync()
- `apps/api/src/server.ts` - Bootstrap wiring for the new worker/scheduler

## Decisions Made
- None beyond what's already in the plan — followed the syncCalendar()/telematics.worker.ts mirroring exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`recordEvent` performs a real DB call and its internal try/catch swallowed the resulting connection error inside two test cases before it was mocked — cosmetic only (tests still passed), fixed by mocking `activityLog.recordEvent` in those tests so output is clean.

## Next Phase Readiness

Phase 5 (email-history-sync) is functionally complete: `email_messages` populates automatically every 15 minutes for any company with a connected, non-demo Outlook mailbox. The pre-existing `listClientEmails()` read path (crm.repository.ts) requires no changes — client detail pages will render real synced data without further work. No blockers for Phase 6.

---
*Phase: 05-email-history-sync*
*Completed: 2026-07-06*
