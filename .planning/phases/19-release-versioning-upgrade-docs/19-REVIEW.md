---
phase: 19-release-versioning-upgrade-docs
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/api/src/core/config/version.ts
  - apps/api/src/core/config/version.test.ts
  - apps/api/src/server.health.test.ts
  - apps/api/src/server.ts
  - apps/api/Dockerfile
  - apps/marketplace/Dockerfile
  - apps/workspaces/Dockerfile
  - apps/cmr/Dockerfile
  - docker-compose.prod.yml
  - CHANGELOG.md
  - scripts/list-release-migrations.sh
  - docs/DEPLOYMENT.md
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-07-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The core `version.ts` resolver (`resolveVersion`/`getVersion`) is well-designed: pure function, injectable file-read callback, non-fatal fallback, and process-lifetime caching, mirroring the existing `secrets.ts` shape. The wiring into `/health` in `server.ts` is minimal and correct, and the Dockerfiles for the three Next.js frontends correctly scope `ARG VERSION` to the final runner stage and stamp an OCI `image.version` label.

However, the documented manual build path in `docs/DEPLOYMENT.md` — the "Production images" section — never passes `--build-arg VERSION`, which silently defeats the entire versioning feature for anyone following those instructions literally (a real, high-impact documentation bug for a phase whose deliverable *is* release versioning). Additionally, `apps/api/Dockerfile` places the `ARG`/`ENV VERSION` instructions before the dependency-install layer, breaking the intended Docker layer cache on every version bump, and uses `npm install` instead of the `npm ci` used consistently in the other three Dockerfiles. The test file for `version.ts` also has a test-hygiene gap (unrestored global env mutation).

## Critical Issues

### CR-01: `docs/DEPLOYMENT.md` manual build commands never pass `--build-arg VERSION`, silently producing "unknown"-versioned images

**File:** `docs/DEPLOYMENT.md:47-51`
**Issue:** The "Production images" section instructs operators to build all four images with:
```bash
docker build -f apps/marketplace/Dockerfile -t vectra-marketplace .
docker build -f apps/workspaces/Dockerfile  -t vectra-workspaces  .
docker build -f apps/cmr/Dockerfile         -t vectra-cmr         .
docker build -f apps/api/Dockerfile         -t vectra-api         ./apps/api
```
None of these pass `--build-arg VERSION=...`. Every Dockerfile declares `ARG VERSION=unknown`, so images built exactly as documented here will always be labeled/report version `unknown` — regardless of what's actually checked out. This directly contradicts the "Upgrading a running install" section (line 103-109 of the same file), which correctly does `export VERSION=$(cat VERSION)` before building via `docker compose -f docker-compose.prod.yml build`. An operator who builds manually (e.g. to push to a registry, or outside of the compose flow) per the documented commands gets images that defeat the purpose of this entire phase: `GET /health`'s `version` field and the images' `org.opencontainers.image.version` label will both read `unknown`, making step 5 of the upgrade procedure ("Check the returned `version` field matches the tag checked out in step 1") impossible to satisfy.
**Fix:** Pass the build arg in every manual command, e.g.:
```bash
export VERSION=$(cat VERSION)
docker build -f apps/marketplace/Dockerfile -t vectra-marketplace --build-arg VERSION=$VERSION .
docker build -f apps/workspaces/Dockerfile  -t vectra-workspaces  --build-arg VERSION=$VERSION .
docker build -f apps/cmr/Dockerfile         -t vectra-cmr         --build-arg VERSION=$VERSION .
docker build -f apps/api/Dockerfile         -t vectra-api         --build-arg VERSION=$VERSION ./apps/api
```

## Warnings

### WR-01: `apps/api/Dockerfile` places `ARG VERSION`/`ENV VERSION` before the dependency-install layer, invalidating the npm cache on every version bump

**File:** `apps/api/Dockerfile:1-9`
**Issue:**
```dockerfile
FROM node:18-alpine

ARG VERSION=unknown
ENV VERSION=$VERSION

WORKDIR /app

COPY package*.json ./
RUN npm install
```
`ARG`/`ENV VERSION` are declared before `COPY package*.json ./` and `RUN npm install`. Since `VERSION` changes on every release (that's the entire point of this phase), every release build now invalidates the Docker layer cache starting at the `ENV VERSION=$VERSION` instruction — including the `npm install` layer — even when `package.json`/`package-lock.json` are unchanged. This defeats the intentional cache-friendly split between "install deps" and "copy source" that the Dockerfile otherwise follows, and is inconsistent with the three frontend Dockerfiles in the same phase, which correctly scope `ARG VERSION` to the final `runner` stage (after the `builder` stage has already produced its cacheable output), so a version bump never invalidates their `deps`/`builder` stages.
**Fix:** Move the version arg/label to the end, after the build step, and drop the `ENV` (health check only needs it inside the running container, which `ENV` before the app starts already accomplishes — just move it past the cache-sensitive layers):
```dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ARG VERSION=unknown
ENV VERSION=$VERSION
LABEL org.opencontainers.image.version=$VERSION

EXPOSE 8080
CMD ["npm", "start"]
```

### WR-02: `apps/api/Dockerfile` uses `npm install` instead of `npm ci`, inconsistent with the other three Dockerfiles

**File:** `apps/api/Dockerfile:9`
**Issue:** `RUN npm install` is used for the production image build, while `apps/marketplace/Dockerfile`, `apps/workspaces/Dockerfile`, and `apps/cmr/Dockerfile` all correctly use `RUN npm ci` for reproducible, lockfile-exact installs. `npm install` can silently resolve slightly different dependency versions than what's pinned in `package-lock.json` and may rewrite the lockfile inside the image build, which is not what you want for a production/release artifact.
**Fix:**
```dockerfile
COPY package*.json ./
RUN npm ci
```

### WR-03: `version.test.ts` mutates global `process.env.VERSION` and the module's cache with no cleanup/reset, making the test order-dependent

**File:** `apps/api/src/core/config/version.test.ts:33-40`
**Issue:**
```ts
test('getVersion() caches after first read — later env mutation has no effect', () => {
  process.env.VERSION = 'cached-val';
  const first = getVersion();
  process.env.VERSION = 'other-val';
  const second = getVersion();
  assert.equal(first, 'cached-val');
  assert.equal(second, 'cached-val');
});
```
This test permanently mutates the real `process.env.VERSION` for the remainder of the process and permanently populates `version.ts`'s module-level `cachedVersion` singleton, with no `try/finally` restoring the original env var and no way to reset the cache. Today it's the last test in the file so it happens not to break anything, but it's a landmine for anyone adding a new test afterward in the same file (it will silently get `'cached-val'` from the now-poisoned cache instead of exercising fresh behavior), and it leaves `process.env.VERSION` set to `'other-val'` for any other code that runs later in the same process.
**Fix:** Save/restore `process.env.VERSION` around the test, and/or export a test-only reset hook:
```ts
test('getVersion() caches after first read — later env mutation has no effect', () => {
  const original = process.env.VERSION;
  try {
    process.env.VERSION = 'cached-val';
    const first = getVersion();
    process.env.VERSION = 'other-val';
    const second = getVersion();
    assert.equal(first, 'cached-val');
    assert.equal(second, 'cached-val');
  } finally {
    process.env.VERSION = original;
  }
});
```

## Info

### IN-01: `getVersion()`'s file-read fallback is dead code in every documented containerized deployment path

**File:** `apps/api/src/core/config/version.ts:32-36`, `apps/api/Dockerfile`
**Issue:** `readRootVersionFile()` expects to find a `VERSION` file 5 directories above the compiled `dist/core/config/version.js`, i.e. at the repo root. But the API's Docker build context — both in `docker-compose.prod.yml` (`context: ./apps/api`) and in `docs/DEPLOYMENT.md`'s manual command (`./apps/api`) — is scoped to `apps/api/` only, so the repo-root `VERSION` file is never copied into the image (`COPY . .` only copies the build context). In practice this branch is unreachable in any containerized deployment: `ENV VERSION=$VERSION` is always set in the image (even to the `unknown` default), so `resolveVersion` always takes the `envValue` branch and never calls `readVersionFile()`. The fallback only ever executes for non-Docker local dev (`ts-node-dev` run from the repo root). This isn't actively broken, but the fallback's purpose/comment ("Used by ... build tooling as the source of truth") is misleading for the container path — worth a short comment noting the fallback is dev-only given the current build context scoping.
**Fix:** Add a one-line comment clarifying scope, e.g.: `// Note: unreachable in the production Docker image — the VERSION file is outside the api build context; this fallback only serves non-Docker local dev.`

---

_Reviewed: 2026-07-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
