---
phase: 25
slug: view-ux-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`), backend only — no frontend test framework exists in `apps/workspaces` |
| **Config file** | none — invoked directly via `apps/api/package.json`'s `"test": "node --require ts-node/register --test src/**/*.test.ts"` |
| **Quick run command** | `cd apps/api && npm test -- src/domains/records/records.service.test.ts` |
| **Full suite command** | `cd apps/api && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- src/domains/records/records.service.test.ts` (only for tasks touching backend view/record logic; most Phase 25 tasks are frontend-only and have no automated quick-run — rely on manual smoke test instead)
- **After every plan wave:** Run `cd apps/api && npm test` (full backend suite; frontend has no runnable suite)
- **Before `/gsd:verify-work`:** Full backend suite must be green, plus a manual/live smoke test covering filter/sort, card-face picker, column aggregations, and view switching
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | VIEWX-01 | — | N/A | integration | `cd apps/api && npm test -- src/domains/records/records.service.test.ts` | ✅ | ⬜ pending |
| 25-0X-XX | TBD | TBD | VIEWX-02 | — | N/A | manual | live smoke test (no FE framework) | ❌ manual-only | ⬜ pending |
| 25-0X-XX | TBD | TBD | VIEWX-03 | — | N/A | manual/unit | live smoke test; pure aggregation math is a high-value manual-first candidate | ❌ manual-only | ⬜ pending |
| 25-0X-XX | TBD | TBD | VIEWX-04 | — | N/A | integration/manual | Backend: existing `createView`/`updateView` tests cover API surface; "no duplicate records" is a frontend behavioral guarantee verified via manual smoke test | ✅ backend / ❌ FE manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact task IDs are finalized once the planner emits PLAN.md files — update this map's Task ID/Plan/Wave columns to match.*

---

## Wave 0 Requirements

- Existing infrastructure covers all backend-side phase requirements (no new backend endpoints planned). If the planner adds backend-side aggregation/filter validation, add corresponding cases to `apps/api/src/domains/records/records.service.test.ts` under Wave 0.
- No frontend test framework exists in this repo — frontend behaviors (filter/sort application, card-face picker, aggregations, view switching) are manual-only for this phase; do not block on adding one unless the planner explicitly scopes it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filter/sort application updates the visible record list | VIEWX-01 | No frontend test framework in this repo | Open a collection-view block, add a filter condition and a sort, confirm the record list re-renders to match |
| Card-face property picker changes which properties render on a card | VIEWX-02 | No frontend test framework | Open the card-face picker, toggle properties, confirm `BoardCard` reflects the selection |
| Column aggregations show correct count/sum/avg | VIEWX-03 | No frontend test framework; pure-function math is verifiable but no FE unit test runner exists | Add a number property, select sum/avg on a board column, confirm displayed value matches manual calculation of visible cards |
| Switching a `collection-view` block between view types does not duplicate records | VIEWX-04 | Behavioral guarantee about record identity across UI state, not covered by existing backend tests | Switch a block from board to another view type and back, confirm `collection_records` count is unchanged (check via API or DB) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
