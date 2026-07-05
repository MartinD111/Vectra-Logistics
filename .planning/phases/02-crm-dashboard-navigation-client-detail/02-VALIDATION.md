---
phase: 02
slug: crm-dashboard-navigation-client-detail
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no `jest.config.*`, `vitest.config.*`, or `*.test.ts`/`*.spec.ts` files exist anywhere in `apps/api` or `apps/workspaces` (confirmed by RESEARCH.md's direct filesystem search) |
| **Config file** | none — see Wave 0 Requirements |
| **Quick run command** | none available yet |
| **Full suite command** | none available yet |
| **Estimated runtime** | N/A — no automated suite exists |

---

## Sampling Rate

- **After every task commit:** Manual smoke check — start dev server, exercise the specific endpoint/UI path touched by that task
- **After every plan wave:** Full manual click-through of every requirement ID touched by that wave, against a seeded test client
- **Before `/gsd:verify-work`:** All 9 requirement IDs (NAV-01, NAV-02, CLI-01, CLI-02, CLI-03, DET-01, DET-02, DET-03, DET-04) manually verified against a seeded test client
- **Max feedback latency:** N/A (manual sampling — no automated command to time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|--------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DET-01/02/03/04 | T-02-01 | `client_pages` queries scoped by `company_id` (cross-tenant leak prevention) | integration (API) | manual: `curl` get-or-create endpoint with two different company JWTs | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DET-01/02/03/04 | T-02-01 | Timeline aggregation endpoint returns empty-state gracefully when `email_messages` absent | integration (API) | manual: `curl` timeline endpoint for a client with no emails | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | NAV-01, NAV-02 | — | Sidebar rename is label/icon only, same `/records` href and `module: 'records'` gate | manual/visual | dev-server click-through of sidebar | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | CLI-01/02/03 | T-02-03 | Dashboard table + search + over-limit filter + add-client modal scoped to requester's company | manual/visual + integration | dev-server click-through + `curl` dashboard listing endpoint | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | CLI-01/02/03 | T-02-03 | Inline-edit sidebar fields (address, notes, responsible employee) autosave and persist scoped to client's company | manual/visual | dev-server click-through of detail page sidebar edit + reload to confirm persistence | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | DET-02, DET-03 | T-02-02 | Current-situation + timeline blocks render empty state; notes field XSS-safe (DOMPurify or plain-text escaping) | manual/visual | dev-server click-through of empty states + attempt HTML injection in notes field | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | DET-01 | — | Regression: existing project pages render unchanged after `LivePageCanvas`/`PageBlockView` additive-prop change | manual/visual | dev-server click-through of an existing project page, confirm no visual/behavioral change | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | DET-04 | — | "New client page" picker: quick-create and existing-client search both scoped to requester's company | manual/visual | dev-server click-through of picker modal from project page creator | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | DET-04 | T-02-01 | Picking an already-paged client opens existing page, does not create duplicate (`client_pages` unique on `client_id`) | integration (API) | manual: pick same client twice, confirm single row via `curl`/DB check | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework installed anywhere in the monorepo (`apps/api`, `apps/workspaces`) — installing one (e.g., Vitest) is a cross-cutting decision beyond this phase's scope. Flagged to project owner per RESEARCH.md; not decided unilaterally in this phase.
- [ ] No `tests/` directory convention established yet in either app.

*Per RESEARCH.md: "Given zero test infrastructure exists in this monorepo (a pre-existing condition, not introduced by this phase), full automated coverage per Nyquist sampling is not achievable without first standing up a framework." Manual verification is the accepted sampling mechanism for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar shows "CRM" linking to `/records` | NAV-01 | No test framework in repo | Load workspace app, confirm sidebar label reads "CRM" and links to `/records` |
| Row click opens client detail in new tab | NAV-02 | No test framework in repo | Click a client row on `/records`, confirm new browser tab opens at `/records/[clientId]` |
| Dashboard search + over-limit filter | CLI-01/02/03 | No test framework in repo | Type a partial client name, confirm filtered results; toggle over-limit filter, confirm only over-limit clients shown |
| Detail page inline-edit + autosave | CLI-01/02/03 | No test framework in repo | Edit address/notes/responsible-employee fields, blur, reload page, confirm persisted values |
| Current-situation + timeline empty states | DET-02, DET-03 | No test framework in repo; Phase 5 (email sync) not yet built | Open detail page for a client with no emails, confirm visible empty-state copy (not hidden sections) |
| Cross-tenant isolation on client_pages | DET-01 (security) | No test framework in repo | Attempt to fetch another company's `client_pages` row by guessing `client_id`, confirm 404 |
| XSS via notes field | CLI-01/02/03 (security) | No test framework in repo | Enter `<script>alert(1)</script>` in notes field, confirm it renders as inert text, not executed |
| Create client page from project page creator, no duplicates | DET-04 | No test framework in repo | Use "New client page" entry twice for the same client, confirm second attempt opens existing page instead of creating a new row |
| Existing project pages unaffected by canvas changes | DET-01 (regression) | No test framework in repo | Open an existing (pre-Phase-2) project page, confirm all blocks render and edit exactly as before |

---

## Validation Sign-Off

- [x] All tasks have manual verification steps (no automated command available — Wave 0 gap, documented above)
- [x] Sampling continuity: every task has a defined manual check; no 3 consecutive tasks without a verification step
- [x] Wave 0 covers all MISSING references (no test framework anywhere in monorepo — flagged, not silently skipped)
- [x] No watch-mode flags (N/A — no automated suite)
- [x] Feedback latency: N/A — manual sampling only
- [x] `nyquist_compliant: true` set in frontmatter (manual-verification path is the accepted compliance mode given zero pre-existing test infrastructure, per RESEARCH.md's explicit recommendation)

**Approval:** approved 2026-07-05
