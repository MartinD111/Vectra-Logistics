import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { requireCompanyId, requireRequestContext } from '../../core/auth/request-context';
import { podService } from './pod.service';

export const listPodRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ requests: await podService.list(requireCompanyId(req)) });
});

export const createPodRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  res.status(201).json({ request: await podService.create(requireCompanyId(ctx), ctx.user?.id ?? null, req.body) });
});

export const simulateArrival = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ctx = requireRequestContext(req);
  res.status(201).json({ request: await podService.simulateArrival(requireCompanyId(ctx), ctx.user?.id ?? null) });
});
