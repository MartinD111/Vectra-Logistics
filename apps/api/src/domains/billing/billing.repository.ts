import { db } from '../../core/db';

export interface ClientRecord {
  id: string;
  company_id: string;
  name: string;
  country: string;
  vat_id: string | null;
  email: string | null;
  credit_limit: number;
  outstanding_balance: number;
  default_rate_eur: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceRecord {
  id: string;
  company_id: string;
  client_id: string | null;
  pod_request_id: string | null;
  number: string;
  description: string;
  amount_net: number;
  vat_treatment: string;
  vat_rate: number;
  vat_amount: number;
  amount_total: number;
  vat_note: string | null;
  currency: string;
  status: string; // draft | approved | paid | void
  pod_url: string | null;
  issued_at: string;
  due_at: string | null;
  approved_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// NUMERIC comes back as strings from pg — coerce the money fields.
function numClient(r: ClientRecord): ClientRecord {
  return {
    ...r,
    credit_limit: Number(r.credit_limit),
    outstanding_balance: Number(r.outstanding_balance),
    default_rate_eur: r.default_rate_eur == null ? null : Number(r.default_rate_eur),
  };
}
function numInvoice(r: InvoiceRecord): InvoiceRecord {
  return {
    ...r,
    amount_net: Number(r.amount_net),
    vat_rate: Number(r.vat_rate),
    vat_amount: Number(r.vat_amount),
    amount_total: Number(r.amount_total),
  };
}

class BillingRepository {
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
  }): Promise<ClientRecord> {
    const { rows } = await db.query<ClientRecord>(
      `INSERT INTO clients (company_id, name, country, vat_id, email, credit_limit, default_rate_eur, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [companyId, d.name, d.country, d.vat_id, d.email, d.credit_limit, d.default_rate_eur, d.notes]);
    return numClient(rows[0]);
  }

  async updateClient(id: string, companyId: string, patch: Partial<{
    name: string; country: string; vat_id: string | null; email: string | null;
    credit_limit: number; default_rate_eur: number | null; notes: string | null;
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

  /** Atomic balance adjustment (positive = owes more). */
  async adjustBalance(id: string, companyId: string, delta: number): Promise<ClientRecord | null> {
    const { rows } = await db.query<ClientRecord>(
      `UPDATE clients SET outstanding_balance = outstanding_balance + $3, updated_at = NOW()
       WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId, delta]);
    return rows[0] ? numClient(rows[0]) : null;
  }

  // ── Invoices ──
  async listInvoices(companyId: string): Promise<InvoiceRecord[]> {
    const { rows } = await db.query<InvoiceRecord>(
      `SELECT * FROM invoices WHERE company_id = $1 AND status <> 'void'
       ORDER BY created_at DESC LIMIT 200`, [companyId]);
    return rows.map(numInvoice);
  }

  async findInvoice(id: string, companyId: string): Promise<InvoiceRecord | null> {
    const { rows } = await db.query<InvoiceRecord>(
      `SELECT * FROM invoices WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ? numInvoice(rows[0]) : null;
  }

  async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const { rows } = await db.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM invoices WHERE company_id = $1 AND number LIKE $2`,
      [companyId, `INV-${year}-%`]);
    return `INV-${year}-${String(Number(rows[0].n) + 1).padStart(4, '0')}`;
  }

  async createInvoice(d: {
    companyId: string; clientId: string | null; podRequestId: string | null;
    number: string; description: string; amountNet: number;
    vatTreatment: string; vatRate: number; vatAmount: number; amountTotal: number;
    vatNote: string | null; podUrl: string | null; dueAt: string | null;
  }): Promise<InvoiceRecord> {
    const { rows } = await db.query<InvoiceRecord>(
      `INSERT INTO invoices (company_id, client_id, pod_request_id, number, description,
         amount_net, vat_treatment, vat_rate, vat_amount, amount_total, vat_note, pod_url, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [d.companyId, d.clientId, d.podRequestId, d.number, d.description,
       d.amountNet, d.vatTreatment, d.vatRate, d.vatAmount, d.amountTotal, d.vatNote, d.podUrl, d.dueAt]);
    return numInvoice(rows[0]);
  }

  /** Guarded status transition; returns null when the current status doesn't match. */
  async transition(id: string, companyId: string, from: string, to: string, stampCol: 'approved_at' | 'paid_at'): Promise<InvoiceRecord | null> {
    const { rows } = await db.query<InvoiceRecord>(
      `UPDATE invoices SET status = $4, ${stampCol} = NOW(), updated_at = NOW()
       WHERE id = $1 AND company_id = $2 AND status = $3 RETURNING *`,
      [id, companyId, from, to]);
    return rows[0] ? numInvoice(rows[0]) : null;
  }
}

export const billingRepository = new BillingRepository();
