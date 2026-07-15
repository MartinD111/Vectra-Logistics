# Vectra Platform Specs

Code-grounded implementation specs for the Vectra logistics workspace platform.
Each spec follows the same shape: **what exists in the code today → gaps →
suggested build order → do/don't.** They are cross-referenced with each other
and anchored to real files in this repo.

Imported 2026-07-11 from the authoring set in Google Drive (`Vectra MD/`).

> **Steering references.** Several specs cite `CLAUDE.md §1`…`§5`. Those section
> numbers refer to [`architecture-steering.md`](architecture-steering.md) in this
> folder (the hand-authored architectural steering document), **not** the
> GSD-generated `CLAUDE.md` at the repo root. Its content is also summarized in
> `.planning/PROJECT.md` → *Platform Vision & Architecture (North Star)*.

## Index

### Steering
- [architecture-steering.md](architecture-steering.md) — the §1–§5 architectural source of truth: platform-core vs. vertical modules, On-Premise-without-forking, AI-as-helper, event-spine discipline, config-toggle-not-fork.

### core/ — the generic engines everything builds on
- [event-spine.md](core/event-spine.md) — `activity_events`, the append-only event log that is the single source of truth for all stats/KPIs.
- [kpi-engine.md](core/kpi-engine.md) — pluggable KPI rules/evaluators/results sitting on top of the spine.
- [workspace-blocks.md](core/workspace-blocks.md) — the Notion/Loop-grade page & block editor; elevating Kanban into a real Records+Views database model.
- [program-builder.md](core/program-builder.md) — Mini Programs, the block engine, and the AI (Gemma) description→config generator.
- [ai-integration.md](core/ai-integration.md) — the AI provider abstraction (cloud/local), its consumers, and the AI-is-a-helper philosophy.

### deployment/ — the two deployment targets of one codebase
- [on-premise-deployment.md](deployment/on-premise-deployment.md) — installable/self-operable at a customer site; migration runner, installer, security fixes, `DEPLOYMENT_MODE`.
- [cloud-deployment.md](deployment/cloud-deployment.md) — multi-tenant SaaS config; CORS/rate-limit/health/Socket.IO-adapter hardening at scale.
- [release-and-migrations.md](deployment/release-and-migrations.md) — release versioning, `CHANGELOG.md`, and the On-Premise upgrade/rollback procedure.

### modules/ — the vertical business modules
- [procurement.md](modules/procurement.md) — RFQ / freight buying (email/API/WhatsApp/portal → normalized quotes → select → shipment).
- [cmr-workflow.md](modules/cmr-workflow.md) — CMR Digital Workflow: consignment note → driver PWA → POD photo → OCR/AI validate → invoice.
- [fleet.md](modules/fleet.md) — vehicles, drivers, telematics, spot quotes, exceptions.
- [marketplace-ltl.md](modules/marketplace-ltl.md) — FTL matching marketplace + silent LTL matching.
- [yard-pod-fieldops.md](modules/yard-pod-fieldops.md) — yard floor plan, gate/QR check-in, field execution.
- [oauth-connections.md](modules/oauth-connections.md) — Microsoft 365/Outlook, Gmail, and the shared `integration_credentials` layer.
- [external-systems.md](modules/external-systems.md) — ERP, EDI/SFTP, telematics/GPS, webhooks (the Integration Engine).
- [team-permissions.md](modules/team-permissions.md) — users, roles & permissions; a reference for correct event-spine emission.

### business/ — revenue-layer / analytics (Cloud-side)
- [billing-and-seats.md](business/billing-and-seats.md) — Vectra's *own* subscription billing (seats, plans, module add-ons) — distinct from the tenant-facing invoicing domain.
- [app-store.md](business/app-store.md) — Block Plugins & the App Store (20–30% revenue share).
- [analytics-reporting.md](business/analytics-reporting.md) — Power BI-style analytics: cross-filtering, drill-down, paginated reports, forecasting, anomaly detection.

### future/ — long-term business-plan layers (out of current build scope)
- [hardware-devices.md](future/hardware-devices.md) — certified QR readers, Bluetooth CMR printers, on-prem/AI servers.
- [academy-and-partners.md](future/academy-and-partners.md) — Vectra Academy (training/certification) and the IT Partner Network.

## Relationship to GSD planning

These are **reference specs**, not the execution plan. Active planning lives in
`.planning/` (PROJECT.md, ROADMAP.md, phases). The first milestone drawn from
these specs is **v3.0 — On-Premise GA**, defined in
[`.planning/milestones/v3.0-on-premise-ga.md`](../../.planning/milestones/v3.0-on-premise-ga.md),
sourced from the three `deployment/` specs (+ `ai-integration.md` §6.1).
