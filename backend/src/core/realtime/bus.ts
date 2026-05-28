/**
 * Realtime event bus. Services emit through this — the socket layer is the only
 * place that imports the Socket.io Server. This avoids circular deps and lets
 * services stay test-friendly.
 */
import type { Server } from 'socket.io';

let io: Server | null = null;

export function bindIo(server: Server): void {
  io = server;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToRoom(room: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(room).emit(event, payload);
}

export function emitBroadcast(event: string, payload: unknown): void {
  if (!io) return;
  io.emit(event, payload);
}
