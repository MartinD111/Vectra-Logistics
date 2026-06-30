import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../core/auth/middleware';
import { AppError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/errors/asyncHandler';
import { chatRepository } from './chat.repository';
import { emitToRoom } from '../../core/realtime/bus';

const requireUser = (req: AuthRequest): string => {
  if (!req.user) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

const router = Router();
router.use(authenticateToken);

router.post('/threads/by-shipment/:shipmentId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const { shipmentId } = req.params;
  let thread = await chatRepository.findThreadByShipment(shipmentId);
  if (!thread) thread = await chatRepository.createThreadForShipment(shipmentId);
  await chatRepository.addParticipant(thread.id, userId);
  res.status(200).json({ thread_id: thread.id });
}));

router.get('/threads/:threadId/messages', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const { threadId } = req.params;
  const allowed = await chatRepository.isParticipant(threadId, userId);
  if (!allowed) throw new AppError(403, 'Not a participant of this thread');
  res.status(200).json(await chatRepository.listMessages(threadId));
}));

router.post('/threads/:threadId/messages', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req);
  const { threadId } = req.params;
  const body = String(req.body?.body ?? '').trim();
  if (!body) throw new AppError(400, 'body is required');
  if (body.length > 4000) throw new AppError(400, 'body too long');

  const allowed = await chatRepository.isParticipant(threadId, userId);
  if (!allowed) throw new AppError(403, 'Not a participant of this thread');

  const message = await chatRepository.insertMessage(threadId, userId, body);
  emitToRoom(`chat:${threadId}`, 'chat:message', {
    id: message.id,
    thread_id: message.thread_id,
    shipment_id: message.shipment_id,
    booking_id: message.booking_id,
    sender_id: message.sender_id,
    sender_name: message.sender_name,
    body: message.body,
    created_at: message.created_at,
  });
  res.status(201).json(message);
}));

export default router;
