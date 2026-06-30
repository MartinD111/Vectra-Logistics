-- Migration: tenant Workspaces, generic workspace-type presets, and the
-- activity_events event spine. Apply after 002. Idempotent.
--
-- Constitution note (CLAUDE.md §1, §2, §5): a "workspace type" is TENANT-OWNED
-- preset DATA, never hardcoded platform logic. A preset only declares which
-- generic modules a workspace turns on. It carries no industry business rules,
-- codes, or lookup tables. The five seed rows below are editable examples
-- (is_system_seed = true) a tenant may clone, edit, or delete — they exist to
-- speed up setup, not to special-case any vertical in code.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Workspaces (tenant container) ────────────────────────────────────────────
-- One per company today; the schema allows several later. Branding lives here
-- (not on companies) so each tenant's header is a property of its workspace.
CREATE TABLE IF NOT EXISTS workspaces (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  -- branding (powers the custom header)
  logo_url       TEXT,
  primary_color  TEXT,
  accent_color   TEXT,
  header_title   TEXT,
  theme          JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspaces_company_idx ON workspaces (company_id);

-- ── Workspace presets (the generic "type" definition) ────────────────────────
-- company_id NULL  → shared/system seed preset (visible to everyone)
-- company_id set   → a tenant's own custom preset
-- enabled_modules  → generic module keys only (e.g. records, programs,
--                    templates, fleet, marketplace, documents, automations).
CREATE TABLE IF NOT EXISTS workspace_presets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  enabled_modules JSONB NOT NULL DEFAULT '[]',
  is_system_seed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_presets_company_idx ON workspace_presets (company_id);

-- ── Applied presets (a workspace can select MULTIPLE types) ───────────────────
CREATE TABLE IF NOT EXISTS workspace_applied_presets (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  preset_id     UUID NOT NULL REFERENCES workspace_presets(id) ON DELETE CASCADE,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, preset_id)
);

-- ── Activity events (the event spine; CLAUDE.md §3) ──────────────────────────
-- Append-only log every meaningful action writes to. Metrics read from here.
CREATE TABLE IF NOT EXISTS activity_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  verb          VARCHAR(100) NOT NULL,
  object_type   VARCHAR(100) NOT NULL,
  object_id     UUID,
  project_id    UUID,
  payload       JSONB NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_events_tenant_idx
  ON activity_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_verb_idx
  ON activity_events (tenant_id, verb, occurred_at DESC);

-- ── Seed example presets (editable examples — NOT platform logic) ────────────
-- Generic module bundles only. A tenant clones/edits/deletes these freely.
-- Inserted once; re-running the migration won't duplicate them.
INSERT INTO workspace_presets (name, description, icon, enabled_modules, is_system_seed)
SELECT v.name, v.description, v.icon, v.enabled_modules::jsonb, TRUE
FROM (VALUES
  ('Container spedition',     'Starter modules for container forwarding operations.', 'container',
     '["records","programs","templates","documents","marketplace"]'),
  ('Fleet management',        'Starter modules for managing your own vehicles and drivers.', 'truck',
     '["records","fleet","documents","automations","metrics"]'),
  ('Car spedition',           'Starter modules for vehicle transport operations.', 'car',
     '["records","programs","templates","documents","marketplace"]'),
  ('Animal stock spedition',  'Starter modules for livestock transport operations.', 'leaf',
     '["records","programs","templates","documents","automations"]'),
  ('Air spedition',           'Starter modules for air freight forwarding.', 'plane',
     '["records","programs","templates","documents","marketplace"]')
) AS v(name, description, icon, enabled_modules)
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_presets p WHERE p.is_system_seed = TRUE AND p.name = v.name
);
