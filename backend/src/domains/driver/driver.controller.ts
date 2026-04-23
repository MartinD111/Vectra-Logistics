import { Response } from 'express';
import { AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { driverService } from './driver.service';

// ── Helper: resolve driver_id from the JWT ────────────────────────────────────
// A driver logs in as a regular user whose user account is linked to a driver
// record (drivers.user_id = users.id).  The driver_id is looked up from the
// drivers table.  For simplicity we use the user_id as the driver_id here and
// the repository JOIN handles the lookup.  The service layer accepts user.id
// as the "driverId" — repositories query `drivers WHERE user_id = $1`.
//
// If the JWT carries a dedicated driver_id claim in the future, swap here only.

function requireDriverId(req: AuthRequest): string {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');
  return userId;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getMyActiveLoad = asyncHandler(async (req: AuthRequest, res: Response) => {
  const driverId = requireDriverId(req);
  const load = await driverService.getMyActiveLoad(driverId);
  res.status(200).json(load ?? null);
});

export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const driverId = requireDriverId(req);
  const { shipmentId } = req.params;
  const result = await driverService.updateStatus(shipmentId, driverId, req.body);
  res.status(200).json(result);
});

export const submitPod = asyncHandler(async (req: AuthRequest, res: Response) => {
  const driverId = requireDriverId(req);
  const { shipmentId } = req.params;

  if (!req.file) {
    throw new AppError(400, 'No file uploaded — include a "document" field in the multipart body');
  }

  const pod = await driverService.submitPod(shipmentId, driverId, req.file);
  res.status(201).json(pod);
});

export const getHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const driverId = requireDriverId(req);
  const history = await driverService.getHistory(driverId);
  res.status(200).json(history);
});
