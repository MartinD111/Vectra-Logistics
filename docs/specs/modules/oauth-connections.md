# oauth-connections.md — Microsoft 365 / Outlook, Gmail, and the credentials layer

Scope: how Vectra connects to a tenant's own email/calendar provider —
`apps/api/src/domains/outlook`, the generic `integration_credentials` table it
shares with telematics providers, and Gmail, which the business plan lists
alongside Outlook (§3.4) but which **does not exist in code at all.** The
headline here is mostly good news: Outlook/M365 is one of the best-built
pieces of the whole codebase. This document explains why, flags what's
missing (Gmail, one dead table), and notes a real migration-tooling gap this
domain's schema exposed.

> Suggested location: `docs/specs/modules/oauth-connections.md`.
> Reads with: `on-premise-deployment.md` §3.3 (shared `JWT_SECRET` — see §5
> here), §6 (migration runner — see §2's addendum), `kpi-engine.md` §3.1 (the
> `outlook_calendar` evaluator consumes this domain's calendar sync),
> `cmr-workflow.md`/`procurement.md` (both reference the real Graph
> `sendMail` capability this domain enables via `campaigns.service.ts`).

---

## 1. Microsoft 365 / Outlook — a genuinely complete, well-built OAuth2 flow

`outlook.service.ts` implements the full authorization-code flow correctly,
not a partial version:
- **Authorize URL construction** with the right scopes (`openid profile email
  offline_access Mail.Read Mail.Send Calendars.Read`).
- **CSRF-safe state**: the OAuth `state` parameter is a **signed JWT**
  (`{ companyId, userId }`, 10-minute expiry) rather than an opaque or
  unsigned value — the callback verifies it before trusting which company a
  code belongs to.
- **Token exchange** against Microsoft's `/oauth2/v2.0/token` endpoint,
  correctly handling `access_token`/`refresh_token`/`expires_in`/`scope`.
- **Refresh-token rotation**: `ensureFreshToken` checks expiry with a 60-second
  buffer, refreshes via `grant_type: refresh_token`, and **persists the
  rotated token** (Microsoft may issue a new refresh token on each use — the
  code correctly falls back to the old one only if a new one isn't returned).
- **Best-effort mailbox address lookup** (`GET /me`) — non-fatal if it fails,
  connection still succeeds without an email label.
- **Demo mode**: when `MS_CLIENT_ID`/`MS_CLIENT_SECRET`/`MS_REDIRECT_URI`
  aren't all set, `beginConnect` immediately marks the mailbox "connected" in
  demo mode rather than attempting real OAuth — the exact same "always work
  without real credentials" philosophy documented throughout this codebase
  (`ai-integration.md` §4, `fleet.md` §5). **No code change is needed to go
  from demo to real** — just setting the three env vars switches the live
  path on, per the code's own comment pointing at `docs/DEPLOYMENT.md`.
- **`getFreshAccessToken`** is the clean integration point for any other
  domain that needs to call Graph directly: never throws, returns `null` on
  demo/disconnected/unrefreshable, so callers degrade gracefully instead of
  failing a whole flow — `campaigns.service.ts` uses exactly this for real
  Graph `sendMail` calls (the actual outbound-email mechanism documented in
  `cmr-workflow.md`/`procurement.md`).

This is the reference implementation to point to when building any other
OAuth2 integration in this codebase (Gmail, per §4, or anything else) — copy
this shape, don't design a new one.

### 1.1 Calendar sync
`syncCalendar` pulls a 44-day window (14 back, 30 forward) from
`GET /me/calendarview`, and does something specifically useful: it
**auto-categorises events to projects** by matching a Graph event's
`categories` field against the company's project names, case-insensitively —
so tagging an Outlook meeting with a category matching a Vectra project name
is enough to link it, no manual re-entry. This feeds directly into
`kpi-engine.md` §3.1's `outlook_calendar` evaluator (planned-vs-actual
staffing %) — the two were clearly designed together. Never throws into a
best-effort/scheduled caller; returns `{ synced: 0, skipped: reason }`
instead.

---

## 2. `integration_credentials` — the real, generic, multi-provider table (and a migration-tooling addendum)

Outlook and the fleet telematics providers (Samsara/Geotab, per
`on-premise-deployment.md` §7) **share one table**:
`integration_credentials (company_id, provider_id, credentials_json,
status, connected_at, last_sync_at, sync_error)`, `UNIQUE(company_id,
provider_id)`. `credentials_json` is encrypted at rest via the same
`secretBox` (AES-256-GCM) used for AI provider keys (`ai-integration.md`
§1) — one consistent secret-handling mechanism across the whole app, not a
per-domain reinvention. This is the right table for Gmail to slot into too
(§4) — `provider_id = 'gmail'`, same shape, no new table needed.

**Addendum to `on-premise-deployment.md` §6 and `release-and-migrations.md`**:
this table (along with `trailers`, `webhook_events`,
`company_trust_metrics`, `company_verification_checks`, and several `ratings`
columns) is defined in **`database/extensions.sql`**, not in the numbered
`database/migrations/` sequence. `docker-compose.yml` does mount it (as
`2-extensions.sql`, right after `init.sql`), so it runs correctly on a fresh
install — but the migration runner design in `on-premise-deployment.md` §6.1
was specified to scan `database/migrations/*.sql` only. **Either fold
`extensions.sql`'s contents into a proper numbered migration file, or
explicitly include it as a fixed pre-step in the runner** (applied once,
before the numbered sequence) — otherwise an upgrade path built purely
around the numbered folder silently misses it, and any *future* change to
one of the tables `extensions.sql` defines has nowhere idempotent to go
except editing that file directly, which the numbered-migration convention
was specifically designed to avoid.

---

## 3. Dead table: `oauth_connections`
`init.sql` defines `oauth_connections (user_id, provider, provider_user_id)`
with a comment listing `'google', 'microsoft', 'linkedin'` as example
providers — this reads like it was meant for **user-level social login**,
a different concept from the company-level `integration_credentials` mailbox
connection actually built. **Zero references anywhere in
`apps/api/src`** — confirmed by search. Same category of finding as
`marketplace-ltl.md` §2.4's `archive_logs`: dead schema left over from an
earlier design direction. Drop it or repurpose it deliberately (e.g. if
per-user social login is still wanted separately from the company-level
mailbox connection) — don't leave it as ambiguous, unused schema.

---

## 4. Gmail — not built, despite being named alongside Outlook in the business plan

Searched the entire backend and frontend for any Gmail reference — none
exists. No OAuth flow, no Gmail API calls, no `provider_id = 'gmail'` row
type, nothing. This is worth stating plainly rather than assuming partial
coverage, since business plan §3.4 lists Gmail alongside Outlook as a
communication channel and it's easy to assume "email integration" covers
both.

### Recommended build shape, if/when prioritised
**Don't copy-paste `outlook.service.ts` into a parallel `gmail.service.ts`.**
Roughly 80% of that file is generic OAuth2-with-refresh-and-demo-mode
mechanics that would be identical for Gmail with different endpoint URLs and
scopes; only the Microsoft-Graph-specific calls (`/me`, `/calendarview`, and
`campaigns.service.ts`'s `sendMail`) are provider-specific. Extract the
generic shape first:
- A shared `OAuthProviderConfig` (authorize URL template, token URL,
  client id/secret/redirect env var names, scopes) + a shared
  `beginConnect`/`handleCallback`/`ensureFreshToken` implementation
  parameterised by that config — Outlook and Gmail both become thin
  provider-specific configs plus a small set of API-shape adapters
  (fetch calendar events, send mail, fetch profile), not two independent
  1:1 reimplementations of token lifecycle management.
- Gmail-specific pieces to adapt: Google's OAuth endpoints
  (`accounts.google.com/o/oauth2/v2/auth`, `oauth2.googleapis.com/token`),
  Gmail API scopes (`gmail.readonly`, `gmail.send`, `calendar.readonly`
  equivalent to Outlook's `Mail.Read`/`Mail.Send`/`Calendars.Read`), and the
  Gmail/Calendar API's different event/message shapes feeding the same
  `calendar_events`/campaign-sending consumers.
- Store credentials in the same `integration_credentials` table
  (`provider_id = 'gmail'`) — no schema change needed (§2).
- Keep the same demo-mode-when-unconfigured fallback — consistent with every
  other integration in this codebase.

---

## 5. Security note: OAuth state shares `JWT_SECRET` with session auth
`outlook.service.ts` signs/verifies the OAuth `state` parameter with the same
`JWT_SECRET` used for user session tokens (`core/auth/middleware.ts`). This is
a reasonable reuse of one secret rather than inventing a second, but it means
`on-premise-deployment.md` §3.3's finding (`JWT_SECRET` has a weak committed
default: `vectra-dev-secret-key-change-in-production`) has a second
consequence beyond session forgery: a default/weak `JWT_SECRET` would also let
an attacker forge a valid OAuth `state`, though the practical impact is
narrower (state only carries `companyId`/`userId` for linking the callback,
not a standalone auth bypass). Fixing §3.3's root cause (installer-generated
secrets, no usable production default) resolves this too — no separate fix
needed here, just noting the dependency explicitly.

---

## 6. Do / Don't

**Do**
- Use `outlook.service.ts`'s OAuth2 flow (state-signing, refresh rotation,
  demo-mode fallback, never-throw token accessor) as the template for any new
  provider integration.
- Store any new provider's credentials in `integration_credentials` —
  it's already generic and correctly encrypted.
- Fold `extensions.sql` into the numbered migration sequence or explicitly
  account for it in the migration runner (§2) before relying on that runner
  for upgrades.
- Extract the generic OAuth2 mechanics before building Gmail, rather than
  duplicating Outlook's file.

**Don't**
- Don't describe Gmail as supported anywhere customer-facing — it isn't,
  today, at all.
- Don't leave `oauth_connections` as ambiguous dead schema — decide and act.
- Don't build a second encryption or credential-storage mechanism for a new
  provider — reuse `secretBox` + `integration_credentials`.
- Don't assume the migration runner (`on-premise-deployment.md` §6.1) already
  covers `extensions.sql` — it doesn't, unless explicitly fixed per §2.
