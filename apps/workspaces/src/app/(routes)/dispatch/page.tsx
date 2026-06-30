'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, type Shipment } from '@/lib/api/marketplace.api';
import { fleetApi, type Vehicle } from '@/lib/api/fleet.api';

// ── Droppable ID namespacing ─────────────────────────────────────────────────
// Vehicle card drop zones use "vehicle:<id>"
// The open TrailerVisualizer canvas uses "visualizer:<id>"

const vehicleDropId = (id: string) => `vehicle:${id}`;
const visualizerDropId = (id: string) => `visualizer:${id}`;

function parseDropId(id: string): { kind: 'vehicle' | 'visualizer'; vehicleId: string } | null {
  const [kind, vehicleId] = id.split(':');
  if ((kind === 'vehicle' || kind === 'visualizer') && vehicleId) {
    return { kind, vehicleId };
  }
  return null;
}

// ── Skeleton loaders ─────────────────────────────────────────────────────────

function ShipmentSkeleton() {
  return (
    <div className="bg-[#0f1523] border border-slate-800 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <div className="h-4 w-20 bg-slate-800 rounded" />
          <div className="h-4 w-16 bg-slate-800 rounded" />
        </div>
        <div className="h-4 w-12 bg-slate-800 rounded" />
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="space-y-1.5">
          <div className="h-3 w-10 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-700 rounded" />
        </div>
        <div className="h-5 w-5 bg-slate-800 rounded" />
        <div className="space-y-1.5 items-end flex flex-col">
          <div className="h-3 w-16 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-700 rounded" />
        </div>
      </div>
    </div>
  );
}

function VehicleSkeleton() {
  return (
    <div className="bg-[#0f1523] border border-slate-800 rounded-xl p-5 min-h-[160px] animate-pulse flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-slate-700 rounded" />
          <div className="h-4 w-28 bg-slate-800 rounded" />
        </div>
        <div className="h-6 w-20 bg-slate-800 rounded-full" />
      </div>
      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
        <div className="flex -space-x-2">
          <div className="w-8 h-8 rounded-full bg-slate-800" />
          <div className="w-8 h-8 rounded-full bg-slate-800" />
        </div>
        <div className="h-4 w-24 bg-slate-800 rounded" />
      </div>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  );
}

// ── Shipment card inner content (shared between draggable + drag overlay) ────

interface ShipmentCardContentProps {
  shipment: Shipment;
  isDragging?: boolean;
}

function ShipmentCardContent({ shipment, isDragging = false }: ShipmentCardContentProps) {
  const weightTons = shipment.cargo_weight_kg
    ? (shipment.cargo_weight_kg / 1000).toFixed(1) + 't'
    : '—';
  const cargoType = shipment.cargo_type ?? 'General';
  const origin = shipment.pickup_address ?? '—';
  const dest = shipment.delivery_address ?? '—';
  const isReefer =
    cargoType.toLowerCase().includes('refrig') || cargoType.toLowerCase().includes('cold');

  return (
    <div
      className={`bg-[#0f1523] border rounded-xl p-5 relative overflow-hidden transition-all duration-150 ${
        isDragging
          ? 'border-indigo-500/70 shadow-[0_0_30px_rgba(79,70,229,0.35)] opacity-95 scale-[1.02]'
          : 'border-slate-800 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(79,70,229,0.1)]'
      }`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 to-transparent pointer-events-none rounded-bl-3xl" />

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-500">
            #{shipment.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
            {cargoType}
          </span>
          {isReefer && (
            <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded border border-cyan-500/20 font-medium">
              Reefer
            </span>
          )}
        </div>
        <span className="text-slate-300 font-mono font-medium shrink-0">{weightTons}</span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Origin</span>
          <span className="text-white font-medium mt-0.5 text-sm">{origin}</span>
        </div>
        <div className="px-4 text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Destination</span>
          <span className="text-white font-medium mt-0.5 text-sm">{dest}</span>
        </div>
      </div>
    </div>
  );
}

// ── Draggable shipment card ───────────────────────────────────────────────────

function DraggableShipmentCard({ shipment }: { shipment: Shipment }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shipment.id,
    data: { shipment },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing touch-none"
      style={{
        transform: CSS.Translate.toString(transform),
        // Keep the original slot visible (ghost) while dragging; the overlay
        // renders the "lifted" visual via DragOverlay below.
        opacity: isDragging ? 0.35 : 1,
        transition: isDragging ? 'none' : 'opacity 0.15s',
      }}
    >
      <ShipmentCardContent shipment={shipment} isDragging={false} />
    </div>
  );
}

// ── Droppable vehicle card ────────────────────────────────────────────────────

interface DroppableVehicleCardProps {
  vehicle: Vehicle;
  assignedCount: number;
  onOpenVisualizer: () => void;
}

function DroppableVehicleCard({ vehicle, assignedCount, onOpenVisualizer }: DroppableVehicleCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: vehicleDropId(vehicle.id) });

  const maxWeightTons = vehicle.max_weight_kg
    ? (vehicle.max_weight_kg / 1000).toFixed(1) + 't'
    : null;
  const vehicleType = vehicle.vehicle_type ?? 'Vehicle';

  return (
    <div
      ref={setNodeRef}
      onClick={onOpenVisualizer}
      className={`bg-[#0f1523] border rounded-xl p-5 transition-all duration-150 cursor-pointer relative group flex flex-col justify-between min-h-[160px] ${
        isOver
          ? 'border-indigo-400/80 shadow-[0_0_25px_rgba(79,70,229,0.3)] bg-[#131a2e]'
          : 'border-slate-800 hover:border-slate-600 hover:bg-[#131a2b]'
      }`}
    >
      {/* Drop hint overlay */}
      {isOver && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-indigo-500/60 pointer-events-none flex items-center justify-center z-10">
          <span className="text-indigo-300 text-sm font-semibold bg-[#0f1523]/80 px-3 py-1 rounded-lg">
            Release to assign
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />

      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{vehicle.license_plate}</h3>
          <p className="text-sm text-slate-400 font-medium">{vehicleType}</p>
          {maxWeightTons && (
            <p className="text-xs text-slate-500 mt-0.5">Max {maxWeightTons}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            Available
          </div>
          {assignedCount > 0 && (
            <div className="px-2.5 py-1 rounded-full text-xs font-bold border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
              {assignedCount} assigned
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
        <div className="flex -space-x-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f1523] flex items-center justify-center text-xs font-medium text-slate-400">1</div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f1523] flex items-center justify-center text-xs font-medium text-slate-400">2</div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f1523] border-dashed flex items-center justify-center text-xs font-medium text-slate-500">+</div>
        </div>
        <div className="text-indigo-400 text-sm font-medium group-hover:underline flex items-center gap-1">
          Open Optimizer
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Trailer Visualizer (with droppable canvas) ────────────────────────────────

interface TrailerVisualizerProps {
  vehicle: Vehicle;
  assignedShipments: Shipment[];
  onClose: () => void;
}

const TrailerVisualizer = ({ vehicle, assignedShipments, onClose }: TrailerVisualizerProps) => {
  const [viewMode, setViewMode] = useState<'2d-top' | '2d-side' | '3d-iso'>('3d-iso');

  const { setNodeRef: setVisualizerRef, isOver: isOverVisualizer } = useDroppable({
    id: visualizerDropId(vehicle.id),
  });

  const displayName = `${vehicle.license_plate} — ${vehicle.vehicle_type}`;
  const isLivestock = vehicle.vehicle_type?.toLowerCase().includes('livestock');
  const isReefer = vehicle.vehicle_type?.toLowerCase().includes('reefer');
  const maxWeightTons = vehicle.max_weight_kg
    ? (vehicle.max_weight_kg / 1000).toFixed(1) + 't'
    : '—';
  const maxPallets = vehicle.max_pallets ?? '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div className="w-[800px] h-full bg-[#0a0f1a] border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#0d1322]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{displayName}</h2>
            <p className="text-sm text-slate-400 mt-1 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Visual Load Optimizer Active</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* View Toggles */}
        <div className="p-4 flex justify-between items-center bg-[#0d1322]/50 border-b border-slate-800/50">
          <div className="flex space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(['2d-top', '2d-side', '3d-iso'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === mode
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {mode === '2d-top' && 'Top (2D)'}
                {mode === '2d-side' && 'Side (2D)'}
                {mode === '3d-iso' && 'Isometric (3D)'}
              </button>
            ))}
          </div>
          <div className="flex space-x-4">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Max Payload</p>
              <p className="text-emerald-400 font-mono text-sm">{maxWeightTons}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Max Pallets</p>
              <p className="text-emerald-400 font-mono text-sm">{maxPallets}</p>
            </div>
          </div>
        </div>

        {/* Livestock compliance banner */}
        {isLivestock && (
          <div className="px-6 py-4 flex gap-4 bg-orange-950/20 border-b border-orange-900/30">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-orange-400/80 uppercase tracking-wider font-semibold">Ventilation Status</span>
              <span className="text-orange-300 font-medium text-lg flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Active (3 Levels)
              </span>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-orange-400/80 uppercase tracking-wider font-semibold">Current Temp</span>
              <span className="text-orange-300 font-medium text-lg">18°C</span>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-orange-400/80 uppercase tracking-wider font-semibold">Mandatory Water Stop</span>
              <span className="text-orange-300 font-medium text-lg">2h 15m remaining</span>
            </div>
          </div>
        )}

        {/* Reefer temperature banner */}
        {isReefer && (
          <div className="px-6 py-4 flex gap-4 bg-cyan-950/20 border-b border-cyan-900/30">
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-cyan-400/80 uppercase tracking-wider font-semibold">Refrigeration Status</span>
              <span className="text-cyan-300 font-medium text-lg">Active</span>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-cyan-400/80 uppercase tracking-wider font-semibold">Set Point</span>
              <span className="text-cyan-300 font-medium text-lg">-18°C</span>
            </div>
          </div>
        )}

        {/* Assigned shipments strip */}
        {assignedShipments.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-800 bg-indigo-950/20 flex gap-2 flex-wrap">
            {assignedShipments.map(s => (
              <span
                key={s.id}
                className="text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full font-mono"
              >
                #{s.id.slice(0, 8).toUpperCase()} · {s.cargo_type ?? 'General'}
              </span>
            ))}
          </div>
        )}

        {/* 3D / 2D Canvas — also a drop target */}
        <div
          ref={setVisualizerRef}
          className={`flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-[#0a0f1a] to-[#05080f] overflow-hidden relative flex items-center justify-center p-8 transition-all duration-150 ${
            isOverVisualizer ? 'ring-2 ring-inset ring-indigo-500/50' : ''
          }`}
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          {isOverVisualizer && (
            <div className="absolute inset-4 rounded-xl border-2 border-dashed border-indigo-500/50 pointer-events-none flex items-end justify-center pb-6 z-10">
              <span className="text-indigo-300 text-sm font-semibold bg-[#0a0f1a]/90 px-4 py-2 rounded-lg">
                Drop to add to load plan
              </span>
            </div>
          )}

          <div
            className="w-[200px] h-[500px] bg-slate-800/80 backdrop-blur-md border-2 border-slate-600 rounded-sm relative transition-all duration-700 ease-in-out shadow-[0_0_50px_rgba(79,70,229,0.15)] flex flex-col gap-2 p-2"
            style={{
              transformStyle: 'preserve-3d',
              transform:
                viewMode === '3d-iso'
                  ? 'perspective(1200px) rotateX(60deg) rotateZ(-40deg) scale(0.9) translateY(-100px)'
                  : viewMode === '2d-side'
                  ? 'perspective(1200px) rotateY(-80deg) scale(1.1)'
                  : 'perspective(1200px) rotateX(0deg) rotateZ(0deg) scale(1)',
            }}
          >
            <div className="w-full flex-1 border border-dashed border-slate-500/40 rounded flex flex-col items-center justify-center relative group cursor-crosshair hover:bg-indigo-500/10 transition-colors">
              <span className="text-slate-500 font-mono text-sm group-hover:text-amber-400 transition-colors">
                Drop Zone 1
              </span>
              {assignedShipments[0] && (
                <div
                  className="absolute inset-[10%] bg-indigo-500/20 backdrop-blur-sm border border-indigo-500/50 rounded flex items-center justify-center shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]"
                  style={{ transform: 'translateZ(20px)' }}
                >
                  <span className="text-indigo-300 font-mono text-xs">
                    #{assignedShipments[0].id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
              )}
              {!assignedShipments[0] && (
                <div
                  className="absolute inset-[10%] bg-indigo-500/20 backdrop-blur-sm border border-indigo-500/50 rounded flex items-center justify-center shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]"
                  style={{ transform: 'translateZ(20px)' }}
                >
                  <span className="text-indigo-300 font-mono text-xs">PALLET #A1</span>
                </div>
              )}
            </div>
            <div className="w-full flex-1 border border-dashed border-slate-500/40 rounded flex flex-col items-center justify-center cursor-crosshair hover:bg-indigo-500/10 transition-colors">
              <span className="text-slate-500 font-mono text-sm">Drop Zone 2</span>
            </div>
            <div className="w-full flex-1 border border-dashed border-slate-500/40 rounded flex flex-col items-center justify-center cursor-crosshair hover:bg-indigo-500/10 transition-colors">
              <span className="text-slate-500 font-mono text-sm">Drop Zone 3</span>
            </div>

            <div
              className="absolute top-0 right-full w-[40px] h-full bg-slate-700 origin-right transition-opacity duration-300"
              style={{ transform: 'rotateY(-90deg)', opacity: viewMode === '3d-iso' ? 1 : 0 }}
            />
            <div
              className="absolute bottom-full left-0 w-full h-[40px] bg-slate-600 origin-bottom transition-opacity duration-300"
              style={{ transform: 'rotateX(90deg)', opacity: viewMode === '3d-iso' ? 1 : 0 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-[#0d1322] flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button className="px-6 py-2.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all">
            Confirm Load Plan
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

// Local state shape: map of vehicleId → Shipment[] for optimistic assignments.
type AssignmentMap = Record<string, Shipment[]>;

export default function SmartDispatchBoard() {
  const qc = useQueryClient();

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // Tracks the id of the shipment currently being dragged, for the DragOverlay.
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: shipments,
    isLoading: shipmentsLoading,
    isError: shipmentsError,
  } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => marketplaceApi.getShipments(),
  });

  const {
    data: vehicles,
    isLoading: vehiclesLoading,
    isError: vehiclesError,
  } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => fleetApi.getVehicles(),
  });

  // ── Mutation with optimistic update ───────────────────────────────────────

  const assignMutation = useMutation({
    mutationFn: ({ shipmentId, vehicleId }: { shipmentId: string; vehicleId: string }) =>
      marketplaceApi.assignShipmentToVehicle(shipmentId, vehicleId),

    onMutate: async ({ shipmentId, vehicleId }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic state.
      await qc.cancelQueries({ queryKey: ['shipments'] });

      // Snapshot the current cache for rollback.
      const previousShipments = qc.getQueryData<Shipment[]>(['shipments']);
      const previousAssignments = qc.getQueryData<AssignmentMap>(['assignments']) ?? {};

      // Find the full shipment object we're moving.
      const moving = previousShipments?.find(s => s.id === shipmentId);
      if (!moving) return { previousShipments, previousAssignments };

      // Optimistically remove from the pending list.
      qc.setQueryData<Shipment[]>(['shipments'], old =>
        (old ?? []).filter(s => s.id !== shipmentId),
      );

      // Optimistically add to the vehicle's local assignment bucket.
      qc.setQueryData<AssignmentMap>(['assignments'], old => ({
        ...(old ?? {}),
        [vehicleId]: [...(old?.[vehicleId] ?? []), moving],
      }));

      return { previousShipments, previousAssignments };
    },

    onError: (_err, _vars, context) => {
      // Roll back both cache entries on failure.
      if (context?.previousShipments !== undefined) {
        qc.setQueryData(['shipments'], context.previousShipments);
      }
      if (context?.previousAssignments !== undefined) {
        qc.setQueryData(['assignments'], context.previousAssignments);
      }
    },

    onSettled: () => {
      // Reconcile with the server once the mutation resolves (success or error).
      qc.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  // ── DnD sensor — require 8px movement before drag starts (avoids mis-fires) ─

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const dragged = event.active.data.current?.shipment as Shipment | undefined;
    setActiveShipment(dragged ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveShipment(null);

    const { active, over } = event;
    if (!over) return;

    const parsed = parseDropId(String(over.id));
    if (!parsed) return;

    const shipmentId = String(active.id);
    const { vehicleId } = parsed;

    assignMutation.mutate({ shipmentId, vehicleId });

    // If dropped directly onto the visualizer drop zone and the drawer isn't
    // already open for this vehicle, open it now.
    if (parsed.kind === 'visualizer' || !selectedVehicle) {
      const target = vehicles?.find(v => v.id === vehicleId) ?? null;
      if (target) setSelectedVehicle(target);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const assignments = qc.getQueryData<AssignmentMap>(['assignments']) ?? {};

  const assignedShipmentsForVehicle = (vehicleId: string): Shipment[] =>
    assignments[vehicleId] ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-[#05080f] text-slate-200 p-8 flex flex-col font-sans selection:bg-indigo-500/30">

        {/* Header */}
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                Smart Dispatch
              </span>{' '}
              Board
            </h1>
            <p className="text-slate-400 font-medium">
              Drag and drop shipments onto available vehicles. Click a vehicle for 3D load planning.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700">
              Settings
            </button>
            <button className="bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] px-4 py-2 rounded-lg font-medium text-white transition-all">
              Auto-Assign AI
            </button>
          </div>
        </header>

        {/* Main Board */}
        <div className="flex-1 flex gap-8 h-full">

          {/* Left Column: Pending Shipments */}
          <div className="w-1/3 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white tracking-wide uppercase">
                Pending Shipments
              </h2>
              <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full font-bold">
                {shipmentsLoading ? '…' : (shipments?.length ?? 0)} total
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {shipmentsLoading && (
                <>
                  <ShipmentSkeleton />
                  <ShipmentSkeleton />
                  <ShipmentSkeleton />
                </>
              )}
              {shipmentsError && (
                <ErrorBlock message="Failed to load shipments. Check your connection or try refreshing." />
              )}
              {!shipmentsLoading && !shipmentsError && shipments?.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">No pending shipments.</p>
              )}
              {shipments?.map(shipment => (
                <DraggableShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          </div>

          {/* Right Column: Available Fleet */}
          <div className="w-2/3 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white tracking-wide uppercase">
                Available Fleet
              </h2>
              <div className="flex gap-2">
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-bold">
                  {vehiclesLoading ? '…' : (vehicles?.length ?? 0)} Online
                </span>
                <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-bold cursor-pointer hover:bg-slate-700 transition-colors">
                  Filters ▾
                </span>
              </div>
            </div>

            {vehiclesError && (
              <ErrorBlock message="Failed to load fleet. Check your connection or try refreshing." />
            )}

            <div className="grid grid-cols-2 gap-4">
              {vehiclesLoading && (
                <>
                  <VehicleSkeleton />
                  <VehicleSkeleton />
                  <VehicleSkeleton />
                  <VehicleSkeleton />
                </>
              )}
              {!vehiclesLoading &&
                !vehiclesError &&
                vehicles?.map(vehicle => (
                  <DroppableVehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    assignedCount={assignedShipmentsForVehicle(vehicle.id).length}
                    onOpenVisualizer={() => setSelectedVehicle(vehicle)}
                  />
                ))}
            </div>

            <div className="mt-4 flex-1 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500 bg-slate-900/20 hover:bg-slate-900/40 transition-colors cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">Add External Carrier</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trailer Visualizer drawer */}
        {selectedVehicle && (
          <TrailerVisualizer
            vehicle={selectedVehicle}
            assignedShipments={assignedShipmentsForVehicle(selectedVehicle.id)}
            onClose={() => setSelectedVehicle(null)}
          />
        )}

        {/* DragOverlay: renders the "lifted" card following the cursor */}
        <DragOverlay modifiers={[restrictToWindowEdges]} dropAnimation={null}>
          {activeShipment ? (
            <div className="w-[340px] rotate-1 pointer-events-none">
              <ShipmentCardContent shipment={activeShipment} isDragging />
            </div>
          ) : null}
        </DragOverlay>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slide-in {
            0% { transform: translateX(100%); }
            100% { transform: translateX(0); }
          }
          .animate-slide-in {
            animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 10px; }
        `}} />
      </div>
    </DndContext>
  );
}
