# Phase 28: Security, Tenancy & Capabilities Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 28-security-tenancy-capabilities-foundation
**Areas discussed:** Capability boundary, RequestContext rollout, Public trust model, Demo behavior policy

---

## Capability boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Contract only | Build `RequestContext` + capability service, but leave assignment-based visibility enforcement for later | ✓ |
| Contract + pilot enforcement | Build the contract and also make pilot read paths honor assignment-style visibility now | |
| Contract + opt-in enforcement | Build the contract and add assignment-based visibility as a company-level opt-in for pilot domains | |

**User's choice:** Contract only
**Notes:** The user chose to make Phase 28 a foundation-contract phase rather than mixing in assignment-based visibility enforcement.

---

## RequestContext rollout

| Option | Description | Selected |
|--------|-------------|----------|
| Tight pilot | Wire `RequestContext` into only a small proof slice | |
| Core v5 sweep | Adopt it across the main domains Phases 28-30 depend on | ✓ |
| Broad API sweep | Replace the old pattern across most or all `/api/v1` domains now | |

**User's choice:** Core v5 sweep
**Notes:** Recommendation was to avoid both an undersized pilot that Phase 29/30 would immediately outgrow and a repo-wide refactor that would create unnecessary churn.

---

## Public trust model

| Option | Description | Selected |
|--------|-------------|----------|
| All current public edges | Unify the pattern across every live public/integration-facing endpoint now | |
| Highest-risk edges first | Make gate webhooks and provider webhooks the canonical first targets now | ✓ |
| New pattern + migration path | Define the shared contract and fully apply it to the worst gaps while documenting the rest as migration targets | |

**User's choice:** Highest-risk edges first
**Notes:** The user wanted Phase 28 focused on the real security holes first instead of forcing every public route through a full trust rewrite immediately.

---

## Demo behavior policy

| Option | Description | Selected |
|--------|-------------|----------|
| Deny by default | Missing capabilities block in production unless an explicitly marked demo context is active | |
| Explicit fallback | Some non-destructive surfaces may degrade only when clearly marked as sample/demo | ✓ |
| Per-surface discretion | Let each domain independently choose deny/degrade/demo under a shared policy | |

**User's choice:** Explicit fallback
**Notes:** Production fallbacks are acceptable only when they are explicit and cannot be mistaken for live operational data.

---

## Claude's Discretion

- Exact `RequestContext` field and middleware shape
- Exact capability service API shape
- Exact trust primitive choice per public edge
- Exact wording and payload shape for explicit demo/sample responses

## Deferred Ideas

- Assignment-based visibility enforcement via `project_assignments`
- Full trust normalization of every public token-scoped route beyond the highest-risk webhook edges
