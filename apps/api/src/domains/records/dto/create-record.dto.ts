import { z } from 'zod';

// PageConfig envelope is duplicated locally rather than imported from
// projects/dto/page.dto.ts, matching the existing convention that crm does
// not cross-import from projects. Body content is frontend-owned (same
// stance as project_pages.config) — only the version/blocks envelope shape
// is validated here.
const PageConfigSchema = z.object({
  version: z.number().int(),
  blocks: z.array(z.unknown()),
}).catchall(z.unknown());

export const CreateRecordSchema = z.object({
  collection_id: z.string().uuid(),
  parent_record_id: z.string().uuid().nullable().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  body: PageConfigSchema.optional(),
});
export type CreateRecordDto = z.infer<typeof CreateRecordSchema>;
