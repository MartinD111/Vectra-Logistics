# Phase 28 Security, Tenancy, and Capability Contract

**Created:** 2026-07-15  
**Scope:** Shared request identity, capability evaluation, public trust, and explicit demo/degraded behavior

## What Shipped

Phase 28 establishes one shared security contract for the v5 foundation work:

- authenticated API handlers consume one typed `RequestContext`
- pilot v5 domains reuse one shared capability surface
- canonical public edges trust signed credentials instead of unsigned tenant payloads
- demo and degraded behavior is explicit, not silently presented as live operational truth

This phase is intentionally a contract phase. It does **not** turn on assignment-based visibility enforcement.

## Request Context

Authenticated routes continue using `authenticateToken`, but that middleware now attaches a typed `RequestContext` with:

- `user`
- `companyId`
- `roles`
- `workspaceId`
- `requestId`
- `deploymentMode`
- `deploymentCapabilities`

Rules:

- controllers on the v5 spine should read tenant identity from shared request-context helpers, not local `requireCompany()` or `companyOf()` duplicates
- deployment mode comes from `getDeploymentMode()`, not ad hoc environment branching inside controllers
- request IDs are available at the middleware seam so later event and workflow work can correlate actions consistently

## Capability Boundary

The canonical capability surface lives under `apps/api/src/core/capabilities`.

Named capability questions in this phase:

- `workspace.admin`
- `page.edit`
- `record.read`
- `record.write`
- `program.build`
- `program.run`
- `workflow.build`
- `workflow.run`
- `integration.admin`
- `module.access`

Rules:

- capability checks must route through the shared capability service
- Phase 28 maps many answers to the repo's current coarse truth: authenticated company member or workspace admin
- stricter existing behavior stays stricter
- Phase 28 does **not** introduce assignment-based project or record visibility

## Tenant Isolation Contract

Tenant isolation still relies on request-scoped `company_id` plus repository and service scoping. Phase 28 tightens the shape of that contract:

- pilot repositories now expose company-scoped lookup helpers for projects, pages, programs, and folders
- cross-tenant regression tests pin the pilot paths so future refactors fail loudly if company scoping drops
- public token routes remain outside JWT auth, but they must still rely on a credentialed trust root rather than an unsigned caller-supplied tenant field

## Public Trust Family

Phase 28 makes two public-edge families canonical:

### Gate webhooks

- ANPR and OCR trust tenant identity from a signed `X-Gate-Token`
- request bodies no longer supply the root `company_id`
- the signed token may also carry gate metadata

### Provider webhooks

- Samsara uses raw-body HMAC verification
- Geotab uses a shared bearer token
- provider-specific verification still happens before payload processing

### Deferred public-token migration

The POD public route family belongs to the same trust family, but its full migration remains deferred. Treat it as a documented next target, not as already normalized by Phase 28.

## Explicit Demo and Degraded Behavior

Production must not silently synthesize operational success. The shared rule is:

- if the capability is available, run the real path
- if the capability is unavailable but a clearly marked sample fallback is safe, return an explicit demo fallback
- otherwise return an explicit unavailable response

Phase 28 applies that rule to representative demo-backed seams such as inbox extraction, translation, and Outlook connect behavior.

## Deferred Items

These items are still intentionally deferred after Phase 28:

- assignment-based visibility enforcement through `project_assignments`
- full migration of every public token route into the same signed trust implementation
- broader capability rollout beyond the v5 foundation spine
- durable workflow authorization beyond the shared capability contract

## Reuse Rule for Later Phases

Phase 29 and Phase 30 implementers must reuse this contract instead of improvising new request, trust, or capability patterns:

- start from `RequestContext`
- ask shared capability questions
- inherit the public trust family
- keep demo and degraded behavior explicit
