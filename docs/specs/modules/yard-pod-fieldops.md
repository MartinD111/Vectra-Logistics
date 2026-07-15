# yard-pod-fieldops.md — Yard management, gate check-in & field execution

Scope: `apps/api/src/domains/yard` (spatial yard floor plan, gate check-in,
rail wagons) and the field-execution/driver-facing surface (POD, covered in
depth in `cmr-workflow.md` §1 Half B — referenced here, not re-documented).
This module maps to business plan §7.2 (PWA Manager), §7.3 (QR Check-In), and
part of §7.7 (Fleet). The headline findings: a genuinely well-designed spatial
model, one **real, unauthenticated webhook security gap** that needs fixing
before any customer install, and a physical-check-in approach that's real but
architecturally different from what the business plan describes.

> Suggested location: `docs/specs/modules/yard-pod-fieldops.md`.
> Reads with: `cmr-workflow.md` (POD is documented there in full — this file
> only summarizes it), `on-premise-deployment.md` §3 & §7 (this file adds a
> fourth security finding to that list, and a third real inbound-webhook
> dependency), `marketplace-ltl.md` §4 (the same demo-data-auto-seed pattern
> recurs here — see §4).

---

## 1. The spatial yard model — real, and a good architectural choice

`016_yard_management.sql`'s own header explains a deliberate, sound decision:
**no PostGIS.** The running Postgres image doesn't have the extension, and a
yard is a 2D floor plan, not geography — so zones/slots/assets live in an
abstract yard coordinate space (x/y/width/height in metres-ish units),
rendered with Leaflet's `CRS.Simple`. This avoids a destructive Postgres image
swap for a problem that doesn't need real geographic projection. Worth
preserving as the pattern for any future spatial feature that's really "a
floor plan," not "a map."

Three real, working entities:
- **`yard_zones`** — named areas (`pallet_rack | car_lot | teu_container |
  truck_parking`), rectangular today, with a reserved `polygon` JSONB column
  for non-rectangular shapes later.
- **`yard_slots`** — individual positions within a zone, `free | occupied |
  reserved`.
- **`yard_assets`** — trucks/containers/trailers/wagons physically on the
  yard, `in_yard | gate_in | departed`, tagged with `source: manual |
  gate_anpr | gate_ocr` so the UI can distinguish how an asset got checked in.

`yard.service.ts`'s `gateCheckIn` logic is genuinely solid: finds a free slot
in the right zone kind, reuses an existing asset record by
plate/container-number if one exists (so a truck that left and returns isn't
duplicated), frees its old slot, assigns the new one, and correctly emits both
a realtime event and a spine event (`yard.gate.checkin` — this domain **does**
call `recordEvent` correctly, unlike `marketplace.service.ts` per
`marketplace-ltl.md` §2.5).

---

## 2. Critical finding: the gate check-in webhooks have no authentication at all

This needs to be treated with the same urgency as the three security issues
already documented in `on-premise-deployment.md` §3 — it belongs in that same
"fix before any customer sees a build" bucket, not filed as a normal feature
gap.

`POST /api/webhooks/anpr` and `POST /api/webhooks/ocr`
(`gate.controller.ts`, mounted with **no** `authenticateToken` in
`webhookRoutes.ts`) accept a plain `company_id` in the JSON body as the only
identification of which tenant the check-in belongs to. **There is no
signature, no token, no HMAC verification** — unlike the Samsara/Geotab
telematics webhooks (`on-premise-deployment.md` §7), which are properly
HMAC-verified. The code comment is candid about this: *"Public (no session) —
a real deployment would carry a signed gate token; here the payload names the
company (documented as such)."* That caveat was never resolved into an actual
fix.

**Concrete risk**: `company_id` is a UUID, not a secret, and appears in URLs,
shared links, and API responses throughout the app. Anyone who obtains a
customer's `company_id` (trivially, e.g. from a shared page link) can POST
fabricated ANPR/OCR check-ins for that company — creating fake yard assets,
occupying real slots, and polluting `activity_events`/yard state with no
authentication barrier at all.

**Fix, following the Samsara/Geotab pattern already proven in this codebase**
(`webhook.service.ts`'s `verifySamsaraSignature`): issue each gate camera a
signed per-company gate token (shared secret or JWT scoped to `company_id` +
`gate` label), verified the same way, before this goes anywhere near a real
customer's yard. This is a small, well-precedented fix — the hard part
(HMAC verification with constant-time comparison) is already written
correctly elsewhere in the same file's neighbourhood; apply the same pattern
here rather than inventing a new one.

---

## 3. Physical check-in: real, but architecturally different from the business plan

Business plan §7.2–§7.3 describes a **QR-code, driver-PWA-centric** flow: the
driver gets a link to a mobile PWA with full instructions (destination, PIN
code, checklist), containing a QR code; warehouse/gate staff scan that QR code
with a certified reader and instantly see the driver/vehicle/shipment
details.

**None of that exists.** What's built instead is a **camera-based ANPR/OCR
gate system** — physical cameras read a plate or container number and POST it
to the webhooks in §2. This is a legitimate, real-world alternative to
QR-based check-in (many actual freight yards use ANPR), but it is a
**different mechanism** than the plan describes, with different hardware
implications (cameras + edge-AI recognition vs. handheld QR scanners) and a
different data flow (no driver-carried credential at all — the vehicle itself
is the identifier). Treat this as a deliberate scoping decision to make
explicitly, not an accidental substitution:
- If ANPR/OCR is the intended production path, business plan §7.3's "QR
  Check-In sistem" and the certified QR-reader hardware line (§10.2) should be
  revised to match what's actually built, or explicitly scoped as a second,
  parallel check-in method for yards without camera infrastructure.
- If QR/PWA is still wanted (e.g. as a lower-cost option for smaller yards
  without camera investment), it's genuinely unbuilt — no QR generation, no
  driver PWA, no scan-and-lookup endpoint exist anywhere in the codebase
  (confirmed by search). Scope it as net-new work, not an extension of §2's
  webhooks.

### The closest existing building block for a driver-facing PWA
`cmr-workflow.md` §1 Half B documents the POD public page
(`/pod/<token>`) in full — worth noting here specifically because it's the
**closest existing precedent** for business plan §7.2's PWA vision: a
public, login-free, mobile-optimised page (`capture="environment"` for direct
camera access, no `getUserMedia` complexity) opened from a link, scoped to a
single-use token. It's narrow today (capture one photo, nothing else), but the
pattern — single-use token → public mobile page → one focused action — is
exactly the shape a fuller driver PWA (instructions + checklist + QR display)
would extend, not replace.

---

## 4. Demo-data auto-seeding — same recurring pattern as LTL matching

`yard.service.ts` auto-seeds fake data on first real use, twice:
- `getLayout` calls `seedDemoYard(companyId)` whenever a company has zero
  zones — four demo zones (Truck Parking, TEU Containers, Pallet Racks, Car
  Lot) with a grid of slots, silently created.
- `listWagons` calls `seedDemoWagons(companyId)` the same way when a company
  has zero wagons.
- `gateCheckIn` **also** triggers `seedDemoYard` if a real gate camera's
  first-ever ANPR read arrives for a company with no yard configured yet —
  meaning a genuine physical gate event can silently fabricate an entire demo
  yard layout as a side effect.

This is the same pattern already flagged in `marketplace-ltl.md` §4
(`ensureDemoPartials`) and conceptually the same category as
`on-premise-deployment.md` §3.2's seeded admin account: **demo/fixture data
created as an implicit side effect of normal use, indistinguishable from real
data once persisted.** Given it now shows up in at least three separate
domains (LTL, Yard zones, Yard wagons), this is worth solving once, as a
platform-level convention, rather than patching each call site individually:
a shared `ensureDemoData`-style helper that (a) only runs when explicitly
enabled (e.g. a `demo: true` flag the frontend passes on first visit, not an
automatic fallback), and/or (b) tags seeded rows so they can be filtered,
relabeled in the UI as "sample data," or bulk-deleted later. Worth raising as
a `CLAUDE.md` convention once a second fix confirms the shared shape.

---

## 5. Rail wagons — real, simple, worth noting as-is

`rail_wagons` is a straightforward status-flow entity (`in_port |
loading_sequence | in_transit | discharging`, with a `seq` for loading order)
powering the `railway-terminal` page block. No spatial data — it's a sequenced
list, not a floor plan, which is the right level of complexity for what it
models. Nothing to fix here; noted for completeness since it shares the yard
domain and the `RailwayTerminalBlock`/`YardMapBlock` pairing in
`workspace-blocks.md`'s block registry.

---

## 6. Do / Don't

**Do**
- Fix the gate webhook authentication gap (§2) with the same priority as
  `on-premise-deployment.md` §3's findings — before any customer sees a build,
  not scheduled as ordinary feature work.
- Make an explicit scoping decision on ANPR/OCR vs. QR/PWA (§3) rather than
  letting the business plan and the codebase silently describe two different
  systems.
- Reuse the POD public-page pattern (§3) as the starting shape for any future
  driver-facing PWA work.
- Solve demo-data auto-seeding once, as a shared convention (§4), now that
  it's a confirmed recurring pattern across three call sites.

**Don't**
- Don't treat the gate webhooks as production-ready for a real customer yard
  until §2 is fixed — the current state is a genuine open door, not a
  theoretical risk.
- Don't build QR/PWA driver check-in as an extension of the ANPR/OCR webhooks
  — they're different mechanisms with different security models; scope
  separately per §3.
- Don't patch the next demo-data auto-seed site ad hoc — use this as the
  trigger to build the shared convention (§4).
