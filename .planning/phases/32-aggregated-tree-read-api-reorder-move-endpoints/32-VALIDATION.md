---
phase: 32
slug: aggregated-tree-read-api-reorder-move-endpoints
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` runner, via `ts-node/register` |
| **Config file** | none — driven by `package.json` script: `"test": "node --require ts-node/register --test src/**/*.test.ts"` (apps/api) |
| **Quick run command** | `node --require ts-node/register --test src/domains/folders/**/*.test.ts` |
| **Full suite command** | `npm test` (apps/api) |
| **Estimated runtime** | ~unknown, existing suite runs in low tens of seconds per Phase 31 |

---

## Sampling Rate

- **After every task commit:** Run `node --require ts-node/register --test src/domains/folders/**/*.test.ts`
- **After every plan wave:** Run `npm test` (apps/api)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 32-01 | 1 | TREEAPI-01/02/03 | V4/V5 | `029_tree_sort_order.sql` + `ReorderNodesSchema`/`MoveNodeSchema` (with project_id disambiguator) + `TreeNode` type + concurrency race harness | unit | `tsc --noEmit` + `concurrentRace.test.ts` | ✅ built in 32-01 | ✅ green |
| 32-02-01 | 32-02 | 2 | TREEAPI-02 | V4 | Lock-safe reorder repository primitives (`reorderFolders`/`reorderProjects`/`reorderPrograms`/`reorderCollections`) | unit (mocked PoolClient) | `projects.repository.test.ts` + `folders.repository.test.ts` + `records.repository.test.ts` | ✅ built in 32-02 | ✅ green |
| 32-03-01 | 32-03 | 2 | TREEAPI-01 | V4/V5 | `GET /folders/tree/full` returns full tree in exactly 5 queries, no per-node fan-out | unit + integration | `folders.service.test.ts` (extend) + `folders.integration.test.ts` (extend) | ✅ built in 32-03 | ✅ green |
| 32-04-01 | 32-04 | 3 | TREEAPI-02/04 | V4 | Reorder is lock-safe under concurrent requests, no lost updates, dispatches both folder-scoped and project-scoped programs | unit + integration (two concurrent `PoolClient` transactions) | `folders.service.test.ts` (extend) + new `folders.reorder-concurrency.integration.test.ts` | ✅ built in 32-04 | ✅ green |
| 32-05-01 | 32-05 | 4 | TREEAPI-03/04 | V4 | Move rejects cycles (folder) and cross-tenant destinations (all node types, including project-scoped programs) with distinguishing errors | unit + integration | extend `folders.service.test.ts` + `folders.integration.test.ts` | ✅ built in 32-05 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] New concurrent-transaction test harness (two racing `PoolClient` sessions against a live test DB) for TREEAPI-02 — built from scratch in 32-01 (`concurrentRace.ts`/`concurrentRace.test.ts`), consumed live by 32-04's `folders.reorder-concurrency.integration.test.ts`
- [x] `029_tree_sort_order.sql` migration apply/idempotent-rerun check — built in 32-01, verified idempotent (`IF NOT EXISTS` on every statement, double-apply proof)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification (concurrent-lock test is automated once Wave 0 harness exists, not manual).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-17
