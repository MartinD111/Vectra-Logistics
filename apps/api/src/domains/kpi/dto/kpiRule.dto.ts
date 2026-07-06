import { z } from 'zod';

// Schema-level list of rule types. Only 'activity_volume' has a real evaluator
// today (see kpi.evaluators.ts); the rest are stubs — new source types can be
// added here without a migration since source_type is plain TEXT in the DB.
export const SOURCE_TYPES = [
  'outlook_calendar',
  'activity_volume',
  'credit_risk',
  'task_completion',
  'on_time_delivery',
  'response_time',
  'project_value',
] as const;

export const CreateKpiRuleSchema = z.object({
  name: z.string().min(1, 'name is required').max(120),
  description: z.string().max(2000).nullable().optional(),
  source_type: z.enum(SOURCE_TYPES),
  target_project_id: z.string().uuid().nullable().optional(),
  target_user_id: z.string().uuid().nullable().optional(),
  target_client_id: z.string().uuid().nullable().optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  weight: z.number().min(0).max(100).optional(),
  threshold: z.number().min(0).max(100).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const UpdateKpiRuleSchema = CreateKpiRuleSchema.partial();

export const RunEvaluationSchema = z.object({
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
});

export type CreateKpiRuleDto = z.infer<typeof CreateKpiRuleSchema>;
export type UpdateKpiRuleDto = z.infer<typeof UpdateKpiRuleSchema>;
export type RunEvaluationDto = z.infer<typeof RunEvaluationSchema>;
