import { z } from 'zod';

const color = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color')
  .nullable()
  .optional();

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  description: z.string().max(2000).nullable().optional(),
  color,
  folder_id: z.string().uuid().nullable().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  color,
  folder_id: z.string().uuid().nullable().optional(),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;
