import { z } from 'zod';

export const AddMemberSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  role: z.enum(['carrier', 'shipper', 'admin']),
  phone: z.string().max(50).nullable().optional(),
  // Admin sets an initial password the new member uses to sign in (no email
  // infra yet). The member can change it later.
  password: z.string().min(8, 'password must be at least 8 characters'),
});

export const UpdateRoleSchema = z.object({
  role: z.enum(['carrier', 'shipper', 'admin']),
});

export type AddMemberDto = z.infer<typeof AddMemberSchema>;
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;
