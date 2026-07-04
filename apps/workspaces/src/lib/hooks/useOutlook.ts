'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { outlookApi } from '@/lib/api/outlook.api';

const qk = ['outlook', 'status'] as const;

export function useOutlookStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk,
    queryFn: outlookApi.status,
    enabled: !!user?.company_id,
    staleTime: 1000 * 30,
  });
}

export function useConnectOutlook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: outlookApi.connect,
    onSuccess: (result) => {
      if (result.mode === 'redirect') {
        window.location.href = result.authorizeUrl; // real OAuth: go to Microsoft
      } else {
        qc.invalidateQueries({ queryKey: qk }); // demo: refresh status
      }
    },
  });
}

export function useDisconnectOutlook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: outlookApi.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });
}

export function useSyncOutlookCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: outlookApi.syncCalendar,
    onSuccess: () => qc.invalidateQueries({ predicate: (q) => q.queryKey.includes('calendar') }),
  });
}
