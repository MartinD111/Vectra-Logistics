import { randomUUID } from 'crypto';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { assertCapability } from '../../core/capabilities';
import { RequestContext, requireCompanyId, requireUserId } from '../../core/auth/request-context';
import { createDurableEventEnvelope } from '../../core/events/outbox';
import { notificationsService } from '../notifications/notifications.service';
import { ManualRunSchema, SaveWorkflowSchema } from './dto/workflows.dto';
import { workflowsRepository } from './workflows.repository';
import type { NotificationActionNode, WorkflowGraphV1, WorkflowRunDetail, WorkflowRow } from './workflows.types';

function validationMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: Array<{ message: string }> }).issues;
    return issues?.[0]?.message ?? 'Invalid workflow payload';
  }
  return 'Invalid workflow payload';
}

function assertMvpGraph(graph: WorkflowGraphV1): void {
  const triggers = graph.nodes.filter((node) => node.kind === 'trigger.manual');
  const actions = graph.nodes.filter((node) => node.kind === 'action.notification.create');
  if (triggers.length !== 1) {
    throw new AppError(400, 'Workflow MVP supports exactly one manual trigger');
  }
  if (actions.length !== 1) {
    throw new AppError(400, 'Workflow MVP supports exactly one notification action');
  }
  if (graph.nodes.length !== 2) {
    throw new AppError(400, 'Unsupported workflow node in MVP graph');
  }
  const validNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (
    graph.edges.length !== 1
    || graph.edges[0].from !== triggers[0].id
    || graph.edges[0].to !== actions[0].id
    || !validNodeIds.has(graph.edges[0].from)
    || !validNodeIds.has(graph.edges[0].to)
  ) {
    throw new AppError(400, 'Workflow MVP requires one edge from manual trigger to notification action');
  }
}

class WorkflowsService {
  async list(ctx: RequestContext): Promise<WorkflowRow[]> {
    const tenantId = requireCompanyId(ctx);
    return workflowsRepository.list(tenantId);
  }

  async create(ctx: RequestContext, body: unknown): Promise<WorkflowRow> {
    assertCapability(ctx, 'workflow.build');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    const parsed = SaveWorkflowSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, validationMessage(parsed.error));
    assertMvpGraph(parsed.data.graph);
    return workflowsRepository.create({ tenantId, name: parsed.data.name, graph: parsed.data.graph, userId });
  }

  async get(ctx: RequestContext, id: string): Promise<WorkflowRow> {
    const tenantId = requireCompanyId(ctx);
    const workflow = await workflowsRepository.find(id, tenantId);
    if (!workflow) throw new AppError(404, 'Workflow not found');
    return workflow;
  }

  async update(ctx: RequestContext, id: string, body: unknown): Promise<WorkflowRow> {
    assertCapability(ctx, 'workflow.build');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    const parsed = SaveWorkflowSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, validationMessage(parsed.error));
    assertMvpGraph(parsed.data.graph);
    const workflow = await workflowsRepository.update(id, tenantId, {
      name: parsed.data.name,
      graph: parsed.data.graph,
      userId,
    });
    if (!workflow) throw new AppError(404, 'Workflow not found');
    return workflow;
  }

  async publish(ctx: RequestContext, id: string): Promise<WorkflowRow> {
    assertCapability(ctx, 'workflow.build');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    const workflow = await workflowsRepository.find(id, tenantId);
    if (!workflow) throw new AppError(404, 'Workflow not found');
    assertMvpGraph(workflow.graph);
    const updated = await workflowsRepository.setStatus(id, tenantId, 'active', userId);
    if (!updated) throw new AppError(404, 'Workflow not found');
    return updated;
  }

  async manualRun(ctx: RequestContext, id: string, body: unknown): Promise<WorkflowRunDetail> {
    assertCapability(ctx, 'workflow.run');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    const parsed = ManualRunSchema.safeParse(body ?? {});
    if (!parsed.success) throw new AppError(400, validationMessage(parsed.error));

    const workflow = await workflowsRepository.find(id, tenantId);
    if (!workflow) throw new AppError(404, 'Workflow not found');
    if (workflow.status !== 'active') throw new AppError(400, 'Workflow must be active before manual run');
    assertMvpGraph(workflow.graph);

    const action = workflow.graph.nodes.find(
      (node): node is NotificationActionNode => node.kind === 'action.notification.create',
    );
    if (!action) throw new AppError(400, 'Workflow MVP requires a notification action');

    const idempotencyKey = parsed.data.idempotency_key ?? randomUUID();
    const event = createDurableEventEnvelope({
      eventName: 'workflow.manual_triggered',
      tenantId,
      actorId: userId,
      objectType: 'workflow',
      objectId: workflow.id,
      correlationId: ctx.requestId,
      payloadVersion: 1,
      payload: { workflow_id: workflow.id, workflow_version: workflow.version, idempotency_key: idempotencyKey },
    });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { run, created } = await workflowsRepository.createOrFindManualRun(client, {
        tenantId,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        idempotencyKey,
        correlationId: event.correlationId ?? ctx.requestId,
        eventId: event.eventId,
        userId,
      });

      if (!created) {
        await client.query('COMMIT');
        const detail = await workflowsRepository.runDetail(workflow.id, run.id, tenantId);
        if (!detail) throw new AppError(404, 'Workflow run not found');
        return detail;
      }

      const running = await workflowsRepository.markRunRunning(client, run.id, tenantId);
      try {
        const notification = await notificationsService.create({
          userId,
          type: 'workflow',
          title: action.config.title,
          body: action.config.body,
          link: '/automations',
        });
        await workflowsRepository.insertStep(client, {
          tenantId,
          workflowRunId: run.id,
          workflowId: workflow.id,
          nodeId: action.id,
          nodeKind: action.kind,
          stepOrder: 1,
          status: 'succeeded',
          attempts: running.attempts,
          output: { notification_id: notification.id, correlation_id: event.correlationId, event_id: event.eventId },
        });
        const completed = await workflowsRepository.markRunComplete(client, run.id, tenantId, 'succeeded', null);
        await client.query('COMMIT');
        return { run: completed, steps: (await workflowsRepository.runDetail(workflow.id, run.id, tenantId))?.steps ?? [] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await workflowsRepository.insertStep(client, {
          tenantId,
          workflowRunId: run.id,
          workflowId: workflow.id,
          nodeId: action.id,
          nodeKind: action.kind,
          stepOrder: 1,
          status: 'failed',
          attempts: running.attempts,
          errorText: message.slice(0, 2000),
        });
        const failed = await workflowsRepository.markRunComplete(client, run.id, tenantId, 'failed', message.slice(0, 2000));
        await client.query('COMMIT');
        return { run: failed, steps: (await workflowsRepository.runDetail(workflow.id, run.id, tenantId))?.steps ?? [] };
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runDetail(ctx: RequestContext, workflowId: string, runId: string): Promise<WorkflowRunDetail> {
    const tenantId = requireCompanyId(ctx);
    const detail = await workflowsRepository.runDetail(workflowId, runId, tenantId);
    if (!detail) throw new AppError(404, 'Workflow run not found');
    return detail;
  }
}

export const workflowsService = new WorkflowsService();
