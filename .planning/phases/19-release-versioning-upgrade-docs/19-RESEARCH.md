# Phase 19: Release Versioning & Upgrade Docs - Research

**Researched:** 2026-07-12
**Domain:** Release versioning, Docker image stamping, changelog generation, deployment documentation (no new runtime dependencies)
**Confidence:** HIGH

## Summary

This phase has no new third-party library surface — it's entirely repo conventions: a plaintext `VERSION` file, an `/health` field, a `CHANGELOG.md`, and a rewritten upgrade section in `docs/DEPLOYMENT.md`. All the mechanisms it depends on already exist and were verified directly in the repo: the Phase 15 migration runner (`apps/api/src/scripts/migrate.ts`), the Phase 16 production compose (`docker-compose.prod.yml`, 4 buildable app images + Postgres/Redis), and the existing `/health` route in `apps/api/src/server.ts`. Git tags `v1.0` and `v2.0` already exist at milestone boundaries, so a "one version per release" convention has an existing precedent to align with (`VERSION` file content ↔ git tag name).

The main technical wrinkle the planner must account for: **`docker-compose.prod.yml` builds the `api` image with build `context: ./apps/api`**, not the repo root, while the three frontend images (`marketplace`, `workspaces`, `cmr`) build with `context: .` (repo root). A root `VERSION` file is therefore directly `COPY`-able into the frontend images but NOT into `apps/api/Dockerfile` without either changing its build context or (recommended) passing the version as a Docker build `ARG` from a value the host shell reads out of the root `VERSION` file — sidestepping the context mismatch entirely and working uniformly across all four images.

**Primary recommendation:** Add a root `VERSION` file (plain semver string, no `v` prefix, matching git tag `vX.Y.Z`). Thread it into every image via `ARG VERSION` / `ENV VERSION=$VERSION` in each of the 4 app Dockerfiles, pass `--build-arg VERSION=$(cat VERSION)` (or `args: VERSION: ${VERSION}` in compose, sourced from a shell `export VERSION=$(cat VERSION)` step) at build time — this avoids any Dockerfile `COPY` of the file and works identically regardless of build context. `apps/api`'s `/health` reads `process.env.VERSION` at runtime with a dev-mode fallback that reads the root `VERSION` file directly (mirroring the existing `__dirname`-relative path pattern in `migrate.ts`) so local `npm run dev:api` still reports a real version without a Docker build.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version source of truth (`VERSION` file) | Build/Release tooling (repo root) | — | Not a runtime concern; read once at build time and at API boot |
| Version stamped into image | CDN/Static (Docker build) | — | Docker `ARG`/`ENV`/`LABEL` mechanism, not application code |
| Version reported by `/health` | API / Backend | — | `apps/api/src/server.ts` already owns `/health`; add one field |
| Changelog authoring | Build/Release tooling (docs) | — | Manual/scripted markdown generation, not a running service |
| Upgrade procedure | Database / Storage (migrations) + API / Backend (restart) | Docs | Documented operator runbook combining `npm run migrate` + compose restart |

## Standard Stack

No new packages are required for this phase. Everything is achievable with:
- Node.js built-in `fs`/`path` (already used identically in `apps/api/src/scripts/migrate.ts`)
- Docker `ARG`/`ENV`/`LABEL` (native Dockerfile/Compose features, no library)
- Plain markdown for `CHANGELOG.md` and `docs/DEPLOYMENT.md`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `VERSION` file + manual `CHANGELOG.md` edits | `semantic-release` / `standard-version` / `changesets` npm packages | These automate version bumping and changelog generation from conventional commits, but the repo has no CI pipeline, no conventional-commit enforcement, and no npm publish target — introducing a new devDependency and workflow is disproportionate to a 3-requirement phase. `[ASSUMED]` this is out of scope; flagged in Open Questions below in case the user wants it for future releases. |
| Docker build `ARG` for version stamping | `git describe --tags` baked in at container start via entrypoint script | Rejected: requires `.git` directory inside the image (bad practice, bloats image, leaks history) or an entrypoint dependency on git being installed in the final stage. |

**Installation:** None — no `npm install` needed for this phase.

## Package Legitimacy Audit

No external packages are recommended or installed by this phase. Table intentionally empty.

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages evaluated — none proposed)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Repo root
  VERSION (plain text, e.g. "3.0.0")
       │
       │ read by shell at build time: VERSION=$(cat VERSION)
       ▼
docker compose -f docker-compose.prod.yml build
       │  passes --build-arg VERSION=$VERSION to all 4 app builds
       ├──► apps/api/Dockerfile        (context: ./apps/api)   ── ARG VERSION → ENV VERSION
       ├──► apps/marketplace/Dockerfile (context: .)           ── ARG VERSION → LABEL only
       ├──► apps/workspaces/Dockerfile  (context: .)           ── ARG VERSION → LABEL only
       └──► apps/cmr/Dockerfile         (context: .)           ── ARG VERSION → LABEL only
                     │
                     ▼
        vectra_api container boots
                     │
        GET /health ─┼─► { status: "OK", version: process.env.VERSION }
                     │
   Operator upgrade flow (docs/DEPLOYMENT.md, 5 steps):
        1. git pull (new tag checked out)
        2. docker compose -f docker-compose.prod.yml build   (stamps new VERSION)
        3. docker compose -f docker-compose.prod.yml run --rm api npm run migrate
        4. docker compose -f docker-compose.prod.yml up -d   (restart w/ new images)
        5. curl /health → confirm version bumped
```

### Recommended Project Structure

```
VERSION                          # NEW — plaintext, e.g. "3.0.0", no "v" prefix, no trailing newline concerns handled by trim()
CHANGELOG.md                     # NEW — repo root, one ## section per release
docs/
└── DEPLOYMENT.md                # EDIT — replace "Database migrations" per-file psql section with 5-step upgrade procedure
apps/api/src/
├── core/config/
│   └── version.ts               # NEW — getVersion(): reads process.env.VERSION, falls back to root VERSION file (dev/ts-node)
└── server.ts                    # EDIT — /health handler adds `version: getVersion()`
apps/api/Dockerfile              # EDIT — ARG VERSION / ENV VERSION=$VERSION
apps/marketplace/Dockerfile      # EDIT — ARG VERSION / LABEL org.opencontainers.image.version=$VERSION
apps/workspaces/Dockerfile       # EDIT — same
apps/cmr/Dockerfile              # EDIT — same
docker-compose.prod.yml          # EDIT — add `args: VERSION: ${VERSION}` under each of the 4 app builds
```

### Pattern 1: Version module mirrors the existing `migrate.ts` __dirname path convention
**What:** `apps/api/src/scripts/migrate.ts` already solves "find a repo-root-relative file from code that runs both as `src/*.ts` (ts-node dev) and `dist/*.js` (built prod)" — it computes `MIGRATIONS_DIR` via a fixed number of `../` hops from `__dirname`, verified to work at the same depth for both `src/scripts/` and `dist/scripts/`.
**When to use:** Any new module (e.g. `core/config/version.ts`) that needs to read the root `VERSION` file as a fallback for local dev must place itself at a directory depth where the same relative-hop count resolves correctly for both `src/...` and `dist/...` — count hops carefully; a mismatch silently reads the wrong file or throws ENOENT only in one of the two run modes.
**Example:**
```typescript
// Source: apps/api/src/scripts/migrate.ts (existing pattern in this repo)
// From apps/api/src/scripts/ up to repo root, then into database/migrations.
// Same depth under apps/api for both dist/scripts/migrate.js (prod) and
// src/scripts/migrate.ts (ts-node dev).
const MIGRATIONS_DIR = path.join(__dirname, '../../../../database/migrations');
```
Recommended `version.ts` (same directory depth as `scripts/`, i.e. `apps/api/src/core/config/` is ONE level deeper than `scripts/` — verify hop count independently, do not copy `../../../../` blindly):
```typescript
// apps/api/src/core/config/version.ts
import fs from 'fs';
import path from 'path';

let cachedVersion: string | undefined;

export function getVersion(): string {
  if (cachedVersion !== undefined) return cachedVersion;
  if (process.env.VERSION) {
    cachedVersion = process.env.VERSION.trim();
    return cachedVersion;
  }
  // Dev fallback: apps/api/src/core/config -> repo root is 5 hops up
  // (config -> core -> src -> api -> apps -> root). Verify against dist depth too.
  try {
    const versionFile = path.join(__dirname, '../../../../../VERSION');
    cachedVersion = fs.readFileSync(versionFile, 'utf-8').trim();
  } catch {
    cachedVersion = 'unknown';
  }
  return cachedVersion;
}
```

### Pattern 2: Build-arg version stamping (avoids Dockerfile COPY / build-context mismatch)
**What:** `docker-compose.prod.yml` builds `api` from `context: ./apps/api` while the three frontends build from `context: .` (repo root) — see verified compose file below. A root `VERSION` file can be `COPY`'d into the frontend images directly but NOT into `apps/api/Dockerfile` without changing its context. Passing the version as a build `ARG` avoids this asymmetry entirely — it works the same way regardless of build context because the value comes from the docker build invocation, not a `COPY` inside the Dockerfile.
**When to use:** Any value (like a version string) that must reach an image whose build context doesn't include the file — always prefer `ARG` over auto-detecting or `COPY`-ing multiple context-relative paths.
**Example:**
```dockerfile
# apps/api/Dockerfile — add near top, after FROM
ARG VERSION=unknown
ENV VERSION=$VERSION
```
```yaml
# docker-compose.prod.yml — add under each of the 4 app services' `build:` key
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      args:
        VERSION: ${VERSION:?VERSION is required (export VERSION=$(cat VERSION) before build)}
```
Build invocation (documented in `docs/DEPLOYMENT.md`):
```bash
export VERSION=$(cat VERSION)
docker compose -f docker-compose.prod.yml build
```

### Anti-Patterns to Avoid
- **Reading `package.json` version as the release version:** This repo's `package.json` versions are already inconsistent scaffolding leftovers (root + api = `1.0.0`, frontends = `0.1.0`, shared packages = `0.0.0` — verified via grep) and are not used anywhere as a release identifier. Do not treat them as the source of truth; the `VERSION` file is the single new source of truth per REL-01. Reconciling `package.json` versions is out of this phase's stated scope (see Open Questions).
- **Baking `.git` into the image to derive version via `git describe`:** Bloats the image and leaks repo history into production containers; use the build-arg pattern instead.
- **Re-adding the removed per-file `psql` instructions "just in case":** `docs/DEPLOYMENT.md`'s current "Database migrations" section (lines 93–172, verified) is a manual `psql -f database/migrations/0NN_*.sql` per file — REL-03 requires this be **fully replaced**, not supplemented, by the 5-step `npm run migrate`-based procedure. Leaving both creates two contradictory upgrade paths, which is the exact anti-pattern REL-03 exists to eliminate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deriving "which migration files belong to this release" | A stateful release-tracking table/config | `git diff <prev-tag>..HEAD --name-only -- database/migrations/` | Git already tracks this precisely; verified working (`git diff v1.0..v2.0 --name-only -- database/migrations/` returned an empty, correct result since no schema changes shipped in v2.0). No new state needed. |
| Semantic version bumping automation | A custom conventional-commit parser | Manual edit of the `VERSION` file for this phase (see Alternatives Considered re: `semantic-release`) | Repo has no CI/conventional-commit enforcement; automating this is a larger, separate concern than REL-01/02/03 require. |

**Key insight:** Every mechanism REL-01/02/03 need (migration ordering, git tag history, `__dirname`-relative file reads, Docker build args) already has a working precedent somewhere in this repo. The phase is stitching, not inventing.

## Common Pitfalls

### Pitfall 1: API build context does not include the repo root
**What goes wrong:** A naive `COPY VERSION ./VERSION` added to `apps/api/Dockerfile` will fail the build (`file not found`) because `docker-compose.prod.yml` builds the `api` service with `context: ./apps/api`, not `.`.
**Why it happens:** The 4 app builds in `docker-compose.prod.yml` are NOT symmetric — verified: `api` uses `context: ./apps/api`; `marketplace`/`workspaces`/`cmr` use `context: .`. This asymmetry predates this phase (Phase 16) and isn't something to "fix" as part of REL-01 — just work around it.
**How to avoid:** Use the build-`ARG` pattern (Pattern 2 above) for all 4 images uniformly, so the fix doesn't depend on context and stays consistent across services.
**Warning signs:** `docker compose build` fails only on the `api` service with a "not found" / "forbidden path outside build context" error while frontend builds succeed.

### Pitfall 2: `__dirname`-relative path hop-count mismatch between `src/` (ts-node) and `dist/` (built) trees
**What goes wrong:** A new module placed at a different directory depth than `migrate.ts` (`apps/api/src/scripts/`) needs a different number of `../` hops to reach the repo root — copying `migrate.ts`'s exact `../../../../` blindly into a module at a different depth (e.g. `core/config/`) silently reads the wrong file or throws in only one of dev/prod, not both, making it easy to miss in testing if only one mode is exercised.
**Why it happens:** `apps/api/dist/` mirrors `apps/api/src/`'s internal directory structure exactly (TypeScript `outDir` preserves relative paths), so the hop count only needs to be counted once — but it must be counted precisely for the actual chosen module location, not copy-pasted.
**How to avoid:** Count hops explicitly for the chosen file location and verify by running both `ts-node-dev` (dev) and a built `dist/` run (or at minimum, a manual `node -e` path resolution check) before considering it done.
**Warning signs:** `/health` reports `"version": "unknown"` in one run mode but not the other.

### Pitfall 3: `docs/DEPLOYMENT.md`'s existing migration section spans 8 separate manual-`psql` call-outs (migrations 003–021), not one block
**What goes wrong:** REL-03 asks for a single 5-step upgrade procedure "that fully replaces the old manual per-file psql instructions" — but the existing content isn't one contiguous block; it's 8 separate paragraph+codeblock pairs interleaved with other prose (verified: lines 93–172 of `docs/DEPLOYMENT.md`, migrations 003, 013, 014, 015, 016, 018, 019, 020, 021 each get their own `psql -f ...` snippet). A careless edit could leave some of these call-outs in place.
**Why it happens:** Each call-out was added incrementally, one per phase/migration, over the project's history — there was never a single "migrations" section to begin with.
**How to avoid:** Replace the entire "## Database migrations" section (header through the last `psql -f database/migrations/021_crm_extensions.sql` block, immediately before "## Outlook / Microsoft 365 integration") with the new 5-step procedure in one edit, not a series of smaller edits.
**Warning signs:** `grep -n "psql -f database/migrations" docs/DEPLOYMENT.md` still returns matches after the edit.

### Pitfall 4: Compose comment inside `docker-compose.prod.yml` is now stale
**What goes wrong:** The `api` service in `docker-compose.prod.yml` (lines 30–36, verified) carries a comment: `"Requires Phase 15's migration runner ... not present in this repo as of Phase 16."` — this was accurate when Phase 16 was written but Phase 15 has since shipped. Not a functional bug, but a planner reading this comment literally could think the migration runner still needs to be built.
**Why it happens:** Comment was never revisited after Phase 15 completed.
**How to avoid:** Not a REL-01/02/03 requirement to fix, but worth a one-line touch-up while editing this file for build args, to avoid leaving contradictory documentation in a file this phase is already modifying.
**Warning signs:** None functional — purely a documentation-accuracy nit.

## Code Examples

### Current `/health` handler (verified, apps/api/src/server.ts:58-61)
```typescript
// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "VECTRA backend running" });
});
```

### Minimal REL-01 change
```typescript
import { getVersion } from "./core/config/version";
// ...
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "VECTRA backend running", version: getVersion() });
});
```

### Current migration runner discovery logic (verified, apps/api/src/scripts/migrate.ts:25-28) — basis for CHANGELOG generation
```typescript
// Strict filename regex (not a bare .sql suffix check) — T-15-01 mitigation:
// any non-conforming or path-traversal-shaped entry is silently skipped.
const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d+_[\w-]+\.sql$/.test(f) && !EXCLUDED_FILES.has(f))
  .sort();
```
A `CHANGELOG.md` migration-list generator for a given release can reuse the identical regex, but should scope to *new* files since the previous release tag rather than all files — e.g.:
```bash
# List migration files introduced since the previous release tag
git diff <prev-tag>..HEAD --name-only -- database/migrations/ | grep -E '^database/migrations/[0-9]+_[A-Za-z0-9_-]+\.sql$'
```
Verified this works against the repo's actual tag history: `git diff v1.0..v2.0 --name-only -- database/migrations/` returns empty (correctly — no schema changes shipped in the v2.0 milestone), and current migrations run 005–024 (`005_ai_config.sql` … `024_kpi_target_client.sql`), all matching the `NNN_description.sql` convention already documented in CLAUDE.md.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Per-file manual `psql -f database/migrations/0NN_*.sql` instructions in `docs/DEPLOYMENT.md` (8 call-outs, migrations 003–021) | `npm run migrate` runner (Phase 15) applies all pending numbered files idempotently, tracked in `schema_migrations` | Phase 15 (2026-07-12, already shipped) | REL-03 formalizes what Phase 15 already made possible — `docs/DEPLOYMENT.md` just hasn't caught up yet. This IS the phase's job. |
| No version identifier anywhere except loose git tags (`v1.0`, `v2.0`) and inconsistent `package.json` versions | Single root `VERSION` file, git-tag-aligned, stamped into images, surfaced at `/health` | This phase (REL-01) | Establishes the "one version" convention the milestone's goal describes. |

**Deprecated/outdated:**
- The "Database migrations" section of `docs/DEPLOYMENT.md` (as it exists today) — superseded entirely by REL-03's 5-step procedure.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `VERSION` file content should be a bare semver string (e.g. `3.0.0`) without a `v` prefix, while git tags keep the `v` prefix (matching existing `v1.0`/`v2.0` tags) | Summary, Architecture Patterns | Low — cosmetic; planner/user can flip the convention in either direction without touching any other design decision in this research |
| A2 | Reconciling the divergent `package.json` versions (root/api `1.0.0` vs frontends `0.1.0` vs packages `0.0.0`) is out of scope for this phase | Anti-Patterns to Avoid | Low-medium — if the user actually wants these synced to the new `VERSION` file, that's extra scope not covered by REL-01/02/03's stated success criteria, which only mention the `VERSION` file, images, and `/health` |
| A3 | `semantic-release`/`standard-version`/`changesets` are out of scope given no CI and no conventional-commit enforcement exists | Alternatives Considered | Low — purely a recommendation against introducing new tooling; doesn't block a manual-editing approach to REL-02 |

## Open Questions

1. **Should `CHANGELOG.md` generation be a script (`npm run changelog` or similar) or a one-time manually-written file for the v3.0 release?**
   - What we know: REL-02 requires the file to exist with "a migration list generated from the release's migration filenames" — the word "generated" suggests at least a semi-automated step, but there's no CI to run it automatically on tag.
   - What's unclear: Whether "generated" means "there exists a reusable script the operator/maintainer runs before each future release" (recommended, low effort given the `git diff <tag>..HEAD -- database/migrations/` one-liner already verified above) or just "this file, once written, was accurate" (satisfied by hand-writing it once).
   - Recommendation: Plan for a small script (`scripts/generate-changelog-entry.sh` or a Node script under `apps/api/src/scripts/` following existing script conventions) that takes a previous tag and prints the new migration filenames — cheap to build given the verified `git diff` mechanism, and satisfies "generated" literally rather than just "accurate."

2. **What is the actual version string for the current (v3.0 On-Premise GA) release?**
   - What we know: Git tags `v1.0` (2026-07-06) and `v2.0` (2026-07-12) exist; the milestone in progress is named `v3.0 On-Premise GA` in `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`.
   - What's unclear: Whether the `VERSION` file for this in-progress release should read `3.0.0` (matching the milestone name) even though the git tag `v3.0` doesn't exist yet at research time — tagging happens at release, not mid-phase.
   - Recommendation: Use `3.0.0` in the `VERSION` file (consistent with the `v1.0`/`v2.0` precedent and the milestone name), and let the actual `git tag v3.0` creation happen as a separate release-time step outside this phase's plan (REL-01 only requires the file + stamping + `/health` mechanism to exist and work, not that a tag be cut during phase execution).

## Environment Availability

No external tool/service dependencies beyond what's already verified present in this repo (Docker, git, Node.js/npm — all already relied upon by Phases 15/16/17). Skipping the full audit table — this phase adds no new dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` via `ts-node/register` (verified: `apps/api/package.json` `"test": "node --require ts-node/register --test src/**/*.test.ts"`) |
| Config file | none — invoked directly via npm script |
| Quick run command | `node --require ts-node/register --test src/core/config/version.test.ts` |
| Full suite command | `npm test --workspace @vectra/api` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | `getVersion()` reads `process.env.VERSION` when set; falls back to root `VERSION` file when unset; returns `'unknown'` if neither resolves | unit | `node --require ts-node/register --test src/core/config/version.test.ts` | ❌ Wave 0 |
| REL-01 | `GET /health` response includes a `version` field matching `getVersion()` | unit/integration | existing pattern: extend `apps/api/src/controllers/authController.test.ts`-style request test, or a new `server.health.test.ts` | ❌ Wave 0 |
| REL-02 | `CHANGELOG.md` exists at repo root with at least one `##` section | manual / doc-existence check | `test -f CHANGELOG.md && grep -c "^## " CHANGELOG.md` | N/A — doc artifact, not code |
| REL-03 | `docs/DEPLOYMENT.md` no longer contains any `psql -f database/migrations/` snippet | manual / doc-existence check | `! grep -q "psql -f database/migrations" docs/DEPLOYMENT.md` | N/A — doc artifact, not code |

### Sampling Rate
- **Per task commit:** `node --require ts-node/register --test src/core/config/version.test.ts` (and any new `server.health.test.ts`)
- **Per wave merge:** `npm test --workspace @vectra/api`
- **Phase gate:** Full suite green before `/gsd:verify-work`; doc-artifact checks (`CHANGELOG.md`, `docs/DEPLOYMENT.md`) are manual grep verification since they're not code paths `node:test` can exercise.

### Wave 0 Gaps
- [ ] `apps/api/src/core/config/version.test.ts` — covers REL-01 (`getVersion()` env/file-fallback/unknown branches), mirroring the existing test shape in `apps/api/src/core/config/secrets.test.ts`
- [ ] `apps/api/src/server.health.test.ts` (or extend an existing request-level test) — covers REL-01's `/health` `version` field
- No framework install needed — `node:test` + `ts-node/register` already wired at the workspace level.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | `/health` is an existing unauthenticated public endpoint (verified — no auth middleware on the `/health` route); adding a `version` field does not change its auth posture |
| V3 Session Management | no | not touched by this phase |
| V4 Access Control | no | not touched by this phase |
| V5 Input Validation | no | `VERSION` file is a build-time, operator-controlled input, not user input; no request-time parsing needed |
| V6 Cryptography | no | not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via `/health` version string | Information Disclosure | Low severity, industry-standard practice to expose version at `/health` for ops/monitoring; do not add build metadata (git SHA, build host, internal paths) beyond the semver string itself — keep the exposed field minimal |

## Sources

### Primary (HIGH confidence — verified directly in this repo via Read/Grep/Bash)
- `apps/api/src/scripts/migrate.ts` — migration discovery regex, `__dirname`-relative path pattern, `EXCLUDED_FILES` convention
- `apps/api/src/server.ts` (lines 1-61) — existing `/health` route, no auth middleware present
- `docker-compose.prod.yml` (full file, 142 lines) — build contexts per service (asymmetric: `api` = `./apps/api`, frontends = `.`), env var requirement pattern (`${VAR:?msg}`)
- `docs/DEPLOYMENT.md` (full file, 208 lines) — existing "Database migrations" section (lines 93-172) with 8 separate `psql -f` call-outs to be replaced
- `apps/api/Dockerfile`, `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile` — current multi-stage build structure, no ARG/LABEL present today
- `apps/api/src/core/config/secrets.ts` — established pattern for a boot-time-cached, validated config-read module (`getDeploymentMode()` shape) to model `getVersion()` on
- `apps/api/package.json`, root `package.json`, all `apps/*/package.json`, `packages/*/package.json` — verified current version field inconsistency (`1.0.0` / `0.1.0` / `0.0.0`)
- `git tag -l`, `git for-each-ref` — verified `v1.0` (2026-07-06), `v2.0` (2026-07-12) exist; `git diff v1.0..v2.0 --name-only -- database/migrations/` verified empty
- `ls database/migrations/` — verified current highest migration is `024_kpi_target_client.sql`, all filenames match `^\d+_[\w-]+\.sql$`
- `.planning/config.json` — verified `nyquist_validation: true` (Validation Architecture section required), no `security_enforcement` key (treated as enabled per protocol)
- `apps/api/src/core/config/secrets.test.ts`'s sibling test files (`ls apps/api/src/**/*.test.ts`) — confirms `node:test` + `ts-node/register` test convention

### Secondary (MEDIUM confidence)
- OCI Image Format Specification `org.opencontainers.image.version` LABEL convention — widely known Docker/OCI standard; not independently re-verified via Context7/WebFetch in this session, but low-risk, non-load-bearing (optional metadata, not required by REL-01's success criteria which only require `VERSION` file + `/health` field)

### Tertiary (LOW confidence)
- None — no unverified WebSearch-only claims were needed for this phase; entirely repo-internal investigation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external packages involved; all mechanisms verified directly against repo files
- Architecture: HIGH — build-context asymmetry and `/health` location independently verified via Read/Grep of the actual files
- Pitfalls: HIGH — each pitfall traced to a specific verified line range in the repo, not inferred

**Research date:** 2026-07-12
**Valid until:** Stable — this research doesn't depend on external library version currency (30+ days safe; only repo-internal facts, which the planner should re-verify only if Phase 16/17 files change before Phase 19 executes)
