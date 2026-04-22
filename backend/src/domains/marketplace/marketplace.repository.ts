import { db } from '../../core/db';
import { Shipment, Capacity } from './marketplace.types';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { CreateCapacityDto } from './dto/create-capacity.dto';

class MarketplaceRepository {
  // ── Shipments ─────────────────────────────────────────────────────────────

  async findActiveShipments(): Promise<Shipment[]> {
    const { rows } = await db.query<Shipment>(
      `SELECT * FROM shipments WHERE status = $1 ORDER BY created_at DESC`,
      ['pending'],
    );
    return rows;
  }

  async createShipment(userId: string, dto: CreateShipmentDto): Promise<Shipment> {
    const { rows } = await db.query<Shipment>(
      `INSERT INTO shipments (
        user_id, pickup_address, pickup_lat, pickup_lng,
        delivery_address, delivery_lat, delivery_lng,
        cargo_weight_kg, cargo_volume_m3, pallet_count, cargo_type,
        pickup_window_start, pickup_window_end, delivery_deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        dto.pickup_address, dto.pickup_lat, dto.pickup_lng,
        dto.delivery_address, dto.delivery_lat, dto.delivery_lng,
        dto.cargo_weight_kg, dto.cargo_volume_m3, dto.pallet_count, dto.cargo_type,
        dto.pickup_window_start, dto.pickup_window_end, dto.delivery_deadline,
      ],
    );
    return rows[0];
  }

  // ── Capacities ────────────────────────────────────────────────────────────

  async findActiveCapacities(): Promise<Capacity[]> {
    const { rows } = await db.query<Capacity>(
      `SELECT * FROM capacity_listings WHERE status = $1 ORDER BY created_at DESC`,
      ['available'],
    );
    return rows;
  }

  async createCapacity(userId: string, dto: CreateCapacityDto): Promise<Capacity> {
    const { rows } = await db.query<Capacity>(
      `INSERT INTO capacity_listings (
        user_id, vehicle_id, origin_address, origin_lat, origin_lng,
        destination_address, destination_lat, destination_lng,
        departure_time, delivery_deadline, available_weight_kg,
        available_volume_m3, available_pallets, route_polyline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        dto.vehicle_id,
        dto.origin_address, dto.origin_lat, dto.origin_lng,
        dto.destination_address, dto.destination_lat, dto.destination_lng,
        dto.departure_time, dto.delivery_deadline,
        dto.available_weight_kg, dto.available_volume_m3, dto.available_pallets,
        dto.route_polyline ?? null,
      ],
    );
    return rows[0];
  }
}

export const marketplaceRepository = new MarketplaceRepository();
