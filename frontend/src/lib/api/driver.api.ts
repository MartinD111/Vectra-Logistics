import { apiFetch } from './client';
import { Shipment } from './marketplace.api';

// ── Types ──────────────────────────────────────────────────────────────────

export type DriverShipmentStatus =
  | 'assigned'
  | 'arrived_at_pickup'
  | 'loaded_en_route'
  | 'arrived_at_delivery'
  | 'completed';

export interface DriverActiveLoad extends Shipment {
  driver_id: string;
  vehicle_id: string;
  vehicle_license_plate: string;
  assigned_at: string;
}

export interface UpdateStatusDto {
  status: DriverShipmentStatus;
}

export interface SubmitPodDto {
  shipment_id: string;
  document: FormData;
}

export interface PodUploadResponse {
  shipment_id: string;
  document_url: string;
  uploaded_at: string;
}

export interface DriverHistoryEntry {
  id: string;
  shipment_id: string;
  pickup_address: string;
  delivery_address: string;
  cargo_type: string;
  final_status: string;
  completed_at: string;
  distance_km: number | null;
}

// ── API ────────────────────────────────────────────────────────────────────

const BASE = '/api/v1/driver';

export const driverApi = {
  getMyActiveLoad: () =>
    apiFetch<DriverActiveLoad | null>(`${BASE}/active-load`),

  updateStatus: (shipmentId: string, dto: UpdateStatusDto) =>
    apiFetch<Shipment>(`${BASE}/shipments/${shipmentId}/status`, 'PATCH', dto),

  submitPod: (shipmentId: string, formData: FormData) =>
    apiFetch<PodUploadResponse>(
      `${BASE}/shipments/${shipmentId}/pod`,
      'POST',
      formData,
    ),

  getHistory: () =>
    apiFetch<DriverHistoryEntry[]>(`${BASE}/history`),
};
