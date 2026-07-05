import { CreateClientSchema } from './create-client.dto';

export const UpdateClientSchema = CreateClientSchema.partial();
export type UpdateClientDto = typeof UpdateClientSchema.type;
