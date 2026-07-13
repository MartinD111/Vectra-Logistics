# Deployment & Topology

Vectra is a monorepo (npm workspaces) that ships **three independently
deployable frontends** sharing **one backend API** and a set of shared packages.

```
apps/marketplace  → Vectra Marketplace   (Next.js, port 3000)
apps/workspaces   → Vectra Workspaces    (Next.js, port 3001)
apps/cmr          → Vectra CMR Manager   (Next.js, port 3002)
apps/api          → Express API          (port 8080, shared by all three)
packages/*        → ui, auth, api-client, data, types, config (shared)
```

## Local development

Everything runs from the repo root via Docker Compose:

```bash
cp .env.example .env      # then edit secrets
docker compose up --build
```

| Service        | URL                     |
|----------------|-------------------------|
| Marketplace    | http://localhost:3000   |
| Workspaces     | http://localhost:3001   |
| CMR Manager    | http://localhost:3002   |
| API            | http://localhost:8080   |
| Matching engine| http://localhost:8001   |
| Postgres       | localhost:5433          |
| Redis          | localhost:6380          |

The frontends share one dev image (`Dockerfile.web.dev`, built from the repo
root so workspace packages resolve); each service overrides the command with its
own `npm run dev:<app>`. To run a single app outside Docker:

```bash
npm install            # once, at the repo root
npm run dev:workspaces # or dev:marketplace / dev:cmr / dev:api
```

## Production images

Each app has its own multi-stage `Dockerfile` built **from the repo root**
(required so `packages/*` are available), producing a Next.js standalone bundle.
Pass the repo's `VERSION` file as a build arg so the image is stamped with the
release it was built from:

```bash
export VERSION=$(cat VERSION)
docker build -f apps/marketplace/Dockerfile --build-arg VERSION="$VERSION" -t vectra-marketplace .
docker build -f apps/workspaces/Dockerfile  --build-arg VERSION="$VERSION" -t vectra-workspaces  .
docker build -f apps/cmr/Dockerfile         --build-arg VERSION="$VERSION" -t vectra-cmr         .
docker build -f apps/api/Dockerfile         --build-arg VERSION="$VERSION" -t vectra-api         ./apps/api
```

Standalone output is monorepo-aware via `outputFileTracingRoot` in each app's
`next.config.mjs`; the server entry lands at `apps/<app>/server.js`.

## Subdomain routing (production)

Map each app to a subdomain of one parent domain so the session cookie can be
shared (see SSO below):

| App          | Suggested host           |
|--------------|--------------------------|
| Marketplace  | `marketplace.vectra.app` |
| Workspaces   | `app.vectra.app`         |
| CMR Manager  | `cmr.vectra.app`         |
| API          | `api.vectra.app`         |

Set these per-app env vars (used by the app-switcher and cross-app links):

```
NEXT_PUBLIC_API_URL=https://api.vectra.app
NEXT_PUBLIC_MARKETPLACE_URL=https://marketplace.vectra.app
NEXT_PUBLIC_WORKSPACES_URL=https://app.vectra.app
NEXT_PUBLIC_CMR_URL=https://cmr.vectra.app
```

## Single sign-on (SSO)

One login flows through all three surfaces. The JWT is stored in a cookie by
`@vectra/auth`:

- **Dev:** host-only cookie on `localhost`, shared across ports 3000/3001/3002.
  A `localStorage` mirror is kept as a fallback.
- **Production:** set `NEXT_PUBLIC_COOKIE_DOMAIN=.vectra.app` (note the leading
  dot) so the cookie is shared across all subdomains. The cookie is marked
  `secure` automatically over HTTPS.

On load each app calls `GET /api/auth/me` to validate the session server-side
rather than trusting a client-decoded token. Logging out anywhere clears the
shared cookie, logging the user out everywhere.

## Upgrading a running install

First-run and upgrade share the same migration path: a `schema_migrations`
tracking table plus `npm run migrate` (`apps/api/src/scripts/migrate.ts`)
applies pending numbered files from `database/migrations/` in order,
idempotently, recording each as it runs. There is no manual per-file `psql`
step — see `CHANGELOG.md` for what shipped in each release.

1. **Pull the new release.** `git fetch --tags` then `git checkout vX.Y.Z`
   (check `CHANGELOG.md` for the latest tag/section).
2. **Rebuild the images stamped with the new version.** Export the `VERSION`
   env var from the repo's `VERSION` file, then build:
   ```bash
   export VERSION=$(cat VERSION)
   docker compose -f docker-compose.prod.yml build
   ```
   (`VERSION` is passed as a build arg into all 4 images.)
3. **Run pending migrations before restarting.**
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api npm run migrate
   ```
   This is the same runner used on first-run, idempotent, and safe to run
   even when there are zero pending files.
4. **Restart the stack on the new images.**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
5. **Confirm the upgrade.**
   ```bash
   curl https://<your-api-host>/health
   ```
   Check the returned `version` field matches the tag checked out in step 1.

## Outlook / Microsoft 365 integration

The Outlook connector links a company mailbox so programs and automations can
read and send mail. It runs in two modes:

- **Demo mode (default):** with no Microsoft credentials set, clicking *Connect
  Outlook* simulates a successful link (marked `DEMO` in the UI). The whole
  flow, status, and disconnect work — useful for development and demos.
- **Live mode:** set the `MS_*` env vars and the same *Connect* button starts the
  real Microsoft OAuth sign-in.

### Enabling live mode

1. In the [Azure / Entra admin center](https://entra.microsoft.com) → **App
   registrations** → **New registration**.
2. Set a **Redirect URI** (Web) to your API callback:
   `https://api.your-domain/api/v1/outlook/callback`
   (dev: `http://localhost:8080/api/v1/outlook/callback`).
3. Under **Certificates & secrets**, create a **client secret**.
4. Under **API permissions**, add Microsoft Graph **delegated** permissions:
   `Mail.Read`, `Mail.Send`, `offline_access`, `openid`, `profile`, `email`.
5. Set the API env vars (see `.env.example`):
   ```
   MS_CLIENT_ID=<application (client) id>
   MS_CLIENT_SECRET=<client secret value>
   MS_REDIRECT_URI=https://api.your-domain/api/v1/outlook/callback
   MS_TENANT=common            # or your tenant id for single-tenant
   WORKSPACES_APP_URL=https://app.your-domain
   ```

Tokens are stored per-company in `integration_credentials` (encrypt this column
at rest in production — CLAUDE.md §8). The OAuth `state` is a short-lived signed
JWT that carries the company id through the round-trip and is validated on the
callback, which is otherwise unauthenticated.
