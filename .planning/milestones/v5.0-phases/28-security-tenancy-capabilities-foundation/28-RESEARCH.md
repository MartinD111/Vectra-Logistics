# Phase 28: Security, Tenancy & Capabilities Foundation - Research

**Researched:** 2026-07-15
**Domain:** Shared request identity, capability evaluation, tenant isolation, public-edge trust, explicit demo-vs-production behavior
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Capability Boundary
- **D-01:** Phase 28 ships the platform-wide request/capability contract only. It does not turn on assignment-based visibility enforcement in this phase.
- **D-02:** Existing tenant visibility behavior stays as-is unless a route already enforces something stricter. `project_assignments` remains future enforcement input, not a rollout target here.

### RequestContext Rollout
- **D-03:** `RequestContext` should be a core v5 sweep, not a tiny pilot and not a repo-wide rewrite.
- **D-04:** The rollout target is the v5 foundation spine: shared auth/request helpers plus projects/pages/programs, records/views, CRM, integrations/public-edge helpers, and adjacent shared surfaces.

### Public Trust Model
- **D-05:** Highest-risk public edges come first: gate webhooks and provider webhooks.
- **D-06:** POD and other token-scoped public routes should be documented as part of the same trust family, even if not fully refactored in this phase.

### Demo Behavior Policy
- **D-07:** Production may use explicit degraded responses only when clearly marked.
- **D-08:** Production must not silently synthesize operational behavior.

### Claude's Discretion
- Exact `RequestContext` and capability API shape, provided the contract carries the required fields and collapses duplicated controller extraction on the v5 spine.
- Exact signed trust primitives per public edge, provided gate/provider webhooks stop trusting tenant identity from unsigned payloads.
- Exact operator wording for explicit fallback or unavailable responses, provided production never presents synthetic operational data as live truth.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SECCTX-01 | API handlers can consume one typed `RequestContext` carrying user, company, roles, workspace, request id, deployment mode, and deployment capabilities | Existing `core/auth/middleware.ts` only sets `req.user`; many controllers reimplement `requireCompany` or `companyOf`. The repo wants one shared request contract layered into auth middleware and shared controller helpers. |
| SECCTX-02 | A reusable permission/capability service can answer workspace, page, record, program, workflow, integration, and module-level capability checks | Current RBAC is coarse (`admin`, `carrier/admin`) and spread across middleware/service assumptions. Phase 28 should add one capability resolver without changing project-assignment visibility yet. |
| SECCTX-03 | Cross-tenant negative tests exist for pilot read/write paths in folders, projects/pages/programs, records/views, CRM, marketplace/POD, and integrations | Repositories already scope many reads by `company_id`, but some lookups still fetch by raw `id` before service-level ownership checks. Negative tests should pin the v5 spine against unscoped regressions. |
| SECCTX-04 | Public or integration-facing endpoints use a documented signed token/API-key/HMAC pattern, not unsigned tenant-identifying payloads | `domains/integrations/webhook.service.ts` already has real HMAC/shared-secret verification patterns; `routes/webhookRoutes.ts` and `domains/yard/gate.controller.ts` still trust unsigned payload `company_id`. |
| SECCTX-05 | Production/demo behavior is capability-gated so production paths never silently synthesize operational demo data | `getDeploymentMode()` already exists, while fleet, inbox, Outlook, yard, and AI paths still have mixed demo conventions. Phase 28 should define and wire one explicit policy surface, not leave each domain to improvise. |
</phase_requirements>

## Summary

Phase 28 should be planned as a four-step foundation rollout, not as one giant refactor and not as a documentation-only phase. The codebase already has the key raw ingredients:

- central JWT auth middleware in `apps/api/src/core/auth/middleware.ts`
- validated deployment-mode config in `apps/api/src/core/config/secrets.ts`
- real provider webhook verification helpers in `apps/api/src/domains/integrations/webhook.service.ts`
- many domain repositories that already scope by `company_id`

The missing piece is consistency. Controllers repeatedly extract `req.user?.company_id` or local `requireCompany()` helpers, capability checks are mostly implicit role checks, public trust differs by route family, and demo behavior is inconsistent enough that later durable event/workflow work would inherit ambiguity if Phase 28 does not normalize it first.

The cleanest execution shape is:

1. shared `RequestContext` + capability primitives
2. rollout across the v5 spine domains
3. public-edge trust normalization + explicit demo/capability policy
4. cross-tenant regression tests + operator-facing trust/capability documentation

That sequencing preserves the user's boundary decision: define the contract now, defer project-assignment visibility enforcement.

## Codebase Findings

### Request identity is centralized only halfway
- `apps/api/src/core/auth/middleware.ts` defines `AuthRequest` and JWT parsing, but only populates `req.user`.
- Controllers across `projects`, `records`, `crm`, `billing`, `fleet`, `team`, `kpi`, `outlook`, and others duplicate `requireCompany(req)` or `companyOf(req)` locally.
- This means Phase 28 can remove a large class of copy-paste without needing a repo-wide rewrite: evolve the existing middleware into the source of truth and migrate the v5 spine first.

### Capability checks are coarse but stable enough to wrap
- The current system mostly distinguishes `admin` versus authenticated users, with a few `carrier/admin` checks.
- `docs/specs/modules/team-permissions.md` confirms that `project_assignments` is not enforcement today and should not be silently turned into enforcement as part of this phase.
- The capability service should therefore answer richer questions now while initially mapping many of them to the current coarse rules and deployment/module availability rather than to new visibility semantics.

### Public-edge trust already has a reusable precedent
- `apps/api/src/domains/integrations/webhook.service.ts` contains working HMAC and shared-secret verification for Samsara and Geotab.
- `apps/api/src/routes/webhookRoutes.ts` mounts public ANPR/OCR endpoints that currently trust payload `company_id`.
- `apps/api/src/domains/pod/pod.public.routes.ts` is a real token-scoped public route and should be documented as part of the same trust-family migration path.
- The repo does not need a brand-new trust philosophy; it needs one shared helper/policy that brings the risky gate/provider routes into the same posture and records the remaining migration path.

### Tenant scoping is mostly present, but regression-prone
- `records.repository.ts`, `crm.repository.ts`, and many list/find methods already scope on `company_id`.
- `projects.repository.ts` still has raw `findProject(id)`, `findProgram(id)`, and `findPage(id)` helpers, relying on higher layers to enforce ownership afterward.
- That is exactly the kind of seam negative tests should pin down: later refactors must fail loudly if company scope drops from pilot read/write paths.

### Demo behavior is structurally inconsistent today
- `fleet/telematics.service.ts`, `yard.service.ts`, `outlook.service.ts`, `inbox.parser.ts`, and `ai.service.ts` each encode different fallback behavior.
- Some fallbacks are explicitly marked demo, others degrade silently or return successful-looking operational shapes.
- Since `getDeploymentMode()` already exists, Phase 28 should add a small shared policy surface that later domains can consume instead of ad hoc fallback logic.

## Recommended Plan Shape

### Wave 1
- **28-01** Shared `RequestContext` and capability spine

### Wave 2
- **28-02** Pilot-domain rollout across projects/folders/records/CRM/integrations/POD-adjacent shared surfaces
- **28-03** Public-edge trust normalization plus explicit production-vs-demo capability policy

### Wave 3
- **28-04** Cross-tenant negative tests and operator-facing contract docs

This shape keeps plan boundaries crisp:
- Plan 01 creates primitives
- Plan 02 consumes them in authenticated domains
- Plan 03 consumes them on public/integration edges and demo-policy paths
- Plan 04 proves the contract with tests and docs

## Architectural Notes

### `RequestContext` contract
The context should carry, at minimum:
- authenticated actor identity
- resolved company/workspace identity
- normalized roles
- request id
- deployment mode
- capability metadata or a resolver handle

It should be created once in shared middleware and then surfaced either on `req.context` or an equivalent typed request field. Local controller helpers should collapse into one shared helper layer rather than being redefined per domain.

### Capability service contract
The service should answer:
- workspace admin
- page edit
- record read/write
- program build/run
- workflow build/run
- integration admin
- module access

Initially, many of those decisions can map to existing role/module/deployment truths. The important outcome for Phase 28 is not fine-grained novelty, but one stable question surface that Phase 29 and 30 can call.

### Public trust contract
Plan around one documented trust family with per-edge specializations:
- raw-body HMAC for providers that require it
- shared-secret or signed token validation where HMAC is not the provider model
- never trust unsigned tenant identity from the body
- acknowledge which public token routes are fully migrated now versus documented for later migration

### Demo/capability policy
The repo needs one answer to:
- when a capability is unavailable in cloud vs on-prem
- when a degraded response is allowed
- how that response is visibly marked
- when the action must block instead of pretending success

This should be expressed as code and docs, not only as discussion guidance.

## Pitfalls

### Pitfall 1: turning Phase 28 into a stealth visibility rollout
- `project_assignments` enforcement is explicitly deferred.
- Any plan that filters project/record visibility by assignment would violate the phase boundary.

### Pitfall 2: trying to rewrite the whole API at once
- The repo has too many domains for a full sweep here.
- The v5 foundation spine is the right rollout target; later phases can expand from that contract.

### Pitfall 3: solving public trust route-by-route with bespoke code
- Gate webhooks and provider webhooks already show two related trust models.
- The plan should unify their posture and documentation rather than adding more one-off controller checks.

### Pitfall 4: treating existing company-scoped repositories as “done”
- Several repositories are safe only because service layers or calling patterns are careful.
- Negative tests should target raw read/write seams so future changes cannot accidentally bypass company scope.

### Pitfall 5: leaving demo behavior as prose only
- If the policy does not become callable code or structured helpers, later phases will drift immediately.

## Execution Recommendation

Plan four execution packets, with authenticated-domain rollout and public-edge normalization in parallel after the shared primitives land. Keep the phase focused on contracts, tests, and trust posture. Avoid unrelated cleanup such as full legacy-route migration, assignment-based filtering, or broad integration productization.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/AGENT-WORKSTREAMS.md`
- `.planning/phases/28-security-tenancy-capabilities-foundation/28-CONTEXT.md`
- `docs/architecture/current-state-truth-matrix.md`
- `docs/specs/architecture-steering.md`
- `docs/specs/modules/team-permissions.md`
- `docs/specs/modules/yard-pod-fieldops.md`
- `docs/DEPLOYMENT.md`
- `apps/api/src/core/auth/middleware.ts`
- `apps/api/src/core/config/secrets.ts`
- `apps/api/src/routes/webhookRoutes.ts`
- `apps/api/src/domains/integrations/integrations.routes.ts`
- `apps/api/src/domains/integrations/integrations.controller.ts`
- `apps/api/src/domains/integrations/webhook.service.ts`
- `apps/api/src/domains/pod/pod.public.routes.ts`
- `apps/api/src/domains/projects/projects.routes.ts`
- `apps/api/src/domains/projects/projects.repository.ts`
- `apps/api/src/domains/records/records.routes.ts`
- `apps/api/src/domains/records/records.repository.ts`
- `apps/api/src/domains/crm/crm.routes.ts`
- `apps/api/src/domains/crm/crm.repository.ts`
- `apps/api/src/domains/yard/gate.controller.ts`

### Secondary (MEDIUM confidence)
- `apps/api/src/domains/fleet/telematics.service.ts`
- `apps/api/src/domains/outlook/outlook.service.ts`
- `apps/api/src/domains/inbox/inbox.parser.ts`
- `apps/api/src/domains/ai/ai.service.ts`
- `apps/api/src/controllers/integrationsController.ts`

## Metadata

**Confidence breakdown:**
- Shared request/capability rollout shape: HIGH
- Public trust normalization shape: HIGH
- Cross-tenant negative-test seams: HIGH
- Demo-policy normalization targets: MEDIUM-HIGH

**Research date:** 2026-07-15
**Valid until:** Re-run if auth middleware, public-edge routing, or the v5 phase boundary changes before execution.
