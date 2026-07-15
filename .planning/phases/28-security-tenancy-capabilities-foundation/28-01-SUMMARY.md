---
phase: 28-security-tenancy-capabilities-foundation
plan: 01
subsystem: api-core
tags: [security, tenancy, auth, capabilities]

# Dependency graph
requires: []
provides:
  - "Typed RequestContext attached by authenticateToken"
  - "Shared capability service covering workspace/page/record/program/workflow/integration/module checks"
  - "Deployment-aware capability-mode resolver for explicit fallback handling"
affects: [phase-28-02, phase-28-03, phase-28-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "core/auth/request-context.ts centralizes request identity, request id, deployment mode, and deployment capabilities"
    - "core/capabilities/index.ts provides one shared question surface instead of domain-local role branching"

key-files:
  created:
    - apps/api/src/core/auth/request-context.ts
    - apps/api/src/core/capabilities/index.ts
    - apps/api/src/core/auth/middleware.test.ts
    - apps/api/src/core/capabilities/capabilities.test.ts
  modified:
    - apps/api/src/core/auth/middleware.ts

requirements-completed: [SECCTX-01, SECCTX-02]

# Metrics
duration: 1h
completed: 2026-07-15
---

# Phase 28 Plan 01 Summary

Phase 28 now has one typed request and capability spine. `authenticateToken` still anchors the existing router pattern, but it now attaches a `RequestContext` with request id, deployment mode, deployment capabilities, normalized company/workspace identity, and actor info.

The shared capability surface lives in `apps/api/src/core/capabilities` and answers the Phase 28 requirement set without introducing assignment-based visibility enforcement. It also provides the explicit capability-mode/fallback resolver that later plans reuse for demo and degraded behavior.

## Verification

- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npm test`

## Notes

- No commits were created in this execution session.
- Existing auth status behavior stayed intact: missing token still returns `401`, invalid token still returns `403`.
