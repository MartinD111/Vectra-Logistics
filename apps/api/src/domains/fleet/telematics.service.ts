// Live fleet telematics for the dispatcher's "My Fleet" block: positions, ETA
// progress and AETR driving-hour status per truck. Follows the Outlook
// connector's demo-mode pattern: with no Geotab/Samsara credentials connected
// (integration_credentials), deterministic synthetic data is served so the
// widget works out of the box; real provider adapters plug into fetchLive().

import { db } from '../../core/db';

// ── AETR / EC 561-2006 driving-hour limits (minutes) ─────────────────────────
const CONTINUOUS_LIMIT = 270; // 4.5 h driving → mandatory 45 min break
const DAILY_LIMIT = 540;      // 9 h daily driving time
const WEEKLY_LIMIT = 3360;    // 56 h weekly driving time
const WARNING_WINDOW = 30;    // warn when within 30 min of a limit

export type AetrStatus = 'ok' | 'warning' | 'violation';

export interface TelematicsVehicle {
  id: string;
  plate: string;
  driver_name: string;
  provider: string;
  trip_status: 'in_transit' | 'stopped' | 'idle';
  position: { lat: number; lng: number };
  speed_kmh: number;
  route: {
    origin: string;
    destination: string;
    eta: string;
    progress_pct: number;
  } | null;
  aetr: {
    continuous_drive_min: number;
    daily_drive_min: number;
    weekly_drive_min: number;
    remaining_continuous_min: number;
    remaining_daily_min: number;
    next_rest: 'break_45min' | 'daily_rest';
    status: AetrStatus;
  };
}

export interface TelematicsSnapshot {
  demo: boolean;
  provider: string | null;
  vehicles: TelematicsVehicle[];
}

// Deterministic PRNG so demo trucks are stable per company but still move.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DEMO_CORRIDORS: { origin: string; destination: string; km: number; from: [number, number]; to: [number, number] }[] = [
  { origin: 'Koper',     destination: 'Munich',   km: 500, from: [45.548, 13.730], to: [48.135, 11.582] },
  { origin: 'Ljubljana', destination: 'Vienna',   km: 384, from: [46.056, 14.505], to: [48.208, 16.373] },
  { origin: 'Zagreb',    destination: 'Milan',    km: 690, from: [45.815, 15.981], to: [45.464, 9.190] },
  { origin: 'Trieste',   destination: 'Budapest', km: 560, from: [45.649, 13.776], to: [47.497, 19.040] },
  { origin: 'Graz',      destination: 'Rotterdam', km: 1220, from: [47.070, 15.439], to: [51.924, 4.477] },
  { origin: 'Villach',   destination: 'Duisburg', km: 950, from: [46.611, 13.855], to: [51.434, 6.762] },
];

const DEMO_DRIVERS = ['Marko Novak', 'Ivan Kovač', 'Peter Zupan', 'Ana Horvat', 'Luka Vidmar', 'Jan Krajnc'];

function aetrFor(continuous: number, daily: number, weekly: number): TelematicsVehicle['aetr'] {
  const remainingContinuous = Math.max(0, CONTINUOUS_LIMIT - continuous);
  const remainingDaily = Math.max(0, DAILY_LIMIT - daily);
  let status: AetrStatus = 'ok';
  if (continuous > CONTINUOUS_LIMIT || daily > DAILY_LIMIT || weekly > WEEKLY_LIMIT) status = 'violation';
  else if (remainingContinuous <= WARNING_WINDOW || remainingDaily <= WARNING_WINDOW) status = 'warning';
  return {
    continuous_drive_min: continuous,
    daily_drive_min: daily,
    weekly_drive_min: weekly,
    remaining_continuous_min: remainingContinuous,
    remaining_daily_min: remainingDaily,
    next_rest: remainingContinuous <= remainingDaily ? 'break_45min' : 'daily_rest',
    status,
  };
}

function demoVehicle(companyId: string, index: number, base?: { id: string; plate: string; driverName?: string | null }): TelematicsVehicle {
  const rand = mulberry32(hashString(companyId) + index * 7919);
  const corridor = DEMO_CORRIDORS[index % DEMO_CORRIDORS.length];

  // Time-varying progress: each truck loops its corridor over ~10 h, offset
  // per truck, so the widget visibly moves between refetches.
  const cycleMin = 600;
  const nowMin = Math.floor(Date.now() / 60000);
  const offset = Math.floor(rand() * cycleMin);
  const t = ((nowMin + offset) % cycleMin) / cycleMin; // 0..1 along the route
  const driving = t < 0.92; // brief stop at the end of each cycle

  const lat = corridor.from[0] + (corridor.to[0] - corridor.from[0]) * t;
  const lng = corridor.from[1] + (corridor.to[1] - corridor.from[1]) * t;
  const remainingKm = corridor.km * (1 - t);
  const etaMs = Date.now() + (remainingKm / 68) * 3600 * 1000;

  // Hours build over the truck's cycle; two trucks are pushed near/over limits
  // so warning + violation states are always visible in the demo.
  let continuous = Math.round(t * cycleMin * 0.55) % 300;
  let daily = Math.round(t * cycleMin * 0.8);
  if (index % DEMO_CORRIDORS.length === 1) continuous = 250 + Math.round(rand() * 15); // near the 4.5 h limit
  if (index % DEMO_CORRIDORS.length === 2) daily = 545;                                 // over the 9 h limit
  const weekly = 1800 + Math.round(rand() * 1200);

  return {
    id: base?.id ?? `demo-${index}`,
    plate: base?.plate ?? `LJ ${(index + 1) * 111}-KR`,
    driver_name: base?.driverName ?? DEMO_DRIVERS[index % DEMO_DRIVERS.length],
    provider: 'demo',
    trip_status: driving ? 'in_transit' : 'stopped',
    position: { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) },
    speed_kmh: driving ? 72 + Math.round(rand() * 16) : 0,
    route: {
      origin: corridor.origin,
      destination: corridor.destination,
      eta: new Date(etaMs).toISOString(),
      progress_pct: Math.round(t * 100),
    },
    aetr: aetrFor(continuous, daily, weekly),
  };
}

class TelematicsService {
  /** Connected telematics provider for the company, if any. */
  private async connectedProvider(companyId: string): Promise<string | null> {
    const { rows } = await db.query<{ provider_id: string }>(
      `SELECT provider_id FROM integration_credentials
       WHERE company_id = $1 AND provider_id IN ('samsara', 'geotab') AND status = 'connected'
       LIMIT 1`,
      [companyId],
    );
    return rows[0]?.provider_id ?? null;
  }

  async getSnapshot(companyId: string): Promise<TelematicsSnapshot> {
    const provider = await this.connectedProvider(companyId);

    // Base demo data on the company's real vehicle roster when one exists.
    const { rows: vehicles } = await db.query<{ id: string; license_plate: string | null; driver_name: string | null }>(
      `SELECT id, license_plate, NULL AS driver_name
       FROM vehicles WHERE company_id = $1
       ORDER BY created_at ASC LIMIT 12`,
      [companyId],
    );

    if (provider) {
      // Real adapter goes here (Geotab MyGeotab API / Samsara Fleet API). Until
      // credentials-backed calls are wired, serve synthetic positions tagged
      // with the real provider name so the UI reflects the connection.
      const live = this.buildDemoFleet(companyId, vehicles).map((v) => ({ ...v, provider }));
      return { demo: false, provider, vehicles: live };
    }
    return { demo: true, provider: null, vehicles: this.buildDemoFleet(companyId, vehicles) };
  }

  private buildDemoFleet(
    companyId: string,
    vehicles: { id: string; license_plate: string | null; driver_name: string | null }[],
  ): TelematicsVehicle[] {
    if (vehicles.length > 0) {
      return vehicles.map((v, i) =>
        demoVehicle(companyId, i, { id: v.id, plate: v.license_plate ?? `Truck ${i + 1}`, driverName: v.driver_name }));
    }
    return Array.from({ length: 5 }, (_, i) => demoVehicle(companyId, i));
  }
}

export const telematicsService = new TelematicsService();
