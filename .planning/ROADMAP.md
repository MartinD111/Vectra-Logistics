# Roadmap: Vectra

## Milestones

- ✅ **v1.0 CRM Rework** — Phases 1-6 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Workspace Engine — Engine Unification** — Phases 7-13 (shipped 2026-07-12) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 On-Premise GA** — Phases 14-20 (shipped 2026-07-13) — [archive](milestones/v3.0-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 CRM Rework (Phases 1-6) — SHIPPED 2026-07-06</summary>

- [x] Phase 1: Schema & CRM Domain Foundation (3/3 plans) — completed 2026-07-05
- [x] Phase 2: CRM Dashboard, Navigation & Client Detail (4/4 plans) — completed 2026-07-06
- [x] Phase 3: Per-Project Client Overrides (2/2 plans) — completed 2026-07-06
- [x] Phase 4: Bulk Excel Import (2/2 plans) — completed 2026-07-06
- [x] Phase 5: Email History Sync (2/2 plans) — completed 2026-07-06
- [x] Phase 6: Credit-Risk KPI Evaluator & Semaphore (2/2 plans) — completed 2026-07-06

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Workspace Engine — Engine Unification (Phases 7-13) — SHIPPED 2026-07-12</summary>

- [x] Phase 7: Engine Foundation + Page Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 8: Page Read-Rendering → Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 9: Page Edit-Mode + Slash → Registry (1/1 plans) — completed 2026-07-06
- [x] Phase 10: Mini Program onto the Engine (1/1 plans) — completed 2026-07-06
- [x] Phase 11: Palette Derivation Unification (1/1 plans) — completed 2026-07-11
- [x] Phase 12: Extensibility Proof (2/2 plans) — completed 2026-07-11
- [x] Phase 13: Cleanup, ADR & Park WorkflowBuilder (1/1 plans) — completed 2026-07-12

Full detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Milestone audit: [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) — status: tech_debt (14/14 requirements satisfied, no functional gaps; missing VERIFICATION.md for phases 7-11 backfillable via `/gsd:validate-phase`)

</details>

<details>
<summary>✅ v3.0 On-Premise GA (Phases 14-20) — SHIPPED 2026-07-13</summary>

- [x] Phase 14: Security Hardening (2/2 plans) — completed 2026-07-12
- [x] Phase 15: Migration Runner (1/1 plans) — completed 2026-07-12
- [x] Phase 16: Production Compose + DEPLOYMENT_MODE (2/2 plans) — completed 2026-07-12
- [x] Phase 17: Installer / First-Run Flow (3/3 plans) — completed 2026-07-12
- [x] Phase 18: Backend-side Local AI Provider (1/1 plans) — completed 2026-07-12
- [x] Phase 19: Release Versioning & Upgrade Docs (3/3 plans) — completed 2026-07-13
- [x] Phase 20: Deploy Hardening + Connectivity Doc (4/4 plans) — completed 2026-07-13

Full detail: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)
Milestone audit: [milestones/v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) — status: passed (17/17 requirements satisfied; 2 cross-phase integration blockers found and fixed inline during audit — see report)

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17 → 18 → 19 → 20

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema & CRM Domain Foundation | v1.0 | 3/3 | Complete | 2026-07-05 |
| 2. CRM Dashboard, Navigation & Client Detail | v1.0 | 4/4 | Complete | 2026-07-06 |
| 3. Per-Project Client Overrides | v1.0 | 2/2 | Complete | 2026-07-06 |
| 4. Bulk Excel Import | v1.0 | 2/2 | Complete | 2026-07-06 |
| 5. Email History Sync | v1.0 | 2/2 | Complete | 2026-07-06 |
| 6. Credit-Risk KPI Evaluator & Semaphore | v1.0 | 2/2 | Complete | 2026-07-06 |
| 7. Engine Foundation + Page Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 8. Page Read-Rendering → Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 9. Page Edit-Mode + Slash → Registry | v2.0 | 1/1 | Complete | 2026-07-06 |
| 10. Mini Program onto the Engine | v2.0 | 1/1 | Complete | 2026-07-06 |
| 11. Palette Derivation Unification | v2.0 | 1/1 | Complete | 2026-07-11 |
| 12. Extensibility Proof | v2.0 | 2/2 | Complete | 2026-07-11 |
| 13. Cleanup, ADR & Park WorkflowBuilder | v2.0 | 1/1 | Complete | 2026-07-12 |
| 14. Security Hardening | v3.0 | 2/2 | Complete    | 2026-07-12 |
| 15. Migration Runner | v3.0 | 1/1 | Complete   | 2026-07-12 |
| 16. Production Compose + DEPLOYMENT_MODE | v3.0 | 2/2 | Complete    | 2026-07-12 |
| 17. Installer / First-Run Flow | v3.0 | 3/3 | Complete   | 2026-07-12 |
| 18. Backend-side Local AI Provider | v3.0 | 1/1 | Complete   | 2026-07-12 |
| 19. Release Versioning & Upgrade Docs | v3.0 | 3/3 | Complete    | 2026-07-13 |
| 20. Deploy Hardening + Connectivity Doc | v3.0 | 4/4 | Complete    | 2026-07-13 |

---
*Roadmap created: 2026-07-05 · v1.0 archived: 2026-07-06 · v2.0 archived: 2026-07-12 · v3.0 archived: 2026-07-13*
