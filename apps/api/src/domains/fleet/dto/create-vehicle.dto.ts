import { z } from 'zod';

export const CreateVehicleSchema = z.object({
  license_plate: z.string().min(1, 'license_plate is required'),
  vehicle_type: z.string().min(1, 'vehicle_type is required'),
  max_weight_kg: z.number().nonnegative().default(0),
  max_volume_m3: z.number().nonnegative().default(0),
  max_pallets: z.number().int().nonnegative().default(0),
});

export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;
