# VECTRA Platform — Handoff

**Date:** 2026-05-28
**Scope of this handoff:** Phases 2–4 of the build plan, plus the backend wiring that closes the gap so they are callable end-to-end.

---

## TL;DR

The marketplace transaction loop, fleet detail views, document upload, and the realtime layer (notifications, chat, live tracking) are all built on the frontend **and** have matching backend endpoints + socket events.

To run the platform you must:

1. Apply [database/migrations/002_realtime_and_documents.sql](../database/migrations/002_realtime_and_documents.sql)
2. `cd backend && npm i` (devDeps including `@types/*` may be missing on your machine — `tsc` complained about it)
3. Optionally set `MATCHING_ENGINE_URL`. If unset, the backend uses a haversine-based fallback so the UI still shows matches.
4. `docker-compose up --build -d` and visit `http://localhost:3000`

Type-checks:
- Frontend `npx tsc --noEmit` → clean
- Backend code-level TS errors caused by this work → none (only pre-existing `@types/*` not-installed warnings)

---

## Plan recap

A 9-phase plan was agreed earlier:

| Phase | Title | Status |
|---|---|---|
| 1 | Auth & Access Foundation | **Not started** |
| 2 | Core Marketplace Loop | ✅ Done (FE + BE) |
| 3 | Fleet, Documents & CMR | ✅ Done (FE + BE) |
| 4 | Realtime (Tracking, Notifications, Chat) | ✅ Done (FE + BE except `shipment:location` producer) |
| 5 | Billing & Settlements (Stripe) | Not started |
| 6 | Ratings, Reviews & Trust | Not started |
| 7 | Dashboard, Onboarding & Automations | Not started |
| 8 | Cross-cutting Quality | Not started |
| 9 | Launch Readiness | Not started |

Recommended next step is **Phase 1 (Auth hardening + RBAC)** — Phases 2–4 work but are not protected by middleware-level route guards in Next.js, and there's no JWT refresh.

---

## What's new on the frontend

### Phase 2 — Marketplace
- [src/lib/api/geocode.ts](../frontend/src/lib/api/geocode.ts) — Nominatim (OpenStreetMap) free geocoder
- [src/lib/api/marketplace.api.ts](../frontend/src/lib/api/marketplace.api.ts) — extended with `getShipment`, `getCapacity`, `cancelShipment`, `cancelCapacity`, `getShipmentMatches`; `bookShipment` now accepts `capacityId`
- [src/lib/hooks/useMarketplace.ts](../frontend/src/lib/hooks/useMarketplace.ts) — React Query hooks
- [src/components/map/RoutePreviewMap.tsx](../frontend/src/components/map/RoutePreviewMap.tsx) — dynamic route map
- [src/components/marketplace/StatusBadge.tsx](../frontend/src/components/marketplace/StatusBadge.tsx) — status taxonomy
- [src/app/post-shipment/page.tsx](../frontend/src/app/post-shipment/page.tsx) — full validation, blur-geocoding, live route preview, redirects to detail page
- [src/app/add-capacity/page.tsx](../frontend/src/app/add-capacity/page.tsx) — vehicle selector from real fleet, geocoded preview
- [src/app/shipments/[id]/page.tsx](../frontend/src/app/shipments/%5Bid%5D/page.tsx) — route, cargo, schedule, matching engine suggestions, confirm/cancel actions, documents, **chat**, **live map**
- [src/app/capacities/[id]/page.tsx](../frontend/src/app/capacities/%5Bid%5D/page.tsx) — capacity detail + withdraw action
- [src/app/marketplace/page.tsx](../frontend/src/app/marketplace/page.tsx) — `TabMatching` now lists real shipments/capacities with filters (origin, destination, date from, min weight, min pallets, sort)

### Phase 3 — Documents & Fleet
- [src/lib/api/documents.api.ts](../frontend/src/lib/api/documents.api.ts) — subject taxonomy + helpers
- [src/lib/hooks/useDocuments.ts](../frontend/src/lib/hooks/useDocuments.ts)
- [src/lib/api/fleet.api.ts](../frontend/src/lib/api/fleet.api.ts) — `getDriver(id)`, `getVehicle(id)`
- [src/lib/hooks/useFleet.ts](../frontend/src/lib/hooks/useFleet.ts)
- [src/components/documents/FileUploader.tsx](../frontend/src/components/documents/FileUploader.tsx) — drag-drop, size validation, multipart upload
- [src/components/documents/DocumentList.tsx](../frontend/src/components/documents/DocumentList.tsx) — list with expired / expires-soon badges
- [src/components/documents/DocumentExpiryBanner.tsx](../frontend/src/components/documents/DocumentExpiryBanner.tsx) — aggregate warning banner
- [src/app/drivers/[id]/page.tsx](../frontend/src/app/drivers/%5Bid%5D/page.tsx) — driver profile + dedicated document zone
- [src/app/vehicles/[id]/page.tsx](../frontend/src/app/vehicles/%5Bid%5D/page.tsx) — vehicle profile + document zone
- [src/app/(fleet)/management/page.tsx](../frontend/src/app/%28fleet%29/management/page.tsx) — rows now click through; expiry banner above stats

### Phase 4 — Realtime
- [src/lib/socket.ts](../frontend/src/lib/socket.ts) — Socket.io singleton, JWT in `auth`, typed event contracts
- [src/lib/hooks/useSocket.ts](../frontend/src/lib/hooks/useSocket.ts) — `useSocket`, `useSocketEvent`, `useSocketRoom`
- [src/lib/api/notifications.api.ts](../frontend/src/lib/api/notifications.api.ts) + [src/lib/hooks/useNotifications.ts](../frontend/src/lib/hooks/useNotifications.ts)
- [src/components/notifications/NotificationBell.tsx](../frontend/src/components/notifications/NotificationBell.tsx) — dropdown bell wired into [src/components/layout/Navbar.tsx](../frontend/src/components/layout/Navbar.tsx)
- [src/app/notifications/page.tsx](../frontend/src/app/notifications/page.tsx) — full list
- [src/lib/api/chat.api.ts](../frontend/src/lib/api/chat.api.ts) + [src/lib/hooks/useChat.ts](../frontend/src/lib/hooks/useChat.ts)
- [src/components/chat/ChatPanel.tsx](../frontend/src/components/chat/ChatPanel.tsx) — bubbles, auto-scroll, live/offline indicator
- [src/lib/hooks/useLiveShipment.ts](../frontend/src/lib/hooks/useLiveShipment.ts) — status + location subscription
- [src/components/map/LiveTrackingMap.tsx](../frontend/src/components/map/LiveTrackingMap.tsx) — pulsing truck marker
- [src/context/AuthContext.tsx](../frontend/src/context/AuthContext.tsx) — `login`/`logout` now reconnect/disconnect the socket so the JWT in the handshake stays current

---

## What's new on the backend

### Marketplace [backend/src/domains/marketplace/](../backend/src/domains/marketplace/)
- `GET /api/v1/marketplace/shipments/:id`
- `GET /api/v1/marketplace/capacities/:id`
- `POST /api/v1/marketplace/shipments/:id/cancel` (owner only, blocks if delivered/cancelled)
- `POST /api/v1/marketplace/capacities/:id/cancel`
- `GET /api/v1/marketplace/shipments/:id/matches` — proxies to `MATCHING_ENGINE_URL`/match; falls back to haversine-based heuristic in dev
- `bookShipment` and `cancelShipment` emit `shipment:status` on room `shipment:<id>`
- `findActiveShipments` widened to include `pending`, `open`, `booked`, `assigned`, `in_transit`

### Fleet [backend/src/domains/fleet/](../backend/src/domains/fleet/)
- `GET /api/v1/fleet/drivers/:id`
- `GET /api/v1/fleet/vehicles/:id`
- Both company-scoped via `requireRole(['carrier', 'admin'])` and `findXById(id, companyId)`

### Documents (new domain) [backend/src/domains/documents/](../backend/src/domains/documents/)
- `GET /api/v1/documents?subject=…&subject_id=…&doc_type=…`
- `POST /api/v1/documents` (multipart: `file`, `subject`, `subject_id`, `document_type`, `issued_at?`, `expires_at?`)
- `DELETE /api/v1/documents/:id`
- Subject taxonomy enforced: `company | driver | vehicle | shipment | booking`
- Company-scoped, max upload 10 MB
- New table `documents` (see migration)

### Notifications (new domain) [backend/src/domains/notifications/](../backend/src/domains/notifications/)
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `notificationsService.create()` is the integration point for other services — it writes the row AND emits `notification:new` to the user's socket room

### Chat (new domain) [backend/src/domains/chat/](../backend/src/domains/chat/)
- `POST /api/v1/chat/threads/by-shipment/:shipmentId` — return-or-create thread, adds caller as participant
- `GET /api/v1/chat/threads/:threadId/messages` — participant-guarded
- `POST /api/v1/chat/threads/:threadId/messages` — body ≤ 4000 chars, emits `chat:message` to room `chat:<threadId>`

### Realtime core (new) [backend/src/core/realtime/](../backend/src/core/realtime/)
- [socket.ts](../backend/src/core/realtime/socket.ts) — JWT auth on handshake (`socket.handshake.auth.token` or Bearer header); auto-joins `user:<id>` and `company:<id>`; safe-prefix guard on `join`/`leave` (only `shipment:`, `chat:`, `capacity:`, `company:` allowed)
- [bus.ts](../backend/src/core/realtime/bus.ts) — `emitToUser`, `emitToRoom`, `emitBroadcast` — services emit through this without importing the Socket.io Server (avoids circular deps, keeps services unit-testable)
- Wired into [server.ts](../backend/src/server.ts) via `configureSocket(io)`

---

## Database

New migration: [database/migrations/002_realtime_and_documents.sql](../database/migrations/002_realtime_and_documents.sql)

Tables added:
- `documents` (`subject CHECK IN (...)`, `subject_id`, `document_type`, `file_url`, `file_name`, `mime_type`, `size_bytes`, `issued_at`, `expires_at`, `uploaded_by`, `company_id`)
- `notifications` (`user_id`, `type`, `title`, `body`, `link`, `is_read`)
- `chat_threads` (`shipment_id` UNIQUE, `booking_id`)
- `chat_messages` (`thread_id`, `sender_id`, `body`)
- `chat_thread_participants` (`thread_id`, `user_id` — composite PK)

All idempotent, with FK cascades and the right indexes.

---

## Socket event contract

These are the wire-level events. Frontend and backend agree on them; document any change here in tandem.

### Server → Client

| Event | Payload | Room |
|---|---|---|
| `notification:new` | `{ id, type, title, body?, link?, created_at }` | `user:<id>` |
| `shipment:status` | `{ shipment_id, status, changed_at }` | `shipment:<id>` |
| `shipment:location` | `{ shipment_id, lat, lng, heading?, speed_kph?, recorded_at }` | `shipment:<id>` |
| `chat:message` | `{ id, thread_id, shipment_id?, booking_id?, sender_id, sender_name?, body, created_at }` | `chat:<threadId>` |

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `join` | room string | Subscribe to a room (validated against safe prefixes) |
| `leave` | room string | Unsubscribe |

### Auto-joined rooms on connect
- `user:<userId>` — for user-targeted notifications
- `company:<companyId>` — for company-wide broadcasts (no producer yet)

---

## Known gaps (intentional — for next session)

1. **`shipment:location` has no backend producer.** Frontend renders it the moment one arrives, but nothing currently emits it. Needs a driver-app/telematics ingestion endpoint that calls `emitToRoom('shipment:<id>', 'shipment:location', payload)`.
2. **`notificationsService.create()` is not yet called by other services.** The hook exists; it should be invoked from:
   - `marketplaceService.bookShipment` → notify the shipment owner
   - `marketplaceService.cancelShipment` → notify the carrier (if assigned)
   - A nightly job checking `documents.expires_at` → notify owner of expiring docs
   - `chatService` on incoming message → notify the other participant
3. **Phase 1 (Auth) was not done.** Things still missing:
   - JWT refresh / silent re-issue
   - `middleware.ts` for protected-route gating in Next.js
   - RBAC component wrapper (`<RequireRole>`) and nav-by-role
   - Password reset / email verification flows
   - The existing `AuthContext` calls `/api/auth/...` (legacy paths) — works, but inconsistent with the `/api/v1/...` everything else uses
4. **Phase 5+ untouched** — Stripe/billing, ratings, dashboard, onboarding, i18n, a11y, E2E, monitoring.
5. **Backend devDeps:** locally on the dev machine, `@types/*` weren't installed, so backend `tsc` had "Cannot find type definition" errors. `npm i` in `backend/` resolves this. None of the errors are caused by code in this session.

---

## Repo orientation

```
vectra-platform/
├── frontend/                     # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── shipments/[id]/   # ← Phase 2 detail page (also Phase 3 docs, Phase 4 live+chat)
│   │   │   ├── capacities/[id]/  # ← Phase 2
│   │   │   ├── drivers/[id]/     # ← Phase 3
│   │   │   ├── vehicles/[id]/    # ← Phase 3
│   │   │   ├── notifications/    # ← Phase 4
│   │   │   ├── post-shipment/    # ← Phase 2 (rewritten)
│   │   │   ├── add-capacity/     # ← Phase 2 (rewritten)
│   │   │   ├── marketplace/      # ← Phase 2 (TabMatching rewritten)
│   │   │   └── (fleet)/management/   # ← Phase 3 (banner + clickable rows)
│   │   ├── components/
│   │   │   ├── chat/             # ← Phase 4
│   │   │   ├── documents/        # ← Phase 3
│   │   │   ├── map/              # ← Phase 2 + 4 (RoutePreviewMap, LiveTrackingMap)
│   │   │   ├── marketplace/      # ← Phase 2 (StatusBadge)
│   │   │   └── notifications/    # ← Phase 4 (NotificationBell)
│   │   └── lib/
│   │       ├── api/              # API clients
│   │       ├── hooks/            # React Query + socket hooks
│   │       └── socket.ts         # ← Phase 4
│   └── package.json
│
├── backend/                      # Node + Express + Socket.io
│   ├── src/
│   │   ├── core/
│   │   │   └── realtime/         # ← NEW: socket.ts + bus.ts
│   │   ├── domains/
│   │   │   ├── marketplace/      # extended
│   │   │   ├── fleet/            # extended
│   │   │   ├── documents/        # ← NEW
│   │   │   ├── notifications/    # ← NEW
│   │   │   └── chat/             # ← NEW
│   │   └── server.ts             # wires configureSocket(io)
│   └── package.json
│
├── database/
│   ├── init.sql                  # base schema
│   └── migrations/
│       └── 002_realtime_and_documents.sql   # ← NEW
│
├── services/                     # Python matching engine
└── docs/
    ├── API.md
    ├── CONTRIBUTING.md
    └── HANDOFF.md                # ← this file
```

---

## Suggested first action for the next session

Pick one of:

**A. Wire the notification producers** (≈ 1 hour). Add 4 calls to `notificationsService.create()` at the right moments (book, cancel, chat message, document expiry). Immediately makes the bell light up in normal use.

**B. Phase 1 — Auth hardening + RBAC** (≈ 1–2 days). Highest priority for production. Adds protected routes, RBAC, refresh tokens.

**C. Phase 5 — Stripe billing** (≈ 1–2 weeks). Required for monetisation.

I would do A first (cheap, high signal), then B, then C.
