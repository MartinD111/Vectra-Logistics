import { Router } from 'express';
import { authenticateToken, requireRole } from '../../core/auth/middleware';
import {
  getDrivers, getDriver, createDriver, updateDriver, deleteDriver,
  getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle,
} from './fleet.controller';
import {
  getTelematics, calculateSpotQuote, listQuoteCities,
  listExceptions, createException, simulateException, resolveException,
} from './dispatcher.controller';

const router = Router();

router.use(authenticateToken, requireRole(['carrier', 'admin']));

// Dispatcher widgets (Phase 2)
router.get('/telematics', getTelematics);
router.get('/spot-quote/cities', listQuoteCities);
router.post('/spot-quote', calculateSpotQuote);
router.get('/exceptions', listExceptions);
router.post('/exceptions', createException);
router.post('/exceptions/simulate', simulateException);
router.patch('/exceptions/:id/resolve', resolveException);

router.get('/drivers', getDrivers);
router.get('/drivers/:id', getDriver);
router.post('/drivers', createDriver);
router.put('/drivers/:id', updateDriver);
router.delete('/drivers/:id', deleteDriver);

router.get('/vehicles', getVehicles);
router.get('/vehicles/:id', getVehicle);
router.post('/vehicles', createVehicle);
router.put('/vehicles/:id', updateVehicle);
router.delete('/vehicles/:id', deleteVehicle);

export default router;
