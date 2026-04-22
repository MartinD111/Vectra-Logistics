import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  getShipments, createShipment, assignShipment,
  getCapacities, createCapacity,
} from './marketplace.controller';

const router = Router();

// ── Shipments — GET is public, POST/mutations require auth ────────────────
router.get('/shipments', getShipments);
router.post('/shipments', authenticateToken, createShipment);
router.post('/shipments/:id/assign', authenticateToken, assignShipment);

// ── Capacities — GET is public, POST requires auth ────────────────────────
router.get('/capacities', getCapacities);
router.post('/capacities', authenticateToken, createCapacity);

export default router;
