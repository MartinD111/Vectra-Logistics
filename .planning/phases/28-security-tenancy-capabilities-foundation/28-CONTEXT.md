# Phase 28: Security, Tenancy & Capabilities Foundation - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 28 establishes one shared request identity/capability contract for the v5 foundation work without turning on new visibility enforcement yet. It introduces a typed `RequestContext`, a reusable capability service, pilot cross-tenant isolation tests, a canonical trust model for the highest-risk public webhook edges, and an explicit production-vs-demo capability policy so later event/workflow/integration work does not build on silent synthetic behavior.

</domain>

<decisions>
## Implementation Decisions

### Capability Boundary
- **D-01:** Phase 28 ships the **platform-wide request/capability contract only**. It does **not** turn on assignment-based visibility enforcement in this phase.
- **D-02:** Existing tenant visibility behavior stays as-is unless a route already enforces something stricter. `project_assignments` remains a future enforcement input, not a Phase 28 rollout target.

### RequestContext Rollout
- **D-03:** `RequestContext` rollout should be a **core v5 sweep**, not a tiny pilot and not a repo-wide rewrite. It should cover shared auth/request middleware and the domains Phases 28-30 will stand on.
- **D-04:** The practical target set is the v5 foundation spine: shared request/auth helpers plus pilot domains such as projects/pages/programs, records/views, CRM, integrations/public-edge helpers, and other shared surfaces needed by later event/workflow work.

### Public Trust Model
- **D-05:** Phase 28 should treat the **highest-risk public edges first** as the canonical trust targets: gate webhooks and provider webhooks.
- **D-06:** The phase should document how other public token-scoped routes (such as POD) fit the same future trust model, but it does not need to fully refactor every public edge in this phase.

### Demo Behavior Policy
- **D-07:** Production may use an **explicit fallback** only when the degraded response is clearly marked and cannot be mistaken for live operational data.
- **D-08:** Production must **not silently synthesize operational behavior**. If a capability is unavailable and no safe explicit fallback exists, the action should block or return a clearly unavailable response rather than pretending it succeeded with real data.

### Claude's Discretion
- Exact `RequestContext` field naming and layering, as long as it carries the Phase 28 requirement set (`user`, `company`, `roles`, `workspace`, `request id`, `deployment mode`, capability metadata) and replaces duplicated per-controller extraction on the core v5 surfaces.
- Exact capability service API shape (`can(...)`, named helpers, resolver objects, etc.), as long as it expresses workspace admin, page edit, record read/write, program/workflow build/run, integration admin, and module access consistently.
- Exact signed trust primitives per edge (`HMAC`, signed token, API key) so long as gate/provider webhooks receive a unified, documented, non-body-trusting trust posture in this phase.
- Exact operator/UI wording for explicit demo or sample responses, as long as production never silently passes off synthetic operational data as real.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and milestone contract
- `.planning/ROADMAP.md` - Phase 28 goal, dependencies, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `SECCTX-01` through `SECCTX-05`, the requirements this phase must satisfy.
- `.planning/PROJECT.md` - v5 foundation framing, request/capability/event/workflow dependency order, and preserved platform constraints.
- `.planning/STATE.md` - carried-forward sequencing decisions and the v5 risks that make Phase 28 necessary.
- `.planning/AGENT-WORKSTREAMS.md` - ownership split for Backend Security, QA/Release, Integration, and Docs/Ops workstreams.

### Existing security and architecture steering docs
- `docs/architecture/current-state-truth-matrix.md` - current repo truth on mixed route surfaces, demo/stub risks, public trust debt, and the specific Phase 28 ADR gap list.
- `docs/specs/architecture-steering.md` - platform-core steering rules, on-prem/public-ingress constraints, and the "config toggle, not fork" rule that should shape capability behavior.
- `docs/DEPLOYMENT.md` - current public exposure expectations for `/api/webhooks/*` and `/api/pod/*`, useful when defining the migration path for trusted public edges.

### Permissions and public-edge reference docs
- `docs/specs/modules/team-permissions.md` - current coarse RBAC reality, `project_assignments` non-enforcement, and the recommendation to defer assignment-based visibility rollout instead of mixing it into this phase.
- `docs/specs/modules/yard-pod-fieldops.md` - concrete security gap for unauthenticated ANPR/OCR gate webhooks and the recommendation to reuse the existing HMAC verification pattern.

### Existing code surfaces Phase 28 must normalize
- `apps/api/src/core/auth/middleware.ts` - current `AuthRequest`, `authenticateToken`, and role middleware that Phase 28 should evolve into a typed request context.
- `apps/api/src/core/config/secrets.ts` - current `DEPLOYMENT_MODE` source of truth and boot-time validation that should feed deployment-aware request/capability handling.
- `apps/api/src/routes/webhookRoutes.ts` - legacy public gate/provider webhook routes, including the current unauthenticated `anpr`/`ocr` edges.
- `apps/api/src/domains/integrations/integrations.routes.ts` - existing provider-specific webhook verification surface and admin integration routes.
- `apps/api/src/controllers/integrationsController.ts` - legacy public webhook controller path and plaintext credential stub that planning should account for when normalizing public/integration trust.
- `apps/api/src/services/webhookService.ts` - generic webhook routing/logging behavior for legacy public provider webhooks.
- `apps/api/src/domains/pod/pod.public.routes.ts` - public token-scoped POD route family that should be documented as part of the future trust model, even if not fully refactored now.
- `apps/api/src/controllers/authController.ts` - existing deployment-mode-aware behavior (`signup` blocked on on-prem) showing that production-vs-mode capability gating already has a precedent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/core/auth/middleware.ts` already centralizes JWT parsing and role checks; Phase 28 can evolve this into one typed `RequestContext` source instead of adding parallel auth parsing.
- `apps/api/src/core/config/secrets.ts` already provides a validated, cached `getDeploymentMode()` helper that can feed deployment-aware capability and fallback decisions.
- `apps/api/src/domains/integrations/webhook.service.ts` already contains real HMAC/token verification logic for provider webhooks; gate webhook hardening should reuse this proven trust pattern rather than inventing a second model.
- `apps/api/src/domains/pod/pod.public.routes.ts` is a real token-scoped public route and serves as the clearest current precedent for a public endpoint that is not session-authenticated but still credentialed.

### Established Patterns
- Tenant isolation is currently enforced by deriving `company_id` from JWT-backed request state plus repository/service scoping, not by schema-level RLS. Phase 28 should strengthen that pattern, not replace it.
- Controllers repeatedly use local helpers like `requireCompany(req)` or `companyOf(req)`; `RequestContext` should collapse that duplication across the core v5 domains.
- Current RBAC is intentionally coarse (`admin` and `carrier/admin` are the main enforced shapes). This phase should define a capability contract without simultaneously changing visibility semantics.
- Demo behavior already exists across multiple domains (`outlook`, `yard`, `fleet`, `inbox`, `ai`), but the rules are inconsistent. Phase 28 needs one explicit policy that later phases can consume.

### Integration Points
- Shared request/context work will connect to `apps/api/src/server.ts`, auth middleware, and the v5 foundation domains that later event and workflow phases depend on.
- Capability checks will need to sit above or alongside current role-only guards so future workflow/integration actions can ask one shared authorization question.
- Public trust work will connect first to legacy `webhookRoutes.ts` gate/provider edges and the domain integration webhook surface, with POD documented as a next migration target under the same trust family.
- Cross-tenant negative tests should focus on pilot repository/service paths in the domains Phase 28 and later v5 phases actually rely on.

</code_context>

<specifics>
## Specific Ideas

The user explicitly chose to keep Phase 28 as a **foundation contract phase**, not a visibility-behavior phase:
- build the shared capability model now
- do not turn on assignment-based access enforcement yet
- adopt `RequestContext` across the core v5 sweep rather than a tiny pilot or whole-API rewrite
- fix the most dangerous public webhook edges first
- allow only explicit, unmistakable demo/sample fallbacks in production

No extra product-specific visual or UX references were introduced during discussion. The decisions were structural and policy-oriented.

</specifics>

<deferred>
## Deferred Ideas

- Assignment-based visibility enforcement using `project_assignments` remains intentionally deferred. The user chose to define the contract in Phase 28 without changing actual visibility behavior yet.
- Full normalization of all public token-scoped routes under one trust implementation is deferred. This phase focuses on gate/provider webhooks first and documents the migration path for POD and similar surfaces.

</deferred>

---
*Phase: 28-security-tenancy-capabilities-foundation*
*Context gathered: 2026-07-15*
