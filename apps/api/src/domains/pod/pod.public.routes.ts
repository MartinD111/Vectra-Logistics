// Public (no-auth) POD surface for the driver's phone. Mounted at /api/pod in
// server.ts alongside webhookRoutes — deliberately NOT behind authenticateToken.
// The single-use token is the only credential.

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { podService } from './pod.service';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `pod-${unique}${path.extname(file.originalname) || '.jpg'}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// Driver page fetches the delivery summary for the token.
router.get('/:token', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await podService.getPublic(req.params.token));
}));

// Driver uploads the POD photo (field name: file).
router.post('/:token', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) { res.status(400).json({ error: 'A photo is required.' }); return; }
  const request = await podService.attachPod(req.params.token, file);
  res.status(200).json({ ok: true, pod_url: request.pod_url });
}));

export default router;
