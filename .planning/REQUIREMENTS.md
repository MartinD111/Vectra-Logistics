# Requirements: Vectra v5.0 Platform Foundation & Durable Execution

**Defined:** 2026-07-15
**Core Value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history.

**Milestone goal:** Reconcile the imported execution roadmap with the shipped v1-v4 platform, then harden the foundation needed for durable automations, integrations, and the first logistics vertical slice.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Baseline Truth

- [x] **BASE-01**: Maintainer can read a current inventory of apps, packages, services, database migrations/tables, queues, and public route domains.
- [x] **BASE-02**: Maintainer can read a feature truth matrix marking each imported roadmap phase/capability as shipped, partial, demo, absent, or deferred.
- [x] **BASE-03**: Maintainer can run or read a documented baseline for lint, typecheck, tests, builds, migrations, and local boot commands without hiding failures.
- [x] **BASE-04**: Maintainer can see the ADR gap list needed before architecture-changing PRs proceed.

### Security & Tenancy

- [ ] **SECCTX-01**: API handlers can consume one typed `RequestContext` carrying user, company, roles, workspace, request id, deployment mode, and deployment capabilities.
- [ ] **SECCTX-02**: A reusable permission/capability service can answer workspace, page, record, program, workflow, integration, and module-level capability checks.
- [ ] **SECCTX-03**: Cross-tenant negative tests exist for pilot read/write paths in folders, projects/pages/programs, records/views, CRM, marketplace/POD, and integrations.
- [ ] **SECCTX-04**: Public or integration-facing endpoints use a documented signed token/API-key/HMAC pattern, not unsigned tenant-identifying payloads.
- [ ] **SECCTX-05**: Production/demo behavior is capability-gated so production paths never silently synthesize operational demo data.

### Event Spine & Outbox

- [ ] **EVENT-01**: A versioned event envelope is defined with tenant, actor, object type/id, project id when applicable, causation id, correlation id, payload version, and payload.
- [ ] **EVENT-02**: A durable outbox migration exists and is idempotent, tenant-aware, indexed, and compatible with cloud and on-prem deployments.
- [ ] **EVENT-03**: At least one service mutation writes domain state and outbox event in one transaction.
- [ ] **EVENT-04**: A dispatcher/worker can publish pending outbox events with retry, duplicate protection, and observable failure state.
- [ ] **EVENT-05**: Event catalog documentation explains emitted events, payload versions, and expected consumers.

### Workflow MVP

- [ ] **WFLOW-01**: Workflow drafts persist server-side with tenant scope, version/status, validated trigger/action graph, and created/updated metadata.
- [ ] **WFLOW-02**: The automation builder can save and reload real workflow drafts instead of relying on mock rows/browser-only state.
- [ ] **WFLOW-03**: User can manually trigger a workflow containing a notification action and see a persisted run.
- [ ] **WFLOW-04**: Workflow runs and step logs persist with status, attempts, timestamps, error text, and correlation/event ids.
- [ ] **WFLOW-05**: Workflow execution handles idempotency, retry limits, and duplicate manual-trigger protection.
- [ ] **WFLOW-06**: Workflow validation rejects unsupported triggers/actions and capability-denied actions before publish/run.

## v2 Requirements

Deferred to future milestones, tracked to keep dependency order visible.

### Workspace Hierarchy

- **TREE-01**: Unified workspace node projection/tree can organize folders, projects, pages, collections, programs, automations, files, dashboards, and shortcuts.
- **TREE-02**: Sidebar loads the visible workspace tree in one API call with move/reorder/archive and permission inheritance.

### Programs & Integrations

- **PROG-01**: Mini Program v3 supports persisted data-source bindings, approved actions, publish/version pinning, and portal runtime.
- **CONN-01**: Integration platform has connector installations, OAuth/credential lifecycle, webhook inbox, polling cursors, mapping UI, and health observability.

### Logistics Vertical

- **SHIP-01**: First production vertical slice runs Outlook inquiry to confirmed draft, RFQ, award, shipment, driver/POD, and invoice.

## Out of Scope

| Feature | Reason |
|---------|--------|
| App Store/package catalog | Blocked until action/capability boundary is enforced |
| Full workspace hierarchy implementation | Planned as v6 after v5 request/event/workflow foundation |
| Mini Program v3 full rebuild | Planned as v7 after workflow/action contracts are stabilized |
| Procurement/CMR/fleet/routing vertical expansion | Planned after foundation contracts prevent duplicate state and unsafe integrations |
| Offline licensing, support bundles, and HA operations | Important on-prem follow-up, but outside this foundation milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 27 | Complete |
| BASE-02 | Phase 27 | Complete |
| BASE-03 | Phase 27 | Complete |
| BASE-04 | Phase 27 | Complete |
| SECCTX-01 | Phase 28 | Pending |
| SECCTX-02 | Phase 28 | Pending |
| SECCTX-03 | Phase 28 | Pending |
| SECCTX-04 | Phase 28 | Pending |
| SECCTX-05 | Phase 28 | Pending |
| EVENT-01 | Phase 29 | Pending |
| EVENT-02 | Phase 29 | Pending |
| EVENT-03 | Phase 29 | Pending |
| EVENT-04 | Phase 29 | Pending |
| EVENT-05 | Phase 29 | Pending |
| WFLOW-01 | Phase 30 | Pending |
| WFLOW-02 | Phase 30 | Pending |
| WFLOW-03 | Phase 30 | Pending |
| WFLOW-04 | Phase 30 | Pending |
| WFLOW-05 | Phase 30 | Pending |
| WFLOW-06 | Phase 30 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20/20
- Unmapped: 0

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-15 after Phase 27 completion*
