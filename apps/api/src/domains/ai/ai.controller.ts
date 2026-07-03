import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { aiService } from './ai.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const getAiConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json(await aiService.getConfig(companyId));
});

export const saveAiConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json(await aiService.saveConfig(companyId, req.body, req.user?.id ?? null));
});

export const completeAi = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json(await aiService.complete(companyId, req.body));
});
