---
phase: 01
slug: schema-crm-domain-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-05
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Migration file → live DB | Raw SQL executed with full DDL privileges against the dev/prod database | Schema DDL |
| Client (frontend) → /api/v1/crm/* | Untrusted request body; must be Zod-validated before touching the DB | Client CRUD payloads, project-link overrides |
| crm.controller → crm.service | Trusted internal call, but company_id must always come from the authenticated JWT, never from the request body/params | company_id (tenant scope) |
| Browser (CrmClientsBlock) → crm.api.ts → /api/v1/crm | Client-side fetch; auth cookie/JWT attached by the shared `apiFetch` client wrapper | Auth token, client records |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | 021_crm_extensions.sql | mitigate | All statements idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, guarded `DO $$` for constraint) — verified in migration file lines 19-67 | closed |
| T-01-02 | Information Disclosure | email_messages.full_body | accept | Plaintext storage matches existing `notes`/`vat_id` plaintext columns on `clients`; encryption out of scope for v1 | closed |
| T-01-03 | Denial of Service | kpi_results_subject_check constraint | mitigate | DB-level CHECK constraint verified present (migration lines 59-67) — prevents orphan rows with neither user nor client subject | closed |
| T-01-04 | Tampering | crm.controller.ts (all handlers) | mitigate | `requireCompany(req)` derives `company_id` exclusively from `req.user?.company_id` (JWT-populated) in all 9 handlers — verified in crm.controller.ts | closed |
| T-01-05 | Spoofing | crm.routes.ts | mitigate | `router.use(authenticateToken)` applied before any route handler — verified in crm.routes.ts line 10, no route reachable unauthenticated | closed |
| T-01-06 | Tampering | crm.service.ts createClient/updateClient | mitigate | `CreateClientSchema`/`UpdateClientSchema` Zod `.safeParse()` validation before repository calls — verified in crm.service.ts lines 21, 38 | closed |
| T-01-07 | Elevation of Privilege | crm.repository.ts upsertProjectLink | mitigate | Every repository query scoped by `company_id` (verified: listClients, findClient, listProjectLinks, findProjectLink, upsertProjectLink all include `company_id` in WHERE/INSERT); `getClient` 404s before any project-link operation on a non-owned client | closed |
| T-01-08 | Information Disclosure | getClientEmails / getClientRisk stubs | accept | Stubs verified non-throwing and return only empty/unavailable placeholder data (`[]`, `{status:'unavailable'}`) — no real content exists yet to leak; re-evaluate when Phases 5/6 implement real logic | closed |
| T-01-09 | Tampering | crm.api.ts | accept | Reuses existing `apiFetch` client wrapper unmodified — no new auth/CSRF surface introduced | closed |
| T-01-10 | Repudiation | useCrm.ts cache namespace | mitigate | Distinct query-key namespace (`crm-clients` vs `billing-clients`) confirmed in useCrm.ts — prevents stale/cross-contaminated cache reads between domains | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-01-02 | Email body stored in plaintext; matches existing plaintext columns on `clients` (notes, vat_id). Correspondence encryption is out of scope for v1 and not a current requirement. | GSD secure-phase (auto-classified, code-verified) | 2026-07-05 |
| R-02 | T-01-08 | Stub endpoints (email history, risk status) return only placeholder data — nothing exists yet to disclose. Must be re-evaluated when Phase 5 (email sync) and Phase 6 (KPI risk evaluator) implement real logic. | GSD secure-phase (auto-classified, code-verified) | 2026-07-05 |
| R-03 | T-01-09 | Frontend API wrapper reuses the existing, already-reviewed `apiFetch` client — no new auth surface. | GSD secure-phase (auto-classified, code-verified) | 2026-07-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-05 | 10 | 10 | 0 | Claude (gsd-secure-phase, direct code verification — auditor subagent not required as all threats verified closed against live implementation) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-05
