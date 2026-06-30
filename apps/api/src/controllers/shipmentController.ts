import { Request, Response } from 'express';
import { db } from '../config/db';
import axios from 'axios';

// Get list of active shipments
export const getShipments = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM shipments WHERE status = $1 ORDER BY created_at DESC', ['pending']);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching shipments', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new shipment and trigger match calculation
export const createShipment = async (req: Request, res: Response) => {
  try {
    const {
      user_id, pickup_address, pickup_lat, pickup_lng,
      delivery_address, delivery_lat, delivery_lng,
      cargo_weight_kg, cargo_volume_m3, pallet_count,
      cargo_type, pickup_window_start, pickup_window_end, delivery_deadline
    } = req.body;

    // Validate require fields logic here...

    const result = await db.query(
      `INSERT INTO shipments (
        user_id, pickup_address, pickup_lat, pickup_lng, 
        delivery_address, delivery_lat, delivery_lng, 
        cargo_weight_kg, cargo_volume_m3, pallet_count, cargo_type,
        pickup_window_start, pickup_window_end, delivery_deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        user_id, pickup_address, pickup_lat, pickup_lng,
        delivery_address, delivery_lat, delivery_lng,
        cargo_weight_kg, cargo_volume_m3, pallet_count, cargo_type,
        pickup_window_start, pickup_window_end, delivery_deadline
      ]
    );

    const shipment = result.rows[0];

    // Optionally trigger async matching engine calculation here
    // axios.post(`${process.env.MATCHING_ENGINE_URL}/match`, { type: 'shipment', data: shipment }).catch(console.error);

    res.status(201).json(shipment);
  } catch (error) {
    console.error('Error creating shipment', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
