import { io, type Socket } from 'socket.io-client';

const URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

let socket: Socket | null = null;

/**
 * Returns the lazy-init shared Socket.io client. Auth token is read from
 * localStorage on each connect — call `reconnectSocket()` after login/logout
 * to refresh the credentials.
 */
export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('vectra_token') : null;

  socket = io(URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    auth: token ? { token } : undefined,
  });

  return socket;
}

export function reconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket();
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Server → client event contracts. These names define the backend handler
 * surface; document any change here in tandem with the backend.
 */
export interface ServerEvents {
  'notification:new':        (payload: NotificationEvent) => void;
  'shipment:status':         (payload: ShipmentStatusEvent) => void;
  'shipment:location':       (payload: ShipmentLocationEvent) => void;
  'chat:message':            (payload: ChatMessageEvent) => void;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  created_at: string;
}

export interface ShipmentStatusEvent {
  shipment_id: string;
  status: string;
  changed_at: string;
}

export interface ShipmentLocationEvent {
  shipment_id: string;
  lat: number;
  lng: number;
  heading?: number;
  speed_kph?: number;
  recorded_at: string;
}

export interface ChatMessageEvent {
  id: string;
  thread_id: string;
  shipment_id?: string;
  booking_id?: string;
  sender_id: string;
  sender_name?: string;
  body: string;
  created_at: string;
}
