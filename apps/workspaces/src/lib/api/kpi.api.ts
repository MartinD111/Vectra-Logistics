import { apiFetch } from './client';

export const SOURCE_TYPES = [
  'outlook_calendar',
  'activity_volume',
  'task_completion',
  'on_time_delivery',
  'response_time',
  'project_value',
] as const;

export type KpiSourceType = (typeof SOURCE_TYPES)[number];

export interface KpiRule {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  source_type: KpiSourceType;
  target_project_id: string | null;
  target_user_id: string | null;
  condition: Record<string, unknown>;
  weight: number;
  threshold: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type KpiResultStatus = 'pending' | 'computed' | 'unavailable';

export interface KpiResult {
  id: string;
  company_id: string;
  rule_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  actual_value: number | null;
  target_value: number | null;
  status: KpiResultStatus;
  detail: Record<string, unknown>;
  computed_at: string | null;
  created_at: string;
}

export interface KpiResultWithRule extends KpiResult {
  rule_name: string;
  source_type: KpiSourceType;
}

export interface CreateKpiRuleInput {
  name: string;
  description?: string | null;
  source_type: KpiSourceType;
  target_project_id?: string | null;
  target_user_id?: string | null;
  condition?: Record<string, unknown>;
  weight?: number;
  threshold?: number | null;
  is_active?: boolean;
}

const BASE = '/api/v1/kpi';

export const kpiApi = {
  listRules: () => apiFetch<{ rules: KpiRule[] }>(`${BASE}/rules`).then((r) => r.rules),
  createRule: (data: CreateKpiRuleInput) =>
    apiFetch<{ rule: KpiRule }>(`${BASE}/rules`, 'POST', data).then((r) => r.rule),
  updateRule: (id: string, data: Partial<CreateKpiRuleInput>) =>
    apiFetch<{ rule: KpiRule }>(`${BASE}/rules/${id}`, 'PATCH', data).then((r) => r.rule),
  removeRule: (id: string) => apiFetch<void>(`${BASE}/rules/${id}`, 'DELETE'),

  evaluate: (periodStart: string, periodEnd: string) =>
    apiFetch<{ results: KpiResult[] }>(`${BASE}/evaluate`, 'POST', { period_start: periodStart, period_end: periodEnd })
      .then((r) => r.results),

  summary: (filters?: { user_id?: string; project_id?: string }) => {
    const qs = new URLSearchParams(filters as Record<string, string>).toString();
    return apiFetch<{ summary: KpiResultWithRule[] }>(`${BASE}/summary${qs ? `?${qs}` : ''}`).then((r) => r.summary);
  },
};
