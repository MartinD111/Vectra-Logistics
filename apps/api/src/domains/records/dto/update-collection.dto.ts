import { z } from 'zod';

// Same shape as CreateCollectionSchema, but every field optional (partial patch).
const PropertyDefSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  type: z.enum([
    'text', 'number', 'date', 'select', 'multi-select', 'checkbox',
    'person', 'url', 'email', 'phone', 'files', 'relation',
  ]),
}).catchall(z.unknown());

export const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  schema: z.array(PropertyDefSchema).max(100).optional(),
});
export type UpdateCollectionDto = z.infer<typeof UpdateCollectionSchema>;
