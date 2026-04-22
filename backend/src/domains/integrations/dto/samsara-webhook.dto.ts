import { z } from 'zod';

// Samsara sends an array of events under `data`
export const SamsaraWebhookSchema = z.object({
  eventType: z.string(),
  eventId: z.string().optional(),
  data: z.object({
    object: z.object({
      id: z.string(),           // Samsara vehicle ID
      gps: z.object({
        latitude: z.number(),
        longitude: z.number(),
        speedMilesPerHour: z.number().optional(),
        headingDegrees: z.number().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export type SamsaraWebhookDto = z.infer<typeof SamsaraWebhookSchema>;
