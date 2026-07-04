'use client';

// Smart Inbox hooks: parse an email into a draft, and the live Drafts board
// (socket 'draft:new' / 'draft:updated' on the company room every dispatcher
// auto-joins).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import { inboxApi, type ShipmentDraft, type UpdateDraftInput } from '@/lib/api/inbox.api';

const qk = {
  drafts: (projectId?: string) => ['inbox-drafts', projectId ?? 'all'] as const,
  demoEmails: ['inbox-demo-emails'] as const,
};

export function useDemoEmails() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.demoEmails,
    queryFn: inboxApi.demoEmails,
    enabled: !!user?.company_id,
    staleTime: Infinity,
  });
}

/** Active drafts + live socket updates. */
export function useDrafts(projectId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.drafts(projectId),
    queryFn: () => inboxApi.listDrafts(projectId),
    enabled: !!user?.company_id,
  });

  const upsert = (draft: ShipmentDraft) => {
    if (projectId && draft.project_id !== projectId) return;
    qc.setQueryData<ShipmentDraft[]>(qk.drafts(projectId), (prev) => {
      const next = (prev ?? []).filter((d) => d.id !== draft.id);
      // Rejected drafts drop off the board.
      return draft.status === 'rejected' ? next : [draft, ...next];
    });
  };
  useSocketEvent<ShipmentDraft>('draft:new', upsert);
  useSocketEvent<ShipmentDraft>('draft:updated', upsert);

  return query;
}

export function useParseEmail(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { from?: string; subject?: string; body: string }) =>
      inboxApi.parse({ ...data, project_id: projectId ?? null }),
    onSuccess: ({ draft }) => {
      qc.setQueryData<ShipmentDraft[]>(qk.drafts(projectId), (prev) => {
        const next = (prev ?? []).filter((d) => d.id !== draft.id);
        return [draft, ...next];
      });
    },
  });
}

/** Reflect a mutated draft into the cached board (or drop it if rejected). */
function useDraftCacheSync(projectId?: string) {
  const qc = useQueryClient();
  return (draft: ShipmentDraft) => {
    qc.setQueryData<ShipmentDraft[]>(qk.drafts(projectId), (prev) => {
      const next = (prev ?? []).filter((d) => d.id !== draft.id);
      return draft.status === 'rejected' ? next : [draft, ...next];
    });
  };
}

export function useUpdateDraft(projectId?: string) {
  const sync = useDraftCacheSync(projectId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDraftInput }) => inboxApi.updateDraft(id, input),
    onSuccess: sync,
  });
}
export function useConfirmDraft(projectId?: string) {
  const sync = useDraftCacheSync(projectId);
  return useMutation({ mutationFn: (id: string) => inboxApi.confirmDraft(id), onSuccess: sync });
}
export function useRejectDraft(projectId?: string) {
  const sync = useDraftCacheSync(projectId);
  return useMutation({ mutationFn: (id: string) => inboxApi.rejectDraft(id), onSuccess: sync });
}
