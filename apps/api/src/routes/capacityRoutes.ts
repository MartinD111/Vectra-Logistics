import { Router } from 'express';
import { getCapacities, createCapacity } from '../controllers/capacityController';

const router = Router();

router.get('/', getCapacities);
router.post('/', createCapacity);

export default router;
