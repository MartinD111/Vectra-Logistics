// ── Enums ─────────────────────────────────────────────────────────────────────

export type DriverShipmentStatus =
  | 'assigned'
  | 'arrived_at_pickup'
  | 'loaded_en_route'
  | 'arrived_at_delivery'
  | 'completed';

export const DRIVER_STATUS_TRANSITIONS: Record<DriverShipmentStatus, DriverShipmentStatus | null> = {
  assigned:             'arrived_at_pickup',
  arrived_at_pickup:    'loaded_en_route',
  loaded_en_route:      'arrived_at_delivery',
  arrived_at_delivery:  'completed',
  completed:            null,
};

export const VALID_DRIVER_STATUSES = new Set<string>(Object.keys(DRIVER_STATUS_TRANSITIONS));

// ── Entities ──────────────────────────────────────────────────────────────────

export interface DriverActiveLoad {
  // Shipment fields
  id: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  cargo_weight_kg: number;
  cargo_volume_m3: number | null;
  pallet_count: number | null;
  cargo_type: string | null;
  pickup_window_start: Date | null;
  pickup_window_end: Date | null;
  delivery_deadline: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
  // Assignment enrichment
  driver_id: string | null;
  vehicle_id: string;
  vehicle_license_plate: string;
  assigned_at: Date;
}

export interface DriverHistoryEntry {
  id: string;
  shipment_id: string;
  pickup_address: string;
  delivery_address: string;
  cargo_type: string | null;
  final_status: string;
  completed_at: Date;
  distance_km: number | null;
}

export interface PodDocument {
  id: string;
  shipment_id: string;
  driver_id: string | null;
  file_url: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: Date;
}

export interface StatusLogEntry {
  id: string;
  shipment_id: string;
  driver_id: string | null;
  from_status: string | null;
  to_status: string;
  recorded_at: Date;
}
