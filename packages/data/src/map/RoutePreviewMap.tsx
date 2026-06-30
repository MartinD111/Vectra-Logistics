'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  origin?: RoutePoint | null;
  destination?: RoutePoint | null;
  className?: string;
}

function FitBounds({ points }: { points: RoutePoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 8);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, points]);
  return null;
}

export default function RoutePreviewMap({ origin, destination, className }: Props) {
  const points: RoutePoint[] = [];
  if (origin) points.push(origin);
  if (destination) points.push(destination);

  return (
    <div className={className ?? 'h-full w-full'}>
      <MapContainer
        center={[46.0569, 14.5058]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {origin && <Marker position={[origin.lat, origin.lng]} />}
        {destination && <Marker position={[destination.lat, destination.lng]} />}
        {origin && destination && (
          <Polyline
            positions={[[origin.lat, origin.lng], [destination.lat, destination.lng]]}
            color="#3b82f6"
            weight={4}
            opacity={0.7}
            dashArray="6,8"
          />
        )}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
