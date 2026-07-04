// Deterministic validation layer: intercepts the LLM's JSON output and checks
// it against hard rules before a draft is trusted. This is the guardrail that
// keeps hallucinated or malformed extractions out of the confirmed pipeline —
// it never calls the model.
//
// Rules:
//   - origin/destination must resolve to a known location (by name or code)
//   - dates must be well-formed and logically ordered (pickup <= delivery)
//   - gross weight must be within a truck's physical limit
//   - missing key fields are warnings (reviewable), contradictions are errors

import { db } from '../../core/db';
import type { Extraction } from './inbox.parser';

const MAX_TRUCK_WEIGHT_KG = 25000; // gross payload ceiling for a 40 t artic

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Locations that resolved, for display (name + code + kind). */
  resolved: { field: 'origin' | 'destination'; name: string; code: string | null; kind: string }[];
}

interface LocationRow { name: string; code: string | null; kind: string }

async function resolveLocation(value: string): Promise<LocationRow | null> {
  const v = value.trim();
  const { rows } = await db.query<LocationRow>(
    `SELECT name, code, kind FROM locations
     WHERE lower(name) = lower($1) OR upper(code) = upper($1)
        OR lower(name) LIKE lower($1) || '%'
     ORDER BY (lower(name) = lower($1)) DESC, (upper(code) = upper($1)) DESC
     LIMIT 1`,
    [v],
  );
  return rows[0] ?? null;
}

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function validateExtraction(extraction: Extraction): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved: ValidationResult['resolved'] = [];

  // ── Locations ──
  for (const field of ['origin', 'destination'] as const) {
    const value = extraction[field];
    if (!value) {
      warnings.push(`Missing ${field}.`);
      continue;
    }
    const loc = await resolveLocation(value);
    if (!loc) errors.push(`Unknown ${field} "${value}" — not found in locations reference.`);
    else resolved.push({ field, name: loc.name, code: loc.code, kind: loc.kind });
  }

  // ── Dates ──
  const pickup = extraction.pickup_date ? parseDate(extraction.pickup_date) : null;
  const delivery = extraction.delivery_date ? parseDate(extraction.delivery_date) : null;
  if (extraction.pickup_date && !pickup) errors.push(`Pickup date "${extraction.pickup_date}" is not a valid date.`);
  if (extraction.delivery_date && !delivery) errors.push(`Delivery date "${extraction.delivery_date}" is not a valid date.`);
  if (!extraction.pickup_date) warnings.push('Missing pickup date.');
  if (!extraction.delivery_date) warnings.push('Missing delivery date.');
  if (pickup && delivery && pickup.getTime() > delivery.getTime()) {
    errors.push('Pickup date is after the delivery date.');
  }
  if (pickup) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (pickup.getTime() < today.getTime()) warnings.push('Pickup date is in the past.');
  }

  // ── Weight ──
  if (extraction.weight_kg == null) {
    warnings.push('Missing cargo weight.');
  } else if (extraction.weight_kg <= 0) {
    errors.push('Cargo weight must be greater than zero.');
  } else if (extraction.weight_kg > MAX_TRUCK_WEIGHT_KG) {
    errors.push(`Cargo weight ${extraction.weight_kg} kg exceeds the ${MAX_TRUCK_WEIGHT_KG} kg road limit.`);
  }

  return { ok: errors.length === 0, errors, warnings, resolved };
}
