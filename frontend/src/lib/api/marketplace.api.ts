import { api } from './client';

// ── Types (mirror of backend marketplace.types.ts) ─────────────────────────

export interface Shipment {
  id: string;
  user_id: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  cargo_weight_kg: number;
  cargo_volume_m3: number;
  pallet_count: number;
  cargo_type: string;
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_deadline: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Capacity {
  id: string;
  user_id: string;
  vehicle_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  departure_time: string;
  delivery_deadline: string;
  available_weight_kg: number;
  available_volume_m3: number;
  available_pallets: number;
  route_polyline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── Request DTOs ───────────────────────────────────────────────────────────

export interface CreateShipmentDto {
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  cargo_weight_kg: number;
  cargo_volume_m3: number;
  pallet_count: number;
  cargo_type: string;
  /** ISO datetime string */
  pickup_window_start: string;
  /** ISO datetime string */
  pickup_window_end: string;
  /** ISO datetime string */
  delivery_deadline: string;
}

export interface CreateCapacityDto {
  vehicle_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  /** ISO datetime string */
  departure_time: string;
  /** ISO datetime string */
  delivery_deadline: string;
  available_weight_kg: number;
  available_volume_m3: number;
  available_pallets: number;
  route_polyline?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

const BASE = '/api/v1/marketplace';

export const marketplaceApi = {
  // Shipments
  getShipments: ()                          => api.get<Shipment[]>(`${BASE}/shipments`),
  createShipment: (dto: CreateShipmentDto)  => api.post<Shipment>(`${BASE}/shipments`, dto),

  // Capacities
  getCapacities: ()                         => api.get<Capacity[]>(`${BASE}/capacities`),
  createCapacity: (dto: CreateCapacityDto)  => api.post<Capacity>(`${BASE}/capacities`, dto),
};
