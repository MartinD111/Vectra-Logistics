# billing-and-seats.md — Vectra's own subscription billing (seats, plans, module add-ons)

Scope: business plan Steber A (§12) — licenca za Workspace platformo, licence
po uporabnikih (seats), plačljivi dodatni moduli, Vectra AI naročnina, App
Store provizija. This is **Vectra charging tenants** for the platform itself.
Confirmed: **none of this exists in code.** This document also exists to draw
a clear line between this and three *other*, unrelated "Vectra earns money"
concepts already partially present in the codebase, which are easy to
conflate with subscription billing but aren't it.

> Suggested location: `docs/specs/business/billing-and-seats.md`.
> Reads with: `cloud-deployment.md` §5 (first named this gap),
> `app-store.md` §3 step 5 (revenue-share depends on this existing first),
> `ai-integration.md` §6.3 (the Vectra-hosted AI tier is a usage-billing
> variant of the same problem), `event-spine.md` §2 (`workspace_presets.
> enabled_modules` — the existing schema this document proposes reusing for
> module-add-on gating).

---

## 1. Confirmed: zero infrastructure for this specific thing

- **No Stripe or any payment provider integration anywhere** — searched the
  whole backend and frontend, nothing.
- **`companies` has no plan/tier/seat-limit column at all** — just identity/
  address fields and a `verification_status`. There is no concept of "which
  plan is this company on."
- **`users.subscription` (a `subscription_status` enum: `active | inactive |
  none`) is a dead column** — set with a default, never read or written
  anywhere in `apps/api/src`. It looks like a leftover from an earlier design
  direction (possibly per-user rather than per-company subscription), not a
  working mechanism.
- **No seat counting or enforcement** — nothing limits or even reports how
  many users a company has relative to any plan.

This is genuinely greenfield — there isn't even a dormant schema field with a
"Phase K"-style comment pointing at where to build it (contrast
`app-store.md` §2's plugin registry, which at least names its own gap
explicitly).

---

## 2. Don't conflate this with three other, unrelated revenue concepts already in the code

This matters because the codebase has **three different** "Vectra takes a
cut" mechanisms already partially present, and none of them is subscription/
seat billing. Naming them precisely prevents wasted effort assuming one of
them is a head start on this.

### 2.1 Marketplace commission (`bookings.commission_fee`)
Per `marketplace-ltl.md` §2.1: `bookings` has a `commission_fee` column, but
the currently-routed `marketplace.repository.bookShipment` doesn't even
create a `bookings` row, so this commission mechanism is presently
unreachable regardless. Even if fixed, this is a **per-transaction commission
on the peer marketplace**, not a subscription.

### 2.2 Driver settlements (`billing.service.ts`'s `platform_fee`) — dead, and worse than a comment
`billing.service.ts` computes a driver payout split (85% driver / 15%
platform fee by default) and **actively queries a `settlements` table**
(`INSERT INTO settlements`, `SELECT * FROM settlements ...`) — but that
table's `CREATE TABLE` statement exists **only as a comment** in the same
file, never a real migration. Unlike `marketplace-ltl.md` §2.4's
`archive_logs` (dead but unreferenced), this one is **actively called by real
service methods** — `createSettlement`/`getSettlementByShipment`/
`getSettlementsByCompany` would throw a SQL error ("relation settlements does
not exist") if invoked. Confirmed **not currently reachable** — no route in
`billing.routes.ts` maps to any of these three methods — so it's dormant,
not an active bug, but it would break immediately if someone wired a route to
it without first turning the comment into a real numbered migration. Flag
this precisely if anyone picks up driver settlements as a feature. This is
also a **third instance** of a per-transaction platform fee — again, not a
subscription.

### 2.3 Customer-facing invoicing (`domains/billing/invoicing.service.ts`)
Documented in depth in `cmr-workflow.md` §1 (POD → auto-draft invoice via
Smart-VAT). This is **the tenant's own accounts receivable** — them invoicing
their freight clients — and involves zero Vectra revenue. It's real, well
built, and completely unrelated to this document's scope beyond being a
useful pattern reference (§4).

**None of §2.1–§2.3 is "a company pays Vectra a monthly seat/module fee."**
That concept has no code anywhere.

---

## 3. What needs to be built

### 3.1 Plan/tier + seat visibility (cheapest first step, no payment provider needed yet)
Add a `company_plan`-shaped concept — either columns on `companies`
(`plan_tier`, `seat_limit`) or a small `company_subscriptions` table if
richer state (trial, past-due, cancelled) is needed from day one. Pair with
a simple seat-count query (`COUNT(*) FROM users WHERE company_id = $1`)
surfaced in Team settings. This alone is useful before any billing provider
integration exists — it makes "how many seats are we using" visible, which
is a prerequisite for enforcing anything later.

### 3.2 Payment provider integration (Stripe, per the business plan's own framing and `docs/HANDOFF.md`'s historical note that this was always the planned next step)
Standard subscription billing: Stripe Customer per `company`, Subscription
per plan, webhook handling for payment success/failure/plan changes updating
`company_subscriptions`. This is the actual net-new infrastructure work —
nothing existing accelerates it beyond §2's unrelated pieces. Follow the same
credential-handling discipline used everywhere else in this codebase
(`ai-integration.md` §1, `oauth-connections.md` §2): Stripe's webhook signing
secret and API key go through the same `secretBox` encryption-at-rest
pattern, not a new one.

### 3.3 Module add-ons — reuse `workspace_presets.enabled_modules`, don't invent a parallel gate
The business plan's "Dodatni poslovni moduli: Marketplace, Procurement,
Advanced Fleet — kot plačljivi dodatki" (§12) maps naturally onto schema that
**already exists**: `workspace_presets.enabled_modules` (`event-spine.md`
§2) is already a generic JSONB array of module keys a workspace turns on
(`records, programs, templates, fleet, marketplace, documents,
automations`, per the seeded example presets). The natural design is: a
company's active plan determines **which module keys they're entitled to
enable**, and the existing preset/module-toggle mechanism stays the single
place that turns features on — billing becomes an entitlement check in front
of that mechanism, not a second, parallel feature-flag system. Concretely:
before a workspace preset application or module toggle is accepted, check the
requested module keys against the company's plan entitlements; reject or
prompt an upgrade otherwise. This avoids building a duplicate module-gating
system alongside the one that already exists — a mistake worth avoiding
given how many duplicate-parallel-system findings have already turned up
elsewhere in this codebase (`marketplace-ltl.md` §2.1, `external-systems.md`
§1).

### 3.4 Usage-based billing for the Vectra-hosted AI tier
`ai-integration.md` §6.3 already scopes the not-yet-built "Vectra AI" hosted
provider option (a fourth `company_ai_config.provider` value, proxied like
OpenAI/Gemini but billed per-company rather than keyed to the company's own
API account). This is a **usage-metered** variant of the same underlying
billing infrastructure (§3.2) — sequence it after basic subscription billing
exists, reusing the same Stripe customer/subscription objects with metered
line items rather than building separate billing plumbing for AI usage
specifically.

### 3.5 App Store revenue share
Explicitly sequenced *after* this document in `app-store.md` §3 step 5 —
revenue-share for third-party plugin sales needs a working Stripe Connect (or
equivalent) payout mechanism on top of §3.2's basic billing, plus the catalog/
listing infrastructure `app-store.md` §3 describes. Don't start here; this is
the last piece, not the first.

---

## 4. A reusable pattern worth carrying over: Smart-VAT

`invoicing.service.ts`'s VAT-treatment logic (§2.3 — reverse charge handling
for cross-border EU B2B, referenced in `cmr-workflow.md`) is directly
relevant to Vectra's own subscription invoices too: Vectra will be billing
companies across multiple EU (and non-EU) jurisdictions, which has the same
reverse-charge/VAT-number-validation shape as a tenant invoicing their own
freight clients. Reuse the existing `vat.service.ts` logic (or its underlying
rules) for Vectra's own subscription invoices rather than writing VAT
handling a second time — same category of advice as §3.3's "reuse, don't
duplicate" theme running through this whole document.

---

## 5. Do / Don't

**Do**
- Start with plan/seat visibility (§3.1) — no payment provider needed, and it
  makes the eventual billing integration's "what are we enforcing" question
  concrete before writing Stripe code.
- Gate module add-ons through `workspace_presets.enabled_modules` (§3.3),
  not a new parallel mechanism.
- Reuse `secretBox` for Stripe credentials and the existing Smart-VAT logic
  for Vectra's own invoices (§4).
- Sequence usage-based AI billing and App Store revenue-share **after** basic
  subscription billing exists (§3.4, §3.5) — both depend on it.

**Don't**
- Don't confuse marketplace commission, driver settlements, or customer-
  facing invoicing (§2) with Vectra's own subscription revenue — they're
  three unrelated mechanisms, none of them this.
- Don't wire a route to `billing.service.ts`'s settlement methods without
  first turning its commented-out `CREATE TABLE settlements` into a real
  migration — it will throw today.
- Don't resurrect `users.subscription` as the seat/plan mechanism — it's
  dead, per-user (wrong grain — plans are per-company), and unused; design
  the real thing fresh rather than trying to repurpose it.
- Don't build a second module-gating system alongside
  `workspace_presets.enabled_modules` — extend that one.
