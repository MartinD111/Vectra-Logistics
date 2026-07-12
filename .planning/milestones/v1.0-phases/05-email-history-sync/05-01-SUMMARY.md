---
phase: 05-email-history-sync
plan: 01
subsystem: api
tags: [outlook, graph-api, email, ts-node, node:test, postgresql]

requires:
  - phase: 01-schema-crm-domain-foundation
    provides: email_messages table (UNIQUE company_id, outlook_id), clients table with email column
provides:
  - Idempotent migration relaxing email_messages uniqueness to (company_id, outlook_id, client_id)
  - matchClientsForRecipients() pure domain-matching function with free-mail denylist
  - emailRepository.upsertMessages() keyed on the new composite unique index
  - outlookRepository.listConnectedMailboxes() and updateLastSyncAt() for watermark-driven sync
  - outlookRepository.find() now returns last_sync_at
  - node:test test runner scaffold (first test infra in this repo)
affects: [05-email-history-sync plan 02]

tech-stack:
  added: [ts-node (devDependency, pinned to match ts-node-dev's resolved ^10.4.0)]
  patterns: ["node --require ts-node/register --test for unit tests, no jest/vitest/mocha"]

key-files:
  created:
    - database/migrations/023_email_messages_client_unique.sql
    - apps/api/src/domains/outlook/email.matcher.ts
    - apps/api/src/domains/outlook/email.matcher.test.ts
    - apps/api/src/domains/outlook/email.repository.ts
  modified:
    - apps/api/src/domains/outlook/outlook.repository.ts
    - apps/api/src/domains/outlook/outlook.types.ts
    - apps/api/package.json

key-decisions:
  - "ts-node pinned to ^10.9.2 to match ts-node-dev's already-resolved ^10.4.0 transitive dependency, avoiding a version-mismatch surprise"
  - "email.matcher.ts kept as a pure function (no db import) so it is unit-testable without a database"

patterns-established:
  - "First node:test-based unit test suite in apps/api — future domains should follow the same *.test.ts + node:test/node:assert pattern rather than introducing a new framework"

requirements-completed: [EML-02, EML-03]

duration: 25min
completed: 2026-07-06
---

# Phase 5 Plan 1: Email sync persistence and matching foundation Summary

**Domain-based email-to-client matcher with free-mail denylist, composite-unique email_messages migration, and upsert repository — the building blocks syncEmails() (plan 02) will call**

## Performance

- **Duration:** 25 min
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments
- Relaxed `email_messages` uniqueness from `(company_id, outlook_id)` to `(company_id, outlook_id, client_id)` via an idempotent migration that looks up the old constraint name at runtime instead of hardcoding it
- `matchClientsForRecipients()` implements domain-based matching with an exact-match-only fallback for free-mail domains (gmail.com, outlook.com, etc.), fully unit-tested across 6 behavior cases
- `emailRepository.upsertMessages()` and extended `outlookRepository` (watermark read/write) give plan 02's `syncEmails()` everything it needs except the Graph-calling orchestration itself
- Scaffolded the repo's first test runner (`node --require ts-node/register --test`) since no test framework existed anywhere in `apps/api`

## Task Commits

1. **Task 1: Test runner scaffold + migration + email.matcher.ts** - `4860939` (test)
2. **Task 2: email.repository.ts + outlook.repository.ts watermark methods** - `b7ba727` (feat)

## Files Created/Modified
- `database/migrations/023_email_messages_client_unique.sql` - Relaxes email_messages uniqueness constraint idempotently
- `apps/api/src/domains/outlook/email.matcher.ts` - Pure domain-matching function + free-mail denylist
- `apps/api/src/domains/outlook/email.matcher.test.ts` - 6 unit tests covering matcher behavior
- `apps/api/src/domains/outlook/email.repository.ts` - upsertMessages() with ON CONFLICT on the new composite key
- `apps/api/src/domains/outlook/outlook.repository.ts` - Added listConnectedMailboxes(), updateLastSyncAt(); find() now returns last_sync_at
- `apps/api/src/domains/outlook/outlook.types.ts` - Added EmailMessage interface
- `apps/api/package.json` - Added test script and ts-node devDependency

## Decisions Made
- ts-node version pinned to match ts-node-dev's transitive resolution (^10.9.2) rather than installing arbitrary latest, per the plan's threat model note (T-05-SC)
- Repository upsert loops per-row (mirroring calendar.repository.ts's style) rather than a batched multi-row INSERT, for consistency with the existing pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Migration idempotency could not be verified against a live dev DB (no PostgreSQL container running in this environment). Verified by manual SQL inspection instead: the `DO $$` block only executes `DROP CONSTRAINT` when a matching old constraint is found, and `CREATE UNIQUE INDEX IF NOT EXISTS` is safe to rerun — both are safe to apply twice.

## Next Phase Readiness

All building blocks (matcher, repository, watermark read/write) are in place and type-check cleanly (`npx tsc --noEmit` exits 0). Plan 05-02 can proceed directly to implementing `syncEmails()` and the BullMQ worker.

---
*Phase: 05-email-history-sync*
*Completed: 2026-07-06*
