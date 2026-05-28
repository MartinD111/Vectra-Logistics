export interface Settlement {
  id: string;
  shipment_id: string;
  company_id: string;
  driver_id: string | null;
  gross_amount_eur: number;
  driver_share_pct: number;
  settlement_amount: number;
  platform_fee: number;
  settlement_status: 'pending' | 'approved' | 'paid';
  created_at: Date;
  updated_at: Date;
}
