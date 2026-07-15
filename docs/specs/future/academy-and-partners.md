# academy-and-partners.md — Vectra Academy & IT Partner Network

Scope: business plan §11 — Vectra Academy (training/certification) and the IT
Partner Network (certified implementation partners, referral/commission
model). Explicitly out of scope for the current build phase per `CLAUDE.md`
§2.4. This is the thinnest of the specs in this series — confirmed zero
related code exists, and unlike hardware (§20), there isn't even much
adjacent software infrastructure to point at. Kept deliberately lean.

> Suggested location: `docs/specs/future/academy-and-partners.md`.
> Reads with: `app-store.md` §3 step 5 and `billing-and-seats.md` §3.5 (the
> payout-infrastructure dependency both this and App Store revenue-share
> share), `workspace-blocks.md` §3 (the Records/Views model, a plausible
> foundation for course/lesson tracking if this is ever built).

---

## 1. Status: no code, confirmed

Searched for `academy`, `certificat*`, `training`, `partner` across the whole
codebase. The only matches are unrelated: `"company registration
certificate"` (a document-upload label in the company verification flow) and
`"adr_certificate"` (a driver document type, ADR being the hazmat-transport
license). Neither has anything to do with training/certification or a
partner network. This is fully greenfield.

---

## 2. The one real dependency worth flagging now, even though the feature is deferred

Both halves of this module need to **pay someone who isn't a direct SaaS
customer**:
- Academy: presumably free or paid courses — not a payout problem itself, but
  certificate issuance could reuse the existing document-storage pattern
  (`company_documents`-style upload/verification, already used for
  compliance documents per §1's search results) for storing/serving issued
  certificates, rather than inventing new file handling.
- IT Partner Network: business plan §11.2 describes **annual membership or a
  commission on deals closed through the platform** — a payout mechanism.

This is the same underlying problem already named twice elsewhere:
`app-store.md` §3 step 5 (third-party plugin revenue share) and
`billing-and-seats.md` §2.2 (driver settlement payouts, currently dead code
querying a table that was never migrated). **Don't build a third parallel
payout mechanism when this is eventually prioritised** — by then, whichever
payout infrastructure (e.g. Stripe Connect or equivalent) gets built for App
Store revenue-share should be the one IT Partner commissions reuse too, since
both are "Vectra owes a third party a cut of a transaction," not two
different problems. Note this now so a future build doesn't reinvent it a
third time.

---

## 3. If Academy is ever built: reuse Records/Views rather than a bespoke LMS schema
Course listings, lesson progress, and exam results are fundamentally the same
shape as everything else this codebase has been steered toward modelling
generically: records with properties, grouped into views. `workspace-blocks.md`
§3's Records/Views model (courses as a collection, enrollment/progress as
records) is a more consistent fit than a purpose-built LMS schema, following
the same reasoning `procurement.md` §5 already applied to its own "build a
dedicated table now vs. wait for Records/Views" decision. Not urgent to
resolve now — just worth deciding deliberately rather than defaulting to a
new bespoke schema when the time comes.

---

## 4. Do / Don't

**Do**
- Reuse whatever payout mechanism gets built for App Store revenue-share
  (§2) for IT Partner commissions — don't build a second one.
- Consider Records/Views (§3) as the default modelling choice for course/
  progress tracking when this is eventually scoped in detail.

**Don't**
- Don't start building this before `CLAUDE.md`'s current on-premise-focused
  build order reaches it — nothing here is blocking anything else in this
  document series.
- Don't design a bespoke payout system for partner commissions independently
  of the App Store revenue-share work — they're the same problem.
