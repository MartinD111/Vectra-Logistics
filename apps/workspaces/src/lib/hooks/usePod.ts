'use client';

// POD hooks: the live proof-of-delivery board. New requests and driver uploads
// push over the company socket room (pod:new / pod:delivered).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent, type PodRequestEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import { podApi, type PodRequest } from '@/lib/api/pod.api';

const qk = { requests: ['pod-requests'] as const };

export function usePodRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.requests,
    queryFn: podApi.list,
    enabled: !!user?.company_id,
    refetchInterval: 60_000,
  });

  const upsert = (req: PodRequest) => {
    qc.setQueryData<PodRequest[]>(qk.requests, (prev) => {
      const next = (prev ?? []).filter((r) => r.id !== req.id);
      return [req, ...next];
    });
  };
  useSocketEvent<PodRequestEvent>('pod:new', (r) => upsert(r as unknown as PodRequest));
  useSocketEvent<PodRequestEvent>('pod:delivered', (r) => upsert(r as unknown as PodRequest));

  return query;
}

export function useCreatePodRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; driver_phone?: string | null; client_id?: string | null; agreed_rate_eur?: number | null }) => podApi.create(data),
    onSuccess: (req) => qc.setQueryData<PodRequest[]>(qk.requests, (prev) => [req, ...(prev ?? []).filter((r) => r.id !== req.id)]),
  });
}

export function useSimulateArrival() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => podApi.simulateArrival(),
    onSuccess: (req) => qc.setQueryData<PodRequest[]>(qk.requests, (prev) => [req, ...(prev ?? []).filter((r) => r.id !== req.id)]),
  });
}
