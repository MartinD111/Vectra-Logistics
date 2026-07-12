# Requirements: Vectra CRM Rework — v3.0 On-Premise GA

**Defined:** 2026-07-12
**Core Value:** A customer's data never leaves their server, and they can install + upgrade without Vectra staff present and without a permanent connection to Vectra's cloud.

Source specs: `docs/specs/deployment/{on-premise-deployment,cloud-deployment,release-and-migrations}.md`, `docs/specs/core/ai-integration.md` §6.1, `docs/specs/architecture-steering.md` §2.

## v1 Requirements

Requirements for the v3.0 On-Premise GA milestone. Each maps to a roadmap phase.

### Security Hardening

- [x] **SEC-01**: No production-facing fallback for `ENCRYPTION_KEY`; server refuses to boot without it set
- [x] **SEC-02**: No production-facing fallback for `JWT_SECRET`; server refuses to boot without it set
- [x] **SEC-03**: `017_seed_admin_user.sql` (`admin@admin.com`/`admin`) never runs in any customer-facing install

### Migrations

- [x] **MIG-01**: A `schema_migrations` tracking table + `npm run migrate` runner applies pending numbered migrations in order, idempotently, recording each
- [x] **MIG-02**: First-run and upgrade use the same migration path; production stack drops the `docker-entrypoint-initdb.d` mounts

### Deployment

- [x] **DEP-01**: A `docker-compose.prod.yml` assembles the four production images + Postgres + Redis with persistent volumes and no committed secret defaults
- [x] **DEP-02**: `DEPLOYMENT_MODE=cloud|on-prem` read once at API boot; gates seed data + registration (open on cloud, closed after first-run on-prem)

### Installer

- [ ] **INS-01**: An installer/first-run flow generates `JWT_SECRET`+`ENCRYPTION_KEY`, creates one company + real admin, runs migrations, writes `DEPLOYMENT_MODE=on-prem`
- [ ] **INS-02**: Installer can optionally write a reachable local Gemma/Ollama endpoint into `company_ai_config` (`provider:'local'`)

### AI Integration

- [x] **AIL-01**: Backend can call a server-reachable `local` AI provider (not only the browser path), so an on-prem install gets full local-Gemma coverage of every AI feature

### Release & Upgrade

- [ ] **REL-01**: One whole-release version (`VERSION` file + git tag), stamped into images and reported by `/health`
- [ ] **REL-02**: `CHANGELOG.md` at repo root, one section per release, readable by the person running an upgrade; migration list generated from filenames
- [ ] **REL-03**: The 5-step upgrade procedure replaces the manual per-file `psql` instructions in `docs/DEPLOYMENT.md`

### Deploy Hardening

- [ ] **HRD-01**: CORS + Socket.IO origins restricted to env-configured app origins (not `*`)
- [ ] **HRD-02**: Rate limiting on `/api/auth/*` at minimum
- [ ] **HRD-03**: `/health` (or `/ready`) actually verifies Postgres + Redis reachability

### Documentation

- [ ] **DOC-01**: Customer-facing doc of the inbound-connectivity posture (reverse proxy exposing only `/api/webhooks/*` + `/api/pod/*`)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Licensing

- **LIC-01**: Offline seat/module gating (licensing/activation) — on-prem §8

### Cloud Scaling

- **SCALE-01**: Socket.IO Redis adapter for multi-replica API — cloud §3.4
- **SCALE-02**: Object storage for uploads (replacing local disk) — cloud §2

### AI

- **AIL-02**: Vectra-hosted AI tier (`vectra-hosted` provider) — ai-integration §6.3

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Licensing / activation (offline seat/module gating) | Real net-new work, its own later milestone — on-prem §8 |
| Socket.IO Redis adapter + object storage for uploads | Only needed when the API scales past one replica — a Cloud-scaling milestone, not on-prem GA |
| Vectra-hosted AI tier (`vectra-hosted` provider) | Cloud-side revenue feature, unrelated to on-prem deployability |
| Down-migrations | Backup-restore is the documented rollback, by design — release §6 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 14 | Complete |
| SEC-02 | Phase 14 | Complete |
| SEC-03 | Phase 14 | Complete |
| MIG-01 | Phase 15 | Complete |
| MIG-02 | Phase 15 + 16 | Complete |
| DEP-01 | Phase 16 | Complete |
| DEP-02 | Phase 16 | Complete |
| INS-01 | Phase 17 | Pending |
| INS-02 | Phase 17 | Pending |
| AIL-01 | Phase 18 | Complete |
| REL-01 | Phase 19 | Pending |
| REL-02 | Phase 19 | Pending |
| REL-03 | Phase 19 | Pending |
| HRD-01 | Phase 20 | Pending |
| HRD-02 | Phase 20 | Pending |
| HRD-03 | Phase 20 | Pending |
| DOC-01 | Phase 20 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17/17 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-12*
*Last updated: 2026-07-12 after roadmap creation — 17/17 requirements mapped to Phases 14-20*
