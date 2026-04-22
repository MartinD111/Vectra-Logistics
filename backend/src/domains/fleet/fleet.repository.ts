import { db } from '../../core/db';
import { Driver, Vehicle } from './fleet.types';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

class FleetRepository {
  // ── Drivers ──────────────────────────────────────────────────────────────

  async findDriversByCompany(companyId: string): Promise<Driver[]> {
    const { rows } = await db.query<Driver>(
      `SELECT * FROM drivers WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async createDriver(companyId: string, dto: CreateDriverDto): Promise<Driver> {
    const { rows } = await db.query<Driver>(
      `INSERT INTO drivers (company_id, first_name, last_name, phone, email, license_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, dto.first_name, dto.last_name, dto.phone ?? null, dto.email ?? null, dto.license_number ?? null],
    );
    return rows[0];
  }

  async updateDriver(
    driverId: string,
    companyId: string,
    dto: UpdateDriverDto,
  ): Promise<Driver | null> {
    const { rows } = await db.query<Driver>(
      `UPDATE drivers SET
        first_name     = COALESCE($1, first_name),
        last_name      = COALESCE($2, last_name),
        phone          = COALESCE($3, phone),
        email          = COALESCE($4, email),
        license_number = COALESCE($5, license_number),
        status         = COALESCE($6, status),
        updated_at     = NOW()
       WHERE id = $7 AND company_id = $8 RETURNING *`,
      [
        dto.first_name ?? null,
        dto.last_name ?? null,
        dto.phone ?? null,
        dto.email ?? null,
        dto.license_number ?? null,
        dto.status ?? null,
        driverId,
        companyId,
      ],
    );
    return rows[0] ?? null;
  }

  async deleteDriver(driverId: string, companyId: string): Promise<void> {
    await db.query(
      `DELETE FROM drivers WHERE id = $1 AND company_id = $2`,
      [driverId, companyId],
    );
  }

  // ── Vehicles ─────────────────────────────────────────────────────────────

  async findVehiclesByCompany(companyId: string): Promise<Vehicle[]> {
    const { rows } = await db.query<Vehicle>(
      `SELECT * FROM vehicles WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async createVehicle(companyId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    const { rows } = await db.query<Vehicle>(
      `INSERT INTO vehicles (company_id, license_plate, vehicle_type, max_weight_kg, max_volume_m3, max_pallets)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, dto.license_plate, dto.vehicle_type, dto.max_weight_kg, dto.max_volume_m3, dto.max_pallets],
    );
    return rows[0];
  }

  async updateVehicle(
    vehicleId: string,
    companyId: string,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle | null> {
    const { rows } = await db.query<Vehicle>(
      `UPDATE vehicles SET
        license_plate = COALESCE($1, license_plate),
        vehicle_type  = COALESCE($2, vehicle_type),
        max_weight_kg = COALESCE($3, max_weight_kg),
        max_volume_m3 = COALESCE($4, max_volume_m3),
        max_pallets   = COALESCE($5, max_pallets),
        updated_at    = NOW()
       WHERE id = $6 AND company_id = $7 RETURNING *`,
      [
        dto.license_plate ?? null,
        dto.vehicle_type ?? null,
        dto.max_weight_kg ?? null,
        dto.max_volume_m3 ?? null,
        dto.max_pallets ?? null,
        vehicleId,
        companyId,
      ],
    );
    return rows[0] ?? null;
  }

  async deleteVehicle(vehicleId: string, companyId: string): Promise<void> {
    await db.query(
      `DELETE FROM vehicles WHERE id = $1 AND company_id = $2`,
      [vehicleId, companyId],
    );
  }
}

export const fleetRepository = new FleetRepository();
