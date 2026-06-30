import { Router } from 'express';
import { getProfile, updateProfile, getCompany, updateCompany, getPreferences, updatePreferences } from '../controllers/profileController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All profile routes require authentication
router.use(authenticateToken);

router.get('/', getProfile);
router.put('/', updateProfile);

router.get('/company', getCompany);
router.put('/company', updateCompany);

router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

export default router;
