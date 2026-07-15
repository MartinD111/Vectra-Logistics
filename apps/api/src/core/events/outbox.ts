import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { db } from '../db';

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

export async function claimDueEvents(workerId: string, limit = 25): Promise<EventOutboxRow[]> {
  const { rows } = await db.query<EventOutboxRow>(
    `WITH due AS (
       SELECT id
       FROM event_outbox
       WHERE attempts < max_attempts
         AND (
           (status = 'pending' AND next_attempt_at <= NOW())
           OR (status = 'publishing' AND locked_at < NOW() - INTERVAL '5 minutes')
         )
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE event_outbox e
     SET status = 'publishing',
         attempts = e.attempts + 1,
         locked_at = NOW(),
         locked_by = $2,
         updated_at = NOW(),
         last_error = NULL
     FROM due
     WHERE e.id = due.id
     RETURNING e.*`,
    [limit, workerId],
  );
  return rows;
}

export async function markEventPublished(eventId: string): Promise<void> {
  await db.query(
    `UPDATE event_outbox
     SET status = 'published',
         published_at = NOW(),
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW(),
         last_error = NULL
     WHERE id = $1 AND status = 'publishing'`,
    [eventId],
  );
}

export async function markEventPublishFailed(event: EventOutboxRow, err: unknown): Promise<void> {
  const lastError = err instanceof Error ? err.message : String(err);
  const shouldFail = event.attempts >= event.max_attempts;
  const nextAttemptMinutes = Math.min(60, Math.max(1, Math.pow(2, event.attempts - 1)));

  await db.query(
    `UPDATE event_outbox
     SET status = $2,
         failed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE failed_at END,
         next_attempt_at = CASE WHEN $2 = 'pending' THEN NOW() + ($3::TEXT || ' minutes')::INTERVAL ELSE next_attempt_at END,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW(),
         last_error = $4
     WHERE id = $1 AND status = 'publishing'`,
    [event.id, shouldFail ? 'failed' : 'pending', nextAttemptMinutes, lastError.slice(0, 2000)],
  );
}

async function projectActivityEvent(client: PoolClient, event: EventOutboxRow): Promise<void> {
  await client.query(
    `INSERT INTO activity_events
       (tenant_id, actor_id, verb, object_type, object_id, project_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.tenant_id,
      event.actor_id,
      event.event_name,
      event.object_type,
      event.object_id,
      event.project_id,
      JSON.stringify({
        ...event.payload,
        durable_event_id: event.event_id,
        envelope_version: event.envelope_version,
        payload_version: event.payload_version,
      }),
    ],
  );
}

export async function publishDurableEvent(event: EventOutboxRow): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (event.event_name === 'records.collection.created') {
      await projectActivityEvent(client, event);
    }

    await client.query(
      `UPDATE event_outbox
       SET status = 'published',
           published_at = NOW(),
           locked_at = NULL,
           locked_by = NULL,
           updated_at = NOW(),
           last_error = NULL
       WHERE id = $1 AND status = 'publishing'`,
      [event.id],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function dispatchDueEvents(workerId: string, limit = 25): Promise<{
  claimed: number;
  published: number;
  failed: number;
  retryScheduled: number;
}> {
  const events = await claimDueEvents(workerId, limit);
  let published = 0;
  let failed = 0;
  let retryScheduled = 0;

  for (const event of events) {
    try {
      await publishDurableEvent(event);
      published += 1;
    } catch (err) {
      await markEventPublishFailed(event, err);
      if (event.attempts >= event.max_attempts) {
        failed += 1;
      } else {
        retryScheduled += 1;
      }
    }
  }

  return { claimed: events.length, published, failed, retryScheduled };
}
