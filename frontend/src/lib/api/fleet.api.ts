import { apiFetch } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Driver {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  status: 'active' | 'inactive' | 'on_leave';
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
  status?: Driver['status'];
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

// ── API ────────────────────────────────────────────────────────────────────

const BASE = '/api/v1/fleet';

export const fleetApi = {
  // Drivers
  getDrivers:    ()                                    => apiFetch<Driver[]>(`${BASE}/drivers`),
  createDriver:  (dto: CreateDriverDto)                => apiFetch<Driver>(`${BASE}/drivers`, 'POST', dto),
  updateDriver:  (id: string, dto: UpdateDriverDto)    => apiFetch<Driver>(`${BASE}/drivers/${id}`, 'PUT', dto),
  deleteDriver:  (id: string)                          => apiFetch<void>(`${BASE}/drivers/${id}`, 'DELETE'),

  // Vehicles
  getVehicles:   ()                                    => apiFetch<Vehicle[]>(`${BASE}/vehicles`),
  createVehicle: (dto: CreateVehicleDto)               => apiFetch<Vehicle>(`${BASE}/vehicles`, 'POST', dto),
  updateVehicle: (id: string, dto: UpdateVehicleDto)   => apiFetch<Vehicle>(`${BASE}/vehicles/${id}`, 'PUT', dto),
  deleteVehicle: (id: string)                          => apiFetch<void>(`${BASE}/vehicles/${id}`, 'DELETE'),
};
