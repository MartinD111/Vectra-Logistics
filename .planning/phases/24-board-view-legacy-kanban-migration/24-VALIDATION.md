---
phase: 24
slug: board-view-legacy-kanban-migration
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected in `apps/workspaces` (no `jest.config.*`/`vitest.config.*`/`__tests__` under `apps/workspaces/src`). `apps/api` has `*.test.ts` files for other domains but this phase adds no backend code. |
| **Config file** | none — see Wave 0 |
| **Quick run command** | n/a — no frontend test runner configured |
| **Full suite command** | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` (type-check only, not a behavior test) |
| **Estimated runtime** | ~10-20s (tsc) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit -p apps/workspaces/tsconfig.json`
- **After every plan wave:** Manual dev-server pass through the wave's slice of BOARD-01..04
- **Before `/gsd:verify-work`:** Full manual walkthrough of all four success criteria (see Manual-Only Verifications below) — no automated full suite exists for this app's frontend
- **Max feedback latency:** ~20s (tsc) for automated checks; manual checks are session-bound

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-* | 01 | 1 | BOARD-01/02/03 | T-24-* | n/a | type-check | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | ✅ | ⬜ pending |
| 24-02-* | 02 | 2 | BOARD-04 | T-24-* | n/a | type-check + manual | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None — no frontend test runner exists in `apps/workspaces` and introducing one is out of scope for this phase (cross-cutting infra decision, not board/migration work). This is a deliberate Wave 0 skip, not an oversight — flagged as tech debt for a future phase.

*Existing infrastructure (TypeScript strict mode + `tsc --noEmit`) is the only automated gate available; all behavioral correctness for BOARD-01 through BOARD-04 is manual-only per the reasoning below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Board renders columns from live select-property option values | BOARD-01 | No frontend test runner; requires live Postgres + browser render | Open a `collection-view` board block; confirm one column per option on the groupBy select property, no hand-authored columns |
| Drag card between columns updates `props[groupBy]`; reorder within column updates `sort_order` | BOARD-02 | Requires real `@dnd-kit` pointer/drag interaction in a browser; not exercisable via tsc/grep | Drag a card to a different column, reload — confirm new column persisted. Drag within a column, reload — confirm order persisted |
| Inline "+ New" card creation pre-sets column's groupBy value and enters inline-edit title state | BOARD-03 | Requires interactive DOM state (focus, inline edit) in a browser | Click "+ New" in a column, confirm new card appears with correct groupBy value pre-set and title is immediately editable in place |
| Legacy `kanban` block auto-migrates to `collection-view` on first edit, no data loss, one-time toast | BOARD-04 | Requires a live page with an existing legacy kanban block, a real edit action, and Postgres round-trip | Open a page with an existing `kanban` block, make any edit; confirm block swaps to `collection-view`, toast appears once, all cards/columns present with correct title/status mapping, and `drafts-kanban` blocks are untouched |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc) or are flagged manual-only above
- [ ] Sampling continuity: tsc runs after every task commit
- [ ] Wave 0 covers all MISSING references — N/A, no Wave 0 infra needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s (automated); manual checks documented above
- [ ] `nyquist_compliant: true` set in frontmatter — **pending planner confirmation that plans reference this file's manual verification steps**

**Approval:** pending
