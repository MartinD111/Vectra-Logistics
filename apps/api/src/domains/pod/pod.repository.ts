import { db } from '../../core/db';

export interface PodRequest {
  id: string;
  company_id: string;
  token: string;
  label: string;
  shipment_id: string | null;
  driver_phone: string | null;
  client_id: string | null;
  agreed_rate_eur: number | null;
  status: string; // pending | delivered | expired
  pod_document_id: string | null;
  pod_url: string | null;
  created_by: string | null;
  expires_at: Date;
  delivered_at: Date | null;
  created_at: Date;
}

class PodRepository {
  async list(companyId: string): Promise<PodRequest[]> {
    const { rows } = await db.query<PodRequest>(
      `SELECT * FROM pod_requests WHERE company_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [companyId],
    );
    return rows;
  }

  async findById(id: string, companyId: string): Promise<PodRequest | null> {
    const { rows } = await db.query<PodRequest>(
      `SELECT * FROM pod_requests WHERE id = $1 AND company_id = $2`, [id, companyId],
    );
    return rows[0] ?? null;
  }

  async findByToken(token: string): Promise<PodRequest | null> {
    const { rows } = await db.query<PodRequest>(`SELECT * FROM pod_requests WHERE token = $1`, [token]);
    return rows[0] ?? null;
  }

  async create(input: {
    companyId: string; token: string; label: string; shipmentId: string | null;
    driverPhone: string | null; createdBy: string | null; expiresAt: Date;
    clientId: string | null; agreedRateEur: number | null;
  }): Promise<PodRequest> {
    const { rows } = await db.query<PodRequest>(
      `INSERT INTO pod_requests (company_id, token, label, shipment_id, driver_phone, created_by, expires_at, client_id, agreed_rate_eur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [input.companyId, input.token, input.label, input.shipmentId, input.driverPhone, input.createdBy, input.expiresAt, input.clientId, input.agreedRateEur],
    );
    return rows[0];
  }

  /** Atomically consume a pending token — single-use. Returns null if already used/expired. */
  async markDelivered(id: string, podDocumentId: string, podUrl: string): Promise<PodRequest | null> {
    const { rows } = await db.query<PodRequest>(
      `UPDATE pod_requests
       SET status = 'delivered', pod_document_id = $2, pod_url = $3, delivered_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, podDocumentId, podUrl],
    );
    return rows[0] ?? null;
  }
}

export const podRepository = new PodRepository();
