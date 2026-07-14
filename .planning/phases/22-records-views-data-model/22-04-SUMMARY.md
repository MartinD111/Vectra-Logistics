---
phase: 22-records-views-data-model
plan: 04
subsystem: api
tags: [records, views, http, express, ddd]
dependency-graph:
  requires: ["22-03"]
  provides: ["records-http-api"]
  affects: ["apps/api/src/domains/index.ts"]
tech-stack:
  added: []
  patterns: ["asyncHandler-wrapped thin controller delegation", "requireCompany guard copied per-domain (no shared utility)"]
key-files:
  created:
    - apps/api/src/domains/records/records.controller.ts
    - apps/api/src/domains/records/records.routes.ts
  modified:
    - apps/api/src/domains/index.ts
decisions:
  - "createCollection controller surfaces both `collection` and `view` in the 201 response body, matching recordsService.createCollection's actual `{ collection, view }` return shape (D-03) — plan's literal handler snippet only mentioned `collection`, adjusted per Rule 1 to satisfy the plan's own must_have truth about the default view being included."
metrics:
  duration: ~20min
  completed: 2026-07-14
---

# Phase 22 Plan 04: Records + Views HTTP Wiring Summary

Wires the Records + Views domain (schema from 22-01, service from 22-03) onto the HTTP surface: a thin `asyncHandler`-wrapped controller, an `authenticateToken`-protected router, and registration in `domains/index.ts`, making `/api/v1/records/*` reachable and completing REC-01 through REC-04.

## What Was Built

- `apps/api/src/domains/records/records.controller.ts` — 13 `asyncHandler`-wrapped handlers (`listCollections`, `getCollection`, `createCollection`, `updateCollection`, `listRecords`, `createRecord`, `getRecord`, `updateRecord`, `listRecordChildren`, `listViews`, `createView`, `getView`, `updateView`), each 1-4 lines delegating to `recordsService`, matching the `crm.controller.ts` thin-delegation style. `requireCompany` guard copied verbatim (throws `AppError(403, 'No company associated')` if `req.user.company_id` is missing).
- `apps/api/src/domains/records/records.routes.ts` — Express router with `router.use(authenticateToken)` applied before all 13 routes: `/collections`, `/collections/:id`, `/collections/:id/records`, `/collections/:id/views`, `/records/:id`, `/records/:id/children`, `/views/:id` with the exact verbs specified in the plan.
- `apps/api/src/domains/index.ts` — added `import recordsRouter from './records/records.routes';` after the `ltlRouter` import and `router.use('/records', recordsRouter);` after `router.use('/ltl', ltlRouter);`. No existing import or `router.use` line reordered or modified (verified via git diff — only 2 lines inserted).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `createCollection` response shape corrected to include the auto-created default view**
- **Found during:** Task 1
- **Issue:** The plan's literal handler snippet for `createCollection` was `res.status(201).json({ collection: await recordsService.createCollection(...) })`, but `recordsService.createCollection` (from Plan 22-03, on disk) actually returns `Promise<{ collection: DataCollectionRow; view: CollectionViewRow }>`, not a bare `DataCollectionRow`. Using the plan's literal snippet would have nested the whole `{collection, view}` object under the `collection` key, and — more importantly — would have silently contradicted the plan's own must_have truth: "the returned body includes the auto-created default view (D-03)".
- **Fix:** Destructured the service's return value and surfaced both keys at the top level: `const { collection, view } = await recordsService.createCollection(...); res.status(201).json({ collection, view });`
- **Files modified:** `apps/api/src/domains/records/records.controller.ts`
- **Commit:** 0088878

## Verification

- `npx tsc --noEmit -p apps/api/tsconfig.json`: only pre-existing, unrelated errors reported (`apps/api/src/core/db/redis.ts` — `Cannot find module 'redis'`), caused by `node_modules` not being installed in this worktree execution environment (no `npm install` was run; out of scope for this plan). No errors originate from any file this plan touched.
- `grep -c "router.use('/records', recordsRouter)" apps/api/src/domains/index.ts` → `1`, confirming the mount line is present exactly once.
- `npm --prefix apps/api test`: could not run — `ts-node/register` is not resolvable because `node_modules` is absent in this worktree (same root cause as the `tsc` errors above). This is an environment limitation, not a code defect; the test suite itself (including `records.repository.test.ts` / `records.service.test.ts` from Plans 22-02/22-03) was not modified by this plan.
- Manual review confirms: `records.controller.ts` exports exactly the 13 required handlers, all wrapped in `asyncHandler`; `requireCompany` is defined locally (not imported); `createCollection`/`createRecord`/`createView` respond 201, all others 200; `records.routes.ts` calls `router.use(authenticateToken)` before any route registration; all 13 routes match the exact paths/verbs specified; `domains/index.ts` has exactly 2 new lines with every pre-existing line unchanged.

## Known Stubs

None — all 13 handlers delegate to real `recordsService` methods (implemented in Plan 22-03), no placeholder/mock data paths introduced.

## Threat Flags

None — this plan's threat model (T-22-10, T-22-11, T-22-12) is fully covered by `router.use(authenticateToken)` (verified present before all routes) and `requireCompany(req)` passed into every service call (verified in all 13 handlers). No new network surface, auth path, or schema change outside what the plan's own threat model already documents.

## Self-Check: PASSED

- FOUND: apps/api/src/domains/records/records.controller.ts
- FOUND: apps/api/src/domains/records/records.routes.ts
- FOUND: apps/api/src/domains/index.ts (modified, contains `router.use('/records', recordsRouter)`)
- FOUND commit 0088878 (feat(22-04): add records controller with 13 asyncHandler-wrapped handlers)
- FOUND commit 437cf8f (feat(22-04): add records routes and register at /api/v1/records)
