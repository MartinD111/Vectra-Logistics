import { z } from 'zod';

const ManualTriggerNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('trigger.manual'),
  config: z.record(z.string(), z.never()).default({}),
});

const NotificationActionNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('action.notification.create'),
  config: z.object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(1000).optional(),
    target: z.literal('self'),
  }),
});

export const WorkflowGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.union([ManualTriggerNodeSchema, NotificationActionNodeSchema])).min(2),
  edges: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })),
});

export const SaveWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(160),
  graph: WorkflowGraphSchema,
});

export const ManualRunSchema = z.object({
  idempotency_key: z.string().trim().min(1).max(200).optional(),
});

export type SaveWorkflowDto = z.infer<typeof SaveWorkflowSchema>;
export type ManualRunDto = z.infer<typeof ManualRunSchema>;
