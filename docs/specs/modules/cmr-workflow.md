# cmr-workflow.md — CMR Digital Workflow (consignment note → POD → invoice)

Scope: the business plan's CMR Digital Workflow (§7.5) — dispatcher prepares a
CMR, it reaches the driver, gets signed/photographed, is verified, and the
shipment auto-completes into an invoice. The headline finding here is
structural: **two genuinely well-built halves of this workflow already
exist, but they don't talk to each other.** This document explains both
halves precisely, then specifies the integration work that turns them into
the one pipeline the business plan describes.

> Suggested location: `docs/specs/modules/cmr-workflow.md`.
> Reads with: `ai-integration.md` §5 (document AI is a mock — relevant to the
> missing OCR-verification step here), `event-spine.md`, `fleet.md` (same
> "looks connected, isn't" pattern as telematics — same lesson, different
> module), `on-premise-deployment.md` §7 (POD's public upload link is one of
> the documented inbound-connectivity dependencies).

---

## 1. The structural finding: two real halves, no link between them

### Half A — CMR document generation (`apps/cmr`): real, but entirely client-local
`CmrWorkspace.tsx` (1244 lines) + `lib/cmrGenerator.ts` is a genuine,
standards-compliant CMR (international consignment note) generator: proper
box-numbered fields (Box 1 Sender, Box 2 Consignee, Box 16 Carrier, Box 17
Successive carriers, etc.), built on `jsPDF`, with templates, a multi-step
form, batch generation, history, and ZIP export (`jszip`). This is
comparable in quality to the six hand-built reference programs
(`program-builder.md` §0) — genuinely useful, working software.

**But it is not integrated with the rest of the platform at all**: confirmed
by searching the whole component for any backend call — there is none.
State (`users`, `templates`, `settings`, `history`, generated PDFs) lives
entirely in the browser's IndexedDB (`idb-keyval`, key `vectra_cmr_state_v2`),
with **no `company_id`, no auth check, no API call anywhere in the file.**
Concretely, this means:
- A CMR created on one browser/device is invisible everywhere else — no
  cross-device sync, no team visibility.
- There is no multi-tenant scoping at all — the app doesn't know which
  Vectra company is using it; two people on the same physical browser profile
  would share state regardless of which company they're logged into
  elsewhere in the platform.
- Nothing here writes to `activity_events`, creates a `documents` row, or
  links to a `shipment` — a generated CMR is invisible to the rest of Vectra.

This is architecturally the same category of gap as `fleet.md`'s telematics
finding (a feature that looks integrated but isn't) — except more
fundamental, since it isn't a "connected but faking data" case, it's "not
connected to the backend at all."

### Half B — POD delivery confirmation (`apps/api/src/domains/pod`): real and genuinely well-integrated
This is the platform at its best, worth calling out explicitly as the
pattern to match, not just a thing to fix. `pod.service.ts`'s flow is real
end-to-end:
1. Dispatcher (or a `simulateArrival` demo trigger, standing in for geofencing
   that doesn't exist yet) creates a POD request → single-use token → link
   valid 48h.
2. Driver opens the public `/pod/<token>` page (no auth — `pod.public.routes.ts`,
   documented as an inbound-connectivity dependency in
   `on-premise-deployment.md` §7), uploads a photo.
3. `attachPod` stores it as a real `documents` row, flips the POD request to
   `delivered`, **flips the linked `shipment` to `delivered`**, broadcasts
   live over the realtime bus, and records `pod.delivered` on the event spine.
4. **If the delivery has a `client_id`, it auto-drafts an invoice**
   (`invoicingService.autoDraftInvoice` — agreed rate + Smart-VAT matrix +
   the POD photo attached) and pushes it to the dashboard for approval.
5. There's even a credit-limit guardrail on request creation
   (`invoicingService.assertCreditOk`) blocking an over-limit client before a
   token is even minted.

This already implements most of business plan §7.5's back half ("Označi
shipment kot zaključen… Sproži nadaljnje avtomatizacije npr. priprava
računa") for real. It's a strong foundation — the gap is entirely in what
feeds into it, not in this half itself.

---

## 2. What's missing: the verification step, and the link between the halves

### 2.1 No OCR/AI verification of the POD photo
Business plan §7.5 describes the system checking a returned CMR for
signatures, dates, numbers, and missing data, with AI stepping in when
classic OCR isn't enough. **None of this exists.** `attachPod` performs zero
content verification — it stores whatever file is uploaded and immediately
flips to `delivered`. This is not the same gap as `ai-integration.md` §5's
mocked `document-ai.service.ts`, which is a different document type (rate
confirmations) entirely — there is currently **no verification code path for
POD/CMR photos at all**, mock or otherwise.

### 2.2 No link between a generated CMR and a POD request/shipment
Because Half A never calls the backend, a CMR created in `apps/cmr` cannot be
the thing a POD request references. `pod_requests.shipment_id` exists and is
used (`attachPod` flips that shipment's status), but nothing connects it to a
CMR document Half A produced — they're conceptually the same paper document
in the business plan and two unrelated features in the code.

---

## 3. The integration work — sequenced, building on what exists

### Step 1: Move `apps/cmr` off IndexedDB onto the backend (prerequisite for everything else)
This is the highest-leverage fix and unblocks the rest. Concretely:
- Add `company_id`-scoped persistence for CMR documents, templates, and
  history — either a dedicated `cmr_documents`/`cmr_templates` table pair
  (mirrors the shape of `programs`/`project_pages`: JSONB `data` for the CMR
  form fields, since the field set is already well-defined in
  `cmrGenerator.ts`'s `CmrData`/`GoodsItem` types), or — once
  `workspace-blocks.md`'s Records/Views model ships — a records collection,
  consistent with how `procurement.md` §5 frames the same build-now-vs-
  later choice. Recommend the dedicated-table path now; don't block CMR
  integration on Records/Views.
- Add the auth check (`authenticateToken`) and route the existing
  `cmrGenerator.ts` logic through a real API call instead of `idb-keyval`.
  The PDF generation logic itself (`jsPDF` calls) doesn't need to change —
  only where the *data* it operates on comes from and is saved to.
- Emit spine events (`event-spine.md` §4 convention):
  `cmr.created`, `cmr.template.saved`, `cmr.batch.generated`.
- Migrate existing local IndexedDB history is **not** worth building — this
  is pre-release local dev/demo data; don't invest in a migration tool for it.

### Step 2: Link a CMR to a POD request
Add `cmr_document_id` to `pod_requests` (nullable — POD must keep working for
deliveries with no CMR, since `simulateArrival`'s demo path and any
non-CMR-tracked delivery shouldn't require one). When a dispatcher creates a
POD request from a CMR, pass the CMR's reference data through so `attachPod`
has something concrete to verify against in Step 3.

### Step 3: Add real verification (the actual net-new AI/OCR work)
Once Step 2 provides a reference CMR to check against, extend `attachPod`
with a verification pass, following `ai-integration.md`'s established
pattern exactly (§4's "try AI, always have a working fallback"; §7's Gemma
reliability advice):
- Classic OCR first (cheap, deterministic) — extract visible text from the
  uploaded photo and check for a signature region / expected reference
  number matching the linked CMR, per business plan §7.5's stated order
  ("Če klasični OCR ne zadošča… AI samodejno prevzame obdelavo").
- Fall back to AI vision (the same provider abstraction as
  `ai-integration.md` §3 — `aiService.complete`/`useAiComplete`, not a new
  client) only when classic OCR's confidence is low or the field is
  handwritten.
- Never block delivery completion on verification success — per §7.5,
  low-confidence results should flag the shipment for human review, not
  reject the driver's upload. This matches the platform's consistent "AI
  degrades gracefully, never blocks the real workflow" stance seen everywhere
  else (Smart Inbox, translate, mini-program generation).
- This is also the natural place to finally implement real logic behind
  `document-ai.service.ts`'s mock (`ai-integration.md` §5) if the same
  vision-model call is reused for both rate-confirmation parsing and POD
  verification — worth building once, used twice.

---

## 4. Do / Don't

**Do**
- Treat `apps/cmr`'s PDF generation quality as a genuine asset — the box
  layout and field set are correct; only the persistence layer needs to
  change.
- Use POD's integration (§1 Half B) as the reference pattern for "how a
  feature should hook into billing/shipments/the event spine" elsewhere in
  the platform.
- Sequence the fix as Step 1 (backend persistence) → Step 2 (link) → Step 3
  (verification) — each depends on the previous; don't build verification
  before there's a linked CMR to verify against.
- Keep verification non-blocking — flag for review, never reject a driver's
  upload outright.

**Don't**
- Don't describe the CMR Digital Workflow as implemented — Half A and Half B
  are both real but disconnected; say so precisely rather than rounding up.
- Don't build a migration path for existing IndexedDB CMR history — not worth
  it for pre-release local data.
- Don't build a second OCR/vision code path separate from
  `ai-integration.md`'s `aiService` abstraction — reuse it, and use the same
  opportunity to finally implement `document-ai.service.ts` for real.
