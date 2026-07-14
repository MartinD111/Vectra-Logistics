import { z } from 'zod';

// Property definition shape mirrors records.types.ts's CollectionPropertyDef.
// `.catchall(z.unknown())` allows type-specific extra fields (e.g. select
// options) without the API needing to model each property type's config.
const PropertyDefSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  type: z.enum([
    'text', 'number', 'date', 'select', 'multi-select', 'checkbox',
    'person', 'url', 'email', 'phone', 'files', 'relation',
  ]),
}).catchall(z.unknown());

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(160),
  // .max(100) is defense-in-depth against JSONB payload DoS (T-22-01).
  schema: z.array(PropertyDefSchema).max(100).optional(),
});
export type CreateCollectionDto = z.infer<typeof CreateCollectionSchema>;
