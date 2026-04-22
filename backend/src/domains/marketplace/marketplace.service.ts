import { AppError } from '../../core/errors/AppError';
import { getQueue } from '../../core/queue';
import { marketplaceRepository } from './marketplace.repository';
import { Shipment, Capacity } from './marketplace.types';
import { CreateShipmentSchema } from './dto/create-shipment.dto';
import { CreateCapacitySchema } from './dto/create-capacity.dto';
import { AssignShipmentSchema } from './dto/assign-shipment.dto';

class MarketplaceService {
  // ── Shipments ─────────────────────────────────────────────────────────────

  async getShipments(): Promise<Shipment[]> {
    return marketplaceRepository.findActiveShipments();
  }

  async createShipment(userId: string, body: unknown): Promise<Shipment> {
    const parsed = CreateShipmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }

    const shipment = await marketplaceRepository.createShipment(userId, parsed.data);

    // TODO: Enqueue matching job in BullMQ
    // getQueue('matching').add('evaluate', { type: 'shipment', shipmentId: shipment.id });

    return shipment;
  }

  // ── Capacities ────────────────────────────────────────────────────────────

  async getCapacities(): Promise<Capacity[]> {
    return marketplaceRepository.findActiveCapacities();
  }

  async createCapacity(userId: string, body: unknown): Promise<Capacity> {
    const parsed = CreateCapacitySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }

    const capacity = await marketplaceRepository.createCapacity(userId, parsed.data);

    // TODO: Enqueue matching job in BullMQ
    // getQueue('matching').add('evaluate', { type: 'capacity', capacityId: capacity.id });

    return capacity;
  }

  // ── Assignment ────────────────────────────────────────────────────────────

  async assignShipment(
    companyId: string,
    shipmentId: string,
    body: unknown,
  ): Promise<Shipment> {
    const parsed = AssignShipmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }

    const shipment = await marketplaceRepository.assignShipmentToVehicle(
      shipmentId,
      parsed.data,
      companyId,
    );

    if (!shipment) {
      throw new AppError(
        404,
        'Shipment not found, already assigned, or does not belong to your company.',
      );
    }

    // Trigger the Predictive Empty Truck Engine asynchronously.
    // The worker picks this job up and evaluates the assignment against the
    // Python matching engine without blocking the HTTP response.
    await getQueue('matching').add('evaluate-assignment', {
      shipmentId: shipment.id,
      vehicleId: parsed.data.vehicle_id,
    });

    return shipment;
  }
}

export const marketplaceService = new MarketplaceService();
