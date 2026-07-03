import { z } from 'zod';

export const AddMemberSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  role: z.enum(['carrier', 'shipper', 'admin']),
  custom_role_title: z.string().max(80).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  // Admin sets an initial password the new member uses to sign in (no email
  // infra yet). The member can change it later.
  password: z.string().min(8, 'password must be at least 8 characters'),
});

export const UpdateRoleSchema = z.object({
  role: z.enum(['carrier', 'shipper', 'admin']),
});

// Free-text display/grouping label — does NOT affect the `role` permission enum.
export const UpdateCustomRoleTitleSchema = z.object({
  custom_role_title: z.string().max(80).nullable(),
});

export type AddMemberDto = z.infer<typeof AddMemberSchema>;
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;
export type UpdateCustomRoleTitleDto = z.infer<typeof UpdateCustomRoleTitleSchema>;
