import { Request, Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { campaignsService } from './campaigns.service';

const companyOf = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

// 1x1 transparent GIF, served for every pixel hit regardless of token validity.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

export const listCampaigns = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : undefined;
  res.json({ campaigns: await campaignsService.listCampaigns(companyOf(req), projectId) });
});

export const getCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ campaign: await campaignsService.getCampaign(req.params.id, companyOf(req)) });
});

export const createCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : null;
  const campaign = await campaignsService.createAndSend(companyOf(req), projectId, req.user?.id ?? null, req.body);
  res.status(201).json({ campaign });
});

// Unauthenticated — embedded as an <img> in the sent email itself.
export const trackOpen = asyncHandler(async (req: Request, res: Response) => {
  await campaignsService.recordOpen(req.params.token);
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(PIXEL);
});
