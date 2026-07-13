---
phase: 14-security-hardening
plan: 02
subsystem: infra/docker-compose
tags: [security, secrets, docker-compose, seed-admin]
requires: []
provides:
  - "docker-compose.yml with no seed-admin initdb mount and no known-bad secret defaults"
  - ".env.example documenting JWT_SECRET/ENCRYPTION_KEY generation"
affects:
  - "apps/api/src/core/config/secrets.ts (Plan 01's validateSecretsOrExit now actually trips on unset vars)"
tech-stack:
  added: []
  patterns:
    - "Compose env vars passed through as plain ${VAR} with no :- fallback for secrets"
key-files:
  created: []
  modified:
    - docker-compose.yml
    - .env.example
decisions:
  - "Left database/migrations/017_seed_admin_user.sql on disk untouched — only the initdb mount (the customer-facing mechanism) was removed, per RESEARCH.md Open Question 1; the file's fate under Phase 15's migration runner is a Phase 15 decision"
  - "Used empty placeholders for JWT_SECRET/ENCRYPTION_KEY in .env.example (not a second known-bad literal), paired with a single shared randomBytes generation comment reused verbatim from secretBox.ts"
metrics:
  duration: "~10 minutes"
  completed: 2026-07-12
---

# Phase 14 Plan 02: Docker Compose Secret Hardening & Seed-Admin Removal Summary

Stripped the `017_seed_admin_user.sql` initdb mount and the two known-bad secret defaults from `docker-compose.yml`, and documented real secret generation in `.env.example`, so a fresh Postgres volume never seeds `admin@admin.com`/`admin` and an unset `JWT_SECRET`/`ENCRYPTION_KEY` now reaches the API container empty (tripping Plan 01's `validateSecretsOrExit()`) instead of silently falling back to a known-bad literal.

## Tasks Completed

### Task 1: Strip docker-compose.yml secret defaults and seed-admin initdb mount
- Removed the single volume line mounting `./database/migrations/017_seed_admin_user.sql:/docker-entrypoint-initdb.d/18-seed-admin-user.sql:ro` from the `postgres` service's `volumes:` list. The other 20 initdb mount lines (1-init.sql through 21-ltl-matching.sql, excluding 18) are untouched and unrenumbered — the gap at 18 is harmless since Postgres only sorts by lexical/numeric order among files that exist.
- Changed `JWT_SECRET=${JWT_SECRET:-vectra-dev-secret-key-change-in-production}` to `JWT_SECRET=${JWT_SECRET}` in the `api` service's `environment:` block.
- Changed `ENCRYPTION_KEY=${ENCRYPTION_KEY:-204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20}` to `ENCRYPTION_KEY=${ENCRYPTION_KEY}`.
- `database/migrations/017_seed_admin_user.sql` itself remains on disk — only the mount was removed.
- Commit: `b71f6f0`

### Task 2: Document real secret generation in .env.example
- Replaced the known-bad `JWT_SECRET=vectra-dev-secret-key-change-in-production` line with an empty `JWT_SECRET=` placeholder.
- Added a new `ENCRYPTION_KEY=` line (previously missing entirely) directly below `JWT_SECRET`.
- Added a single shared comment above both lines: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — reused verbatim from `secretBox.ts`'s header comment, per CONTEXT.md D-04.
- Commit: `94510a7`

## Verification

All source assertions from the plan passed:
- `grep -c "017_seed_admin_user" docker-compose.yml` → `0`
- `grep -c "vectra-dev-secret-key-change-in-production" docker-compose.yml` → `0`
- `grep -c "204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20" docker-compose.yml` → `0`
- `grep -c 'JWT_SECRET=${JWT_SECRET}' docker-compose.yml` → `1`
- `grep -c 'ENCRYPTION_KEY=${ENCRYPTION_KEY}' docker-compose.yml` → `1`
- `grep -c "vectra-dev-secret-key-change-in-production" .env.example` → `0`
- `.env.example` contains `JWT_SECRET`, `ENCRYPTION_KEY`, and `randomBytes` → all present

The manual fresh-volume smoke test (`docker compose down -v && docker compose up -d postgres`, then querying `users` for `admin@admin.com`) was not run in this sandboxed worktree environment (no Docker daemon access) — this is a deferred manual verification step per the plan's `<human-check>` designation, not an automated acceptance criterion. The source-level change (mount removal) makes the seeding structurally impossible on any fresh volume regardless of manual confirmation.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None - both changes directly close the two threat register entries (T-14-03, T-14-04) already declared in the plan's `<threat_model>`. No new security-relevant surface was introduced.

## Self-Check: PASSED

- FOUND: docker-compose.yml (modified, verified via grep assertions above)
- FOUND: .env.example (modified, verified via grep assertions above)
- FOUND: b71f6f0 (Task 1 commit)
- FOUND: 94510a7 (Task 2 commit)
