'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fleetApi,
  type UpdateDriverDto,
  type UpdateVehicleDto,
} from './fleet.api';

export const fleetQk = {
  drivers: ['fleet', 'drivers'] as const,
  driver: (id: string) => ['fleet', 'driver', id] as const,
  vehicles: ['fleet', 'vehicles'] as const,
  vehicle: (id: string) => ['fleet', 'vehicle', id] as const,
};

export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: id ? fleetQk.driver(id) : ['fleet', 'driver', 'noop'],
    queryFn: () => fleetApi.getDriver(id!),
    enabled: !!id,
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: id ? fleetQk.vehicle(id) : ['fleet', 'vehicle', 'noop'],
    queryFn: () => fleetApi.getVehicle(id!),
    enabled: !!id,
  });
}

export function useUpdateDriver(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateDriverDto) => fleetApi.updateDriver(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetQk.driver(id) });
      qc.invalidateQueries({ queryKey: fleetQk.drivers });
    },
  });
}

export function useUpdateVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateVehicleDto) => fleetApi.updateVehicle(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetQk.vehicle(id) });
      qc.invalidateQueries({ queryKey: fleetQk.vehicles });
    },
  });
}
