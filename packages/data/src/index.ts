// @vectra/data — cross-app data layer shared by Marketplace and Workspaces.
//
// Realtime socket, notifications, and document components/hooks/api live here
// because both apps need them. Marketplace-only data (marketplace.api,
// useMarketplace, chat, useLiveShipment) stays in the Marketplace app.

// ── Socket ──────────────────────────────────────────────────────────────────
export {
  getSocket,
  reconnectSocket,
  disconnectSocket,
} from './socket/socket';
export type {
  ServerEvents,
  NotificationEvent,
  ShipmentStatusEvent,
  ShipmentLocationEvent,
  ChatMessageEvent,
} from './socket/socket';
export {
  useSocket,
  useSocketEvent,
  useSocketRoom,
} from './socket/useSocket';

// ── Notifications ───────────────────────────────────────────────────────────
export { notificationsApi } from './notifications/notifications.api';
export type { NotificationRecord } from './notifications/notifications.api';
export {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
} from './notifications/useNotifications';
export { default as NotificationBell } from './notifications/NotificationBell';

// ── Documents ───────────────────────────────────────────────────────────────
export {
  documentsApi,
  isExpired,
  expiresWithinDays,
  DOC_TYPE_LABELS,
} from './documents/documents.api';
export type {
  DocumentRecord,
  DocumentSubject,
  DocumentType,
  UploadDocumentInput,
} from './documents/documents.api';
export {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  docQk,
} from './documents/useDocuments';
export { default as FileUploader } from './documents/FileUploader';
export { default as DocumentList } from './documents/DocumentList';
export { default as DocumentExpiryBanner } from './documents/DocumentExpiryBanner';

// ── Marketplace data (shared by Marketplace floor + Workspaces cockpit) ───────
export { marketplaceApi } from './marketplace/marketplace.api';
export type {
  Shipment,
  Capacity,
  ShipmentMatch,
  ShipmentWithComms,
  AssignShipmentResponse,
  AssignmentCommunications,
  ArchiveLog,
  CreateShipmentDto,
  CreateCapacityDto,
} from './marketplace/marketplace.api';
export {
  useShipments,
  useShipment,
  useCapacities,
  useCapacity,
  useCreateShipment,
  useCreateCapacity,
  useCancelShipment,
  useCancelCapacity,
  useBookShipment,
  useShipmentMatches,
  useVehicles,
  qk as marketplaceQk,
} from './marketplace/useMarketplace';
export { geocode, geocodeFirst } from './marketplace/geocode';
export type { GeocodeResult } from './marketplace/geocode';
export { default as StatusBadge } from './marketplace/StatusBadge';

// ── Maps ──────────────────────────────────────────────────────────────────────
// MapProvider is SSR-safe (no module-scope leaflet) so it stays in the main
// barrel. The leaflet-backed components (VectraMap, RoutePreviewMap,
// LiveTrackingMap) are NOT exported here — leaflet touches `window` at module
// scope and would break SSR for every consumer. Import those from the
// SSR-isolated sub-path '@vectra/data/map' via next/dynamic({ ssr: false }).
export { default as MapProvider } from './map/MapProvider';
export type { RoutePoint } from './map/RoutePreviewMap';

// ── Fleet data ────────────────────────────────────────────────────────────────
export { fleetApi } from './fleet/fleet.api';
export type {
  Driver,
  Vehicle,
  CreateDriverDto,
  CreateVehicleDto,
  UpdateDriverDto,
  UpdateVehicleDto,
} from './fleet/fleet.api';
export {
  useDriver,
  useVehicle,
  useUpdateDriver,
  useUpdateVehicle,
  fleetQk,
} from './fleet/useFleet';
