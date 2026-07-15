# release-and-migrations.md — Versioning & the On-Premise upgrade process

Scope: how a set of code + schema changes becomes a **releasable, versioned
unit**, and the concrete procedure an On-Premise customer or their IT partner
follows to upgrade. This is the layer **on top of** the migration runner —
it does not redesign that mechanism, it assumes it exists and defines
everything around it: version numbers, release artifact composition, the
upgrade procedure, and the rollback story.

> Suggested location: `docs/specs/deployment/release-and-migrations.md`.
> **Prerequisite**: `on-premise-deployment.md` §6 (the migration runner design
> — `schema_migrations` tracking table, `npm run migrate`). This document is
> meaningless without that runner existing first; it's explicitly build-order
> item #2 in that document for this exact reason.
> Reads with: `cloud-deployment.md` §3.5 (same runner serves both targets).

---

## 1. Current state — why this doesn't exist yet

Two things confirmed directly in the repo, both symptoms of the same gap
(the missing migration runner, per `on-premise-deployment.md` §6):

- **Package versions are inconsistent and unused as release identifiers.**
  Root `package.json` and `apps/api/package.json` are both `"1.0.0"`;
  `apps/marketplace`, `apps/workspaces`, `apps/cmr` are all `"0.1.0"`. Nothing
  in the codebase reads or bumps these — they're not wired to Docker image
  tags, not surfaced anywhere at runtime (`/health` doesn't report a version),
  and don't correspond to any changelog or tag. Treat them as **not
  meaningful today** — the versioning scheme in §2 replaces them, it doesn't
  reconcile them.
- **No `CHANGELOG.md` exists anywhere in the repo.**

Every migration file, however, already follows a clean, strictly linear
convention worth preserving exactly as-is:

```
-- Migration: <what it does>. Apply after <previous filename's number>. Idempotent.
```

e.g. `004_projects_and_programs.sql` → "Apply after 003", `020_ltl_matching.sql`
→ "Apply after 019". This is a real, already-followed discipline — the
numeric filename order *is* the dependency order, every migration is written
defensively (`CREATE TABLE IF NOT EXISTS`, etc.), and nothing here needs
fixing. The release process in this document is built to preserve this
convention, not replace it.

One migration breaks pattern and needs special handling in the release
process specifically: `017_seed_admin_user.sql` has no "Apply after N" phrasing
and, per `on-premise-deployment.md` §3.2, must **not** run automatically in
any customer-facing install (it seeds `admin@admin.com`/`admin`). The release
packaging step (§4) must exclude it from what ships to customers, not just
leave it in the folder and hope `DEPLOYMENT_MODE` gating catches it.

---

## 2. Versioning scheme

Adopt **one version number for the whole release**, not per-package versions.
A release is the API + all three frontends + whatever new migrations shipped
together — customers upgrade the platform, not individual apps.

- **Format**: `MAJOR.MINOR.PATCH` (semver-ish), e.g. `v1.4.0`.
  - **PATCH**: bug fixes, no new migrations, no schema change.
  - **MINOR**: new features, may include new migration file(s) (purely
    additive — new tables/columns, per the existing idempotent-migration
    convention).
  - **MAJOR**: reserved for a breaking change to the config-JSON contracts
    that cross the wire today (`MiniProgramConfig`, `PageConfig`,
    `programs.config`, etc.) — none has happened yet; call this out
    deliberately if it ever does, since those shapes are relied on by
    `program-builder.md` and `workspace-blocks.md`'s "config is opaque JSONB"
    contract.
- **Where it lives**: a single `VERSION` file at repo root (or the root
  `package.json`'s `version`, repurposed as *the* release version rather than
  a meaningless default) — pick one source of truth and stamp it into every
  Docker image at build time (`LABEL version=` or a build arg baked into
  `/health`'s response, closing the "no version reported at runtime" gap
  noted in §1).
- **Git tag** `vMAJOR.MINOR.PATCH` on the commit a release is cut from —
  this is also what CI (once it exists) should key Docker image tags off of.

Don't tag/bump the four `apps/*/package.json` independently going forward —
they can stay in lockstep with the release version or be ignored; the
release version is the one customers and support conversations reference.

---

## 3. `CHANGELOG.md` — introduce one, tied to releases

None exists. Add `CHANGELOG.md` at repo root, one section per release version,
written for the audience that matters most here: **the person applying an
On-Premise upgrade**, not just engineers. Each entry should say, in plain
terms:
- What's new/changed (feature-level, not commit-level).
- **Whether this release includes new migrations** (yes/no — the upgrade
  procedure in §5 branches on this).
- Any manual step beyond "pull, migrate, restart" (should be rare — flag
  loudly if one exists, since the whole point of §5 is that it normally isn't
  needed).

Generate the migration-list part mechanically from filenames added in
`database/migrations/` since the previous tag — cheap, accurate, and it makes
the changelog and the actual migration runner agree by construction.

---

## 4. Release artifact composition

A release is:

1. **Four tagged Docker images**, built from the existing production
   Dockerfiles (`apps/api/Dockerfile`, `apps/marketplace/Dockerfile`,
   `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile`), tagged with the
   release version (`vectra-api:v1.4.0`, etc.) — same images Cloud runs,
   per `CLAUDE.md` §2's one-codebase rule; only the tag/cadence differs
   between Cloud and On-Premise (§6).
2. **Whatever new files landed in `database/migrations/`** since the last
   release — nothing else to package here; the runner (`on-premise-
   deployment.md` §6.1) picks up new files automatically by filename, so
   there's no separate "migration bundle" artifact to build, just: don't ship
   `017_seed_admin_user.sql` (§1) in the customer-facing image/repo checkout,
   and do include every other new numbered file.
3. **The `CHANGELOG.md` entry** (§3) for that version.

No separate installer version — the installer (`on-premise-deployment.md` §5)
is part of the image/release, versioned the same way.

---

## 5. The On-Premise upgrade procedure

This is what a customer or their IT partner actually runs. It assumes
`on-premise-deployment.md`'s migration runner and production compose file
exist.

```bash
# 1. Back up first — this is the real rollback mechanism (see §6).
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup-$(date +%F).sql

# 2. Pull the new release's images (or update the compose file's tags).
docker compose -f docker-compose.prod.yml pull

# 3. Apply any new migrations — the runner is idempotent and only applies
#    files not already recorded in schema_migrations, so this is safe to run
#    on every upgrade even when a release has no new migrations.
docker compose -f docker-compose.prod.yml run --rm api npm run migrate

# 4. Restart with the new images.
docker compose -f docker-compose.prod.yml up -d

# 5. Verify. Until cloud-deployment.md §3.3's real health check exists,
#    this step is a manual smoke test (log in, open a project page, check a
#    board) rather than a single command — call this out explicitly in
#    customer-facing upgrade docs so "the health check said OK" isn't
#    mistaken for a full verification.
```

Five steps, no bespoke per-migration commands (unlike today's documented
process of running individual `psql -f` commands by hand per
`docs/DEPLOYMENT.md`) — this is the concrete improvement the runner exists to
deliver. Once the runner ships, update/replace the manual `psql` instructions
in `docs/DEPLOYMENT.md`'s "Database migrations" section with this procedure so
there's one documented path, not two.

---

## 6. Rollback — be honest about the limitation

**There are no down-migrations.** Every migration in the repo is additive
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and none has a
reverse script. This means:

- **Rolling back code** (redeploying the previous image tags) is safe and
  cheap — stateless app code, no schema dependency in the wrong direction
  since migrations only add.
- **Rolling back schema is not supported.** If a migration needs to be undone,
  the real mechanism is restoring the §5-step-1 backup, not a scripted
  down-migration. Say this explicitly in customer-facing docs — don't imply a
  one-command schema rollback exists.
- Because migrations are additive-only, the practical risk is low (an
  unapplied new column/table just sits unused if you roll back app code
  without rolling back schema) — this is a reasonable tradeoff to keep stated
  as a deliberate design choice, not an oversight, as long as it's documented.

If a genuinely destructive migration is ever needed (dropping a column,
changing a type), treat it as an exception requiring a written rollback plan
in that migration's own header comment and in the changelog entry — the
default "just re-run the runner forward" story does not cover this case.

---

## 7. Cloud vs. On-Premise — same artifacts, different cadence

- **Cloud**: releases apply continuously/frequently; an engineer (or CI) runs
  essentially §5's steps 2–4 against the production environment shortly after
  a release is cut. No customer action.
- **On-Premise**: the customer/IT partner chooses when to apply a release,
  running §5 themselves, on their own schedule — this is why §3's changelog
  needs to be genuinely readable by them, not just an engineering log, and why
  §5's procedure needs to be copy-pasteable without Vectra staff present.
- Both consume the **same four images and the same migration files** — there
  is no separate On-Premise build, consistent with `CLAUDE.md` §2's one-
  codebase rule. Only what triggers the upgrade and who runs it differs.

---

## 8. Do / Don't

**Do**
- Version the release as one whole (API + 3 frontends + migrations), not per
  package.
- Keep every migration additive and idempotent, exactly as the existing
  convention already does — this is what makes forward-only rollback (§6)
  acceptable.
- Exclude `017_seed_admin_user.sql` from anything customer-facing.
- Write changelog entries for the person running the upgrade, not just for
  engineers.

**Don't**
- Don't build down-migrations as a first response to a bad schema change —
  document the backup-restore path instead (§6) unless a specific case truly
  needs one.
- Don't ship two upgrade documentation paths (the old manual `psql`
  instructions and this procedure) once the runner exists — replace, don't
  duplicate.
- Don't let `apps/*/package.json` versions drift further out of sync and treat
  them as meaningful — they aren't the release version (§2).
