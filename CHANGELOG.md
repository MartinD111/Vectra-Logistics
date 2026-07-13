# Changelog

Migration lists per release are generated via `scripts/list-release-migrations.sh <previous-tag>`.

## v3.0 - On-Premise GA - Unreleased

Makes Vectra deployable and self-upgradeable at a customer's own site as a first-class configuration of the same codebase used for Cloud — migration runner, production compose + `DEPLOYMENT_MODE`, installer/first-run flow, backend-side local AI provider, and release versioning/upgrade docs.

### Migrations

No new migration files have shipped since `v2.0` (verified via `git diff v2.0..HEAD --name-only -- database/migrations/`, which is empty as of this phase).

## v2.0 - 2026-07-12 - Workspace Engine — Engine Unification

Unifies the Notion-like Project Pages and Mini Programs block systems onto one generic, plugin-driven `WorkspaceBlockRegistry` engine.

### Migrations

No new migration files shipped since `v1.0` (verified via `git diff v1.0..v2.0 --name-only -- database/migrations/`, empty).

## v1.0 - 2026-07-06 - CRM Rework

A dedicated CRM module: dashboard, client detail pages, per-project overrides, bulk Excel import, real Outlook email sync, and a KPI-driven credit-risk semaphore hard-blocking over-limit load assignment.

### Migrations

- `002_realtime_and_documents.sql`
- `003_workspaces_and_presets.sql`
- `004_projects_and_programs.sql`
- `005_ai_config.sql`
- `006_folders.sql`
- `007_team_assignments_and_roles.sql`
- `008_kpi_rules.sql`
- `009_project_pages.sql`
- `010_calendar_events.sql`
- `011_email_campaigns.sql`
- `012_page_hierarchy.sql`
- `013_page_header.sql`
- `014_dispatcher_widgets.sql`
- `015_smart_inbox.sql`
- `016_yard_management.sql`
- `017_seed_admin_user.sql`
- `018_field_execution.sql`
- `019_crm_billing.sql`
- `020_ltl_matching.sql`
- `021_crm_extensions.sql`
- `022_client_pages.sql`
- `023_email_messages_client_unique.sql`
- `024_kpi_target_client.sql`
