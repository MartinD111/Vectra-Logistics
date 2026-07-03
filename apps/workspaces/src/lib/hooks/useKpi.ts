'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { kpiApi, type CreateKpiRuleInput } from '@/lib/api/kpi.api';

const qk = {
  rules: ['kpi', 'rules'] as const,
  summary: (filters?: { user_id?: string; project_id?: string }) => ['kpi', 'summary', filters ?? {}] as const,
};

export function useKpiRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.rules,
    queryFn: kpiApi.listRules,
    enabled: !!user?.company_id,
    staleTime: 1000 * 30,
  });
}

export function useKpiSummary(filters?: { user_id?: string; project_id?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.summary(filters),
    queryFn: () => kpiApi.summary(filters),
    enabled: !!user?.company_id,
  });
}

export function useCreateKpiRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateKpiRuleInput) => kpiApi.createRule(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rules }),
  });
}

export function useUpdateKpiRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateKpiRuleInput> }) => kpiApi.updateRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rules }),
  });
}

export function useDeleteKpiRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => kpiApi.removeRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rules }),
  });
}

export function useRunKpiEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) =>
      kpiApi.evaluate(periodStart, periodEnd),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi', 'summary'] }),
  });
}
