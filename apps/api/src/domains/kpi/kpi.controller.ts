import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { kpiService } from './kpi.service';

const companyOf = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

const assertAdmin = (req: AuthRequest): void => {
  if (req.user?.role !== 'admin') throw new AppError(403, 'Only an admin can manage KPI rules');
};

export const listRules = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ rules: await kpiService.listRules(companyOf(req)) });
});

export const getRule = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ rule: await kpiService.getRule(req.params.id, companyOf(req)) });
});

export const createRule = asyncHandler(async (req: AuthRequest, res: Response) => {
  assertAdmin(req);
  const rule = await kpiService.createRule(companyOf(req), req.user?.id ?? null, req.body);
  res.status(201).json({ rule });
});

export const updateRule = asyncHandler(async (req: AuthRequest, res: Response) => {
  assertAdmin(req);
  res.json({ rule: await kpiService.updateRule(req.params.id, companyOf(req), req.body) });
});

export const deleteRule = asyncHandler(async (req: AuthRequest, res: Response) => {
  assertAdmin(req);
  await kpiService.deleteRule(req.params.id, companyOf(req));
  res.status(204).send();
});

export const runEvaluation = asyncHandler(async (req: AuthRequest, res: Response) => {
  assertAdmin(req);
  const results = await kpiService.runEvaluation(companyOf(req), req.body);
  res.json({ results });
});

export const listResults = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { rule_id, user_id, project_id, client_id } = req.query;
  const results = await kpiService.listResults(companyOf(req), {
    ruleId: typeof rule_id === 'string' ? rule_id : undefined,
    userId: typeof user_id === 'string' ? user_id : undefined,
    projectId: typeof project_id === 'string' ? project_id : undefined,
    clientId: typeof client_id === 'string' ? client_id : undefined,
  });
  res.json({ results });
});

export const getSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { user_id, project_id, client_id } = req.query;
  const summary = await kpiService.getSummary(companyOf(req), {
    userId: typeof user_id === 'string' ? user_id : undefined,
    projectId: typeof project_id === 'string' ? project_id : undefined,
    clientId: typeof client_id === 'string' ? client_id : undefined,
  });
  res.json({ summary });
});
