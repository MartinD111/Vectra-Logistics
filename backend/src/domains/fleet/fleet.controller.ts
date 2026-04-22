import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { fleetService } from './fleet.service';

const requireCompany = (req: AuthRequest): string => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  return companyId;
};

// ── Drivers ───────────────────────────────────────────────────────────────

export const getDrivers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const drivers = await fleetService.getDrivers(companyId);
  res.status(200).json(drivers);
});

export const createDriver = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const driver = await fleetService.createDriver(companyId, req.body);
  res.status(201).json(driver);
});

export const updateDriver = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const driver = await fleetService.updateDriver(req.params.id, companyId, req.body);
  res.status(200).json(driver);
});

export const deleteDriver = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  await fleetService.deleteDriver(req.params.id, companyId);
  res.status(204).send();
});

// ── Vehicles ──────────────────────────────────────────────────────────────

export const getVehicles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const vehicles = await fleetService.getVehicles(companyId);
  res.status(200).json(vehicles);
});

export const createVehicle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const vehicle = await fleetService.createVehicle(companyId, req.body);
  res.status(201).json(vehicle);
});

export const updateVehicle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  const vehicle = await fleetService.updateVehicle(req.params.id, companyId, req.body);
  res.status(200).json(vehicle);
});

export const deleteVehicle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = requireCompany(req);
  await fleetService.deleteVehicle(req.params.id, companyId);
  res.status(204).send();
});
