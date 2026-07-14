---
phase: 23
slug: record-detail-page
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-14
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (backend, existing) — no frontend test framework detected in `apps/workspaces` |
| **Config file** | none — backend uses `node --require ts-node/register --test` per `records.repository.test.ts`/`records.service.test.ts` (Phase 22 precedent) |
| **Quick run command** | `npm --prefix apps/api test` (backend contract regression check; no backend changes expected this phase) |
| **Full suite command** | `npm --prefix apps/api test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit -p apps/workspaces/tsconfig.json` (or `npm --prefix apps/workspaces run build` if no standalone tsconfig gate) for any frontend file touched; `npm --prefix apps/api test` if any backend file touched (unlikely — Phase 22 API is expected to be consumed as-is)
- **After every plan wave:** `npm --prefix apps/api test` (if backend touched) + Next.js build for `apps/workspaces`
- **Before `/gsd:verify-work`:** Full suite must be green; manual UI verification required (no frontend test framework exists in this repo — consistent with Phase 21 precedent)
- **Max feedback latency:** ~30 seconds (build/typecheck) — UI behaviors verified manually per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | CARD-01 | V4 (company scoping) | Record not found in own company renders 404 fallback, not a crash | manual/UI | — (no frontend test framework) | N/A | ⬜ pending |
| 23-01-02 | 01 | 1 | CARD-04 | V5 (XSS via body) | Record body reuses `LivePageCanvas`/DOMPurify path, no new sanitization gap | manual/UI | — | N/A | ⬜ pending |
| 23-02-01 | 02 | 2 | CARD-02 | V5 (input validation) | Property edits round-trip through existing `UpdateRecordSchema`/`validatePropValue` | manual/UI + backend contract | `npm --prefix apps/api test` | ✅ existing (`records.service.test.ts`) | ⬜ pending |
| 23-02-02 | 02 | 2 | CARD-03 | V5 (input validation) | Schema update (`PATCH /collections/:id`) completes before dependent record write (`PATCH /records/:id`), avoiding "Unknown property" 400 | manual/UI + backend contract | `npm --prefix apps/api test` | ✅ existing (`records.service.test.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new backend tests are anticipated (Phase 22's `records.service.test.ts`/`records.repository.test.ts` already cover every backend contract this phase depends on). No frontend test framework exists in `apps/workspaces` — this is a pre-existing, repo-wide gap, not specific to this phase; plans should rely on `tsc`/Next.js build + manual verification, consistent with every prior frontend-only phase (Phase 21, CRM phases).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clicking a record opens a detail page/panel showing title, property panel, body | CARD-01 | No frontend test framework (Jest/Vitest/Playwright) in `apps/workspaces` | Navigate to a collection, click a record row, confirm title + property panel + body render |
| Editing a property via type-appropriate editor persists | CARD-02 | Same — UI interaction, no frontend test harness | Change a select/date/checkbox/person property value, reload page, confirm value persisted |
| Adding a new property from the record detail panel updates the collection schema and appears on other records | CARD-03 | Same | Add a property on one record, open a second record in the same collection, confirm the new property appears (empty) |
| Record body supports full existing editor (slash menu, headings, checklists, Phase 21 blocks) | CARD-04 | Same | Open record body, invoke slash menu, insert a heading + checklist + one Phase 21 block (e.g. toggle), confirm all render/save correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
