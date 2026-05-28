import { z } from 'zod';

const SUPPORTED_PROVIDERS = [
  'samsara', 'geotab', 'webfleet', 'wialon', 'transporeon', 'alpega',
] as const;

export const SaveIntegrationSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS, {
    error: `provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`,
  }),
  api_key: z.string().min(1, 'api_key is required'),
});

export type SaveIntegrationDto = z.infer<typeof SaveIntegrationSchema>;
