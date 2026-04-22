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
  pickup_window_start: Date;
  pickup_window_end: Date;
  delivery_deadline: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
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
  departure_time: Date;
  delivery_deadline: Date;
  available_weight_kg: number;
  available_volume_m3: number;
  available_pallets: number;
  route_polyline: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}
