---
phase: 34
slug: drag-to-reorder-reparent-create-rename-archive-flows
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-20
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected in `apps/workspaces` — no `*.test.*`/`*.spec.*` files, no `jest.config.*`/`vitest.config.*` found for this app |
| **Config file** | none — introducing a frontend test runner is out of scope for this UI phase |
| **Quick run command** | none available |
| **Full suite command** | none available |
| **Estimated runtime** | N/A — manual browser verification only |

---

## Sampling Rate

- **After every task commit:** Manual browser verification of the specific behavior the task implements (no automated frontend test runner exists in `apps/workspaces`)
- **After every plan wave:** Manual click-through of the full create → rename → drag-reorder → drag-reparent → archive → (optional) undo flow
- **Before `/gsd:verify-work`:** Full manual walkthrough, given the total absence of frontend test infrastructure in `apps/workspaces`
- **Max feedback latency:** N/A (manual-only; no automated command to time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-* | 01 | 0 | TREEOPS-01..06 (prereq) | — | Frontend API/hook wrappers for archive/unarchive/reorder/moveNode call the correct endpoints with correct payload shape | manual | — | ❌ W0 | ⬜ pending |
| 34-*-* | * | * | TREEOPS-01 | — | Create folder/project via context menu lands as a child of the right-clicked folder (or root) | manual | — | ❌ no test infra | ⬜ pending |
| 34-*-* | * | * | TREEOPS-02 | — | Inline rename persists on commit, reverts on Escape/empty | manual | — | ❌ no test infra | ⬜ pending |
| 34-*-* | * | * | TREEOPS-03 | — | Sibling reorder persists correct `ordered_ids` scoped by node_type+parent | manual | — | ❌ no test infra | ⬜ pending |
| 34-*-* | * | * | TREEOPS-04 | T-34-01 | Illegal reparent surfaces the exact server error text (`"Cannot move a folder into its own descendant"` / `"Folder nesting cannot exceed depth 3"`), never a silent snap-back | manual | — | ❌ no test infra | ⬜ pending |
| 34-*-* | * | * | TREEOPS-05 | — | Archive confirmation shows correct per-type descendant counts before confirming | manual | — | ❌ no test infra | ⬜ pending |
| 34-*-* | * | * | TREEOPS-06 | — | Archived node disappears from default tree view immediately after archiving | manual | — | ❌ no test infra | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are finalized once the planner assigns concrete plan/task numbers; this table's Req→Behavior mapping is authoritative and must be threaded through whatever task IDs the planner assigns.*

---

## Wave 0 Requirements

- [ ] `apps/workspaces/src/lib/api/folders.api.ts` — add `archiveFolder`, `unarchiveFolder`, `reorderNodes`, `moveNode` wrappers (missing per RESEARCH.md's critical-gap finding; backend routes already exist)
- [ ] `apps/workspaces/src/lib/api/projects.api.ts` — add matching `archiveProject`/`unarchiveProject` wrappers if not already present
- [ ] `apps/workspaces/src/lib/hooks/useFolders.ts` / `useProjects.ts` — mutation hooks wrapping the above, each explicitly invalidating `qk.fullTree` (RESEARCH.md notes `invalidateFolderAffectedQueries` does NOT cover this key today — must be added explicitly per mutation, not assumed)

*No frontend test framework install this phase — introducing Jest/Vitest + RTL for `apps/workspaces` is explicitly out of scope per RESEARCH.md's framing; flagged as a known gap, not silently defaulted.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create folder/project at correct tree position via context menu | TREEOPS-01 | No frontend test runner in `apps/workspaces` | Right-click a folder row → "New Folder" → confirm new node appears as its child; repeat from empty tree space → confirm new node appears at root |
| Inline rename commit/cancel | TREEOPS-02 | No frontend test runner | Trigger rename, type new name, press Enter → confirm persisted after reload; trigger rename, press Escape → confirm original name unchanged; trigger rename, clear to empty, attempt commit → confirm rejected/reverted |
| Sibling drag-reorder | TREEOPS-03 | No frontend test runner | Drag a folder/project to a new position among siblings → reload → confirm new order persisted |
| Drag-reparent + illegal drop feedback | TREEOPS-04 | No frontend test runner | Drag a folder onto a valid new parent → confirm move persists; drag a folder onto its own descendant → confirm inline error shows the exact text "Cannot move a folder into its own descendant" (not a generic message) and the node snaps back with visible reason; attempt to nest past depth 3 → confirm "Folder nesting cannot exceed depth 3" surfaces the same way |
| Archive confirmation descendant counts | TREEOPS-05 | No frontend test runner | Right-click a folder with known descendants → Archive → confirm dialog shows correct per-type counts matching the actual tree contents before confirming |
| Archived node hidden, not deleted | TREEOPS-06 | No frontend test runner | Archive a folder/project → confirm it disappears from the default tree view → confirm the underlying row still exists (e.g. via direct API check or admin/DB check) rather than being deleted |
| Undo toast (leaf-node archives only) | TREEOPS-05 (D-07) | No frontend test runner | Archive a leaf project with zero descendants → confirm Undo toast appears and restores it; archive a folder with descendants → confirm no Undo toast appears (per D-07's leaf-only scoping) |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions (no automated frontend test infra exists in `apps/workspaces`; this is a documented, deliberate gap per RESEARCH.md, not an oversight)
- [x] Sampling continuity: manual walkthrough after every task commit and every wave merge
- [x] Wave 0 covers all MISSING references (frontend API/hook wrappers identified as the hard prerequisite)
- [x] No watch-mode flags (no test runner to configure)
- [x] Feedback latency N/A — manual-only, immediate browser verification per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-20
