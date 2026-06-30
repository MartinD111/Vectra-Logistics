import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { integrationsService } from './integrations.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const getIntegrations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const integrations = await integrationsService.getIntegrations(companyId);
  res.status(200).json(integrations);
});

export const saveIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const integration = await integrationsService.saveIntegration(companyId, req.body);
  res.status(200).json(integration);
});

export const getInternalApiKeys = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const keys = await integrationsService.getInternalApiKeys(companyId);
  res.status(200).json(keys);
});

export const generateInternalApiKey = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const result = await integrationsService.generateInternalApiKey(companyId, req.body);
  res.status(201).json(result);
});
