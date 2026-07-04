'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { campaignsApi, type CreateCampaignInput } from '@/lib/api/campaigns.api';

const qk = {
  list: (projectId?: string) => ['campaigns', projectId ?? 'all'] as const,
  detail: (id: string) => ['campaigns', 'detail', id] as const,
};

export function useCampaigns(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.list(projectId),
    queryFn: () => campaignsApi.list(projectId),
    enabled: !!user?.company_id,
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30,
  });
}

export function useCampaign(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.detail(id),
    queryFn: () => campaignsApi.get(id),
    enabled: !!user?.company_id && !!id,
    refetchInterval: 1000 * 30,
  });
}

export function useCreateCampaign(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCampaignInput) => campaignsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.list(projectId) }),
  });
}
