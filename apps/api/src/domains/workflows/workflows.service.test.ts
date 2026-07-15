import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { db } from '../../core/db';
import { RequestContext } from '../../core/auth/request-context';
import { notificationsService } from '../notifications/notifications.service';
import { workflowsRepository } from './workflows.repository';
import { workflowsService } from './workflows.service';
import type { WorkflowGraphV1, WorkflowRow, WorkflowRunRow, WorkflowRunStepRow } from './workflows.types';

afterEach(() => {
  mock.restoreAll();
});

const graph: WorkflowGraphV1 = {
  version: 1,
  nodes: [
    { id: 'trigger-1', kind: 'trigger.manual', config: {} },
    {
      id: 'notify-1',
      kind: 'action.notification.create',
      config: { title: 'Workflow ran', body: 'Done', target: 'self' },
    },
  ],
  edges: [{ from: 'trigger-1', to: 'notify-1' }],
};

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    user: {
      id: 'user-1',
      role: 'member',
      company_id: 'tenant-1',
      is_verified: true,
    },
    companyId: 'tenant-1',
    roles: ['member'],
    workspaceId: 'tenant-1',
    requestId: 'request-1',
    deploymentMode: 'cloud',
    deploymentCapabilities: {
      mode: 'cloud',
      allowsLocalAiProxy: false,
      allowsSelfSignup: true,
      allowsExplicitFallbacks: true,
      requiresTrustedPublicEdges: true,
    },
    ...overrides,
  };
}

function workflow(overrides: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: 'workflow-1',
    tenant_id: 'tenant-1',
    name: 'Notify me',
    version: 1,
    status: 'active',
    graph,
    validation_errors: [],
    created_by: 'user-1',
    updated_by: 'user-1',
    published_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function run(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: 'run-1',
    tenant_id: 'tenant-1',
    workflow_id: 'workflow-1',
    workflow_version: 1,
    trigger_type: 'manual',
    status: 'queued',
    idempotency_key: 'same-key',
    correlation_id: 'request-1',
    event_id: '11111111-1111-4111-8111-111111111111',
    attempts: 0,
    started_at: null,
    completed_at: null,
    failed_at: null,
    error_text: null,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function step(overrides: Partial<WorkflowRunStepRow> = {}): WorkflowRunStepRow {
  return {
    id: 'step-1',
    tenant_id: 'tenant-1',
    workflow_run_id: 'run-1',
    workflow_id: 'workflow-1',
    node_id: 'notify-1',
    node_kind: 'action.notification.create',
    step_order: 1,
    status: 'succeeded',
    attempts: 1,
    started_at: new Date(),
    completed_at: new Date(),
    failed_at: null,
    error_text: null,
    output: { notification_id: 'notification-1' },
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

test('create rejects unsupported trigger/action nodes before persistence', async () => {
  const createMock = mock.method(workflowsRepository, 'create', async () => workflow());

  await assert.rejects(
    workflowsService.create(ctx(), {
      name: 'Bad graph',
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger-1', kind: 'trigger.schedule', config: {} },
          { id: 'action-1', kind: 'action.email.send', config: {} },
        ],
        edges: [{ from: 'trigger-1', to: 'action-1' }],
      },
    }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 400,
  );
  assert.equal(createMock.mock.calls.length, 0);
});

test('workflow build requests are denied when RequestContext lacks authenticated tenant capability', async () => {
  await assert.rejects(
    workflowsService.create(ctx({ user: null }), { name: 'Nope', graph }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 403,
  );
});

test('manualRun creates one durable notification run and step log with idempotency metadata', async () => {
  mock.method(workflowsRepository, 'find', async (_id: string, tenantId: string) => workflow({ tenant_id: tenantId }));
  mock.method(notificationsService, 'create', async () => ({
    id: 'notification-1',
    user_id: 'user-1',
    type: 'workflow',
    title: 'Workflow ran',
    body: 'Done',
    link: '/automations',
    is_read: false,
    created_at: new Date(),
  }));

  const calls: string[] = [];
  const fakeClient = {
    query: async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    },
    release: mock.fn(),
  };
  mock.method(db, 'connect', async () => fakeClient);
  mock.method(workflowsRepository, 'createOrFindManualRun', async (_client: PoolClient, input: {
    tenantId: string;
    workflowId: string;
    workflowVersion: number;
    idempotencyKey: string;
    correlationId: string;
    eventId: string;
    userId: string | null;
  }) => {
    assert.equal(input.tenantId, 'tenant-1');
    assert.equal(input.idempotencyKey, 'same-key');
    assert.equal(input.correlationId, 'request-1');
    return { run: run({ idempotency_key: input.idempotencyKey }), created: true };
  });
  mock.method(workflowsRepository, 'markRunRunning', async () => run({ status: 'running', attempts: 1 }));
  const insertStepMock = mock.method(workflowsRepository, 'insertStep', async (_client: PoolClient, input: {
    tenantId: string;
    workflowRunId: string;
    workflowId: string;
    nodeId: string;
    nodeKind: string;
    stepOrder: number;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
    attempts: number;
    errorText?: string | null;
    output?: Record<string, unknown>;
  }) => {
    assert.equal(input.tenantId, 'tenant-1');
    assert.equal(input.status, 'succeeded');
    assert.equal(input.attempts, 1);
    assert.match(String(input.output?.event_id), /^[0-9a-f-]+$/);
    return step();
  });
  mock.method(workflowsRepository, 'markRunComplete', async () => run({ status: 'succeeded', attempts: 1 }));
  mock.method(workflowsRepository, 'runDetail', async () => ({ run: run({ status: 'succeeded', attempts: 1 }), steps: [step()] }));

  const detail = await workflowsService.manualRun(ctx(), 'workflow-1', { idempotency_key: 'same-key' });

  assert.equal(detail.run.status, 'succeeded');
  assert.equal(detail.steps.length, 1);
  assert.equal(insertStepMock.mock.calls.length, 1);
  assert.deepEqual(calls, ['BEGIN', 'COMMIT']);
});

test('manualRun returns existing run for duplicate idempotency key without duplicate notification', async () => {
  mock.method(workflowsRepository, 'find', async () => workflow());
  const notificationMock = mock.method(notificationsService, 'create', async () => {
    throw new Error('should not create duplicate notification');
  });
  const fakeClient = {
    query: async (sql: string) => ({ rows: [], sql }),
    release: mock.fn(),
  };
  mock.method(db, 'connect', async () => fakeClient);
  mock.method(workflowsRepository, 'createOrFindManualRun', async () => ({ run: run({ status: 'succeeded' }), created: false }));
  mock.method(workflowsRepository, 'runDetail', async () => ({ run: run({ status: 'succeeded' }), steps: [step()] }));

  const detail = await workflowsService.manualRun(ctx(), 'workflow-1', { idempotency_key: 'same-key' });

  assert.equal(detail.run.status, 'succeeded');
  assert.equal(notificationMock.mock.calls.length, 0);
});

test('repository tenant scoping is present on workflow read/write SQL paths', async () => {
  const captured: string[] = [];
  mock.method(db, 'query', async (sql: string) => {
    captured.push(sql);
    return { rows: [] };
  });

  await workflowsRepository.list('tenant-1');
  await workflowsRepository.find('workflow-1', 'tenant-1');
  await workflowsRepository.update('workflow-1', 'tenant-1', { name: 'Name', graph, userId: 'user-1' });
  await workflowsRepository.runDetail('workflow-1', 'run-1', 'tenant-1');

  assert.ok(captured.every((sql) => /tenant_id|w\.tenant_id/.test(sql)));
  assert.ok(captured.some((sql) => /WHERE w\.tenant_id = \$1/.test(sql)));
  assert.ok(captured.some((sql) => /WHERE id = \$1 AND tenant_id = \$2/.test(sql)));
});
