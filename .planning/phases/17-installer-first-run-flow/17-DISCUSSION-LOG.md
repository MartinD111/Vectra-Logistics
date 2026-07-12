# Phase 17: Installer / First-Run Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 17-Installer / First-Run Flow
**Areas discussed:** Local AI step: validate or trust?

---

## Local AI step: validate or trust?

### Q1: Should the installer test-connect before writing the endpoint?

| Option | Description | Selected |
|--------|-------------|----------|
| Test-connect | Installer makes a real HTTP call before saving — catches typos/unreachable hosts at setup time | ✓ |
| Trust blindly | Installer writes whatever URL is given, no verification | |

### Q2: On failure, what should the installer do?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn and continue | Print a clear warning but still write it — Ollama box may not be up yet | ✓ |
| Block and re-prompt | Refuse to save until the endpoint responds | |
| Block, but allow explicit override | Refuse by default, offer a "save anyway" confirm | |

### Q3: How deep should the probe go?

| Option | Description | Selected |
|--------|-------------|----------|
| Basic reachability | Simple HTTP GET (e.g. Ollama's `/api/tags` or root ping) — confirms something is listening | ✓ |
| Full completion round-trip | Actual small completion/generate request to prove the model is loaded and answering | |

### Q4: Is the whole step skippable?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, skippable | Matches spec §5.4's "optional step" framing; customer can configure later via Settings | ✓ |
| No, required | Installer forces an AI provider choice during install | |

**User's choice:** Test-connect with basic reachability probe; warn-and-continue on failure; step remains fully skippable.
**Notes:** All four answers matched the recommended option. No follow-up questions asked — user confirmed "Next area / done" then "I'm ready for context" without exploring the unselected areas (interaction mode, invocation/secrets handling, re-run/idempotency).

---

## Claude's Discretion

The following gray areas were surfaced but not selected for discussion — left to research/planning judgment (see CONTEXT.md "Claude's Discretion" for full detail):
- Interaction mode (interactive prompts vs. scripted flags vs. both)
- Invocation mechanism & secrets handling (how the installer is run; `.env` write vs. stdout print)
- Re-run / idempotency behavior (already-initialized DB handling)
- The base-schema gap found during codebase scouting (`database/init.sql`/`extensions.sql` never folded into the numbered migration runner) — technical finding, not a user preference

## Deferred Ideas

- Backend-side local AI provider dispatch — Phase 18
- `VERSION` file / `CHANGELOG.md` / upgrade procedure — Phase 19
- Reverse-proxy / inbound-connectivity documentation — Phase 20
