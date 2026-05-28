import { Router } from 'express';
import { authenticateToken } from '../../core/auth/middleware';
import {
  getShipments, getShipment, createShipment, assignShipment, bookShipment,
  getCapacities, getCapacity, createCapacity,
  cancelShipment, cancelCapacity, getShipmentMatches,
} from './marketplace.controller';

const router = Router();

// ── Shipments — GET is public, mutations require auth ─────────────────────
router.get('/shipments', getShipments);
router.get('/shipments/:id', getShipment);
router.get('/shipments/:id/matches', getShipmentMatches);
router.post('/shipments', authenticateToken, createShipment);
router.post('/shipments/:id/assign', authenticateToken, assignShipment);
router.post('/shipments/:id/book', authenticateToken, bookShipment);
router.post('/shipments/:id/cancel', authenticateToken, cancelShipment);

// ── Capacities ────────────────────────────────────────────────────────────
router.get('/capacities', getCapacities);
router.get('/capacities/:id', getCapacity);
router.post('/capacities', authenticateToken, createCapacity);
router.post('/capacities/:id/cancel', authenticateToken, cancelCapacity);

export default router;
