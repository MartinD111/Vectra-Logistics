'use client';

// Yard hooks: the spatial layout (zones/slots/assets) and the railway terminal
// board, both live over the company socket room (gate check-ins push
// 'yard:asset', wagon moves push 'yard:wagon').

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent, type YardAssetEvent, type RailWagonEvent } from '@vectra/data';
import { useAuth } from '@/context/AuthContext';
import {
  yardApi, type YardLayout, type YardAsset, type RailWagon, type ZoneKind, type AssetKind, type WagonStatus,
} from '@/lib/api/yard.api';

const qk = {
  layout: (projectId?: string) => ['yard-layout', projectId ?? 'all'] as const,
  wagons: (projectId?: string) => ['yard-wagons', projectId ?? 'all'] as const,
};

export function useYardLayout(projectId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.layout(projectId),
    queryFn: () => yardApi.layout(projectId),
    enabled: !!user?.company_id,
  });

  // Live gate check-ins / moves: upsert the asset into the cached layout.
  useSocketEvent<YardAssetEvent>('yard:asset', (asset) => {
    qc.setQueryData<YardLayout>(qk.layout(projectId), (prev) => {
      if (!prev) return prev;
      const assets = prev.assets.filter((a) => a.id !== asset.id);
      // Reflect slot occupancy so the map paints the slot as taken.
      const slots = prev.slots.map((s) => {
        if (asset.slot_id && s.id === asset.slot_id) return { ...s, status: 'occupied' as const };
        // free any slot this asset vacated
        if (prev.assets.find((a) => a.id === asset.id)?.slot_id === s.id && asset.slot_id !== s.id) return { ...s, status: 'free' as const };
        return s;
      });
      return { ...prev, assets: [...assets, asset as unknown as YardAsset], slots };
    });
  });

  return query;
}

export function useCreateZone(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; kind: ZoneKind; slots?: number }) => yardApi.createZone(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.layout(projectId) }),
  });
}

export function useDeleteZone(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => yardApi.deleteZone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.layout(projectId) }),
  });
}

export function useCreateAsset(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { kind: AssetKind; label: string; identifier?: string | null }) => yardApi.createAsset(data),
    onSuccess: (asset) => {
      qc.setQueryData<YardLayout>(qk.layout(projectId), (prev) =>
        prev ? { ...prev, assets: [...prev.assets.filter((a) => a.id !== asset.id), asset] } : prev);
    },
  });
}

export function useMoveAsset(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, x, y, slot_id }: { id: string; x?: number; y?: number; slot_id?: string | null }) =>
      yardApi.moveAsset(id, { x, y, slot_id }),
    onSuccess: (asset) => {
      qc.setQueryData<YardLayout>(qk.layout(projectId), (prev) => {
        if (!prev) return prev;
        const prevAsset = prev.assets.find((a) => a.id === asset.id);
        const slots = prev.slots.map((s) => {
          if (asset.slot_id === s.id) return { ...s, status: 'occupied' as const };
          if (prevAsset?.slot_id === s.id && asset.slot_id !== s.id) return { ...s, status: 'free' as const };
          return s;
        });
        return { ...prev, assets: prev.assets.map((a) => (a.id === asset.id ? asset : a)), slots };
      });
    },
  });
}

// ── Railway terminal ──

export function useWagons(projectId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.wagons(projectId),
    queryFn: () => yardApi.listWagons(projectId),
    enabled: !!user?.company_id,
  });

  useSocketEvent<RailWagonEvent>('yard:wagon', (wagon) => {
    qc.setQueryData<RailWagon[]>(qk.wagons(projectId), (prev) => {
      const next = (prev ?? []).filter((w) => w.id !== wagon.id);
      return [...next, wagon as unknown as RailWagon];
    });
  });

  return query;
}

export function useUpdateWagon(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, seq }: { id: string; status?: WagonStatus; seq?: number }) =>
      yardApi.updateWagon(id, { status, seq }),
    onSuccess: (wagon) => {
      qc.setQueryData<RailWagon[]>(qk.wagons(projectId), (prev) =>
        (prev ?? []).map((w) => (w.id === wagon.id ? wagon : w)));
    },
  });
}
