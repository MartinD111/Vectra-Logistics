import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { getDocuments, uploadCompanyDocument, getCompanyDocuments } from '../controllers/documentsController';
import { authenticateToken } from '../middleware/authMiddleware';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

const router = Router();
router.use(authenticateToken);

router.get('/', getDocuments);
router.get('/company', getCompanyDocuments);
router.post('/company', upload.single('file'), uploadCompanyDocument);

export default router;
