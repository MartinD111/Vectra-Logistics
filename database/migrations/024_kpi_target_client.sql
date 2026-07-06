-- Migration: kpi_rules gains target_client_id so a rule can target a single
-- client (client-subject evaluators, e.g. credit_risk) the same way
-- target_project_id/target_user_id already target a project or user.
-- Apply after 023. Idempotent.

ALTER TABLE kpi_rules ADD COLUMN IF NOT EXISTS target_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS kpi_rules_target_client_idx
  ON kpi_rules (target_client_id) WHERE target_client_id IS NOT NULL;
