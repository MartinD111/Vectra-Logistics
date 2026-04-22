import { Worker, Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import { db } from '../core/db';
import { queueConnection } from '../core/queue';
import { Shipment } from '../domains/marketplace/marketplace.types';
import { Vehicle } from '../domains/fleet/fleet.types';

// ── Job payload shape ─────────────────────────────────────────────────────────

interface EvaluateAssignmentPayload {
  shipmentId: string;
  vehicleId: string;
}

// ── Python engine response shape ──────────────────────────────────────────────

interface PredictResponse {
  score: number;           // 0–100 match confidence
  detour_pct: number;      // estimated route detour percentage
  recommendation: string;  // 'approve' | 'review' | 'reject'
  notes?: string;
}

// ── Data fetchers (raw SQL keeps the worker decoupled from service layer) ─────

async function fetchShipment(id: string): Promise<Shipment> {
  const { rows } = await db.query<Shipment>(
    `SELECT * FROM shipments WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (rows.length === 0) {
    throw new Error(`[Worker] Shipment ${id} not found — job will be retried`);
  }
  return rows[0];
}

async function fetchVehicle(id: string): Promise<Vehicle> {
  const { rows } = await db.query<Vehicle>(
    `SELECT * FROM vehicles WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (rows.length === 0) {
    throw new Error(`[Worker] Vehicle ${id} not found — job will be retried`);
  }
  return rows[0];
}

// ── Python engine call ────────────────────────────────────────────────────────

async function callPredictEngine(
  shipment: Shipment,
  vehicle: Vehicle,
): Promise<PredictResponse> {
  const engineUrl = process.env.MATCHING_ENGINE_URL;
  if (!engineUrl) {
    throw new Error('[Worker] MATCHING_ENGINE_URL is not set');
  }

  const response = await axios.post<PredictResponse>(
    `${engineUrl}/api/predict`,
    {
      vehicle: {
        id: vehicle.id,
        type: vehicle.vehicle_type,
        max_weight_kg: vehicle.max_weight_kg,
        max_volume_m3: vehicle.max_volume_m3,
        max_pallets: vehicle.max_pallets,
      },
      assigned_shipment: {
        id: shipment.id,
        pickup_address: shipment.pickup_address,
        pickup_lat: shipment.pickup_lat,
        pickup_lng: shipment.pickup_lng,
        delivery_address: shipment.delivery_address,
        delivery_lat: shipment.delivery_lat,
        delivery_lng: shipment.delivery_lng,
        cargo_weight_kg: shipment.cargo_weight_kg,
        cargo_volume_m3: shipment.cargo_volume_m3,
        pallet_count: shipment.pallet_count,
        cargo_type: shipment.cargo_type,
        pickup_window_start: shipment.pickup_window_start,
        delivery_deadline: shipment.delivery_deadline,
      },
    },
    {
      timeout: 15_000, // 15 s — Python engine should respond well within this
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `[Worker] Python engine returned unexpected status ${response.status}`,
    );
  }

  return response.data;
}

// ── Result persistence ────────────────────────────────────────────────────────

async function persistResult(
  shipmentId: string,
  vehicleId: string,
  result: PredictResponse,
): Promise<void> {
  await db.query(
    `INSERT INTO assignment_scores
       (shipment_id, vehicle_id, score, detour_pct, recommendation, notes, evaluated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (shipment_id, vehicle_id) DO UPDATE
       SET score          = EXCLUDED.score,
           detour_pct     = EXCLUDED.detour_pct,
           recommendation = EXCLUDED.recommendation,
           notes          = EXCLUDED.notes,
           evaluated_at   = EXCLUDED.evaluated_at`,
    [
      shipmentId,
      vehicleId,
      result.score,
      result.detour_pct,
      result.recommendation,
      result.notes ?? null,
    ],
  );
}

// ── Worker initialisation ─────────────────────────────────────────────────────

export const startMatchingWorker = (): Worker => {
  const worker = new Worker<EvaluateAssignmentPayload>(
    'matching',
    async (job: Job<EvaluateAssignmentPayload>) => {
      const { shipmentId, vehicleId } = job.data;

      console.log(
        `[Worker] Processing job ${job.id} — shipment=${shipmentId} vehicle=${vehicleId}`,
      );

      // 1. Fetch both records in parallel — fail fast if either is missing.
      const [shipment, vehicle] = await Promise.all([
        fetchShipment(shipmentId),
        fetchVehicle(vehicleId),
      ]);

      // 2. Call the Predictive Empty Truck Engine.
      let result: PredictResponse;
      try {
        result = await callPredictEngine(shipment, vehicle);
      } catch (err) {
        const msg = err instanceof AxiosError
          ? `HTTP ${err.response?.status ?? 'timeout'}: ${err.message}`
          : String(err);
        throw new Error(`[Worker] Python engine call failed: ${msg}`);
      }

      console.log(
        `[Worker] Engine result for job ${job.id}: ` +
        `score=${result.score} detour=${result.detour_pct}% recommendation=${result.recommendation}`,
      );

      // 3. Persist the score so the dispatcher UI can surface it.
      await persistResult(shipmentId, vehicleId, result);
    },
    {
      connection: queueConnection,
      concurrency: 5, // process up to 5 assignments simultaneously
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          // Exponential backoff: 5 s, 25 s, 125 s — caps naturally at 3 attempts
          return Math.pow(5, attemptsMade) * 1_000;
        },
      },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[Worker] Job ${job?.id ?? 'unknown'} failed (attempt ${job?.attemptsMade ?? '?'}): ${err.message}`,
    );
  });

  worker.on('error', (err) => {
    // Emitted for connection-level errors (e.g. Redis dropped).
    // The worker reconnects automatically; we log and continue.
    console.error('[Worker] Worker-level error:', err.message);
  });

  console.log('[Worker] Matching worker started — listening on queue "matching"');

  return worker;
};
