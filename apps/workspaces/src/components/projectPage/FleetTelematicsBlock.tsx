'use client';

// "My fleet" telematics block: live trucks with ETA progress bars and a
// tachograph ring per driver visualising AETR hours (continuous driving vs the
// 4.5 h limit, with remaining daily time and violation warnings). Data comes
// from GET /fleet/telematics — demo positions until Geotab/Samsara connect.

import { Loader2, Truck, AlertTriangle } from 'lucide-react';
import type { FleetTelematicsBlock as FleetTelematicsBlockType } from '@/lib/projectPage/blocks';
import { useTelematics } from '@/lib/hooks/useFleet';
import type { TelematicsVehicle, AetrStatus } from '@/lib/api/fleet.api';

const RING_COLOR: Record<AetrStatus, string> = {
  ok: '#10b981',        // emerald-500
  warning: '#f59e0b',   // amber-500
  violation: '#ef4444', // red-500
};

const CONTINUOUS_LIMIT = 270;

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function fmtEta(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return today ? time : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

/**
 * Tachograph ring: the arc is continuous driving time against the 4.5 h AETR
 * limit; the number is the remaining time until the mandatory 45 min break.
 */
export function TachographRing({ vehicle }: { vehicle: TelematicsVehicle }) {
  const { aetr } = vehicle;
  const frac = Math.min(1, aetr.continuous_drive_min / CONTINUOUS_LIMIT);
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const color = RING_COLOR[aetr.status];

  return (
    <div className="relative h-14 w-14 flex-shrink-0" title={
      `Continuous driving ${fmtMin(aetr.continuous_drive_min)} / 4h 30m · daily ${fmtMin(aetr.daily_drive_min)} / 9h · next rest: ${aetr.next_rest === 'break_45min' ? '45 min break' : 'daily rest'}`
    }>
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-gray-200 dark:stroke-slate-700" />
        <circle
          cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - frac)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[11px] font-black text-gray-900 dark:text-white">
          {aetr.status === 'violation' ? '!' : fmtMin(aetr.remaining_continuous_min).replace(' ', '')}
        </span>
        <span className="text-[7px] uppercase tracking-wide text-gray-400">
          {aetr.status === 'violation' ? 'over' : 'to break'}
        </span>
      </div>
    </div>
  );
}

function VehicleRow({ vehicle }: { vehicle: TelematicsVehicle }) {
  const { aetr, route } = vehicle;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <TachographRing vehicle={vehicle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{vehicle.plate}</span>
          <span className="text-xs text-gray-400 truncate">{vehicle.driver_name}</span>
          {vehicle.trip_status === 'in_transit'
            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{vehicle.speed_kmh} km/h</span>
            : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">stopped</span>}
          {aetr.status !== 'ok' && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              aetr.status === 'violation'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
              <AlertTriangle className="w-3 h-3" />
              {aetr.status === 'violation' ? 'AETR violation' : `break in ${fmtMin(aetr.remaining_continuous_min)}`}
            </span>
          )}
        </div>
        {route && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span className="truncate">{route.origin} → {route.destination}</span>
              <span className="flex-shrink-0 ml-2">ETA {fmtEta(route.eta)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${route.progress_pct}%` }} />
            </div>
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-1">
          Daily {fmtMin(aetr.daily_drive_min)} / 9h · remaining {fmtMin(aetr.remaining_daily_min)}
        </p>
      </div>
    </div>
  );
}

export function FleetTelematicsView({ block }: { block: FleetTelematicsBlockType }) {
  const { data, isLoading } = useTelematics();
  const vehicles = (data?.vehicles ?? []).slice(0, block.maxVehicles > 0 ? block.maxVehicles : undefined);

  return (
    <div className="saas-card !p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-gray-400" /> {block.title || 'My fleet'}
        </h3>
        {data?.demo && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300"
            title="No Geotab/Samsara connection — showing demo telematics.">
            demo data
          </span>
        )}
        {data && !data.demo && data.provider && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {data.provider}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading fleet…</div>
      ) : vehicles.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">No vehicles yet.</p>
      ) : (
        <div>{vehicles.map((v) => <VehicleRow key={v.id} vehicle={v} />)}</div>
      )}
    </div>
  );
}
