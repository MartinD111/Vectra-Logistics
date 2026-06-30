import { db } from '../db';

// The event spine (CLAUDE.md §3). Every meaningful action writes one append-only
// row here from the SERVICE layer (never the frontend). Metrics read from this
// table, so payloads should be generous — capture whatever a future metric
// might need; under-capturing is the most expensive mistake to fix later.

export interface ActivityEventInput {
  tenantId: string;
  actorId?: string | null;
  verb: string;          // e.g. 'workspace.created', 'workspace.preset.applied'
  objectType: string;    // e.g. 'workspace', 'preset'
  objectId?: string | null;
  projectId?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Append a row to activity_events. Never throws into the caller's happy path —
 * a metrics-log failure must not break the action that triggered it.
 */
export async function recordEvent(e: ActivityEventInput): Promise<void> {
  try {
    await db.query(
      `INSERT INTO activity_events
         (tenant_id, actor_id, verb, object_type, object_id, project_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        e.tenantId,
        e.actorId ?? null,
        e.verb,
        e.objectType,
        e.objectId ?? null,
        e.projectId ?? null,
        JSON.stringify(e.payload ?? {}),
      ],
    );
  } catch (err) {
    console.error('[activityLog] failed to record event', e.verb, (err as Error).message);
  }
}
