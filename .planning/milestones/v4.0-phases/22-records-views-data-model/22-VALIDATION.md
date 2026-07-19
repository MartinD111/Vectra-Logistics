---
phase: 22
slug: records-views-data-model
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) via `ts-node/register` |
| **Config file** | none — driven by `apps/api/package.json` `"test"` script: `node --require ts-node/register --test src/**/*.test.ts` |
| **Quick run command** | `npm --prefix apps/api test -- src/domains/records/*.test.ts` |
| **Full suite command** | `npm --prefix apps/api test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --require ts-node/register --test src/domains/records/*.test.ts`
- **After every plan wave:** Run `npm --prefix apps/api test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-02-01 (RED) | 02 | 2 | REC-04 | V4 | parent/child query scoped to company | unit | `node --require ts-node/register --test src/domains/records/records.repository.test.ts` | ✅ created in-task | ⬜ pending |
| 22-02-02 (GREEN) | 02 | 2 | REC-01, REC-04, D-03 | V4 | atomic collection+default-view create (BEGIN/COMMIT/ROLLBACK) | unit | `node --require ts-node/register --test src/domains/records/records.repository.test.ts` | ✅ | ⬜ pending |
| 22-03-01 (RED) | 03 | 3 | REC-01, REC-02, REC-03 | V5 | prop-type mismatch rejected with 400 | unit | `node --require ts-node/register --test src/domains/records/records.service.test.ts` | ✅ created in-task | ⬜ pending |
| 22-03-02 (GREEN) | 03 | 3 | REC-02 (D-02), REC-03 | V5 | validateProps switch-based type check; view config round-trip | unit | `node --require ts-node/register --test src/domains/records/records.service.test.ts` | ✅ | ⬜ pending |
| 22-04-01 | 04 | 4 | REC-01..04 | V2, V4 | controller/routes wired behind `authenticateToken` + company scoping | behavior | `npm --prefix apps/api test` | ✅ | ⬜ pending |
| 22-04-02 | 04 | 4 | REC-01..04 | — | domain registered in `domains/index.ts`, server boots | CLI | `npm --prefix apps/api run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None — this phase uses TDD RED/GREEN task pairs (Plans 22-02 and 22-03), which create and verify their own test files inline rather than relying on a separate Wave 0 plan. Existing infrastructure (`node --test` + `ts-node`) covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
