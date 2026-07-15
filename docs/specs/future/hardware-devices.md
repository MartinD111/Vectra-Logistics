# hardware-devices.md — Certified QR readers, Bluetooth printers, on-prem servers

Scope: business plan §10.2 (certified QR readers, certified Bluetooth
printers) and §10.1 (Standard/AI Server hardware). Explicitly out of scope
for the current build phase per `CLAUDE.md` §2.4 — this document exists so
the eventual work isn't started blind, not to propose building any of it now.
Kept intentionally lean given that status.

> Suggested location: `docs/specs/future/hardware-devices.md`.
> Reads with: `yard-pod-fieldops.md` §3 (the QR-vs-ANPR/OCR decision this
> depends on), `cmr-workflow.md` §1 (the existing PDF-based "print" flow),
> `on-premise-deployment.md` (the Standard/AI Server line is already fully
> specified there — not re-specified here).

---

## 1. Status: no code, no software hooks, for any of the three lines

Confirmed by search: no Web Bluetooth API usage anywhere, no QR-code
generation library in any `package.json`, no ESC/POS or ZPL (thermal-printer
protocol) code anywhere. This is expected — these are physical-hardware
product lines (procurement, certification, support, logistics of shipping
devices to customers), not primarily a software gap — but worth confirming
precisely rather than assuming partial coverage.

---

## 2. QR readers (§10.2) — blocked on a decision made elsewhere, not on hardware sourcing

`yard-pod-fieldops.md` §3 already covers this in depth: the gate check-in
system that's actually built is **camera-based ANPR/OCR** (license plate/
container number recognition), not QR-scan-based at all. Before sourcing or
certifying any QR reader hardware, resolve that document's open question —
is ANPR/OCR the intended production path (in which case QR readers may not be
needed at all, or only for yards without camera infrastructure), or is QR
still wanted as a genuine parallel method? Certifying hardware for a check-in
method that might not be the primary path is the wrong order of operations.
**This document has no independent recommendation beyond pointing at that
decision** — it's a prerequisite, not parallel work.

If QR is confirmed as wanted: the software side is small and well-precedented
elsewhere in the codebase (a QR payload is just a signed token, the same
shape as POD's single-use upload token per `cmr-workflow.md` §1 Half B) —
generate a QR encoding a signed gate/check-in token, scan it with any
standard reader (most "certified" readers are just USB/Bluetooth HID
keyboard-emulation scanners requiring no special driver), and verify the
token server-side the same way POD tokens already work. The "certification"
work itself (vetting specific reader models, establishing a supply/support
line) is a hardware-business task, not a software one.

---

## 3. Bluetooth printers (§7.4) — real building block exists, but not the Bluetooth part

`cmr-workflow.md` §1 documents the real, working "print" flow today: generate
a PDF (`jsPDF`) and hand it to the OS/browser print dialog
(`doc.output('blob')` → download/print). There's a genuinely useful adjacent
feature already built worth knowing about: a **dot-matrix pre-printed-form
mode**, where a user uploads a scan of a pre-printed CMR form and draws field
boxes defining where each data field should print — built for exactly the
kind of legacy dot-matrix printer + carbon-copy CMR paper real freight offices
still use. This is real, working, and unrelated to Bluetooth specifically —
worth preserving as-is.

**What business plan §7.4 actually describes** (a driver's PWA connecting
directly to an in-cab thermal printer over Bluetooth to print without a
computer/OS print dialog in the loop) **doesn't exist and is a genuinely
different technical problem** from the PDF-generation flow above:
- **Web Bluetooth API** (browser-to-device, no app install) is the
  browser-native option, but real-world thermal/label printer protocol
  support over Web Bluetooth is inconsistent across printer brands/models —
  many printers expose only a vendor SDK (iOS/Android native), not a clean
  GATT profile a browser can drive directly.
- The realistic alternative many dispatch tools use is a **printer vendor's
  own app/SDK** on the driver's phone, with Vectra handing off a
  print-ready payload (the PDF already generated) rather than Vectra's own
  code speaking Bluetooth printer protocol directly.
- **Decide this before certifying specific printer models**: certification
  should target whichever integration path (Web Bluetooth vs. vendor SDK
  hand-off) is actually chosen, since it determines which printer models are
  even viable candidates.

---

## 4. On-prem servers (§10.1) — not new scope, already fully specified elsewhere
Standard Server and AI Server are not a distinct software problem — they're
exactly what `on-premise-deployment.md` already specifies in full (the
production compose stack, installer, secrets generation) plus, for the AI
Server specifically, `ai-integration.md` §6.1's planned backend-reachable
local-Gemma path. **No new document is needed for this line** — it's the
hardware-fulfillment side (which physical box ships, GPU specs, pre-imaging a
drive with the production stack) of software that's already scoped. Point any
future hardware-sourcing work at those two documents rather than duplicating
their content here.

---

## 5. Do / Don't

**Do**
- Resolve `yard-pod-fieldops.md` §3's ANPR/OCR-vs-QR decision before sourcing
  QR reader hardware (§2).
- Decide the Bluetooth integration path (Web Bluetooth vs. vendor SDK
  hand-off) before certifying specific printer models (§3).
- Treat Standard/AI Server hardware as a fulfillment task on top of
  `on-premise-deployment.md`'s already-complete software spec, not a new
  software effort (§4).

**Don't**
- Don't build QR-reader software support before §2's prerequisite decision is
  made.
- Don't attempt Bluetooth printer protocol integration before §3's path
  decision — it determines what's even feasible.
- Don't scope this document's items into the current build phase — per
  `CLAUDE.md` §2.4, this stays deprioritised until the on-premise core work
  ships.
