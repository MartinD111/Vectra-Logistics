// Smart Inbox extraction: turn a raw broker email / railway agency update into
// a structured freight payload. Uses the company's cloud LLM (JSON mode) with a
// strict few-shot system prompt; falls back to a deterministic regex extractor
// when no cloud provider is configured, so the inbox works out of the box (same
// stance as the AI translate demo fallback).

import { z } from 'zod';
import { aiService } from '../ai/ai.service';

// The shape the model must return. Everything is nullable — the validator and
// the human reviewer handle gaps; we never fail extraction on a missing field.
export const ExtractionSchema = z.object({
  origin: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
  cargo_type: z.string().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  pickup_date: z.string().nullable().optional(),   // ISO date (YYYY-MM-DD)
  delivery_date: z.string().nullable().optional(),
  wagon_number: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM_PROMPT = `You are a logistics data-extraction engine for a freight dispatcher. You receive the raw text of a broker email or railway agency update and extract a single FTL/intermodal load into JSON.

Extract EXACTLY these fields (use null when a field is absent — never invent values):
- origin: pickup city/terminal/station name or code (e.g. "Koper", "BSJJ")
- destination: delivery city/terminal/station name or code
- cargo_type: what is being shipped (e.g. "steel coils", "palletized goods", "reefer food")
- weight_kg: gross weight in kilograms as a number (convert tonnes → kg: 24 t = 24000)
- pickup_date: ISO date YYYY-MM-DD
- delivery_date: ISO date YYYY-MM-DD
- wagon_number: railway wagon number if present (e.g. "33 56 4661 220-1"), else null
- reference: booking / order / reference number if present
- confidence: your confidence 0.0–1.0 that this is a valid, complete load

Respond with ONLY a JSON object of these fields. No prose.

Example input:
"Hi, we have a load ready. 22 tonnes of palletized machine parts from Koper to Munich. Pickup 2026-08-12, delivery by 2026-08-14. Ref BRK-4471."
Example output:
{"origin":"Koper","destination":"Munich","cargo_type":"palletized machine parts","weight_kg":22000,"pickup_date":"2026-08-12","delivery_date":"2026-08-14","wagon_number":null,"reference":"BRK-4471","confidence":0.9}`;

class InboxParser {
  /** Extract via the company LLM, or a deterministic fallback in demo mode. */
  async extract(companyId: string, email: { subject?: string; body: string }): Promise<{ extraction: Extraction; demo: boolean }> {
    const usable = (await aiService.hasCloudProvider(companyId)) || (await aiService.hasUsableProvider(companyId));
    if (!usable) {
      return { extraction: this.demoExtract(email), demo: true };
    }
    const text = `${email.subject ? `Subject: ${email.subject}\n` : ''}${email.body}`;
    let completion;
    try {
      completion = await aiService.complete(companyId, {
        system: SYSTEM_PROMPT,
        prompt: text,
        json: true,
        maxTokens: 500,
      });
    } catch {
      // Local completion failed (timeout, connection refused, bad response) —
      // degrade the same way a non-JSON model response degrades. Never surfaces
      // a hard error to the dispatcher (D-01 corollary).
      return { extraction: this.demoExtract(email), demo: false };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(completion.text);
    } catch {
      // Model returned non-JSON — degrade to the deterministic extractor rather
      // than throwing into the dispatcher's inbox.
      return { extraction: this.demoExtract(email), demo: false };
    }
    const parsed = ExtractionSchema.safeParse(raw);
    return { extraction: parsed.success ? parsed.data : this.demoExtract(email), demo: false };
  }

  /**
   * Deterministic best-effort extraction (no LLM). Handles the common broker
   * phrasings well enough to demo the whole pipeline; the human reviewer fixes
   * the rest. Intentionally conservative — returns null on anything unclear.
   */
  private demoExtract(email: { subject?: string; body: string }): Extraction {
    const text = `${email.subject ?? ''}\n${email.body}`;
    const flat = text.replace(/\s+/g, ' ');

    // "from X to Y" / "X -> Y" / "X → Y"
    let origin: string | null = null;
    let destination: string | null = null;
    const fromTo = flat.match(/from\s+([A-Za-zÀ-ž .'-]{2,40}?)\s+to\s+([A-Za-zÀ-ž .'-]{2,40}?)(?:[,.;]|\s+(?:on|by|pickup|delivery|ref|for)\b|$)/i);
    if (fromTo) { origin = clean(fromTo[1]); destination = clean(fromTo[2]); }
    else {
      const arrow = flat.match(/([A-Za-zÀ-ž .'-]{2,40}?)\s*(?:->|→|—>|-)\s*([A-Za-zÀ-ž .'-]{2,40})/);
      if (arrow) { origin = clean(arrow[1]); destination = clean(arrow[2]); }
    }

    // Weight: "22 t", "22 tonnes", "24000 kg", "24,000 kg"
    let weightKg: number | null = null;
    const kg = flat.match(/([\d.,]+)\s*(?:kg|kilograms?)\b/i);
    const tonnes = flat.match(/([\d.,]+)\s*(?:t|tonnes?|tons?)\b/i);
    if (kg) weightKg = Math.round(num(kg[1]));
    else if (tonnes) weightKg = Math.round(num(tonnes[1]) * 1000);

    // Dates: ISO first, then DD.MM.YYYY / DD/MM/YYYY
    const dates = collectDates(flat);
    const pickupDate = dates[0] ?? null;
    const deliveryDate = dates[1] ?? null;

    // Wagon number: "33 56 4661 220-1"
    const wagon = flat.match(/\b\d{2}\s?\d{2}\s?\d{4}\s?\d{3}-\d\b/);

    // Reference: "Ref BRK-4471", "reference is 12345", "order #A123". Real
    // references contain a digit — anchoring on one avoids capturing the label
    // word itself (e.g. the "erence" of "reference").
    const ref = flat.match(/(?:ref(?:erence)?|order|booking)\b[\s:#]*(?:is\s+|no\.?\s*)?([A-Z]{0,5}-?\d[A-Z0-9-]*)/i);

    // Cargo: "N tonnes of <cargo> from" or "load of <cargo>"
    let cargoType: string | null = null;
    const cargo = flat.match(/(?:of|carrying|load(?:ing)?)\s+([a-zà-ž][a-zà-ž ]{3,40}?)\s+(?:from|,|ready|for)\b/i);
    if (cargo) cargoType = clean(cargo[1]);

    const fields = [origin, destination, weightKg, pickupDate, deliveryDate].filter((v) => v != null).length;
    return {
      origin, destination, cargo_type: cargoType, weight_kg: weightKg,
      pickup_date: pickupDate, delivery_date: deliveryDate,
      wagon_number: wagon ? wagon[0].replace(/\s+/g, ' ').trim() : null,
      reference: ref ? ref[1] : null,
      confidence: Math.min(0.85, 0.3 + fields * 0.12),
    };
  }
}

function clean(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/[.,;]$/, '');
}

/**
 * Parse a numeric token allowing European/US thousands separators. A separator
 * followed by exactly 3 digits (e.g. "24,000" / "24.000") is treated as a
 * thousands group; otherwise it's a decimal point ("22.5").
 */
function num(s: string): number {
  const grouped = /^[\d]{1,3}([.,]\d{3})+$/.test(s.trim());
  if (grouped) return parseFloat(s.replace(/[.,]/g, '')) || 0;
  return parseFloat(s.replace(',', '.')) || 0;
}

/** Collect up to two dates in document order, normalised to YYYY-MM-DD. */
function collectDates(text: string): string[] {
  const out: string[] = [];
  const re = /\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 2) {
    if (m[1]) out.push(`${m[1]}-${m[2]}-${m[3]}`);
    else out.push(`${m[6]}-${String(m[5]).padStart(2, '0')}-${String(m[4]).padStart(2, '0')}`);
  }
  return out;
}

export const inboxParser = new InboxParser();
