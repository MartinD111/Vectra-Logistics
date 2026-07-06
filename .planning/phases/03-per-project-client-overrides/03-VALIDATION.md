---
phase: 03
slug: per-project-client-overrides
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-06
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no automated test framework exists anywhere in this monorepo (confirmed: no `jest.config.*`/`vitest.config.*`, no `*.test.ts`/`*.spec.ts` files, no `test` script in `apps/api/package.json`) |
| **Config file** | none |
| **Quick run command** | — (no automated test runner configured) |
| **Full suite command** | — (no automated test runner configured) |
| **Estimated runtime** | N/A |

This matches Phase 2's precedent (`02-HUMAN-UAT.md`): manual UAT is the established and accepted verification method for this project. Introducing a test framework is out of scope for this phase per CLAUDE.md's "reuse over rebuild" constraint.

---

## Sampling Rate

- **After every task commit:** Manual smoke test of the specific endpoint/UI just built (e.g., curl the new DELETE route, or click through the new picker).
- **After every plan wave:** Full manual click-through of attach → override each field independently → verify global/other-project isolation → unlink → re-attach.
- **Before `/gsd:verify-work`:** Human UAT checklist completed (mirroring `02-HUMAN-UAT.md`'s format).
- **Max feedback latency:** N/A (manual verification, no automated latency budget)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-* | 01 | 1 | CLI-04 | V4 Access Control | Cross-company `project_id` attach attempt rejected 403/404 | manual | — | ❌ W0 (no framework) | ⬜ pending |
| 03-01-* | 01 | 1 | CLI-04 | — | Unlink deletes row; re-attach starts fresh with no prior overrides | manual | — | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | 2 | CLI-05 | — | Setting an override on one field doesn't affect the other two fields on the same link | manual | — | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | 2 | CLI-05 | — | Clearing an override reverts display to the global default value | manual | — | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | 2 | CLI-05 | — | Overriding a field on Project A doesn't change the client's global value nor Project B's resolved values | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are placeholders (`03-01-*`) — the planner will assign concrete task IDs; this table's requirement/behavior mapping stays fixed regardless of exact task numbering.*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements via manual UAT — no automated test framework is being introduced this phase (see Test Infrastructure above). This is an accepted, non-blocking condition per Phase 2 precedent, not a gap to remediate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Attach client to project via picker; row appears in Linked Projects | CLI-04 | No test framework project-wide | Open client detail page → Linked Projects → Attach project → select a project → verify row appears |
| Cross-company `project_id` attach attempt is rejected | CLI-04 | No test framework project-wide; requires crafting a request with another company's project ID | POST to `/clients/:id/projects` with a `project_id` belonging to a different company → expect 403/404, not 200 |
| Per-field override isolation (rate/employee/notes independent) | CLI-05 | No test framework project-wide | Override only "rate" on a link → confirm employee/notes still show global values (not cleared) |
| Clearing an override reverts to global default | CLI-05 | No test framework project-wide | Set an override, then click reset → confirm displayed value reverts to client's global default |
| Override isolation across client/other projects | CLI-05 | No test framework project-wide | Override rate on Project A → confirm client's global `default_rate_eur` unchanged and Project B's resolved rate unaffected |
| Unlink deletes row; re-attach has no residual overrides | D-05 | No test framework project-wide | Unlink a project with overrides set → re-attach same project → confirm all 3 fields show global values (no override survives) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — N/A, manual-only phase per accepted project precedent
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — N/A (no automated verify exists project-wide; manual smoke test after every task commit per Sampling Rate above)
- [x] Wave 0 covers all MISSING references — no MISSING references; manual UAT is the accepted baseline
- [x] No watch-mode flags — N/A, no test runner
- [x] Feedback latency < N/A — manual verification, no automated latency budget
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-06
