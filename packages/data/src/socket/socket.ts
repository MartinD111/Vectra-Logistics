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

  // Cookie first (the SSO source of truth, see @vectra/auth), localStorage as
  // the mirror/fallback — sessions restored from the cookie alone would
  // otherwise connect anonymously and never join the company room.
  const cookieToken = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((row) => row.startsWith('vectra_token='))?.slice('vectra_token='.length)
    : null;
  const token = (cookieToken ? decodeURIComponent(cookieToken) : null)
    ?? (typeof window !== 'undefined' ? localStorage.getItem('vectra_token') : null);

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
  'exception:new':           (payload: FleetExceptionEvent) => void;
  'exception:resolved':      (payload: { id: string; resolved_at: string }) => void;
  'draft:new':               (payload: ShipmentDraftEvent) => void;
  'draft:updated':           (payload: ShipmentDraftEvent) => void;
  'yard:asset':              (payload: YardAssetEvent) => void;
  'yard:zone':               (payload: unknown) => void;
  'yard:zone-deleted':       (payload: { id: string }) => void;
  'yard:wagon':              (payload: RailWagonEvent) => void;
  'pod:new':                 (payload: PodRequestEvent) => void;
  'pod:delivered':           (payload: PodRequestEvent) => void;
  'invoice:new':             (payload: InvoiceEvent) => void;
  'invoice:updated':         (payload: InvoiceEvent) => void;
  'ltl:suggestion':          (payload: LtlSuggestionEvent) => void;
  'ltl:updated':             (payload: LtlSuggestionEvent) => void;
}

export interface LtlSuggestionEvent {
  id: string;
  company_id: string;
  partial_load_id: string;
  route_id: string;
  route_label: string;
  partial_label: string;
  detour_km: number;
  detour_min: number;
  added_revenue_eur: number;
  margin_eur: number;
  score: number;
  status: string; // suggested | accepted | dismissed
  created_at: string;
}

export interface InvoiceEvent {
  id: string;
  company_id: string;
  client_id: string | null;
  number: string;
  description: string;
  amount_net: number;
  vat_treatment: string; // standard | reverse_charge | export_zero
  vat_rate: number;
  vat_amount: number;
  amount_total: number;
  status: string;        // draft | approved | paid | void
  pod_url: string | null;
  created_at: string;
}

export interface PodRequestEvent {
  id: string;
  company_id: string;
  token: string;
  label: string;
  shipment_id: string | null;
  status: string; // pending | delivered | expired
  pod_url: string | null;
  expires_at: string;
  delivered_at: string | null;
  created_at: string;
}

export interface YardAssetEvent {
  id: string;
  company_id: string;
  kind: string;   // truck | container | trailer | wagon
  label: string;
  identifier: string | null;
  slot_id: string | null;
  x: number; y: number;
  status: string; // in_yard | gate_in | departed
  source: string; // manual | gate_anpr | gate_ocr
}

export interface RailWagonEvent {
  id: string;
  company_id: string;
  wagon_number: string;
  status: string; // in_port | loading_sequence | in_transit | discharging
  seq: number;
  cargo: string | null;
}

export interface ShipmentDraftEvent {
  id: string;
  company_id: string;
  project_id: string | null;
  status: string; // needs_review | validated | confirmed | rejected
  origin: string | null;
  destination: string | null;
  cargo_type: string | null;
  weight_kg: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  wagon_number: string | null;
  reference: string | null;
  confidence: number | null;
  validation: Record<string, unknown>;
  created_at: string;
}

export interface FleetExceptionEvent {
  id: string;
  company_id: string;
  kind: string;     // border_delay | port_congestion | wagon_damage | engine_fault
  severity: string; // info | warning | critical
  title: string;
  detail: Record<string, unknown>;
  status: string;
  created_at: string;
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
  /** Message origin: internal | whatsapp | email. */
  channel?: string;
  created_at: string;
}
