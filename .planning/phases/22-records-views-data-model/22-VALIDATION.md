---
phase: 22
slug: records-views-data-model
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 22-01-01 | 01 | 0 | REC-01 | V4 | company_id scoping on collection create | unit | `node --require ts-node/register --test src/domains/records/records.service.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 0 | REC-02 | V5 | props/body validated before write | unit | `node --require ts-node/register --test src/domains/records/records.service.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 0 | REC-03 | V4 | view config round-trips unchanged, company-scoped | unit | `node --require ts-node/register --test src/domains/records/records.service.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-04 | 01 | 0 | REC-04 | V4 | parent/child query scoped to company | unit | `node --require ts-node/register --test src/domains/records/records.repository.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-05 | 01 | 0 | REC-02 (D-02) | V5 | prop-type mismatch rejected with 400 | unit | `records.service.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-06 | 01 | 0 | REC-01 (D-03) | — | collection create auto-creates default table view | unit | `records.service.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/domains/records/records.service.test.ts` — stubs for REC-01, REC-02, REC-03, D-02, D-03
- [ ] `apps/api/src/domains/records/records.repository.test.ts` — stubs for REC-04 (parent/child queries); decide DB-mocking vs. live-DB strategy for repository-level tests (no existing repository-test convention found in the codebase — this is a new pattern for this phase)
- [ ] Framework install: none — `node --test` + `ts-node` already present and used elsewhere

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
