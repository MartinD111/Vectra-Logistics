import { Router } from 'express';
import {
  getDrivers, createDriver, updateDriver, deleteDriver,
  getVehicles, createVehicle, updateVehicle, deleteVehicle
} from '../controllers/fleetController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateToken, requireRole(['carrier', 'admin']));

router.get('/drivers', getDrivers);
router.post('/drivers', createDriver);
router.put('/drivers/:id', updateDriver);
router.delete('/drivers/:id', deleteDriver);

router.get('/vehicles', getVehicles);
router.post('/vehicles', createVehicle);
router.put('/vehicles/:id', updateVehicle);
router.delete('/vehicles/:id', deleteVehicle);

export default router;
