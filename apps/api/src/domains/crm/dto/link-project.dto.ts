import { z } from 'zod';

export const LinkProjectSchema = z.object({
  project_id: z.string().uuid(),
  override_rate_eur: z.number().min(0).max(1_000_000).nullable().optional(),
  override_responsible_employee_id: z.string().uuid().nullable().optional(),
  override_notes: z.string().max(2000).nullable().optional(),
});
export type LinkProjectDto = z.infer<typeof LinkProjectSchema>;
