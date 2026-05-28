'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for missing default icon in Leaflet + React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const defaultCenter: [number, number] = [46.0569, 14.5058]; // Ljubljana
const defaultZoom = 7;

export default function VectraMap() {
  
  // Example hardcoded route: Ljubljana -> Munich
  const routePoints: [number, number][] = [
    [46.0569, 14.5058], // Ljubljana
    [46.2397, 14.3555], // Kranj
    [46.6151, 13.8458], // Villach
    [47.8095, 13.0432], // Salzburg
    [48.1351, 11.5820], // Munich
  ];

  return (
    <div className="h-full w-full">
      <MapContainer 
        center={defaultCenter} 
        zoom={defaultZoom} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {/* Origin Marker */}
        <Marker position={routePoints[0]}>
          <Popup>
            <div className="font-bold">Truck Origin</div>
            <div>Ljubljana, Slovenia</div>
          </Popup>
        </Marker>

        {/* Destination Marker */}
        <Marker position={routePoints[routePoints.length - 1]}>
          <Popup>
            <div className="font-bold">Truck Destination</div>
            <div>Munich, Germany</div>
          </Popup>
        </Marker>

        {/* Suggest Shipment Pickup Marker */}
        <Marker position={[46.23, 15.26]}> {/* Celje (Deviation) */}
          <Popup>
            <div className="font-bold text-primary-600">Possible Shipment Pickup</div>
            <div>Celje, Slovenia</div>
            <div className="text-xs mt-1">1200kg • 2 Pallets</div>
          </Popup>
        </Marker>

        <Polyline positions={routePoints} color="#3b82f6" weight={4} opacity={0.7} />
      </MapContainer>
    </div>
  );
}
