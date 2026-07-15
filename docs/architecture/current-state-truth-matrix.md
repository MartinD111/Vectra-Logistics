# Current-State Truth Matrix

**Created:** 2026-07-15
**Updated:** 2026-07-15 during Phase 27 execution
**Source:** `Vectra_Codex_Implementation_Roadmap.md`, current `.planning/` state, live repository inspection, and baseline command execution in this workspace.

## Grouped Repository Inventory

### Apps

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| `apps/api` | Shared Express backend. Canonical DDD surface mounted at `/api/v1`, plus legacy `/api/auth`, `/api/profile`, `/api/documents`, `/api/shipments`, `/api/capacity`, `/api/integrations`, `/api/ratings`, `/api/companies`, `/api/webhooks`, `/api/pod`, `/uploads`, and `/health`. | Partial: real backend surface, but legacy and canonical routes coexist, and some legacy public edges still need tenancy/security normalization. |
| `apps/workspaces` | Main Next.js workspace app with records, projects, programs, automations, CRM-adjacent UI, and vertical operational surfaces. | Shipped for current v1-v4 spine, with known lint debt and demo/stub caveats in some downstream features. |
| `apps/cmr` | Separate Next.js CMR/POD-facing app. | Partial: real production build exists, but broader lifecycle unification remains incomplete. |
| `apps/marketplace` | Separate Next.js marketplace/LTL app. | Partial: real production build exists, but shipment/capacity lifecycle remains fragmented and partially demo/stub-backed. |

### Shared packages

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| `packages/ui` | Shared UI primitives plus cross-app URL helpers. | Shipped foundation. |
| `packages/api-client` | Shared fetch wrapper and API client surface. | Shipped foundation. |
| `packages/auth` | Shared auth helpers and SSO support. | Shipped foundation. |
| `packages/types` | Shared TypeScript contracts. | Shipped foundation. |
| `packages/data` | Shared data/map-oriented package used by some frontend surfaces. | Partial: real package exists, but not the center of a unified data contract yet. |
| `packages/config` | Shared config package placeholder. | Partial/minimal: package exists, but config centralization is still limited. |

### Standalone services

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| `services/matching-engine` | Python FastAPI service used for matching/LTL flows. Production/development compose files still wire it into the platform. | Partial: real service exists, but route-contract drift versus Node-side expectations is still called out as a v5 risk. |

### Route domains and public edges

#### Canonical authenticated `/api/v1/*` domain router

`apps/api/src/domains/index.ts` mounts these domains under `/api/v1`:

- `fleet`
- `marketplace`
- `workspace`
- `workspaces`
- `projects`
- `folders`
- `team`
- `kpi`
- `outlook`
- `campaigns`
- `integrations`
- `ai`
- `documents`
- `notifications`
- `chat`
- `inbox`
- `yard`
- `pod`
- `billing`
- `crm`
- `ltl`
- `records`

Repo truth: this is the canonical DDD API surface. It is real and substantial, but it coexists with legacy aliases and legacy monolithic route trees.

#### Legacy and public surfaces mounted directly in `apps/api/src/server.ts`

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| `/api/fleet` | Alias to the same domain router for zero-downtime migration. | Partial: real compatibility alias, but a sign the migration to one canonical surface is incomplete. |
| `/api/auth`, `/api/profile`, `/api/documents`, `/api/integrations`, `/api/ratings`, `/api/companies` | Legacy monolithic route groups still mounted directly. | Partial: real surfaces, but not yet fully migrated into the domain-router shape. |
| `/api/shipments`, `/api/capacity` | Legacy shipment/capacity routes mounted directly from the old route tree. | Partial and risky: current v5 risk notes still flag unauthenticated behavior and caller-supplied `user_id` patterns. |
| `/api/webhooks/*` | Public webhook entrypoints for ANPR/OCR plus provider webhook dispatch. | Partial: real inbound public surface, but trust/signing posture is not unified across all public endpoints. |
| `/api/pod/:token` | Public token-scoped POD upload/read flow. | Partial: real public surface, but belongs in the same future signed public-endpoint trust model as webhooks. |
| `/health` | Real live dependency-check health endpoint with version field. Returns dependency-aware `200` or `503`. | Shipped foundation: real endpoint, but still part of ongoing ops hardening and baseline truth. |
| `/uploads` | Static file serving from local filesystem. | Partial: real in single-instance mode, but not yet a durable multi-instance object-storage story. |

### Queue and worker surfaces

`apps/api/src/core/queue/index.ts` provides the shared BullMQ queue registry. The visible worker files are:

- `apps/api/src/workers/matchingJob.ts`
- `apps/api/src/workers/email.worker.ts`
- `apps/api/src/workers/telematics.worker.ts`

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| Matching worker | `startMatchingWorker()` is called from API bootstrap and the worker listens on queue `matching`. | Partial: real worker wiring exists, but matching-engine contract drift remains a blocking truth for future durable event work. |
| Email sync worker | `startEmailWorker()` and `scheduleEmailSync()` are called from API bootstrap. | Partial: real worker wiring exists, but Outlook/demo-mode caveats still affect end-to-end truth. |
| Telematics worker | Worker file exists and can schedule queue work, but `startTelematicsWorker()` is not called from API bootstrap. | Partial: code exists, runtime wiring does not. This must not be overstated as a shipped live capability. |

### Database migrations and schema surfaces

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| `database/migrations/` | Visible migration range is `002_realtime_and_documents.sql` through `025_records_views.sql`. There is no visible `001_*` file in the repo. | Partial baseline: real migration trail exists, but Phase 27 must treat missing early numbering and code/schema drift as truth, not assume completeness. |
| Latest visible schema surface | Latest migration is `025_records_views.sql`. | Shipped for v4 records/views work. |
| Schema-truth caveat | Code still references `integration_credentials`, `api_credentials`, `internal_api_keys`, `vehicle_locations`, and `assignment_scores` without a complete visible migration trail proven in this repo. | Partial/risky: must be resolved as part of the v5 schema-truth ADR gap before architecture-changing work builds on these tables. |

### Operational entrypoints

| Surface | Repo truth | Current status |
|---------|------------|----------------|
| Root `package.json` | Exposes `build`, `migrate`, `install:on-prem`, and app-specific `dev:*` scripts. No root `lint`, `test`, or `typecheck` script exists. | Partial: real operator entrypoints exist, but they are not uniform across the monorepo. |
| `apps/api/package.json` | Exposes `dev`, `build`, `test`, `migrate`, `install:on-prem`. | Shipped foundation. |
| `apps/workspaces/package.json` | Exposes `dev`, `build`, `start`, `lint`. No dedicated `typecheck` script. | Partial: build/lint surfaces exist, but no standardized typecheck script. |
| `apps/cmr/package.json` | Exposes `dev`, `build`, `start`, `lint`. `next lint` is not preconfigured and enters setup prompt. | Partial: surface exists, but lint is not CI-ready. |
| `apps/marketplace/package.json` | Exposes `dev`, `build`, `start`, `lint`. `next lint` is not preconfigured and enters setup prompt. | Partial: surface exists, but lint is not CI-ready. |
| `docker-compose.yml` | Development/local boot topology for Postgres, Redis, API, matching-engine, and all three frontend apps. | Partial: real local boot contract exists, but baseline drift is visible in how migrations are mounted. |
| `docker-compose.prod.yml` | Production-oriented compose topology requiring `npm run migrate` before `up -d`, and requiring explicit `VERSION`/env wiring. | Shipped foundation for v3 on-prem/productization work. |

### Local-boot and migration drift findings

- Development Compose mounts migrations only through `020_ltl_matching.sql`.
- `017_seed_admin_user.sql` is skipped in the mounted init list.
- `021_crm_extensions.sql` through `025_records_views.sql` are not mounted into the development Postgres init path.
- The repo also contains a dedicated migration runner (`npm run migrate` in `@vectra/api`) and the production compose file explicitly tells operators to use it before `up -d`.

Repo truth: development boot and migration truth are not a single path today. This is exactly the kind of operational baseline drift Phase 27 is meant to surface before Phase 28-30 assume a stable starting point.

## Imported Roadmap Phase Mapping

| Imported phase | Current repo status | Evidence | v5 decision |
|----------------|---------------------|----------|-------------|
| Phase 0: repository truth, ADRs, executable baseline | Partial | `.planning/codebase/*`, current roadmap/requirements/state artifacts, real package scripts, real compose files, and visible migrations exist; Phase 27 found the truth matrix draft was incomplete and command/migration drift is real. | Reopen as Phase 27 baseline truth. |
| Phase 1: security, tenancy, deployment | Partial | v3 delivered deployment mode, secret validation, health/version surfaces, migration runner, and production compose hardening; repo still lacks one typed `RequestContext`, one capability boundary, and a complete cross-tenant negative-test harness. | Continue as Phase 28 security/tenancy/capabilities. |
| Phase 2: unified workspace hierarchy | Absent | Projects, folders, pages, programs, records, and automations exist as separate surfaces, but there is no single workspace-node projection or universal tree API. | Defer to v6 after v5 foundation. |
| Phase 3: page/collaboration engine | Partial | v2 and v4 shipped the registry-driven page and records/view surfaces, but comments, revisions, robust collaboration, and unified search remain incomplete. | Defer until hierarchy and event foundation are stable. |
| Phase 4: canonical records engine | Partial | v4 shipped `records` domain routes, record detail pages, and multiple saved views; formulas, rollups, record history, and capability-aware record permissions remain unshipped. | Extend after event and capability foundations land. |
| Phase 5: Mini Programs v3 | Partial | Shared mini-program engine and plugin seams exist, but runtime remains largely browser-local and not yet aligned with durable workflow/action contracts. | Defer to v7 after workflow/action contracts. |
| Phase 6: durable automation engine | Demo | `WorkflowBuilder.tsx` and automation surfaces exist, but persisted workflows, runs, step logs, and durable execution are absent. | Start MVP in Phase 30. |
| Phase 7: integration platform/actions | Partial | Outlook, telematics, mapping, and webhook integration code paths exist, but connector lifecycle, capability model, uniform public trust, and durable action execution are incomplete. | Defer to v7 after v5 action/event foundation. |
| Phase 8: shipment/procurement backbone | Partial | Marketplace, inbox, POD, billing, and LTL surfaces exist, but not as one canonical end-to-end shipment/RFQ lifecycle. | Defer to v8 vertical slice. |
| Phase 9: CMR/PWA/POD/billing closure | Partial | CMR app, POD routes, and billing domains are real, but the business lifecycle is still fragmented across apps and domains. | Defer to v8 vertical slice. |
| Phase 10: fleet/telematics/dispatch | Partial | Fleet, telematics, exceptions, and spot-quote surfaces are real, but telematics runtime wiring is incomplete and some behavior is still simulated or adapter-dependent. | Defer until integration platform matures. |
| Phase 11: routing/delivery | Partial | Matching worker, matching engine, and route-oriented UI exist, but deterministic end-to-end routing/delivery contract is incomplete and contract drift is explicitly visible. | Defer after fleet/integration maturity. |
| Phase 12: module/app store | Deferred | Plugin seams and registries exist, but install/capability/action lifecycle is not enforceably safe yet. | Block until capability/action boundary is defined. |
| Phase 13: on-prem productization | Partial | Installer, migration runner, deployment mode, version surface, production compose, and deployment docs are all real. Offline licensing, support bundle, backup/restore, and some operator workflows remain incomplete. | Continue later as operations milestone. |
| Phase 14: scale/reliability/commercial readiness | Partial | Health checks, release/version docs, and deployment hardening are real, but SLOs, metrics, chaos, retention, and formal reliability/commercial gates are not yet complete. | Treat as continuous release-gate work. |

## Current Shipped Spine

- v1 CRM Rework: dedicated CRM, client detail pages, Excel import, Outlook sent-mail sync, per-project overrides, credit-risk KPI semaphore.
- v2 Workspace Engine: shared registry powering pages and mini programs, native and manifest plugin paths, extensibility documentation.
- v3 On-Premise GA: deployment mode, migration runner, installer, local AI dispatch, production compose, release/upgrade docs, versioned `/health`, and environment hardening.
- v4 Workspace Records & Views: records API, record detail pages, collection-view block, board/table/list/calendar/gallery/timeline views.

## Baseline Command Matrix

| Category | Command | Status | Evidence |
|----------|---------|--------|----------|
| lint | `npm run lint` (repo root) | Not available | Root `package.json` has no `lint` script. |
| lint | `npm run lint --workspace @vectra/workspaces` | Fail | `next lint` runs and reports existing `react/no-unescaped-entities` errors in `billing/settlements`, `company/[id]`, and `how-it-works`, plus warnings in `profile` and image usage. |
| lint | `npm run lint --workspace @vectra/cmr` | Not CI-ready | `next lint` launches the interactive “How would you like to configure ESLint?” prompt instead of running a preconfigured lint pass. |
| lint | `npm run lint --workspace @vectra/marketplace` | Not CI-ready | Same interactive ESLint setup prompt as CMR. |
| typecheck | dedicated repo script | Not available | No root or app-level `typecheck` script exists in package manifests. |
| typecheck | `npx tsc --noEmit -p apps/api/tsconfig.json` | Pass | Command exits 0. |
| typecheck | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | Pass | Command exits 0. |
| typecheck | `npx tsc --noEmit -p apps/cmr/tsconfig.json` | Pass | Command exits 0. |
| typecheck | `npx tsc --noEmit -p apps/marketplace/tsconfig.json` | Pass | Command exits 0. |
| tests | `npm test` (repo root) | Not available | Root `package.json` has no `test` script. |
| tests | `npm run test --workspace @vectra/api` | Pass | 102 tests passed. Output still includes repeated login-error logs caused by missing DB credentials in some auth-path tests, but the suite exits 0. |
| build | `npm run build --workspace @vectra/api` | Pass | TypeScript API build exits 0. |
| build | `npm run build --workspace @vectra/workspaces` | Pass | Next.js production build exits 0. |
| build | `npm run build` (repo root) | Pass | Root workspace build exits 0 and builds API, CMR, Marketplace, and Workspaces successfully. |
| migrations | `npm run migrate --workspace @vectra/api` | Fail | Migration runner exits with `FATAL: migration setup failed: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`. |
| local boot | `docker compose config` | Fail in current environment | This workspace cannot execute `docker.exe`; PowerShell reports `docker.exe` is not a valid application for this OS platform. |
| local boot | `docker compose up --build -d` | Not executed | Documented in `README.md`, but not runnable from this environment because Docker CLI invocation itself fails. |

## Immediate v5 Risks

- Tenant isolation is implemented by convention in many domains, but lacks a shared cross-tenant test harness.
- `activity_events` exists, but service writes are not yet backed by a durable outbox/dispatcher.
- Automations are still a UI/demo surface rather than a persisted workflow runtime.
- Public/integration endpoints need a unified signed/keyed framework before more connectors are added.
- Demo/stub behavior needs a single explicit capability/demo-mode story so production cannot synthesize operational data silently.
- Legacy `/api/shipments` and `/api/capacity` appear unauthenticated and accept caller-supplied `user_id`; Phase 28 should quarantine or migrate them.
- Code references `integration_credentials`, `api_credentials`, `internal_api_keys`, `vehicle_locations`, and `assignment_scores` without a complete visible migration trail; Phase 27 should verify schema truth before Phase 28/29 changes.
- Matching worker and FastAPI matching-engine route contracts disagree (`/api/predict` vs `/match`/`batch-match`/`ltl-match`); durable job work should not build on that contract until reconciled.
- `telematics.worker.ts` exists but is not started/scheduled from API bootstrap; telematics capability status should be honest until real adapter execution is wired.
- Development Compose boot does not cover the full visible migration range; local database truth can drift from repo migration truth unless the migration runner is used deliberately.

## ADR Gaps Before Architecture-Changing PRs

| ADR gap | Why it is needed | Downstream pressure |
|---------|------------------|---------------------|
| Typed `RequestContext` and capability boundary | The repo still mixes legacy and canonical route surfaces, and security/tenancy behavior is not expressed through one shared request contract. | Blocks Phase 28. |
| Public endpoint trust model | `/api/webhooks/*`, `/api/pod/:token`, and legacy public edges need one documented signed-token/API-key/HMAC posture instead of route-by-route exceptions. | Blocks Phase 28 and any new connector/public-surface work. |
| Demo-mode vs production-mode capability policy | Several surfaces have demo/stub behavior today. The platform needs one explicit rule for when synthetic behavior is allowed, surfaced, and denied. | Blocks Phase 28 and protects Phase 30 from building on silent demo fallbacks. |
| Schema-truth ADR for credential/runtime tables | Code references runtime and credential tables without a complete visible migration trail. The team needs one canonical answer on whether these are missing migrations, external/manual tables, or dead references. | Blocks Phase 28 and Phase 29 schema work. |
| Event envelope and durable outbox contract | Current `activity_events` is best-effort. Durable automation and reliable integrations need one versioned event/outbox contract first. | Blocks Phase 29 and Phase 30. |
| Workflow persistence and run contract | Current automation UI is not backed by durable drafts, runs, steps, or idempotency rules. | Blocks Phase 30. |
| Matching-engine/service contract reconciliation | Node worker assumptions and FastAPI route contracts are not visibly aligned. Durable queue/event work should not inherit that ambiguity. | Blocks Phase 29 event work and future routing vertical execution. |
| Migration/bootstrap contract for local and production environments | Development Compose boot and the migration runner are not one unified path today. The repo needs one operator-truth ADR for how schema state is established and upgraded in each environment. | Blocks Phase 29 schema changes and future operator hardening. |

## Agent Findings Snapshot

- **Repo Auditor Agent:** confirmed apps/packages/services inventory, current `/api/v1` domains, legacy route surfaces, migration range `002`-`025`, BullMQ workers, and major demo/stub candidates in matching, LTL, yard, fleet/telematics, Outlook demo mode, inbox, document AI, and marketplace UI.
- **Backend Security Agent:** confirmed auth context lives in `core/auth`, no outbox exists, `activity_events` is best-effort, public endpoints are mixed, legacy shipment/capacity routes are risky, and credential schemas are split.
- **Programs/Automation Agent:** confirmed programs persist config but not runs, automations dashboard/builder are static/browser-local, notifications are persisted and can be reused for the first workflow action, and server-owned workflow run tables/API should come before broader automation work.

## Phase 27 Conclusion

Phase 27 baseline truth is not “the repo has no foundation.” The repo has a substantial shipped spine across CRM, workspace engine, on-prem hardening, and records/views. The real truth is narrower and more actionable:

- the platform already ships meaningful product surfaces
- the imported roadmap must be biased downward to avoid calling partial/demo infrastructure “done”
- command/operator truth is uneven across apps and environments
- local boot, migration truth, public trust, capability enforcement, and durable event/workflow contracts all need explicit decisions before v5 architecture-changing work proceeds
