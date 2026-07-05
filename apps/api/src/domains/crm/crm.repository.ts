import { db } from '../../core/db';
import { ClientRecord, ClientProjectLinkRecord } from './crm.types';

// NUMERIC comes back as strings from pg — coerce the money fields.
function numClient(r: ClientRecord): ClientRecord {
  return {
    ...r,
    credit_limit: Number(r.credit_limit),
    outstanding_balance: Number(r.outstanding_balance),
    default_rate_eur: r.default_rate_eur == null ? null : Number(r.default_rate_eur),
  };
}
function numProjectLink(r: ClientProjectLinkRecord): ClientProjectLinkRecord {
  return {
    ...r,
    override_rate_eur: r.override_rate_eur == null ? null : Number(r.override_rate_eur),
  };
}

class CrmRepository {
  // ── Clients ──
  async listClients(companyId: string): Promise<ClientRecord[]> {
    const { rows } = await db.query<ClientRecord>(
      `SELECT * FROM clients WHERE company_id = $1 ORDER BY name ASC`, [companyId]);
    return rows.map(numClient);
  }

  async findClient(id: string, companyId: string): Promise<ClientRecord | null> {
    const { rows } = await db.query<ClientRecord>(
      `SELECT * FROM clients WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ? numClient(rows[0]) : null;
  }

  async createClient(companyId: string, d: {
    name: string; country: string; vat_id: string | null; email: string | null;
    credit_limit: number; default_rate_eur: number | null; notes: string | null;
    address: string | null; responsible_employee_id: string | null;
  }): Promise<ClientRecord> {
    const { rows } = await db.query<ClientRecord>(
      `INSERT INTO clients (company_id, name, country, vat_id, email, credit_limit, default_rate_eur, notes, address, responsible_employee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [companyId, d.name, d.country, d.vat_id, d.email, d.credit_limit, d.default_rate_eur, d.notes, d.address, d.responsible_employee_id]);
    return numClient(rows[0]);
  }

  async updateClient(id: string, companyId: string, patch: Partial<{
    name: string; country: string; vat_id: string | null; email: string | null;
    credit_limit: number; default_rate_eur: number | null; notes: string | null;
    address: string | null; responsible_employee_id: string | null;
  }>): Promise<ClientRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [col, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.findClient(id, companyId);
    sets.push('updated_at = NOW()');
    const { rows } = await db.query<ClientRecord>(
      `UPDATE clients SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params);
    return rows[0] ? numClient(rows[0]) : null;
  }

  // ── Client-Project Links ──
  async listProjectLinks(clientId: string, companyId: string): Promise<ClientProjectLinkRecord[]> {
    const { rows } = await db.query<ClientProjectLinkRecord>(
      `SELECT * FROM client_project_links WHERE client_id = $1 AND company_id = $2`, [clientId, companyId]);
    return rows.map(numProjectLink);
  }

  async findProjectLink(clientId: string, projectId: string, companyId: string): Promise<ClientProjectLinkRecord | null> {
    const { rows } = await db.query<ClientProjectLinkRecord>(
      `SELECT * FROM client_project_links WHERE client_id = $1 AND project_id = $2 AND company_id = $3`,
      [clientId, projectId, companyId]);
    return rows[0] ? numProjectLink(rows[0]) : null;
  }

  async upsertProjectLink(companyId: string, d: {
    client_id: string; project_id: string;
    override_rate_eur: number | null;
    override_responsible_employee_id: string | null;
    override_notes: string | null;
  }): Promise<ClientProjectLinkRecord> {
    const { rows } = await db.query<ClientProjectLinkRecord>(
      `INSERT INTO client_project_links (company_id, client_id, project_id, override_rate_eur, override_responsible_employee_id, override_notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (client_id, project_id) DO UPDATE SET
         override_rate_eur = EXCLUDED.override_rate_eur,
         override_responsible_employee_id = EXCLUDED.override_responsible_employee_id,
         override_notes = EXCLUDED.override_notes,
         updated_at = NOW()
       RETURNING *`,
      [companyId, d.client_id, d.project_id, d.override_rate_eur, d.override_responsible_employee_id, d.override_notes]);
    return numProjectLink(rows[0]);
  }
}

export const crmRepository = new CrmRepository();
