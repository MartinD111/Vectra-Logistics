import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { inboxService } from './inbox.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const getDemoEmails = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.status(200).json({ emails: inboxService.demoEmails() });
});

export const listDrafts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : undefined;
  res.status(200).json({ drafts: await inboxService.listDrafts(companyId, projectId) });
});

export const parseEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const result = await inboxService.parseAndCreate(companyId, req.user?.id ?? null, req.body);
  res.status(201).json(result);
});

export const updateDraft = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json({ draft: await inboxService.updateDraft(req.params.id, companyId, req.body) });
});

export const confirmDraft = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json({ draft: await inboxService.setStatus(req.params.id, companyId, req.user?.id ?? null, 'confirmed') });
});

export const rejectDraft = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json({ draft: await inboxService.setStatus(req.params.id, companyId, req.user?.id ?? null, 'rejected') });
});
