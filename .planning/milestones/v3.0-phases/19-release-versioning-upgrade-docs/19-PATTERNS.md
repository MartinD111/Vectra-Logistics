# Phase 19: Release Versioning & Upgrade Docs - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 9 (2 new code files, 2 new doc/data files, 6 edited files)
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `VERSION` (new, repo root) | config | file-I/O | none (novel artifact type) | no-analog |
| `apps/api/src/core/config/version.ts` (new) | config/utility | file-I/O | `apps/api/src/core/config/secrets.ts` | exact (same directory, same "boot-time validated config read, cached" shape) |
| `apps/api/src/core/config/version.test.ts` (new) | test | request-response (unit) | `apps/api/src/core/config/secrets.test.ts` | exact (sibling test file, same `node:test` convention) |
| `apps/api/src/server.ts` (edit — `/health` handler) | route/controller | request-response | itself (in-place edit) | exact |
| `apps/api/src/server.health.test.ts` (new, optional) | test | request-response | none — no existing `server.*.test.ts` request-level test found | no-analog (use RESEARCH.md guidance) |
| `CHANGELOG.md` (new, repo root) | config/doc | file-I/O (static doc) | none (novel artifact type) | no-analog |
| `docs/DEPLOYMENT.md` (edit — "Database migrations" section) | doc | file-I/O (static doc) | itself (in-place edit); migration list source: `apps/api/src/scripts/migrate.ts` | role-match |
| `apps/api/Dockerfile` (edit — ARG/ENV) | config | build-time | `apps/workspaces/Dockerfile` (for ARG placement pattern), itself for CMD/EXPOSE structure | role-match |
| `apps/marketplace/Dockerfile`, `apps/cmr/Dockerfile` (edit — ARG/LABEL) | config | build-time | `apps/workspaces/Dockerfile` | exact (identical multi-stage structure across all 3 frontend Dockerfiles) |
| `docker-compose.prod.yml` (edit — add `args:` block per service) | config | build-time | itself (in-place edit) | exact |

## Pattern Assignments

### `apps/api/src/core/config/version.ts` (config/utility, file-I/O)

**Analog:** `apps/api/src/core/config/secrets.ts` (full file read, 132 lines)

**Module shape pattern** — boot-time-cached, lazily-validated read, exported as pure functions (not a class), consistent with the project's "singleton instances, no classes for config" convention:
```typescript
// apps/api/src/core/config/secrets.ts:87-122 — the shape to mirror
export type DeploymentMode = 'cloud' | 'on-prem';

let cachedDeploymentMode: DeploymentMode | undefined;

export function validateDeploymentModeValue(value: string | undefined): SecretValidationResult {
  if (!value) {
    return { valid: false, reason: 'DEPLOYMENT_MODE is unset or empty' };
  }
  ...
  return { valid: true };
}

export function getDeploymentMode(): DeploymentMode {
  if (cachedDeploymentMode !== undefined) {
    return cachedDeploymentMode;
  }
  const value = process.env.DEPLOYMENT_MODE;
  const result = validateDeploymentModeValue(value);
  if (!result.valid) {
    fail('DEPLOYMENT_MODE', result.reason ?? 'invalid value');
  }
  cachedDeploymentMode = value as DeploymentMode;
  return cachedDeploymentMode;
}
```

**Key difference for `getVersion()`:** unlike `secrets.ts` (which calls `fail()` → `process.exit(1)` on invalid input because JWT/encryption secrets are safety-critical), `getVersion()` must NOT exit the process — RESEARCH.md's design returns `'unknown'` as a soft fallback. Cache the resolved value the same way (`let cachedVersion: string | undefined`), but branch to file-read instead of `fail()`.

**File-read fallback pattern** — mirror `apps/api/src/scripts/migrate.ts:1-8`'s `__dirname`-relative hop pattern (this is the ONLY place in the repo that reads a file relative to the repo root from compiled/ts-node code):
```typescript
// apps/api/src/scripts/migrate.ts:1-8
import { db } from '../core/db';
import fs from 'fs';
import path from 'path';

// From apps/api/src/scripts/ up to repo root, then into database/migrations.
// Same depth under apps/api for both dist/scripts/migrate.js (prod) and
// src/scripts/migrate.ts (ts-node dev).
const MIGRATIONS_DIR = path.join(__dirname, '../../../../database/migrations');
```
`apps/api/src/scripts/` is 2 levels deep under `apps/api/src/` (`src/scripts`); `apps/api/src/core/config/` is also 2 levels deep (`src/core/config`) — same depth, so the hop count to repo root should match `migrate.ts`'s pattern once `apps/api` itself is accounted for. Verify precisely: `migrate.ts` hops `../../../../` from `src/scripts/migrate.ts` to land at repo root (scripts→src→api→apps→root = 4 hops) and appends `database/migrations`. `core/config/version.ts` is at the same 2-deep nesting under `src/`, so `../../../../` should also reach repo root from `src/core/config/version.ts` (config→core→src→api→apps→root = 5 hops — **note the +1 vs migrate.ts's 4**, because `core/config` is nested one level deeper than `scripts`). Do not blindly copy 4 hops; count precisely as RESEARCH.md warns (Pitfall 2).

### `apps/api/src/core/config/version.test.ts` (test)

**Analog:** `apps/api/src/core/config/secrets.test.ts` (full file read, 103 lines)

**Test file pattern** — `node:test` + `node:assert/strict`, one `test()` block per behavior branch, imports named exports directly from sibling module:
```typescript
// apps/api/src/core/config/secrets.test.ts:1-20
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateJwtSecretValue,
  validateEncryptionKeyValue,
  validateDeploymentModeValue,
  getDeploymentMode,
} from './secrets';

test('JWT_SECRET unset -> invalid', () => {
  const result = validateJwtSecretValue(undefined);
  assert.equal(result.valid, false);
});
```
Caching-behavior test pattern to mirror for `getVersion()`'s cache (mutate env after first call, assert cached value unchanged):
```typescript
// apps/api/src/core/config/secrets.test.ts:95-102
test('getDeploymentMode() caches after first read — later env mutation has no effect', () => {
  process.env.DEPLOYMENT_MODE = 'cloud';
  const first = getDeploymentMode();
  process.env.DEPLOYMENT_MODE = 'on-prem';
  const second = getDeploymentMode();
  assert.equal(first, 'cloud');
  assert.equal(second, 'cloud');
});
```

---

### `apps/api/src/server.ts` (route, request-response) — `/health` handler edit

**Analog:** itself (in-place edit)

**Current code** (`apps/api/src/server.ts:23, 58-61`):
```typescript
import { validateSecretsOrExit, validateDeploymentModeOrExit } from "./core/config/secrets";
// ...
// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "VECTRA backend running" });
});
```
Add a sibling import at line 23 following the exact same relative-path/named-import style (`./core/config/version`), and extend the existing JSON literal in place — do not restructure the route or add middleware; `/health` has no auth guard today (verified, no `router.use(authenticateToken)` above it) and this phase does not change that.

---

### `docs/DEPLOYMENT.md` (doc) — "Database migrations" section replacement

**Analog:** itself; migration-file discovery logic sourced from `apps/api/src/scripts/migrate.ts:23-28`

**Section to replace in full** — header through last `psql -f` block, `docs/DEPLOYMENT.md` lines 93-172 (verified exact boundaries: starts at `## Database migrations` heading on line 93, ends immediately before `## Outlook / Microsoft 365 integration` heading on line 174). The section currently contains 8 separate `psql -f database/migrations/0NN_*.sql` call-outs (migrations 003, 013, 014, 015, 016, 018, 019, 020, 021) interleaved with prose — RESEARCH.md Pitfall 3 warns this must be replaced as ONE edit, not several, to avoid leaving stragglers. Verify post-edit with `grep -n "psql -f database/migrations" docs/DEPLOYMENT.md` returning no matches.

**Migration filename convention to reference in the new 5-step doc** (`apps/api/src/scripts/migrate.ts:23-28`):
```typescript
// Strict filename regex (not a bare .sql suffix check) — T-15-01 mitigation:
// any non-conforming or path-traversal-shaped entry is silently skipped.
const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d+_[\w-]+\.sql$/.test(f) && !EXCLUDED_FILES.has(f))
  .sort();
```
This regex (`^\d+_[\w-]+\.sql$`) is the authoritative convention already documented in CLAUDE.md's "SQL Conventions" (`NNN_description.sql`) — reuse this exact pattern description in the upgrade doc rather than re-deriving it.

---

### `apps/api/Dockerfile`, `apps/marketplace/Dockerfile`, `apps/workspaces/Dockerfile`, `apps/cmr/Dockerfile` (config, build-time)

**Analog:** `apps/workspaces/Dockerfile` (full file, 36 lines) — structurally identical to `marketplace`/`cmr` Dockerfiles (verified via grep: same `FROM ... AS base/deps/builder/runner` stage sequence in all three).

**Current frontend Dockerfile shape** (`apps/workspaces/Dockerfile:1-35`, representative of all 3 frontends):
```dockerfile
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @vectra/workspaces

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/workspaces/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workspaces/.next/static ./apps/workspaces/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workspaces/public ./apps/workspaces/public

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/workspaces/server.js"]
```
Frontends are multi-stage — the `ARG VERSION` must be declared in the FINAL stage (`runner`) since `ARG` scope does not cross `FROM` boundaries in multi-stage builds unless redeclared per-stage; `LABEL` should also live in `runner` since that's the stage that becomes the shipped image.

**Current `apps/api/Dockerfile`** (full file, 13 lines — single-stage, no `AS` stages):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
```
Single-stage, so `ARG VERSION` / `ENV VERSION=$VERSION` can go anywhere after `FROM` — RESEARCH.md recommends "near top, after FROM" (Pattern 2 excerpt), which also works here since there's only one stage.

---

### `docker-compose.prod.yml` (config, build-time)

**Analog:** itself (in-place edit) — add `args:` under each of the 4 app services' existing `build:` key, following the established `${VAR:?msg}` required-env-var convention already used throughout this file.

**Existing required-var convention to mirror** (`docker-compose.prod.yml:49-51`, `93-96`):
```yaml
      - JWT_SECRET=${JWT_SECRET:?JWT_SECRET is required}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:?ENCRYPTION_KEY is required}
      - DEPLOYMENT_MODE=${DEPLOYMENT_MODE:?DEPLOYMENT_MODE is required (cloud or on-prem)}
```
**Current `api` service `build:` block to extend** (`docker-compose.prod.yml:37-40`):
```yaml
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
```
**Stale comment to touch up while editing this block** (`docker-compose.prod.yml:35-36`, flagged in RESEARCH.md Pitfall 4 — not a functional requirement, but a one-line accuracy fix while this file is already being edited for build args):
```yaml
  # Requires Phase 15's migration runner (apps/api/src/scripts/migrate.ts, the
  # `npm run migrate` script) — not present in this repo as of Phase 16.
```
This is now inaccurate (Phase 15 shipped); update to reflect that the migration runner exists.

**Frontend `build:` blocks to extend identically** (e.g. `docker-compose.prod.yml:86-88` for `marketplace`, `104-106` for `workspaces`, `122-124` for `cmr`) — all three currently identical shape:
```yaml
  marketplace:
    build:
      context: .
      dockerfile: apps/marketplace/Dockerfile
```

## Shared Patterns

### Boot-time cached config read
**Source:** `apps/api/src/core/config/secrets.ts` (`getDeploymentMode()`, lines 111-122)
**Apply to:** `apps/api/src/core/config/version.ts`
```typescript
let cachedDeploymentMode: DeploymentMode | undefined;

export function getDeploymentMode(): DeploymentMode {
  if (cachedDeploymentMode !== undefined) {
    return cachedDeploymentMode;
  }
  const value = process.env.DEPLOYMENT_MODE;
  // ...validate...
  cachedDeploymentMode = value as DeploymentMode;
  return cachedDeploymentMode;
}
```

### `__dirname`-relative repo-root file read
**Source:** `apps/api/src/scripts/migrate.ts` (lines 1-8)
**Apply to:** `apps/api/src/core/config/version.ts`'s dev-mode `VERSION` file fallback — count hops precisely per RESEARCH.md Pitfall 2, do not copy `migrate.ts`'s exact hop count without re-deriving for the new file's directory depth.

### `node:test` unit test file shape
**Source:** `apps/api/src/core/config/secrets.test.ts` (full file)
**Apply to:** `apps/api/src/core/config/version.test.ts`
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVersion } from './version';

test('...', () => {
  assert.equal(..., ...);
});
```

### Required build-time env var (`${VAR:?msg}`)
**Source:** `docker-compose.prod.yml` (used throughout, e.g. lines 49-51, 93-96)
**Apply to:** the new `args: VERSION: ${VERSION:?...}` block under each of the 4 app services

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `VERSION` (repo root) | config | file-I/O | Novel artifact type — no existing plaintext version file in this repo (only inconsistent `package.json` version fields, explicitly rejected as a source of truth per RESEARCH.md Anti-Patterns) |
| `CHANGELOG.md` (repo root) | doc | file-I/O (static) | Novel artifact type — no existing changelog file in this repo; format is free-form markdown, one `##` section per release, migration list generated via `git diff <prev-tag>..HEAD --name-only -- database/migrations/` per RESEARCH.md Code Examples |
| `apps/api/src/server.health.test.ts` (optional, per RESEARCH.md Wave 0 gap) | test | request-response | No existing request-level (supertest-style or manual `http` request) test file found in `apps/api/src/**/*.test.ts` to use as a direct analog — RESEARCH.md suggests extending an `authController.test.ts`-style pattern or writing new; if planner includes this file, search `apps/api/src/**/*.test.ts` at plan time for any request-mocking convention before writing from scratch |

## Metadata

**Analog search scope:** `apps/api/src/core/config/`, `apps/api/src/scripts/`, `apps/api/src/server.ts`, `apps/api/Dockerfile`, `apps/{marketplace,workspaces,cmr}/Dockerfile`, `docker-compose.prod.yml`, `docs/DEPLOYMENT.md`
**Files scanned:** 10 (secrets.ts, secrets.test.ts, migrate.ts, server.ts, 4 Dockerfiles, docker-compose.prod.yml, DEPLOYMENT.md)
**Pattern extraction date:** 2026-07-12
