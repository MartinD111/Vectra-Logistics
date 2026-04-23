import { z } from 'zod';
import { VALID_DRIVER_STATUSES } from '../driver.types';

export const UpdateStatusSchema = z.object({
  status: z.string().refine(
    (v) => VALID_DRIVER_STATUSES.has(v),
    { message: `status must be one of: ${[...VALID_DRIVER_STATUSES].join(', ')}` },
  ),
});

export type UpdateStatusDto = z.infer<typeof UpdateStatusSchema>;
