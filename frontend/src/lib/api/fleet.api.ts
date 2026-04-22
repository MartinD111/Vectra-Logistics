import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Driver {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  company_id: string;
  license_plate: string;
  vehicle_type: string;
  max_weight_kg: number;
  max_volume_m3: number;
  max_pallets: number;
  created_at: string;
  updated_at: string;
}

// ── Request DTOs ───────────────────────────────────────────────────────────

export interface CreateDriverDto {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  license_number?: string;
}

export interface UpdateDriverDto {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  license_number?: string;
  status?: 'active' | 'inactive' | 'on_leave';
}

export interface CreateVehicleDto {
  license_plate: string;
  vehicle_type: string;
  max_weight_kg?: number;
  max_volume_m3?: number;
  max_pallets?: number;
}

export interface UpdateVehicleDto {
  license_plate?: string;
  vehicle_type?: string;
  max_weight_kg?: number;
  max_volume_m3?: number;
  max_pallets?: number;
}

// ── API calls ──────────────────────────────────────────────────────────────

const BASE = '/api/v1/fleet';

export const fleetApi = {
  // Drivers
  getDrivers:    ()                              => api.get<Driver[]>(`${BASE}/drivers`),
  createDriver:  (dto: CreateDriverDto)          => api.post<Driver>(`${BASE}/drivers`, dto),
  updateDriver:  (id: string, dto: UpdateDriverDto) => api.put<Driver>(`${BASE}/drivers/${id}`, dto),
  deleteDriver:  (id: string)                    => api.delete<void>(`${BASE}/drivers/${id}`),

  // Vehicles
  getVehicles:   ()                              => api.get<Vehicle[]>(`${BASE}/vehicles`),
  createVehicle: (dto: CreateVehicleDto)         => api.post<Vehicle>(`${BASE}/vehicles`, dto),
  updateVehicle: (id: string, dto: UpdateVehicleDto) => api.put<Vehicle>(`${BASE}/vehicles/${id}`, dto),
  deleteVehicle: (id: string)                    => api.delete<void>(`${BASE}/vehicles/${id}`),
};
