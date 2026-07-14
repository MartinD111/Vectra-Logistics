---
phase: 22-records-views-data-model
plan: 01
subsystem: database
tags: [postgresql, zod, records, views, data-model, migrations]

# Dependency graph
requires:
  - phase: 09-project-pages
    provides: PageConfig envelope convention (version/blocks JSONB, opaque body)
provides:
  - Migration 025_records_views.sql (data_collections, collection_records, collection_views tables + indexes)
  - records.types.ts row interface contracts (DataCollectionRow, CollectionRecordRow, CollectionViewRow, CollectionPropertyDef)
  - Five Zod DTO validators for the records domain (create/update-collection, create/update-record, create-view)
affects: [22-02-repository, 22-03-service, 22-04-controller-routes, 23-record-detail-page, 24-board-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PageConfig envelope duplication: DTO files that need version/blocks validation define PageConfigSchema locally rather than importing across domains (crm/projects/records don't cross-import)"
    - "JSONB DoS defense-in-depth: schema arrays capped with .max(100) at the Zod layer"

key-files:
  created:
    - database/migrations/025_records_views.sql
    - apps/api/src/domains/records/records.types.ts
    - apps/api/src/domains/records/dto/create-collection.dto.ts
    - apps/api/src/domains/records/dto/update-collection.dto.ts
    - apps/api/src/domains/records/dto/create-record.dto.ts
    - apps/api/src/domains/records/dto/update-record.dto.ts
    - apps/api/src/domains/records/dto/create-view.dto.ts
  modified: []

key-decisions:
  - "Migration copied verbatim from workspace-blocks.md §3.3 plus IF NOT EXISTS, matching every other migration's idempotency convention"
  - "project_id on data_collections stays a nullable FK per D-01, unused by any DTO/API in this phase"
  - "create-record.dto.ts / update-record.dto.ts duplicate the PageConfig envelope schema locally instead of importing from projects/dto/page.dto.ts, matching the existing no-cross-domain-import convention"

patterns-established:
  - "Records domain DTOs follow crm's create-client.dto.ts pattern: z.object schema + inferred *Dto type per file"

requirements-completed: [REC-01, REC-02, REC-03, REC-04]

# Metrics
duration: 12min
completed: 2026-07-14
---

# Phase 22 Plan 01: Records+Views Data Model Foundation Summary

**Locked SQL schema (migration 025: data_collections/collection_records/collection_views) plus TypeScript row interfaces and five Zod DTO validators for the Records+Views backend domain.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-14T05:40:00Z
- **Completed:** 2026-07-14T05:52:00Z
- **Tasks:** 3
- **Files modified:** 7 (all created, none modified)

## Accomplishments
- Migration `025_records_views.sql` defines the three-table Records+Views schema (collections, records, views) exactly per `workspace-blocks.md §3.3`, idempotently, company_id-scoped
- `records.types.ts` exports all four row interface contracts (`DataCollectionRow`, `CollectionRecordRow`, `CollectionViewRow`, `CollectionPropertyDef`) covering all 12 REC-01 property types
- Five Zod DTO files validate collection/record/view creation and updates, with `create-record.dto.ts` reusing the same envelope-only (`version`/`blocks`) validation stance as `page.dto.ts`'s `PageConfigSchema`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 025_records_views.sql** - `dafbb4c` (feat)
2. **Task 2: Write records.types.ts (row interface contracts)** - `c65afa9` (feat)
3. **Task 3: Write the five DTO files (Zod validators)** - `19d87b7` (feat)

**Plan metadata:** committed together with this SUMMARY.md (worktree mode — orchestrator handles final metadata commit)

## Files Created/Modified
- `database/migrations/025_records_views.sql` - Three idempotent `CREATE TABLE IF NOT EXISTS` statements (data_collections, collection_records, collection_views) + two indexes, verbatim per spec + IF NOT EXISTS
- `apps/api/src/domains/records/records.types.ts` - Four exported row interfaces matching migration column shapes
- `apps/api/src/domains/records/dto/create-collection.dto.ts` - `CreateCollectionSchema`/`CreateCollectionDto`, property def with 12-type enum, `.max(100)` schema array cap
- `apps/api/src/domains/records/dto/update-collection.dto.ts` - `UpdateCollectionSchema`/`UpdateCollectionDto`, same shape, all fields optional
- `apps/api/src/domains/records/dto/create-record.dto.ts` - `CreateRecordSchema`/`CreateRecordDto`, local `PageConfigSchema` envelope, `collection_id`, `props`, `parent_record_id`
- `apps/api/src/domains/records/dto/update-record.dto.ts` - `UpdateRecordSchema`/`UpdateRecordDto`, same fields minus `collection_id`, plus `sort_order`
- `apps/api/src/domains/records/dto/create-view.dto.ts` - `CreateViewSchema`/`CreateViewDto`, 6-type view enum, opaque `config`

## Decisions Made
- Followed the plan's Interfaces block verbatim for the migration SQL and TypeScript row interfaces — no deviation.
- DTO field shapes and validation bounds (string length caps, `.max(100)` array cap, uuid validators) taken directly from the plan's task actions, mirroring `crm`'s `create-client.dto.ts` and `projects`' `page.dto.ts` conventions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**`npx tsc --noEmit -p apps/api/tsconfig.json` could not be run to completion in this environment** — no `node_modules` directory exists anywhere in this worktree (fresh worktree checkout, dependencies never installed here). The one error that did surface (`Cannot find module 'redis'`) originates from `apps/api/src/core/db/redis.ts`, a pre-existing file unrelated to this plan's changes — confirming the missing-dependency issue is environmental, not something introduced by this plan. All new files were manually reviewed against the plan's exact interface specifications (field names, types, nullability, enum values) in place of automated `tsc` verification. Recommend a real `tsc --noEmit` run once `npm install` has been run in this worktree or upon merge to `main`, to confirm zero-error compilation before Plan 22-02/22-03 build on these contracts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `records.types.ts` and the five DTO files are ready for Plan 22-02 (repository) and Plan 22-03 (service) to import against.
- Migration 025 is ready to apply; no live PostgreSQL container was available in this environment to run the idempotency dry-run twice — same caveat as migrations 023/024 (tracked in STATE.md → Blockers/Concerns), worth a real dry-run before/during deployment.
- Recommend running `npx tsc --noEmit -p apps/api/tsconfig.json` after `npm install` (or at merge time) to confirm this plan's types/DTOs compile cleanly — could not be verified in this dependency-less worktree.

---
*Phase: 22-records-views-data-model*
*Completed: 2026-07-14*

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commits (`dafbb4c`, `c65afa9`, `19d87b7`) verified present in git log.
