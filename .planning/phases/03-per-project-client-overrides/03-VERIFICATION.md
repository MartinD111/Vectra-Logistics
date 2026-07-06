---
phase: 03-per-project-client-overrides
verified: 2026-07-06T00:00:00Z
status: human_needed
score: 7/7 must-haves verified (code-level); 2 tasks pending human browser confirmation
overrides_applied: 0
human_verification:
  - test: "Open a client detail page in the browser. Confirm the 'Linked Projects' section renders in the main column above the canvas (not inside the 320px sidebar). Confirm empty-state copy when no projects are attached. Click 'Attach project' — confirm it opens a dropdown popover (not a full-screen modal) with a working search filter. Select a project — confirm the row appears without a page reload, and re-opening the picker shows that project deprioritized (checkmark, greyed) rather than removed from the list."
    expected: "Linked Projects section renders correctly, attach picker works as a popover with live search, attach is idempotent and reflected instantly via query invalidation."
    why_human: "Visual layout placement, popover vs. modal rendering, and live DOM update behavior cannot be confirmed via static code reading alone — requires a running browser session."
  - test: "Expand a linked project card. Confirm each of the 3 fields (rate, responsible employee, notes) independently shows 'Override'/'Reset to default' correctly reflecting is_overridden. Override only the Rate field, save, reload — confirm employee/notes still show inherited/global values and Rate shows the overridden value with the primary-600 left-border accent. Click 'Reset to default' on Rate — confirm it reverts to the greyed inherited display showing the client's actual global default. Click 'Unlink' on a project with overrides set — confirm dialog copy matches UI-SPEC exactly, confirming removes the row, and re-attaching shows all 3 fields back in the inherited state (no residual overrides)."
    expected: "D-04 visual contract (grey/italic inherited vs. full-strength + left-border overridden) is unambiguous per field; full-triple save never clears an unrelated field; unlink requires confirmation and truly discards all overrides; re-attach starts fresh (D-05)."
    why_human: "Visual color/contrast confirmation, real network round-trip verification (reload-and-recheck), and interactive dialog confirmation cannot be verified from source code alone — requires a running browser + live API + database."
---

# Phase 3: Per-Project Client Overrides Verification Report

**Phase Goal:** A client serving multiple projects can have project-specific terms without losing its global defaults
**Verified:** 2026-07-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A client-project link row can be deleted (unlinked) via a DELETE endpoint | ✓ VERIFIED | `crm.repository.ts:98-102` `deleteProjectLink`; `crm.routes.ts:20` `router.delete('/clients/:id/projects/:projectId', ...)`; `crm.controller.ts:37-40` returns 204 |
| 2 | Attaching or unlinking a client to/from a project outside the caller's company is rejected (403/404), not silently allowed | ✓ VERIFIED | `crm.service.ts:102-106` private `assertOwnedProject` throws `AppError(404,...)`/`AppError(403,...)`; called in both `upsertClientProjectLink` (line 70) and `unlinkClientProject` (line 94) |
| 3 | Re-attaching a project after unlink starts with no prior overrides (fresh row) | ✓ VERIFIED | `deleteProjectLink` performs a real `DELETE FROM client_project_links` (row-level, not soft-delete); re-`POST` triggers `INSERT ... ON CONFLICT DO UPDATE` against a non-existent row → fresh insert with whatever override fields are sent (defaults to `null` if omitted, matching D-05) |
| 4 | User can attach a client to one or more projects via a searchable project picker | ✓ VERIFIED (code) / awaiting human confirm | `page.tsx:239-289` renders search input + client-side filtered `useProjects()` list; clicking a row calls `handleAttach` → `upsertLink.mutate({ project_id })`; popover form factor confirmed in code (not a full modal) |
| 5 | User can override rate, responsible employee, and notes for a client on a specific project, per-field, without affecting the other two fields or the client's global defaults | ✓ VERIFIED (code) | `LinkedProjectOverrideEditor` (`page.tsx:400-452`) implements `currentOverrides()` helper + three field-specific save functions (`saveRate`/`saveEmployee`/`saveNotes`), each reading the other two fields' current override intent before submitting the full 3-field triple — directly closes RESEARCH.md Pitfall 2 |
| 6 | User can see, per field, whether the value is inherited from the global default or explicitly overridden (D-04's visually unambiguous contract) | ✓ VERIFIED (code) / awaiting human visual confirm | `OverrideFieldShell` (`page.tsx:454-474`) applies `border-l-2 border-primary-600` + full-strength text when `isOverridden`, else `bg-gray-50 dark:bg-slate-700/50` + `text-gray-400 italic` — matches UI-SPEC color contract exactly |
| 7 | User can unlink a client from a project via a confirm dialog, which discards all overrides for that link | ✓ VERIFIED (code) / awaiting human confirm | `UnlinkConfirmDialog` (`page.tsx:357-389`) renders exact UI-SPEC copy; confirm calls `handleUnlink` → `unlinkMutation.mutate(projectId)` → real `DELETE` endpoint (verified truth #1) |

**Score:** 7/7 truths verified at the code level. Truths 4, 6, 7 additionally require human browser confirmation per Plan 02's `autonomous: false` status (executor had no browser access).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/domains/crm/crm.repository.ts` | `deleteProjectLink(clientId, projectId, companyId)` | ✓ VERIFIED | Present at lines 98-102, matches `deleteProject` no-op-delete convention exactly, scoped by all 3 params |
| `apps/api/src/domains/crm/crm.service.ts` | `unlinkClientProject` + `assertOwnedProject` applied to both upsert and unlink | ✓ VERIFIED | `assertOwnedProject` private method (lines 102-106), called at line 70 (upsert) and line 94 (unlink) |
| `apps/api/src/domains/crm/crm.routes.ts` | `DELETE /clients/:id/projects/:projectId` route | ✓ VERIFIED | Line 20, placed directly after the POST route per RESEARCH.md Pitfall 4 guidance |
| `apps/workspaces/src/lib/hooks/useCrm.ts` | `useUnlinkClientProjectLink` mutation hook | ✓ VERIFIED | Lines 74-80, invalidates `qk.projectLinks(clientId)` matching `useClientProjectLinks`/`useUpsertClientProjectLink` |
| `apps/workspaces/src/app/records/[clientId]/page.tsx` | `LinkedProjectsSection` rendering attach/override/unlink UI, min 250 lines | ✓ VERIFIED | Full file is 808 lines; `LinkedProjectsSection` + `LinkedProjectOverrideEditor` + `OverrideFieldShell` + 3 field components + `UnlinkConfirmDialog` span lines 188-665 (~477 lines), well above the 250-line threshold |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `crm.service.ts` | `projects.repository.ts` | `projectsRepository.findProject` import for ownership check | ✓ WIRED | Imported line 3, called inside `assertOwnedProject` line 103 |
| `useCrm.ts` | `crm.api.ts` | `crmApi.unlinkClientProjectLink` call | ✓ WIRED | `useCrm.ts:77` `mutationFn: (projectId) => crmApi.unlinkClientProjectLink(clientId, projectId)` |
| `page.tsx` | `useCrm.ts` | `useClientProjectLinks`/`useUpsertClientProjectLink`/`useUnlinkClientProjectLink` calls | ✓ WIRED | Imported line 15-17, all three called in `LinkedProjectsSection` (lines 189-192) |
| `page.tsx` | `useProjects.ts` | `useProjects()` call for attach picker | ✓ WIRED | Imported line 19, called line 190, results filtered client-side for the picker (line 205-206) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `LinkedProjectsSection` | `links` | `useClientProjectLinks(clientId)` → `GET /clients/:id/projects` → `crmService.listClientProjectLinks` → real DB query (`crmRepository.listProjectLinks` + `getClient`) merged server-side | Yes | ✓ FLOWING |
| `LinkedProjectOverrideEditor` | `link.rate_eur`/`responsible_employee_id`/`notes`/`is_overridden` | Server-computed `ResolvedClientProjectView` — never recomputed client-side (confirmed: no `??` merge logic present in `page.tsx`, only reads pre-merged fields) | Yes | ✓ FLOWING |
| Attach picker | `projects` | `useProjects()` → `projectsApi.list()` → real `GET /api/v1/projects` | Yes | ✓ FLOWING |

No hardcoded/static/empty-array fallbacks found feeding these components; all three data sources are live queries against real endpoints backed by DB queries (confirmed by direct repository/service code reads, not just import presence).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API TypeScript compiles cleanly | `npx tsc --noEmit` (apps/api) | No output (0 errors) | ✓ PASS |
| Workspaces frontend TypeScript compiles cleanly | `npx tsc --noEmit` (apps/workspaces) | No output (0 errors) | ✓ PASS |
| No debt markers in modified files | grep for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | No matches in `page.tsx` | ✓ PASS |
| DELETE route registered and delegates correctly | Manual code read of `crm.routes.ts`/`crm.controller.ts` | `router.delete('/clients/:id/projects/:projectId', unlinkClientProjectLink)` → `crmService.unlinkClientProject` → 204 | ✓ PASS |

No live server/DB was started for this verification (per phase convention — no test framework, manual UAT only per 03-VALIDATION.md/03-RESEARCH.md). Runtime HTTP/DOM behavior is deferred to the human verification items below.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| CLI-04 | 03-01, 03-02 | User can attach a client to one or more projects | ✓ SATISFIED | Backend ownership-hardened upsert endpoint (03-01) + frontend searchable picker (03-02) both present and wired |
| CLI-05 | 03-01, 03-02 | User can override rate, responsible employee, and notes for a client on a specific project, without changing global defaults | ✓ SATISFIED | Backend merge logic (pre-existing from Phase 1, re-verified intact) + frontend full-triple-save per-field override editor (03-02), D-04 visual contract implemented |

No orphaned requirements — REQUIREMENTS.md maps only CLI-04/CLI-05 to Phase 3, both declared in both plans' frontmatter.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no stub returns (`return null`/`return []` feeding a rendered UI without a real data source), no hardcoded empty props passed to child components. The Task 1 "stub the Unlink button as a no-op" instruction was fully superseded by Task 2's real wiring — confirmed no leftover stub/console.log remains.

### Human Verification Required

Plan 03-02 is marked `autonomous: false` and both of its tasks carry embedded `<human-check>` verification steps requiring a running browser session, which the executor explicitly could not perform (no browser access, per its own SUMMARY.md). The code was read directly and is substantive, wired, and passes `tsc --noEmit`, but the following require a human with a live dev server + browser to close out:

### 1. Attach flow and picker UX (Task 1 human-check)

**Test:** Open a client detail page in the browser. Confirm the "Linked Projects" section renders in the main column above the canvas (not inside the 320px sidebar). Confirm empty-state copy when no projects are attached. Click "Attach project" — confirm it opens a dropdown popover (not a full-screen modal) with a working search filter. Select a project — confirm the row appears without a page reload, and re-opening the picker shows that project deprioritized (checkmark, greyed) rather than removed from the list.
**Expected:** Linked Projects section renders correctly in the main column; attach picker is a popover (not modal) with live client-side search; attaching updates the UI instantly via query invalidation, no page reload.
**Why human:** Visual layout placement, popover vs. modal rendering, and live DOM update behavior after a mutation cannot be confirmed from static code alone.

### 2. Per-field override contract and unlink flow (Task 2 human-check)

**Test:** Expand a linked project card. Confirm each of the 3 fields (rate, responsible employee, notes) independently shows "Override"/"Reset to default" correctly reflecting `is_overridden`. Override only the Rate field, save, reload the page — confirm employee/notes still show inherited/global values (not cleared) and Rate shows the overridden value with the primary-600 left-border accent. Click "Reset to default" on Rate — confirm it reverts to the greyed inherited display showing the client's actual global default value. Click "Unlink" on a project with overrides set — confirm dialog copy matches UI-SPEC exactly, confirming removes the row, and re-attaching that same project via the picker shows all 3 fields back in the inherited state (no residual overrides, per D-05).
**Expected:** D-04's grey/italic-inherited vs. full-strength+left-border-overridden contrast is visually unambiguous; a reload after overriding only Rate proves the full-triple-save logic actually prevented data loss server-side (not just in local component state); unlink dialog copy matches UI-SPEC verbatim; re-attach after unlink starts with zero overrides.
**Why human:** This is the single most important correctness check in the phase (RESEARCH.md Pitfall 2) — code inspection shows the client always sends the full triple, but only a real reload-after-save against a live Postgres instance proves the server round-trip didn't silently null an unrelated field. Visual color contrast and interactive dialog behavior also require a browser.

## Gaps Summary

No code-level gaps found. Every must-have truth, artifact, and key link required by both plans (03-01 backend, 03-02 frontend) is present, substantive, and correctly wired, and both `tsc --noEmit` runs are clean with zero errors. The phase's core security risk (Pitfall 1 — cross-tenant IDOR on attach) is closed with `assertOwnedProject` applied consistently to both attach and unlink. The phase's core data-integrity risk (Pitfall 2 — partial-field save clobbering other overrides) is closed via the `currentOverrides()`-based full-triple-save pattern, verified correct end-to-end including the `undefined`-omitted-from-JSON → Zod-`optional()` → `?? null` fallback chain.

The only reason this phase is not marked `passed` is that Plan 02 is explicitly non-autonomous and its embedded `<human-check>` steps (visual layout, popover behavior, and — most importantly — a live reload-after-save round trip proving no override data loss) were never executed by the executor, who had no browser access. This is a process gate, not a defect signal from code inspection.

---

*Verified: 2026-07-06*
*Verifier: Claude (gsd-verifier)*
