import { z } from 'zod';

const color = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color')
  .nullable()
  .optional();

export const CreateFolderSchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  parent_id: z.string().uuid().nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  color,
});

export const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  icon: z.string().max(60).nullable().optional(),
  color,
});

export const MoveFolderSchema = z.object({
  parent_id: z.string().uuid().nullable(),
});

export type CreateFolderDto = z.infer<typeof CreateFolderSchema>;
export type UpdateFolderDto = z.infer<typeof UpdateFolderSchema>;
export type MoveFolderDto = z.infer<typeof MoveFolderSchema>;
