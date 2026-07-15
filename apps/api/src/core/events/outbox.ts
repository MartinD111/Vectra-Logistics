import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';

export type DurableEventStatus = 'pending' | 'publishing' | 'published' | 'failed';

export interface DurableEventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  envelopeVersion: 1;
  tenantId: string;
  actorId: string | null;
  objectType: string;
  objectId: string;
  projectId: string | null;
  causationId: string | null;
  correlationId: string | null;
  payloadVersion: number;
  payload: TPayload;
}

export interface DurableEventInput<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventName: string;
  tenantId: string;
  actorId?: string | null;
  objectType: string;
  objectId: string;
  projectId?: string | null;
  causationId?: string | null;
  correlationId?: string | null;
  payloadVersion?: number;
  payload: TPayload;
}

export interface EventOutboxRow<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  tenant_id: string;
  event_id: string;
  event_name: string;
  envelope_version: number;
  actor_id: string | null;
  object_type: string;
  object_id: string;
  project_id: string | null;
  causation_id: string | null;
  correlation_id: string | null;
  payload_version: number;
  payload: TPayload;
  status: DurableEventStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  locked_at: Date | null;
  locked_by: string | null;
  published_at: Date | null;
  failed_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export function createDurableEventEnvelope<TPayload extends Record<string, unknown>>(
  input: DurableEventInput<TPayload>,
): DurableEventEnvelope<TPayload> {
  return {
    eventId: randomUUID(),
    eventName: input.eventName,
    envelopeVersion: 1,
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    objectType: input.objectType,
    objectId: input.objectId,
    projectId: input.projectId ?? null,
    causationId: input.causationId ?? null,
    correlationId: input.correlationId ?? null,
    payloadVersion: input.payloadVersion ?? 1,
    payload: input.payload,
  };
}

export async function insertDurableEvent<TPayload extends Record<string, unknown>>(
  client: PoolClient,
  event: DurableEventEnvelope<TPayload>,
): Promise<EventOutboxRow<TPayload>> {
  const { rows } = await client.query<EventOutboxRow<TPayload>>(
    `INSERT INTO event_outbox
       (event_id, tenant_id, event_name, envelope_version, actor_id, object_type, object_id,
        project_id, causation_id, correlation_id, payload_version, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (tenant_id, event_id) DO NOTHING
     RETURNING *`,
    [
      event.eventId,
      event.tenantId,
      event.eventName,
      event.envelopeVersion,
      event.actorId,
      event.objectType,
      event.objectId,
      event.projectId,
      event.causationId,
      event.correlationId,
      event.payloadVersion,
      JSON.stringify(event.payload),
    ],
  );

  if (!rows[0]) {
    throw new Error(`Duplicate durable event ignored: ${event.eventId}`);
  }
  return rows[0];
}
