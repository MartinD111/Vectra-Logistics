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
(required so `packages/*` are available), producing a Next.js standalone bundle:

```bash
docker build -f apps/marketplace/Dockerfile -t vectra-marketplace .
docker build -f apps/workspaces/Dockerfile  -t vectra-workspaces  .
docker build -f apps/cmr/Dockerfile         -t vectra-cmr         .
docker build -f apps/api/Dockerfile         -t vectra-api         ./apps/api
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

## Database migrations

`docker compose` applies `database/init.sql`, `extensions.sql`, and the numbered
files in `database/migrations/` (002 realtime/documents, 003 workspaces/presets)
on first Postgres init. For an existing database, apply new migrations manually:

```bash
psql "$DATABASE_URL" -f database/migrations/003_workspaces_and_presets.sql
```

Migration 003 seeds five example workspace-type presets (`is_system_seed`).
These are editable tenant data, not platform logic — a tenant may clone, edit,
or delete them.
