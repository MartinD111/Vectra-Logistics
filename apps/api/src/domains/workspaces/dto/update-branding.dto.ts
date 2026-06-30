import { z } from 'zod';

// Hex color or null. Branding lives on the workspace and powers the header.
const colorField = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #16a34a')
  .nullable()
  .optional();

export const UpdateBrandingSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logo_url: z.string().url().nullable().optional(),
  primary_color: colorField,
  accent_color: colorField,
  header_title: z.string().max(120).nullable().optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateBrandingDto = z.infer<typeof UpdateBrandingSchema>;
