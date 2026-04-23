import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { authenticateToken } from '../../core/auth/middleware';
import {
  getMyActiveLoad,
  updateStatus,
  submitPod,
  getHistory,
} from './driver.controller';

// ── Multer: disk storage for POD photos ───────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'pod'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `pod-${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are accepted for POD documents'));
      return;
    }
    cb(null, true);
  },
});

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// All driver endpoints require authentication
router.use(authenticateToken);

// GET  /api/v1/driver/active-load
router.get('/active-load', getMyActiveLoad);

// PATCH /api/v1/driver/shipments/:shipmentId/status
router.patch('/shipments/:shipmentId/status', updateStatus);

// POST  /api/v1/driver/shipments/:shipmentId/pod
router.post('/shipments/:shipmentId/pod', upload.single('document'), submitPod);

// GET  /api/v1/driver/history
router.get('/history', getHistory);

export default router;
