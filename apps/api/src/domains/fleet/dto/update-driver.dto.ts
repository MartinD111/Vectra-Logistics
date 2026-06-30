import { z } from 'zod';

export const UpdateDriverSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  license_number: z.string().optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).optional(),
});

export type UpdateDriverDto = z.infer<typeof UpdateDriverSchema>;
