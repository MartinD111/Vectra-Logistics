import { AppError } from '../../core/errors/AppError';
import { crmRepository } from './crm.repository';
import { ClientRecord, ResolvedClientProjectView } from './crm.types';
import { CreateClientSchema } from './dto/create-client.dto';
import { UpdateClientSchema } from './dto/update-client.dto';
import { LinkProjectSchema } from './dto/link-project.dto';

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

  // ── Stubs (later phases implement the real logic) ──
  async importClients(_companyId: string, _body: unknown): Promise<{ created: number; failed: number; errors: string[] }> {
    throw new AppError(501, 'Bulk import not yet implemented — lands in Phase 4');
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
