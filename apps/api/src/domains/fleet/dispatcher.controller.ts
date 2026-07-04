// Controllers for the Phase 2 dispatcher widgets: fleet telematics snapshot,
// spot quote calculator, and the exception radar.

import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { telematicsService } from './telematics.service';
import { spotQuoteService } from './spotQuote.service';
import { exceptionsService } from './exceptions.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const getTelematics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json(await telematicsService.getSnapshot(companyId));
});

export const calculateSpotQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
  requireCompany(req);
  res.status(200).json({ quote: spotQuoteService.calculate(req.body) });
});

export const listQuoteCities = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.status(200).json({ cities: spotQuoteService.listCities() });
});

export const listExceptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json({ exceptions: await exceptionsService.listActive(companyId) });
});

export const createException = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(201).json({ exception: await exceptionsService.create(companyId, req.body) });
});

export const simulateException = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(201).json({ exception: await exceptionsService.simulate(companyId) });
});

export const resolveException = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  res.status(200).json({ exception: await exceptionsService.resolve(req.params.id, companyId) });
});
