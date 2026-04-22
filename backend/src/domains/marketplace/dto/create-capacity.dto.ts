import { z } from 'zod';

export const CreateCapacitySchema = z.object({
  vehicle_id: z.string().uuid('vehicle_id must be a valid UUID'),
  origin_address: z.string().min(1, 'origin_address is required'),
  origin_lat: z.number({ error: 'origin_lat is required' }),
  origin_lng: z.number({ error: 'origin_lng is required' }),
  destination_address: z.string().min(1, 'destination_address is required'),
  destination_lat: z.number({ error: 'destination_lat is required' }),
  destination_lng: z.number({ error: 'destination_lng is required' }),
  departure_time: z.string().datetime({ message: 'departure_time must be ISO datetime' }),
  delivery_deadline: z.string().datetime({ message: 'delivery_deadline must be ISO datetime' }),
  available_weight_kg: z.number().nonnegative(),
  available_volume_m3: z.number().nonnegative(),
  available_pallets: z.number().int().nonnegative(),
  route_polyline: z.string().optional(),
});

export type CreateCapacityDto = z.infer<typeof CreateCapacitySchema>;
