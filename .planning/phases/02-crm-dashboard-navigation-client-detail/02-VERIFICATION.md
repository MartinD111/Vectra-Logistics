---
phase: 02-crm-dashboard-navigation-client-detail
verified: 2026-07-06T00:00:00Z
status: human_needed
score: 4/4 truths verified (code-level); 1 critical defect flagged; live DB/browser execution unverified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Apply database/migrations/022_client_pages.sql to a live dev Postgres instance (twice, to confirm idempotency), then start the API + workspaces dev servers."
    expected: "Migration applies cleanly both times (no error on re-run); client_pages table exists with a unique index on client_id."
    why_human: "No Docker/Postgres daemon was reachable in the execution sandbox for any of the 4 plans in this phase (confirmed independently: `docker ps -a` returns zero containers in this environment as well). The migration has never actually been run against a database. All executor verification was static (tsc --noEmit, grep/read-based code review) — none exercised the schema or endpoints live."
  - test: "In a browser, visit /records with the sidebar visible; confirm 'CRM' label routes to the dashboard; seed 2+ clients (one over-limit) and confirm the table renders, search filters by name, and the 'Over limit only' toggle filters correctly."
    expected: "Table renders with Name/Country/Credit status/Responsible employee columns; filters compose correctly; empty states render when applicable."
    why_human: "No dev server was started in any plan's execution; this is browser-rendering behavior that static analysis cannot confirm (React state wiring, CSS layout, actual query results)."
  - test: "Click a client row on /records; confirm a new browser tab opens at /records/{clientId} and renders the sidebar + canvas without crashing."
    expected: "New tab opens; sidebar shows address/notes/responsible-employee; canvas auto-seeds current-situation + timeline blocks with their empty-state copy on first visit."
    why_human: "window.open + new-route rendering + first-visit auto-seed logic requires a live browser session against a real client_pages row; cannot be confirmed from source alone."
  - test: "Edit the address field on the detail page sidebar, wait ~800ms, confirm the value persists on page reload. Then simulate a failed PATCH (e.g. stop the API mid-edit) and confirm the UI does not silently mark the edit as saved."
    expected: "Successful edits persist. Failed edits show 'Couldn't save — try again' and do NOT lose the user's input."
    why_human: "This directly probes CR-01/WR-02 from 02-REVIEW.md: the autosave's error-handling path is dead code (`.mutate()` doesn't throw synchronously, so the catch block never fires) and the page-level canvas autosave has no onError handler at all. This is a live-behavior defect that must be confirmed/fixed via an actual failed-save scenario, not just code reading — the human should decide whether this blocks phase acceptance or is deferred as a fast-follow."
  - test: "From an existing project page, click 'New client page', search for / quick-create a client, confirm the resulting new tab opens the correct detail page, and repeat the flow for the same client to confirm no duplicate client_pages row is created (SELECT COUNT(*) FROM client_pages WHERE client_id = $1 should remain 1)."
    expected: "Single row per client under repeated get-or-create calls; new tab opens correctly both times."
    why_human: "Concurrency/dedupe guarantee (ON CONFLICT) is structurally sound by code inspection but has never been exercised against a real Postgres instance in this phase's execution."
---

# Phase 2: CRM Dashboard, Navigation & Client Detail Verification Report

**Phase Goal:** Users have a dedicated CRM home — a dashboard of clients and a full detail page for each — replacing the never-built "Records" slot and the cramped in-project block as the primary way to work with client data
**Verified:** 2026-07-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees "CRM" (not "Records") in the left sidebar, linking to `/records` which lists all clients | ✓ VERIFIED | `WorkspaceSidebar.tsx:28` — `{ name: 'CRM', href: '/records', icon: Boxes, module: 'records' }`. `records/page.tsx` fetches `useClients()` and renders a full table with search + over-limit filter + add-client modal. |
| 2 | Clicking a client on the dashboard opens that client's detail page in a new browser tab | ✓ VERIFIED (code-level) | `records/page.tsx:117` — `onClick={() => window.open(\`/records/${client.id}\`, '_blank', 'noopener,noreferrer')}`. `NewClientPageModal.tsx` uses the identical pattern for the project-page entry point (DET-04). Not exercised in a live browser (see human_verification). |
| 3 | On the detail page, user can view and edit address, free-text notes, and assigned responsible employee | ⚠ VERIFIED with a known defect | `records/[clientId]/page.tsx` renders `InlineTextField` (address/notes, 800ms debounce + blur-flush) and `ResponsibleEmployeeField` (flat team dropdown), both wired to `useUpdateClient().mutate(...)`. **However**, per 02-REVIEW.md CR-01/WR-02 (independently re-confirmed by reading the file): `InlineTextField.flush()` wraps `onSave()` in a try/catch, but `useMutation().mutate()` never throws synchronously — the catch branch and "Couldn't save" UI are structurally dead code, so failed saves are silently treated as successful with zero user feedback. This is a real data-loss risk on a must-have (edit + persist), not a cosmetic nit. |
| 4 | The detail page shows the client's last 10 sent emails under a "current situation" section and a full timeline (empty state until Phase 5/emails land) | ✓ VERIFIED | `ClientCurrentSituationBlock.tsx` always renders "No emails synced yet" (backing `getClientEmails` stub returns `[]` — correct per DET-02 contract, Phase 5 fills real data). `ClientTimelineBlock.tsx` renders "No activity yet" empty state or a merged reverse-chronological list (Mail/Receipt/BarChart3 icons) when `crmService.getClientTimeline` returns entries from `email_messages`/`invoices`/`kpi_results`. Both block kinds are registered end-to-end (`PageBlockKind` union → `PAGE_BLOCK_REGISTRY` → `PageBlockView` dispatch case) and auto-seeded on first client-page visit. |

**Score:** 4/4 truths hold at the code level; truth 3 carries a flagged critical defect (autosave silent-failure) that a human must decide whether to treat as blocking.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `database/migrations/022_client_pages.sql` | `client_pages` table, unique on `client_id`, mirrors `project_pages` minus hierarchy columns | ✓ VERIFIED (static) | Contains `CREATE TABLE IF NOT EXISTS client_pages`, `CREATE UNIQUE INDEX IF NOT EXISTS client_pages_client_uniq ON client_pages (client_id)`; no `parent_page_id`/`is_default`/`sort_order`. **Never applied to a live database** — confirmed independently (`docker ps -a` returns zero containers in this environment too). Idempotency (`IF NOT EXISTS`) is structurally sound but unexecuted. |
| `apps/api/src/domains/crm/crm.repository.ts` | `findClientPage`, `createClientPage`, `updateClientPage`, timeline data-source queries | ✓ VERIFIED | All three methods present plus `listClientEmails`/`listClientInvoices`/`listClientKpiResults`; every query scoped by `company_id`. `createClientPage` uses `ON CONFLICT (client_id) DO UPDATE`. |
| `apps/api/src/domains/crm/crm.routes.ts` | `GET/POST /clients/:id/page`, `PATCH /client-pages/:pageId`, `GET /clients/:id/timeline` | ✓ VERIFIED | All four routes registered, `authenticateToken` inherited globally, no route-shadowing (confirmed by review + independent read). |
| `apps/workspaces/src/app/records/page.tsx` | CRM dashboard: table, search, over-limit filter, add-client modal, new-tab nav | ✓ VERIFIED | 144 lines, all required elements present and wired to `useClients`/`useTeam`/`AddClientModal`. |
| `apps/workspaces/src/components/projectPage/AddClientModal.tsx` | Shared add-client modal | ✓ VERIFIED | Present, uses `useCreateClient()`, matches field set from `CrmClientsBlock`. |
| `apps/workspaces/src/app/records/[clientId]/page.tsx` | Client detail page: sidebar + block canvas | ✓ VERIFIED | 302 lines; sidebar (address/notes/responsible-employee) + `LivePageCanvas` with `clientId` prop; loading/error states present. |
| `apps/workspaces/src/components/projectPage/ClientCurrentSituationBlock.tsx` | Current-situation renderer, "No emails synced yet" empty state | ✓ VERIFIED | Contains exact required copy. |
| `apps/workspaces/src/components/projectPage/ClientTimelineBlock.tsx` | Unified timeline renderer, "No activity yet" empty state | ✓ VERIFIED | Contains exact required copy; icon-tagged by entry type. |
| `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx` | DET-04 picker: search/quick-create, get-or-create-then-open | ✓ VERIFIED | 40+ lines; `getClientPage`, `window.open`, no `crossAppUrl` import; wired into project page toolbar. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `crm.controller.ts` | `crm.service.ts` | `getOrCreateClientPage`/`updateClientPage`/`getClientTimeline` calls | ✓ WIRED | Confirmed by direct read of controller. |
| `crm.repository.ts` | database | parameterized queries scoped by `company_id` | ✓ WIRED | Every method (including new client_pages / timeline methods) filters by `company_id`. |
| `records/page.tsx` | `useCrm.ts` | `useClients()` data fetch | ✓ WIRED | Confirmed. |
| `records/page.tsx` | `/records/[clientId]` | row click → new tab | ✓ WIRED | `window.open` confirmed, not `crossAppUrl`. |
| `records/[clientId]/page.tsx` | `useCrm.ts` | `useClientPage`/`useUpdateClientPage`/`useUpdateClient` | ✓ WIRED | All four hooks imported and used. |
| `PageBlockView.tsx` | `ClientCurrentSituationBlock.tsx` / `ClientTimelineBlock.tsx` | dispatch cases | ✓ WIRED | `case 'client-current-situation'` / `case 'client-timeline'` confirmed at PageBlockView.tsx:98-99. |
| `projects/[id]/pages/[pageId]/page.tsx` | `NewClientPageModal.tsx` | "New client page" trigger button | ✓ WIRED | Confirmed via grep: import + button label + modal render, `addSubPageUnder` untouched. |
| `NewClientPageModal.tsx` | `useCrm.ts`/`crm.api.ts` | `getClientPage` get-or-create call | ✓ WIRED | `crmApi.getClientPage(clientId)` awaited before `window.open`. |
| `records/[clientId]/page.tsx` autosave | `useUpdateClientPage` mutation | debounced config save | ⚠ PARTIAL | Wired and functionally fires, but `updatePage = useUpdateClientPage(page?.id ?? '', clientId)` is constructed with an empty-string fallback before `page` resolves, and neither the debounced-save effect nor the unmount-flush effect has an `onError` handler — a failed PATCH is treated as saved with zero surfaced error (matches 02-REVIEW.md CR-01, independently reconfirmed by direct read). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `records/page.tsx` table | `clients` (via `useClients()`) | `GET /api/v1/crm/clients` → `crmRepository.listClients` → `SELECT * FROM clients WHERE company_id = $1` | Yes (real DB query, scoped) | ✓ FLOWING |
| `ClientCurrentSituationBlock.tsx` | `emails` (via `useClientEmails`) | `crmService.getClientEmails` — hardcoded `return []` | No — intentional Phase-1 stub, correctly documented and gated behind the mandated empty state | ⚠ STATIC (by design, matches DET-02's phased rollout — not a defect) |
| `ClientTimelineBlock.tsx` | `timeline` (via `useClientTimeline`) | `crmService.getClientTimeline` → merges 3 real repository queries (`listClientEmails`/`listClientInvoices`/`listClientKpiResults`), each a real parameterized SQL query | Yes for invoices/kpi once seeded; emails source is still the Phase-1 stub | ✓ FLOWING (structurally; unverified against live data since no DB is reachable) |
| `records/[clientId]/page.tsx` sidebar | `client.address`/`client.notes`/`client.responsible_employee_id` | `useClient(clientId)` → `GET /api/v1/crm/clients/:id` → real DB row | Yes | ✓ FLOWING (structurally) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Workspaces app type-checks with all phase changes | `cd apps/workspaces && npx tsc --noEmit` | Clean, zero errors | ✓ PASS |
| API app type-checks with all phase changes | `cd apps/api && npx tsc --noEmit` | Clean, zero errors | ✓ PASS |
| No debt markers (TBD/FIXME/XXX) in phase-modified files | `grep -nE "TBD|FIXME|XXX"` across all 14 phase-touched files | No matches | ✓ PASS |
| Docker/Postgres availability | `docker ps -a` | Zero containers, empty output | ✗ UNAVAILABLE (confirms executor's documented constraint; migration/live-endpoints/browser flows genuinely untestable in this environment) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventional probes exist in this repository, and no plan/summary declares any. Skipped — no runnable probes to execute.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NAV-01 | 02-02 | "CRM" sidebar label, `/records` href unchanged | ✓ SATISFIED | `WorkspaceSidebar.tsx:28` |
| NAV-02 | 02-02 | Row click opens detail page in new tab | ✓ SATISFIED (code-level) | `records/page.tsx:117`, `window.open` |
| CLI-01 | 02-02, 02-03 | View/edit client address | ✓ SATISFIED (code-level, with autosave defect noted) | `InlineTextField` in `records/[clientId]/page.tsx` |
| CLI-02 | 02-02, 02-03 | View/edit free-text notes | ✓ SATISFIED (code-level, with autosave defect noted) | Same as above, `multiline` variant |
| CLI-03 | 02-02, 02-03 | Assign responsible employee | ✓ SATISFIED (code-level) | `ResponsibleEmployeeField`, flat `useTeam()` list, immediate save on select (no debounce risk here since selection is discrete) |
| DET-01 | 02-01, 02-03 | Detail page shows address/notes/settings/responsible employee | ✓ SATISFIED (code-level) | `records/[clientId]/page.tsx` sidebar |
| DET-02 | 02-01, 02-03 | Last 10 sent emails "current situation" | ✓ SATISFIED (code-level, correctly stubbed pending Phase 5) | `ClientCurrentSituationBlock.tsx` |
| DET-03 | 02-01, 02-03 | Full timeline: emails + invoices + KPI + empty state | ✓ SATISFIED (code-level) | `crmService.getClientTimeline` + `ClientTimelineBlock.tsx` |
| DET-04 | 02-04 | Create client detail page from project page creator | ✓ SATISFIED (code-level) | `NewClientPageModal.tsx` + toolbar wiring in `projects/[id]/pages/[pageId]/page.tsx` |

No orphaned requirements: all 9 IDs assigned to Phase 2 in REQUIREMENTS.md's traceability table are claimed across the 4 plans' frontmatter and have corresponding code evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/workspaces/src/app/records/[clientId]/page.tsx` | 28, 70-91 | Mutation constructed with `page?.id ?? ''`, no `onError` handler on debounced/unmount-flush autosave | 🛑 Blocker-adjacent (already documented as CR-01 in 02-REVIEW.md; not duplicating full analysis here, but flagging because it directly threatens must-have "user can edit and persist client data") | Failed PATCH silently marks edit as saved; user's typed change can be lost with zero feedback |
| `apps/workspaces/src/app/records/[clientId]/page.tsx` | 191-202 | `InlineTextField.flush()` try/catch around `.mutate()`, which never throws synchronously | ⚠ Warning (WR-02 in review) | "Couldn't save — try again" UI is unreachable dead code, giving false confidence that failures are surfaced |
| `apps/api/src/domains/crm/crm.service.ts` | 149-152 | `getClientRisk` stub with no phase cross-reference comment | ℹ️ Info (WR-01 in review; explicitly out of scope for Phase 2 per roadmap — risk semaphore is Phase 6) | Does not block this phase's goal; flagged only for awareness, not counted against Phase 2's score |

(Full anti-pattern detail already recorded in `02-REVIEW.md` — not duplicating the complete list of 6 warnings/4 info items here per instructions; only the ones bearing directly on must-have verification are repeated above.)

### Human Verification Required

See YAML frontmatter `human_verification` list. Summary:

1. **Apply `022_client_pages.sql` to a live dev Postgres instance** — never executed in any of the 4 plans; idempotency and schema correctness are code-reviewed but unproven against a real database.
2. **Browser-verify the `/records` dashboard** — table rendering, search, over-limit filter, empty states.
3. **Browser-verify row-click new-tab navigation and the detail page's first-visit auto-seed behavior.**
4. **Reproduce a failed autosave on the detail page sidebar** — directly probes the CR-01/WR-02 defect; human must decide whether this blocks phase sign-off or is accepted as a fast-follow fix.
5. **Browser-verify the "New client page" picker's get-or-create dedupe guarantee** against a live database.

### Gaps Summary

No code-level gaps were found — all 9 requirement IDs have corresponding, wired, non-stub implementations, both new TypeScript builds (`apps/api`, `apps/workspaces`) compile cleanly, and both mandated empty-state copy blocks render exactly as specified. However, this phase's `status` is `human_needed` rather than `passed` for two reasons:

1. **Zero end-to-end execution.** No Docker/Postgres container has ever existed in this development sandbox (confirmed independently: `docker ps -a` returns nothing), and no dev server was started by any of the 4 executors. Every "verified" artifact above is verified by static analysis (source reading, `tsc --noEmit`, grep) — none of the phase's success criteria have actually been exercised by a running application against a real database or in a real browser. This is a materially higher-risk gap than a normal phase, since the entire migration (`022_client_pages.sql`) — on which every new endpoint depends — has literally never run.
2. **A real, code-confirmed defect in an in-scope must-have.** The client detail page's inline-edit autosave (CLI-01/02, DET-01) has a silent-failure path: a failed save is indistinguishable from a successful one to the user, and the existing "Couldn't save" error UI can never actually render due to a synchronous-vs-asynchronous mutation error-handling mismatch. This was already caught by `02-REVIEW.md` (CR-01/WR-02); this verification independently reconfirms it by reading the same file. It does not block "code exists and is wired" but it does undermine the truth "user can edit the client's address/notes" in the failure case, which is a real risk given this page has no manual save button at all.

Neither of these is a "gap" in the sense of missing/stub artifacts — everything the plans specified was built, is wired, and compiles. Both are routed to human verification because they require live execution (item 1) or a product decision on whether a known defect blocks phase acceptance (item 2), not because the codebase lacks the described capability.

---

_Verified: 2026-07-06_
_Verifier: Claude (gsd-verifier)_
