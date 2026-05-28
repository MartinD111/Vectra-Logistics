import { AppError } from '../../core/errors/AppError';
import { getQueue } from '../../core/queue';
import { marketplaceRepository } from './marketplace.repository';
import { Shipment, Capacity } from './marketplace.types';
import { CreateShipmentSchema } from './dto/create-shipment.dto';
import { CreateCapacitySchema } from './dto/create-capacity.dto';
import { AssignShipmentSchema } from './dto/assign-shipment.dto';
import { automationService, AssignmentCommunications } from '../workspace/automation.service';
import { emitToRoom } from '../../core/realtime/bus';

export interface ShipmentWithComms extends Shipment {
  communications: AssignmentCommunications;
}

class MarketplaceService {
  // ── Shipments ─────────────────────────────────────────────────────────────

  async getShipments(): Promise<Shipment[]> {
    return marketplaceRepository.findActiveShipments();
  }

  async getShipment(shipmentId: string): Promise<Shipment> {
    const s = await marketplaceRepository.findShipmentById(shipmentId);
    if (!s) throw new AppError(404, 'Shipment not found');
    return s;
  }

  async getCapacity(capacityId: string): Promise<Capacity> {
    const c = await marketplaceRepository.findCapacityById(capacityId);
    if (!c) throw new AppError(404, 'Capacity not found');
    return c;
  }

  async cancelShipment(shipmentId: string, userId: string): Promise<Shipment> {
    const s = await marketplaceRepository.cancelShipment(shipmentId, userId);
    if (!s) throw new AppError(404, 'Shipment not found, not yours, or already finalised');
    emitToRoom(`shipment:${s.id}`, 'shipment:status', {
      shipment_id: s.id, status: s.status, changed_at: s.updated_at,
    });
    return s;
  }

  async cancelCapacity(capacityId: string, userId: string): Promise<Capacity> {
    const c = await marketplaceRepository.cancelCapacity(capacityId, userId);
    if (!c) throw new AppError(404, 'Capacity not found, not yours, or already finalised');
    return c;
  }

  async getShipmentMatches(shipmentId: string): Promise<unknown[]> {
    const shipment = await marketplaceRepository.findShipmentById(shipmentId);
    if (!shipment) throw new AppError(404, 'Shipment not found');

    const engineUrl = process.env.MATCHING_ENGINE_URL;
    if (!engineUrl) {
      // Fall back to a simple heuristic: list capacities whose route bbox
      // contains both shipment endpoints. Keeps the UI functional in dev.
      const capacities = await marketplaceRepository.findActiveCapacities();
      const scored = capacities
        .map((c) => {
          const detourKm = haversineKm(c.origin_lat, c.origin_lng, shipment.pickup_lat, shipment.pickup_lng)
                         + haversineKm(c.destination_lat, c.destination_lng, shipment.delivery_lat, shipment.delivery_lng);
          // Crude score: 1.0 for zero detour, decays linearly to 0 at 500km combined detour.
          const score = Math.max(0, 1 - detourKm / 500);
          return { capacity_id: c.id, score, detour_km: detourKm, capacity: c };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return scored;
    }

    try {
      const res = await fetch(`${engineUrl}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'shipment', shipment_id: shipmentId, shipment }),
      });
      if (!res.ok) throw new AppError(502, 'Matching engine returned an error');
      return await res.json() as unknown[];
    } catch (err) {
      throw new AppError(502, `Matching engine unreachable: ${(err as Error).message}`);
    }
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
  ): Promise<Shipment | ShipmentWithComms> {
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

    // Fire-and-forget: generate comms in parallel, never block the response
    const communications = await automationService
      .prepareAssignmentCommunications(shipment.id, companyId)
      .catch((err) => {
        console.warn('[MarketplaceService] Communications generation failed:', (err as Error).message);
        return null;
      });

    return communications
      ? { ...shipment, communications }
      : shipment;
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  async bookShipment(shipmentId: string, carrierCompanyId: string): Promise<Shipment | ShipmentWithComms> {
    const shipment = await marketplaceRepository.bookShipment(shipmentId, carrierCompanyId);
    if (!shipment) {
      throw new AppError(409, 'This load is no longer available');
    }

    emitToRoom(`shipment:${shipment.id}`, 'shipment:status', {
      shipment_id: shipment.id, status: shipment.status, changed_at: shipment.updated_at,
    });

    const communications = await automationService
      .prepareAssignmentCommunications(shipment.id, carrierCompanyId)
      .catch((err) => {
        console.warn('[MarketplaceService] Communications generation failed:', (err as Error).message);
        return null;
      });

    return communications
      ? { ...shipment, communications }
      : shipment;
  }
}

export const marketplaceService = new MarketplaceService();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
