import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { yardService } from './yard.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};
const projectQuery = (req: AuthRequest): string | undefined =>
  (typeof req.query.project_id === 'string' && req.query.project_id) || undefined;

export const getLayout = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await yardService.getLayout(requireCompany(req), projectQuery(req)));
});

export const createZone = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ zone: await yardService.createZone(requireCompany(req), req.body) });
});

export const deleteZone = asyncHandler(async (req: AuthRequest, res: Response) => {
  await yardService.deleteZone(req.params.id, requireCompany(req));
  res.status(204).end();
});

export const createAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ asset: await yardService.createAsset(requireCompany(req), req.body) });
});

export const moveAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ asset: await yardService.moveAsset(req.params.id, requireCompany(req), req.body) });
});

export const listWagons = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ wagons: await yardService.listWagons(requireCompany(req), projectQuery(req)) });
});

export const createWagon = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ wagon: await yardService.createWagon(requireCompany(req), req.body) });
});

export const updateWagon = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ wagon: await yardService.updateWagon(req.params.id, requireCompany(req), req.body) });
});
