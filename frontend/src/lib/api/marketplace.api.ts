import { apiFetch } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

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
  /** ISO 8601 datetime string */
  pickup_window_start: string;
  /** ISO 8601 datetime string */
  pickup_window_end: string;
  /** ISO 8601 datetime string */
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
  /** ISO 8601 datetime string */
  departure_time: string;
  /** ISO 8601 datetime string */
  delivery_deadline: string;
  available_weight_kg: number;
  available_volume_m3: number;
  available_pallets: number;
  route_polyline?: string;
}

// ── API ────────────────────────────────────────────────────────────────────

const BASE = '/api/v1/marketplace';

export interface AssignShipmentResponse {
  shipment_id: string;
  vehicle_id: string;
  assigned_at: string;
}

export const marketplaceApi = {
  getShipments:   ()                            => apiFetch<Shipment[]>(`${BASE}/shipments`),
  createShipment: (dto: CreateShipmentDto)      => apiFetch<Shipment>(`${BASE}/shipments`, 'POST', dto),

  getCapacities:  ()                            => apiFetch<Capacity[]>(`${BASE}/capacities`),
  createCapacity: (dto: CreateCapacityDto)      => apiFetch<Capacity>(`${BASE}/capacities`, 'POST', dto),

  // TODO: implement POST /api/v1/marketplace/shipments/:shipmentId/assign on the backend
  assignShipmentToVehicle: (shipmentId: string, vehicleId: string) =>
    apiFetch<AssignShipmentResponse>(
      `${BASE}/shipments/${shipmentId}/assign`,
      'POST',
      { vehicle_id: vehicleId },
    ),

  bookShipment: (shipmentId: string) =>
    apiFetch<Shipment>(`${BASE}/shipments/${shipmentId}/book`, 'POST'),
};
