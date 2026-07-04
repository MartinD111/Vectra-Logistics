// Silent LTL matching (Phase 7). Continuously (on demand / on a scan) cross-
// references the fleet's active FTL routes against unassigned partial loads,
// delegating the detour maths to the FastAPI engine (/ltl-match). Profitable
// insertions are persisted and pushed live to the dispatcher's dashboard as
// 'ltl:suggestion' — empty truck space that could be earning money.

import axios from 'axios';
import { z } from 'zod';
import { AppError } from '../../core/errors/AppError';
import { emitToRoom } from '../../core/realtime/bus';
import { recordEvent } from '../../core/events/activityLog';
import { ltlRepository, PartialLoad, LtlSuggestion } from './ltl.repository';

const ENGINE_URL = process.env.MATCHING_ENGINE_URL || 'http://matching-engine:8000';

// Active FTL routes with spare capacity. Mirrors the demo fleet corridors from
// telematics.service so the two features feel connected; in production these
// come from live telematics + assigned shipments.
const DEMO_ROUTES = [
  { id: 'r-koper-munich', label: 'Koper → Munich (LJ 111-KR)', origin: { lat: 45.548, lng: 13.730 }, destination: { lat: 48.135, lng: 11.582 }, spare_kg: 8000 },
  { id: 'r-ljubljana-vienna', label: 'Ljubljana → Vienna (LJ 222-KR)', origin: { lat: 46.056, lng: 14.505 }, destination: { lat: 48.208, lng: 16.373 }, spare_kg: 5000 },
  { id: 'r-zagreb-milan', label: 'Zagreb → Milan (LJ 333-KR)', origin: { lat: 45.815, lng: 15.981 }, destination: { lat: 45.464, lng: 9.190 }, spare_kg: 3000 },
  { id: 'r-graz-rotterdam', label: 'Graz → Rotterdam (LJ 555-KR)', origin: { lat: 47.070, lng: 15.439 }, destination: { lat: 51.924, lng: 4.477 }, spare_kg: 10000 },
];

// Demo partial loads. Two sit right on a corridor (small detour → profitable),
// one is a big detour, one is too heavy for its best corridor — so the engine's
// filtering is visible.
const DEMO_PARTIALS = [
  { label: 'Ljubljana → Salzburg pallets', origin: 'Ljubljana', destination: 'Salzburg', origin_lat: 46.056, origin_lng: 14.505, dest_lat: 47.809, dest_lng: 13.055, weight_kg: 3000, offered_rate_eur: 480 },
  { label: 'Celje → Graz machine parts', origin: 'Celje', destination: 'Graz', origin_lat: 46.231, origin_lng: 15.260, dest_lat: 47.070, dest_lng: 15.439, weight_kg: 2000, offered_rate_eur: 360 },
  { label: 'Verona → Innsbruck tiles', origin: 'Verona', destination: 'Innsbruck', origin_lat: 45.438, origin_lng: 10.992, dest_lat: 47.269, dest_lng: 11.404, weight_kg: 4000, offered_rate_eur: 520 },
  { label: 'Sofia → Athens textiles (far)', origin: 'Sofia', destination: 'Athens', origin_lat: 42.697, origin_lng: 23.321, dest_lat: 37.983, dest_lng: 23.727, weight_kg: 2500, offered_rate_eur: 300 },
];

export const CreatePartialSchema = z.object({
  label: z.string().min(1).max(120),
  origin: z.string().min(1).max(80),
  destination: z.string().min(1).max(80),
  origin_lat: z.number(), origin_lng: z.number(),
  dest_lat: z.number(), dest_lng: z.number(),
  weight_kg: z.number().int().min(1).max(24000),
  offered_rate_eur: z.number().min(0).max(100000),
});

interface EngineSuggestion {
  route_id: string; route_label: string;
  partial_id: string; partial_label: string;
  detour_km: number; detour_min: number;
  added_revenue_eur: number; margin_eur: number; score: number;
}

class LtlService {
  listSuggestions(companyId: string): Promise<LtlSuggestion[]> {
    return ltlRepository.listSuggestions(companyId);
  }
  listPartials(companyId: string): Promise<PartialLoad[]> {
    return ltlRepository.listPartials(companyId);
  }

  private async ensureDemoPartials(companyId: string): Promise<void> {
    if ((await ltlRepository.countPartials(companyId)) > 0) return;
    for (const d of DEMO_PARTIALS) await ltlRepository.createPartial(companyId, d);
  }

  async createPartial(companyId: string, body: unknown): Promise<PartialLoad> {
    const parsed = CreatePartialSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    return ltlRepository.createPartial(companyId, parsed.data);
  }

  /**
   * Run a scan: gather open partials + active routes, ask the FastAPI engine for
   * profitable insertions, persist the best per partial, and push each new one
   * live. Returns the fresh suggestion set.
   */
  async scan(companyId: string): Promise<LtlSuggestion[]> {
    await this.ensureDemoPartials(companyId);
    const partials = await ltlRepository.listOpenPartials(companyId);
    if (partials.length === 0) return [];

    const enginePartials = partials.map((p) => ({
      id: p.id, label: p.label, weight_kg: p.weight_kg, rate_eur: p.offered_rate_eur,
      pickup: { lat: p.origin_lat, lng: p.origin_lng }, dropoff: { lat: p.dest_lat, lng: p.dest_lng },
    }));

    let engineSuggestions: EngineSuggestion[] = [];
    try {
      const { data } = await axios.post(`${ENGINE_URL}/ltl-match`, {
        routes: DEMO_ROUTES, partials: enginePartials,
      }, { timeout: 15000 });
      engineSuggestions = data?.suggestions ?? [];
    } catch (err) {
      throw new AppError(502, `Matching engine unavailable: ${(err as Error).message}`);
    }

    const saved: LtlSuggestion[] = [];
    for (const s of engineSuggestions) {
      const suggestion = await ltlRepository.upsertSuggestion(companyId, {
        partial_load_id: s.partial_id, route_id: s.route_id, route_label: s.route_label,
        partial_label: s.partial_label, detour_km: s.detour_km, detour_min: s.detour_min,
        added_revenue_eur: s.added_revenue_eur, margin_eur: s.margin_eur, score: s.score,
      });
      emitToRoom(`company:${companyId}`, 'ltl:suggestion', suggestion);
      saved.push(suggestion);
    }
    if (saved.length > 0) {
      await recordEvent({
        tenantId: companyId, verb: 'ltl.scan.suggested', objectType: 'ltl_scan', objectId: null,
        payload: { count: saved.length, top_margin: saved[0]?.margin_eur ?? null },
      });
    }
    return this.listSuggestions(companyId);
  }

  async accept(id: string, companyId: string, userId: string | null): Promise<LtlSuggestion> {
    const s = await ltlRepository.findSuggestion(id, companyId);
    if (!s) throw new AppError(404, 'Suggestion not found');
    const updated = await ltlRepository.setSuggestionStatus(id, companyId, 'accepted');
    await ltlRepository.setPartialStatus(s.partial_load_id, companyId, 'matched');
    emitToRoom(`company:${companyId}`, 'ltl:updated', updated);
    await recordEvent({
      tenantId: companyId, actorId: userId, verb: 'ltl.accepted',
      objectType: 'ltl_suggestion', objectId: id,
      payload: { route: s.route_label, partial: s.partial_label, margin: s.margin_eur },
    });
    return updated!;
  }

  async dismiss(id: string, companyId: string): Promise<LtlSuggestion> {
    const s = await ltlRepository.findSuggestion(id, companyId);
    if (!s) throw new AppError(404, 'Suggestion not found');
    const updated = await ltlRepository.setSuggestionStatus(id, companyId, 'dismissed');
    emitToRoom(`company:${companyId}`, 'ltl:updated', updated);
    return updated!;
  }
}

export const ltlService = new LtlService();
