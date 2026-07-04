// Spot quote calculator: origin + destination + equipment → absolute minimum
// break-even rate and a suggested rate with margin. Deterministic cost model
// (no external routing API yet): road distance ≈ great-circle × corridor
// factor, per-country toll and diesel price tables, per-equipment consumption,
// driver day cost. Every figure is returned in the breakdown so dispatchers
// can sanity-check the estimate.

import { z } from 'zod';
import { AppError } from '../../core/errors/AppError';

export const SpotQuoteSchema = z.object({
  origin: z.string().min(2).max(80),
  destination: z.string().min(2).max(80),
  equipment: z.enum(['tautliner', 'mega', 'reefer', 'container']).default('tautliner'),
  margin_pct: z.number().min(0).max(50).optional(),
});

interface City { name: string; country: string; lat: number; lng: number }

// Common European road-freight cities. Extend freely — the calculator matches
// case-insensitively on name.
const CITIES: City[] = [
  { name: 'Ljubljana', country: 'SI', lat: 46.056, lng: 14.505 },
  { name: 'Koper', country: 'SI', lat: 45.548, lng: 13.730 },
  { name: 'Maribor', country: 'SI', lat: 46.554, lng: 15.646 },
  { name: 'Zagreb', country: 'HR', lat: 45.815, lng: 15.981 },
  { name: 'Rijeka', country: 'HR', lat: 45.327, lng: 14.442 },
  { name: 'Split', country: 'HR', lat: 43.508, lng: 16.440 },
  { name: 'Belgrade', country: 'RS', lat: 44.786, lng: 20.448 },
  { name: 'Vienna', country: 'AT', lat: 48.208, lng: 16.373 },
  { name: 'Graz', country: 'AT', lat: 47.070, lng: 15.439 },
  { name: 'Linz', country: 'AT', lat: 48.306, lng: 14.285 },
  { name: 'Salzburg', country: 'AT', lat: 47.809, lng: 13.055 },
  { name: 'Munich', country: 'DE', lat: 48.135, lng: 11.582 },
  { name: 'Stuttgart', country: 'DE', lat: 48.775, lng: 9.182 },
  { name: 'Frankfurt', country: 'DE', lat: 50.110, lng: 8.682 },
  { name: 'Cologne', country: 'DE', lat: 50.937, lng: 6.960 },
  { name: 'Duisburg', country: 'DE', lat: 51.434, lng: 6.762 },
  { name: 'Hamburg', country: 'DE', lat: 53.551, lng: 9.993 },
  { name: 'Berlin', country: 'DE', lat: 52.520, lng: 13.405 },
  { name: 'Leipzig', country: 'DE', lat: 51.339, lng: 12.371 },
  { name: 'Milan', country: 'IT', lat: 45.464, lng: 9.190 },
  { name: 'Turin', country: 'IT', lat: 45.070, lng: 7.686 },
  { name: 'Verona', country: 'IT', lat: 45.438, lng: 10.992 },
  { name: 'Bologna', country: 'IT', lat: 44.494, lng: 11.342 },
  { name: 'Trieste', country: 'IT', lat: 45.649, lng: 13.776 },
  { name: 'Rome', country: 'IT', lat: 41.902, lng: 12.496 },
  { name: 'Naples', country: 'IT', lat: 40.851, lng: 14.268 },
  { name: 'Budapest', country: 'HU', lat: 47.497, lng: 19.040 },
  { name: 'Bratislava', country: 'SK', lat: 48.148, lng: 17.107 },
  { name: 'Prague', country: 'CZ', lat: 50.075, lng: 14.437 },
  { name: 'Brno', country: 'CZ', lat: 49.195, lng: 16.606 },
  { name: 'Warsaw', country: 'PL', lat: 52.229, lng: 21.012 },
  { name: 'Krakow', country: 'PL', lat: 50.064, lng: 19.944 },
  { name: 'Wroclaw', country: 'PL', lat: 51.107, lng: 17.038 },
  { name: 'Gdansk', country: 'PL', lat: 54.352, lng: 18.646 },
  { name: 'Zurich', country: 'CH', lat: 47.376, lng: 8.541 },
  { name: 'Basel', country: 'CH', lat: 47.559, lng: 7.588 },
  { name: 'Paris', country: 'FR', lat: 48.856, lng: 2.352 },
  { name: 'Lyon', country: 'FR', lat: 45.764, lng: 4.835 },
  { name: 'Marseille', country: 'FR', lat: 43.296, lng: 5.369 },
  { name: 'Lille', country: 'FR', lat: 50.629, lng: 3.057 },
  { name: 'Rotterdam', country: 'NL', lat: 51.924, lng: 4.477 },
  { name: 'Amsterdam', country: 'NL', lat: 52.367, lng: 4.904 },
  { name: 'Antwerp', country: 'BE', lat: 51.219, lng: 4.402 },
  { name: 'Brussels', country: 'BE', lat: 50.846, lng: 4.351 },
  { name: 'Barcelona', country: 'ES', lat: 41.385, lng: 2.173 },
  { name: 'Madrid', country: 'ES', lat: 40.416, lng: -3.703 },
  { name: 'Bucharest', country: 'RO', lat: 44.426, lng: 26.102 },
  { name: 'Sofia', country: 'BG', lat: 42.697, lng: 23.321 },
  { name: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978 },
  { name: 'Thessaloniki', country: 'GR', lat: 40.640, lng: 22.944 },
];

/** Motorway toll €/km for a 40 t 5-axle truck (approximate 2026 rates). */
const TOLL_EUR_PER_KM: Record<string, number> = {
  SI: 0.55, HR: 0.35, RS: 0.18, AT: 0.48, DE: 0.34, IT: 0.30, HU: 0.42, SK: 0.28,
  CZ: 0.30, PL: 0.16, CH: 0.60, FR: 0.28, NL: 0.15, BE: 0.17, ES: 0.20, RO: 0.11,
  BG: 0.10, TR: 0.12, GR: 0.15,
};

/** Diesel €/L incl. VAT-recoverable pricing (approximate regional averages). */
const FUEL_EUR_PER_L: Record<string, number> = {
  SI: 1.52, HR: 1.48, RS: 1.60, AT: 1.55, DE: 1.68, IT: 1.75, HU: 1.50, SK: 1.53,
  CZ: 1.49, PL: 1.42, CH: 1.90, FR: 1.72, NL: 1.80, BE: 1.70, ES: 1.50, RO: 1.45,
  BG: 1.38, TR: 1.25, GR: 1.65,
};

/** Consumption L/100 km per equipment (reefer includes fridge-unit diesel). */
const CONSUMPTION_L_PER_100KM: Record<string, number> = {
  tautliner: 27, mega: 28, reefer: 33, container: 30,
};

const ROAD_FACTOR = 1.27;        // great-circle → road distance
const AVG_SPEED_KMH = 68;
const MAX_DRIVE_H_PER_DAY = 9;   // AETR daily driving limit
const DRIVER_COST_PER_DAY = 250; // wage + per-diem
const OVERHEAD_EUR_PER_KM = 0.11; // maintenance, tyres, insurance, depreciation
const DEFAULT_MARGIN_PCT = 12;

function haversineKm(a: City, b: City): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function findCity(name: string): City | null {
  const q = name.trim().toLowerCase();
  return CITIES.find((c) => c.name.toLowerCase() === q)
    ?? CITIES.find((c) => c.name.toLowerCase().startsWith(q))
    ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SpotQuote {
  origin: string;
  destination: string;
  equipment: string;
  distance_km: number;
  drive_time_h: number;
  days: number;
  breakdown: {
    fuel_eur: number;
    tolls_eur: number;
    driver_eur: number;
    overhead_eur: number;
    fuel_price_eur_l: number;
    consumption_l_100km: number;
    toll_rate_eur_km: number;
  };
  break_even_eur: number;
  break_even_eur_per_km: number;
  margin_pct: number;
  suggested_rate_eur: number;
  note: string;
}

class SpotQuoteService {
  listCities(): { name: string; country: string }[] {
    return CITIES.map(({ name, country }) => ({ name, country }));
  }

  calculate(body: unknown): SpotQuote {
    const parsed = SpotQuoteSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const { origin, destination, equipment } = parsed.data;
    const marginPct = parsed.data.margin_pct ?? DEFAULT_MARGIN_PCT;

    const from = findCity(origin);
    const to = findCity(destination);
    if (!from) throw new AppError(400, `Unknown origin "${origin}". Try one of the supported cities (GET /fleet/spot-quote/cities).`);
    if (!to) throw new AppError(400, `Unknown destination "${destination}". Try one of the supported cities (GET /fleet/spot-quote/cities).`);
    if (from.name === to.name) throw new AppError(400, 'Origin and destination must differ.');

    const km = haversineKm(from, to) * ROAD_FACTOR;
    const driveH = km / AVG_SPEED_KMH;
    const days = Math.max(1, Math.ceil(driveH / MAX_DRIVE_H_PER_DAY));

    const fuelPrice = (FUEL_EUR_PER_L[from.country] + FUEL_EUR_PER_L[to.country]) / 2;
    const tollRate = (TOLL_EUR_PER_KM[from.country] + TOLL_EUR_PER_KM[to.country]) / 2;
    const consumption = CONSUMPTION_L_PER_100KM[equipment];

    const fuel = (km / 100) * consumption * fuelPrice;
    const tolls = km * tollRate;
    const driver = days * DRIVER_COST_PER_DAY;
    const overhead = km * OVERHEAD_EUR_PER_KM;
    const breakEven = fuel + tolls + driver + overhead;

    return {
      origin: from.name,
      destination: to.name,
      equipment,
      distance_km: Math.round(km),
      drive_time_h: round2(driveH),
      days,
      breakdown: {
        fuel_eur: round2(fuel),
        tolls_eur: round2(tolls),
        driver_eur: round2(driver),
        overhead_eur: round2(overhead),
        fuel_price_eur_l: round2(fuelPrice),
        consumption_l_100km: consumption,
        toll_rate_eur_km: round2(tollRate),
      },
      break_even_eur: round2(breakEven),
      break_even_eur_per_km: round2(breakEven / km),
      margin_pct: marginPct,
      suggested_rate_eur: round2(breakEven * (1 + marginPct / 100)),
      note: 'Estimate: road distance from great-circle × 1.27, average toll/fuel rates of the origin and destination countries. Not a routing-engine quote.',
    };
  }
}

export const spotQuoteService = new SpotQuoteService();
