# procurement.md — Procurement (RFQ / freight buying) module

Scope: the business plan's Procurement module (§7.1) — a dispatcher receives a
shipping request, turns it into an RFQ, broadcasts it to a carrier list,
normalises and compares the offers that come back, and awards one. Unlike
`fleet.md`, **this module does not exist in code today** — there is no
`procurement` domain, no RFQ concept, no carrier-directory concept anywhere in
`apps/api/src/domains/`. This document is therefore a build spec, not a
code-documentation exercise — but it's grounded in real, reusable pieces
already sitting in adjacent domains, which change the design substantially
from a blank-page approach.

> Suggested location: `docs/specs/modules/procurement.md`.
> Reads with: `ai-integration.md` §4.2 (Smart Inbox — the intake half of this
> flow already exists), `event-spine.md`, `kpi-engine.md` §3.2 (`response_time`
> evaluator — a near-perfect fit here), `fleet.md` §4 (Spot Quote's
> transparency pattern), `workspace-blocks.md` (the Records/Views model this
> could eventually sit on).

---

## 1. Confirmed: nothing here exists yet

Searched the whole backend for `procurement`, `RFQ`, `request for quot(e)` —
nothing. No `rfq_*` tables, no carrier-directory schema, no quote-comparison
UI. This is genuinely greenfield. What follows is a design, not a status
report — treat every schema/flow below as a proposal to build, not something
to verify against existing code.

---

## 2. What already exists that this should reuse, not rebuild

This is the part that changes the design: three adjacent pieces already solve
sub-problems the business plan's Procurement flow needs, and building
Procurement from scratch would duplicate them.

### 2.1 Intake: Smart Inbox *is* "dispečer prejme povpraševanje"
The business plan's step 1 — a dispatcher receives a shipping request by
email — is **already built** as the Smart Inbox pipeline (`ai-integration.md`
§4.2, `inbox.service.ts`): raw email → LLM extraction (with a real
deterministic fallback) → validation → a `shipment_draft` row
(`needs_review`/`validated`/`confirmed`/`rejected`), pushed live and shown in
a drafts Kanban. **Procurement should start from a confirmed
`shipment_draft`, not reinvent intake.** The natural trigger for "prepare an
RFQ" is a dispatcher action on an already-confirmed draft, not a new parsing
step.

### 2.2 Outbound channels already have real (if partial) implementations
- **Email**: `campaigns.service.ts` sends real mail through the connected
  mailbox's Microsoft Graph `sendMail` endpoint (with per-recipient open
  tracking) — this is a working, reusable outbound-email mechanism, not a
  mock. RFQ email dispatch should call the same Graph pattern, not build a
  second email sender.
- **"WhatsApp"**: there is **no WhatsApp Business API integration** anywhere
  in the codebase — what exists (`automation.service.ts::buildWhatsAppUrl`) is
  a `wa.me/<phone>?text=<message>` deep-link generator: the dispatcher clicks
  a link that opens WhatsApp with a pre-filled message and sends it manually.
  This is a pragmatic, no-API-approval-needed pattern already proven for
  driver-assignment messages (with an AI-generated message + a deterministic
  fallback template, per `ai-integration.md`'s "always ship a working
  fallback" rule) — **reuse this exact pattern for RFQ WhatsApp outreach**
  rather than treating "WhatsApp broadcast" as automated messaging; it isn't,
  today, anywhere in this codebase, and shouldn't be silently assumed to be
  when scoping Procurement.
- **API / Portal**: neither exists. A carrier portal (where a connected
  carrier logs into Vectra and sees/responds to RFQs) is a real, larger
  feature — scope separately if prioritised; don't fold it into a first
  Procurement build.

### 2.3 Quote comparison — borrow the transparency pattern, not the code
`fleet.md` §4 documents Spot Quote's approach: return every intermediate
number in a breakdown so a dispatcher can sanity-check an estimate rather than
trust a black-box total. Apply the same principle to RFQ comparison — a
comparison table showing each carrier's quoted price *alongside* Spot Quote's
computed break-even/suggested rate (already available via
`spotQuoteService.calculate`) gives the dispatcher a reference point without
building a new pricing model.

### 2.4 Notifications
`notificationsService.create(...)` is already used by Smart Inbox for
draft-arrival notifications (`inbox.service.ts`) — reuse it verbatim for
"quote received" and "RFQ awarded" notifications rather than adding a second
notification mechanism.

---

## 3. Proposed flow (mapped onto business plan §7.1)

```
confirmed shipment_draft
        │  dispatcher: "Create RFQ" action
        ▼
  rfq_request (origin/destination/cargo/dates copied from the draft,
               status: draft → sent → comparing → awarded → cancelled)
        │  dispatcher selects recipients from the carrier list (§4)
        │  dispatcher picks channel(s) per recipient: email / wa.me link / (future: API/portal)
        ▼
  rfq_recipients (one row per carrier this RFQ was sent to, channel, sent_at)
        │  carrier replies (by email reply parsed via Smart-Inbox-style
        │  extraction, or manually entered by the dispatcher today)
        ▼
  rfq_quotes (normalised: carrier, price, currency, notes, received_at)
        │  dispatcher compares (§2.3) and awards one quote
        ▼
  awarded quote → creates the operational record (a Fleet/CMR-side "job" —
                  NOT a marketplace Shipment, see §5) + notifies the loser(s)
                  is optional/deferred
```

---

## 4. Carrier "directory" — reuse the reference-tool pattern, not `companies`

The business plan's RFQ recipients are often carriers with **no Vectra
account at all** — just a name, contact email/phone, and maybe an internal
code. Forcing every RFQ recipient to be a full `companies` row (which today
means a verified platform tenant/participant, per the Marketplace model in
§5) is the wrong fit and would conflate two different concepts.

**Reuse the exact pattern already proven in the reference programs**
(`program-builder.md` §0): the 1TON Announcement Helper's carrier list is a
simple, tenant-editable lookup table (name, code, aliases) — not a platform
entity. Model an RFQ carrier directory the same way:

```sql
CREATE TABLE rfq_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, -- the TENANT, not the carrier
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,               -- for the wa.me link pattern (§2.2)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Simple, tenant-owned, editable — exactly the "settings" lookup table shape the
reference programs already use, not a new platform primitive. If/when the
Records/Views model (`workspace-blocks.md` §3) ships, this table is a natural
candidate to become a `data_collection` instead of a bespoke table — flag it
as a migration candidate then, don't block the first build on that dependency.

---

## 5. Where the awarded RFQ's outcome lives — a real decision to make, not a default

**Do not write an awarded RFQ into the `shipments`/`Capacity`/`bookings`
tables** (`marketplace.types.ts`, `init.sql`). That schema models Vectra's
own two-sided public marketplace — a shipper posts a `Shipment`, a carrier
posts `Capacity`, they're matched, a `booking` is created with a
`commission_fee` that Vectra takes a cut of. An RFQ awarded to an external
carrier found via email/WhatsApp is a fundamentally different transaction —
no commission, no platform-matching, often not even a carrier with a Vectra
account. Conflating the two would corrupt Marketplace's commission/matching
statistics with unrelated data.

Two real options, pick deliberately:
- **(a) A dedicated, simple outcome table** now (`procurement_jobs` or similar
  — mirrors the RFQ tables' own shape, no dependency on anything else).
  Buildable immediately.
- **(b) A Records/Views record** (`workspace-blocks.md` §3) once that model
  exists — an awarded RFQ becomes a record in a tenant's own "Shipments"
  collection, consistent with the platform's generic-primitives direction and
  reusable by whatever downstream tracking (Fleet assignment, CMR, POD) needs
  to reference it.

Recommendation: build (a) now to unblock a working Procurement module, treat
it as a known migration target to (b) later — don't let Procurement wait on
Records/Views, but don't invest in a rich schema for (a) either, since it's
meant to be superseded.

---

## 6. Event spine + KPI — a strong, ready-made fit

Emit these verbs (`event-spine.md` §4 convention) from a new `procurement`
domain service, exactly like every other domain:

```
procurement.rfq.created        -> rfq_request
procurement.rfq.sent           -> rfq_recipient   (one event per recipient/channel)
procurement.rfq.quote_received -> rfq_quote
procurement.rfq.awarded        -> rfq_request
procurement.rfq.cancelled      -> rfq_request
```

This lines up directly with `kpi-engine.md` §3.2's **`response_time`**
evaluator — flagged there as "buildable now, spine-only, highest ROI of the
unimplemented types." RFQ turnaround time (`rfq.sent` → first
`rfq.quote_received` for the same `object_id`) is close to a perfect worked
example for that evaluator. Building Procurement's event emission and the
`response_time` evaluator together is a natural pairing — implementing one
without the other leaves either an unmeasured feature or an evaluator with
nothing real to measure.

---

## 7. AI's role — assist, not the mechanism, per the platform's stance

Per `ai-integration.md` §0's governing rule, keep AI as a helper with a real
fallback at every step, exactly like Smart Inbox and the driver-assignment
messages already do:
- **Parsing a carrier's email reply into a quote** — same shape as
  `inbox.parser.ts`: an LLM extraction (price, currency, validity, notes) with
  a deterministic regex fallback for the obvious case ("EUR 950" /
  "€950" patterns), never a hard dependency on AI being configured.
- **Drafting the RFQ outreach message** — reuse
  `automation.service.ts`'s Gemini-with-template-fallback pattern verbatim
  (§2.2) rather than writing a third version of "try AI, else use a template."
- Do **not** build an "AI negotiates with carriers" feature — nothing in the
  business plan asks for that, and it would cross the "AI as helper only"
  line the platform philosophy (business plan §9) explicitly draws.

---

## 8. Do / Don't

**Do**
- Start Procurement from a confirmed `shipment_draft`, not a new intake
  mechanism.
- Reuse Graph `sendMail` for email and the `wa.me` deep-link pattern for
  WhatsApp — both already exist and work.
- Model the carrier list as a simple tenant-editable lookup table (§4), not a
  `companies` row per carrier.
- Emit spine events for the full RFQ lifecycle and pair it with the
  `response_time` KPI evaluator (§6) — build them together.
- Keep the awarded-RFQ outcome table separate from Marketplace's
  `shipments`/`bookings` (§5).

**Don't**
- Don't describe "WhatsApp broadcast" as automated — it's a manual
  click-to-send deep link today, and any Procurement scoping/UI copy should
  say so accurately.
- Don't build a carrier portal or a real WhatsApp Business API integration as
  part of a first Procurement build — both are real, separate scope.
- Don't write procurement outcomes into the Marketplace schema.
- Don't add a second "AI draft message" or "AI parse email" implementation —
  reuse the two patterns that already exist.
