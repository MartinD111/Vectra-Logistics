import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { podService } from './pod.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

export const listPodRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ requests: await podService.list(requireCompany(req)) });
});

export const createPodRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ request: await podService.create(requireCompany(req), req.user?.id ?? null, req.body) });
});

export const simulateArrival = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ request: await podService.simulateArrival(requireCompany(req), req.user?.id ?? null) });
});
