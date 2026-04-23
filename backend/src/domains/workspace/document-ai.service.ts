import fs from 'fs';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { AppError } from '../../core/errors/AppError';
import { ParsedRateResponseDto, ParsedRateResponseSchema } from './dto/parse-rate.dto';

// ── Client ────────────────────────────────────────────────────────────────────

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in the environment');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-1.5-flash: native multimodal, handles inline PDF up to 20 MB,
// sub-second TTFT at this payload size — ideal for synchronous extraction.
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    // Deterministic extraction — no creative variation
    temperature: 0,
    // Enough for a compact JSON object; prevents runaway output
    maxOutputTokens: 512,
  },
});

// ── Prompt ────────────────────────────────────────────────────────────────────
// Field list mirrors ParsedRateResponseSchema exactly.
// The "ONLY raw JSON" constraint is the single most important instruction —
// Gemini defaults to markdown fences which will break JSON.parse().

const EXTRACTION_PROMPT = `You are a logistics data extraction engine. Your sole task is to read the attached Rate Confirmation PDF and return a single, raw JSON object.

RULES — you must follow all of them without exception:
1. Return ONLY the JSON object. No markdown, no code fences, no explanation text, no trailing whitespace outside the object.
2. Do not invent data. If a field cannot be found in the document, use null for optional fields or your best inference for required fields — mark confidence lower accordingly.
3. Dates MUST be ISO 8601 format with timezone (e.g. "2024-09-15T08:00:00Z"). If only a date is given with no time, use T00:00:00Z.
4. currency must be a 3-letter ISO 4217 code (e.g. "EUR", "USD", "GBP"). Default to "EUR" if not stated.
5. confidence is YOUR estimate (0.0–1.0) of how accurately you extracted the required fields from this specific document.

REQUIRED JSON STRUCTURE — return exactly these keys, no more, no less:
{
  "pickup_address":   "<full street address of pickup location>",
  "pickup_date":      "<ISO 8601 datetime>",
  "delivery_address": "<full street address of delivery location>",
  "delivery_date":    "<ISO 8601 datetime>",
  "cargo_weight_kg":  <number — total cargo weight in kilograms>,
  "cargo_type":       "<description of goods, e.g. 'Pallets (Euro)', 'Bulk Grain', 'Container'>",
  "rate_amount":      <number — total agreed transport rate>,
  "currency":         "<3-letter ISO 4217 code>",
  "reference_id":     "<shipper or broker reference number, or null if not found>",
  "confidence":       <number between 0.0 and 1.0>
}`;

// ── Service ───────────────────────────────────────────────────────────────────

class DocumentAiService {
  async extractRateConfirmationData(filePath: string): Promise<ParsedRateResponseDto> {
    if (!fs.existsSync(filePath)) {
      throw new AppError(400, `Uploaded file not found at path: ${filePath}`);
    }

    // Read file once — buffer is not retained after this scope
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    const documentPart: Part = {
      inlineData: {
        data: base64,
        mimeType: 'application/pdf',
      },
    };

    // ── Gemini call ───────────────────────────────────────────────────────────

    let rawText: string;

    try {
      const result = await model.generateContent([EXTRACTION_PROMPT, documentPart]);
      rawText = result.response.text().trim();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(502, `Gemini API error: ${message}`);
    }

    // ── JSON parse ────────────────────────────────────────────────────────────
    // Strip markdown fences defensively — Gemini occasionally ignores the
    // plain-text instruction on complex documents.

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new AppError(
        422,
        `Gemini returned a response that could not be parsed as JSON. Raw response: ${cleaned.slice(0, 200)}`,
      );
    }

    // ── Zod validation ────────────────────────────────────────────────────────
    // Guarantees the shape and types before the object leaves this service.

    const validated = ParsedRateResponseSchema.safeParse(parsed);

    if (!validated.success) {
      const issues = validated.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new AppError(422, `Gemini response failed schema validation — ${issues}`);
    }

    return validated.data;
  }
}

export const documentAiService = new DocumentAiService();
