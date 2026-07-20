'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { foldersApi } from '@/lib/api/folders.api';

const qk = {
  folders: ['folders'] as const,
  fullTree: ['folders', 'tree', 'full'] as const,
};

export function useFolderTree() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.folders,
    queryFn: foldersApi.tree,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
  });
}

export function useFullTree() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.fullTree,
    queryFn: foldersApi.getFullTree,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60,
  });
}

function invalidateFolderAffectedQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.folders });
  qc.invalidateQueries({ queryKey: ['projects'] });
  qc.invalidateQueries({ queryKey: ['programs'] });
  qc.invalidateQueries({ queryKey: qk.fullTree });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foldersApi.create,
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; icon: string | null; color: string | null }> }) =>
      foldersApi.update(id, data),
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) => foldersApi.move(id, parentId),
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foldersApi.remove,
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useArchiveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foldersApi.archive,
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useUnarchiveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foldersApi.unarchive,
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useReorderTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foldersApi.reorder,
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}

export function useMoveTreeNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foldersApi.moveNode,
    onSuccess: () => invalidateFolderAffectedQueries(qc),
  });
}
