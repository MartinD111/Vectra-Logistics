import { AppError } from '../../core/errors/AppError';
import { crmRepository } from './crm.repository';
import { projectsRepository } from '../projects/projects.repository';
import { teamRepository } from '../team/team.repository';
import { ClientRecord, ResolvedClientProjectView, ClientPageRecord, ClientTimelineEntry, ImportClientsResult, ImportRowResult } from './crm.types';
import { CreateClientSchema } from './dto/create-client.dto';
import { UpdateClientSchema } from './dto/update-client.dto';
import { LinkProjectSchema } from './dto/link-project.dto';
import { UpdateClientPageSchema } from './dto/update-client-page.dto';

class CrmService {
  // ── Clients ──
  listClients(companyId: string): Promise<ClientRecord[]> {
    return crmRepository.listClients(companyId);
  }

  async getClient(id: string, companyId: string): Promise<ClientRecord> {
    const client = await crmRepository.findClient(id, companyId);
    if (!client) throw new AppError(404, 'Client not found');
    return client;
  }

  async createClient(companyId: string, body: unknown): Promise<ClientRecord> {
    const parsed = CreateClientSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    return crmRepository.createClient(companyId, {
      name: d.name,
      country: d.country.toUpperCase(),
      vat_id: d.vat_id ?? null,
      email: d.email ?? null,
      credit_limit: d.credit_limit ?? 10000,
      default_rate_eur: d.default_rate_eur ?? null,
      notes: d.notes ?? null,
      address: d.address ?? null,
      responsible_employee_id: d.responsible_employee_id ?? null,
    });
  }

  async updateClient(id: string, companyId: string, body: unknown): Promise<ClientRecord> {
    const parsed = UpdateClientSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const patch = { ...parsed.data, country: parsed.data.country?.toUpperCase() };
    const updated = await crmRepository.updateClient(id, companyId, patch);
    if (!updated) throw new AppError(404, 'Client not found');
    return updated;
  }

  // ── Client-Project Links (D-02: override ?? global) ──
  async listClientProjectLinks(clientId: string, companyId: string): Promise<ResolvedClientProjectView[]> {
    const client = await this.getClient(clientId, companyId);
    const links = await crmRepository.listProjectLinks(clientId, companyId);
    return links.map((l) => ({
      client_id: l.client_id,
      project_id: l.project_id,
      rate_eur: l.override_rate_eur ?? client.default_rate_eur,
      responsible_employee_id: l.override_responsible_employee_id ?? client.responsible_employee_id,
      notes: l.override_notes ?? client.notes,
      is_overridden: {
        rate: l.override_rate_eur !== null,
        responsible_employee: l.override_responsible_employee_id !== null,
        notes: l.override_notes !== null,
      },
    }));
  }

  async upsertClientProjectLink(clientId: string, companyId: string, body: unknown): Promise<ResolvedClientProjectView> {
    const parsed = LinkProjectSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const client = await this.getClient(clientId, companyId);
    await this.assertOwnedProject(parsed.data.project_id, companyId);
    const link = await crmRepository.upsertProjectLink(companyId, {
      client_id: clientId,
      project_id: parsed.data.project_id,
      override_rate_eur: parsed.data.override_rate_eur ?? null,
      override_responsible_employee_id: parsed.data.override_responsible_employee_id ?? null,
      override_notes: parsed.data.override_notes ?? null,
    });
    return {
      client_id: link.client_id,
      project_id: link.project_id,
      rate_eur: link.override_rate_eur ?? client.default_rate_eur,
      responsible_employee_id: link.override_responsible_employee_id ?? client.responsible_employee_id,
      notes: link.override_notes ?? client.notes,
      is_overridden: {
        rate: link.override_rate_eur !== null,
        responsible_employee: link.override_responsible_employee_id !== null,
        notes: link.override_notes !== null,
      },
    };
  }

  async unlinkClientProject(clientId: string, projectId: string, companyId: string): Promise<void> {
    await this.getClient(clientId, companyId);
    await this.assertOwnedProject(projectId, companyId);
    await crmRepository.deleteProjectLink(clientId, projectId, companyId);
  }

  // Cross-domain ownership check (V4 Access Control, T-03-01/T-03-02): mirrors
  // projects.service.ts's private assertOwnedProject, but implemented locally
  // since that method is private to ProjectsService. Reuses the public
  // projectsRepository.findProject export rather than adding a new one.
  private async assertOwnedProject(projectId: string, companyId: string): Promise<void> {
    const p = await projectsRepository.findProject(projectId);
    if (!p) throw new AppError(404, 'Project not found');
    if (p.company_id !== companyId) throw new AppError(403, 'Forbidden');
  }

  // ── Client Pages (D-07/D-08: idempotent get-or-create, one page per client) ──
  async getOrCreateClientPage(clientId: string, companyId: string, createdBy: string | null): Promise<ClientPageRecord> {
    await this.getClient(clientId, companyId);
    const existing = await crmRepository.findClientPage(clientId, companyId);
    if (existing) return existing;
    return crmRepository.createClientPage(companyId, clientId, createdBy, {});
  }

  async updateClientPage(pageId: string, companyId: string, body: unknown): Promise<ClientPageRecord> {
    const parsed = UpdateClientPageSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const updated = await crmRepository.updateClientPage(pageId, companyId, parsed.data);
    if (!updated) throw new AppError(404, 'Client page not found');
    return updated;
  }

  // ── Client Timeline (merged emails/invoices/kpi feed, date-sorted) ──
  async getClientTimeline(clientId: string, companyId: string): Promise<ClientTimelineEntry[]> {
    await this.getClient(clientId, companyId);
    const [emails, invoices, kpiResults] = await Promise.all([
      crmRepository.listClientEmails(clientId, companyId),
      crmRepository.listClientInvoices(clientId, companyId),
      crmRepository.listClientKpiResults(clientId, companyId),
    ]);

    const entries: ClientTimelineEntry[] = [
      ...emails.map((e) => ({
        type: 'email' as const,
        id: e.id,
        occurred_at: e.received_at,
        summary: `Email: ${e.subject}`,
      })),
      ...invoices.map((i) => ({
        type: 'invoice' as const,
        id: i.id,
        occurred_at: i.issued_at,
        summary: `Invoice ${i.number} — €${i.amount_total}`,
      })),
      ...kpiResults.map((k) => ({
        type: 'kpi' as const,
        id: k.id,
        occurred_at: k.period_start,
        summary: `${k.rule_name}: ${k.status}`,
      })),
    ];

    return entries.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));
  }

  // ── Bulk Excel Import (IMP-02/IMP-03/IMP-04, D-03: per-row commit, no batch-wide rollback) ──
  async importClients(companyId: string, body: unknown): Promise<ImportClientsResult> {
    if (!Array.isArray(body)) throw new AppError(400, 'Import payload must be an array of rows');

    const results: ImportRowResult[] = [];

    for (let i = 0; i < body.length; i++) {
      const row = i + 1;
      const raw = body[i] as Record<string, unknown>;

      let responsibleEmployeeId: string | null = null;
      const rawEmail = raw.responsible_employee_email;
      if (typeof rawEmail === 'string' && rawEmail.trim() !== '') {
        try {
          responsibleEmployeeId = await this.resolveResponsibleEmployee(rawEmail, companyId);
        } catch (err) {
          const reason = err instanceof AppError ? err.message : 'No team member found with this email';
          results.push({ row, status: 'failed', reason });
          continue;
        }
      }

      const rawVatId = raw.vat_id;
      if (typeof rawVatId === 'string' && rawVatId.trim() !== '') {
        const existing = await crmRepository.findClientByVatId(rawVatId, companyId);
        if (existing) {
          results.push({ row, status: 'failed', reason: 'Client with this VAT ID already exists' });
          continue;
        }
      }

      const { responsible_employee_email: _ignored, ...rest } = raw;
      const candidate = { ...rest, responsible_employee_id: responsibleEmployeeId };

      const parsed = CreateClientSchema.safeParse(candidate);
      if (!parsed.success) {
        results.push({ row, status: 'failed', reason: parsed.error.issues[0].message });
        continue;
      }

      const d = parsed.data;
      const client = await crmRepository.createClient(companyId, {
        name: d.name,
        country: d.country.toUpperCase(),
        vat_id: d.vat_id ?? null,
        email: d.email ?? null,
        credit_limit: d.credit_limit ?? 10000,
        default_rate_eur: d.default_rate_eur ?? null,
        notes: d.notes ?? null,
        address: d.address ?? null,
        responsible_employee_id: d.responsible_employee_id ?? null,
      });
      results.push({ row, status: 'created', client });
    }

    return {
      created: results.filter((r) => r.status === 'created').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  private async resolveResponsibleEmployee(email: string, companyId: string): Promise<string> {
    const member = await teamRepository.findMemberByEmail(email, companyId);
    if (!member) throw new AppError(404, 'No team member found with this email');
    return member.id;
  }

  async getClientEmails(clientId: string, companyId: string): Promise<{ id: string; sender_email: string; subject: string; received_at: string }[]> {
    await this.getClient(clientId, companyId);
    return [];
  }

  async getClientRisk(clientId: string, companyId: string): Promise<{ status: 'unavailable'; utilization_pct: number | null }> {
    await this.getClient(clientId, companyId);
    return { status: 'unavailable', utilization_pct: null };
  }
}

export const crmService = new CrmService();
