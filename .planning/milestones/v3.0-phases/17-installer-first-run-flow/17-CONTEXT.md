# Phase 17: Installer / First-Run Flow - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A one-shot installer flow that takes a fresh checkout to a running, secured instance: generate `JWT_SECRET`/`ENCRYPTION_KEY`, create exactly one company + one real admin account, run the Phase 15 migration runner, optionally wire a local Gemma/Ollama endpoint into `company_ai_config`, and write `DEPLOYMENT_MODE=on-prem`. Phase 15 (migration runner) and Phase 16 (`DEPLOYMENT_MODE` read/gate, `docker-compose.prod.yml`) are dependencies, already built — this phase is the orchestration that calls them, not a rebuild of either.

</domain>

<decisions>
## Implementation Decisions

### Local AI step validation (the only area discussed this session)
- **D-01:** The installer test-connects to the customer-provided Gemma/Ollama endpoint before writing it into `company_ai_config` — it does not blindly trust whatever URL is typed.
- **D-02:** The probe is basic reachability only (e.g. an HTTP GET against something like Ollama's `/api/tags` or a root ping) — confirms something is listening, not that a specific model is loaded or answering. A full completion round-trip was explicitly rejected as slower and more failure-prone (model-name typos, cold-start timeouts).
- **D-03:** If the probe fails (endpoint unreachable), the installer warns clearly but still writes the value and continues — it does not block. Rationale: the customer's Ollama box may not be up yet or networking may still be getting configured; a hard block could trap the installer mid-run for something that resolves itself minutes later.
- **D-04:** The entire local-AI step is skippable — the customer can decline it entirely during install and configure AI later from the existing Settings UI. This matches the spec's §5.4 framing as an "optional step"; `company_ai_config` already supports being unset, so no special-casing is needed for the skip path.

### Claude's Discretion
Every other gray area for this phase was explicitly left unselected by the user and is Claude's/researcher's/planner's call:
- **Interaction mode** — interactive prompts (readline) vs. scripted/flag-driven vs. both. Spec §5 allows either ("interactive (or scripted, non-interactive-with-flags for automated installs)").
- **Invocation mechanism & secrets handling** — how the installer is run (e.g. reusing the `migrate.ts`/`docker compose run --rm api node dist/scripts/install.js` pattern) and whether it writes directly to `.env` vs. prints values for the customer to paste in.
- **Re-run / idempotency behavior** — what happens if the installer runs against a DB that already has a company/admin (hard error vs. skip vs. confirm-to-reset).
- **The base-schema gap (found during scouting, not user-decided):** `apps/api/src/scripts/migrate.ts` only applies numbered files in `database/migrations/` (002+). The original base schema (`database/init.sql`, `database/extensions.sql` — companies/users/etc. tables) has never been migration `001`; dev compose still mounts it via `docker-entrypoint-initdb.d`, but `docker-compose.prod.yml` (Phase 16) dropped all initdb mounts. On a genuinely fresh production Postgres volume, running `npm run migrate` alone will fail (e.g. `005_ai_config.sql`'s `company_ai_config` references `companies(id)`, which won't exist). The installer's "runs the migration runner so the schema is current" success criterion (ROADMAP #3) cannot be satisfied without resolving this. This is a technical gap for the researcher to confirm and the planner to resolve (e.g., folding `init.sql`/`extensions.sql` into the runner as an implicit first step, or having the installer apply them explicitly before calling `npm run migrate`) — not a user preference call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Installer / first-run design (primary spec for this phase)
- `docs/specs/deployment/on-premise-deployment.md` §5 ("Installer / first-run flow (net-new)") — the authoritative design: §5.1 secrets generation (reuse `secretBox.ts`'s documented `randomBytes(32)` command, never ship a working fallback), §5.2 single company + real admin (interactive or scripted-with-flags), §5.3 apply schema via the migration runner, §5.4 optional local AI provider wiring, §5.5 write `DEPLOYMENT_MODE=on-prem`. This phase implements §5 exactly.
- `docs/specs/deployment/on-premise-deployment.md` §3 (secrets/credentials issues) and §4.2 (`DEPLOYMENT_MODE` semantics) — background for why secrets must never have a working fallback and what `on-prem` mode gates.
- `docs/specs/architecture-steering.md` — CLAUDE.md-referenced architecture pattern this phase must stay consistent with (env-driven `DEPLOYMENT_MODE`, no business-logic branching on it beyond selection).

### Adjacent specs (context, not this phase's scope)
- `docs/specs/deployment/release-and-migrations.md` §5 — the 5-step upgrade procedure the migration runner enables; installer's first-run path and upgrade path both go through the same runner.
- `.planning/phases/15-migration-runner/15-CONTEXT.md` — the migration runner this installer calls (`npm run migrate`); notes the pre-existing gap that `database/init.sql`/`database/extensions.sql` were never folded into numbered migrations (see Claude's Discretion above).
- `.planning/phases/16-production-compose-deployment-mode/16-CONTEXT.md` — `DEPLOYMENT_MODE` fail-fast validation pattern (D-02) to replicate for any new required env vars this installer introduces; confirms `docker-compose.prod.yml` has zero `docker-entrypoint-initdb.d` mounts, which is why the base-schema gap above is live in production.
- `.planning/PROJECT.md` §"v3.0 On-Premise GA" — milestone framing; INS-01/INS-02 requirement text.
- `.planning/REQUIREMENTS.md` lines 30-31 — INS-01, INS-02 requirement definitions.
- `.planning/ROADMAP.md` Phase 17 section — goal, dependencies (Phase 15, Phase 16), success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/core/crypto/secretBox.ts` (header comment, line ~9) — the exact `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` command to reuse verbatim for `ENCRYPTION_KEY`/`JWT_SECRET` generation (spec explicitly says "reuse it, don't invent a second method").
- `apps/api/src/scripts/migrate.ts` — the migration runner this installer must invoke (`npm run migrate`) as its schema-apply step (§5.3); also the closest existing pattern for how a one-shot ops script in this repo is structured (reuses `apps/api/src/core/db` pool, plain `pg`+`fs`, no framework, exits non-zero on failure).
- `database/migrations/017_seed_admin_user.sql` — the fixed-credentials seed this installer's real admin-creation step replaces for customer-facing installs (already hard-excluded from the runner per Phase 15 D-02; this phase's installer is the on-prem replacement path).
- `database/init.sql` (companies/users table definitions) — `companies(id, name, ...)` and `users(id, company_id, email, password_hash, first_name, last_name, role, ...)` — the exact columns the installer's company/admin creation step must populate. Password must be bcrypt-hashed (see `017_seed_admin_user.sql` for the hash format) — reuse `bcrypt` (already a dependency) rather than any new hashing approach.
- `database/migrations/005_ai_config.sql` — `company_ai_config(company_id, provider, model, api_key_enc, local_endpoint, local_model, ...)` — the exact table/columns the optional local-AI step (§5.4) writes to with `provider='local'`.

### Established Patterns
- Phase 14's `JWT_SECRET`/`ENCRYPTION_KEY` boot-time fail-fast validation — the "never ship a working fallback" discipline this installer's secrets-generation step must also honor (generate real random values, never a placeholder).
- Phase 15/16's numbered-script-with-`npm run <name>` convention (`migrate` in `apps/api/package.json` + root passthrough) — likely the pattern for however this phase names its own script (e.g. `install`/`setup`), pending the invocation-mechanism decision left to Claude's Discretion.

### Integration Points
- `apps/api/src/scripts/migrate.ts` invocation — the installer calls this (in-process or as a subprocess step) as part of its own flow, per §5.3.
- `.env` / `docker-compose.prod.yml`'s required env vars (`JWT_SECRET`, `ENCRYPTION_KEY`, `DEPLOYMENT_MODE`, `POSTGRES_*`, etc., all marked `:?required` with no defaults) — the installer's secrets/`DEPLOYMENT_MODE` output must satisfy exactly these required vars.

</code_context>

<specifics>
## Specific Ideas

No UI/UX surface — this is a CLI/ops tool, matching `migrate.ts`'s existing shape and the spec's "minimum viable installer" framing. The only concrete behavioral spec captured this session is the local-AI validation step (D-01–D-04 above); everything else about how the installer is packaged and invoked is open to standard/discretionary approaches informed by the Phase 15/16 patterns already in the repo.

</specifics>

<deferred>
## Deferred Ideas

- Backend-side local AI provider dispatch (`aiService.complete()` actually calling the local endpoint) — Phase 18 (Backend-side Local AI Provider). This phase only writes the config row; it doesn't make the AI feature work end-to-end.
- `VERSION` file / `CHANGELOG.md` / documented upgrade procedure — Phase 19 (Release Versioning & Upgrade Docs).
- Reverse-proxy / inbound-connectivity documentation — Phase 20 (Deploy Hardening + Connectivity Doc).

### Reviewed Todos (not folded)
None — `todo.match-phase 17` returned 0 matches; STATE.md's Pending Todos section is empty.

</deferred>

---

*Phase: 17-Installer / First-Run Flow*
*Context gathered: 2026-07-12*
