import { z } from 'zod';

// Selecting one or more workspace "types" (presets) for a workspace.
export const ApplyPresetsSchema = z.object({
  preset_ids: z.array(z.string().uuid()).min(1, 'select at least one workspace type'),
});

export type ApplyPresetsDto = z.infer<typeof ApplyPresetsSchema>;
