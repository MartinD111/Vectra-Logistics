---
phase: 28-security-tenancy-capabilities-foundation
plan: 02
subsystem: pilot-domains
tags: [security, tenancy, projects, records, crm, folders, pod, integrations]

# Dependency graph
requires:
  - phase: 28-security-tenancy-capabilities-foundation (28-01)
    provides: RequestContext and shared capability primitives
provides:
  - "Pilot controllers consume shared request/company helpers"
  - "Pilot routes use shared capability checks at action seams"
  - "Projects and folders expose company-scoped lookup helpers for negative-test coverage"
affects: [phase-28-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "controller-local requireCompany/companyOf helpers collapsed into shared request-context helpers"
    - "company-scoped find*ForCompany repository helpers pin authenticated tenant lookups"

key-files:
  created:
    - apps/api/src/domains/projects/projects.service.test.ts
    - apps/api/src/domains/folders/folders.service.test.ts
    - apps/api/src/domains/crm/crm.service.test.ts
    - apps/api/src/domains/pod/pod.repository.test.ts
  modified:
    - apps/api/src/domains/projects/projects.controller.ts
    - apps/api/src/domains/projects/projects.repository.ts
    - apps/api/src/domains/projects/projects.routes.ts
    - apps/api/src/domains/projects/projects.service.ts
    - apps/api/src/domains/folders/folders.controller.ts
    - apps/api/src/domains/folders/folders.repository.ts
    - apps/api/src/domains/folders/folders.routes.ts
    - apps/api/src/domains/folders/folders.service.ts
    - apps/api/src/domains/records/records.controller.ts
    - apps/api/src/domains/records/records.routes.ts
    - apps/api/src/domains/crm/crm.controller.ts
    - apps/api/src/domains/crm/crm.routes.ts
    - apps/api/src/domains/crm/crm.service.ts
    - apps/api/src/domains/integrations/integrations.controller.ts
    - apps/api/src/domains/integrations/integrations.routes.ts
    - apps/api/src/domains/pod/pod.controller.ts
    - apps/api/src/domains/pod/pod.routes.ts

requirements-completed: [SECCTX-01, SECCTX-02, SECCTX-03]

# Metrics
duration: 1h
completed: 2026-07-15
---

# Phase 28 Plan 02 Summary

The authenticated v5 pilot domains now read tenant identity through one shared request contract instead of duplicating local helpers. Projects, folders, records, CRM, integrations, and POD-authenticated routes also gained shared capability checks at the domain seams that later workflow and event work will reuse.

The ownership-sensitive project and folder repository paths now expose company-scoped lookup helpers, which makes cross-tenant regressions easier to detect and removes a class of raw-id-only lookups from the core pilot paths.

## Verification

- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npm test`

## Notes

- Capability rollout kept current visibility semantics intact.
- Assignment-based visibility enforcement remains deferred.
