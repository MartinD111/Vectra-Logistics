# CLAUDE.md — Vectra-Logistics steering document

This file is the architectural source of truth for any Claude Code session
working in this repo. Read this before making structural changes. If code
comments elsewhere (e.g. `-- CLAUDE.md §1`) reference a section number, that
numbering is preserved below on purpose — don't renumber without updating
those comments too.

---

## §1. Platform-core vs. vertical modules — current reality, not aspiration

Earlier planning assumed a fully generic "empty slate" builder with zero
industry-specific logic anywhere in platform code. **The current codebase has
already drifted from that**: `apps/workspaces/src/lib/projectPage/blocks.ts`
hard-codes logistics-specific block kinds (`fleet-telematics`, `spot-quote`,
`railway-terminal`, `yard-map`, `pod-tracker`, `crm-clients`, `vat-matrix`,
`ltl-matches`, `smart-inbox`). This is a real, load-bearing part of the
product today — do not "fix" it by silently ripping it out.

Working rule going forward, until explicitly revisited:
- **`apps/workspaces` core primitives** (workspace, program, record, template,
  automation, integration, metric, and the generic page-block types:
  rich-text, heading, chart, kpi-grid, kanban, activity-timeline, etc.) stay
  generic. New generic capability goes here.
- **Named vertical blocks/domains** (fleet, ltl, yard, pod, crm, vat,
  marketplace, cmr) are an accepted, explicit product layer — the "Business
  Modules" / "Logistics smart blocks" described in the current business plan.
  New vertical-specific features go into their own domain + block kind, not
  scattered into generic primitives.
- Do not add company- or single-customer-specific logic (i.e. logic that only
  makes sense for one tenant, not the vertical as a whole) anywhere in
  `apps/*` or `packages/*`. That still applies without exception.
- Do not port anything from `blg_master` (design-reference repo) directly —
  it stays a pattern reference, never a source of literal code or copy.

---

## §2. Current top priority: On-Premise, without forking the codebase

**Goal (current phase): make Vectra deployable On-Premise at a customer site,
as a first-class deployment target — not a stripped-down or divergent
version of the Cloud product.**

Hard constraint: **one codebase, one deployment-mode toggle** — not two
maintained branches, not a "lite" fork. Cloud and On-Premise are two
configurations of the same system.

### 2.1 Deployment-mode pattern (mandatory)

Follow the pattern already established by `company_ai_config`
(`provider: openai | gemini | local`, where `local` calls a LAN endpoint
directly from the browser instead of proxying through the backend). Every
subsystem that currently has a hidden cloud-only assumption should get the
same treatment: a config value, not a code fork.

Introduce a top-level `DEPLOYMENT_MODE=cloud|on-prem` (env-driven, read once
at boot). Use it to select behavior, never to branch business logic.

### 2.2 Known cloud-only assumptions to remove or make optional

- **Auth/SSO**: production topology assumes one wildcard domain + a session
  cookie shared across `marketplace` / `workspaces` / `cmr` subdomains
  (see `docs/DEPLOYMENT.md`). On-prem installs will often run on a single
  internal domain or bare IP with no subdomains — auth must work without
  subdomain-based cookie sharing.
- **Secrets/encryption keys**: currently env-var driven, which is already
  compatible — but there is no local generation step. An on-prem installer
  must be able to generate `ENCRYPTION_KEY` and friends itself, on first run,
  without calling home.
- **Webhooks / inbound integrations**: anything that requires the internet to
  reach the customer's server (inbound webhooks) needs an on-prem-compatible
  fallback (polling, outbound-only connections) since on-prem installs may
  sit behind a firewall with no public ingress.
- **Multi-tenancy**: schema is already scoped by `company_id`, so an on-prem
  install can simply be "one company, one install" — no schema fork needed.
  Don't build a separate single-tenant schema; just seed one company.

### 2.3 New work this phase requires (does not exist yet)

- **Licensing/activation** for on-prem installs (seat/module gating without a
  permanent connection to Vectra's cloud).
- **Release/update pipeline** for on-prem: versioned, tagged Docker images +
  the existing numbered-migration system, packaged so a customer (or their
  IT partner) can self-service upgrade. `database/migrations/*` is already
  idempotent and ordered — reuse this, don't invent a second mechanism.
- **Installer/first-run flow**: seed one company, generate secrets, pick
  `DEPLOYMENT_MODE=on-prem`, configure local AI provider if used.

### 2.4 Explicitly out of scope for this phase

Certified hardware (QR scanners, Bluetooth printers, appliance servers),
Vectra Academy/certification, and the IT Partner revenue-share network are
part of the long-term business plan but are **not** part of the current
build sequence. Don't let on-prem infra work expand into hardware
integration work unless separately scoped.

---

## §3. AI

Company-level AI config already supports cloud (OpenAI/Gemini, backend-
proxied, key encrypted at rest) and local (LAN endpoint, called directly from
the browser). This is deployment-mode-aware by design — keep extending it
rather than adding a separate on-prem-only AI path. A fully local model
(e.g. Gemma) is just another `local` provider entry, not new infrastructure.

---

## §4. Build sequence discipline

Tenant isolation (`company_id` scoping) and the `activity_events` event
spine must stay the foundation everything else reads from — this is already
true in the current schema; don't introduce KPI/statistics logic that
bypasses `activity_events` in favor of ad-hoc counters, even under On-Premise
time pressure.

---

## §5. When in doubt

If a change would only make sense for Cloud, or would only make sense for
On-Premise, stop and make it a config toggle instead of a fork. If that's
not possible for a specific subsystem, flag it explicitly rather than
quietly building cloud-only (or on-prem-only) behavior into shared code.
