import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { Response } from 'express';
import { authenticateToken, AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { documentsRepository } from './documents.repository';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_SUBJECTS = new Set(['company', 'driver', 'vehicle', 'shipment', 'booking']);

const router = Router();
router.use(authenticateToken);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  const { subject, subject_id, doc_type } = req.query;
  const docs = await documentsRepository.list(companyId, {
    subject: typeof subject === 'string' ? subject : undefined,
    subjectId: typeof subject_id === 'string' ? subject_id : undefined,
    documentType: typeof doc_type === 'string' ? doc_type : undefined,
  });
  res.status(200).json(docs);
}));

router.post('/', upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = req.user?.company_id;
  const userId = req.user?.id;
  if (!companyId || !userId) throw new AppError(403, 'No company associated');

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new AppError(400, 'File is required');

  const subject = String(req.body.subject ?? '');
  if (!ALLOWED_SUBJECTS.has(subject)) {
    throw new AppError(400, `subject must be one of ${[...ALLOWED_SUBJECTS].join(', ')}`);
  }
  const documentType = String(req.body.document_type ?? 'other');
  const subjectId = req.body.subject_id ? String(req.body.subject_id) : null;
  const issuedAt = req.body.issued_at ? String(req.body.issued_at) : null;
  const expiresAt = req.body.expires_at ? String(req.body.expires_at) : null;

  const doc = await documentsRepository.insert({
    subject,
    subjectId,
    documentType,
    fileUrl: `/uploads/${file.filename}`,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    issuedAt,
    expiresAt,
    uploadedBy: userId,
    companyId,
  });
  res.status(201).json(doc);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw new AppError(403, 'No company associated');
  const ok = await documentsRepository.delete(req.params.id, companyId);
  if (!ok) throw new AppError(404, 'Document not found');
  res.status(204).send();
}));

export default router;
