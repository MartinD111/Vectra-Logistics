-- Migration: KPI rules framework. Apply after 007. Idempotent.
--
-- Source-agnostic KPI rules: `source_type` is plain TEXT (validated by a Zod
-- enum on the API side, not a DB enum) so new rule types can be added without
-- a migration — same approach as programs.type/status. kpi_results stores
-- computed values per user/period, even when the evaluator is a stub (status
-- 'unavailable') so the API/UI shape doesn't change once real evaluators land.

CREATE TABLE IF NOT EXISTS kpi_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  source_type       TEXT NOT NULL,
  target_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  target_user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  condition         JSONB NOT NULL DEFAULT '{}',
  weight            NUMERIC(5,2) NOT NULL DEFAULT 1,
  threshold         NUMERIC(5,2),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kpi_rules_company_idx ON kpi_rules (company_id, is_active);
CREATE INDEX IF NOT EXISTS kpi_rules_target_user_idx ON kpi_rules (target_user_id);

CREATE TABLE IF NOT EXISTS kpi_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id      UUID NOT NULL REFERENCES kpi_rules(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  actual_value NUMERIC(10,2),
  target_value NUMERIC(10,2),
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending|computed|unavailable
  detail       JSONB NOT NULL DEFAULT '{}',
  computed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kpi_results_rule_idx ON kpi_results (rule_id, period_start DESC);
CREATE INDEX IF NOT EXISTS kpi_results_user_idx ON kpi_results (user_id, period_start DESC);
