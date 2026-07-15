# Phase 29: Event Spine & Durable Outbox - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 29-event-spine-durable-outbox
**Areas discussed:** Event contract boundary, Pilot mutation choice, Dispatch/publish reliability, Consumer shape for v1

---

## Event Contract Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Domain event as the primary contract | Durable outbox event is canonical; `activity_events` is a downstream analytics/read concern. | ✓ |
| Thin extension of today's spine | Keep `activity_events` conceptually central and make outbox a durability wrapper. | |
| Dual-purpose single contract | One event shape serves durable publishing and analytics equally. | |

**User's choice:** Domain event as the primary contract.
**Notes:** The user then chose outbox-first with analytics derived from published events, a pilot-only rollout, and a strict outer envelope with domain-owned payloads.

---

## Pilot Mutation Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Clean architectural pilot | Prefer a simpler mutation that proves transaction + outbox + publish without heavy side effects. | ✓ |
| Operationally meaningful pilot | Prefer a more business-critical but messier operational flow. | |
| Bootstrap/platform pilot | Prefer a foundational mutation such as signup/workspace creation. | |

**User's choice:** Clean architectural pilot.
**Notes:** The user further chose an already-transactional path, a readable business event, and one composite event for the records collection creation flow rather than separate incidental events.

---

## Dispatch / Publish Reliability

| Option | Description | Selected |
|--------|-------------|----------|
| Production-safe baseline | Pending/published/failed states, retries, duplicate protection, and visible failure handling. | ✓ |
| Minimal reliable pilot | Simpler retry/duplicate handling with lighter failure visibility. | |
| Strong operator-first reliability | Add richer operator controls or dead-letter-style handling immediately. | |

**User's choice:** Production-safe baseline.
**Notes:** The user explicitly chose database-enforced duplicate protection, bounded retries with visible terminal failure, and observability via database state plus docs rather than a new API or UI.

---

## Consumer Shape for v1

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 30 workflow engine first | Optimize the first contract for durable internal workflow consumption. | ✓ |
| Generic internal platform consumers | Keep the contract neutral across multiple future internal consumers. | |
| External/integration consumers first | Design the first contract around external or connector-style consumers. | |

**User's choice:** Phase 30 workflow engine first.
**Notes:** The user wanted the contract to stay workflow-friendly but domain-first, with the workflow consumer contract documented explicitly and future integrations acknowledged as secondary reuse rather than equal v1 guarantees.

---

## Claude's Discretion

- Exact envelope field names and payload keys.
- Exact retry/backoff timing values.
- Exact dispatcher implementation shape, as long as guarantees remain database-anchored.

## Deferred Ideas

- Broader migration of existing direct `recordEvent()` call sites.
- New operator-facing outbox inspection API or UI.
- Equal first-class guarantees for external integrations in v1.
