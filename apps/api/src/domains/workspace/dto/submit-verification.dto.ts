import { z } from 'zod';

export const SubmitVerificationSchema = z.object({
  document_type: z.string().min(1, 'document_type is required'),
  file_url: z.string().min(1, 'file_url is required'),
});

export type SubmitVerificationDto = z.infer<typeof SubmitVerificationSchema>;
