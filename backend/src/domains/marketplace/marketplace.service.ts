import { AppError } from '../../core/errors/AppError';
import { marketplaceRepository } from './marketplace.repository';
import { Shipment, Capacity } from './marketplace.types';
import { CreateShipmentSchema } from './dto/create-shipment.dto';
import { CreateCapacitySchema } from './dto/create-capacity.dto';

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
}

export const marketplaceService = new MarketplaceService();
