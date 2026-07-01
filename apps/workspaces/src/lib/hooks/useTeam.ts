'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { teamApi, type AddMemberInput } from '@/lib/api/team.api';

const qk = {
  team: ['team'] as const,
  memberStats: (id: string) => ['team', id, 'stats'] as const,
};

export function useTeam() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.team,
    queryFn: teamApi.list,
    enabled: !!user?.company_id,
    staleTime: 1000 * 30,
  });
}

export function useMemberStats(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.memberStats(id ?? ''),
    queryFn: () => teamApi.stats(id as string),
    enabled: !!user?.company_id && !!id,
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddMemberInput) => teamApi.add(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.team }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => teamApi.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.team }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.team }),
  });
}
