---
phase: 16
slug: production-compose-deployment-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node --test` (via `ts-node/register`), per `apps/api/package.json`'s `"test"` script |
| **Config file** | none — `"test": "node --require ts-node/register --test src/**/*.test.ts"` in `apps/api/package.json` |
| **Quick run command** | `cd apps/api && npm test` |
| **Full suite command** | same — no tiered suite exists in this project |
| **Estimated runtime** | ~5-15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd:verify-work`:** Full suite green + manual `docker compose -f docker-compose.prod.yml config` sanity check
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | DEP-02 | T-16-01 | `validateDeploymentModeValue()` rejects unset/invalid, accepts `cloud`/`on-prem` | unit | `cd apps/api && npm test -- secrets.test` | ❌ W0 (extend existing) | ⬜ pending |
| 16-01-02 | 01 | 0 | DEP-02 | T-16-03 | `getDeploymentMode()` caches after first read; mutating `process.env` post-first-call has no effect | unit | `cd apps/api && npm test -- secrets.test` | ❌ W0 (extend existing) | ⬜ pending |
| 16-01-03 | 01 | 1 | DEP-02 | T-16-02 | `signup()` returns 403 with `on-prem`; unchanged 400/409/200 behavior with `cloud` | unit/integration | `cd apps/api && npm test -- authController.test` | ❌ W0 (net-new file) | ⬜ pending |
| 16-02-01 | 02 | 0 | DEP-01 | T-16-02 | `docker-compose.prod.yml` has no `ports:` on postgres/redis, no committed secret defaults (`:?` on all required secrets), all 5 app services present | manual | `docker compose -f docker-compose.prod.yml config` | ❌ W0 (structural, not unit-testable) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/core/config/secrets.test.ts` — extend existing file with `DEPLOYMENT_MODE` validate/cache test cases (mirror existing `JWT_SECRET`/`ENCRYPTION_KEY` test shape)
- [ ] `apps/api/src/controllers/authController.test.ts` — new file; no prior `*Controller.test.ts` pattern exists in the repo, planner must confirm minimal test shape (e.g. calling the handler with mock `req`/`res`) before committing to structure
- [ ] Framework install: none — `node --test` + `ts-node/register` already present in `apps/api/devDependencies`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Compose file structure (services, volumes, no ports, no secret defaults) | DEP-01 | Structural YAML check needs Docker Compose's interpolation resolver, not a unit test; may also require a live Docker daemon which may be unavailable in the execution sandbox | Run `docker compose -f docker-compose.prod.yml config` — confirm required secrets error when unset, confirm postgres/redis have no `ports:` key, confirm 5 services present (marketplace, workspaces, cmr, api, matching-engine) |
| Migrate-then-serve sequencing | DEP-01 | Depends on Phase 15's migration runner, which does not exist yet in this repo | Once Phase 15 lands: `docker compose run --rm api npm run migrate` then `docker compose -f docker-compose.prod.yml up -d`, confirm api starts only after migrate succeeds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
