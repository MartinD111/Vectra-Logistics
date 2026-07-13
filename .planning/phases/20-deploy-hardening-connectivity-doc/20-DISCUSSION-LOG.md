# Phase 20: Deploy Hardening + Connectivity Doc - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 20-Deploy Hardening + Connectivity Doc
**Areas discussed:** Health check depth & failure semantics, Connectivity doc placement & scope boundary

---

## Health check depth & failure semantics

### Q1: One /health endpoint doing a live check, or split into /health (liveness) + /ready (readiness)?

| Option | Description | Selected |
|--------|-------------|----------|
| Single /health, live checks | Keep the one endpoint, extend it with live SELECT 1 + Redis PING | ✓ |
| Split /health + /ready | New /ready endpoint for live checks, /health stays a cheap liveness ping | |
| You decide | Leave to researcher/planner | |

**User's choice:** Single /health, live checks
**Notes:** Spec treats /health and a separate /ready as equivalent options; single endpoint avoids a new route.

### Q2: Should /health run the live DB/Redis check on every single request, or cache the result for a short window?

| Option | Description | Selected |
|--------|-------------|----------|
| Every request, no cache | SELECT 1 / PING are cheap, health probes are low-frequency | ✓ |
| Short cache (2-5s) | Protects against high-frequency probing, adds staleness window | |
| You decide | Leave to researcher/planner | |

**User's choice:** Every request, no cache

### Q3: What should the response look like when Postgres or Redis is unreachable?

| Option | Description | Selected |
|--------|-------------|----------|
| 503 + per-dependency detail | {status, version, dependencies:{postgres, redis}} with HTTP 503 | ✓ |
| 503, status flip only | {status, version} — no per-dependency breakdown | |
| You decide | Leave to researcher/planner | |

**User's choice:** 503 + per-dependency detail

---

## Connectivity doc placement & scope boundary

### Q1: Where should the reverse-proxy connectivity doc (DOC-01) live?

| Option | Description | Selected |
|--------|-------------|----------|
| New section in docs/DEPLOYMENT.md | Same file as Phase 19's upgrade procedure, one doc to read | ✓ |
| Standalone docs/CONNECTIVITY.md | Separate file, cross-linked from DEPLOYMENT.md | |
| You decide | Leave to researcher/planner | |

**User's choice:** New section in docs/DEPLOYMENT.md

### Q2: Confirming scope — is the Socket.IO Redis-adapter gap (§3.4) out of scope for this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Correct — out of scope | Not named in HRD-01/02/03/DOC-01; Cloud-priority scaling concern | ✓ |
| Actually, pull it into this phase | Would be scope creep beyond roadmap success criteria | |

**User's choice:** Correct — out of scope

---

## Claude's Discretion

- CORS/Socket.IO origin source (HRD-01) — user did not select this area for discussion. Left to researcher/planner: reuse existing `NEXT_PUBLIC_*_URL` env vars vs. a dedicated `CORS_ALLOWED_ORIGINS` var.
- Rate-limit scope & thresholds (HRD-02) — user did not select this area for discussion. Left to researcher/planner: which of the 5 auth routes, limit/window values, 429 response shape.
- Health-check module code structure (inline vs. extracted) — Claude's call.
- Exact prose/structure of the new DEPLOYMENT.md connectivity section — Claude's call, content must match on-premise-deployment.md §7.

## Deferred Ideas

- Socket.IO Redis-adapter / horizontal-scaling fix (cloud-deployment.md §3.4) — confirmed out of scope for this phase; not currently assigned to any phase.
