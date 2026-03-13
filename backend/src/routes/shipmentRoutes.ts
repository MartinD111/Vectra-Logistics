import { Router } from 'express';
import { getShipments, createShipment } from '../controllers/shipmentController';

const router = Router();

router.get('/', getShipments);
router.post('/', createShipment);

export default router;
