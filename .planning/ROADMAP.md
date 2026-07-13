# Roadmap: Vectra

## Milestones

- ✅ **v1.0 CRM Rework** — Phases 1-6 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Workspace Engine — Engine Unification** — Phases 7-13 (shipped 2026-07-12) — [archive](milestones/v2.0-ROADMAP.md)
- 🚧 **v3.0 On-Premise GA** — Phases 14-20 (in progress) — derived from `docs/specs/deployment/*`, `docs/specs/core/ai-integration.md` §6.1

## Phases

<details>
<summary>✅ v1.0 CRM Rework (Phases 1-6) — SHIPPED 2026-07-06</summary>

- [x] Phase 1: Schema & CRM Domain Foundation (3/3 plans) — completed 2026-07-05
- [x] Phase 2: CRM Dashboard, Navigation & Client Detail (4/4 plans) — completed 2026-07-06
- [x] Phase 3: Per-Project Client Overrides (2/2 plans) — completed 2026-07-06
- [x] Phase 4: Bulk Excel Import (2/2 plans) — completed 2026-07-06
- [x] Phase 5: Email History Sync (2/2 plans) — completed 2026-07-06
- [x] Phase 6: Credit-Risk KPI Evaluator & Semaphore (2/2 plans) — completed 2026-07-06

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Workspace Engine — Engine Unification (Phases 7-13) — SHIPPED 2026-07-12</summary>

- [x] Phase 7: Engine Foundation + Page Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 8: Page Read-Rendering → Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 9: Page Edit-Mode + Slash → Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 10: Mini Program onto the Engine (1/1 plans) — completed 2026-07-06
- [x] Phase 11: Palette Derivation Unification (1/1 plans) — completed 2026-07-11
- [x] Phase 12: Extensibility Proof (2/2 plans) — completed 2026-07-11
- [x] Phase 13: Cleanup, ADR & Park WorkflowBuilder (1/1 plans) — completed 2026-07-12

Full detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Milestone audit: [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) — status: tech_debt (14/14 requirements satisfied, no functional gaps; missing VERIFICATION.md for phases 7-11 backfillable via `/gsd:validate-phase`)

</details>

### 🚧 v3.0 On-Premise GA (In Progress)

**Milestone Goal:** Make Vectra deployable and self-upgradeable at a customer's own site as a first-class configuration of the same codebase used for Cloud — not a fork, not a "lite" build.

**Phase Numbering:**

- Integer phases (14, 15, 16...): Planned milestone work, continuing global numbering from v2.0's Phase 13.
- Decimal phases (14.1, 14.2): Urgent insertions (marked with INSERTED).

- [x] **Phase 14: Security Hardening** - No committed-secret fallbacks; server refuses to boot without required secrets; default admin seed never runs in customer-facing installs (completed 2026-07-12)
- [x] **Phase 15: Migration Runner** - `schema_migrations` tracking + `npm run migrate` runner shared by first-run and upgrade, idempotent
 (completed 2026-07-12)

- [x] **Phase 16: Production Compose + DEPLOYMENT_MODE** - `docker-compose.prod.yml` + boot-time cloud/on-prem mode toggle gating seed data and registration (completed 2026-07-12)
- [x] **Phase 17: Installer / First-Run Flow** - One-shot installer generates secrets, creates the single company + admin, runs migrations, optionally wires local AI (completed 2026-07-12)
- [x] **Phase 18: Backend-side Local AI Provider** - Server can call a local Gemma/Ollama endpoint directly, not only via the browser path
 (completed 2026-07-12)
- [ ] **Phase 19: Release Versioning & Upgrade Docs** - One `VERSION` + git tag stamped into images/`/health`, `CHANGELOG.md`, 5-step upgrade procedure
- [ ] **Phase 20: Deploy Hardening + Connectivity Doc** - CORS/Socket.IO origin allowlist, auth rate limiting, real `/health` dependency checks, inbound-connectivity doc

## Phase Details

### Phase 14: Security Hardening

**Goal**: The server cannot boot with insecure defaults, and no customer-facing install ships a known-default admin account.
**Depends on**: Nothing (first phase of milestone)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):

  1. Starting the API with `ENCRYPTION_KEY` unset fails at boot with a clear error — no fallback key is used.
  2. Starting the API with `JWT_SECRET` unset fails at boot with a clear error — no fallback secret is used.
  3. `017_seed_admin_user.sql` (or its effect, `admin@admin.com`/`admin`) never runs in any customer-facing (production/on-prem) install path.
  4. Local development workflows still start normally when secrets are supplied via env/`.env`.

**Plans**: 2 plans
Plans:

- [x] 14-01-PLAN.md — Boot-time secrets.ts validated-read module + server.ts wiring + 4 call-site fixes (SEC-01, SEC-02)
- [x] 14-02-PLAN.md — docker-compose.yml seed-admin mount + secret defaults removed; .env.example documented (SEC-01, SEC-02, SEC-03)

### Phase 15: Migration Runner

**Goal**: Schema migrations apply the same way on first install and on every upgrade, tracked and idempotent.
**Depends on**: Phase 14 (seed migration already excluded from the customer-facing path before the runner formalizes migration execution)
**Requirements**: MIG-01, MIG-02
**Success Criteria** (what must be TRUE):

  1. `npm run migrate` applies all pending numbered files from `database/migrations/` in order and records each one in a `schema_migrations` table.
  2. Running `npm run migrate` again with no new files is a no-op — no errors, no re-application.
  3. The production stack no longer mounts `docker-entrypoint-initdb.d`; migrations only ever run through the runner, on first-run and upgrade alike.

**Plans**: 1 plan
Plans:

- [x] 15-01-PLAN.md — migrate.ts runner (schema_migrations, per-file transaction, 017 exclusion), package.json wiring, live two-run dry-run against vectra_postgres (MIG-01, MIG-02)

### Phase 16: Production Compose + DEPLOYMENT_MODE

**Goal**: A customer can stand up the full production stack from one compose file, and the running app knows at boot whether it's Cloud or On-Premise.
**Depends on**: Phase 15 (compose's production entrypoint relies on the migration runner, not initdb mounts)
**Requirements**: DEP-01, DEP-02
**Success Criteria** (what must be TRUE):

  1. `docker compose -f docker-compose.prod.yml up` starts all four production app images plus Postgres and Redis, with persistent volumes and no bind mounts or dev servers.
  2. The compose file ships with no committed secret defaults — a missing required secret fails startup rather than silently defaulting.
  3. Setting `DEPLOYMENT_MODE=on-prem` closes open registration and skips cloud-only seed data at boot; `DEPLOYMENT_MODE=cloud` preserves today's behavior unchanged.
  4. `DEPLOYMENT_MODE` is read once at API boot, not re-evaluated per request.

**Plans**: 2 plans
Plans:

- [x] 16-01-PLAN.md — DEPLOYMENT_MODE validator/cache in secrets.ts, server.ts bootstrap wiring, signup() 403 registration gate (DEP-02)
- [x] 16-02-PLAN.md — docker-compose.prod.yml (7 services, no host ports on datastores, no committed secret defaults) + .env.example (DEP-01, DEP-02)

### Phase 17: Installer / First-Run Flow

**Goal**: A customer or their IT partner can go from a fresh checkout to a running, secured instance through one guided flow — no manual SQL, no default credentials.
**Depends on**: Phase 15 (migration runner), Phase 16 (`DEPLOYMENT_MODE`, production compose)
**Requirements**: INS-01, INS-02
**Success Criteria** (what must be TRUE):

  1. Running the installer generates a unique `JWT_SECRET` and `ENCRYPTION_KEY` — never a value from the repo or a prior install.
  2. The installer creates exactly one company and one real admin account (not `admin@admin.com`).
  3. The installer runs the migration runner so the schema is current before the app serves traffic.
  4. The installer can optionally write a reachable local Gemma/Ollama endpoint into `company_ai_config` (`provider:'local'`).
  5. The installer writes `DEPLOYMENT_MODE=on-prem`, so the resulting instance boots closed (registration off, no cloud seed data).

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 17-01-PLAN.md — install.ts core: secrets generation, base-schema bootstrap, migration invocation, company+admin creation, .env write, script wiring (INS-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — install.ts optional local-AI step: Ollama reachability probe, company_ai_config write (INS-02)

**Wave 3** *(gap closure — CR-01, blocked on Wave 1+2 completion)*

- [x] 17-03-PLAN.md — install.ts already-installed guard (isAlreadyInstalled/shouldBlockInstall, --force override) + safe error formatting (formatFatalError) (INS-01)

### Phase 18: Backend-side Local AI Provider

**Goal**: Every AI-powered feature works on an on-prem install using only a local model — no dependency on a browser-side call path.
**Depends on**: Phase 16 (`DEPLOYMENT_MODE` available to distinguish the on-prem server-side path from the existing browser-only local path)
**Requirements**: AIL-01
**Success Criteria** (what must be TRUE):

  1. `aiService.complete()` dispatches to a server-reachable local Gemma/Ollama endpoint when `provider==='local'`, instead of the current hard `throw`.
  2. Inbox/document parsing (`inbox.parser.ts`) gets real AI extraction on a local-only install rather than silently failing.
  3. Cloud/hosted backend behavior for `provider==='local'` is unchanged — still hard-throws when no server-reachable local endpoint exists.

**Plans**: 1 plan
Plans:

- [x] 18-01-PLAN.md — ai.service.ts hasUsableProvider/completeLocal/on-prem dispatch branch + inbox.parser.ts hasUsableProvider gate and graceful degrade (AIL-01)

### Phase 19: Release Versioning & Upgrade Docs

**Goal**: Every release has one authoritative version, and an operator can upgrade a running install with a documented, repeatable procedure.
**Depends on**: Phase 15 (migration runner is the mechanism upgrades rely on), Phase 16 (production compose is what gets upgraded)
**Requirements**: REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):

  1. A single `VERSION` file is the source of truth for the release; it's stamped into built images and returned by `GET /health`.
  2. `CHANGELOG.md` exists at repo root with one section per release, including a migration list generated from the release's migration filenames.
  3. `docs/DEPLOYMENT.md`'s upgrade section is a 5-step procedure (pull → migrate → restart, etc.) that fully replaces the old manual per-file `psql` instructions.

**Plans**: 3 plans
Plans:
**Wave 1**

- [ ] 19-01-PLAN.md — VERSION file + version.ts resolver + GET /health version field (REL-01)
- [ ] 19-03-PLAN.md — CHANGELOG.md + migration-list generator script + docs/DEPLOYMENT.md 5-step upgrade procedure (REL-02, REL-03)

**Wave 2** *(blocked on 19-01 completion)*

- [ ] 19-02-PLAN.md — ARG VERSION in all 4 Dockerfiles + docker-compose.prod.yml build args (REL-01)

### Phase 20: Deploy Hardening + Connectivity Doc

**Goal**: The production stack rejects unexpected origins, throttles auth abuse, reports real dependency health, and customers know exactly what must be exposed to the internet.
**Depends on**: Nothing hard (independent of the installer/release track); sequenced last so each earlier phase ships on its own
**Requirements**: HRD-01, HRD-02, HRD-03, DOC-01
**Success Criteria** (what must be TRUE):

  1. CORS and Socket.IO reject connections from origins outside the env-configured allowlist — no wildcard `*` in production.
  2. Repeated requests to `/api/auth/*` from one client get rate-limited.
  3. `GET /health` (or `/ready`) reports unhealthy when Postgres or Redis is actually unreachable, not just when the process is up.
  4. A customer-facing doc explains the reverse-proxy posture: only `/api/webhooks/*` and `/api/pod/*` need to be exposed inbound.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17 → 18 → 19 → 20

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema & CRM Domain Foundation | v1.0 | 3/3 | Complete | 2026-07-05 |
| 2. CRM Dashboard, Navigation & Client Detail | v1.0 | 4/4 | Complete | 2026-07-06 |
| 3. Per-Project Client Overrides | v1.0 | 2/2 | Complete | 2026-07-06 |
| 4. Bulk Excel Import | v1.0 | 2/2 | Complete | 2026-07-06 |
| 5. Email History Sync | v1.0 | 2/2 | Complete | 2026-07-06 |
| 6. Credit-Risk KPI Evaluator & Semaphore | v1.0 | 2/2 | Complete | 2026-07-06 |
| 7. Engine Foundation + Page Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 8. Page Read-Rendering → Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 9. Page Edit-Mode + Slash → Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 10. Mini Program onto the Engine | v2.0 | 1/1 | Complete | 2026-07-06 |
| 11. Palette Derivation Unification | v2.0 | 1/1 | Complete | 2026-07-11 |
| 12. Extensibility Proof | v2.0 | 2/2 | Complete | 2026-07-11 |
| 13. Cleanup, ADR & Park WorkflowBuilder | v2.0 | 1/1 | Complete | 2026-07-12 |
| 14. Security Hardening | v3.0 | 2/2 | Complete    | 2026-07-12 |
| 15. Migration Runner | v3.0 | 1/1 | Complete   | 2026-07-12 |
| 16. Production Compose + DEPLOYMENT_MODE | v3.0 | 2/2 | Complete    | 2026-07-12 |
| 17. Installer / First-Run Flow | v3.0 | 3/3 | Complete   | 2026-07-12 |
| 18. Backend-side Local AI Provider | v3.0 | 1/1 | Complete   | 2026-07-12 |
| 19. Release Versioning & Upgrade Docs | v3.0 | 0/TBD | Not started | - |
| 20. Deploy Hardening + Connectivity Doc | v3.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-05 · v1.0 archived: 2026-07-06 · v2.0 archived: 2026-07-12 · v3.0 phases 14-20 added: 2026-07-12*
