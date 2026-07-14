import { z } from 'zod';

// config is opaque per REC-03 — groupBy/subGroupBy/filters/sorts/
// cardProperties are not individually validated, the whole object round-trips.
export const CreateViewSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['board', 'table', 'calendar', 'gallery', 'list', 'timeline']).default('table'),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateViewDto = z.infer<typeof CreateViewSchema>;
