import { z } from 'zod';

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(160),
  country: z.string().min(2).max(2),
  vat_id: z.string().max(20).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  credit_limit: z.number().min(0).max(10_000_000).optional(),
  default_rate_eur: z.number().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  responsible_employee_id: z.string().uuid().nullable().optional(),
});
export type CreateClientDto = z.infer<typeof CreateClientSchema>;
