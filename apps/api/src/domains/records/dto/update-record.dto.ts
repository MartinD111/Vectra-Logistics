import { z } from 'zod';

// Same envelope stance as create-record.dto.ts's PageConfigSchema — the API
// validates only the version/blocks shape, not block semantics.
const PageConfigSchema = z.object({
  version: z.number().int(),
  blocks: z.array(z.unknown()),
}).catchall(z.unknown());

// Same fields as CreateRecordSchema minus collection_id (immutable after
// create), all optional, plus sort_order for drag-reordering.
export const UpdateRecordSchema = z.object({
  parent_record_id: z.string().uuid().nullable().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  body: PageConfigSchema.optional(),
  sort_order: z.number().int().optional(),
});
export type UpdateRecordDto = z.infer<typeof UpdateRecordSchema>;
