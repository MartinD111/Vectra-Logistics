export interface Driver {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Vehicle {
  id: string;
  company_id: string;
  license_plate: string;
  vehicle_type: string;
  max_weight_kg: number;
  max_volume_m3: number;
  max_pallets: number;
  created_at: Date;
  updated_at: Date;
}
