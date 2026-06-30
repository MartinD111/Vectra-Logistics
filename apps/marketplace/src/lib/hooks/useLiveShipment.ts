'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSocketEvent,
  useSocketRoom,
  marketplaceQk as qk,
  type ShipmentLocationEvent,
  type ShipmentStatusEvent,
  type Shipment,
} from '@vectra/data';

export interface LiveLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed_kph?: number;
  recorded_at: string;
}

/**
 * Subscribes to live status + location updates for a shipment. Keeps the
 * cached shipment row up to date and exposes the latest GPS ping.
 */
export function useLiveShipment(shipmentId: string | undefined) {
  const qc = useQueryClient();
  const [location, setLocation] = useState<LiveLocation | null>(null);

  useSocketRoom(shipmentId ? `shipment:${shipmentId}` : null);

  useSocketEvent<ShipmentStatusEvent>('shipment:status', (evt) => {
    if (!shipmentId || evt.shipment_id !== shipmentId) return;
    qc.setQueryData<Shipment>(qk.shipment(shipmentId), (prev) =>
      prev ? { ...prev, status: evt.status, updated_at: evt.changed_at } : prev);
    qc.invalidateQueries({ queryKey: qk.shipments });
  });

  useSocketEvent<ShipmentLocationEvent>('shipment:location', (evt) => {
    if (!shipmentId || evt.shipment_id !== shipmentId) return;
    setLocation({
      lat: evt.lat,
      lng: evt.lng,
      heading: evt.heading,
      speed_kph: evt.speed_kph,
      recorded_at: evt.recorded_at,
    });
  });

  return { location };
}
