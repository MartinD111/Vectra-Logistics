# Vectra CRM Rework

## What This Is

A dedicated CRM module inside the Vectra workspaces app, replacing the never-built "Records" sidebar slot. Today the CRM exists only as a `crm-clients` block embedded inside project pages — a client list with a credit-limit bar and an inline add-client form, nothing more. This rework gives clients a proper home: a CRM dashboard, full client detail pages (opened in a new tab), bulk Excel import, per-project overrides, real email history synced from Outlook, and a credit-risk semaphore wired into the KPI engine that hard-blocks dispatchers from assigning loads to over-limit clients.

## Core Value

Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.

## Requirements

### Validated

- ✓ `clients` and `invoices` tables exist with credit_limit/outstanding_balance tracking — existing (migration `019_crm_billing.sql`)
- ✓ Backend already 403s over-limit assignment attempts at the `pod_requests` level — existing
- ✓ CRM block renders client list with green/amber/red credit utilization bar — existing (`CrmClientsBlock.tsx`)
- ✓ Outlook OAuth integration with encrypted credential storage exists (calendar sync only, no message sync) — existing (`apps/api/src/domains/outlook/`)
- ✓ KPI engine exists with a pluggable evaluator pattern (activityVolume, outlookCalendar) — existing (`apps/api/src/domains/kpi/`)
- ✓ Notion-like project page canvas with a block registry (`PAGE_BLOCK_REGISTRY`) supports adding new block kinds — existing (`apps/workspaces/src/lib/projectPage/blocks.ts`)
- ✓ xlsx-based Excel parsing already used elsewhere in the app (`ExcelAutomationTool.tsx`) — existing, reusable
- ✓ Cross-app/new-tab link pattern (`target="_blank" rel="noopener noreferrer"`, `crossAppUrl` helper) — existing, reusable
- ✓ Schema foundation for the CRM rework exists: `clients.address`, `clients.responsible_employee_id`, `client_project_links` override table, `email_messages` table, `kpi_results.user_id` nullable + `client_id` column — Validated in Phase 1 (migration `021_crm_extensions.sql`)
- ✓ Dedicated `crm` API domain (controller/service/repository/routes/types/DTOs) exists at `apps/api/src/domains/crm/`, mounted at `/api/v1/crm`, separate from `billing` — Validated in Phase 1
- ✓ Frontend reads client data via `crm` domain (`useCrm.ts`/`crm.api.ts`) instead of `billing`; `CrmClientsBlock.tsx` behavior unchanged — Validated in Phase 1
- ✓ Sidebar "Records" renamed to "CRM" at `/records` as the CRM's dedicated home — v1.0 (Phase 2)
- ✓ CRM dashboard lists all clients; clicking a client opens its detail page in a new tab — v1.0 (Phase 2)
- ✓ Client detail page shows address, notes, current situation (last 10 emails sent), full timeline, settings — v1.0 (Phase 2)
- ✓ Clients support an `address` field and an assigned responsible employee — v1.0 (Phase 1/2)
- ✓ Clients attach to one or more projects with field-level per-project overrides (rate/employee/notes) over client defaults — v1.0 (Phase 3)
- ✓ Mass Excel import with downloadable template and system-default fallbacks — v1.0 (Phase 4)
- ✓ Client pages creatable from the Notion-like project page creator — v1.0 (Phase 2)
- ✓ Real Microsoft Graph sent-mail sync matched to clients, "last 10 emails" per client — v1.0 (Phase 5)
- ✓ Credit-limit/payment-history risk evaluated as a first-class KPI evaluator — v1.0 (Phase 6)
- ✓ Red "frosted glass" risk semaphore at load-assignment time for over-limit clients — v1.0 (Phase 6)
- ✓ Over-limit assignment remains a hard 403 block; semaphore only visualizes it — v1.0 (Phase 6)
- ✓ No `switch(block.kind)` remains in any page or mini-program render/edit path; an ADR documents the engine, native-vs-manifest split, `keyOf` seam, and package-promotion path; `WorkflowBuilder.tsx` compiles unchanged and is documented as an explicitly deferred future migration target — Validated in Phase 13 (`docs/ARCHITECTURE-WORKSPACE-ENGINE.md`)

### Active

*(v2.0 — Workspace Engine, Engine Unification; full detail in REQUIREMENTS.md)*

- [ ] A single generic block registry + `render(block)` engine, reusable across domains (ENG-01)
- [ ] One `WorkspaceBlockPlugin` contract expressing both native (code) and manifest (sandboxed) plugins (ENG-02)
- [ ] Page block registry is compile-time-exhaustive over all block kinds (ENG-03)
- [ ] Project page read + edit rendering dispatch through the registry — no `switch(block.kind)` (RND-01, RND-02)
- [ ] Persisted page/program JSON and autosave payloads unchanged (no data migration) (RND-03)
- [ ] Slash menu + both builders' palettes derive from the registry (PAL-01, PAL-02)
- [ ] Mini Program rendering runs on the same engine; manifest plugins + v2 round-trip intact (MPG-01, MPG-02)
- [ ] A developer can add a native or manifest block via one plugin entry, no dispatch-file edits (EXT-01, EXT-02)
- [x] ~~No `switch(block.kind)` remains in render/edit paths; ADR written; WorkflowBuilder documented as deferred (DOC-01, DOC-02)~~ — Validated in Phase 13

### Out of Scope

- Inbound email reply tracking / two-way email threading — only outbound "sent to client" history requested
- Automated dunning / collections workflows — not requested, would need its own design pass
- Multi-currency invoicing — existing invoices are EUR-only; not part of this rework
- Manager override for over-limit assignment — explicitly rejected in favor of matching the existing hard 403 block

## Context

- Monorepo: `apps/workspaces` (Next.js, tenant-facing app), `apps/api` (backend domains), `apps/cmr` (separate CMR app). See `.planning/codebase/` for full architecture, stack, and conventions docs.
- No ORM — raw idempotent SQL migrations in `database/migrations/`.
- Outlook integration currently syncs calendar events only (`calendar_events` table via Graph categories); no message/email storage exists anywhere in the codebase today. This is genuinely new integration work, not an extension of an existing sync job.
- KPI engine evaluators are currently team/activity-focused (activity volume, calendar). A client-risk evaluator is a new evaluator *type*, following the established pattern but on a different subject (clients, not team members).
- Project pages (the Notion-like canvas) are currently scoped to `project_id` via the `project_pages` table. Making client pages creatable from this canvas requires either a client-scoped pages table or modeling clients so the existing canvas can attach to them — an open design question for the roadmap/planning phase.
- "Per-project client settings" means: a client has global defaults (address, default rate, notes, responsible employee), and each project the client is attached to can override specific fields for that project only.

## Constraints

- **Existing 403 behavior**: The backend already blocks over-limit assignments at the API level — the new semaphore must visually reflect this, not introduce a second enforcement path — Why: avoid duplicate/conflicting business logic between old and new code.
- **No ORM**: All schema changes go through new idempotent SQL migration files following the existing `NNN_description.sql` convention — Why: matches established project convention, no Prisma/ORM in use.
- **Reuse over rebuild**: Excel import should reuse the existing `xlsx` package/pattern from `ExcelAutomationTool.tsx`; new-tab navigation should reuse `crossAppUrl`/existing link patterns — Why: consistency, less new surface area.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Repurpose "Records" sidebar slot → "CRM" at `/records` | That nav slot was never built out; avoids adding a second nav item | ✓ Good (v1.0) |
| Client detail pages open in a new tab | Matches existing app-wide pattern for entity detail views | ✓ Good (v1.0) |
| Real Microsoft Graph email sync (not stubbed) | Outlook OAuth integration already exists; delivers real value now rather than a placeholder | ✓ Good (v1.0) |
| Credit-risk semaphore is a KPI evaluator, not an ad-hoc flag | Matches existing extensible KPI engine architecture; reusable/configurable later | ✓ Good (v1.0) |
| Over-limit block remains hard, no override | Matches existing enforced 403 behavior; user explicitly rejected a manager-override path | ✓ Good (v1.0) |
| Per-project client settings are field-level overrides over client-level defaults | Clients can serve multiple projects with different terms (e.g. different rate per project) | ✓ Good (v1.0) |
| Email matching is by recipient address/domain across any team member's mailbox | No per-user mailbox scoping model exists today; broadest match is simplest and most useful | ✓ Good (v1.0) |
| Excel import template includes credit limit & default rate as optional columns | Avoids a manual follow-up pass for every imported client; blank falls back to system default | ✓ Good (v1.0) |

## Current State

**Shipped:** v1.0 CRM Rework (2026-07-06) — 6 phases, 15 plans, 33 tasks, all 23 requirements. A dedicated CRM module: dashboard, client detail pages, per-project overrides, bulk Excel import, real Outlook email sync, and a KPI-driven credit-risk semaphore hard-blocking over-limit load assignment. Archived at `.planning/milestones/v1.0-{ROADMAP,REQUIREMENTS}.md`.

Deferred at close: 7 pending human-UAT scenarios (Phase 02/03) + 2 verification sign-offs — manual checks on shipped features, tracked in STATE.md → Deferred Items.

## Current Milestone: v2.0 — Workspace Engine (Engine Unification)

**Goal:** Unify the `workspaces` app's three parallel block/node systems — Project Pages (30 widgets rendered by hand-maintained `switch` statements), Mini Programs v2 (already a real plugin architecture: manifest + sandbox + schema-driven `DynamicBlockView`), and a demo-only automations WorkflowBuilder — into **one plugin-driven block engine** where rendering is `registry.render(block)`, so "add a block = write one plugin entry, change nothing else" becomes literally true.

**Scope (tight):** engine unification only — no new user features, no document-schema change, no database/views engine, no realtime/CRDT (all recorded as North-Star / future milestones). Multiplayer explicitly deferred.

**Approach:** generalize the existing Mini Program plugin model (don't reinvent); collapse Project Pages' two switch statements into registry dispatch **without** merging the two block unions or touching persisted JSON; a per-domain `keyOf(block)` resolver reconciles the two data models. Phases 7-13, each compiles and ships. Full architecture: `~/.claude/plans/i-think-this-should-expressive-volcano.md`.

**Target features:**
- One generic `WorkspaceBlockRegistry` + `WorkspaceBlockPlugin` contract (native + manifest flavors)
- Project page read/edit rendering via registry dispatch (kill both switches), zero JSON drift
- Registry-derived slash menu and builder palettes
- Mini Program blocks folded onto the same engine
- Proven extensibility: add a block via one plugin entry
- ADR + cleanup; WorkflowBuilder parked as a future migration target

## Platform Vision & Architecture (North Star)

> Enduring product vision the current work builds toward — steering context, **not** the active build scope (tracked under Current Milestone above). Sourced from the Vectra business plan + the CLAUDE.md steering rules. Hardware, Vectra Academy, and the IT-Partner network are long-term business-plan items and are **explicitly out of current build scope** (see §"Ecosystem & Revenue").

### What Vectra Is

Vectra is a purpose-built **Workspace platform for logistics** — not another TMS, ERP, or AI product. It replaces the fragmented daily toolset (Excel, Outlook, WhatsApp, Teams, Notion, Google Drive, assorted TMS/ERP systems) with one modular, deeply customizable workspace the company fully owns. Target framing: the **operating system for a logistics company** — where dispatchers, drivers, warehouse staff, and management do their daily work.

**Core promise — data sovereignty:** Vectra is **On-Premise by default.** All data stays on the customer's own server; nothing is stored in Vectra's cloud unless the customer explicitly opts into the *Vectra AI* service or the *App Store*. AI is strictly a support tool, never the center of the product.

### Steering rule — platform-core vs. vertical modules

- **Generic core primitives** (workspace, program, record, template, automation, integration, metric, and generic page-block types: rich-text, heading, chart, kpi-grid, kanban, activity-timeline, etc.) stay generic. New generic capability goes here.
- **Named vertical blocks/domains** (fleet, ltl, yard, pod, crm, vat, marketplace, cmr) are an accepted, explicit product layer — the "Business Modules" / logistics smart blocks. New vertical features go into their own domain + block kind, not scattered into generic primitives.
- **No single-tenant logic** — nothing that only makes sense for one customer (vs. the vertical as a whole) belongs anywhere in `apps/*` or `packages/*`.
- **Do not port `blg_master` code** — it is a pattern reference only, never a source of literal code or copy.

### The Five Engines

The platform is five interconnected but independent systems:

1. **Workspace Engine** — the content/knowledge core. Projects, sub-pages, SOPs, knowledge base, operational instructions. Tree-structured pages (unlimited nesting: Projects → Client → Shipments → SOP → Finance → Notes), each built from modular blocks.
2. **Database Engine** — business objects (Shipment, Customer, Carrier, Driver, Vehicle, Trailer, Warehouse, Route, Invoice, CMR, Task, Port, Terminal, and user-defined) modeled as **rich records that are also full workspace pages**: properties + relations + files + comments/mentions + record-scoped automations + a live collaboration page. Same data, multiple views: **Table, Kanban, Calendar, Timeline (Gantt), Gallery.**
3. **Automation Engine** — no-code graphical **Workflow Builder** (drag-and-drop). Triggers: new email, new shipment, status change, date/time, QR scan, new document, OCR result, new CMR, HTTP request. Actions: Outlook/Gmail send, WhatsApp/SMS, OCR, PDF parse, HTTP request, in-app notification, approval, delay, conditions, loops, webhooks, database create/update/delete.
4. **Integration Engine** — connectivity to the outside world: Outlook, Gmail, WhatsApp, SMS; REST/SOAP/EDI/SFTP/Webhooks; ERP + accounting (e.g. Minimax, Zantheon) + customs systems; telematics/GPS (Geotab, Samsara); cloud storage (Drive, OneDrive, SharePoint — as source/consumer only, data stays under customer control).
5. **Business Modules** — the specialized logistics modules that plug onto the Workspace Engine (see Module Map).

### Navigation / Module Map (left sidebar)

Dashboard · Projects (tree) · CMR Customers · Programs · My Fleet · Procurement · LTL Marketplace · Storage Marketplace · Team · PWA Manager · Routes · CMR Manager · App Store · Settings.

### Block System (the `/` palette)

Pages are composed of blocks inserted via `/`, in categories:
- **Basic:** heading (to level 4), paragraph, bullet/numbered list, checklist, toggle, divider, quote, callout.
- **Media:** image, PDF embed, video, files, bookmarks, embeds.
- **Collaboration:** comments (threaded), mentions, assignments, status, dates, buttons (action triggers).
- **Database:** table, kanban, calendar, timeline/Gantt, gallery, charts.
- **Logistics smart blocks:** Shipment, Vehicle, Driver, Route, Warehouse, Container, Fleet, Marketplace, Storage, CMR — plus the already-shipped `crm-clients`, and existing vertical kinds (`fleet-telematics`, `spot-quote`, `railway-terminal`, `yard-map`, `pod-tracker`, `vat-matrix`, `ltl-matches`, `smart-inbox`).

### Programs

Under **Programs**: **Templates** (pre-built workspace pages: Shipment, Customer, Warehouse, Port, SOP, Driver Instructions — adaptable and re-savable), **Mini Programs** (no-code micro-apps built from blocks/forms: VIN Validator, Route Calculator, Cost/Fuel Calculator, Container Checker, etc.), and **Automations** (the Workflow Builder, with enable/disable + execution logs).

### Business Modules (detail)

- **Procurement** — digitized RFQ: dispatcher builds an RFQ, auto-distributes to a carrier group (email/API/WhatsApp/portal), system normalizes returned quotes into one format, dispatcher compares price/terms/ratings, one-click select → notifies all parties + creates a Shipment.
- **PWA Manager** — mobile driver instructions as a PWA link (QR check-in code, forwarder data, destination, load/unload locations, cargo/VINs, terminal PIN, contacts, special notes, interactive checklist). Smart location templates (e.g. "Luka Koper", "Port of Trieste", "MSC Terminal") auto-fill known instructions.
- **QR Check-In** — certified QR reader at gate scans the driver's PWA code; Vectra instantly shows driver, plate, company, shipment ref, destination, load/unload, PIN, container, VINs, notes.
- **CMR Digital Workflow** — dispatcher prepares CMR → sent to driver via PWA → optional Bluetooth print in cab → driver photographs signed CMR → OCR validates signatures/dates/numbers/missing fields (AI fallback when OCR fails) → auto-completes shipment, archives + links CMR, notifies dispatcher, triggers downstream automations (invoicing, accounting archive).
- **Marketplace** — LTL Marketplace (post/find partial loads) + Storage Marketplace (find/offer pallet/warehouse capacity).
- **Fleet** — vehicles, drivers (licenses, AETR hours), trailers, service/maintenance reminders + history, documentation, GPS/telematics live tracking.
- **Team** — users, groups, permissions (project/data-level), departments (dispo/forwarding/accounting), tasks + comments.

### AI — support tool only

Company-level AI config is deployment-mode-aware and supports three install modes (extend `company_ai_config`, don't fork):
1. **BYOK** — customer's own API key (OpenAI / Gemini / Grok); backend-proxied, key encrypted at rest.
2. **Local Gemma** — open-source model on the customer's server; nothing leaves the building.
3. **Vectra AI** (paid subscription) — Vectra-hosted secure server for customers without capable hardware.

**AI performs ONLY these functions** (a hard product constraint — the system deliberately contains no other AI features): help build Mini Programs (describe → AI assembles blocks); help build automations (suggest steps); analyze OCR documents when classic OCR fails; extract spot-quote data from emails; convert unstructured email inquiries into structured Procurement records.

### On-Premise & Deployment Mode (current strategic priority)

**Goal:** make Vectra deployable On-Premise at a customer site as a first-class target — **one codebase, one `DEPLOYMENT_MODE=cloud|on-prem` toggle** (env-driven, read once at boot), never a "lite" fork. Follow the `company_ai_config` pattern (a config value selects behavior, not a code branch).

Known cloud-only assumptions to make optional: **auth/SSO** (must work without wildcard-subdomain cookie sharing — on-prem may be a single internal domain or bare IP); **secrets** (installer must generate `ENCRYPTION_KEY` & friends on first run, no call-home); **inbound webhooks** (need outbound/polling fallback behind firewalls); **multi-tenancy** (schema already `company_id`-scoped → on-prem = seed one company, no schema fork).

New work this phase requires: licensing/activation (seat/module gating without a permanent cloud link); an on-prem release/update pipeline (versioned tagged Docker images + the existing idempotent numbered migrations — reuse, don't reinvent); an installer/first-run flow (seed company, generate secrets, pick mode, configure local AI).

### Build-sequence discipline

Tenant isolation (`company_id` scoping) and the `activity_events` event spine are the foundation everything reads from. **Do not introduce KPI/statistics logic that bypasses `activity_events` in favor of ad-hoc counters** — even under on-prem time pressure.

### When in doubt

If a change only makes sense for Cloud *or* only for On-Premise, stop and make it a **config toggle**, not a fork. If a specific subsystem genuinely can't be toggled, flag it explicitly rather than quietly building single-mode behavior into shared code.

### Ecosystem & Revenue (business context — out of current build scope)

Long-term business-plan layers, tracked here for context but **not** part of the current build sequence:
- **App Store** — installable third-party extensions (ERP/customs integrations, calculators, dashboard widgets, mini programs, workflow templates, block plugins); 20–30% revenue share.
- **Hardware (HaaS)** — Standard Server + AI Server (GPU, local Gemma), certified QR readers, certified Bluetooth CMR printers; sale or leasing.
- **Vectra Academy** — training + certification (Operator, Builder, Architect); paid courses/exams.
- **IT Partner Network** — certified implementers/developers; annual membership or deal commission.
- **Revenue pillars:** (A) software/subscriptions — core license, per-seat, paid modules, Vectra AI, App Store commission; (B) hardware — servers/readers/printers, one-time + leasing; (C) services/ecosystem — Academy, partner program, premium templates/mini-programs.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-12 — Phase 13 (final phase of v2.0) complete: engine ADR written, WorkflowBuilder parked, DOC-01/DOC-02 validated*
