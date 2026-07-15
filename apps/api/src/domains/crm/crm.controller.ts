import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireCompanyId, requireRequestContext } from '../../core/auth/request-context';
import { crmService } from './crm.service';

export const listClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ clients: await crmService.listClients(requireCompanyId(req)) });
});

export const getClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ client: await crmService.getClient(req.params.id, requireCompanyId(req)) });
});

export const createClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ client: await crmService.createClient(requireCompanyId(req), req.body) });
});

export const updateClient = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ client: await crmService.updateClient(req.params.id, requireCompanyId(req), req.body) });
});

export const listClientProjectLinks = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ links: await crmService.listClientProjectLinks(req.params.id, requireCompanyId(req)) });
});

export const upsertClientProjectLink = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ link: await crmService.upsertClientProjectLink(req.params.id, requireCompanyId(req), req.body) });
});

export const unlinkClientProjectLink = asyncHandler(async (req: AuthRequest, res: Response) => {
  await crmService.unlinkClientProject(req.params.id, req.params.projectId, requireCompanyId(req));
  res.status(204).send();
});

export const importClients = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await crmService.importClients(requireCompanyId(req), req.body));
});

export const getClientEmails = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ emails: await crmService.getClientEmails(req.params.id, requireCompanyId(req)) });
});

export const getClientRisk = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ risk: await crmService.getClientRisk(req.params.id, requireCompanyId(req)) });
});

export const getClientPage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  res.status(200).json({
    page: await crmService.getOrCreateClientPage(req.params.id, requireCompanyId(ctx), ctx.user?.id ?? null),
  });
});

export const updateClientPage = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    page: await crmService.updateClientPage(req.params.pageId, requireCompanyId(req), req.body),
  });
});

export const getClientTimeline = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    timeline: await crmService.getClientTimeline(req.params.id, requireCompanyId(req)),
  });
});
