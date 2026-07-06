import { z } from 'zod';
import { CreateClientPageSchema } from './create-client-page.dto';

// All fields on CreateClientPageSchema are already optional, so the update
// shape is identical — re-exported directly rather than duplicated.
export const UpdateClientPageSchema = CreateClientPageSchema;

export type UpdateClientPageDto = z.infer<typeof UpdateClientPageSchema>;
