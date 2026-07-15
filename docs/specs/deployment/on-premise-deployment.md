# on-premise-deployment.md — On-Premise deployment target

Scope: making Vectra installable and self-operable at a customer's own site, as
a first-class configuration of the **same codebase** used for Cloud (per
`CLAUDE.md` §2: one codebase, one deployment-mode toggle, never a fork). This
documents what the current deployment tooling actually does, then specifies
exactly what's missing to ship On-Premise — including three concrete security
issues found in the current setup that must be fixed before any customer
install, not just "gaps" to plan around.

> Suggested location: `docs/specs/deployment/on-premise-deployment.md`.
> Reads with: `CLAUDE.md` §2, `event-spine.md` §8, `ai-integration.md` §6.1/§8.

---

## 1. What already exists

- `docker-compose.yml` (repo root) — a full local stack: Postgres 15, Redis 7,
  the API, the Python matching engine, and all three Next.js frontends. This is
  **dev-mode only** today (`command: npm run dev`, bind-mounted source, no
  production compose file exists yet — see §4.1).
- Per-app **production** Dockerfiles already exist and build standalone
  multi-stage images: `apps/api/Dockerfile`, `apps/marketplace/Dockerfile`,
  `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile`, built from the repo root
  per `docs/DEPLOYMENT.md`. These are the right artifacts — they're just not
  assembled into one deployable unit yet.
- `.env.example` — the full config surface: Postgres/Redis connection,
  `JWT_SECRET`, `ENCRYPTION_KEY`, Outlook OAuth vars, per-app public URLs,
  `NEXT_PUBLIC_COOKIE_DOMAIN`.
- Auth/session mechanism (`packages/auth/src/session.ts`) — **this is more
  On-Premise-friendly than earlier assumed.** Read this before treating
  auth/SSO as a blocker (see §2).
- `activity_events`/schema is already `company_id`-scoped throughout — an
  On-Prem install is simply "one company," no schema fork (confirmed in
  `event-spine.md`).

---

## 2. Auth/SSO — corrected assessment

Earlier discussion treated subdomain-based SSO as a hard cloud-only assumption.
Having read `packages/auth/src/session.ts`, the actual mechanism is more
flexible than that:

- The session token is stored in a **client-side cookie set by the frontend**
  (`document.cookie`, not a server-set `httpOnly` cookie), with a **`domain`
  attribute added only if `NEXT_PUBLIC_COOKIE_DOMAIN` is set.**
- When unset (the default/dev case), the cookie is **host-only**, which already
  works correctly for a single host serving all three apps on different ports —
  exactly the shape a typical On-Premise install takes. A `localStorage` mirror
  is kept as a fallback "for environments where cookies are unavailable."
- The **backend never uses the cookie** — `authenticateToken` middleware reads
  a `Bearer` JWT from the `Authorization` header only (`core/auth/
  middleware.ts`). The cookie is purely how the three frontends share the token
  with each other; the API is stateless JWT auth throughout.

**Conclusion: no auth rework is required for On-Premise.** Simply leave
`NEXT_PUBLIC_COOKIE_DOMAIN` unset for On-Prem installs (host-only cookie,
same as dev) unless a customer specifically fronts the three apps on real
subdomains, in which case set it to their internal parent domain exactly as
production Cloud does. This removes what was previously flagged as the
biggest architectural risk — treat it as resolved, not open.

---

## 3. Security issues to fix before any customer install (not "gaps" — fix first)

Three concrete problems exist in the current setup that must not ship to a
customer, On-Premise or otherwise:

### 3.1 Hardcoded fallback `ENCRYPTION_KEY` in `docker-compose.yml`
```yaml
ENCRYPTION_KEY=${ENCRYPTION_KEY:-204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20}
```
This default is committed in the repo and used whenever `ENCRYPTION_KEY` isn't
set in the environment. Since this key encrypts AI provider keys and other
integration secrets at rest (`secretBox.ts`), **every install that doesn't
override it shares the same encryption key** — a real vulnerability, not a
theoretical one. The On-Prem installer (§5) must generate a fresh key and there
must be no usable fallback default in any production-facing compose file.

### 3.2 Seeded default admin credentials
`database/migrations/017_seed_admin_user.sql` inserts `admin@admin.com` /
password `admin` (bcrypt-hashed) `ON CONFLICT DO NOTHING` — and because
`docker-compose.yml` mounts every migration file as a Postgres
`docker-entrypoint-initdb.d` script, **this runs automatically on every fresh
install**, dev or otherwise. This must not exist in any customer-facing
migration path. Either exclude this migration from production/On-Prem
provisioning entirely, or replace it with the installer's own interactive
admin-creation step (§5.2) — never a fixed known password.

### 3.3 Hardcoded fallback `JWT_SECRET`
`core/auth/middleware.ts`: `process.env.JWT_SECRET || 'super-secret-key-for-dev'`
and `docker-compose.yml`'s own default (`vectra-dev-secret-key-change-in-
production`) are both weak, guessable fallbacks that let the server boot and
issue/verify tokens even when misconfigured. Same fix as §3.1: the installer
must generate a real secret; production code should arguably refuse to start
without one set, rather than silently falling back.

---

## 4. Deployment mode toggle (`CLAUDE.md` §2 pattern)

### 4.1 Missing: a production compose artifact
No file today assembles the four production Dockerfiles + Postgres + Redis
into one runnable stack — `docker-compose.yml` is dev-only. On-Premise needs a
`docker-compose.prod.yml` (or equivalent) that:
- Builds/pulls the four **production** images (multi-stage, standalone Next.js
  output per `docs/DEPLOYMENT.md`'s build commands), not the dev images.
- Has no bind-mounted source, no `npm run dev`.
- Reads all secrets from environment/`.env`, with **no usable committed
  defaults** (§3).
- Keeps Postgres/Redis as local containers with persistent volumes (already
  the right shape in the dev compose — reuse that part).

### 4.2 `DEPLOYMENT_MODE` env var
Introduce `DEPLOYMENT_MODE=cloud|on-prem`, read once at API boot, exactly as
scoped in `CLAUDE.md` §2.1. Concrete uses once it exists:
- Gate the seeded-admin migration (§3.2) and any other dev-only seed data
  behind `on-prem` **not** running them automatically — installer creates the
  real admin instead.
- Select whether registration is open (Cloud: sign up creates a new company) or
  closed after first-run (On-Prem: exactly one company, created by the
  installer — see §5.2).
- Optionally gate the local-provider backend AI path from
  `ai-integration.md` §6.1, which is On-Premise-relevant specifically.

No code path should branch on `NODE_ENV` for this — `DEPLOYMENT_MODE` is a
distinct axis (an On-Prem install can still run `NODE_ENV=production`).

---

## 5. Installer / first-run flow (net-new)

Nothing here exists yet. Minimum viable installer, run once against a fresh
stack:

### 5.1 Secrets generation
Generate `JWT_SECRET` and `ENCRYPTION_KEY` locally (the repo already documents
the exact command for the latter: `node -e "console.log(require('crypto').
randomBytes(32).toString('hex'))"` from `secretBox.ts`'s own header comment —
reuse it, don't invent a second method) and write them into the customer's
`.env`. Never ship a working fallback for either (§3.1, §3.3).

### 5.2 Single company + real admin
Replace `017_seed_admin_user.sql`'s fixed credentials with an interactive (or
scripted, non-interactive-with-flags for automated installs) step: prompt for
company name + admin email + admin password, create one `companies` row and
one `users` row with `role='admin'`. This becomes the on-prem install's only
tenant, consistent with the "one company, no schema fork" principle.

### 5.3 Apply schema
Run the migration runner (§6) against a fresh database rather than relying on
Postgres `docker-entrypoint-initdb.d` (which only fires once, on an empty
volume, and provides no record of what's applied — see §6's problem
statement).

### 5.4 Choose AI provider (optional step)
If the customer has a local Gemma/Ollama endpoint reachable from the server,
let the installer write it into `company_ai_config` directly (`provider:
'local'`) — ties into `ai-integration.md` §6.1's planned backend-local path so
an On-Prem install can be AI-capable end-to-end from first boot without a
manual Settings trip.

### 5.5 Set `DEPLOYMENT_MODE=on-prem`
Written to `.env` alongside the generated secrets.

---

## 6. The central gap: there is no migration runner

This is the most important operational gap for On-Premise and deserves to be
treated as such, not bundled into "polish."

**Current reality**, confirmed directly from the repo:
- On a **fresh** database, `docker-compose.yml` mounts every migration file
  (002 through 020, plus `init.sql`/`extensions.sql`) as numbered
  `docker-entrypoint-initdb.d` scripts. Postgres runs these **once**, only when
  the data volume is first created.
- For an **existing** database (i.e. any upgrade), `docs/DEPLOYMENT.md`
  documents a fully manual process: `psql "$DATABASE_URL" -f database/
  migrations/013_page_header.sql`, repeated by hand per migration, per install,
  by whoever operates the deployment. There is no tracking of which migrations
  a given database has already applied — correctness depends entirely on the
  operator remembering, and the files being idempotent (`CREATE TABLE IF NOT
  EXISTS`, etc. — which they are, so partial safety exists, but no
  automation).
- No `schema_migrations`-style tracking table exists anywhere in the schema.

This is fine for a single Cloud database an engineer controls by hand. It is
**not viable** for On-Premise, where customers or their IT partners must
self-service upgrade without running individual `psql` commands correctly in
order, and where "did this install apply migration 017?" needs a real answer.

### 6.1 What to build
A small migration runner (this does not need a heavy framework — a ~50-line
script fits the existing style):
- A `schema_migrations` table (`filename TEXT PRIMARY KEY, applied_at
  TIMESTAMPTZ`).
- On boot (or via an explicit `npm run migrate` in `apps/api`), read
  `database/migrations/*.sql` in numeric order, skip any filename already
  recorded, run the rest inside a transaction each, record success.
- Since every existing migration is already written idempotently (the repo's
  own convention — "Idempotent" is stated in every migration's header
  comment), this runner is close to a no-op safety net today; its real value
  is **making upgrades a single command** (`docker compose run api npm run
  migrate` or an entrypoint step) instead of manual `psql` invocations, and
  giving a real answer to "what version is this database at."
- Drop the `docker-entrypoint-initdb.d` mounts from the production compose
  (§4.1) in favour of this runner running as an explicit step before the API
  starts — keeps first-run and upgrade on the exact same code path, which the
  current dual mechanism (initdb vs. manual psql) does not.

### 6.2 Versioned releases
Once the runner exists, an On-Prem release is: a set of tagged Docker images
(one per app + API) + whatever new files landed in `database/migrations/`
since the last release. A customer/partner upgrade = pull new image tags, run
the migration step, restart. Document this as the standard upgrade procedure
once §6.1 ships.

---

## 7. Inbound connectivity — real dependencies, not hypothetical

Earlier discussion flagged "webhooks may need inbound reachability" generically.
The actual dependencies, found in code:

- **Telematics webhooks are real and HMAC-verified**: `POST /api/webhooks/
  samsara` and `/api/webhooks/geotab` (`routes/webhookRoutes.ts`,
  `verifySamsaraSignature`/`verifyGeotabSignature`) — Samsara/Geotab push GPS
  events to Vectra. If a customer uses either provider, their server **must**
  be reachable from that provider's cloud. No polling alternative exists today.
- **POD upload is deliberately public**: `/api/pod/*`
  (`pod.public.routes.ts`) is explicitly mounted **without**
  `authenticateToken` — a driver's phone hits a single-use token link to
  upload a signed CMR photo. This is often used **from the road**, not from
  the customer's LAN, so it inherently needs public reachability regardless of
  deployment mode — an On-Prem install that sits fully behind a firewall with
  no public ingress breaks this specific feature.
- **Outlook OAuth callback** (`GET /outlook/callback`, unauthenticated by
  design since Microsoft redirects the browser here) needs to be reachable by
  whichever browser is completing the login — not necessarily the public
  internet, but it must resolve for that user's network context (fine if the
  admin configuring Outlook is on the customer LAN/VPN at setup time; breaks if
  they're external and the install has no public DNS/ingress at all).

**On-Prem posture to document for the customer, not solve in code:** a fully
air-gapped/no-public-ingress install loses telematics webhooks and public POD
upload links. The realistic middle ground — and what the installer/docs should
recommend — is a reverse proxy that exposes **only** `/api/webhooks/*` and
`/api/pod/*` publicly while keeping everything else LAN/VPN-only. This is a
configuration/documentation decision per install, not a code change; don't
build a polling fallback for Samsara/Geotab speculatively — only if a real
customer install needs full air-gap and this becomes a blocker.

---

## 8. Licensing / activation — explicitly not built, scope only

No mechanism exists to gate seats/modules on an On-Premise install without a
permanent connection to Vectra's cloud. This is real net-new work, out of
scope for this document to design in full — noting it here so it isn't lost:
whatever shape it takes (offline license file + periodic soft-check, hardware
fingerprint, etc.), it must not require constant connectivity, consistent with
§7's air-gap-tolerance goal. Track as its own follow-up spec when prioritised.

---

## 9. Build order (suggested)

1. **Fix §3 immediately** (remove default `ENCRYPTION_KEY`/`JWT_SECRET`
   fallbacks from anything production-facing; stop auto-seeding
   `admin@admin.com`) — these are live issues, not On-Premise-specific, and
   should be fixed regardless of deployment target.
2. **Migration runner** (§6.1) — highest-leverage single piece of new
   infrastructure; unblocks real upgrades for Cloud too, not just On-Prem.
3. **Production compose file** (§4.1) assembling the existing per-app
   Dockerfiles.
4. **Installer script** (§5) — secrets gen, single-company/admin creation,
   run migrations, optional local AI config, write `DEPLOYMENT_MODE=on-prem`.
5. **`DEPLOYMENT_MODE` gating** (§4.2) in application code where it actually
   changes behaviour (registration flow, seed data).
6. Document the §7 reverse-proxy posture for customers; build nothing extra
   unless a real install needs it.
7. Licensing (§8) — later, separately scoped.

---

## 10. Do / Don't

**Do**
- Treat auth/cookie behaviour as already On-Premise-compatible (§2) — don't
  rebuild it.
- Fix the three committed secrets/credentials issues (§3) before any customer
  sees a build, independent of the On-Premise timeline.
- Build one migration runner used by both first-run and upgrades — not two
  mechanisms.
- Document the inbound-connectivity tradeoffs (§7) rather than trying to
  eliminate them in code.

**Don't**
- Don't add a second auth system "for On-Premise" — same JWT/cookie mechanism,
  just `NEXT_PUBLIC_COOKIE_DOMAIN` left unset.
- Don't leave any production-facing default for `ENCRYPTION_KEY`/`JWT_SECRET`.
- Don't let `017_seed_admin_user.sql`-style seed data run automatically outside
  local dev.
- Don't design licensing or the installer around requiring constant internet
  connectivity — that contradicts the on-premise value proposition.
