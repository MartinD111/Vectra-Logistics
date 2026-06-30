import { apiFetch } from '@vectra/api-client';

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

export interface AssignmentCommunications {
  whatsapp: {
    phone:    string | null;
    text:     string;
    url:      string | null;
  };
  outlook: {
    to:       string;
    cc:       string;
    subject:  string;
    body:     string;
    mailto:   string;
  };
  aiGenerated: boolean;
}

export interface ShipmentWithComms extends Shipment {
  communications?: AssignmentCommunications;
}

export interface AssignShipmentResponse {
  shipment_id: string;
  vehicle_id: string;
  assigned_at: string;
}

export interface ArchiveLog {
  id: string;
  shipment_id: string;
  company_id: string;
  carrier_company_id: string | null;
  pickup_address: string;
  delivery_address: string;
  cargo_type: string | null;
  cargo_weight_kg: number | null;
  final_status: string;
  cmr_document_url: string | null;
  final_rate_eur: number | null;
  archived_at: string;
  driver_first_name: string | null;
  driver_last_name: string | null;
  vehicle_license_plate: string | null;
  settlement_amount: number | null;
  settlement_status: string | null;
}

export interface ShipmentMatch {
  capacity_id: string;
  score: number;
  detour_km?: number;
  rationale?: string;
  capacity?: Capacity;
}

export const marketplaceApi = {
  getShipments:   ()                            => apiFetch<Shipment[]>(`${BASE}/shipments`),
  getShipment:    (id: string)                  => apiFetch<Shipment>(`${BASE}/shipments/${id}`),
  getShipmentHistory: ()                        => apiFetch<ArchiveLog[]>(`${BASE}/shipments/history`),
  createShipment: (dto: CreateShipmentDto)      => apiFetch<Shipment>(`${BASE}/shipments`, 'POST', dto),
  cancelShipment: (id: string)                  => apiFetch<Shipment>(`${BASE}/shipments/${id}/cancel`, 'POST'),

  getCapacities:  ()                            => apiFetch<Capacity[]>(`${BASE}/capacities`),
  getCapacity:    (id: string)                  => apiFetch<Capacity>(`${BASE}/capacities/${id}`),
  createCapacity: (dto: CreateCapacityDto)      => apiFetch<Capacity>(`${BASE}/capacities`, 'POST', dto),
  cancelCapacity: (id: string)                  => apiFetch<Capacity>(`${BASE}/capacities/${id}/cancel`, 'POST'),

  // Calls into Python matching engine via backend proxy.
  getShipmentMatches: (shipmentId: string) =>
    apiFetch<ShipmentMatch[]>(`${BASE}/shipments/${shipmentId}/matches`),

  // TODO: implement POST /api/v1/marketplace/shipments/:shipmentId/assign on the backend
  assignShipmentToVehicle: (shipmentId: string, vehicleId: string) =>
    apiFetch<AssignShipmentResponse>(
      `${BASE}/shipments/${shipmentId}/assign`,
      'POST',
      { vehicle_id: vehicleId },
    ),

  bookShipment: (shipmentId: string, capacityId?: string) =>
    apiFetch<ShipmentWithComms>(
      `${BASE}/shipments/${shipmentId}/book`,
      'POST',
      capacityId ? { capacity_id: capacityId } : undefined,
    ),
};
