# Vectra Platform

## What This Is

Vectra is a workspace platform for logistics companies. It combines a Notion-like workspace, a configurable records/views database, mini programs, durable automations, integrations, and logistics business modules in one codebase for cloud and on-prem deployments.

The product already has four shipped foundations:

- v1.0 CRM Rework: CRM dashboard, client detail pages, Excel import, Outlook sent-mail sync, per-project client overrides, and credit-risk semaphore.
- v2.0 Workspace Engine: shared `WorkspaceBlockRegistry` powering Project Pages and Mini Programs, plus native and manifest extensibility seams.
- v3.0 On-Premise GA: deployment mode, migration runner, installer, local AI dispatch, production compose, release/upgrade docs, and deployment hardening.
- v4.0 Workspace Records & Views: generic content blocks, records/views API, record detail pages, collection board/table/list/calendar/gallery/timeline views, and legacy Kanban migration.

## Core Value

Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history. The risk semaphore is a hard, visible block, not a suggestion.

## Current Milestone: v5.0 Platform Foundation & Durable Execution

**Goal:** Reconcile the imported execution roadmap with the shipped v1-v4 platform, then harden the request, capability, event, and workflow foundation required before larger logistics verticals continue.

**Target features:**

- Current-state truth matrix for apps, packages, services, migrations, routes, demo/stub paths, and imported-roadmap phase status.
- Typed backend `RequestContext` and capability/permission service for future actions and integrations.
- Pilot cross-tenant negative test harness and public endpoint signing/API-key/HMAC pattern.
- Explicit demo-mode/capability behavior so production paths never silently synthesize operational data.
- Versioned event envelope and durable outbox with a pilot transactional state+event write.
- Workflow MVP persistence: save/load automation drafts, manual trigger, notification action, run/step logs, validation, retries, and idempotency.

**Scope note:** This milestone is foundation-first. Unified workspace hierarchy, Mini Program v3, connector lifecycle, App Store, and the first logistics vertical are sequenced after v5 so they can reuse one request/capability/event/workflow contract.

## Requirements

### Validated

- CRM module is shipped and uses real backend/client detail flows rather than the old embedded-only block.
- Credit-risk semaphore is wired to the KPI engine while the backend hard 403 remains authoritative.
- Project Pages and Mini Programs share one generic registry engine.
- On-prem uses the same codebase with `DEPLOYMENT_MODE=cloud|on-prem`.
- Migrations run through the API migration runner and numbered SQL files.
- Records/views are persisted through `data_collections`, `collection_records`, and `collection_views`.
- Record bodies reuse the existing page editor and block palette.
- `collection-view` supports board, table, list, calendar, gallery, and timeline over the same records.

### Active

- v5.0 requirements live in `.planning/REQUIREMENTS.md`.

### Out of Scope

| Item | Reason |
|------|--------|
| App Store/package catalog | Requires enforced action/capability boundary first |
| Full workspace hierarchy | Planned as v6 after request/capability/event foundation |
| Mini Program v3 | Planned as v7 after actions and workflow contracts stabilize |
| Logistics vertical slice | Planned as v8 after foundation avoids duplicate state |
| Offline licensing/support bundle/HA operations | Important on-prem follow-up, outside v5 foundation |

## Current State

**Shipped:** v1.0 CRM Rework (2026-07-06) - 6 phases, 15 plans, 33 tasks. Archived at `.planning/milestones/v1.0-ROADMAP.md`.

**Shipped:** v2.0 Workspace Engine - Engine Unification (2026-07-12) - 7 phases, 8 plans, 10 tasks. Archived at `.planning/milestones/v2.0-ROADMAP.md`.

**Shipped:** v3.0 On-Premise GA (2026-07-13) - 7 phases, 16 plans, 31 tasks. Archived at `.planning/milestones/v3.0-ROADMAP.md`.

**Shipped:** v4.0 Workspace Records & Views (2026-07-15) - 6 phases, 24 plans, all 30 requirements. Archived at `.planning/milestones/v4.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`. Known deferred items are manual UAT and warning-level UI follow-ups, not missing requirements.

**Completed:** v5.0 Phase 29 Event Spine & Durable Outbox (2026-07-15) - versioned `event_outbox` envelope, records collection-created transactional pilot, dispatcher retry/failure lifecycle, and durable event catalog for Phase 30 workflows.

## Next Milestone Goals

v5.0 Platform Foundation & Durable Execution is active.

The first four v5 phases are:

- Phase 27: Baseline Truth & Roadmap Reconciliation
- Phase 28: Security, Tenancy & Capabilities Foundation
- Phase 29: Event Spine & Durable Outbox
- Phase 30: Workflow MVP Persistence & Manual Trigger

The concrete agent ownership map lives in `.planning/AGENT-WORKSTREAMS.md`.

Deferred beyond v5: unified workspace hierarchy (v6), Mini Program v3 and connector lifecycle (v7), the first production logistics vertical slice (v8), App Store/package lifecycle, offline licensing/support bundles, and broad SLO/chaos/commercial readiness.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preserve v1-v4 shipped work instead of restarting the imported roadmap at Phase 0 | The repo already has CRM, workspace engine, on-prem, and records/views foundations | Good |
| Continue phase numbering at Phase 27 | Prevents collisions with existing planning history and phase archives | Good |
| Make v5 foundation-first | Durable automations, integrations, and logistics verticals need one request/capability/event/action contract | Good |
| Treat v4 manual UAT as deferred tech debt | v4 requirements are implemented, but some live-browser sign-offs remain manual | Good |
| Block App Store work until capabilities/actions are enforced | Package installation must not grant undeclared powers | Good |

## Platform Vision & Architecture

### Platform Core vs Logistics Modules

Platform core owns workspace, folder, project, page, block, collection, property, record, view, program, workflow, trigger, action, integration connection, event, notification, permission, template, and package primitives.

Logistics modules own shipment, load, stop, route, carrier, driver, vehicle, trailer, RFQ, quote, award, CMR, POD, invoice, yard asset, storage capacity, and logistics-specific blocks/actions/triggers/templates.

### Five Engines

1. Workspace Engine - pages, blocks, project knowledge, and operational surfaces.
2. Database Engine - configurable records, properties, relations, views, and record pages.
3. Automation Engine - durable workflow definitions, triggers, actions, runs, retries, and logs.
4. Integration Engine - Outlook, webhooks, polling, ERP/accounting, telematics, storage, and provider capabilities.
5. Business Modules - CRM, procurement, fleet, marketplace, CMR/POD, billing, yard, LTL, routes, and delivery.

### AI Constraint

AI remains a support tool only: mini-program generation, automation suggestions, OCR fallback/document analysis, spot-quote extraction, and email inquiry extraction. It must respect cloud/on-prem deployment mode and never become required for core deterministic operations.

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition:

1. Move validated requirements to `Validated`.
2. Add new requirements or decisions discovered during implementation.
3. Update current state if product shape changed.

After each milestone:

1. Archive milestone roadmap, requirements, audit, and phase artifacts.
2. Refresh current milestone, current state, and next milestone goals.
3. Preserve core value unless the business priority explicitly changes.

---
*Last updated: 2026-07-15 - Phase 29 durable event outbox baseline completed.*
