import { z } from 'zod';

export const ParsedRateResponseSchema = z.object({
  pickup_address:   z.string().min(1),
  pickup_date:      z.string().datetime({ message: 'pickup_date must be ISO 8601' }),
  delivery_address: z.string().min(1),
  delivery_date:    z.string().datetime({ message: 'delivery_date must be ISO 8601' }),
  cargo_weight_kg:  z.number().nonnegative(),
  cargo_type:       z.string().min(1),
  rate_amount:      z.number().nonnegative(),
  currency:         z.string().length(3).default('EUR'),
  reference_id:     z.string().optional(),
  confidence:       z.number().min(0).max(1).default(1),
});

export type ParsedRateResponseDto = z.infer<typeof ParsedRateResponseSchema>;
