import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { notificationsService } from './notifications.service';

const requireUser = (req: AuthRequest): string => {
  if (!req.user) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

const router = Router();
router.use(authenticateToken);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await notificationsService.list(requireUser(req)));
}));

router.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const count = await notificationsService.unreadCount(requireUser(req));
  res.status(200).json({ count });
}));

router.post('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  const ok = await notificationsService.markRead(req.params.id, requireUser(req));
  if (!ok) throw new AppError(404, 'Notification not found');
  res.status(204).send();
}));

router.post('/read-all', asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationsService.markAllRead(requireUser(req));
  res.status(204).send();
}));

export default router;
