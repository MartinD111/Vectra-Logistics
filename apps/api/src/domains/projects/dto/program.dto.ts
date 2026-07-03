import { z } from 'zod';

export const CreateProgramSchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  description: z.string().max(2000).nullable().optional(),
  type: z.enum(['transform', 'document', 'import', 'dashboard']).optional(),
  project_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateProgramSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProgramDto = z.infer<typeof CreateProgramSchema>;
export type UpdateProgramDto = z.infer<typeof UpdateProgramSchema>;
