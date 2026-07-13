---
phase: 20-deploy-hardening-connectivity-doc
plan: 04
subsystem: infra
tags: [documentation, deployment, reverse-proxy, webhooks, outlook-oauth]

# Dependency graph
requires: []
provides:
  - "New 'Inbound connectivity' section in docs/DEPLOYMENT.md documenting reverse-proxy posture"
affects: [deployment-docs, on-prem-installers]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/DEPLOYMENT.md

key-decisions:
  - "Content sourced verbatim from 20-RESEARCH.md's pre-validated 'Connectivity doc outline' (itself derived from docs/specs/deployment/on-premise-deployment.md §7) rather than re-deriving wording, since the spec file itself was not present/committed in this worktree — the research doc's outline was the authoritative, already-reviewed source."

patterns-established: []

requirements-completed: [DOC-01]

# Metrics
duration: 12min
completed: 2026-07-13
---

# Phase 20 Plan 04: Inbound Connectivity Doc Summary

**New "Inbound connectivity" section in docs/DEPLOYMENT.md documenting that only `/api/webhooks/*` and `/api/pod/*` need public reverse-proxy exposure, closing DOC-01.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-13T06:32Z
- **Completed:** 2026-07-13T06:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added a new `## Inbound connectivity` section to `docs/DEPLOYMENT.md`, placed between "Upgrading a running install" and "Outlook / Microsoft 365 integration" per D-04.
- Documented the two route prefixes (`/api/webhooks/*`, `/api/pod/*`) that must be reachable from the public internet, with rationale (Samsara/Geotab HMAC-verified push webhooks with no polling alternative; token-scoped driver POD uploads from the road) via a markdown table.
- Documented that everything else (frontends, general API, admin tooling) should stay on the internal network/VPN.
- Documented the Outlook OAuth callback's reachability caveat, cross-referencing the existing "Outlook / Microsoft 365 integration" section for the exact callback URL instead of duplicating it.
- Documented the recommended posture: reverse proxy exposing only the two prefixes, with the explicit tradeoff of a fully air-gapped install losing telematics webhooks and public POD upload links.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add "Inbound connectivity" section to docs/DEPLOYMENT.md** - `a51d739` (docs)

## Files Created/Modified
- `docs/DEPLOYMENT.md` - Added "Inbound connectivity" section (29 lines) between "Upgrading a running install" and "Outlook / Microsoft 365 integration"

## Decisions Made
- Sourced the section content directly from `20-RESEARCH.md`'s "Connectivity doc outline" (Code Examples section), which was itself already derived from `docs/specs/deployment/on-premise-deployment.md` §7, since `docs/specs/deployment/on-premise-deployment.md` was not present as a committed file in this worktree (it was untracked in the base checkout at session start and did not carry over via the worktree's git history). The research doc's outline was treated as the authoritative, pre-validated source per plan Task 1's instruction to match §7.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<action>` steps 1-5 map 1:1 to the five paragraphs/table added.

### Setup note (not a deviation, environmental)

This worktree's branch (`worktree-agent-a27198d2e6c701a21`) was checked out at commit `27b0003`, 282 commits behind `main`, with zero unique commits (exactly at the merge-base) — `.planning/` and `docs/DEPLOYMENT.md`'s later revisions didn't exist in the worktree at session start. This matches a previously-documented pattern (see STATE.md Phase 18 blocker note). Resolved with a safe `git merge main --ff-only` before execution began (no destructive operations, no conflicts, no unique worktree commits at risk).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This is a documentation-only change.

## Next Phase Readiness
- `docs/DEPLOYMENT.md` now fully covers the reverse-proxy/inbound-connectivity posture for on-prem/self-hosted customers, closing the last named DOC-01 requirement gap in the v3.0 milestone.
- No blockers for other Phase 20 plans (20-01/02/03 cover HRD-01/02/03 independently; this plan has no code dependency on them).

---
*Phase: 20-deploy-hardening-connectivity-doc*
*Completed: 2026-07-13*
