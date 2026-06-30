import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { bindIo } from './bus';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

interface JwtUser { id: string; role: string; company_id: string | null }

interface AuthSocket extends Socket {
  data: { user?: JwtUser };
}

const SAFE_ROOM_PREFIXES = ['shipment:', 'chat:', 'capacity:', 'company:'];

function isSafeRoom(room: string): boolean {
  return SAFE_ROOM_PREFIXES.some((p) => room.startsWith(p));
}

export function configureSocket(io: Server): void {
  bindIo(io);

  io.use((socket: AuthSocket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined)
              ?? (socket.handshake.headers.authorization?.split(' ')[1]);
    if (!token) {
      // Allow anonymous connections — they just don't get a user room.
      return next();
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtUser;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user:${user.id}`);
      if (user.company_id) socket.join(`company:${user.company_id}`);
    }

    socket.on('join', (room: string) => {
      if (typeof room !== 'string' || !isSafeRoom(room)) return;
      socket.join(room);
    });

    socket.on('leave', (room: string) => {
      if (typeof room !== 'string') return;
      socket.leave(room);
    });
  });
}
