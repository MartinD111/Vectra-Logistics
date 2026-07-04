'use client';

// The Leaflet floor-plan canvas for the yard. Uses CRS.Simple — an abstract
// x/y coordinate space (units ≈ metres), NOT geography — so zones/slots/assets
// are laid out like a warehouse plan. Loaded via next/dynamic with ssr:false
// (Leaflet touches window). Yard y grows downward (top-left origin); Leaflet's
// lat grows upward, so we map lat = extentHeight - y.

import 'leaflet/dist/leaflet.css';
import { MapContainer, Rectangle, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import type { YardZone, YardSlot, YardAsset } from '@/lib/api/yard.api';

/** Fit the map to the yard extent once mounted (and keep it framed on resize). */
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [12, 12] });
    // Leaflet occasionally mounts at 0 size inside a freshly-laid-out card;
    // invalidate after a tick so panes get correct dimensions.
    const t = setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [12, 12] }); }, 200);
    return () => clearTimeout(t);
  }, [map, bounds]);
  return null;
}

const ASSET_STYLE: Record<string, { bg: string; label: string }> = {
  truck: { bg: '#10b981', label: '🚚' },
  container: { bg: '#8b5cf6', label: '📦' },
  trailer: { bg: '#f59e0b', label: '🚛' },
  wagon: { bg: '#0ea5e9', label: '🚃' },
};

export interface YardMapCanvasProps {
  extent: { width: number; height: number };
  zones: YardZone[];
  slots: YardSlot[];
  assets: YardAsset[];
  /** Called when an asset marker is dropped, with the new yard coordinates. */
  onAssetDrop: (assetId: string, x: number, y: number) => void;
}

export default function YardMapCanvas({ extent, zones, slots, assets, onAssetDrop }: YardMapCanvasProps) {
  const { width, height } = extent;
  const toLatLng = (x: number, y: number): [number, number] => [height - y, x];
  const bounds: [[number, number], [number, number]] = [[0, 0], [height, width]];

  const assetIcon = useMemo(() => new Map<string, L.DivIcon>(), []);
  const iconFor = (asset: YardAsset): L.DivIcon => {
    const key = `${asset.kind}:${asset.label}:${asset.status}`;
    const cached = assetIcon.get(key);
    if (cached) return cached;
    const s = ASSET_STYLE[asset.kind] ?? ASSET_STYLE.truck;
    const gate = asset.status === 'gate_in';
    const icon = L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;gap:4px;background:${s.bg};color:#fff;
        border:2px solid ${gate ? '#fff' : 'rgba(255,255,255,0.4)'};border-radius:8px;
        padding:2px 6px;font-size:11px;font-weight:700;white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);${gate ? 'outline:2px solid #10b981;' : ''}">
        <span>${s.label}</span><span>${escapeHtml(asset.label)}</span></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    assetIcon.set(key, icon);
    return icon;
  };

  return (
    <MapContainer
      crs={L.CRS.Simple}
      center={[height / 2, width / 2]}
      zoom={-1}
      minZoom={-3}
      maxZoom={2}
      style={{ height: '100%', width: '100%', background: '#f1f5f9', borderRadius: 12 }}
      zoomControl={false}
      attributionControl={false}
    >
      <FitBounds bounds={bounds} />
      {/* Zones */}
      {zones.map((z) => {
        const zb: [[number, number], [number, number]] = [
          toLatLng(z.x, z.y + z.height),
          toLatLng(z.x + z.width, z.y),
        ];
        return (
          <Rectangle key={z.id} bounds={zb}
            pathOptions={{ color: z.color ?? '#64748b', weight: 2, fillColor: z.color ?? '#64748b', fillOpacity: 0.08 }}>
            <Tooltip permanent direction="center" offset={[0, 0]}
              className="yard-zone-label">
              {z.name}
            </Tooltip>
          </Rectangle>
        );
      })}

      {/* Slots */}
      {slots.map((s) => {
        const half = 16;
        const sb: [[number, number], [number, number]] = [
          [height - s.y - half, s.x - half],
          [height - s.y + half, s.x + half],
        ];
        const occupied = s.status === 'occupied';
        return (
          <Rectangle key={s.id} bounds={sb}
            pathOptions={{
              color: occupied ? '#ef4444' : '#94a3b8',
              weight: 1,
              fillColor: occupied ? '#ef4444' : '#cbd5e1',
              fillOpacity: occupied ? 0.15 : 0.35,
              dashArray: occupied ? undefined : '3',
            }}>
            <Tooltip direction="top">{s.label} · {s.status}</Tooltip>
          </Rectangle>
        );
      })}

      {/* Assets (draggable) */}
      {assets.map((a) => (
        <Marker key={a.id} position={toLatLng(a.x, a.y)} icon={iconFor(a)} draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onAssetDrop(a.id, ll.lng, height - ll.lat);
            },
          }}>
          <Tooltip direction="top">{a.label}{a.identifier ? ` · ${a.identifier}` : ''}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
