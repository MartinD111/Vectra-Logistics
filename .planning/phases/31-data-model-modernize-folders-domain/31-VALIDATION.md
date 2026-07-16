---
phase: 31
slug: data-model-modernize-folders-domain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` runner, via `ts-node/register` |
| **Config file** | none — driven by `package.json` script: `"test": "node --require ts-node/register --test src/**/*.test.ts"` (apps/api) |
| **Quick run command** | `node --require ts-node/register --test src/domains/folders/**/*.test.ts` |
| **Full suite command** | `npm test` (apps/api) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --require ts-node/register --test src/domains/folders/**/*.test.ts`
- **After every plan wave:** Run `npm test` (apps/api full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-xx | TBD | TBD | HIER-01 | — | `data_collections.folder_id` accepts a valid folder, rejects a different tenant's folder | unit | `node --require ts-node/register --test src/domains/records/records.repository.test.ts` | ✅ file exists, needs new case |
| 31-01-xx | TBD | TBD | HIER-02 | T-31-01 | Cross-tenant reparent attempt rejected at DB level (constraint violation) | integration | new test file against test DB connection | ❌ Wave 0 |
| 31-01-xx | TBD | TBD | HIER-03 | T-31-02 | Cycle move rejected at both DB and API level | unit + integration | `folders.service.test.ts` (extend) + new DB-level test | ⚠️ service test exists, DB test is Wave 0 |
| 31-01-xx | TBD | TBD | HIER-04 | — | Archiving a folder cascades to all descendant types in one transaction | integration | new integration test hitting test DB | ❌ Wave 0 |
| 31-01-xx | TBD | TBD | HIER-05 | T-31-03 | Every folder mutation uses RequestContext + capability assertion | unit | extend `folders.service.test.ts` — assert `assertCapability`/`requireCompanyId` invoked | ⚠️ needs new cases |
| 31-01-xx | TBD | TBD | HIER-06 | — | No `recordEvent`/`activityLog` calls remain; durable events written | unit + static check | extend service test to assert `insertDurableEvent`/`event_outbox` call; grep-based static check that `recordEvent` import is gone | ❌ Wave 0 (static check is manual, no existing tooling) |
| 31-01-xx | TBD | TBD | HIER-07 | — | Ancestor/breadcrumb lookup uses ancestor-index, not recursive CTE | unit | extend `folders.service.test.ts` with call-count assertion on repository mock | ⚠️ needs new cases |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `folders.repository.test.ts` — does not exist yet (only `folders.service.test.ts` does); needed for ancestor-array/composite-FK-aware repository methods
- [ ] New integration test file(s) against a test DB connection for HIER-02 (cross-tenant reparent rejection) and HIER-04 (cascade archive transaction)
- [ ] New DB-level test for HIER-03 cycle-rejection trigger
- [ ] Static "no `recordEvent` import remains" check — no existing lint tooling in this repo; treat as a manual grep-based verification step (documented in Manual-Only Verifications below), not an automated test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No `recordEvent()`/`activityLog` calls remain in the folders domain | HIER-06 | No custom ESLint rule or static-analysis tooling exists in this repo to automate this check | Run `grep -rn "recordEvent\|activityLog" apps/api/src/domains/folders/` — must return no matches (excluding test files/comments) before phase sign-off |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
