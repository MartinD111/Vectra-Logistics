# external-systems.md — ERP, EDI/SFTP, telematics/GPS, webhooks

Scope: everything the business plan's Integration Engine (§3.4) describes
beyond Outlook/M365 (covered fully in `oauth-connections.md`) — ERP/
accounting system connections, EDI/SFTP, telematics/GPS provider credentials,
and the webhook surface as a whole. The headline finding here is a genuine
architectural duplication, more consequential than a simple gap: **two
separate, mutually-unaware credential tables both claim to track whether a
company is connected to Samsara/Geotab.**

> Suggested location: `docs/specs/modules/external-systems.md`.
> Reads with: `oauth-connections.md` (the sibling `integration_credentials`
> table), `fleet.md` §3 (telematics live-position gap — this document adds a
> second, independent stub for the same problem), `on-premise-deployment.md`
> §7 and `yard-pod-fieldops.md` §2 (the two real inbound webhook paths).

---

## 1. Critical finding: two credential tables for the same providers, unaware of each other

Two completely separate systems store "is this company connected to a
telematics provider" — confirmed by reading both directly:

- **`integration_credentials`** (`database/extensions.sql`, documented in
  `oauth-connections.md` §2) — used by `outlook.repository.ts` **and**
  `fleet/telematics.service.ts::connectedProvider()`, which queries it for a
  `samsara`/`geotab` row with `status = 'connected'` to decide whether the
  "My Fleet" dispatcher widget should show a (still-fake, per `fleet.md` §3.3)
  "connected" badge.
- **`api_credentials`** (a different table — `integrations.repository.ts`) —
  used by the separate `integrations` domain's `saveIntegration`/
  `getVehicleLocation`. Its provider enum
  (`IntegrationProvider = 'samsara' | 'geotab' | 'webfleet' | 'wialon' |
  'transporeon' | 'alpega'`) is broader than anything `integration_credentials`
  handles.

**These do not read or write each other.** A company that connects Samsara
through whichever UI path writes to `api_credentials` will show as
**disconnected** to `telematics.service.ts` (which only checks
`integration_credentials`), and vice versa. This is a third instance of the
same category of problem already flagged twice elsewhere in this codebase —
`marketplace-ltl.md` §2.1's duplicate booking/commission logic, and
`fleet.md` §3's telematics stub — which suggests this isn't an isolated
mistake but a **recurring pattern worth a deliberate, repo-wide check**: any
time two domains touch the same third-party provider or business concept,
verify they share the same table/service rather than assuming.

**Recommendation**: before building any new external-system integration
(ERP, EDI, or extending telematics), reconcile these two tables first — pick
one (`integration_credentials` is the more broadly-used and more recently-
built of the two; a reasonable default choice) and migrate `integrations`
domain's reads/writes onto it, retiring `api_credentials`. Don't add a third
table for the next integration before this is resolved.

---

## 2. A second, independent telematics stub

`fleet.md` §3 already documents that `telematics.service.ts::getSnapshot`
always returns synthetic positions, even when "connected." Separately,
**`integrations.service.ts`** contains its own stub pair —
`fetchSamsaraLocation`/`fetchGeotabLocation` — each with an explicit TODO for
the real API call (Samsara Fleet API `GET /fleet/vehicles/{id}/locations`;
Geotab's JSON-RPC `Get`/`DeviceStatusInfo`) and both currently returning the
**same single hardcoded Ljubljana coordinate** regardless of input. This is
not the same code path as `fleet.md`'s finding — it's a **second, separate**
unimplemented integration for what is conceptually the same capability
(fetch a vehicle's live location from a connected provider). Once §1's
table reconciliation happens, this duplication should collapse into one real
implementation feeding both consumers, not two stubs maintained in parallel.

---

## 3. Broader provider ambition than what's implemented

`IntegrationProvider` already includes `webfleet`, `wialon`, `transporeon`,
`alpega` — real telematics platforms (Webfleet, Wialon) and, notably,
**real European freight-exchange/TMS platforms** (Transporeon, Alpega) that
go beyond telematics into the kind of load-board/carrier-network territory
`procurement.md` and `marketplace-ltl.md` cover. None of the four has any
functional implementation — `getVehicleLocation`'s switch statement only
handles `samsara`/`geotab`; the other three would throw `"Provider ... does
not support location fetch"` if selected. This looks like the enum was
sized for an intended broader integration roadmap that hasn't been built out
yet, not an oversight — worth confirming that intent explicitly (is
Transporeon/Alpega connectivity actually planned, e.g. as an alternative RFQ
broadcast channel for `procurement.md` §2.2's "API/Portal" gap?) before
either building against it or trimming the enum to match reality.

---

## 4. ERP, accounting, EDI, SFTP — none of it exists

Searched the entire backend and frontend for `ERP`, `EDI`, `SFTP`, and the
two accounting systems the business plan names specifically (Minimax,
Zantheon, §3.4) — **zero references anywhere.** This is fully greenfield,
unlike telematics (which has real, if duplicated/stubbed, infrastructure to
build on). Nothing here to correct or reconcile — just confirming the true
starting point before scoping any of this work, since "Integration Engine"
in the business plan groups ERP/EDI/SFTP alongside the Outlook/telematics
work that *is* real, which could easily be mistaken for equal footing.

If/when this is prioritised: EDI (especially for freight — EDIFACT
messages like IFTMIN/IFTSTA) and SFTP file-drop integrations are a
fundamentally different shape from the OAuth2 pattern this codebase already
does well (`oauth-connections.md` §1) — batch/file-based, not
request-response API calls — so don't force them into the
`integration_credentials`/OAuth abstraction. They're closer in shape to a
scheduled worker (reuse the BullMQ pattern from `workers/matchingJob.ts` /
`kpi-engine.md` §6.1's planned scheduler) that polls an SFTP drop or an ERP's
export endpoint on a timer, parses, and feeds results into the event spine /
relevant domain — a new pattern, not an extension of an existing one.

---

## 5. Internal API keys — generation exists, verification doesn't

`integrations.service.ts::generateInternalApiKey` is a real, correctly-built
piece: a random 32-byte key shown once, SHA-256 hashed before storage (never
stores the raw key), with a `key_prefix` kept in the clear for
display/lookup purposes. This is good practice, consistent with the rest of
the codebase's credential handling.

**But nothing consumes it.** Searched for any middleware or route checking an
incoming request's API key against `internal_api_keys` — none exists. A
customer can generate a key today, but there is no way for them (or a
third-party integration, or a future App Store extension) to actually
authenticate a request with it. This is the "generation half" of a feature
with no "verification half" — likely intended as the foundation for exposing
Vectra's own API to external developers/partners (relevant to a future
`app-store.md`'s third-party extension story), but not usable for that yet.
Building the verification middleware (a straightforward `X-Api-Key` header
check, hash-compare against `internal_api_keys`, same shape as
`authenticateToken`) is the concrete next step if external API access is
wanted.

---

## 6. Webhooks — summary (detailed elsewhere, not re-documented here)

Two real inbound webhook surfaces already exist and are documented in depth
elsewhere — this section only indexes them so `external-systems.md` is a
complete map of the Integration Engine without duplicating content:
- **Samsara/Geotab telematics** (`on-premise-deployment.md` §7,
  `fleet.md` §3.2) — properly HMAC-verified, but payload processing is a
  stub that only logs (separate from, and worth fixing alongside, §1/§2's
  credential-table reconciliation).
- **Gate ANPR/OCR** (`yard-pod-fieldops.md` §2) — **not** authenticated at
  all, flagged there as a fix-before-any-customer-install issue.

No other webhook receivers exist in the codebase today.

---

## 7. Do / Don't

**Do**
- Reconcile `integration_credentials` vs `api_credentials` (§1) before
  building any new external-system integration — this is the highest-priority
  item in this document.
- Treat EDI/SFTP as a scheduled-worker pattern (§4), not an OAuth-shaped
  integration.
- Build the `internal_api_keys` verification middleware (§5) if/when external
  API access is actually needed — the generation half is ready and waiting.
- Confirm whether Transporeon/Alpega/Webfleet/Wialon (§3) are real near-term
  targets before writing code against them.

**Don't**
- Don't add a third credential table for the next integration before §1 is
  resolved.
- Don't build ERP/EDI assuming any existing infrastructure covers it — it's
  genuinely greenfield (§4).
- Don't treat `internal_api_keys` as a working authentication mechanism today
  — only the key-generation half exists.
- Don't duplicate `fleet.md`'s telematics stub fix separately from §2's —
  they're the same underlying gap, fix once.
