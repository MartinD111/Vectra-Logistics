# cloud-deployment.md — Cloud (multi-tenant SaaS) deployment target

Scope: the Cloud configuration of the same codebase covered in
`on-premise-deployment.md` — multi-tenant self-serve signup, subdomain
routing/SSO, managed infrastructure, and the hardening/scaling gaps that
matter specifically at multi-tenant scale (as opposed to On-Premise's
single-tenant, customer-operated context). Written so Cloud doesn't get
designed out while On-Premise is the current build priority (`CLAUDE.md` §2).

> Suggested location: `docs/specs/deployment/cloud-deployment.md`.
> Reads with: `on-premise-deployment.md` (shares §2 auth mechanism, §6
> migration-runner gap, and the `DEPLOYMENT_MODE` toggle from `CLAUDE.md` §2.2),
> `billing-and-seats.md` (Vectra's own subscription revenue, not built yet —
> see §5).

---

## 1. What already exists

- **Self-serve multi-tenant signup is fully implemented**
  (`authController.signup`): one transaction creates a `companies` row, a
  default `workspaces` row (slug derived from company name), and the first
  `users` row as `role='admin'`. No vertical/workspace-type is chosen at
  signup — that happens afterward in the setup wizard, consistent with
  `CLAUDE.md` §1's "no industry-specific logic" rule (the code comment on this
  function says so explicitly). This is the Cloud onboarding path and needs no
  new work to function.
- **Subdomain routing + SSO** (`docs/DEPLOYMENT.md`) — three apps on
  subdomains of one parent domain (`marketplace.vectra.app`,
  `app.vectra.app`, `cmr.vectra.app`, `api.vectra.app`), sharing a session via
  `NEXT_PUBLIC_COOKIE_DOMAIN=.vectra.app`. This is the scenario the auth
  mechanism (`packages/auth/src/session.ts`) was actually built for — see
  `on-premise-deployment.md` §2 for the mechanism detail; here it's just
  configured with the domain set, which is its designed use case.
- **Multi-tenant OAuth**: `MS_TENANT` defaults to `'common'`
  (`outlook.service.ts`) — Microsoft's multi-tenant endpoint, so each customer
  authenticates against their **own** Microsoft 365 tenant through one shared
  Vectra app registration. Already correct for Cloud; no per-customer app
  registration needed.
- **Production images**: `apps/{marketplace,workspaces,cmr}/Dockerfile` build
  standalone Next.js output (`output: 'standalone'` in each `next.config.mjs`,
  traced from the monorepo root); `apps/api/Dockerfile` builds the API. These
  are shared with On-Premise (same images, per `CLAUDE.md` §2) — Cloud's job is
  operating them at scale, not building different ones.
- **Health endpoint**: `GET /health` on the API (`{status:"OK"}`).
- **Customer-facing billing already exists** — `domains/billing/` (`clients`,
  `invoices`, VAT handling) is for a **tenant's own customers** (they invoice
  their freight clients through Vectra). This is unrelated to Vectra charging
  *tenants* for the platform — see §5 for that gap.

---

## 2. Managed infrastructure — mostly a config change, not new code

Because Postgres/Redis access goes entirely through `DATABASE_URL`/`REDIS_URL`
(`core/db`, `core/queue`), swapping local containers for managed services is a
**connection-string change, not an architecture change**:

- **Postgres** → managed instance (RDS/Cloud SQL/Azure Database for
  Postgres/etc.), same schema/migrations, `sslmode` as required by the
  provider (verify `core/db/index.ts` accepts SSL config; add if missing).
- **Redis** → managed instance (Elasticache/Memorystore/etc.), same
  `REDIS_URL` shape already parsed in `core/queue/index.ts` (handles
  `rediss://` → TLS already).
- **File storage** (`uploads/` — currently local disk, used by
  `documentsController`, POD photo uploads, etc.): at multi-instance Cloud
  scale, local disk per container **breaks** — a file uploaded to instance A
  isn't visible from instance B. Move to object storage (S3-compatible) behind
  the same upload interface before running more than one API replica. This is
  a real gap, not yet handled — flag it before horizontally scaling the API.

None of this needs a `DEPLOYMENT_MODE` branch — it's just what values ops puts
in `.env`/secrets manager for the Cloud environment. Where `DEPLOYMENT_MODE`
*does* matter (registration open vs. closed, seed data), see
`on-premise-deployment.md` §4.2 — Cloud is simply `DEPLOYMENT_MODE=cloud`,
which is closer to today's default behaviour than `on-prem` is.

---

## 3. Gaps specific to multi-tenant scale

These matter for Cloud specifically because a single misconfigured On-Prem
install only affects one customer, while these affect every tenant on shared
infrastructure at once.

### 3.1 CORS is wide open
`server.ts`: `app.use(cors())` with no options (reflects any origin), and the
Socket.IO server is configured with `cors: { origin: '*' }`. Fine for local
dev; not appropriate once real multi-tenant data is in play. **Fix**:
restrict both to the known app origins (`NEXT_PUBLIC_MARKETPLACE_URL`,
`NEXT_PUBLIC_WORKSPACES_URL`, `NEXT_PUBLIC_CMR_URL`, and their Cloud subdomain
equivalents), sourced from env so On-Premise installs can still set their own
allowed origin(s) without a code change.

### 3.2 No rate limiting anywhere
No `express-rate-limit` or equivalent exists in `apps/api`. At Cloud scale,
`/api/auth/login` and `/api/auth/signup` are the obvious first targets
(credential stuffing, signup spam creating throwaway companies). Add
per-route limits on auth endpoints at minimum before wide Cloud availability;
On-Premise installs are lower-risk (single known tenant) but the same
middleware doesn't hurt there either.

### 3.3 Health check doesn't verify dependencies
`GET /health` returns a static `{status:"OK"}` regardless of whether Postgres
or Redis are actually reachable — it only logs a successful connection once
at boot (`bootstrap()`). A load balancer / orchestrator using `/health` for
readiness won't detect a container that booted fine but later lost its DB
connection. **Fix**: have `/health` (or a separate `/ready`) actually query
`SELECT 1` and ping Redis, cheaply, per request or on a short cache.

### 3.4 Socket.IO has no Redis adapter — breaks realtime beyond one API instance
`core/realtime/socket.ts`/`bus.ts` use the in-process Socket.IO server
directly; there's no `@socket.io/redis-adapter` wiring. `emitToRoom`/
`emitToUser` only reach sockets connected to **the same process**. This is
silently fine today because there's one API container — but it means the API
**cannot be horizontally scaled** without breaking realtime features (board
collaboration, chat, live notifications, telematics pushes) for any user whose
socket lands on a different instance than the one that emitted the event.
Add the Redis adapter (Redis is already a dependency everywhere else) before
running more than one API replica in Cloud. On-Premise is far less likely to
need multiple API replicas, so this is a Cloud-priority item specifically.

### 3.5 Migration runner gap applies equally here
`on-premise-deployment.md` §6 covers this in depth — worth repeating that it's
**not** an On-Premise-only problem. Cloud today applies new migrations by an
engineer running `psql` by hand against the production database per
`docs/DEPLOYMENT.md`'s documented process. The same runner fixes both; build
it once (`on-premise-deployment.md` §6.1 build order already reflects this —
migration runner is prioritised ahead of the On-Prem-specific installer work
for exactly this reason).

---

## 4. Scaling shape (for when it's needed — not urgent today)

Not a current bottleneck, but worth recording so Cloud isn't architected into a
corner:

- **API**: stateless except for §3.4's Socket.IO limitation — fix that first,
  then horizontal scaling behind a load balancer is straightforward (JWT auth
  needs no sticky sessions).
- **Frontends**: standalone Next.js output is already container-friendly and
  stateless; scale trivially.
- **Matching engine** (`services/matching-engine`, FastAPI): currently a
  single container per `docker-compose.yml`; check its own state assumptions
  before assuming it scales horizontally without work — out of scope to verify
  here, flag for its own look when Cloud load requires it.
- **Workers** (`workers/matchingJob.ts`, `workers/telematics.worker.ts`, the
  future KPI scheduler from `kpi-engine.md` §6.1): BullMQ workers already
  scale horizontally by running more worker processes against the same Redis
  queue — no changes needed there.

---

## 5. What Cloud needs that On-Premise doesn't: Vectra's own subscription billing

The business plan's revenue model (Steber A) — per-seat licensing, paid module
add-ons, a Vectra AI hosted subscription (`ai-integration.md` §6.3), App Store
revenue share — requires **Vectra charging tenants**, which is entirely
separate from the `billing`/`invoicing` domain that already exists (that's
tenants charging *their* freight clients). No Stripe/payment-provider
integration exists for this today. This is Cloud-only work — an On-Premise
customer is invoiced out-of-band (a sales/license agreement), not metered
through the app. Scope this as its own spec (`billing-and-seats.md`) rather
than folding it in here; noted so it isn't lost while On-Premise is the
current focus.

---

## 6. Do / Don't

**Do**
- Treat Cloud as `DEPLOYMENT_MODE=cloud` + subdomain env vars set — not a
  different codebase or a different auth mechanism.
- Fix §3.1–§3.4 before scaling Cloud to real multi-tenant traffic; they're
  cheap and currently silent failure modes, not theoretical.
- Build the migration runner once (`on-premise-deployment.md` §6.1) — it
  serves both deployment targets identically.
- Move file uploads to object storage before running more than one API
  replica (§2).

**Don't**
- Don't assume Cloud is "done" because subdomain SSO already works — the
  gaps in §3 are real and currently unaddressed.
- Don't build Vectra's own subscription billing inside the existing
  `billing`/`invoicing` domain — that domain is tenant-facing, keep them
  separate.
- Don't scale the API to multiple replicas before §3.4 (Socket.IO Redis
  adapter) — realtime features will silently degrade for a subset of users.
