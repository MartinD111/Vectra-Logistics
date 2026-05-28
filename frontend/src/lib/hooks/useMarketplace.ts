'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marketplaceApi,
  type CreateShipmentDto,
  type CreateCapacityDto,
} from '@/lib/api/marketplace.api';
import { fleetApi } from '@/lib/api/fleet.api';

export const qk = {
  shipments: ['marketplace', 'shipments'] as const,
  shipment: (id: string) => ['marketplace', 'shipments', id] as const,
  capacities: ['marketplace', 'capacities'] as const,
  capacity: (id: string) => ['marketplace', 'capacities', id] as const,
  matches: (shipmentId: string) => ['marketplace', 'matches', shipmentId] as const,
  vehicles: ['fleet', 'vehicles'] as const,
};

export function useShipments() {
  return useQuery({ queryKey: qk.shipments, queryFn: marketplaceApi.getShipments });
}

export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.shipment(id) : ['marketplace', 'shipment', 'noop'],
    queryFn: () => marketplaceApi.getShipment(id!),
    enabled: !!id,
  });
}

export function useCapacities() {
  return useQuery({ queryKey: qk.capacities, queryFn: marketplaceApi.getCapacities });
}

export function useCapacity(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.capacity(id) : ['marketplace', 'capacity', 'noop'],
    queryFn: () => marketplaceApi.getCapacity(id!),
    enabled: !!id,
  });
}

export function useShipmentMatches(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.matches(id) : ['marketplace', 'matches', 'noop'],
    queryFn: () => marketplaceApi.getShipmentMatches(id!),
    enabled: !!id,
    retry: 0,
  });
}

export function useVehicles() {
  return useQuery({ queryKey: qk.vehicles, queryFn: fleetApi.getVehicles });
}

export function useCreateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateShipmentDto) => marketplaceApi.createShipment(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipments }),
  });
}

export function useCreateCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCapacityDto) => marketplaceApi.createCapacity(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.capacities }),
  });
}

export function useBookShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shipmentId, capacityId }: { shipmentId: string; capacityId?: string }) =>
      marketplaceApi.bookShipment(shipmentId, capacityId),
    onSuccess: (_, { shipmentId }) => {
      qc.invalidateQueries({ queryKey: qk.shipments });
      qc.invalidateQueries({ queryKey: qk.shipment(shipmentId) });
    },
  });
}

export function useCancelShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketplaceApi.cancelShipment(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: qk.shipments });
      qc.invalidateQueries({ queryKey: qk.shipment(id) });
    },
  });
}

export function useCancelCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketplaceApi.cancelCapacity(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: qk.capacities });
      qc.invalidateQueries({ queryKey: qk.capacity(id) });
    },
  });
}
