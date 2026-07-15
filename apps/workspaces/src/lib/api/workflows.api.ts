import { apiFetch } from './client';

export type WorkflowStatus = 'draft' | 'active' | 'paused';
export type WorkflowRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type WorkflowStepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface WorkflowGraphV1 {
  version: 1;
  nodes: Array<
    | { id: string; kind: 'trigger.manual'; config: Record<string, never> }
    | { id: string; kind: 'action.notification.create'; config: { title: string; body?: string; target: 'self' } }
  >;
  edges: Array<{ from: string; to: string }>;
}

export interface Workflow {
  id: string;
  tenant_id: string;
  name: string;
  version: number;
  status: WorkflowStatus;
  graph: WorkflowGraphV1;
  validation_errors: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  last_run_status?: WorkflowRunStatus | null;
  last_run_at?: string | null;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_version: number;
  trigger_type: string;
  status: WorkflowRunStatus;
  idempotency_key: string;
  correlation_id: string;
  event_id: string;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_text: string | null;
  created_at: string;
}

export interface WorkflowRunStep {
  id: string;
  workflow_run_id: string;
  workflow_id: string;
  node_id: string;
  node_kind: string;
  step_order: number;
  status: WorkflowStepStatus;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_text: string | null;
  output: Record<string, unknown>;
}

export interface WorkflowRunDetail {
  run: WorkflowRun;
  steps: WorkflowRunStep[];
}

const BASE = '/api/v1/workflows';

export const workflowsApi = {
  list: () => apiFetch<{ workflows: Workflow[] }>(BASE).then((r) => r.workflows),
  get: (id: string) => apiFetch<{ workflow: Workflow }>(`${BASE}/${id}`).then((r) => r.workflow),
  create: (data: { name: string; graph: WorkflowGraphV1 }) =>
    apiFetch<{ workflow: Workflow }>(BASE, 'POST', data).then((r) => r.workflow),
  update: (id: string, data: { name: string; graph: WorkflowGraphV1 }) =>
    apiFetch<{ workflow: Workflow }>(`${BASE}/${id}`, 'PUT', data).then((r) => r.workflow),
  publish: (id: string) =>
    apiFetch<{ workflow: Workflow }>(`${BASE}/${id}/publish`, 'POST').then((r) => r.workflow),
  manualRun: (id: string, idempotencyKey: string) =>
    apiFetch<WorkflowRunDetail>(`${BASE}/${id}/manual-runs`, 'POST', { idempotency_key: idempotencyKey }),
  runDetail: (workflowId: string, runId: string) =>
    apiFetch<WorkflowRunDetail>(`${BASE}/${workflowId}/runs/${runId}`),
};
