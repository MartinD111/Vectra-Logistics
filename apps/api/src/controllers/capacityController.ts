import { Request, Response } from 'express';
import { db } from '../config/db';
import axios from 'axios';

// Get list of active capacity listings
export const getCapacities = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM capacity_listings WHERE status = $1 ORDER BY created_at DESC', ['available']);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching capacities', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Publisher capacity listing to find freight
export const createCapacity = async (req: Request, res: Response) => {
  try {
    const {
      user_id, vehicle_id, origin_address, origin_lat, origin_lng,
      destination_address, destination_lat, destination_lng,
      departure_time, delivery_deadline, available_weight_kg,
      available_volume_m3, available_pallets, route_polyline
    } = req.body;

    const result = await db.query(
      `INSERT INTO capacity_listings (
        user_id, vehicle_id, origin_address, origin_lat, origin_lng,
        destination_address, destination_lat, destination_lng,
        departure_time, delivery_deadline, available_weight_kg,
        available_volume_m3, available_pallets, route_polyline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        user_id, vehicle_id, origin_address, origin_lat, origin_lng,
        destination_address, destination_lat, destination_lng,
        departure_time, delivery_deadline, available_weight_kg,
        available_volume_m3, available_pallets, route_polyline
      ]
    );
    
    const capacity = result.rows[0];

    // Trigger async matching engine calculation
    // axios.post(`${process.env.MATCHING_ENGINE_URL}/match`, { type: 'capacity', data: capacity }).catch(console.error);

    res.status(201).json(capacity);
  } catch (error) {
    console.error('Error creating capacity', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
