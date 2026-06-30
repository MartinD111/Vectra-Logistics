import { z } from 'zod';

export const UpdateVehicleSchema = z.object({
  license_plate: z.string().min(1).optional(),
  vehicle_type: z.string().min(1).optional(),
  max_weight_kg: z.number().nonnegative().optional(),
  max_volume_m3: z.number().nonnegative().optional(),
  max_pallets: z.number().int().nonnegative().optional(),
});

export type UpdateVehicleDto = z.infer<typeof UpdateVehicleSchema>;
