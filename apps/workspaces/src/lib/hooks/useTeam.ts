'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { teamApi, type AddMemberInput } from '@/lib/api/team.api';

const qk = {
  team: ['team'] as const,
  memberStats: (id: string) => ['team', id, 'stats'] as const,
  assignments: (id: string) => ['team', id, 'assignments'] as const,
  projectMembers: (projectId: string) => ['team', 'by-project', projectId] as const,
};

export function useProjectMembers(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.projectMembers(projectId),
    queryFn: () => teamApi.listProjectMembers(projectId),
    enabled: !!user?.company_id && !!projectId,
    staleTime: 1000 * 30,
  });
}

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

export function useUpdateCustomRoleTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string | null }) => teamApi.updateCustomRoleTitle(id, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.team }),
  });
}

export function useMemberAssignments(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.assignments(id ?? ''),
    queryFn: () => teamApi.listAssignments(id as string),
    enabled: !!user?.company_id && !!id,
  });
}

export function useAssignProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { project_id: string; planned_pct: number }) => teamApi.assignProject(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assignments(id) }),
  });
}

export function useUpdateAssignment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, planned_pct }: { assignmentId: string; planned_pct: number }) =>
      teamApi.updateAssignment(id, assignmentId, planned_pct),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assignments(id) }),
  });
}

export function useRemoveAssignment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => teamApi.removeAssignment(id, assignmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assignments(id) }),
  });
}
