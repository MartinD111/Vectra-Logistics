import { z } from 'zod';

// Same opaque-config stance as CreateViewSchema (REC-03) — every field optional
// (partial patch). No update-view.dto.ts existed from Plan 22-01; added here
// as a Rule 3 auto-fix (blocking issue: updateView has no schema to validate
// against) since the plan explicitly requires an updateView service method.
export const UpdateViewSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  type: z.enum(['board', 'table', 'calendar', 'gallery', 'list', 'timeline']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateViewDto = z.infer<typeof UpdateViewSchema>;
