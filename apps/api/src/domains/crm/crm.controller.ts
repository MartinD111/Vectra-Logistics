import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { crmService } from './crm.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ clients: await crmService.listClients(requireCompany(req)) });
});

export const getClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ client: await crmService.getClient(req.params.id, requireCompany(req)) });
});

export const createClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ client: await crmService.createClient(requireCompany(req), req.body) });
});

export const updateClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ client: await crmService.updateClient(req.params.id, requireCompany(req), req.body) });
});

export const listClientProjectLinks = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ links: await crmService.listClientProjectLinks(req.params.id, requireCompany(req)) });
});

export const upsertClientProjectLink = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ link: await crmService.upsertClientProjectLink(req.params.id, requireCompany(req), req.body) });
});

export const importClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await crmService.importClients(requireCompany(req), req.body));
});

export const getClientEmails = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ emails: await crmService.getClientEmails(req.params.id, requireCompany(req)) });
});

export const getClientRisk = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ risk: await crmService.getClientRisk(req.params.id, requireCompany(req)) });
});

export const getClientPage = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    page: await crmService.getOrCreateClientPage(req.params.id, requireCompany(req), req.user?.id ?? null),
  });
});

export const updateClientPage = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    page: await crmService.updateClientPage(req.params.pageId, requireCompany(req), req.body),
  });
});

export const getClientTimeline = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    timeline: await crmService.getClientTimeline(req.params.id, requireCompany(req)),
  });
});
