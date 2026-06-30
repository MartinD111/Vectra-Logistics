import { z } from 'zod';

export const AssignShipmentSchema = z.object({
  vehicle_id: z.string().uuid({ message: 'vehicle_id must be a valid UUID' }),
});

export type AssignShipmentDto = z.infer<typeof AssignShipmentSchema>;
