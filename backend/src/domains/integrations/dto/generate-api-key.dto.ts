import { z } from 'zod';

export const GenerateApiKeySchema = z.object({
  name: z.string().min(1).max(100).default('Default Key'),
});

export type GenerateApiKeyDto = z.infer<typeof GenerateApiKeySchema>;
