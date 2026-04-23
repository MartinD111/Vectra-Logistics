import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../../core/db';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignmentContext {
  shipmentId:      string;
  pickupAddress:   string;
  deliveryAddress: string;
  cargoType:       string;
  cargoWeightKg:   number;
  pickupDate:      string;
  deliveryDate:    string;
  driverFirstName: string;
  driverLastName:  string;
  driverPhone:     string | null;
  vehiclePlate:    string;
  clientEmail:     string | null;
  dispatcherEmail: string | null;
  accountingEmail: string | null;
}

export interface AssignmentCommunications {
  whatsapp: {
    phone:    string | null;
    text:     string;
    url:      string | null;
  };
  outlook: {
    to:       string;
    cc:       string;
    subject:  string;
    body:     string;
    mailto:   string;
  };
  aiGenerated: boolean;
}

// ── DB fetchers ───────────────────────────────────────────────────────────────
// These are intentionally raw SQL — the automation service must stay decoupled
// from fleet/marketplace service layers to avoid circular imports.

interface ShipmentRow {
  id: string;
  pickup_address: string;
  delivery_address: string;
  cargo_type: string | null;
  cargo_weight_kg: number | null;
  pickup_window_start: Date | null;
  delivery_deadline: Date | null;
}

interface DriverRow {
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface VehicleRow {
  license_plate: string;
}

interface CompanyMetaRow {
  dispatcher_email: string | null;
  accounting_email: string | null;
  client_email:     string | null;
}

async function fetchAssignmentContext(
  shipmentId: string,
  companyId: string,
): Promise<AssignmentContext | null> {
  // Shipment
  const { rows: sRows } = await db.query<ShipmentRow>(
    `SELECT id, pickup_address, delivery_address, cargo_type,
            cargo_weight_kg, pickup_window_start, delivery_deadline
     FROM shipments WHERE id = $1 LIMIT 1`,
    [shipmentId],
  );
  if (sRows.length === 0) return null;
  const s = sRows[0];

  // Driver assigned to this shipment (via shipment_assignments join)
  const { rows: dRows } = await db.query<DriverRow>(
    `SELECT d.first_name, d.last_name, d.phone
     FROM drivers d
     JOIN shipment_assignments sa ON sa.driver_id = d.id
     WHERE sa.shipment_id = $1
     LIMIT 1`,
    [shipmentId],
  );

  // Vehicle assigned
  const { rows: vRows } = await db.query<VehicleRow>(
    `SELECT v.license_plate
     FROM vehicles v
     JOIN shipment_assignments sa ON sa.vehicle_id = v.id
     WHERE sa.shipment_id = $1
     LIMIT 1`,
    [shipmentId],
  );

  // Company contact metadata (optional columns — graceful fallback)
  let meta: CompanyMetaRow = { dispatcher_email: null, accounting_email: null, client_email: null };
  try {
    const { rows: mRows } = await db.query<CompanyMetaRow>(
      `SELECT dispatcher_email, accounting_email, client_email
       FROM companies WHERE id = $1 LIMIT 1`,
      [companyId],
    );
    if (mRows.length > 0) meta = mRows[0];
  } catch {
    // columns may not exist yet — treat as null
  }

  const driver = dRows[0] ?? { first_name: 'Driver', last_name: '', phone: null };
  const vehicle = vRows[0] ?? { license_plate: 'N/A' };

  return {
    shipmentId:      s.id,
    pickupAddress:   s.pickup_address,
    deliveryAddress: s.delivery_address,
    cargoType:       s.cargo_type ?? 'General cargo',
    cargoWeightKg:   s.cargo_weight_kg ?? 0,
    pickupDate:      s.pickup_window_start
      ? new Date(s.pickup_window_start).toLocaleDateString('en-GB')
      : 'TBD',
    deliveryDate:    s.delivery_deadline
      ? new Date(s.delivery_deadline).toLocaleDateString('en-GB')
      : 'TBD',
    driverFirstName: driver.first_name,
    driverLastName:  driver.last_name,
    driverPhone:     driver.phone,
    vehiclePlate:    vehicle.license_plate,
    clientEmail:     meta.client_email,
    dispatcherEmail: meta.dispatcher_email,
    accountingEmail: meta.accounting_email,
  };
}

// ── City parser ───────────────────────────────────────────────────────────────

function parseCity(address: string): string {
  return address.split(',')[0]?.trim() ?? address;
}

// ── Fallback message generator (used when Gemini is unavailable) ──────────────

function buildFallbackMessages(ctx: AssignmentContext): { whatsappText: string; emailBody: string } {
  const driverName = `${ctx.driverFirstName} ${ctx.driverLastName}`.trim();
  const pickup     = parseCity(ctx.pickupAddress);
  const delivery   = parseCity(ctx.deliveryAddress);

  const whatsappText =
    `Hi ${ctx.driverFirstName}! 👋\n\n` +
    `You have a new assignment:\n` +
    `🚛 Vehicle: ${ctx.vehiclePlate}\n` +
    `📦 Cargo: ${ctx.cargoType} (${ctx.cargoWeightKg.toLocaleString()} kg)\n` +
    `📍 Pickup: ${ctx.pickupAddress}\n` +
    `   Date: ${ctx.pickupDate}\n` +
    `🏁 Delivery: ${ctx.deliveryAddress}\n` +
    `   Deadline: ${ctx.deliveryDate}\n\n` +
    `Please confirm receipt. Safe travels! 🙏`;

  const emailBody =
    `Dear Client,\n\n` +
    `We are pleased to confirm the following transport assignment:\n\n` +
    `Reference:      ${ctx.shipmentId.slice(0, 8).toUpperCase()}\n` +
    `Route:          ${ctx.pickupAddress} → ${ctx.deliveryAddress}\n` +
    `Cargo:          ${ctx.cargoType}, ${ctx.cargoWeightKg.toLocaleString()} kg\n` +
    `Pickup date:    ${ctx.pickupDate}\n` +
    `Delivery date:  ${ctx.deliveryDate}\n` +
    `Driver:         ${driverName}\n` +
    `Vehicle:        ${ctx.vehiclePlate}\n\n` +
    `Please do not hesitate to contact us should you require any further information.\n\n` +
    `Kind regards,\nVECTRA Logistics`;

  return { whatsappText, emailBody };
}

// ── Gemini text generator ─────────────────────────────────────────────────────

async function generateWithGemini(ctx: AssignmentContext): Promise<{ whatsappText: string; emailBody: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt =
      `You are a logistics assistant for VECTRA, a European road freight platform.\n\n` +
      `Generate two professional messages based on this shipment data:\n` +
      `- Driver: ${ctx.driverFirstName} ${ctx.driverLastName}\n` +
      `- Vehicle: ${ctx.vehiclePlate}\n` +
      `- Pickup: ${ctx.pickupAddress} on ${ctx.pickupDate}\n` +
      `- Delivery: ${ctx.deliveryAddress} by ${ctx.deliveryDate}\n` +
      `- Cargo: ${ctx.cargoType}, ${ctx.cargoWeightKg.toLocaleString()} kg\n` +
      `- Reference: ${ctx.shipmentId.slice(0, 8).toUpperCase()}\n\n` +
      `Output ONLY valid JSON with this exact shape (no markdown, no code fences):\n` +
      `{\n` +
      `  "whatsappText": "<informal WhatsApp message to the driver, use first name, emojis OK, max 200 words>",\n` +
      `  "emailBody": "<formal email body to the client, professional tone, no greeting line, max 250 words>"\n` +
      `}`;

    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed  = JSON.parse(cleaned) as { whatsappText?: string; emailBody?: string };

    if (typeof parsed.whatsappText === 'string' && typeof parsed.emailBody === 'string') {
      return { whatsappText: parsed.whatsappText, emailBody: parsed.emailBody };
    }
    return null;
  } catch (err) {
    console.warn('[AutomationService] Gemini generation failed, using fallback:', (err as Error).message);
    return null;
  }
}

// ── Link builders ─────────────────────────────────────────────────────────────

function buildWhatsAppUrl(phone: string | null, text: string): string | null {
  if (!phone) return null;
  // Strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

function buildMailtoUrl(opts: {
  to:      string;
  cc:      string;
  subject: string;
  body:    string;
}): string {
  // mailto bodies need \r\n line endings per RFC 2368
  const encodedBody    = encodeURIComponent(opts.body.replace(/\n/g, '\r\n'));
  const encodedSubject = encodeURIComponent(opts.subject);
  const encodedCc      = encodeURIComponent(opts.cc);

  let mailto = `mailto:${encodeURIComponent(opts.to)}`;
  const params: string[] = [];
  if (opts.cc)      params.push(`cc=${encodedCc}`);
  if (opts.subject) params.push(`subject=${encodedSubject}`);
  if (opts.body)    params.push(`body=${encodedBody}`);
  if (params.length) mailto += `?${params.join('&')}`;
  return mailto;
}

// ── Main service ──────────────────────────────────────────────────────────────

class AutomationService {
  async prepareAssignmentCommunications(
    shipmentId: string,
    companyId: string,
  ): Promise<AssignmentCommunications> {
    const ctx = await fetchAssignmentContext(shipmentId, companyId);

    // Graceful degradation: if context is missing return safe placeholder links
    if (!ctx) {
      console.warn(`[AutomationService] Context not found for shipment ${shipmentId} — returning empty communications`);
      return {
        whatsapp:    { phone: null, text: '', url: null },
        outlook:     { to: '', cc: '', subject: '', body: '', mailto: 'mailto:' },
        aiGenerated: false,
      };
    }

    // Try Gemini first, fall back to deterministic template
    const generated  = await generateWithGemini(ctx);
    const aiGenerated = generated !== null;
    const { whatsappText, emailBody } = generated ?? buildFallbackMessages(ctx);

    // WhatsApp
    const waUrl = buildWhatsAppUrl(ctx.driverPhone, whatsappText);

    // Outlook
    const pickup   = parseCity(ctx.pickupAddress);
    const delivery = parseCity(ctx.deliveryAddress);
    const to       = ctx.clientEmail ?? '';
    const ccParts  = [ctx.dispatcherEmail, ctx.accountingEmail].filter(Boolean) as string[];
    const cc       = ccParts.join(';');
    const subject  = `Transport Confirmation: ${pickup} → ${delivery} | Ref: ${ctx.shipmentId.slice(0, 8).toUpperCase()}`;

    const mailto = buildMailtoUrl({ to, cc, subject, body: emailBody });

    return {
      whatsapp: {
        phone: ctx.driverPhone,
        text:  whatsappText,
        url:   waUrl,
      },
      outlook: {
        to,
        cc,
        subject,
        body: emailBody,
        mailto,
      },
      aiGenerated,
    };
  }

  // ── Future: AI invoice parsing ─────────────────────────────────────────────
  //
  // TODO: Implement Gemini Vision to extract structured invoice data from PDFs.
  //
  //   import { GoogleGenerativeAI } from '@google/generative-ai';
  //
  //   const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  //   const result = await model.generateContent([
  //     {
  //       inlineData: {
  //         mimeType: 'application/pdf',
  //         data: pdfBuffer.toString('base64'),
  //       },
  //     },
  //     `Extract the following fields as JSON: invoice_number, tax_id, total_amount,
  //      currency, vendor_name, invoice_date. Return ONLY valid JSON, no markdown.`,
  //   ]);
  //
  //   Then parse result.response.text() → validate with Zod → store in invoices table.

  async parseInvoiceAI(_pdfBuffer: Buffer): Promise<never> {
    throw new Error('parseInvoiceAI: not yet implemented — see TODO in automation.service.ts');
  }
}

export const automationService = new AutomationService();
