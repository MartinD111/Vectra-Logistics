import { z } from 'zod';

export const CreateDriverSchema = z.object({
  first_name: z.string().min(1, 'first_name is required'),
  last_name: z.string().min(1, 'last_name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  license_number: z.string().optional(),
});

export type CreateDriverDto = z.infer<typeof CreateDriverSchema>;
