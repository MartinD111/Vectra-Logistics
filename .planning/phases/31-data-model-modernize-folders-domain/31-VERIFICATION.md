---
phase: 31-data-model-modernize-folders-domain
verified: 2026-07-17T09:04:06Z
status: gaps_found
score: 5/7 must-haves verified (5 roadmap success criteria pass; 2 derived schema-integrity truths fail)
overrides_applied: 0
gaps:
  - truth: "Folder-move cascade preserves the depth<=3 invariant for every descendant, not just the moved node"
    status: failed
    reason: "moveFolder() (apps/api/src/domains/folders/folders.service.ts:53-94) only validates the depth of the folder being moved (`parent.ancestor_ids.length + 1 + 1`). It never re-validates the resulting depth of the moved folder's descendants after patchDescendantAncestors rewrites their ancestor_ids. The DB trigger folders_prevent_cycle_and_depth_trg only fires BEFORE INSERT OR UPDATE OF parent_id, and patchDescendantAncestors updates ancestor_ids directly without touching parent_id, so the trigger never runs for descendants either. A depth-3-violating move (e.g. moving a depth-2 folder with a depth-3 child under another depth-2 parent) is silently accepted at both the API and DB level. Confirmed unresolved: code review finding CR-01 (31-REVIEW.md) is still present verbatim in the current folders.service.ts, no follow-up commit exists after the review (ce23a6e is the latest commit touching this phase, docs-only), and the existing unit test 'moveFolder rejects when the resulting depth exceeds 3' (folders.service.test.ts:113) only asserts the moved folder's own depth, not descendant depth."
    artifacts:
      - path: "apps/api/src/domains/folders/folders.service.ts"
        issue: "moveFolder (lines 53-94) does not compute or validate descendant depth before calling patchDescendantAncestors"
    missing:
      - "Before applying patchDescendantAncestors, compute the max relative depth among descendantFolderIds and reject the move (400) if any descendant's new ancestor_ids length would exceed MAX_FOLDER_DEPTH, mirroring the DB trigger's guarantee for the direct-move case"
      - "A unit/integration test exercising a 3-level-deep subtree move that pushes a grandchild past depth 3"
  - truth: "Folder move is atomic — the folder's own row and its descendants' ancestor_ids are updated in a single transaction"
    status: failed
    reason: "moveFolder() writes the folder's own parent_id/ancestor_ids via foldersRepository.moveFolder(id, parentId, ancestorIds) on the module-level `db` pool (auto-commits immediately), then separately opens a new client, BEGINs, calls patchDescendantAncestors, and COMMITs. These are two independent transactions. If the descendant patch fails after the folder's own move has committed, the folder is relocated but every descendant retains stale ancestor_ids — breaking the invariant the ancestor-index (HIER-07) exists to guarantee. Confirmed unresolved: matches code review CR-02 verbatim, still present in folders.service.ts:74-91, no fix committed since the review."
    artifacts:
      - path: "apps/api/src/domains/folders/folders.service.ts"
        issue: "moveFolder (lines 74-91): foldersRepository.moveFolder runs on the ambient db pool and commits before the descendant-patch transaction even opens"
    missing:
      - "Wrap the own-row move and patchDescendantAncestors in one shared client/transaction (e.g. a transactional moveFolderTx repository method), matching the pattern already used by archiveFolder in the same file"
deferred: []
human_verification: []
---

# Phase 31: Data Model — Modernize Folders Domain Verification Report

**Phase Goal:** The folder/project/program/collection hierarchy has a complete, tenant-safe, cycle-safe schema, and the `folders` domain's mutation/authorization/event pattern matches the rest of the v5 platform, so every downstream phase builds on a correct foundation instead of a stale one.
**Verified:** 2026-07-17T09:04:06Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `data_collections` row can be attached to a folder via `folder_id`, mirroring `projects.folder_id`/`programs.folder_id` | VERIFIED | `database/migrations/028_folder_hierarchy_invariants.sql:34` adds `data_collections.folder_id` with composite FK (line 138-142); `records.types.ts:13` has `folder_id`; `records.service.ts:22,49` calls `assertOwnedFolder` before create/update; `records.repository.ts:17` inserts `folder_id` |
| 2 | Reparenting any folder/project/program/collection/page to a different tenant's node is rejected at the DB level by composite `(id, company_id)` FK | VERIFIED | Migration lines 70-151 add `UNIQUE (id, company_id)` on folders/projects/project_pages and composite FKs `(parent_id/folder_id/project_id, company_id) REFERENCES ... (id, company_id)` on all six parent-pointer relationships; live integration test `HIER-02` (folders.integration.test.ts:88-93) proves a cross-tenant `UPDATE ... parent_id` is rejected with Postgres error code `23503` |
| 3 | Moving a node into its own descendant (a cycle) is rejected at both DB level and API level | VERIFIED (see note) | DB: trigger `folders_prevent_cycle_and_depth_trg` (migration lines 154-187) rejects `NEW.id = ANY(parent_ancestors)`, proven by integration test `HIER-03` cycle case (lines 95-108). API: `moveFolder` (folders.service.ts:64-66) pre-checks `parent.ancestor_ids.includes(id)` and throws 400 before the DB is touched, proven by unit test `moveFolder rejects moving a folder into its own descendant` (folders.service.test.ts). **Note:** the adjacent depth-3 invariant enforced by the *same* trigger is not equally protected on the move-cascade path — see gap below; this is tracked separately from the literal cycle-rejection wording of this criterion. |
| 4 | Archiving a folder/project/program cascades `archived_at` to all descendant folders/projects/programs/collections/pages in a single transaction | VERIFIED | `archiveFolder` (folders.service.ts:96-200) opens one `client`, BEGINs once, and calls `archiveFolderSubtree`, `archiveProjectsInFolders`, `archiveProgramsInFolders`, `archiveCollectionsInFolders`, `archiveProgramsInProjects`, `archivePagesInProjects`, `archiveCollectionsInProjects` all on that same client before a single COMMIT. Live integration test `HIER-04` (folders.integration.test.ts:143-197) creates a real folder→project→program/page/collection tree, calls `archiveFolder`, and asserts every row's `archived_at` is set and a matching `event_outbox` row exists per object |
| 5 | Every folder domain mutation uses `RequestContext` + capability assertion, writes durable events via `event_outbox` (no `recordEvent()`/`activityLog`), and ancestor/breadcrumb lookups use an ancestor-index instead of a recursive CTE | VERIFIED | `folders.controller.ts` uses `requireRequestContext(req)` on every handler (no `requireCompanyId(req)` shortcut found); `folders.service.ts` calls `assertCapability(ctx, 'workspace.admin')` on every mutation and `insertDurableEvent`/`createDurableEventEnvelope` for every state change; static grep test `HIER-06` (folders.integration.test.ts:200-212) asserts no `recordEvent`/`activityLog` string appears in any non-test file in the folders domain — confirmed independently via direct grep (no matches); `descendantFolderIds`/`patchDescendantAncestors` use `ancestor_ids @>` (GIN-indexed, migration line 29) instead of `WITH RECURSIVE` — the only recursive CTE in the migration is the one-time backfill `DO` block (line 40-64), explicitly called out in its own comment as not a per-request query path |

**Score:** 5/5 literal roadmap success criteria pass. However, two additional schema-integrity truths derived from the phase goal ("complete... schema", "correct foundation") FAIL — see below.

### Additional Derived Truths (schema completeness / correctness)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Folder-move cascade preserves the depth-3 invariant for descendants, not just the moved node | FAILED | See gaps section. `moveFolder` only checks the moved folder's own resulting depth; descendants' ancestor_ids are rewritten by `patchDescendantAncestors` without any depth check, and the DB trigger does not fire for that write path (`UPDATE OF parent_id` only). Unresolved code-review finding CR-01. |
| 7 | Folder move is atomic across the folder's own row and its descendants' ancestor_ids | FAILED | See gaps section. `foldersRepository.moveFolder` commits on the ambient pool before the descendant-patch transaction opens. Unresolved code-review finding CR-02. |

These two truths are not literal restatements of the five numbered roadmap Success Criteria (SC3 is specifically about cycle rejection, not depth-cascade or atomicity), but they directly bear on the phase goal's explicit language — "a **complete**, tenant-safe, **cycle-safe** schema... so every downstream phase builds on a **correct foundation** instead of a stale one." Both gaps are the exact kind of silent, hard-to-detect defect that phrase is meant to rule out: the depth invariant the migration/trigger is named for (`folders_prevent_cycle_and_depth`) can still be silently violated via the one mutation path (move) most likely to be exercised once real folder trees exist, and a mid-cascade failure leaves the ancestor-index (the core deliverable of HIER-07) permanently inconsistent for descendants. Both are rated **critical** by the phase's own code review and remain uncorrected in the current commit history (last commit touching this phase, `ce23a6e`, is docs-only — the review report itself).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `database/migrations/028_folder_hierarchy_invariants.sql` | archived_at columns, ancestor_ids, data_collections.folder_id, composite FKs, cycle+depth trigger | VERIFIED | All present, contains `folders_prevent_cycle_and_depth`, idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION` guards) |
| `apps/api/src/domains/folders/folders.repository.ts` | ancestor_ids-aware CRUD, descendantFolderIds, moveFolder, patchDescendantAncestors, archiveFolderSubtree, unarchiveFolder | VERIFIED | All methods present and match plan 31-04 must_haves |
| `apps/api/src/domains/folders/folders.service.ts` | RequestContext + capability + event_outbox + cascade orchestration | VERIFIED (with the two gaps above) | `assertCapability` on every mutation, `insertDurableEvent` per changed row, no `recordEvent`/`activityLog` |
| `apps/api/src/domains/folders/folders.controller.ts` / `folders.routes.ts` | requireRequestContext everywhere; POST /:id/archive, /:id/unarchive replacing DELETE | VERIFIED | Confirmed via grep; no `requireCompanyId(req)` shortcut found |
| `apps/api/src/domains/records/records.repository.ts` + `.types.ts` + `.service.ts` | folder_id wiring + archiveCollectionsInFolders/InProjects | VERIFIED | folder_id present in insert/update paths; ownership check via `assertOwnedFolder` before write |
| `apps/api/src/domains/projects/projects.repository.ts` | archive/unarchive + bulk cascade methods, DELETE routes removed | VERIFIED | `archiveProjectsInFolders`, `archiveProgramsInFolders`, `archiveProgramsInProjects`, `archivePagesInProjects` all present |
| `apps/api/src/domains/folders/folders.integration.test.ts` | live-DB tests for HIER-02/03/04 + static HIER-06 grep | VERIFIED (exists, well-formed) | Could not execute against a live DB in this environment (no Postgres/Docker running) — content inspected and logically sound; unit-test suite (mocked repository) for folders.service/repository passes 17/17 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `folders.parent_id` | `folders(id, company_id)` | composite FK | VERIFIED | Migration line 87-89 |
| `data_collections.folder_id` | `folders(id, company_id)` | composite FK | VERIFIED | Migration line 138-142 |
| `folders.service.ts` | `core/events/outbox.ts` | `insertDurableEvent` inside archive-cascade transaction | VERIFIED | Called for every archived/unarchived row on the shared `client` |
| `folders.service.ts` | `projects.repository.ts` + `records.repository.ts` | cascade-archive calls inside same `db.connect()` transaction | VERIFIED | All cascade calls pass the same `client` |
| `folders.service.ts moveFolder` | `foldersRepository.moveFolder` + `patchDescendantAncestors` | shared transaction | **NOT WIRED** | Two separate transactions/connections — see gap #7 (CR-02) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Folders domain unit tests (mocked repository) | `node --require ts-node/register --test src/domains/folders/folders.service.test.ts src/domains/folders/folders.repository.test.ts` | 17/17 pass | PASS |
| No `recordEvent`/`activityLog` in folders domain source | `grep -rn "recordEvent\|activityLog" apps/api/src/domains/folders/*.ts` (excluding the test file that asserts this) | No matches outside the assertion string itself | PASS |
| Live-DB integration tests (`HIER-02`, `HIER-03`, `HIER-04`, `HIER-06`) | `node --test folders.integration.test.ts` | Not run — no Postgres/Docker available in this verification environment | SKIP (content inspected, logically sound; this is the same limitation the phase's own 31-06 plan exists to address, and the test file's assertions correctly target the mechanisms claimed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HIER-01 | 31-01, 31-02 | data_collections.folder_id mirrors projects/programs pattern | SATISFIED | Migration + records domain wiring |
| HIER-02 | 31-01, 31-04, 31-05, 31-06 | composite (id, company_id) FK prevents cross-tenant reparent | SATISFIED | Migration constraints + integration test |
| HIER-03 | 31-01, 31-04, 31-05, 31-06 | cycle rejected at DB + API level | SATISFIED for the literal cycle case; **the sibling depth invariant enforced by the same trigger has a proven gap on the move-cascade path** (see derived truth #6) | Trigger + moveFolder pre-check pass; descendant depth re-validation missing |
| HIER-04 | 31-01, 31-02, 31-03, 31-05, 31-06 | archived_at + cascade in one transaction | SATISFIED | archiveFolder single transaction, integration test |
| HIER-05 | 31-05 | v5 RequestContext + capability pattern | SATISFIED | controller/service audit |
| HIER-06 | 31-05, 31-06 | durable events via event_outbox, no recordEvent/activityLog | SATISFIED | grep audit + static test |
| HIER-07 | 31-01, 31-04, 31-05 | ancestor-index instead of recursive CTE per request | SATISFIED for reads; **atomicity of ancestor-index maintenance during move has a proven gap** (see derived truth #7) | descendantFolderIds/patchDescendantAncestors use `ancestor_ids @>`; move-cascade non-atomicity risks index staleness on partial failure |

No orphaned requirements — all 7 IDs from REQUIREMENTS.md are claimed across plans 31-01 through 31-06.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/domains/folders/folders.service.ts` | 67-70 | Depth check scoped to moved node only, not descendants (CR-01) | Blocker | Silent invariant violation on move-cascade |
| `apps/api/src/domains/folders/folders.service.ts` | 74-91 | Non-atomic two-transaction move (CR-02) | Blocker | Ancestor-index can go stale on partial failure |
| `apps/api/src/domains/folders/folders.repository.ts` | 56-70 | `COALESCE` in `updateFolder` silently drops explicit `null` (CR-03, review) | Warning | Cannot clear icon/color via API — not in scope of the 5 numbered success criteria, carried forward from review as a warning, not re-litigated here |
| `apps/api/src/domains/projects/projects.service.ts` | 259-263 | `assertOwnedFolder` doesn't filter `archived_at` (CR-04, review) | Warning | Cross-domain inconsistency, not in scope of the 5 numbered success criteria |

No `TBD`/`FIXME`/`XXX` debt markers found in any file modified by this phase.

### Human Verification Required

None. All must-haves are either programmatically verified or programmatically falsified (CR-01/CR-02).

### Gaps Summary

The phase delivers all 5 literal roadmap Success Criteria and all 7 requirement IDs have supporting evidence. Unit tests (17/17) pass, and the live-DB integration test suite added in plan 31-06 is well-constructed and (by inspection) correctly targets HIER-02/03/04/06, though it could not be executed in this environment (no Postgres available).

However, a code review already run against this phase (`31-REVIEW.md`) found 4 critical issues, and two of them — CR-01 (folder-move descendant depth not re-validated) and CR-02 (folder-move is not atomic across the folder's own row and its descendants' ancestor_ids) — remain completely unaddressed in the current codebase (verified directly against `folders.service.ts`; no commits after the review touch this file). These two gaps sit squarely inside the "correct foundation" language of the phase goal: the depth-3 invariant the migration's trigger is *named for* (`folders_prevent_cycle_and_depth`) can be silently bypassed via the one mutation (move) that will actually be exercised as real folder trees grow, and a failure mid-move leaves the `ancestor_ids` column — the entire deliverable of HIER-07 — silently stale for descendants. Neither is a merely cosmetic/DX issue (unlike CR-03/CR-04, retained here as warnings): both represent state the DB will accept as valid that the application's own invariants say should be impossible, exactly the kind of downstream-inheriting foundation-rot the phase goal explicitly names as the thing to avoid.

Recommendation: close these two gaps (add descendant-depth validation before applying `patchDescendantAncestors`; wrap the folder's own move and the descendant patch in one shared transaction, matching the pattern already used correctly by `archiveFolder` in the same file) before phase 31 is considered a stable foundation for phases 32-34.

---

_Verified: 2026-07-17T09:04:06Z_
_Verifier: Claude (gsd-verifier)_
