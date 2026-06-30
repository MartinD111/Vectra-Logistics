'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Distinct truck icon for the live position.
const truckIcon = L.divIcon({
  className: 'live-truck-icon',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">▲</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface Point { lat: number; lng: number; label?: string }

interface Props {
  origin: Point;
  destination: Point;
  live?: { lat: number; lng: number; speed_kph?: number; recorded_at: string } | null;
}

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function LiveTrackingMap({ origin, destination, live }: Props) {
  const points: Point[] = [origin, destination];
  if (live) points.push({ lat: live.lat, lng: live.lng });

  return (
    <div className="h-full w-full">
      <MapContainer center={[origin.lat, origin.lng]} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[origin.lat, origin.lng]} />
        <Marker position={[destination.lat, destination.lng]} />
        <Polyline
          positions={[[origin.lat, origin.lng], [destination.lat, destination.lng]]}
          color="#3b82f6"
          weight={3}
          opacity={0.4}
          dashArray="6,8"
        />
        {live && (
          <Marker position={[live.lat, live.lng]} icon={truckIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold mb-1">Truck location</p>
                {typeof live.speed_kph === 'number' && <p>Speed: {live.speed_kph.toFixed(0)} km/h</p>}
                <p>Updated: {new Date(live.recorded_at).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </Marker>
        )}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
