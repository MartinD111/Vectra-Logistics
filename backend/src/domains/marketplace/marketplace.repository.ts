import { db } from '../../core/db';
import { Shipment, Capacity } from './marketplace.types';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { CreateCapacityDto } from './dto/create-capacity.dto';
import { AssignShipmentDto } from './dto/assign-shipment.dto';

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

  // ── Assignment ────────────────────────────────────────────────────────────

  async assignShipmentToVehicle(
    shipmentId: string,
    dto: AssignShipmentDto,
    companyId: string,
  ): Promise<Shipment | null> {
    // UPDATE is scoped through users.company_id so a dispatcher cannot assign
    // another company's shipment by guessing a UUID.  Also guards against
    // re-assigning an already-assigned shipment (status = 'pending' guard).
    const { rows } = await db.query<Shipment>(
      `UPDATE shipments s
       SET
         status     = 'assigned',
         updated_at = NOW()
       FROM users u
       WHERE s.id         = $1
         AND s.user_id    = u.id
         AND u.company_id = $2
         AND s.status     = 'pending'
       RETURNING s.*`,
      [shipmentId, companyId],
    );

    if (rows.length === 0) return null;

    // Record the vehicle link in the assignment join table.
    // ON CONFLICT handles idempotent retries from the queue worker.
    await db.query(
      `INSERT INTO shipment_assignments (shipment_id, vehicle_id, assigned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (shipment_id) DO UPDATE
         SET vehicle_id  = EXCLUDED.vehicle_id,
             assigned_at = EXCLUDED.assigned_at`,
      [shipmentId, dto.vehicle_id],
    );

    return rows[0];
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  async bookShipment(shipmentId: string, carrierCompanyId: string): Promise<Shipment | null> {
    const { rows } = await db.query<Shipment>(
      `UPDATE shipments
       SET status           = 'booked',
           carrier_company_id = $2,
           updated_at       = NOW()
       WHERE id     = $1
         AND status = 'pending'
       RETURNING *`,
      [shipmentId, carrierCompanyId],
    );
    return rows[0] ?? null;
  }

  // ── Archive ───────────────────────────────────────────────────────────────
  //
  // archive_logs schema (run once in a migration):
  //
  //   CREATE TABLE IF NOT EXISTS archive_logs (
  //     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  //     shipment_id     UUID NOT NULL REFERENCES shipments(id),
  //     company_id      UUID NOT NULL,
  //     carrier_company_id UUID,
  //     pickup_address  TEXT NOT NULL,
  //     delivery_address TEXT NOT NULL,
  //     cargo_type      TEXT,
  //     cargo_weight_kg NUMERIC,
  //     final_status    TEXT NOT NULL,
  //     driver_id       UUID REFERENCES drivers(id),
  //     vehicle_id      UUID REFERENCES vehicles(id),
  //     cmr_document_url TEXT,
  //     final_rate_eur  NUMERIC,
  //     archived_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  //   );
  //
  //   CREATE UNIQUE INDEX IF NOT EXISTS archive_logs_shipment_id_idx
  //     ON archive_logs (shipment_id);

  async archiveShipment(
    shipmentId: string,
    companyId: string,
    opts: {
      carrierCompanyId?: string;
      driverId?: string;
      vehicleId?: string;
      cmrDocumentUrl?: string;
      finalRateEur?: number;
      finalStatus: string;
    },
  ): Promise<void> {
    const shipment = await this.findShipmentById(shipmentId);
    if (!shipment) return;

    await db.query(
      `INSERT INTO archive_logs (
         shipment_id, company_id, carrier_company_id,
         pickup_address, delivery_address,
         cargo_type, cargo_weight_kg,
         final_status, driver_id, vehicle_id,
         cmr_document_url, final_rate_eur
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (shipment_id) DO UPDATE
         SET final_status     = EXCLUDED.final_status,
             driver_id        = COALESCE(EXCLUDED.driver_id,        archive_logs.driver_id),
             vehicle_id       = COALESCE(EXCLUDED.vehicle_id,       archive_logs.vehicle_id),
             cmr_document_url = COALESCE(EXCLUDED.cmr_document_url, archive_logs.cmr_document_url),
             final_rate_eur   = COALESCE(EXCLUDED.final_rate_eur,   archive_logs.final_rate_eur),
             archived_at      = NOW()`,
      [
        shipmentId,
        companyId,
        opts.carrierCompanyId ?? null,
        shipment.pickup_address,
        shipment.delivery_address,
        shipment.cargo_type ?? null,
        shipment.cargo_weight_kg ?? null,
        opts.finalStatus,
        opts.driverId ?? null,
        opts.vehicleId ?? null,
        opts.cmrDocumentUrl ?? null,
        opts.finalRateEur ?? null,
      ],
    );
  }

  async findShipmentById(shipmentId: string): Promise<Shipment | null> {
    const { rows } = await db.query<Shipment>(
      `SELECT * FROM shipments WHERE id = $1 LIMIT 1`,
      [shipmentId],
    );
    return rows[0] ?? null;
  }

  async getShipmentHistory(companyId: string): Promise<ArchiveLog[]> {
    const { rows } = await db.query<ArchiveLog>(
      `SELECT
         a.id, a.shipment_id, a.company_id, a.carrier_company_id,
         a.pickup_address, a.delivery_address,
         a.cargo_type, a.cargo_weight_kg,
         a.final_status, a.cmr_document_url, a.final_rate_eur,
         a.archived_at,
         d.first_name  AS driver_first_name,
         d.last_name   AS driver_last_name,
         v.license_plate AS vehicle_license_plate,
         s.settlement_amount, s.settlement_status
       FROM archive_logs a
       LEFT JOIN drivers     d ON d.id = a.driver_id
       LEFT JOIN vehicles    v ON v.id = a.vehicle_id
       LEFT JOIN settlements s ON s.shipment_id = a.shipment_id
       WHERE a.company_id = $1
          OR a.carrier_company_id = $1
       ORDER BY a.archived_at DESC`,
      [companyId],
    );
    return rows;
  }
}

export const marketplaceRepository = new MarketplaceRepository();

// ── Archive log type ──────────────────────────────────────────────────────────

export interface ArchiveLog {
  id: string;
  shipment_id: string;
  company_id: string;
  carrier_company_id: string | null;
  pickup_address: string;
  delivery_address: string;
  cargo_type: string | null;
  cargo_weight_kg: number | null;
  final_status: string;
  cmr_document_url: string | null;
  final_rate_eur: number | null;
  archived_at: Date;
  driver_first_name: string | null;
  driver_last_name: string | null;
  vehicle_license_plate: string | null;
  settlement_amount: number | null;
  settlement_status: string | null;
}
