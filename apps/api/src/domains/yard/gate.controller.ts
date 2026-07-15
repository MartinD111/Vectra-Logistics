// Edge-AI gate webhooks. Physical gate cameras POST ANPR (plate) and OCR
// (container number) reads here; each read auto-checks-in the asset and assigns
// it to a free yard slot. Public (no session) — a real deployment would carry a
// signed gate token; here the payload names the company (documented as such).

import { Request, Response } from 'express';
import { z } from 'zod';
import { yardService } from './yard.service';
import { verifyTrustedPublicRequest } from '../integrations/webhook.service';

const AnprSchema = z.object({
  plate: z.string().min(2).max(32),
  gate: z.string().max(40).optional(),
  label: z.string().max(80).optional(),
});

const OcrSchema = z.object({
  container_number: z.string().min(2).max(32),
  gate: z.string().max(40).optional(),
  label: z.string().max(80).optional(),
});

/** POST /api/webhooks/anpr — number-plate read from a gate camera. */
export async function anprWebhook(req: Request, res: Response): Promise<void> {
  const parsed = AnprSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const trust = verifyTrustedPublicRequest({
    edge: 'gate-anpr',
    gateToken: req.headers['x-gate-token'] as string | undefined,
  })!;
  const { plate, gate, label } = parsed.data;
  try {
    const result = await yardService.gateCheckIn(trust.companyId, {
      kind: 'truck', identifier: plate, label, source: 'gate_anpr', gate: gate ?? trust.gate ?? undefined,
    });
    res.status(200).json({
      ok: true, asset_id: result.asset.id,
      assigned_slot: result.assignedSlot?.label ?? null,
    });
  } catch {
    // Acknowledge so the camera doesn't retry-storm; log server-side.
    res.status(200).json({ ok: false });
  }
}

/** POST /api/webhooks/ocr — container-number read from a gate camera. */
export async function ocrWebhook(req: Request, res: Response): Promise<void> {
  const parsed = OcrSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const trust = verifyTrustedPublicRequest({
    edge: 'gate-ocr',
    gateToken: req.headers['x-gate-token'] as string | undefined,
  })!;
  const { container_number, gate, label } = parsed.data;
  try {
    const result = await yardService.gateCheckIn(trust.companyId, {
      kind: 'container', identifier: container_number, label, source: 'gate_ocr', gate: gate ?? trust.gate ?? undefined,
    });
    res.status(200).json({
      ok: true, asset_id: result.asset.id,
      assigned_slot: result.assignedSlot?.label ?? null,
    });
  } catch {
    res.status(200).json({ ok: false });
  }
}
