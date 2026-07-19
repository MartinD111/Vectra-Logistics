---
phase: 28-security-tenancy-capabilities-foundation
plan: 03
subsystem: public-trust
tags: [security, webhooks, trust, demo-policy, outlook, inbox, ai]

# Dependency graph
requires:
  - phase: 28-security-tenancy-capabilities-foundation (28-01)
    provides: deployment-aware capability policy primitives
provides:
  - "Canonical trusted public request helper for gate and provider edges"
  - "Gate webhook trust moved from body company_id to signed X-Gate-Token"
  - "Explicit fallback policy applied to representative demo-backed services"
affects: [phase-28-04, future-public-token-migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verifyTrustedPublicRequest() unifies gate-token, HMAC, and bearer-token trust checks"
    - "explicit demo fallback decisions route through capabilityService.resolveCapabilityMode()"

key-files:
  created:
    - apps/api/src/domains/integrations/webhook.service.test.ts
  modified:
    - apps/api/src/domains/integrations/webhook.service.ts
    - apps/api/src/domains/integrations/webhook.controller.ts
    - apps/api/src/domains/yard/gate.controller.ts
    - apps/api/src/routes/webhookRoutes.ts
    - apps/api/src/domains/outlook/outlook.service.ts
    - apps/api/src/domains/inbox/inbox.parser.ts
    - apps/api/src/domains/inbox/inbox.parser.test.ts
    - apps/api/src/domains/ai/ai.service.ts

requirements-completed: [SECCTX-04, SECCTX-05]

# Metrics
duration: 45min
completed: 2026-07-15
---

# Phase 28 Plan 03 Summary

Phase 28 now treats gate ANPR/OCR and provider webhooks as one trusted public-edge family. Gate requests no longer take tenant identity from an unsigned body field; they resolve it from a signed `X-Gate-Token`, while Samsara and Geotab continue using provider-appropriate signature or token verification under the same helper.

The representative demo-backed services now route degraded behavior through the shared capability-mode policy. Inbox extraction marks deterministic fallbacks as demo output, Outlook connect uses an explicit sample-mailbox path when that fallback is allowed, and translation fallback is no longer an ad hoc branch.

## Verification

- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npm test`

## Notes

- POD remains documented as part of the same public-trust family, but its full trust migration is still deferred.
