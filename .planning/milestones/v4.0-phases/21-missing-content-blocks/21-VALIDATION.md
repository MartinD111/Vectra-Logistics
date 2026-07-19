---
phase: 21
slug: missing-content-blocks
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected in `apps/workspaces` (no jest/vitest/testing-library config or scripts). `apps/api` has a minimal `node --test` runner, irrelevant here (this phase is frontend-only). |
| **Config file** | none — see Wave 0 Requirements |
| **Quick run command** | N/A — no test runner configured for `apps/workspaces` |
| **Full suite command** | N/A |
| **Estimated runtime** | N/A |

---

## Sampling Rate

- **After every task commit:** Manual smoke-check in the running dev server (`npm run dev` in `apps/workspaces`) against the specific block just added.
- **After every plan wave:** Manual walkthrough of all newly-added slash-menu items plus a save/reload round-trip (catches the DOMPurify attribute-stripping bug class flagged in research).
- **Before `/gsd:verify-work`:** Full manual pass through all 5 phase success criteria.
- **Max feedback latency:** N/A (manual verification only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CONT-01 | V5 | DOMPurify sanitizes checklist item HTML | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-02 | — | Toggle collapse/expand persists nested children on reload | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-03 | V5 | Quote block sanitized on commit | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-04 | V5 | Code block language picker persists selection | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-05 | V4/V5 | Media blocks (image/file/video/bookmark/embed) validate URL client-side; uploads (if chosen) reuse `FileUploader` size/type constraints | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-06 | V5 | Inline table block HTML sanitized, distinct from collection-view table | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-07 | — | Multi-column layout renders nested children without `SortableContext` collisions | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-08 | V4 | Sub-page link creation flows through `authenticateToken` + company-scoped `projectsApi.createPage` | manual | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | CONT-09 | V5 | `@`-mention spans survive DOMPurify with explicit `ALLOWED_ATTR`/`ADD_ATTR`; mention data scoped to company (`teamApi.list()`) | manual | — | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled in once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] No frontend test framework installed in `apps/workspaces`. If any automated coverage is desired, Wave 0 would need to install and configure one (e.g. Vitest + Testing Library) — a nontrivial addition not currently scoped by CONTEXT.md.
- [ ] No existing test file conventions to follow in this app.

*Recommendation: treat this phase as manual-verification-only (checkpoint:human-verify tasks) rather than retrofitting a test framework mid-phase, consistent with phases 1-20's existing UI work.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Insert checklist block, toggle item complete | CONT-01 | contentEditable DOM interaction, no test harness | Slash-menu → Checklist, click checkbox, reload page, verify state persists |
| Insert toggle block, collapse/expand nested children | CONT-02 | Novel nesting UI, no automated DOM harness | Slash-menu → Toggle, add nested block, collapse/expand, reload, verify children persist |
| Insert quote block | CONT-03 | contentEditable DOM interaction | Slash-menu → Quote, type text, reload, verify sanitized HTML persists |
| Insert code block, select language | CONT-04 | contentEditable + picker interaction | Slash-menu → Code, pick language, reload, verify language persists |
| Insert each media block kind | CONT-05 | File/URL interaction, no test harness | Slash-menu → Image/File/Video/Bookmark/Embed, provide URL, reload, verify renders |
| Insert inline table block | CONT-06 | contentEditable table DOM interaction | Slash-menu → Table, edit cells, reload, verify distinct from collection-view table |
| Insert multi-column layout | CONT-07 | Novel nesting + drag interaction | Slash-menu → Columns, add blocks per column, reload, verify layout persists |
| Insert sub-page link block | CONT-08 | Navigation + creation flow | Slash-menu → Sub-page, create new page, verify link navigates via `crossAppUrl` pattern |
| Type `@` inline, mention person/page/date | CONT-09 | Autocomplete popover interaction | Type `@`, select person/page/date, reload, verify mention span survives DOMPurify and click-navigates |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unaffected — existing `authenticateToken` middleware unchanged |
| V3 Session Management | no | Unaffected |
| V4 Access Control | yes | Sub-page creation and any media uploads must flow through existing `authenticateToken` + `company_id`-scoped repository methods — no new unauthenticated surface |
| V5 Input Validation | yes | `DOMPurify.sanitize()` with explicit `ALLOWED_ATTR`/`ADD_ATTR` for mention `data-*` attributes on every contentEditable-sourced HTML commit |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Stored XSS via contentEditable HTML (mention spans, table cells, quote/toggle text) | Tampering | `DOMPurify.sanitize()` on every commit path — do not bypass for new block kinds |
| SSRF via bookmark/embed link-preview scraping (only if server-side scraping chosen) | Tampering / Info Disclosure | Allowlist http/https only, reject RFC1918/localhost/link-local, short timeout + response-size cap; prefer no server fetch (raw-URL card) if this can't be confidently implemented |
| Arbitrary/oversized file upload via new media block (only if real uploads chosen) | Denial of Service | Reuse `FileUploader`'s existing size/type constraints verbatim — no separate, more permissive upload path |

---

*Generated from Phase 21 research: `.planning/phases/21-missing-content-blocks/21-RESEARCH.md`*
