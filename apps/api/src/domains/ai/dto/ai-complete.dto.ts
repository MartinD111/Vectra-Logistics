import { z } from 'zod';

// A single completion request proxied to the company's configured CLOUD
// provider. `system` steers the model (e.g. "you generate mini-program JSON");
// `prompt` is the user's request. `json` asks the provider for a JSON object
// response where supported. Local providers are NOT routed here — the browser
// calls them directly.

export const AiCompleteSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required').max(20000),
  system: z.string().trim().max(20000).optional(),
  json: z.boolean().optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
});

export type AiCompleteDto = z.infer<typeof AiCompleteSchema>;
