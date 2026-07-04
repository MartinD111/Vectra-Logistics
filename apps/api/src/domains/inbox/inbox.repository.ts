import { db } from '../../core/db';

export interface ShipmentDraft {
  id: string;
  company_id: string;
  project_id: string | null;
  status: string; // needs_review | validated | confirmed | rejected
  origin: string | null;
  destination: string | null;
  cargo_type: string | null;
  weight_kg: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  wagon_number: string | null;
  reference: string | null;
  confidence: number | null;
  source: string;
  source_email: Record<string, unknown>;
  extracted: Record<string, unknown>;
  validation: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDraftInput {
  companyId: string;
  projectId: string | null;
  createdBy: string | null;
  status: string;
  origin: string | null;
  destination: string | null;
  cargo_type: string | null;
  weight_kg: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  wagon_number: string | null;
  reference: string | null;
  confidence: number | null;
  source: string;
  source_email: Record<string, unknown>;
  extracted: Record<string, unknown>;
  validation: Record<string, unknown>;
}

export interface UpdateDraftInput {
  status?: string;
  origin?: string | null;
  destination?: string | null;
  cargo_type?: string | null;
  weight_kg?: number | null;
  pickup_date?: string | null;
  delivery_date?: string | null;
  wagon_number?: string | null;
  reference?: string | null;
  validation?: Record<string, unknown>;
}

class InboxRepository {
  async listDrafts(companyId: string, projectId?: string): Promise<ShipmentDraft[]> {
    const params: unknown[] = [companyId];
    let where = `company_id = $1 AND status <> 'rejected'`;
    if (projectId) { params.push(projectId); where += ` AND project_id = $${params.length}`; }
    const { rows } = await db.query<ShipmentDraft>(
      `SELECT * FROM shipment_drafts WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return rows;
  }

  async findDraft(id: string, companyId: string): Promise<ShipmentDraft | null> {
    const { rows } = await db.query<ShipmentDraft>(
      `SELECT * FROM shipment_drafts WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async createDraft(input: CreateDraftInput): Promise<ShipmentDraft> {
    const { rows } = await db.query<ShipmentDraft>(
      `INSERT INTO shipment_drafts
         (company_id, project_id, created_by, status, origin, destination, cargo_type,
          weight_kg, pickup_date, delivery_date, wagon_number, reference, confidence,
          source, source_email, extracted, validation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        input.companyId, input.projectId, input.createdBy, input.status,
        input.origin, input.destination, input.cargo_type, input.weight_kg,
        input.pickup_date, input.delivery_date, input.wagon_number, input.reference, input.confidence,
        input.source, JSON.stringify(input.source_email), JSON.stringify(input.extracted), JSON.stringify(input.validation),
      ],
    );
    return rows[0];
  }

  async updateDraft(id: string, companyId: string, patch: UpdateDraftInput): Promise<ShipmentDraft | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    const add = (col: string, val: unknown, cast = '') => {
      params.push(val);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.origin !== undefined) add('origin', patch.origin);
    if (patch.destination !== undefined) add('destination', patch.destination);
    if (patch.cargo_type !== undefined) add('cargo_type', patch.cargo_type);
    if (patch.weight_kg !== undefined) add('weight_kg', patch.weight_kg);
    if (patch.pickup_date !== undefined) add('pickup_date', patch.pickup_date);
    if (patch.delivery_date !== undefined) add('delivery_date', patch.delivery_date);
    if (patch.wagon_number !== undefined) add('wagon_number', patch.wagon_number);
    if (patch.reference !== undefined) add('reference', patch.reference);
    if (patch.validation !== undefined) add('validation', JSON.stringify(patch.validation), '::jsonb');
    if (sets.length === 0) return this.findDraft(id, companyId);
    sets.push('updated_at = NOW()');
    const { rows } = await db.query<ShipmentDraft>(
      `UPDATE shipment_drafts SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`,
      params,
    );
    return rows[0] ?? null;
  }
}

export const inboxRepository = new InboxRepository();
