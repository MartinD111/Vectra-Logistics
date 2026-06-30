'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantWorkspaceApi, type BrandingUpdate } from '@/lib/api/tenantWorkspace.api';

const qk = {
  current: ['workspace', 'current'] as const,
  presets: ['workspace', 'presets'] as const,
};

/** The caller company's workspace (with applied presets + union of modules). */
export function useCurrentWorkspace() {
  return useQuery({
    queryKey: qk.current,
    queryFn: tenantWorkspaceApi.getCurrent,
    staleTime: 1000 * 60 * 5,
    retry: false, // a 404 (no workspace yet) shouldn't retry
  });
}

/** System seed presets + the company's own custom presets. */
export function useWorkspacePresets() {
  return useQuery({
    queryKey: qk.presets,
    queryFn: tenantWorkspaceApi.listPresets,
    staleTime: 1000 * 60 * 10,
  });
}

export function useUpdateBranding(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: BrandingUpdate) => tenantWorkspaceApi.updateBranding(workspaceId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.current }),
  });
}

export function useApplyPresets(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (presetIds: string[]) => tenantWorkspaceApi.applyPresets(workspaceId, presetIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.current }),
  });
}

export function useRemovePreset(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (presetId: string) => tenantWorkspaceApi.removePreset(workspaceId, presetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.current }),
  });
}
