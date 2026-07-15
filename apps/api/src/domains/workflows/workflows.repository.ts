import type { PoolClient } from 'pg';
import { db } from '../../core/db';
import type {
  WorkflowGraphV1,
  WorkflowRow,
  WorkflowRunDetail,
  WorkflowRunRow,
  WorkflowRunStepRow,
  WorkflowStatus,
  WorkflowStepStatus,
} from './workflows.types';

class WorkflowsRepository {
  async list(tenantId: string): Promise<WorkflowRow[]> {
    const { rows } = await db.query<WorkflowRow>(
      `SELECT w.*,
              lr.status AS last_run_status,
              lr.created_at AS last_run_at
       FROM workflows w
       LEFT JOIN LATERAL (
         SELECT status, created_at
         FROM workflow_runs
         WHERE tenant_id = w.tenant_id AND workflow_id = w.id
         ORDER BY created_at DESC
         LIMIT 1
       ) lr ON TRUE
       WHERE w.tenant_id = $1
       ORDER BY w.updated_at DESC`,
      [tenantId],
    );
    return rows;
  }

  async find(id: string, tenantId: string): Promise<WorkflowRow | null> {
    const { rows } = await db.query<WorkflowRow>(
      `SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async create(input: {
    tenantId: string;
    name: string;
    graph: WorkflowGraphV1;
    userId: string | null;
  }): Promise<WorkflowRow> {
    const { rows } = await db.query<WorkflowRow>(
      `INSERT INTO workflows (tenant_id, name, graph, validation_errors, created_by, updated_by)
       VALUES ($1, $2, $3, '[]', $4, $4)
       RETURNING *`,
      [input.tenantId, input.name, JSON.stringify(input.graph), input.userId],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: {
    name: string;
    graph: WorkflowGraphV1;
    userId: string | null;
  }): Promise<WorkflowRow | null> {
    const { rows } = await db.query<WorkflowRow>(
      `UPDATE workflows
       SET name = $3,
           graph = $4,
           validation_errors = '[]',
           updated_by = $5,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, input.name, JSON.stringify(input.graph), input.userId],
    );
    return rows[0] ?? null;
  }

  async setStatus(id: string, tenantId: string, status: WorkflowStatus, userId: string | null): Promise<WorkflowRow | null> {
    const { rows } = await db.query<WorkflowRow>(
      `UPDATE workflows
       SET status = $3,
           updated_by = $4,
           published_at = CASE WHEN $3 = 'active' THEN NOW() ELSE published_at END,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, status, userId],
    );
    return rows[0] ?? null;
  }

  async createOrFindManualRun(client: PoolClient, input: {
    tenantId: string;
    workflowId: string;
    workflowVersion: number;
    idempotencyKey: string;
    correlationId: string;
    eventId: string;
    userId: string | null;
  }): Promise<{ run: WorkflowRunRow; created: boolean }> {
    const { rows } = await client.query<WorkflowRunRow>(
      `INSERT INTO workflow_runs
         (tenant_id, workflow_id, workflow_version, trigger_type, status, idempotency_key,
          correlation_id, event_id, created_by)
       VALUES ($1, $2, $3, 'manual', 'queued', $4, $5, $6, $7)
       ON CONFLICT (tenant_id, workflow_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.tenantId,
        input.workflowId,
        input.workflowVersion,
        input.idempotencyKey,
        input.correlationId,
        input.eventId,
        input.userId,
      ],
    );
    if (rows[0]) return { run: rows[0], created: true };

    const existing = await client.query<WorkflowRunRow>(
      `SELECT * FROM workflow_runs
       WHERE tenant_id = $1 AND workflow_id = $2 AND idempotency_key = $3`,
      [input.tenantId, input.workflowId, input.idempotencyKey],
    );
    const run = existing.rows[0];
    if (!run) {
      throw new Error('Manual workflow run idempotency lookup failed');
    }
    return { run, created: false };
  }

  async markRunRunning(client: PoolClient, runId: string, tenantId: string): Promise<WorkflowRunRow> {
    const { rows } = await client.query<WorkflowRunRow>(
      `UPDATE workflow_runs
       SET status = 'running',
           attempts = attempts + 1,
           started_at = COALESCE(started_at, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [runId, tenantId],
    );
    return rows[0];
  }

  async markRunComplete(
    client: PoolClient,
    runId: string,
    tenantId: string,
    status: 'succeeded' | 'failed',
    errorText: string | null,
  ): Promise<WorkflowRunRow> {
    const { rows } = await client.query<WorkflowRunRow>(
      `UPDATE workflow_runs
       SET status = $3,
           completed_at = CASE WHEN $3 = 'succeeded' THEN NOW() ELSE completed_at END,
           failed_at = CASE WHEN $3 = 'failed' THEN NOW() ELSE failed_at END,
           error_text = $4,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [runId, tenantId, status, errorText],
    );
    return rows[0];
  }

  async insertStep(client: PoolClient, input: {
    tenantId: string;
    workflowRunId: string;
    workflowId: string;
    nodeId: string;
    nodeKind: string;
    stepOrder: number;
    status: WorkflowStepStatus;
    attempts: number;
    errorText?: string | null;
    output?: Record<string, unknown>;
  }): Promise<WorkflowRunStepRow> {
    const { rows } = await client.query<WorkflowRunStepRow>(
      `INSERT INTO workflow_run_steps
         (tenant_id, workflow_run_id, workflow_id, node_id, node_kind, step_order, status,
          attempts, started_at, completed_at, failed_at, error_text, output)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(),
               CASE WHEN $7 = 'succeeded' THEN NOW() ELSE NULL END,
               CASE WHEN $7 = 'failed' THEN NOW() ELSE NULL END,
               $9, $10)
       RETURNING *`,
      [
        input.tenantId,
        input.workflowRunId,
        input.workflowId,
        input.nodeId,
        input.nodeKind,
        input.stepOrder,
        input.status,
        input.attempts,
        input.errorText ?? null,
        JSON.stringify(input.output ?? {}),
      ],
    );
    return rows[0];
  }

  async runDetail(workflowId: string, runId: string, tenantId: string): Promise<WorkflowRunDetail | null> {
    const runResult = await db.query<WorkflowRunRow>(
      `SELECT * FROM workflow_runs WHERE id = $1 AND workflow_id = $2 AND tenant_id = $3`,
      [runId, workflowId, tenantId],
    );
    const run = runResult.rows[0];
    if (!run) return null;

    const stepResult = await db.query<WorkflowRunStepRow>(
      `SELECT * FROM workflow_run_steps
       WHERE workflow_run_id = $1 AND workflow_id = $2 AND tenant_id = $3
       ORDER BY step_order ASC`,
      [runId, workflowId, tenantId],
    );
    return { run, steps: stepResult.rows };
  }
}

export const workflowsRepository = new WorkflowsRepository();
