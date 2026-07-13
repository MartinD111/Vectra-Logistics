# Milestones

## v3.0 On-Premise GA (Shipped: 2026-07-13)

**Phases completed:** 7 phases, 16 plans, 31 tasks
**Timeline:** 2026-07-12 → 2026-07-13 (2 days) · 147 commits, 119 files changed, +13689/-343 lines

**Key accomplishments:**

- Boot-time fail-fast validation for `ENCRYPTION_KEY`/`JWT_SECRET` (no production fallback) and permanent removal of the `admin@admin.com` seed user from any customer-facing install path (Phase 14)
- A `schema_migrations`-tracked, idempotent `npm run migrate` runner used identically by both first-run and upgrade — replacing manual per-file `psql` — plus a `docker-compose.prod.yml` assembling all four production images with `DEPLOYMENT_MODE=cloud|on-prem` gating seed data and registration (Phases 15-16)
- A one-shot, re-run-safe installer (`install.ts`) that generates secrets, creates the first company + real admin, runs migrations, writes `DEPLOYMENT_MODE=on-prem`, and optionally wires a local Gemma/Ollama endpoint — with backend-side dispatch so every AI feature (not just the browser path) works fully offline on an on-prem install (Phases 17-18)
- One authoritative `VERSION` file stamped into every image and reported by `/health`, a per-release `CHANGELOG.md`, and a documented 5-step upgrade procedure (Phase 19)
- CORS/Socket.IO restricted to an env-configured origin allowlist, rate limiting on `/api/auth/*`, and a `/health` endpoint that live-checks Postgres + Redis reachability instead of returning a static OK (Phase 20)
- Milestone audit caught and fixed inline (not deferred): a code-review-found critical bug where the auth rate limiter 500'd behind any reverse proxy without `trust proxy` configured, and a cross-phase integration gap where `docker-compose.prod.yml` never forwarded the new CORS/trust-proxy env vars into the API container — both closed, plus a "Fresh install" section added to `docs/DEPLOYMENT.md` since no shipped doc explained how to run the installer

**Known deferred items at close:** Tech debt only, no functional gaps — see `.planning/milestones/v3.0-MILESTONE-AUDIT.md`. Phase 20: no timeout on `/health`'s Postgres/Redis probes (a hung, not refused, connection could hang the endpoint); the auth rate limiter shares one bucket across all 5 endpoints (a locked-out attacker could also lock a legit user out of `/forgot-password`); CORS origin normalization/doc-comment/duplication cleanup. Phase 16: live `docker compose config` validation against real secrets remains a manual check, never automated. Also carrying forward v2.0's known deferred items (Phases 7-11 missing formal VERIFICATION.md, independently re-confirmed wired) — see STATE.md → Deferred Items.

---

## v2.0 Workspace Engine — Engine Unification (Shipped: 2026-07-12)

**Phases completed:** 7 phases, 8 plans, 10 tasks
**Timeline:** 2026-07-06 → 2026-07-12 (6 days) · 47 files changed, +4584/-1021 lines

**Key accomplishments:**

- Added a generic `WorkspaceBlockRegistry` + `WorkspaceBlockPlugin` contract (native code + manifest/sandboxed flavors) and an exhaustive `pageBlockRegistry` over all 30 `PageBlockKind`s, enforced at compile time
- Replaced `PageBlockView`'s 30-case switch with registry dispatch and `LivePageCanvas`'s edit-mode switch with `pageBlockRegistry.renderEditor` — both hand-maintained page switches eliminated with zero behavior change
- Replaced Mini Program's `BlockView` 15-case switch with `miniProgramBlockRegistry.render`, an instance of the same `WorkspaceBlockRegistry` class pages use — proving one genuinely shared engine, not parallel copies
- Extracted a shared `buildPaletteItems(registry)` helper so the page slash menu and mini-program add-menu both derive their palettes from registry data
- Proved the core extensibility promise end-to-end: added a native `callout` block via one plugin entry (3 files touched, zero dispatch edits) and a manifest `rowCountCallout` plugin via the declarative path (zero new vocabulary, zero dispatch edits)
- Closed out the milestone with `docs/ARCHITECTURE-WORKSPACE-ENGINE.md` (engine contract, native/manifest split, `keyOf` seam, package-promotion path) and confirmed the automations `WorkflowBuilder.tsx` remains untouched and explicitly parked as a deferred future migration target

**Known deferred items at close:** Milestone audit (`.planning/v2.0-MILESTONE-AUDIT.md`) found all 14/14 requirements satisfied and cross-phase wiring fully confirmed, but flagged tech debt: Phases 7-11 are missing formal `VERIFICATION.md` (never run after execution, though independently re-confirmed wired by the audit's integration check), and REQUIREMENTS.md checkboxes are stale for 8 of 14 requirements as a result. No functional gaps — backfill via `/gsd:validate-phase` per phase if desired. Also carrying forward v1.0's 4 pre-existing deferred items (7 human-UAT scenarios + 2 verification sign-offs, Phase 02/03) — see STATE.md → Deferred Items.

---

## v1.0 CRM Rework (Shipped: 2026-07-06)

**Phases completed:** 6 phases, 15 plans, 33 tasks

**Key accomplishments:**

- "Linked Projects" section on the client detail page: searchable attach picker, collapsed per-project cards with an override-count badge, and three independently toggleable rate/employee/notes override editors following the D-04 grey-italic-vs-primary-accent visual contract.
- Domain-based email-to-client matcher with free-mail denylist, composite-unique email_messages migration, and upsert repository — the building blocks syncEmails() (plan 02) will call
- syncEmails() Graph orchestration with pagination and domain-based client matching, wired into a 15-minute BullMQ repeatable job started at API bootstrap
- credit_risk KPI evaluator computing utilization + overdue-invoice risk per client, with kpi_rules.target_client_id and a real (non-stub) GET /crm/clients/:id/risk response
- Red frosted-glass warning in the load-assignment form, shown the instant an over-limit client is selected, plus a fix for a stale pre-Phase-1 hook import

**Known deferred items at close:** 4 (see STATE.md → Deferred Items) — 7 pending human-UAT scenarios (Phase 02/03) and 2 verification sign-offs, all manual checks on shipped CRM features.

---
