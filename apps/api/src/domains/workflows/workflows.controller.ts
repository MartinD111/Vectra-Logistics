import { Response } from 'express';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireRequestContext, RequestWithContext } from '../../core/auth/request-context';
import { workflowsService } from './workflows.service';

export const listWorkflows = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const workflows = await workflowsService.list(requireRequestContext(req));
  res.json({ workflows });
});

export const createWorkflow = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const workflow = await workflowsService.create(requireRequestContext(req), req.body);
  res.status(201).json({ workflow });
});

export const getWorkflow = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const workflow = await workflowsService.get(requireRequestContext(req), req.params.id);
  res.json({ workflow });
});

export const updateWorkflow = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const workflow = await workflowsService.update(requireRequestContext(req), req.params.id, req.body);
  res.json({ workflow });
});

export const publishWorkflow = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const workflow = await workflowsService.publish(requireRequestContext(req), req.params.id);
  res.json({ workflow });
});

export const runWorkflowManually = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const detail = await workflowsService.manualRun(requireRequestContext(req), req.params.id, req.body);
  res.status(201).json(detail);
});

export const getWorkflowRun = asyncHandler(async (req: RequestWithContext, res: Response) => {
  const detail = await workflowsService.runDetail(requireRequestContext(req), req.params.id, req.params.runId);
  res.json(detail);
});
