'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { projectsApi, type ProjectPage } from '@/lib/api/projects.api';

const qk = {
  pages: (projectId: string) => ['project-pages', projectId] as const,
  allPages: ['project-pages', 'all'] as const,
  page: (pageId: string) => ['project-page', pageId] as const,
};

export function useProjectPages(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.pages(projectId),
    queryFn: () => projectsApi.listPages(projectId),
    enabled: !!user?.company_id && !!projectId,
    staleTime: 1000 * 30,
  });
}

/** All pages across every project in the company — powers the navbar's project/page hover menu. */
export function useAllProjectPages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.allPages,
    queryFn: projectsApi.listAllPages,
    enabled: !!user?.company_id,
    staleTime: 1000 * 30,
  });
}

export function useProjectPage(pageId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.page(pageId),
    queryFn: () => projectsApi.getPage(pageId),
    enabled: !!user?.company_id && !!pageId,
  });
}

export function useCreateProjectPage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; icon?: string | null; is_default?: boolean; parent_page_id?: string | null; config?: Record<string, unknown>; cover_image_url?: string | null; header_settings?: Record<string, unknown> }) =>
      projectsApi.createPage(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pages(projectId) });
      qc.invalidateQueries({ queryKey: qk.allPages });
    },
  });
}

export function useUpdateProjectPage(pageId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ title: string; icon: string | null; is_default: boolean; sort_order: number; parent_page_id: string | null; config: Record<string, unknown>; cover_image_url: string | null; header_settings: Record<string, unknown> }>) =>
      projectsApi.updatePage(pageId, data),
    onSuccess: (page: ProjectPage) => {
      qc.setQueryData(qk.page(pageId), page);
      qc.invalidateQueries({ queryKey: qk.pages(projectId) });
      qc.invalidateQueries({ queryKey: qk.allPages });
    },
  });
}

export function useDeleteProjectPage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => projectsApi.removePage(pageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pages(projectId) });
      qc.invalidateQueries({ queryKey: qk.allPages });
    },
  });
}
