import { AppError } from '../../core/errors/AppError';
import { fleetRepository } from './fleet.repository';
import { Driver, Vehicle } from './fleet.types';
import { CreateDriverSchema, CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverSchema, UpdateDriverDto } from './dto/update-driver.dto';
import { CreateVehicleSchema, CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleSchema, UpdateVehicleDto } from './dto/update-vehicle.dto';

class FleetService {
  // ── Drivers ──────────────────────────────────────────────────────────────

  async getDrivers(companyId: string): Promise<Driver[]> {
    return fleetRepository.findDriversByCompany(companyId);
  }

  async createDriver(companyId: string, body: unknown): Promise<Driver> {
    const parsed = CreateDriverSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }
    return fleetRepository.createDriver(companyId, parsed.data);
  }

  async updateDriver(
    driverId: string,
    companyId: string,
    body: unknown,
  ): Promise<Driver> {
    const parsed = UpdateDriverSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }
    const driver = await fleetRepository.updateDriver(driverId, companyId, parsed.data);
    if (!driver) throw new AppError(404, 'Driver not found');
    return driver;
  }

  async deleteDriver(driverId: string, companyId: string): Promise<void> {
    await fleetRepository.deleteDriver(driverId, companyId);
  }

  // ── Vehicles ─────────────────────────────────────────────────────────────

  async getVehicles(companyId: string): Promise<Vehicle[]> {
    return fleetRepository.findVehiclesByCompany(companyId);
  }

  async createVehicle(companyId: string, body: unknown): Promise<Vehicle> {
    const parsed = CreateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }
    return fleetRepository.createVehicle(companyId, parsed.data);
  }

  async updateVehicle(
    vehicleId: string,
    companyId: string,
    body: unknown,
  ): Promise<Vehicle> {
    const parsed = UpdateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues[0].message);
    }
    const vehicle = await fleetRepository.updateVehicle(vehicleId, companyId, parsed.data);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    return vehicle;
  }

  async deleteVehicle(vehicleId: string, companyId: string): Promise<void> {
    await fleetRepository.deleteVehicle(vehicleId, companyId);
  }
}

export const fleetService = new FleetService();
