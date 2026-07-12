# Phase 16: Production Compose + DEPLOYMENT_MODE - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 16-Production Compose + DEPLOYMENT_MODE
**Areas discussed:** Matching-engine in prod compose, DEPLOYMENT_MODE unset/invalid handling, Prod Postgres/Redis network exposure, Registration-closed mechanics (on-prem)

---

## Matching-engine in prod compose

| Option | Description | Selected |
|--------|-------------|----------|
| Include it | Add matching-engine as a 5th service in docker-compose.prod.yml, built from its own production-ready Dockerfile, same as the other four. | ✓ |
| Leave it out of this phase | Scope this phase strictly to the four named app images + Postgres + Redis; matching-engine gets its own follow-up. | |

**User's choice:** Include it
**Notes:** ROADMAP's "four production app images" names the primary web apps; matching-engine is a real runtime dependency (`MATCHING_ENGINE_URL`) whose omission would silently break LTL matching in production.

---

## DEPLOYMENT_MODE unset/invalid handling

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail on unset/invalid | Boot refuses to start unless DEPLOYMENT_MODE is exactly 'cloud' or 'on-prem'. Consistent with SEC-01/02 fail-fast pattern. | ✓ |
| Default to 'cloud' if unset | Missing DEPLOYMENT_MODE silently behaves as 'cloud'; only an explicitly invalid value hard-fails. | |

**User's choice:** Hard-fail on unset/invalid
**Notes:** Consistent with Phase 14's JWT_SECRET/ENCRYPTION_KEY pattern. Means existing Cloud environments must add `DEPLOYMENT_MODE=cloud` to their `.env` when this ships — flagged as a required follow-up, not a gap.

---

## Prod Postgres/Redis network exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Internal-only, no published ports | Postgres/Redis reachable only via the compose network. Reduces attack surface. | ✓ |
| Publish host ports like dev | Keep host:5433/host:6380 mappings for direct psql/redis-cli access. | |

**User's choice:** Internal-only, no published ports
**Notes:** Admin DB access on a customer's box goes through `docker compose exec` or an operator-provisioned bastion, not an open host port.

---

## Registration-closed mechanics (on-prem)

| Option | Description | Selected |
|--------|-------------|----------|
| Always closed on on-prem | `/api/auth/signup` always 403s when DEPLOYMENT_MODE=on-prem; installer is the only path to create the one company. | ✓ |
| Open until first company exists | Signup stays usable until a companies row exists, then blocks. | |

**User's choice:** Always closed on on-prem
**Notes:** Matches spec exactly — simplest, no DB state check needed, avoids two valid "first company" creation paths.

---

## Claude's Discretion

- Exact production Dockerfile build details for the matching-engine service beyond "production image, not dev"
- Exact `DEPLOYMENT_MODE` read/validation code location (follow Phase 14's JWT_SECRET/ENCRYPTION_KEY pattern)
- `restart:` policy and healthcheck tuning differences between dev and prod compose
- Volume naming/backup conventions for `postgres_data`/`redis_data` in the prod compose file
- "Cloud-only seed data at boot" (D-05): no concrete seed data found in the codebase to gate; satisfied vacuously — do not invent seed data

## Deferred Ideas

- Installer/first-run flow writing `DEPLOYMENT_MODE=on-prem` — Phase 17
- Gating backend-side local AI provider path behind `DEPLOYMENT_MODE` — Phase 18
- Reverse-proxy / inbound-connectivity documentation — Phase 20 (DOC-01)
- Any future concrete cloud-only seed data hook — no-op today, hook exists for later use
