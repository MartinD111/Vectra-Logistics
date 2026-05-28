import { Router } from 'express';
import {
  submitRating,
  getCompanyRatings,
  getCompanyRatingSummary,
} from '../controllers/ratingsController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// POST /api/ratings — submit a rating for a completed booking (auth required)
router.post('/', authenticateToken, submitRating);

// GET /api/ratings/company/:companyId — paginated list of ratings for a company (public)
router.get('/company/:companyId', getCompanyRatings);

// GET /api/ratings/company/:companyId/summary — aggregated score summary (public)
router.get('/company/:companyId/summary', getCompanyRatingSummary);

export default router;
