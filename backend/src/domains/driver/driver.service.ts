import path from 'path';
import fs from 'fs';
import { AppError } from '../../core/errors/AppError';
import { driverRepository } from './driver.repository';
import {
  DriverActiveLoad,
  DriverHistoryEntry,
  PodDocument,
  DRIVER_STATUS_TRANSITIONS,
  DriverShipmentStatus,
} from './driver.types';
import { UpdateStatusSchema } from './dto/update-status.dto';

// Ensure upload directory exists at module load time
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'pod'), { recursive: true });

class DriverService {
  // ── Internal: resolve user_id → drivers.id ───────────────────────────────
  // The JWT embeds user.id.  All assignment/log tables use the canonical
  // drivers.id (set via drivers.user_id FK added in migration 003).

  private async resolveDriverId(userId: string): Promise<string> {
    const driverId = await driverRepository.findDriverIdByUserId(userId);
    if (!driverId) {
      throw new AppError(
        403,
        'No driver record is linked to your account. Ask your dispatcher to link your driver profile.',
      );
    }
    return driverId;
  }

  // ── Active load ───────────────────────────────────────────────────────────

  async getMyActiveLoad(userId: string): Promise<DriverActiveLoad | null> {
    const driverId = await this.resolveDriverId(userId);
    return driverRepository.findActiveLoadByDriverId(driverId);
  }

  // ── Status update ─────────────────────────────────────────────────────────

  async updateStatus(
    shipmentId: string,
    userId: string,
    body: unknown,
  ): Promise<{ shipment_id: string; status: string }> {
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }

    const requestedStatus = parsed.data.status as DriverShipmentStatus;
    const driverId = await this.resolveDriverId(userId);

    const isAssigned = await driverRepository.isDriverAssignedToShipment(driverId, shipmentId);
    if (!isAssigned) {
      throw new AppError(403, 'You are not assigned to this shipment');
    }

    const currentStatus = await driverRepository.getShipmentStatus(shipmentId);
    if (!currentStatus) {
      throw new AppError(404, 'Shipment not found');
    }

    const allowedNext = DRIVER_STATUS_TRANSITIONS[currentStatus as DriverShipmentStatus];
    if (allowedNext !== requestedStatus) {
      throw new AppError(
        409,
        `Cannot transition from '${currentStatus}' to '${requestedStatus}'. Expected next: '${allowedNext ?? 'none — already complete'}'`,
      );
    }

    const updated = await driverRepository.updateShipmentStatus(
      shipmentId,
      driverId,
      currentStatus,
      requestedStatus,
    );

    if (!updated) {
      throw new AppError(409, 'Status update conflict — please refresh and retry');
    }

    return { shipment_id: shipmentId, status: requestedStatus };
  }

  // ── POD upload ────────────────────────────────────────────────────────────

  async submitPod(
    shipmentId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<PodDocument> {
    const driverId = await this.resolveDriverId(userId);

    const isAssigned = await driverRepository.isDriverAssignedToShipment(driverId, shipmentId);
    if (!isAssigned) {
      throw new AppError(403, 'You are not assigned to this shipment');
    }

    const currentStatus = await driverRepository.getShipmentStatus(shipmentId);
    if (currentStatus !== 'arrived_at_delivery' && currentStatus !== 'completed') {
      throw new AppError(
        409,
        `POD can only be submitted after confirming arrival at delivery (current: '${currentStatus}')`,
      );
    }

    const pod = await driverRepository.savePodDocument(
      shipmentId,
      driverId,
      `/uploads/pod/${file.filename}`,
      file.originalname,
      file.mimetype,
      file.size,
    );

    // Auto-advance to 'completed' on first POD submission
    if (currentStatus === 'arrived_at_delivery') {
      await driverRepository.updateShipmentStatus(
        shipmentId,
        driverId,
        'arrived_at_delivery',
        'completed',
      );
    }

    return pod;
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getHistory(userId: string): Promise<DriverHistoryEntry[]> {
    const driverId = await this.resolveDriverId(userId);
    return driverRepository.findHistoryByDriverId(driverId);
  }
}

export const driverService = new DriverService();
