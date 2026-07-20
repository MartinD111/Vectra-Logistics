# Vectra Platform

## What This Is

Vectra is a workspace platform for logistics companies. It combines a Notion-like workspace, a configurable records/views database, mini programs, durable automations, integrations, and logistics business modules in one codebase for cloud and on-prem deployments.

The product already has six shipped foundations:

- v1.0 CRM Rework: CRM dashboard, client detail pages, Excel import, Outlook sent-mail sync, per-project client overrides, and credit-risk semaphore.
- v2.0 Workspace Engine: shared `WorkspaceBlockRegistry` powering Project Pages and Mini Programs, plus native and manifest extensibility seams.
- v3.0 On-Premise GA: deployment mode, migration runner, installer, local AI dispatch, production compose, release/upgrade docs, and deployment hardening.
- v4.0 Workspace Records & Views: generic content blocks, records/views API, record detail pages, collection board/table/list/calendar/gallery/timeline views, and legacy Kanban migration.
- v5.0 Platform Foundation & Durable Execution: baseline truth matrix, typed request/capability spine, durable event outbox, and persisted workflow MVP.
- v6.0 Unified Workspace Hierarchy: tenant-safe folder/project/program/collection tree schema with an ancestor-index, one aggregated tree-read API, lock-safe reorder/move endpoints, a real expand/collapse sidebar tree with breadcrumbs, and full organize flows (create/rename/drag-reorder/drag-reparent/archive with undo).

## Core Value

Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history. The risk semaphore is a hard, visible block, not a suggestion.

## Current Milestone: Planning next

v6.0 shipped 2026-07-20. No milestone is currently active — run `/gsd:new-milestone` to define v7.0's requirements and roadmap.

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
- Folder/project/program/collection hierarchy has a tenant-safe, cycle-safe, depth-safe schema with an ancestor-index, and the `folders` domain uses the v5 `RequestContext`/capability/`event_outbox` pattern — v6.0
- One aggregated `GET /folders/tree/full` read API and lock-safe reorder/move endpoints, capability-gated — v6.0
- Workspace sidebar is a real expand/collapse tree (folder → project → page/record) with per-user persisted state, depth-aware module visibility, and live-tree breadcrumbs, replacing the flat hardcoded `ITEMS` list — v6.0
- Users can create, rename, drag-to-reorder, drag-to-reparent, and archive (with descendant-count confirmation + undo) folders/projects from the tree, with illegal drops rejected with a clear reason — v6.0

### Active

- v7.0 requirements not yet defined — run `/gsd:new-milestone`.

### Out of Scope

| Item | Reason |
|------|--------|
| App Store/package catalog | Requires enforced action/capability boundary first |
| Mini Program v3 | Planned as v7 after actions and workflow contracts stabilize |
| Logistics vertical slice | Planned as v8 after foundation avoids duplicate state |
| Offline licensing/support bundle/HA operations | Important on-prem follow-up, outside v5 foundation |

## Current State

**Shipped:** v1.0 CRM Rework (2026-07-06) - 6 phases, 15 plans, 33 tasks. Archived at `.planning/milestones/v1.0-ROADMAP.md`.

**Shipped:** v2.0 Workspace Engine - Engine Unification (2026-07-12) - 7 phases, 8 plans, 10 tasks. Archived at `.planning/milestones/v2.0-ROADMAP.md`.

**Shipped:** v3.0 On-Premise GA (2026-07-13) - 7 phases, 16 plans, 31 tasks. Archived at `.planning/milestones/v3.0-ROADMAP.md`.

**Shipped:** v4.0 Workspace Records & Views (2026-07-15) - 6 phases, 24 plans, all 30 requirements. Archived at `.planning/milestones/v4.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`. Known deferred items are manual UAT and warning-level UI follow-ups, not missing requirements.

**Completed:** v5.0 Phase 29 Event Spine & Durable Outbox (2026-07-15) - versioned `event_outbox` envelope, records collection-created transactional pilot, dispatcher retry/failure lifecycle, and durable event catalog for Phase 30 workflows.

**Completed:** v5.0 Phase 30 Workflow MVP Persistence & Manual Trigger (2026-07-15) - persisted workflow drafts, active publish state, manual notification-action runs, idempotent `workflow_runs`, step logs, and real automation dashboard/builder API state.

**Shipped:** v5.0 Platform Foundation & Durable Execution (2026-07-15) - 4 phases, 8 plans, all 20 v5 requirements archived at `.planning/milestones/v5.0-REQUIREMENTS.md`.

**Shipped:** v6.0 Unified Workspace Hierarchy (2026-07-20) - 4 phases, 21 plans, all 22 v6 requirements. Archived at `.planning/milestones/v6.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`. Milestone audit found one critical gap (folder-move non-atomicity + unvalidated descendant depth, reachable via the shipped drag-to-reparent UI) and fixed it inline rather than deferring; remaining deferred items are UI-polish tech debt and outstanding human UAT, not missing requirements.

## Next Milestone Goals

No milestone is currently active. Define v7.0 with `/gsd:new-milestone` (questioning → research → requirements → roadmap).

The concrete agent ownership map lives in `.planning/AGENT-WORKSTREAMS.md`.

Deferred beyond v6: Mini Program v3 and connector lifecycle (v7?), the first production logistics vertical slice, App Store/package lifecycle, offline licensing/support bundles, and broad SLO/chaos/commercial readiness. Also carried forward from v6.0 as tech debt (see MILESTONES.md): Phase 33's expand-state anon-bucket race, Phase 34's 5 warning/5 info code-review findings, and the outstanding Phase 34 human-UAT pass.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preserve v1-v4 shipped work instead of restarting the imported roadmap at Phase 0 | The repo already has CRM, workspace engine, on-prem, and records/views foundations | Good |
| Continue phase numbering at Phase 27 | Prevents collisions with existing planning history and phase archives | Good |
| Make v5 foundation-first | Durable automations, integrations, and logistics verticals need one request/capability/event/action contract | Good |
| Treat v4 manual UAT as deferred tech debt | v4 requirements are implemented, but some live-browser sign-offs remain manual | Good |
| Block App Store work until capabilities/actions are enforced | Package installation must not grant undeclared powers | Good |
| Fix a critical, milestone-audit-found data-integrity gap (folder-move atomicity/depth) inline instead of deferring to a closure phase | Gap was reachable via the drag-to-reparent feature shipped this same milestone, well-understood, and mirrored an existing pattern (`archiveFolder`) already in the file | Good |
| Reuse `@dnd-kit` (already used by the Kanban board) for tree drag-to-reorder/reparent instead of a new DnD library | Consistency, less new surface area — matches `BoardCard.tsx`/`BoardColumn.tsx` idiom | Good |

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
*Last updated: 2026-07-20 after v6.0 milestone shipped.*
