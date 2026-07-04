import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  subject: z.string().min(1, 'subject is required').max(200),
  body_html: z.string().min(1, 'body is required').max(20000),
  recipients: z.array(z.string().email()).min(1, 'at least one recipient is required').max(500),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
