// CRM + invoicing pipeline (Phase 6). Clients carry credit limits that gate
// assignment (403 when a new load would push them over); invoices are
// auto-drafted the moment a POD lands (shipment delivered) with the Smart-VAT
// treatment applied, then human-approved on the dashboard. Approving an
// invoice adds it to the client's outstanding balance; marking it paid
// releases it — that's the quote-to-cash loop the guardrail reads from.
//
// (billing.service.ts in this folder is an older, uncalled driver-settlement
// stub kept as-is; this service owns the Phase 6 surface.)

import { z } from 'zod';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { emitToRoom } from '../../core/realtime/bus';
import { recordEvent } from '../../core/events/activityLog';
import { billingRepository, ClientRecord, InvoiceRecord } from './billing.repository';
import { evaluateVat, toIso2, VatResult } from './vat.service';

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(160),
  country: z.string().min(2).max(2),
  vat_id: z.string().max(20).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  credit_limit: z.number().min(0).max(10_000_000).optional(),
  default_rate_eur: z.number().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateClientSchema = CreateClientSchema.partial();

export const EvaluateVatSchema = z.object({
  client_country: z.string().min(2).max(40),
  client_vat_id: z.string().max(20).nullable().optional(),
  /** Optional override; defaults to the tenant company's country. */
  supplier_country: z.string().min(2).max(40).optional(),
});

const DEFAULT_RATE_EUR = 850; // fallback when neither the POD nor the client carries a rate
const DUE_DAYS = 30;

class InvoicingService {
  // ── Clients (CRM) ──
  listClients(companyId: string): Promise<ClientRecord[]> {
    return billingRepository.listClients(companyId);
  }

  async createClient(companyId: string, body: unknown): Promise<ClientRecord> {
    const parsed = CreateClientSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    return billingRepository.createClient(companyId, {
      name: d.name, country: d.country.toUpperCase(), vat_id: d.vat_id ?? null,
      email: d.email ?? null, credit_limit: d.credit_limit ?? 10000,
      default_rate_eur: d.default_rate_eur ?? null, notes: d.notes ?? null,
    });
  }

  async updateClient(id: string, companyId: string, body: unknown): Promise<ClientRecord> {
    const parsed = UpdateClientSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const patch = { ...parsed.data, country: parsed.data.country?.toUpperCase() };
    const updated = await billingRepository.updateClient(id, companyId, patch);
    if (!updated) throw new AppError(404, 'Client not found');
    return updated;
  }

  /**
   * Credit-limit guardrail: throws 403 when assigning a load worth `amount`
   * would push the client past their limit. Call sites: POD/load assignment.
   */
  async assertCreditOk(clientId: string, companyId: string, amount: number): Promise<ClientRecord> {
    const client = await billingRepository.findClient(clientId, companyId);
    if (!client) throw new AppError(404, 'Client not found');
    if (client.outstanding_balance + amount > client.credit_limit) {
      throw new AppError(403,
        `Credit limit exceeded for ${client.name}: outstanding €${client.outstanding_balance.toFixed(2)} + €${amount.toFixed(2)} > limit €${client.credit_limit.toFixed(2)}. Settle open invoices or raise the limit.`);
    }
    return client;
  }

  // ── Smart VAT ──
  async evaluateVatFor(companyId: string, body: unknown): Promise<VatResult> {
    const parsed = EvaluateVatSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const supplier = parsed.data.supplier_country ?? await this.supplierCountry(companyId);
    return evaluateVat({
      supplier_country: supplier,
      client_country: parsed.data.client_country,
      client_vat_id: parsed.data.client_vat_id,
    });
  }

  private async supplierCountry(companyId: string): Promise<string> {
    const { rows } = await db.query<{ country: string | null }>(
      `SELECT country FROM companies WHERE id = $1`, [companyId]);
    return toIso2(rows[0]?.country, 'SI');
  }

  // ── Invoices ──
  listInvoices(companyId: string): Promise<InvoiceRecord[]> {
    return billingRepository.listInvoices(companyId);
  }

  /**
   * The Phase 6 trigger: called from the POD pipeline the moment a delivery is
   * confirmed. Pulls the agreed rate (POD → client default → fallback),
   * applies the VAT matrix, attaches the POD, and drafts the invoice for
   * dashboard approval. Never throws into the POD happy path.
   */
  async autoDraftInvoice(input: {
    companyId: string; clientId: string; podRequestId: string;
    label: string; agreedRateEur: number | null; podUrl: string | null;
  }): Promise<InvoiceRecord | null> {
    try {
      const client = await billingRepository.findClient(input.clientId, input.companyId);
      if (!client) return null;
      const net = input.agreedRateEur ?? client.default_rate_eur ?? DEFAULT_RATE_EUR;
      const vat = evaluateVat({
        supplier_country: await this.supplierCountry(input.companyId),
        client_country: client.country,
        client_vat_id: client.vat_id,
      });
      const vatAmount = Math.round(net * vat.rate) / 100;
      const dueAt = new Date(Date.now() + DUE_DAYS * 86400_000).toISOString().slice(0, 10);
      const invoice = await billingRepository.createInvoice({
        companyId: input.companyId, clientId: client.id, podRequestId: input.podRequestId,
        number: await billingRepository.nextNumber(input.companyId),
        description: `Transport — ${input.label}`,
        amountNet: net, vatTreatment: vat.treatment, vatRate: vat.rate,
        vatAmount, amountTotal: net + vatAmount, vatNote: vat.note,
        podUrl: input.podUrl, dueAt,
      });
      emitToRoom(`company:${input.companyId}`, 'invoice:new', invoice);
      await recordEvent({
        tenantId: input.companyId, verb: 'invoice.drafted',
        objectType: 'invoice', objectId: invoice.id,
        payload: { number: invoice.number, client: client.name, total: invoice.amount_total, vat: vat.treatment },
      });
      return invoice;
    } catch (err) {
      console.error('[billing] autoDraftInvoice failed', (err as Error).message);
      return null;
    }
  }

  /** Approve a draft — the invoice becomes receivable: the client owes it. */
  async approveInvoice(id: string, companyId: string, userId: string | null): Promise<InvoiceRecord> {
    const invoice = await billingRepository.transition(id, companyId, 'draft', 'approved', 'approved_at');
    if (!invoice) throw new AppError(409, 'Invoice is not in draft state.');
    if (invoice.client_id) {
      await billingRepository.adjustBalance(invoice.client_id, companyId, invoice.amount_total);
    }
    emitToRoom(`company:${companyId}`, 'invoice:updated', invoice);
    await recordEvent({
      tenantId: companyId, actorId: userId, verb: 'invoice.approved',
      objectType: 'invoice', objectId: id, payload: { number: invoice.number },
    });
    return invoice;
  }

  /** Mark paid — releases the client's outstanding balance. */
  async markPaid(id: string, companyId: string, userId: string | null): Promise<InvoiceRecord> {
    const invoice = await billingRepository.transition(id, companyId, 'approved', 'paid', 'paid_at');
    if (!invoice) throw new AppError(409, 'Only approved invoices can be marked paid.');
    if (invoice.client_id) {
      await billingRepository.adjustBalance(invoice.client_id, companyId, -invoice.amount_total);
    }
    emitToRoom(`company:${companyId}`, 'invoice:updated', invoice);
    await recordEvent({
      tenantId: companyId, actorId: userId, verb: 'invoice.paid',
      objectType: 'invoice', objectId: id, payload: { number: invoice.number },
    });
    return invoice;
  }
}

export const invoicingService = new InvoicingService();
