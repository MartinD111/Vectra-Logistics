import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireCompanyId } from '../../core/auth/request-context';
import { integrationsService } from './integrations.service';

export const getIntegrations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompanyId(req);
  const integrations = await integrationsService.getIntegrations(companyId);
  res.status(200).json(integrations);
});

export const saveIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompanyId(req);
  const integration = await integrationsService.saveIntegration(companyId, req.body);
  res.status(200).json(integration);
});

export const getInternalApiKeys = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompanyId(req);
  const keys = await integrationsService.getInternalApiKeys(companyId);
  res.status(200).json(keys);
});

export const generateInternalApiKey = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompanyId(req);
  const result = await integrationsService.generateInternalApiKey(companyId, req.body);
  res.status(201).json(result);
});
