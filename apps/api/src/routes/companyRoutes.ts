import { Router } from 'express';
import {
  getCompanyBusinessCard,
  getVerificationStatus,
  submitVerification,
} from '../controllers/companyController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Public — any visitor can view a company's public profile card
router.get('/:id/business-card', getCompanyBusinessCard);

// Auth required — only the company itself or an admin may view verification status
router.get('/:id/verify', authenticateToken, getVerificationStatus);

// Auth required — submit a document for company verification
// NOTE: This route must be registered BEFORE /:id/* wildcard routes so that
// the literal segment "verification" is not mistakenly treated as an :id param.
router.post('/verification/submit', authenticateToken, submitVerification);

export default router;
