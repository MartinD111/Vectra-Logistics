'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { projectsApi } from '@/lib/api/projects.api';

const qk = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  stats: (id: string) => ['projects', id, 'stats'] as const,
  programs: (projectId?: string) => ['programs', projectId ?? 'all'] as const,
};

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
  });
}

export function useProject(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.project(id),
    queryFn: () => projectsApi.get(id),
    enabled: !!user?.company_id && !!id,
  });
}

export function useProjectStats(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.stats(id),
    queryFn: () => projectsApi.stats(id),
    enabled: !!user?.company_id && !!id,
    staleTime: 1000 * 30,
  });
}

export function usePrograms(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.programs(projectId),
    queryFn: () => projectsApi.listPrograms(projectId),
    enabled: !!user?.company_id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects }),
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createProgram,
    onSuccess: (program) => {
      qc.invalidateQueries({ queryKey: ['programs'] });
      qc.invalidateQueries({ queryKey: qk.projects });
      if (program.project_id) qc.invalidateQueries({ queryKey: qk.stats(program.project_id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects }),
  });
}
