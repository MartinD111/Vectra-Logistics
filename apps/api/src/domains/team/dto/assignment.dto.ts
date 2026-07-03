import { z } from 'zod';

export const AssignProjectSchema = z.object({
  project_id: z.string().uuid(),
  planned_pct: z.number().min(0).max(100),
});

export const UpdateAssignmentSchema = z.object({
  planned_pct: z.number().min(0).max(100),
});

export type AssignProjectDto = z.infer<typeof AssignProjectSchema>;
export type UpdateAssignmentDto = z.infer<typeof UpdateAssignmentSchema>;
