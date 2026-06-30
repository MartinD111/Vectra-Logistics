import { z } from 'zod';

export const CreateShipmentSchema = z.object({
  pickup_address: z.string().min(1, 'pickup_address is required'),
  pickup_lat: z.number({ error: 'pickup_lat is required' }),
  pickup_lng: z.number({ error: 'pickup_lng is required' }),
  delivery_address: z.string().min(1, 'delivery_address is required'),
  delivery_lat: z.number({ error: 'delivery_lat is required' }),
  delivery_lng: z.number({ error: 'delivery_lng is required' }),
  cargo_weight_kg: z.number().nonnegative(),
  cargo_volume_m3: z.number().nonnegative(),
  pallet_count: z.number().int().nonnegative(),
  cargo_type: z.string().min(1, 'cargo_type is required'),
  pickup_window_start: z.string().datetime({ message: 'pickup_window_start must be ISO datetime' }),
  pickup_window_end: z.string().datetime({ message: 'pickup_window_end must be ISO datetime' }),
  delivery_deadline: z.string().datetime({ message: 'delivery_deadline must be ISO datetime' }),
});

export type CreateShipmentDto = z.infer<typeof CreateShipmentSchema>;
