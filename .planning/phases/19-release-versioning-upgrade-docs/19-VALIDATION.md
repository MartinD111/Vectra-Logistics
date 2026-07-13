---
phase: 19
slug: release-versioning-upgrade-docs
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (existing convention, e.g. `secrets.test.ts`) plus `grep`/`test -f` doc-and-config assertions |
| **Config file** | none — `node --require ts-node/register --test` runs `.test.ts` files directly, no config install needed |
| **Quick run command** | `cd apps/api && node --require ts-node/register --test src/core/config/version.test.ts src/server.health.test.ts` |
| **Full suite command** | `cd apps/api && node --require ts-node/register --test src/core/config/version.test.ts src/server.health.test.ts && grep -c "ARG VERSION=unknown" apps/api/Dockerfile apps/marketplace/Dockerfile apps/workspaces/Dockerfile apps/cmr/Dockerfile && grep -c "VERSION:" docker-compose.prod.yml && grep -c "^## " CHANGELOG.md && ! grep -q "psql -f database/migrations" docs/DEPLOYMENT.md` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` command (see map below)
- **After every plan wave:** Run the full suite command above
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | REL-01 | — | N/A (read-only local file resolution) | unit | `cd apps/api && node --require ts-node/register --test src/core/config/version.test.ts` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | REL-01 | T-19-01 | `/health` exposes only bare semver, no SHA/host/paths | unit+integration | `cd apps/api && node --require ts-node/register --test src/server.health.test.ts` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 2 | REL-01 | — | N/A (build-time metadata only) | config | `grep -c "ARG VERSION=unknown" apps/api/Dockerfile apps/marketplace/Dockerfile apps/workspaces/Dockerfile apps/cmr/Dockerfile` | ✅ | ⬜ pending |
| 19-02-02 | 02 | 2 | REL-01 | T-19-02 | `VERSION` required (`:?`) with no silent default, operator-controlled only | config | `grep -c "VERSION:" docker-compose.prod.yml` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 1 | REL-02 | T-19-03 | read-only `git diff` wrapper, no untrusted input | doc+script | `test -f CHANGELOG.md && grep -c "^## " CHANGELOG.md` | ✅ | ⬜ pending |
| 19-03-02 | 03 | 1 | REL-03 | — | N/A (documentation only) | doc | `! grep -q "psql -f database/migrations" docs/DEPLOYMENT.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — `node:test` is already used by `apps/api/src/core/config/secrets.test.ts`; no new framework or fixtures needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose -f docker-compose.prod.yml config` resolves `VERSION` build args to a real value (not literal `${VERSION}`) | REL-01 | Requires Docker in the execution environment, which may not be available to the executor | Export `VERSION` from the repo's `VERSION` file, then run `docker compose -f docker-compose.prod.yml config` and inspect the resolved `build.args.VERSION` per service |
| `curl https://<host>/health` after a real upgrade shows the new tag's version | REL-03 | Requires a live deployed stack, out of scope for unit/config-level automated checks | Follow `docs/DEPLOYMENT.md`'s new 5-step procedure end-to-end against a running install and confirm step 5's `curl` output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing `node:test` infra reused)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-13
