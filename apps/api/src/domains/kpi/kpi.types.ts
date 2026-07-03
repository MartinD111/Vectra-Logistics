// Source-agnostic KPI rules. `source_type` selects a pluggable evaluator
// (kpi.evaluators.ts) that turns a rule + period into per-user results.

export interface KpiRule {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  source_type: string;
  target_project_id: string | null;
  target_user_id: string | null;
  condition: Record<string, unknown>;
  weight: number;
  threshold: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export type KpiResultStatus = 'pending' | 'computed' | 'unavailable';

export interface KpiResult {
  id: string;
  company_id: string;
  rule_id: string;
  user_id: string;
  period_start: Date;
  period_end: Date;
  actual_value: number | null;
  target_value: number | null;
  status: KpiResultStatus;
  detail: Record<string, unknown>;
  computed_at: Date | null;
  created_at: Date;
}

/** A result joined with its rule's name/source_type, for summary views. */
export interface KpiResultWithRule extends KpiResult {
  rule_name: string;
  source_type: string;
}

/** What an evaluator produces for one user, before persistence fields are added. */
export interface KpiEvaluatorOutput {
  user_id: string;
  actual_value: number | null;
  target_value: number | null;
  status: KpiResultStatus;
  detail: Record<string, unknown>;
}
