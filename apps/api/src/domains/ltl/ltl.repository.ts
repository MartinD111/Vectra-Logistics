import { db } from '../../core/db';

export interface PartialLoad {
  id: string;
  company_id: string;
  label: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  weight_kg: number;
  offered_rate_eur: number;
  status: string; // open | matched | dismissed
  created_at: Date;
}

export interface LtlSuggestion {
  id: string;
  company_id: string;
  partial_load_id: string;
  route_id: string;
  route_label: string;
  partial_label: string;
  detour_km: number;
  detour_min: number;
  added_revenue_eur: number;
  margin_eur: number;
  score: number;
  status: string; // suggested | accepted | dismissed
  created_at: Date;
}

function numPartial(r: PartialLoad): PartialLoad {
  return {
    ...r,
    origin_lat: Number(r.origin_lat), origin_lng: Number(r.origin_lng),
    dest_lat: Number(r.dest_lat), dest_lng: Number(r.dest_lng),
    weight_kg: Number(r.weight_kg), offered_rate_eur: Number(r.offered_rate_eur),
  };
}
function numSuggestion(r: LtlSuggestion): LtlSuggestion {
  return {
    ...r,
    detour_km: Number(r.detour_km), detour_min: Number(r.detour_min),
    added_revenue_eur: Number(r.added_revenue_eur), margin_eur: Number(r.margin_eur), score: Number(r.score),
  };
}

class LtlRepository {
  // ── Partial loads ──
  async listOpenPartials(companyId: string): Promise<PartialLoad[]> {
    const { rows } = await db.query<PartialLoad>(
      `SELECT * FROM partial_loads WHERE company_id = $1 AND status = 'open' ORDER BY created_at ASC`, [companyId]);
    return rows.map(numPartial);
  }
  async listPartials(companyId: string): Promise<PartialLoad[]> {
    const { rows } = await db.query<PartialLoad>(
      `SELECT * FROM partial_loads WHERE company_id = $1 ORDER BY created_at DESC LIMIT 200`, [companyId]);
    return rows.map(numPartial);
  }
  async countPartials(companyId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM partial_loads WHERE company_id = $1`, [companyId]);
    return Number(rows[0].n);
  }
  async createPartial(companyId: string, d: {
    label: string; origin: string; destination: string;
    origin_lat: number; origin_lng: number; dest_lat: number; dest_lng: number;
    weight_kg: number; offered_rate_eur: number;
  }): Promise<PartialLoad> {
    const { rows } = await db.query<PartialLoad>(
      `INSERT INTO partial_loads (company_id, label, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, weight_kg, offered_rate_eur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [companyId, d.label, d.origin, d.destination, d.origin_lat, d.origin_lng, d.dest_lat, d.dest_lng, d.weight_kg, d.offered_rate_eur]);
    return numPartial(rows[0]);
  }
  async setPartialStatus(id: string, companyId: string, status: string): Promise<void> {
    await db.query(`UPDATE partial_loads SET status = $3 WHERE id = $1 AND company_id = $2`, [id, companyId, status]);
  }

  // ── Suggestions ──
  async listSuggestions(companyId: string): Promise<LtlSuggestion[]> {
    const { rows } = await db.query<LtlSuggestion>(
      `SELECT * FROM ltl_suggestions WHERE company_id = $1 AND status = 'suggested' ORDER BY margin_eur DESC, created_at DESC LIMIT 100`, [companyId]);
    return rows.map(numSuggestion);
  }
  async findSuggestion(id: string, companyId: string): Promise<LtlSuggestion | null> {
    const { rows } = await db.query<LtlSuggestion>(`SELECT * FROM ltl_suggestions WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ? numSuggestion(rows[0]) : null;
  }
  /** Replace the live suggestion for a partial (only one 'suggested' per partial). */
  async upsertSuggestion(companyId: string, s: {
    partial_load_id: string; route_id: string; route_label: string; partial_label: string;
    detour_km: number; detour_min: number; added_revenue_eur: number; margin_eur: number; score: number;
  }): Promise<LtlSuggestion> {
    await db.query(`DELETE FROM ltl_suggestions WHERE partial_load_id = $1 AND status = 'suggested'`, [s.partial_load_id]);
    const { rows } = await db.query<LtlSuggestion>(
      `INSERT INTO ltl_suggestions (company_id, partial_load_id, route_id, route_label, partial_label, detour_km, detour_min, added_revenue_eur, margin_eur, score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [companyId, s.partial_load_id, s.route_id, s.route_label, s.partial_label, s.detour_km, s.detour_min, s.added_revenue_eur, s.margin_eur, s.score]);
    return numSuggestion(rows[0]);
  }
  async setSuggestionStatus(id: string, companyId: string, status: string): Promise<LtlSuggestion | null> {
    const { rows } = await db.query<LtlSuggestion>(
      `UPDATE ltl_suggestions SET status = $3 WHERE id = $1 AND company_id = $2 RETURNING *`, [id, companyId, status]);
    return rows[0] ? numSuggestion(rows[0]) : null;
  }
}

export const ltlRepository = new LtlRepository();
