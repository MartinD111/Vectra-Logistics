import { z } from 'zod';

// Geotab delivers a results array of LogRecord-like objects
export const GeotabWebhookSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),             // Geotab log record ID
      device: z.object({
        id: z.string(),           // Geotab device ID → maps to our vehicle
      }),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      speed: z.number().optional(),
      dateTime: z.string().optional(),
    }),
  ).optional(),
});

export type GeotabWebhookDto = z.infer<typeof GeotabWebhookSchema>;
