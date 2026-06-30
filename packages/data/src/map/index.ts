// Map components are isolated behind this sub-path (@vectra/data/map) because
// they import leaflet, which touches `window` at module scope and breaks SSR.
// Import them ONLY via next/dynamic with { ssr: false } so they never load on
// the server. Keeping them out of the main @vectra/data barrel lets SSR-safe
// pages import marketplace/fleet data without dragging leaflet in.

export { default as VectraMap } from './VectraMap';
export { default as RoutePreviewMap } from './RoutePreviewMap';
export { default as LiveTrackingMap } from './LiveTrackingMap';
export type { RoutePoint } from './RoutePreviewMap';
