---
phase: 32
slug: aggregated-tree-read-api-reorder-move-endpoints
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 32-01-01 | TBD | 0 | TREEAPI-01 | V4/V5 | `GET /folders/tree/full` returns full tree in exactly 5 queries, no per-node fan-out | unit + integration | `folders.service.test.ts` (extend) + `folders.integration.test.ts` (extend) | ⚠️ files exist from Phase 31 | ⬜ pending |
| 32-02-01 | TBD | 0 | TREEAPI-02 | V4 | Reorder is lock-safe under concurrent requests, no lost updates | integration (two concurrent `PoolClient` transactions) | new integration test | ❌ Wave 0 — no concurrent-test harness precedent in this codebase | ⬜ pending |
| 32-03-01 | TBD | 0 | TREEAPI-03 | V4 | Move rejects cycles (folder) and cross-tenant destinations (all node types) with distinguishing errors | unit + integration | extend `folders.service.test.ts` + `folders.integration.test.ts` | ⚠️ folder cycle/cross-tenant DB tests exist from 31-06; need new project/program/collection cases | ⬜ pending |
| 32-04-01 | TBD | 0 | TREEAPI-04 | V4 | Every mutation endpoint (reorder, move) requires `workspace.admin` | unit | extend `folders.service.test.ts` — assert 403 without capability | ⚠️ same pattern as existing `moveFolder`/`archiveFolder` tests | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New concurrent-transaction test harness (two racing `PoolClient` sessions against a live test DB) for TREEAPI-02 — no prior art in this codebase, must be built from scratch
- [ ] `029_tree_sort_order.sql` migration apply/idempotent-rerun check — requires reachable Docker/Postgres (same access gap Phase 31 hit in this environment)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification (concurrent-lock test is automated once Wave 0 harness exists, not manual).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
