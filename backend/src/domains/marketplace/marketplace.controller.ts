import { Request, Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { marketplaceService } from './marketplace.service';

const requireUser = (req: AuthRequest): string => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');
  return userId;
};

// ── Shipments ─────────────────────────────────────────────────────────────

export const getShipments = asyncHandler(async (_req: Request, res: Response) => {
  const shipments = await marketplaceService.getShipments();
  res.status(200).json(shipments);
});

export const createShipment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const shipment = await marketplaceService.createShipment(userId, req.body);
  res.status(201).json(shipment);
});

export const assignShipment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'Company membership required to assign shipments');

  const shipment = await marketplaceService.assignShipment(companyId, req.params.id, req.body);
  res.status(200).json(shipment);
});

export const bookShipment = asyncHandler(async (req: AuthRequest, res: Response) => {
  requireUser(req);
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'Company membership required to book shipments');

  const shipment = await marketplaceService.bookShipment(req.params.id, companyId);
  res.status(200).json(shipment);
});

// ── Capacities ────────────────────────────────────────────────────────────

export const getCapacities = asyncHandler(async (_req: Request, res: Response) => {
  const capacities = await marketplaceService.getCapacities();
  res.status(200).json(capacities);
});

export const createCapacity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const capacity = await marketplaceService.createCapacity(userId, req.body);
  res.status(201).json(capacity);
});
