import { z } from 'zod';

// PageConfig is owned by the frontend (lib/projectPage/blocks.ts). The API
// only validates the envelope shape — same stance as programs.config.
const PageConfigSchema = z.object({
  version: z.number().int(),
  blocks: z.array(z.unknown()),
}).catchall(z.unknown());

// Page presentation settings, frontend-owned like config — envelope-validated.
const HeaderSettingsSchema = z.object({
  full_width: z.boolean().optional(),
  cover_position: z.number().min(0).max(100).optional(),
}).catchall(z.unknown());

export const CreatePageSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  icon: z.string().max(16).nullable().optional(),
  is_default: z.boolean().optional(),
  parent_page_id: z.string().uuid().nullable().optional(),
  config: PageConfigSchema.optional(),
  cover_image_url: z.string().max(2048).nullable().optional(),
  header_settings: HeaderSettingsSchema.optional(),
});

export const UpdatePageSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  icon: z.string().max(16).nullable().optional(),
  is_default: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  parent_page_id: z.string().uuid().nullable().optional(),
  config: PageConfigSchema.optional(),
  cover_image_url: z.string().max(2048).nullable().optional(),
  header_settings: HeaderSettingsSchema.optional(),
});

export type CreatePageDto = z.infer<typeof CreatePageSchema>;
export type UpdatePageDto = z.infer<typeof UpdatePageSchema>;
