import { Response } from 'express';
import { db } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ──────────── DRIVERS ────────────

export const getDrivers = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated' });

    const result = await db.query(
      `SELECT * FROM drivers WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDriver = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated' });

    const { first_name, last_name, phone, email, license_number } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'first_name and last_name are required' });

    const result = await db.query(
      `INSERT INTO drivers (company_id, first_name, last_name, phone, email, license_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, first_name, last_name, phone, email, license_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateDriver = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { first_name, last_name, phone, email, license_number, status } = req.body;

    const result = await db.query(
      `UPDATE drivers SET
        first_name = COALESCE($1, first_name),
        last_name  = COALESCE($2, last_name),
        phone      = COALESCE($3, phone),
        email      = COALESCE($4, email),
        license_number = COALESCE($5, license_number),
        status     = COALESCE($6, status),
        updated_at = NOW()
       WHERE id = $7 AND company_id = $8 RETURNING *`,
      [first_name, last_name, phone, email, license_number, status, id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteDriver = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    await db.query(`DELETE FROM drivers WHERE id = $1 AND company_id = $2`, [id, companyId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ──────────── VEHICLES ────────────

export const getVehicles = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated' });

    const result = await db.query(
      `SELECT * FROM vehicles WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated' });

    const { license_plate, vehicle_type, max_weight_kg, max_volume_m3, max_pallets } = req.body;
    if (!license_plate || !vehicle_type) return res.status(400).json({ error: 'license_plate and vehicle_type are required' });

    const result = await db.query(
      `INSERT INTO vehicles (company_id, license_plate, vehicle_type, max_weight_kg, max_volume_m3, max_pallets)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, license_plate, vehicle_type, max_weight_kg || 0, max_volume_m3 || 0, max_pallets || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { license_plate, vehicle_type, max_weight_kg, max_volume_m3, max_pallets } = req.body;

    const result = await db.query(
      `UPDATE vehicles SET
        license_plate  = COALESCE($1, license_plate),
        vehicle_type   = COALESCE($2, vehicle_type),
        max_weight_kg  = COALESCE($3, max_weight_kg),
        max_volume_m3  = COALESCE($4, max_volume_m3),
        max_pallets    = COALESCE($5, max_pallets),
        updated_at     = NOW()
       WHERE id = $6 AND company_id = $7 RETURNING *`,
      [license_plate, vehicle_type, max_weight_kg, max_volume_m3, max_pallets, id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    await db.query(`DELETE FROM vehicles WHERE id = $1 AND company_id = $2`, [id, companyId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
