---
phase: 33
slug: tree-based-sidebar-ui-read-navigate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected in `apps/workspaces` (no `jest.config.*`, `vitest.config.*`, or `__tests__`/`*.test.*` files under `apps/workspaces/src`) |
| **Config file** | none — see Wave 0 Requirements |
| **Quick run command** | n/a — no test runner configured for this app |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a |

---

## Sampling Rate

- **After every task commit:** Manual verification in dev server (no automated quick-run available)
- **After every plan wave:** Manual click-through of sidebar + breadcrumbs across at least one project, one page, one record, one archived item
- **Before `/gsd:verify-work`:** Manual QA pass — no automated full suite exists for `apps/workspaces`
- **Max feedback latency:** n/a (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TREEUI-01 | — | Sidebar renders real tree instead of flat `ITEMS` | manual | — | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREEUI-02 | — | Expand/collapse persists per-user across sessions | manual | — | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREEUI-03 | — | Module visibility correct at every depth | unit (pure `pruneTree`, see Wave 0) | n/a — no runner | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREEUI-04 | — | Breadcrumbs reflect live ancestor path | manual | — | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TREEUI-05 | — | Deep links / cross-app links unchanged | manual (regression) | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner fills in Plan/Wave/Task IDs once tasks are assigned.*

---

## Wave 0 Requirements

- [ ] No test framework configured in `apps/workspaces` at all — installing one (e.g. Vitest + React Testing Library) is out of scope for this phase unless the planner decides `pruneTree`/`isArchived`/`findPath` (all pure, dependency-free functions) are valuable enough to justify introducing a minimal test setup just for them.
- [ ] If a test framework is introduced: `treeFilters.test.ts` covering TREEUI-03 (module + archive pruning) and `Breadcrumbs`'s `findPath` covering TREEUI-04 — both are pure functions well-suited to unit tests without DOM/network mocking.

*If the planner decides not to introduce a test framework this phase: "None — manual QA covers all phase requirements, consistent with the rest of `apps/workspaces` having no existing automated frontend test suite."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar tree render + expand/collapse | TREEUI-01, TREEUI-02 | No frontend test runner in `apps/workspaces`; visual/interaction behavior | Load workspace, expand/collapse several tree nodes, reload browser, confirm state persists |
| Module-aware visibility at depth | TREEUI-03 | Requires a workspace with varied `enabled_modules` to observe pruning | Toggle a module off for a test tenant, confirm nodes of that type (and now-empty parent folders) disappear from the tree at all depths |
| Breadcrumb ancestor path | TREEUI-04 | Requires live navigation across nested project/page/record views | Navigate to a nested record via a deep link (cold load) and via sidebar click; confirm breadcrumb ancestor chain matches in both cases |
| Deep link / cross-app link regression | TREEUI-05 | Requires exercising existing Outlook-synced CRM links and `crossAppUrl` targets | Click existing CMR Manager link and a stored deep link; confirm both still resolve correctly post-change |
| Archived-node exclusion | TREEUI-03 (D-12) | `data_collections`/`project_pages` lack server-side `archived_at` filtering — must verify client-side filter catches this | Archive a record/page, confirm it disappears from the tree while its sibling folders/projects remain visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < n/a (manual-only phase)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
