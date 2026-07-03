import { z } from 'zod';

// Saving AI config. `apiKey` is optional on update: when omitted (or empty)
// the existing stored key is kept — the UI never round-trips the secret back.
// Local providers require an endpoint URL and supply no api key.

export const SaveAiConfigSchema = z
  .object({
    provider: z.enum(['openai', 'gemini', 'local']),
    model: z.string().trim().max(120).optional(),
    apiKey: z.string().trim().max(400).optional(),
    localEndpoint: z.string().trim().url('Local endpoint must be a valid URL').max(400).optional(),
    localModel: z.string().trim().max(120).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.provider === 'local' && !val.localEndpoint) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['localEndpoint'], message: 'Local endpoint URL is required for a local provider' });
    }
  });

export type SaveAiConfigDto = z.infer<typeof SaveAiConfigSchema>;
