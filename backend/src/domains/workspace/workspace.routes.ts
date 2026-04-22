import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../../core/auth/middleware';
import {
  getCompanyBusinessCard,
  getVerificationStatus,
  submitVerification,
  submitRating,
  getCompanyRatings,
  getCompanyRatingSummary,
  getDocuments,
  uploadCompanyDocument,
  getCompanyDocuments,
  parseRateConfirmation,
} from './workspace.controller';

// ── Multer — scoped to this domain ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

const router = Router();

// ── Company routes ─────────────────────────────────────────────────────────
// NOTE: /company/verification/submit must be registered before /company/:id/*
// so the literal segment "verification" is never matched as an :id param.
router.post('/company/verification/submit', authenticateToken, submitVerification);
router.get('/company/:id/business-card', getCompanyBusinessCard);
router.get('/company/:id/verify', authenticateToken, getVerificationStatus);

// ── Ratings routes ─────────────────────────────────────────────────────────
router.post('/ratings', authenticateToken, submitRating);
router.get('/ratings/company/:companyId', getCompanyRatings);
router.get('/ratings/company/:companyId/summary', getCompanyRatingSummary);

// ── Documents routes ───────────────────────────────────────────────────────
router.use('/documents', authenticateToken);
router.get('/documents', getDocuments);
router.get('/documents/company', getCompanyDocuments);
router.post('/documents/company', upload.single('file'), uploadCompanyDocument);

// ── Automations routes ─────────────────────────────────────────────────────
// NOTE: literal path registered before any future wildcard automation routes.
router.post('/automations/parse-rate', authenticateToken, upload.single('file'), parseRateConfirmation);

export default router;
