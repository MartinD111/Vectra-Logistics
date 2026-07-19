# Phase 27: Baseline Truth & Roadmap Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 27-baseline-truth-roadmap-reconciliation
**Areas discussed:** Status taxonomy and evidence bar, Inventory boundary

---

## Status taxonomy and evidence bar

| Option | Description | Selected |
|--------|-------------|----------|
| Strict | `shipped` only if a real code path exists, is wired into the product surface, and is backed by repo evidence; demo/stub/fake-data paths do not count as shipped | ✓ |
| Pragmatic | `shipped` can include user-visible capabilities even if edges are manual, weakly tested, or operationally incomplete | |
| Narrative-first | Labels act more like product communication than audit truth | |

**User's choice:** Strict
**Notes:** The user wants Phase 27 to produce an audit artifact, not a marketing artifact.

| Option | Description | Selected |
|--------|-------------|----------|
| Partial | Use `partial` when the capability is real but not production-truthful end to end | ✓ |
| Demo | Reserve `demo` for anything synthesizing data, using stubs, or mainly acting as a façade | |
| Split by surface | Tag one capability differently by surface, such as partial backend / demo UI | |

**User's choice:** Partial
**Notes:** Real-but-incomplete paths should not be inflated to shipped.

| Option | Description | Selected |
|--------|-------------|----------|
| Repo evidence only | Status must be justified by code/docs/scripts/routes/migrations visible in this repo | ✓ |
| Repo + planning artifacts | `.planning/` findings and milestone audits may count alongside code evidence | |
| Repo + runnable check | Prefer repo evidence, but require a command or local verification for ambiguous shipped claims | |

**User's choice:** Repo evidence only
**Notes:** The user explicitly rejected tribal knowledge or assumed behavior as evidence.

| Option | Description | Selected |
|--------|-------------|----------|
| Bias downward | When signals conflict, use the lower-confidence status until stronger proof exists | ✓ |
| Use caveated higher status | Allow higher statuses with strong caveat notes | |
| Escalate to unresolved | Create an explicit unresolved status or note instead of forcing a classification | |

**User's choice:** Bias downward
**Notes:** Ambiguous cases should resolve conservatively.

---

## Inventory boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Core runtime surfaces only | Apps, packages, services, route domains, migrations/tables, workers/queues, and public endpoints only | |
| Core + operational entrypoints | Core surfaces plus scripts, boot/build commands, deploy/local-run entrypoints, and env-sensitive runtime toggles that materially change behavior | ✓ |
| Core + operational + behavior flags | Option 2 plus demo/stub paths, disabled integrations, fake-data paths, and feature switches as first-class inventory items | |

**User's choice:** Core + operational entrypoints
**Notes:** The user wants execution-useful truth without turning inventory into a full behavior audit register.

| Option | Description | Selected |
|--------|-------------|----------|
| Mention only when attached to a core surface | Document demo/stub behavior as a note under the app/service/route/integration it affects | ✓ |
| Separate demo/stub section | Create a dedicated section listing all demo, fake-data, and stubbed paths | |
| Exclude from inventory | Keep inventory structural only; leave demo/stub behavior elsewhere | |

**User's choice:** Mention only when attached to a core surface
**Notes:** This keeps inventory structural while still flagging behavior caveats where they matter.

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped surfaces | Summarize route domains, worker families, migration/table groups, apps/packages/services, and public endpoints at a maintainable level | ✓ |
| Exhaustive enumeration | List every route, worker, migration, package, script, and endpoint individually | |
| Hybrid | Group by default, but break out individual risky items more often | |

**User's choice:** Grouped surfaces
**Notes:** The user wants maintainable grouped documentation, with exceptional items called out only when necessary.

---

## Claude's Discretion

- Exact artifact structure for the inventory and baseline command sections.
- Exact ADR-gap list presentation, as long as it supports the Phase 27 success criteria.

## Deferred Ideas

None.
