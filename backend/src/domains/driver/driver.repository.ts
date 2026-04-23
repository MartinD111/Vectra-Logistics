import { db } from '../../core/db';
import {
  DriverActiveLoad,
  DriverHistoryEntry,
  PodDocument,
  DriverShipmentStatus,
} from './driver.types';

class DriverRepository {
  // ── User → Driver resolution ──────────────────────────────────────────────
  // The JWT carries user.id.  All shipment_assignments and status logs store
  // the canonical drivers.id.  This lookup bridges them.

  async findDriverIdByUserId(userId: string): Promise<string | null> {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return rows[0]?.id ?? null;
  }

  // ── Active load ───────────────────────────────────────────────────────────

  async findActiveLoadByDriverId(driverId: string): Promise<DriverActiveLoad | null> {
    const { rows } = await db.query<DriverActiveLoad>(
      `SELECT
         s.id, s.pickup_address, s.pickup_lat, s.pickup_lng,
         s.delivery_address, s.delivery_lat, s.delivery_lng,
         s.cargo_weight_kg, s.cargo_volume_m3, s.pallet_count, s.cargo_type,
         s.pickup_window_start, s.pickup_window_end, s.delivery_deadline,
         s.status, s.created_at, s.updated_at,
         sa.driver_id, sa.vehicle_id, sa.assigned_at,
         v.license_plate AS vehicle_license_plate
       FROM shipments s
       JOIN shipment_assignments sa ON sa.shipment_id = s.id
       JOIN vehicles v              ON v.id           = sa.vehicle_id
       WHERE sa.driver_id = $1
         AND s.status NOT IN ('completed', 'cancelled', 'delivered')
       ORDER BY sa.assigned_at DESC
       LIMIT 1`,
      [driverId],
    );
    return rows[0] ?? null;
  }

  // ── Status update ─────────────────────────────────────────────────────────

  async updateShipmentStatus(
    shipmentId: string,
    driverId: string,
    fromStatus: string,
    toStatus: DriverShipmentStatus,
  ): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE shipments
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status = $3`,
      [toStatus, shipmentId, fromStatus],
    );

    if ((rowCount ?? 0) === 0) return false;

    await db.query(
      `INSERT INTO driver_status_log (shipment_id, driver_id, from_status, to_status)
       VALUES ($1, $2, $3, $4)`,
      [shipmentId, driverId, fromStatus, toStatus],
    );

    return true;
  }

  // ── POD upload ────────────────────────────────────────────────────────────

  async savePodDocument(
    shipmentId: string,
    driverId: string | null,
    fileUrl: string,
    originalName: string | null,
    mimeType: string | null,
    sizeBytes: number | null,
  ): Promise<PodDocument> {
    const { rows } = await db.query<PodDocument>(
      `INSERT INTO driver_pod_documents
         (shipment_id, driver_id, file_url, original_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [shipmentId, driverId ?? null, fileUrl, originalName, mimeType, sizeBytes],
    );
    return rows[0];
  }

  // ── History ───────────────────────────────────────────────────────────────

  async findHistoryByDriverId(driverId: string): Promise<DriverHistoryEntry[]> {
    const { rows } = await db.query<DriverHistoryEntry>(
      `SELECT
         dsl.id,
         dsl.shipment_id,
         s.pickup_address,
         s.delivery_address,
         s.cargo_type,
         s.status          AS final_status,
         dsl.recorded_at   AS completed_at,
         NULL::numeric     AS distance_km
       FROM driver_status_log dsl
       JOIN shipments s ON s.id = dsl.shipment_id
       WHERE dsl.driver_id = $1
         AND dsl.to_status  = 'completed'
       ORDER BY dsl.recorded_at DESC`,
      [driverId],
    );
    return rows;
  }

  // ── Validation helpers ────────────────────────────────────────────────────

  async getShipmentStatus(shipmentId: string): Promise<string | null> {
    const { rows } = await db.query<{ status: string }>(
      `SELECT status FROM shipments WHERE id = $1 LIMIT 1`,
      [shipmentId],
    );
    return rows[0]?.status ?? null;
  }

  async isDriverAssignedToShipment(driverId: string, shipmentId: string): Promise<boolean> {
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM shipment_assignments
       WHERE shipment_id = $1 AND driver_id = $2`,
      [shipmentId, driverId],
    );
    return parseInt(rows[0].count, 10) > 0;
  }
}

export const driverRepository = new DriverRepository();
