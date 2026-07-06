import { db } from '../../core/db';
import { ClientRecord, ClientProjectLinkRecord, ClientPageRecord } from './crm.types';

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

  async findClientByVatId(vatId: string, companyId: string): Promise<ClientRecord | null> {
    const { rows } = await db.query<ClientRecord>(
      `SELECT * FROM clients WHERE vat_id = $1 AND company_id = $2`, [vatId, companyId]);
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

  async deleteProjectLink(clientId: string, projectId: string, companyId: string): Promise<void> {
    await db.query(
      `DELETE FROM client_project_links WHERE client_id = $1 AND project_id = $2 AND company_id = $3`,
      [clientId, projectId, companyId]);
  }

  // ── Client Pages ──
  async findClientPage(clientId: string, companyId: string): Promise<ClientPageRecord | null> {
    const { rows } = await db.query<ClientPageRecord>(
      `SELECT * FROM client_pages WHERE client_id = $1 AND company_id = $2`, [clientId, companyId]);
    return rows[0] ?? null;
  }

  async createClientPage(
    companyId: string, clientId: string, createdBy: string | null,
    data: { title?: string; icon?: string | null; config?: Record<string, unknown> },
  ): Promise<ClientPageRecord> {
    // ON CONFLICT (client_id) guarantees exactly one row per client even under
    // concurrent get-or-create calls (D-08) — no separate advisory lock needed.
    const { rows } = await db.query<ClientPageRecord>(
      `INSERT INTO client_pages (company_id, client_id, title, icon, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [
        companyId, clientId, data.title ?? 'Untitled', data.icon ?? null,
        JSON.stringify(data.config ?? { version: 1, blocks: [] }), createdBy,
      ]);
    return rows[0];
  }

  async updateClientPage(
    pageId: string, companyId: string,
    data: {
      title?: string; icon?: string | null; config?: Record<string, unknown>;
      cover_image_url?: string | null; header_settings?: Record<string, unknown>;
    },
  ): Promise<ClientPageRecord | null> {
    // Nullable fields use a provided-flag + CASE so an explicit null clears the
    // value; COALESCE alone could never reset them (mirrors projects.repository.ts updatePage).
    const { rows } = await db.query<ClientPageRecord>(
      `UPDATE client_pages SET
         title           = COALESCE($3, title),
         icon            = CASE WHEN $4::boolean THEN $5 ELSE icon END,
         config          = COALESCE($6, config),
         cover_image_url = CASE WHEN $7::boolean THEN $8 ELSE cover_image_url END,
         header_settings = COALESCE($9, header_settings),
         updated_at      = NOW()
       WHERE id = $1 AND company_id = $2 RETURNING *`,
      [
        pageId, companyId, data.title ?? null,
        data.icon !== undefined, data.icon ?? null,
        data.config ? JSON.stringify(data.config) : null,
        data.cover_image_url !== undefined, data.cover_image_url ?? null,
        data.header_settings ? JSON.stringify(data.header_settings) : null,
      ]);
    return rows[0] ?? null;
  }

  // ── Client Timeline data sources (T-02-01: always scoped by company_id) ──
  async listClientEmails(
    clientId: string, companyId: string,
  ): Promise<{ id: string; subject: string; received_at: string }[]> {
    const { rows } = await db.query<{ id: string; subject: string; received_at: string }>(
      `SELECT id, subject, received_at FROM email_messages
       WHERE client_id = $1 AND company_id = $2
       ORDER BY received_at DESC LIMIT 50`,
      [clientId, companyId]);
    return rows;
  }

  async listClientInvoices(
    clientId: string, companyId: string,
  ): Promise<{ id: string; number: string; amount_total: string; issued_at: string }[]> {
    const { rows } = await db.query<{ id: string; number: string; amount_total: string; issued_at: string }>(
      `SELECT id, number, amount_total, issued_at FROM invoices
       WHERE client_id = $1 AND company_id = $2
       ORDER BY issued_at DESC LIMIT 50`,
      [clientId, companyId]);
    return rows;
  }

  async listClientKpiResults(
    clientId: string, companyId: string,
  ): Promise<{ id: string; rule_name: string; status: string; period_start: string }[]> {
    const { rows } = await db.query<{ id: string; rule_name: string; status: string; period_start: string }>(
      `SELECT r.id, k.name AS rule_name, r.status, r.period_start FROM kpi_results r
       JOIN kpi_rules k ON k.id = r.rule_id
       WHERE r.client_id = $1 AND r.company_id = $2
       ORDER BY r.period_start DESC LIMIT 50`,
      [clientId, companyId]);
    return rows;
  }
}

export const crmRepository = new CrmRepository();
