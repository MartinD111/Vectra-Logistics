# Phase 14: Security Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 14-Security Hardening
**Areas discussed:** Boot-fail strictness, docker-compose.yml defaults

---

## Boot-fail strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Universal — no bypass | Server refuses to boot without secrets set, in every environment; local dev sets real values via .env | ✓ |
| NODE_ENV bypass for dev | Only hard-fail when NODE_ENV=production; dev keeps zero-setup via compose fallback | |

**User's choice:** Universal — no bypass
**Notes:** Matches roadmap Success Criteria #4 literally — dev supplies secrets too, just via .env not committed defaults.

| Option | Description | Selected |
|--------|-------------|----------|
| Reject known fallback too | Boot check fails on unset/empty AND on the literal known committed fallback strings | ✓ |
| Presence-only check | Only fails if unset/empty; doesn't special-case the old default value | |

**User's choice:** Reject known fallback too
**Notes:** Defense in depth — stops someone pasting the old default into a real .env and passing the check.

---

## docker-compose.yml defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Strip fallbacks now | Change to plain `${JWT_SECRET}`/`${ENCRYPTION_KEY}`, forcing a .env even for docker-compose.yml | ✓ |
| Leave docker-compose.yml alone | Keep fallbacks, treat file as dev-only until Phase 16's docker-compose.prod.yml | |

**User's choice:** Strip fallbacks now
**Notes:** Consistent with the "no bypass" decision above — one enforcement path.

| Option | Description | Selected |
|--------|-------------|----------|
| Update .env.example with instructions | Add placeholders + generation command comment | ✓ |
| Document in PR/README only | Don't touch .env.example structurally | |

**User's choice:** Update .env.example with instructions
**Notes:** No new tooling — just a copy-and-fill-in step for devs.

---

## Claude's Discretion

- Seed-admin removal mechanism (SEC-03) — user chose not to discuss in this session; left for researcher/planner, with scouting notes captured in CONTEXT.md (`<decisions>` → Claude's Discretion).
- Exact code structure for the boot-time check (module vs. inline vs. per-site) — no existing config/env module found to reuse.
- Boot error message wording/format — must be "clear" per roadmap, no specific format requested.

## Deferred Ideas

None — discussion stayed within phase scope.
