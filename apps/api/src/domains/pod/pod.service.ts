// Proof-of-delivery pipeline. A dispatcher (or geofence trigger) creates a POD
// request → single-use token → the driver opens /pod/<token>, captures a photo
// and uploads it (public endpoint) → the image is attached as a `documents`
// row and the request flips to 'delivered', broadcast live to the company room.

import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { emitToRoom } from '../../core/realtime/bus';
import { recordEvent } from '../../core/events/activityLog';
import { documentsRepository } from '../documents/documents.repository';
import { invoicingService } from '../billing/invoicing.service';
import { podRepository, PodRequest } from './pod.repository';

const TOKEN_TTL_HOURS = 48;

export const CreatePodSchema = z.object({
  label: z.string().min(1).max(160),
  shipment_id: z.string().uuid().nullable().optional(),
  driver_phone: z.string().max(40).nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  agreed_rate_eur: z.number().min(0).max(1_000_000).nullable().optional(),
});

// Demo deliveries for the "simulate geofence arrival" trigger (no real
// telematics geofencing exists yet — this stands in for it).
const DEMO_DELIVERIES = [
  'Load BRK-4471 · Koper → Munich',
  'Reefer QS-3310 · Rijeka → Budapest',
  'Container MSKU765432 · Trieste → Vienna',
  'Steel coils RCG-99812 · Belgrade → Wels',
];

/** Public shape returned to the (unauthenticated) driver page. */
export interface PodPublicView {
  label: string;
  status: string;
  expired: boolean;
  pod_url: string | null;
}

class PodService {
  list(companyId: string): Promise<PodRequest[]> {
    return podRepository.list(companyId);
  }

  async create(companyId: string, userId: string | null, body: unknown): Promise<PodRequest> {
    const parsed = CreatePodSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    // Credit-limit guardrail (Phase 6): assigning a load to an over-limit
    // client is blocked with 403 before any token is minted.
    if (parsed.data.client_id) {
      const client = await invoicingService.assertCreditOk(
        parsed.data.client_id, companyId,
        parsed.data.agreed_rate_eur ?? 0,
      );
      // When no explicit rate is given, re-check with the client's default so
      // a defaulted rate can't sneak past the limit either.
      if (parsed.data.agreed_rate_eur == null && client.default_rate_eur != null) {
        await invoicingService.assertCreditOk(parsed.data.client_id, companyId, client.default_rate_eur);
      }
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
    const req = await podRepository.create({
      companyId, token, label: parsed.data.label,
      shipmentId: parsed.data.shipment_id ?? null, driverPhone: parsed.data.driver_phone ?? null,
      createdBy: userId, expiresAt,
      clientId: parsed.data.client_id ?? null, agreedRateEur: parsed.data.agreed_rate_eur ?? null,
    });
    emitToRoom(`company:${companyId}`, 'pod:new', req);
    await recordEvent({
      tenantId: companyId, actorId: userId, verb: 'pod.requested',
      objectType: 'pod_request', objectId: req.id, payload: { label: req.label },
    });
    return req;
  }

  /** Geofence-arrival stand-in: auto-create a POD request for a demo delivery. */
  async simulateArrival(companyId: string, userId: string | null): Promise<PodRequest> {
    const label = DEMO_DELIVERIES[Math.floor(Math.random() * DEMO_DELIVERIES.length)];
    return this.create(companyId, userId, { label, driver_phone: '+38640123456' });
  }

  // ── Public (driver) surface ──

  async getPublic(token: string): Promise<PodPublicView> {
    const req = await podRepository.findByToken(token);
    if (!req) throw new AppError(404, 'This delivery link is invalid.');
    const expired = req.status !== 'delivered' && req.expires_at.getTime() < Date.now();
    return { label: req.label, status: req.status, expired, pod_url: req.pod_url };
  }

  /**
   * Attach an uploaded POD photo. Single-use: the token must still be pending
   * and unexpired. Attaches a `documents` row, flips the request to delivered,
   * marks a linked shipment delivered, and broadcasts live.
   */
  async attachPod(token: string, file: { filename: string; originalname: string; mimetype: string; size: number }): Promise<PodRequest> {
    const req = await podRepository.findByToken(token);
    if (!req) throw new AppError(404, 'This delivery link is invalid.');
    if (req.status === 'delivered') throw new AppError(409, 'A proof of delivery has already been uploaded for this link.');
    if (req.expires_at.getTime() < Date.now()) throw new AppError(410, 'This delivery link has expired.');

    const fileUrl = `/uploads/${file.filename}`;
    const doc = await documentsRepository.insert({
      subject: 'shipment',
      subjectId: req.shipment_id,
      documentType: 'pod',
      fileUrl,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      issuedAt: new Date().toISOString().slice(0, 10),
      expiresAt: null,
      uploadedBy: req.created_by ?? await this.anyCompanyUser(req.company_id),
      companyId: req.company_id,
    });

    const delivered = await podRepository.markDelivered(req.id, doc.id, fileUrl);
    if (!delivered) throw new AppError(409, 'A proof of delivery has already been uploaded for this link.');

    // Flip a linked shipment to delivered (best-effort; enum has 'delivered').
    if (req.shipment_id) {
      await db.query(`UPDATE shipments SET status = 'delivered', updated_at = NOW() WHERE id = $1`, [req.shipment_id])
        .catch(() => { /* shipment may not exist for demo POD requests */ });
      emitToRoom(`shipment:${req.shipment_id}`, 'shipment:status', { shipment_id: req.shipment_id, status: 'delivered', changed_at: new Date().toISOString() });
    }

    emitToRoom(`company:${req.company_id}`, 'pod:delivered', delivered);
    await recordEvent({
      tenantId: req.company_id, verb: 'pod.delivered',
      objectType: 'pod_request', objectId: req.id, payload: { label: req.label, url: fileUrl },
    });

    // Phase 6 trigger: delivery confirmed → auto-draft the invoice (agreed
    // rate + Smart-VAT matrix + POD attached), pushed to the dashboard for
    // approval. Best-effort — never fails the driver's upload.
    if (req.client_id) {
      await invoicingService.autoDraftInvoice({
        companyId: req.company_id, clientId: req.client_id, podRequestId: req.id,
        label: req.label,
        agreedRateEur: req.agreed_rate_eur == null ? null : Number(req.agreed_rate_eur),
        podUrl: fileUrl,
      });
    }
    return delivered;
  }

  /** documents.uploaded_by is NOT NULL; fall back to any company user for driver uploads. */
  private async anyCompanyUser(companyId: string): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1`, [companyId],
    );
    if (!rows[0]) throw new AppError(500, 'No user to attribute the upload to.');
    return rows[0].id;
  }
}

export const podService = new PodService();
