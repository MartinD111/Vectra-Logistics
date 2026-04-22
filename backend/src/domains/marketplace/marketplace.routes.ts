import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  getShipments, createShipment,
  getCapacities, createCapacity,
} from './marketplace.controller';

const router = Router();

// ── Shipments — GET is public, POST requires auth ─────────────────────────
router.get('/shipments', getShipments);
router.post('/shipments', authenticateToken, createShipment);

// ── Capacities — GET is public, POST requires auth ────────────────────────
router.get('/capacities', getCapacities);
router.post('/capacities', authenticateToken, createCapacity);

export default router;
