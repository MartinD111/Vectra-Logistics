import { z } from 'zod';

export const DocumentFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  license_plate: z.string().optional(),
  doc_type: z.string().optional(),
});

export type DocumentFiltersDto = z.infer<typeof DocumentFiltersSchema>;
