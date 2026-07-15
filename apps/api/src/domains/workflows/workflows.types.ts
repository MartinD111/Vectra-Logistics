export type WorkflowStatus = 'draft' | 'active' | 'paused';
export type WorkflowRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type WorkflowStepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface ManualTriggerNode {
  id: string;
  kind: 'trigger.manual';
  config: Record<string, never>;
}

export interface NotificationActionNode {
  id: string;
  kind: 'action.notification.create';
  config: {
    title: string;
    body?: string;
    target: 'self';
  };
}

export type WorkflowGraphNode = ManualTriggerNode | NotificationActionNode;

export interface WorkflowGraphV1 {
  version: 1;
  nodes: WorkflowGraphNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface WorkflowRow {
  id: string;
  tenant_id: string;
  name: string;
  version: number;
  status: WorkflowStatus;
  graph: WorkflowGraphV1;
  validation_errors: string[];
  created_by: string | null;
  updated_by: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  last_run_status?: WorkflowRunStatus | null;
  last_run_at?: Date | null;
}

export interface WorkflowRunRow {
  id: string;
  tenant_id: string;
  workflow_id: string;
  workflow_version: number;
  trigger_type: string;
  status: WorkflowRunStatus;
  idempotency_key: string;
  correlation_id: string;
  event_id: string;
  attempts: number;
  started_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
  error_text: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowRunStepRow {
  id: string;
  tenant_id: string;
  workflow_run_id: string;
  workflow_id: string;
  node_id: string;
  node_kind: string;
  step_order: number;
  status: WorkflowStepStatus;
  attempts: number;
  started_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
  error_text: string | null;
  output: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowRunDetail {
  run: WorkflowRunRow;
  steps: WorkflowRunStepRow[];
}
