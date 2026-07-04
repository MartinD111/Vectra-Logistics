'use client';

// Hooks for the dispatcher widgets: live telematics snapshot (polled),
// spot-quote calculator, and the socket-driven exception radar.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import {
  fleetApi, type FleetException, type SpotQuoteEquipment,
} from '@/lib/api/fleet.api';

const qk = {
  telematics: ['fleet-telematics'] as const,
  exceptions: ['fleet-exceptions'] as const,
  quoteCities: ['fleet-quote-cities'] as const,
};

export function useTelematics(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.telematics,
    queryFn: fleetApi.telematics,
    enabled: enabled && !!user?.company_id,
    refetchInterval: 20_000, // demo positions move ~per minute; live providers push faster later
    staleTime: 10_000,
  });
}

export function useQuoteCities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.quoteCities,
    queryFn: fleetApi.quoteCities,
    enabled: !!user?.company_id,
    staleTime: Infinity,
  });
}

export function useSpotQuote() {
  return useMutation({
    mutationFn: (data: { origin: string; destination: string; equipment: SpotQuoteEquipment; margin_pct?: number }) =>
      fleetApi.spotQuote(data),
  });
}

/**
 * Active exceptions + live socket updates. The backend pushes 'exception:new' /
 * 'exception:resolved' to the company room every dispatcher auto-joins.
 */
export function useFleetExceptions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.exceptions,
    queryFn: fleetApi.listExceptions,
    enabled: !!user?.company_id,
    refetchInterval: 60_000, // safety net; the socket is the primary signal
  });

  useSocketEvent<FleetException>('exception:new', (exception) => {
    qc.setQueryData<FleetException[]>(qk.exceptions, (prev) =>
      prev ? [exception, ...prev.filter((e) => e.id !== exception.id)] : [exception]);
  });
  useSocketEvent<{ id: string }>('exception:resolved', ({ id }) => {
    qc.setQueryData<FleetException[]>(qk.exceptions, (prev) =>
      prev ? prev.filter((e) => e.id !== id) : prev);
  });

  return query;
}

export function useSimulateException() {
  return useMutation({ mutationFn: fleetApi.simulateException });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fleetApi.resolveException,
    onSuccess: (resolved) => {
      qc.setQueryData<FleetException[]>(qk.exceptions, (prev) =>
        prev ? prev.filter((e) => e.id !== resolved.id) : prev);
    },
  });
}
