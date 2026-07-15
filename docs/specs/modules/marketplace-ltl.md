# marketplace-ltl.md — Marketplace (FTL matching) & Silent LTL matching

Scope: `apps/api/src/domains/marketplace` (shippers post loads, carriers post
capacity, matched and booked with a Vectra commission) and
`apps/api/src/domains/ltl` (the "silent" engine that finds profitable partial-
load insertions into a company's own active routes). Two related but distinct
engines, both backed by the same real Python matching service
(`services/matching-engine`). This documents what's real, a genuine
architectural duplication worth resolving, and a demo-data pattern that
mirrors a gap already found in `fleet.md`.

> Suggested location: `docs/specs/modules/marketplace-ltl.md`.
> Reads with: `fleet.md` §3 (the same "real entity matched against permanently
> fake data" pattern shows up here too — see §3), `event-spine.md`,
> `on-premise-deployment.md` §3.2 (seeded demo data reaching production is
> already a known category of issue — see §4), `procurement.md` §5 (explains
> why Procurement deliberately does *not* write into this schema).

---

## 1. Two distinct engines, one shared backend service

- **Marketplace** (`marketplace.service.ts`): a two-sided model — a shipper
  posts a `Shipment`, a carrier posts `Capacity`; they're matched and
  `bookShipment`/`assignShipment` finalise it. This is Vectra's own public/
  semi-public marketplace with a `commission_fee` on `bookings` (per
  `procurement.md` §5's framing — this is the schema Procurement deliberately
  avoids writing into, since an external-carrier RFQ isn't a commissioned
  marketplace transaction).
- **Silent LTL matching** (`ltl.service.ts`, migration `020_ltl_matching.sql`,
  Phase 7): a different problem — given a company's **own** active FTL routes
  with spare capacity, find unassigned partial/LTL loads (`partial_loads`)
  that can profitably be inserted with minimal detour. Persisted as
  `ltl_suggestions`, pushed live to the dispatcher, accept/dismiss workflow.
- **Both** call the same real Python service (`services/matching-engine`,
  FastAPI): `/match` and `/batch-match` for Marketplace, `/ltl-match` for
  LTL. Confirmed as real endpoints, not stubs — the engine is genuinely doing
  the detour/scoring math server-side, not returning canned data.

---

## 2. Marketplace — real core, with a genuine duplication to resolve

### 2.1 Finding: two parallel implementations of booking/commission logic
`server.ts` mounts **both** the domain-driven router (`/api/v1/marketplace` →
`marketplace.controller/service/repository`) **and** a set of legacy
top-level routes (`/api/shipments`, `/api/capacity`, `/api/ratings`,
`/api/companies` → `controllers/shipmentController.ts`,
`capacityController.ts`, `ratingsController.ts`, `companyController.ts`).

This matters because the two paths **don't do the same thing**:
- The legacy `bookings` table (`init.sql`) has `agreed_price` and
  `commission_fee` columns, and `ratingsController.ts`/`companyController.ts`
  read from `bookings`/`ratings` — implying a booking is expected to produce a
  `bookings` row.
- `marketplace.repository.ts::bookShipment` (the domain-driven, currently-
  routed path) **only updates `shipments.status`/`carrier_company_id`** — it
  does **not** insert a `bookings` row, so no commission is ever recorded and
  nothing becomes rateable through the path that's actually wired to
  `/api/v1/marketplace`.

**This needs a deliberate reconciliation, not a silent fix**: decide which
implementation is canonical, and either (a) have `marketplace.repository.
bookShipment` also insert the `bookings` row (restoring commission capture),
or (b) retire the legacy controllers/routes entirely and move
rating/commission logic into the domain-driven `marketplace` module properly.
Leaving both live risks exactly the kind of inconsistency already seen
elsewhere in this codebase (`release-and-migrations.md`'s "two upgrade paths"
problem, `on-premise-deployment.md`'s dev-vs-prod compose gap) — one code path
quietly not doing what the other assumes.

### 2.2 Matching is pull-based, not triggered on creation
`createShipment`/`createCapacity` both contain a literal commented-out TODO:
`// TODO: Enqueue matching job in BullMQ`. Creating a shipment or capacity
today does **not** automatically trigger match evaluation — a match only
happens when:
- A client explicitly calls `GET /marketplace/shipments/:id/matches`
  (`getShipmentMatches`), or
- `assignShipment` is called, which **does** enqueue a real BullMQ job
  (`getQueue('matching').add('evaluate-assignment', …)`) picked up by
  `workers/matchingJob.ts` against the Python engine's `/match` endpoint.

If "notify me when a match appears" is an intended feature (implied by a
marketplace model generally), this TODO is the concrete place to wire it —
uncomment and route through the same `matching` queue `assignShipment`
already uses correctly.

### 2.3 A good fallback pattern, worth preserving
`getShipmentMatches` degrades gracefully when `MATCHING_ENGINE_URL` is unset:
instead of failing, it runs a crude but functional haversine-distance
heuristic (bounding-box-style detour scoring) so "the UI stays functional in
dev" (and, by extension, in any deployment where the Python service is
temporarily down). This is the same "always have a working fallback" pattern
documented in `ai-integration.md` §4 and `fleet.md` §5 — good to keep as the
template for any future engine-backed feature.

### 2.4 Dead schema: `archive_logs`
`marketplace.repository.ts` contains a commented-out `CREATE TABLE
archive_logs (...)` block with a note "run once in a migration" — this was
never turned into an actual migration file and nothing references
`archive_logs` anywhere. Either build it as a real numbered migration if
shipment archiving is still wanted, or delete the dead comment — leaving it
as unexecuted SQL in a comment block is misleading to anyone reading the file
expecting it to reflect the real schema.

### 2.5 No event-spine integration
Unlike `ltl.service.ts` (which correctly emits `ltl.scan.suggested` /
`ltl.accepted`), **nothing in `marketplace.service.ts` calls `recordEvent`.**
Shipment creation, booking, assignment, and cancellation are all invisible to
statistics/KPIs/timelines today. Add the obvious verbs per `event-spine.md`
§4's convention: `shipment.created`, `shipment.booked`, `shipment.assigned`,
`shipment.cancelled`, `capacity.created`, `capacity.cancelled`.

---

## 3. LTL matching — same "real entity vs. permanently-fake counterpart" pattern as Fleet Telematics

This deserves the same careful framing `fleet.md` §3 gave telematics, because
it's the identical shape of gap:

- **The partial-loads side is real**: `partial_loads` is a genuine,
  persisted, `company_id`-scoped table; `createPartial`/`listOpenPartials`
  are ordinary CRUD; `scan()` really calls the FastAPI `/ltl-match` endpoint
  and persists whatever comes back.
- **The routes side is 100% hardcoded demo data, unconditionally.** `scan()`
  always sends the same four-item `DEMO_ROUTES` array (Koper→Munich,
  Ljubljana→Vienna, Zagreb→Milan, Graz→Rotterdam, each with a fixed
  `spare_kg`) to the matching engine — **regardless of company, regardless of
  whether that company has any real fleet, real telematics connection, or real
  assigned shipments.** The code comment is honest about this being
  temporary: *"in production these come from live telematics + assigned
  shipments"* — but there is no code path that does that substitution today,
  for any company.

**Net effect, same as `fleet.md` §3.3's conclusion**: every LTL suggestion any
customer sees today is scored against four fixed, fake European corridors,
not their actual fleet's spare capacity. This is worth fixing by the same
route `fleet.md` §3.4 already prescribes for telematics — once real vehicle
positions/routes exist (from that fix), LTL's route-side input should read
from the same source rather than staying hardcoded. **Sequence LTL's route-
data fix after Fleet Telematics' fix**, since it's the same missing piece
(real, current vehicle routes) feeding two different features.

---

## 4. Demo data auto-seeding into what could be a real company

`scan()` calls `ensureDemoPartials(companyId)` first, which **inserts the
four hardcoded demo partial loads for any company with zero partials on
record** — silently, on the first scan, no flag or opt-in. This is the same
category of concern raised in `on-premise-deployment.md` §3.2 about seed data
reaching real installs (there, a default admin login; here, fabricated
freight data mixed into a real company's operational records). A dispatcher
at a genuine customer running their first LTL scan gets four fake Slovenian/
Austrian/Italian loads mixed into their real data with no visual distinction
once persisted. Fix: gate demo seeding behind an explicit "load demo data"
action (or `DEPLOYMENT_MODE`/a `demo: true` flag on the seeded rows so they
can be filtered/purged), never an implicit side effect of a normal user action
like running a scan.

---

## 5. Do / Don't

**Do**
- Resolve the legacy-vs-domain-driven booking duplication (§2.1) deliberately
  — pick one, retire the other, don't leave both live.
- Add `recordEvent` calls throughout `marketplace.service.ts` (§2.5).
- Sequence the LTL route-data fix after Fleet Telematics' real-position fix
  (§3) — same underlying data, don't build it twice.
- Gate any demo-data seeding behind an explicit action, never an implicit
  side effect (§4).
- Keep the haversine fallback pattern (§2.3) as the template for other
  engine-backed features.

**Don't**
- Don't treat LTL suggestions as reflecting a customer's real fleet until §3's
  fix lands — they're scored against fixed demo corridors for every company
  today.
- Don't build a second matching-engine client for a future feature — reuse
  the existing `/match`, `/batch-match`, `/ltl-match` FastAPI endpoints.
- Don't leave `archive_logs` as an unexecuted comment — build it for real or
  delete it (§2.4).
- Don't let a customer's first LTL scan silently mix fabricated loads into
  their real data.
