import { db } from '../../core/db';

export interface YardZone {
  id: string;
  company_id: string;
  project_id: string | null;
  name: string;
  kind: string;
  color: string | null;
  x: number; y: number; width: number; height: number;
  polygon: unknown | null;
  created_at: Date;
}

export interface YardSlot {
  id: string;
  company_id: string;
  zone_id: string;
  label: string;
  x: number; y: number;
  status: string;
  created_at: Date;
}

export interface YardAsset {
  id: string;
  company_id: string;
  project_id: string | null;
  kind: string;
  label: string;
  identifier: string | null;
  slot_id: string | null;
  x: number; y: number;
  status: string;
  source: string;
  metadata: Record<string, unknown>;
  checked_in_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RailWagon {
  id: string;
  company_id: string;
  project_id: string | null;
  wagon_number: string;
  status: string;
  seq: number;
  cargo: string | null;
  reference: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// Numeric columns come back as strings from pg; coerce the geometry so the API
// returns real numbers.
function numZone<T extends { x: unknown; y: unknown; width: unknown; height: unknown }>(r: T): T {
  return { ...r, x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height) };
}
function numXY<T extends { x: unknown; y: unknown }>(r: T): T {
  return { ...r, x: Number(r.x), y: Number(r.y) };
}

class YardRepository {
  // ── Zones ──
  async listZones(companyId: string, projectId?: string): Promise<YardZone[]> {
    const params: unknown[] = [companyId];
    let where = 'company_id = $1';
    if (projectId) { params.push(projectId); where += ` AND project_id = $${params.length}`; }
    const { rows } = await db.query<YardZone>(`SELECT * FROM yard_zones WHERE ${where} ORDER BY created_at ASC`, params);
    return rows.map(numZone);
  }
  async createZone(z: Omit<YardZone, 'id' | 'created_at'>): Promise<YardZone> {
    const { rows } = await db.query<YardZone>(
      `INSERT INTO yard_zones (company_id, project_id, name, kind, color, x, y, width, height, polygon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [z.company_id, z.project_id, z.name, z.kind, z.color, z.x, z.y, z.width, z.height, z.polygon ? JSON.stringify(z.polygon) : null],
    );
    return numZone(rows[0]);
  }
  async deleteZone(id: string, companyId: string): Promise<boolean> {
    const { rowCount } = await db.query(`DELETE FROM yard_zones WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return (rowCount ?? 0) > 0;
  }

  // ── Slots ──
  async listSlots(companyId: string, projectId?: string): Promise<YardSlot[]> {
    const params: unknown[] = [companyId];
    let join = '';
    let where = 's.company_id = $1';
    if (projectId) { params.push(projectId); join = 'JOIN yard_zones z ON z.id = s.zone_id'; where += ` AND z.project_id = $${params.length}`; }
    const { rows } = await db.query<YardSlot>(`SELECT s.* FROM yard_slots s ${join} WHERE ${where} ORDER BY s.created_at ASC`, params);
    return rows.map(numXY);
  }
  async createSlot(s: Omit<YardSlot, 'id' | 'created_at'>): Promise<YardSlot> {
    const { rows } = await db.query<YardSlot>(
      `INSERT INTO yard_slots (company_id, zone_id, label, x, y, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [s.company_id, s.zone_id, s.label, s.x, s.y, s.status],
    );
    return numXY(rows[0]);
  }
  async setSlotStatus(id: string, status: string): Promise<void> {
    await db.query(`UPDATE yard_slots SET status = $2 WHERE id = $1`, [id, status]);
  }
  async firstFreeSlot(companyId: string, kinds: string[]): Promise<YardSlot | null> {
    const { rows } = await db.query<YardSlot>(
      `SELECT s.* FROM yard_slots s
       JOIN yard_zones z ON z.id = s.zone_id
       WHERE s.company_id = $1 AND s.status = 'free' AND z.kind = ANY($2::text[])
       ORDER BY s.created_at ASC LIMIT 1`,
      [companyId, kinds],
    );
    return rows[0] ? numXY(rows[0]) : null;
  }

  // ── Assets ──
  async listAssets(companyId: string, projectId?: string): Promise<YardAsset[]> {
    const params: unknown[] = [companyId];
    let where = "company_id = $1 AND status <> 'departed'";
    if (projectId) { params.push(projectId); where += ` AND project_id = $${params.length}`; }
    const { rows } = await db.query<YardAsset>(`SELECT * FROM yard_assets WHERE ${where} ORDER BY created_at ASC`, params);
    return rows.map(numXY);
  }
  async findAsset(id: string, companyId: string): Promise<YardAsset | null> {
    const { rows } = await db.query<YardAsset>(`SELECT * FROM yard_assets WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ? numXY(rows[0]) : null;
  }
  async findAssetByIdentifier(companyId: string, identifier: string): Promise<YardAsset | null> {
    const { rows } = await db.query<YardAsset>(
      `SELECT * FROM yard_assets WHERE company_id = $1 AND upper(identifier) = upper($2) AND status <> 'departed' LIMIT 1`,
      [companyId, identifier],
    );
    return rows[0] ? numXY(rows[0]) : null;
  }
  async createAsset(a: Omit<YardAsset, 'id' | 'created_at' | 'updated_at' | 'checked_in_at'> & { checked_in_at?: Date }): Promise<YardAsset> {
    const { rows } = await db.query<YardAsset>(
      `INSERT INTO yard_assets (company_id, project_id, kind, label, identifier, slot_id, x, y, status, source, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [a.company_id, a.project_id, a.kind, a.label, a.identifier, a.slot_id, a.x, a.y, a.status, a.source, JSON.stringify(a.metadata ?? {})],
    );
    return numXY(rows[0]);
  }
  async updateAsset(id: string, companyId: string, patch: Partial<Pick<YardAsset, 'x' | 'y' | 'slot_id' | 'status'>>): Promise<YardAsset | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [col, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.findAsset(id, companyId);
    sets.push('updated_at = NOW()');
    const { rows } = await db.query<YardAsset>(
      `UPDATE yard_assets SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params,
    );
    return rows[0] ? numXY(rows[0]) : null;
  }

  // ── Rail wagons ──
  async listWagons(companyId: string, projectId?: string): Promise<RailWagon[]> {
    const params: unknown[] = [companyId];
    let where = 'company_id = $1';
    if (projectId) { params.push(projectId); where += ` AND project_id = $${params.length}`; }
    const { rows } = await db.query<RailWagon>(`SELECT * FROM rail_wagons WHERE ${where} ORDER BY status, seq ASC`, params);
    return rows;
  }
  async findWagon(id: string, companyId: string): Promise<RailWagon | null> {
    const { rows } = await db.query<RailWagon>(`SELECT * FROM rail_wagons WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ?? null;
  }
  async createWagon(w: Omit<RailWagon, 'id' | 'created_at' | 'updated_at'>): Promise<RailWagon> {
    const { rows } = await db.query<RailWagon>(
      `INSERT INTO rail_wagons (company_id, project_id, wagon_number, status, seq, cargo, reference, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [w.company_id, w.project_id, w.wagon_number, w.status, w.seq, w.cargo, w.reference, JSON.stringify(w.metadata ?? {})],
    );
    return rows[0];
  }
  async updateWagon(id: string, companyId: string, patch: Partial<Pick<RailWagon, 'status' | 'seq' | 'cargo' | 'reference'>>): Promise<RailWagon | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [col, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.findWagon(id, companyId);
    sets.push('updated_at = NOW()');
    const { rows } = await db.query<RailWagon>(
      `UPDATE rail_wagons SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params,
    );
    return rows[0] ?? null;
  }

  async countZones(companyId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM yard_zones WHERE company_id = $1`, [companyId]);
    return Number(rows[0].n);
  }
  async countWagons(companyId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM rail_wagons WHERE company_id = $1`, [companyId]);
    return Number(rows[0].n);
  }
}

export const yardRepository = new YardRepository();
