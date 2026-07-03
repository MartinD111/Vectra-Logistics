-- Migration: Custom role titles + project assignments. Apply after 006. Idempotent.
--
-- custom_role_title is a free-text display/grouping label a company can set
-- per member (e.g. "Dispatcher", "Fleet Manager") — it does NOT replace or
-- affect the existing `role` permission enum (carrier/shipper/admin).
--
-- project_assignments links a team member to a project with a planned %
-- of their workday, later compared against actual time spent (KPI rules,
-- migration 008) to compute utilization.

ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_title TEXT;

CREATE TABLE IF NOT EXISTS project_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planned_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (planned_pct >= 0 AND planned_pct <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_assignments_company_idx ON project_assignments (company_id);
CREATE INDEX IF NOT EXISTS project_assignments_user_idx ON project_assignments (user_id);
CREATE INDEX IF NOT EXISTS project_assignments_project_idx ON project_assignments (project_id);
