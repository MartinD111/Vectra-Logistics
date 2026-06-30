import axios, { AxiosError } from 'axios';
import { Worker, Job } from 'bullmq';
import { db } from '../core/db';
import { queueConnection } from '../core/queue';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TelematicsSyncPayload {
  // Empty — this is a system-triggered sweep job, no input needed.
}

interface ActiveIntegration {
  company_id: string;
  provider: 'samsara' | 'geotab';
  credentials_json: string; // AES-256-GCM encrypted envelope JSON
}

interface CompanyVehicle {
  id: string;
  license_plate: string;
  external_vehicle_id: string | null;
}

interface LocationFix {
  vehicle_id: string;      // our internal UUID
  lat: number;
  lng: number;
}

// ── Encrypted envelope (mirrors integrations.types.ts) ────────────────────────

interface EncryptedEnvelope {
  iv: string;
  tag: string;
  ciphertext: string;
}

// ── Crypto helper — mirrors integrations.service.ts decrypt() ─────────────────

import crypto from 'crypto';

function decryptApiKey(envelopeJson: string): string {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('[Telematics] ENCRYPTION_KEY env var is missing or invalid');
  }
  const key = Buffer.from(keyHex, 'hex');
  const { iv, tag, ciphertext } = JSON.parse(envelopeJson) as EncryptedEnvelope;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const plain = decipher.update(Buffer.from(ciphertext, 'hex')) + decipher.final('utf8');
  return (JSON.parse(plain) as { key: string }).key;
}

// ── Provider adapters ─────────────────────────────────────────────────────────
//
// Each adapter accepts the decrypted API key and the internal vehicle ID /
// external telematics ID, and resolves to a lat/lng pair.
//
// TODO (Samsara): GET https://api.samsara.com/fleet/vehicles/stats
//   Headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
//   Body filter: types=gps  →  data[].gps.{latitude,longitude}
//
// TODO (Geotab): POST https://my.geotab.com/apiv1
//   Body: { method: 'Get', params: { typeName: 'DeviceStatusInfo',
//           credentials: { userName, password, database } } }
//   →  result[].currentStatuses[].latitude / longitude

async function fetchSamsaraPositions(
  apiKey: string,
  vehicles: CompanyVehicle[],
): Promise<LocationFix[]> {
  // Real call would be:
  // const res = await axios.get('https://api.samsara.com/fleet/vehicles/stats', {
  //   params: { types: 'gps' },
  //   headers: { Authorization: `Bearer ${apiKey}` },
  //   timeout: 10_000,
  // });
  // return res.data.data.map(v => ({ vehicle_id: ..., lat: v.gps.latitude, lng: v.gps.longitude }));

  void apiKey; // suppress unused-param lint until real integration is wired

  return vehicles.map((v) => ({
    vehicle_id: v.id,
    // Mock: scatter vehicles around Ljubljana, Slovenia
    lat: 46.0569 + (Math.random() - 0.5) * 0.5,
    lng: 14.5058 + (Math.random() - 0.5) * 0.8,
  }));
}

async function fetchGeotabPositions(
  apiKey: string,
  vehicles: CompanyVehicle[],
): Promise<LocationFix[]> {
  // Real call:
  // const [user, pass, db] = apiKey.split(':');
  // const res = await axios.post('https://my.geotab.com/apiv1', {
  //   method: 'Get',
  //   params: {
  //     typeName: 'DeviceStatusInfo',
  //     credentials: { userName: user, password: pass, database: db },
  //   },
  // }, { timeout: 10_000 });
  // return res.data.result.map(d => ({ vehicle_id: ..., lat: d.currentStatuses[0].latitude, lng: d.currentStatuses[0].longitude }));

  void apiKey;

  return vehicles.map((v) => ({
    vehicle_id: v.id,
    lat: 46.0569 + (Math.random() - 0.5) * 0.5,
    lng: 14.5058 + (Math.random() - 0.5) * 0.8,
  }));
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchActiveIntegrations(): Promise<ActiveIntegration[]> {
  const { rows } = await db.query<ActiveIntegration>(
    `SELECT company_id, provider, credentials_json
     FROM api_credentials
     WHERE provider IN ('samsara', 'geotab')
       AND status = 'active'`,
  );
  return rows;
}

async function fetchCompanyVehicles(companyId: string): Promise<CompanyVehicle[]> {
  // external_vehicle_id is a nullable column that links our Vehicle row to the
  // telematics provider's own device identifier.  We include all vehicles even
  // when external_vehicle_id is NULL so the mock adapter can still update them.
  const { rows } = await db.query<CompanyVehicle>(
    `SELECT id, license_plate,
            COALESCE(external_vehicle_id, id::text) AS external_vehicle_id
     FROM vehicles
     WHERE company_id = $1`,
    [companyId],
  );
  return rows;
}

async function persistLocations(fixes: LocationFix[]): Promise<void> {
  if (fixes.length === 0) return;

  // Build a single multi-row VALUES clause for efficiency.
  const values: unknown[] = [];
  const placeholders = fixes.map((fix, i) => {
    const base = i * 3;
    values.push(fix.vehicle_id, fix.lat, fix.lng);
    return `($${base + 1}, $${base + 2}, $${base + 3}, NOW())`;
  });

  await db.query(
    `INSERT INTO vehicle_locations (vehicle_id, lat, lng, recorded_at)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (vehicle_id) DO UPDATE
       SET lat         = EXCLUDED.lat,
           lng         = EXCLUDED.lng,
           recorded_at = EXCLUDED.recorded_at`,
    values,
  );

  // Also stamp last_sync_at on the vehicles row itself so the Fleet UI can
  // show a "Live" badge without joining vehicle_locations.
  await Promise.all(
    fixes.map((fix) =>
      db.query(
        `UPDATE vehicles SET last_sync_at = NOW() WHERE id = $1`,
        [fix.vehicle_id],
      ),
    ),
  );
}

// ── Rate-limit-aware company sweep ────────────────────────────────────────────
//
// We stagger provider calls 500 ms apart to avoid hitting rate limits when
// many companies share the same provider.  A real implementation should track
// per-company quota windows in Redis.

const STAGGER_MS = 500;

async function sweepCompany(
  integration: ActiveIntegration,
  index: number,
): Promise<void> {
  // Stagger: company N starts index * 500 ms after the first one.
  if (index > 0) {
    await new Promise<void>((r) => setTimeout(r, index * STAGGER_MS));
  }

  const vehicles = await fetchCompanyVehicles(integration.company_id);
  if (vehicles.length === 0) return;

  let apiKey: string;
  try {
    apiKey = decryptApiKey(integration.credentials_json);
  } catch (err) {
    console.warn(
      `[Telematics] Failed to decrypt key for company ${integration.company_id}:`,
      (err as Error).message,
    );
    return;
  }

  let fixes: LocationFix[];
  try {
    if (integration.provider === 'samsara') {
      fixes = await fetchSamsaraPositions(apiKey, vehicles);
    } else {
      fixes = await fetchGeotabPositions(apiKey, vehicles);
    }
  } catch (err) {
    const msg =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status ?? 'timeout'}: ${err.message}`
        : String(err);
    console.error(
      `[Telematics] Provider ${integration.provider} call failed for company ${integration.company_id}: ${msg}`,
    );
    return;
  }

  await persistLocations(fixes);

  console.log(
    `[Telematics] Synced ${fixes.length} vehicle(s) for company ${integration.company_id} via ${integration.provider}`,
  );
}

// ── Worker ────────────────────────────────────────────────────────────────────

export const startTelematicsWorker = (): Worker => {
  const worker = new Worker<TelematicsSyncPayload>(
    'telematics',
    async (_job: Job<TelematicsSyncPayload>) => {
      console.log('[Telematics] Starting location sweep…');

      const integrations = await fetchActiveIntegrations();

      if (integrations.length === 0) {
        console.log('[Telematics] No active telematics integrations — skipping sweep');
        return;
      }

      // Process all companies concurrently but with internal staggering per company.
      await Promise.allSettled(
        integrations.map((integration, idx) => sweepCompany(integration, idx)),
      );

      console.log(`[Telematics] Sweep complete — processed ${integrations.length} integration(s)`);
    },
    {
      connection: queueConnection,
      concurrency: 1, // only one sweep at a time to avoid thundering-herd on DB
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Telematics] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Telematics] Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Telematics] Worker-level error:', err.message);
  });

  console.log('[Telematics] Worker started — listening on queue "telematics"');
  return worker;
};

// ── Repeatable job scheduler ──────────────────────────────────────────────────
//
// Call this once at application startup (e.g., in src/index.ts) AFTER the
// worker is started.  BullMQ deduplicates repeatable jobs by jobId so it is
// safe to call on every restart.
//
//   import { scheduleTelematicsSync } from './workers/telematics.worker';
//   scheduleTelematicsSync();

export async function scheduleTelematicsSync(): Promise<void> {
  const { getQueue } = await import('../core/queue');
  const queue = getQueue('telematics');

  await queue.add(
    'sync',
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
      jobId:  'telematics-sync-repeatable',
      removeOnComplete: { count: 10 },
      removeOnFail:     { count: 5 },
    },
  );

  console.log('[Telematics] Repeatable sync job scheduled (every 5 min)');
}
