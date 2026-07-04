import { Router } from 'express';
import { authenticateToken, requireRole } from '../../core/auth/middleware';
import {
  getLayout, createZone, deleteZone, createAsset, moveAsset,
  listWagons, createWagon, updateWagon,
} from './yard.controller';

const router = Router();
router.use(authenticateToken, requireRole(['carrier', 'admin']));

router.get('/layout', getLayout);
router.post('/zones', createZone);
router.delete('/zones/:id', deleteZone);
router.post('/assets', createAsset);
router.patch('/assets/:id', moveAsset);

router.get('/wagons', listWagons);
router.post('/wagons', createWagon);
router.patch('/wagons/:id', updateWagon);

export default router;
