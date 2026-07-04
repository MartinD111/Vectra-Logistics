// Smart Inbox pipeline: raw email → LLM extraction → deterministic validation →
// draft shipment (needs_review | validated), pushed live to the dashboard and
// surfaced in the Drafts kanban. A validated draft can be confirmed by a human
// (→ 'confirmed') or rejected.

import { z } from 'zod';
import { AppError } from '../../core/errors/AppError';
import { emitToRoom } from '../../core/realtime/bus';
import { recordEvent } from '../../core/events/activityLog';
import { notificationsService } from '../notifications/notifications.service';
import { inboxParser } from './inbox.parser';
import { validateExtraction } from './inbox.validator';
import { inboxRepository, ShipmentDraft } from './inbox.repository';

export const ParseEmailSchema = z.object({
  from: z.string().max(200).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().min(1, 'Email body is required').max(20000),
  project_id: z.string().uuid().nullable().optional(),
});

export const UpdateDraftSchema = z.object({
  origin: z.string().max(200).nullable().optional(),
  destination: z.string().max(200).nullable().optional(),
  cargo_type: z.string().max(200).nullable().optional(),
  weight_kg: z.number().int().nullable().optional(),
  pickup_date: z.string().max(40).nullable().optional(),
  delivery_date: z.string().max(40).nullable().optional(),
  wagon_number: z.string().max(60).nullable().optional(),
  reference: z.string().max(80).nullable().optional(),
});

// Synthetic broker / railway emails so the whole pipeline is demoable without a
// connected mailbox. One is intentionally "dirty" (weight over the limit, dates
// reversed) to show the validator rejecting it.
const DEMO_EMAILS = [
  {
    from: 'dispatch@balkanfreight.example',
    subject: 'FTL load Koper → Munich, ready Monday',
    body: 'Hi team,\n\nWe have a full truck load ready: 22 tonnes of palletized machine parts from Koper to Munich. Pickup 2026-08-12, delivery by 2026-08-14. Our reference is BRK-4471.\n\nCan you cover it?\n\nThanks,\nAna',
  },
  {
    from: 'ops@railcargo.example',
    subject: 'Wagon update — Belgrade to Wels',
    body: 'Intermodal update: wagon 33 56 4661 220-1 loaded with 24000 kg steel coils, departing BSJJ (Belgrade Ranžirna) destination Wels Terminal. Loading date 2026-09-01, expected discharge 2026-09-03. Ref RCG-99812.',
  },
  {
    from: 'broker@quickspot.example',
    subject: 'URGENT spot Rijeka to Budapest',
    body: 'Need a truck asap. 18 t reefer food from Rijeka to Budapest. Collect 2026-08-20, deliver 2026-08-22. Order #QS-3310.',
  },
  {
    from: 'broker@sloppy.example',
    subject: 'load',
    body: 'load of 40 tonnes gravel from Atlantis to Munich, pickup 2026-08-30 delivery 2026-08-25',
  },
];

class InboxService {
  demoEmails() {
    return DEMO_EMAILS;
  }

  listDrafts(companyId: string, projectId?: string): Promise<ShipmentDraft[]> {
    return inboxRepository.listDrafts(companyId, projectId);
  }

  /** Parse an email, validate, persist a draft, and push it live. */
  async parseAndCreate(companyId: string, userId: string | null, body: unknown): Promise<{ draft: ShipmentDraft; demo: boolean }> {
    const parsed = ParseEmailSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const { from, subject, body: emailBody, project_id } = parsed.data;

    const { extraction, demo } = await inboxParser.extract(companyId, { subject, body: emailBody });
    const validation = await validateExtraction(extraction);
    const status = validation.ok ? 'validated' : 'needs_review';

    const draft = await inboxRepository.createDraft({
      companyId,
      projectId: project_id ?? null,
      createdBy: userId,
      status,
      origin: extraction.origin ?? null,
      destination: extraction.destination ?? null,
      cargo_type: extraction.cargo_type ?? null,
      weight_kg: extraction.weight_kg ?? null,
      pickup_date: extraction.pickup_date ?? null,
      delivery_date: extraction.delivery_date ?? null,
      wagon_number: extraction.wagon_number ?? null,
      reference: extraction.reference ?? null,
      confidence: extraction.confidence ?? null,
      source: 'inbox',
      source_email: { from: from ?? null, subject: subject ?? null, body: emailBody },
      extracted: extraction as Record<string, unknown>,
      validation: validation as unknown as Record<string, unknown>,
    });

    emitToRoom(`company:${companyId}`, 'draft:new', draft);
    await recordEvent({
      tenantId: companyId, actorId: userId, verb: 'shipment.draft.created',
      objectType: 'shipment_draft', objectId: draft.id, projectId: project_id ?? undefined,
      payload: { origin: draft.origin, destination: draft.destination, status, confidence: draft.confidence },
    });
    if (userId) {
      await notificationsService.create({
        userId, type: 'draft',
        title: 'New draft shipment from inbox',
        body: `${draft.origin ?? '?'} → ${draft.destination ?? '?'}${status === 'needs_review' ? ' (needs review)' : ''}`,
      });
    }

    return { draft, demo };
  }

  /** Human edits to a draft re-run validation and may promote/demote its status. */
  async updateDraft(id: string, companyId: string, body: unknown): Promise<ShipmentDraft> {
    const existing = await inboxRepository.findDraft(id, companyId);
    if (!existing) throw new AppError(404, 'Draft not found');
    const parsed = UpdateDraftSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const merged = { ...existing, ...parsed.data };
    const validation = await validateExtraction({
      origin: merged.origin, destination: merged.destination, cargo_type: merged.cargo_type,
      weight_kg: merged.weight_kg, pickup_date: merged.pickup_date, delivery_date: merged.delivery_date,
      wagon_number: merged.wagon_number, reference: merged.reference, confidence: merged.confidence,
    });
    // Don't silently downgrade a confirmed draft; otherwise track validity.
    const status = existing.status === 'confirmed'
      ? 'confirmed'
      : validation.ok ? 'validated' : 'needs_review';

    const updated = await inboxRepository.updateDraft(id, companyId, {
      ...parsed.data,
      status,
      validation: validation as unknown as Record<string, unknown>,
    });
    if (!updated) throw new AppError(404, 'Draft not found');
    return updated;
  }

  async setStatus(id: string, companyId: string, userId: string | null, status: 'confirmed' | 'rejected'): Promise<ShipmentDraft> {
    const existing = await inboxRepository.findDraft(id, companyId);
    if (!existing) throw new AppError(404, 'Draft not found');
    if (status === 'confirmed') {
      const validation = existing.validation as { ok?: boolean };
      if (validation?.ok === false) throw new AppError(400, 'Cannot confirm a draft with validation errors. Fix them first.');
    }
    const updated = await inboxRepository.updateDraft(id, companyId, { status });
    if (!updated) throw new AppError(404, 'Draft not found');
    emitToRoom(`company:${companyId}`, 'draft:updated', updated);
    await recordEvent({
      tenantId: companyId, actorId: userId, verb: `shipment.draft.${status}`,
      objectType: 'shipment_draft', objectId: id, projectId: existing.project_id ?? undefined,
      payload: { origin: existing.origin, destination: existing.destination },
    });
    return updated;
  }
}

export const inboxService = new InboxService();
