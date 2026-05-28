import fs from 'fs';
import { ParsedRateResponseDto, ParsedRateResponseSchema } from './dto/parse-rate.dto';

// ── Document AI Service ───────────────────────────────────────────────────────
//
// TODO — Production integration (OpenAI Vision / Google Document AI):
//
//   Replace the mock below with the following pattern:
//
//   import OpenAI from 'openai';
//   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//
//   async extractRateConfirmationData(filePath: string) {
//     const base64 = fs.readFileSync(filePath).toString('base64');
//     const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
//
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4o',
//       messages: [{
//         role: 'user',
//         content: [
//           {
//             type: 'image_url',
//             image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
//           },
//           {
//             type: 'text',
//             text: `Extract the following fields from this rate confirmation document as JSON:
//               pickup_address (string), pickup_date (ISO 8601),
//               delivery_address (string), delivery_date (ISO 8601),
//               cargo_weight_kg (number), cargo_type (string),
//               rate_amount (number), currency (3-letter ISO code),
//               reference_id (string or null).
//               Return ONLY valid JSON matching that schema. No markdown fences.`,
//           },
//         ],
//       }],
//       response_format: { type: 'json_object' },
//       max_tokens: 512,
//     });
//
//     const raw = JSON.parse(response.choices[0].message.content ?? '{}');
//     // Run through Zod to guarantee shape before returning to the controller.
//     return ParsedRateResponseSchema.parse(raw);
//   }
//
//   For Google Document AI, replace the OpenAI call with:
//     const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
//     const client = new DocumentProcessorServiceClient();
//     const [result] = await client.processDocument({
//       name: `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`,
//       rawDocument: { content: base64, mimeType },
//     });
//     // then map result.document.entities → ParsedRateResponseSchema

class DocumentAiService {
  async extractRateConfirmationData(filePath: string): Promise<ParsedRateResponseDto> {
    // Verify the file is readable before we simulate — fail fast so the
    // controller can return a meaningful 400 rather than a confusing 500.
    if (!fs.existsSync(filePath)) {
      throw new Error(`Document not found at path: ${filePath}`);
    }

    // Simulate the 2-3 s latency of a real Vision API call.
    await new Promise<void>(resolve =>
      setTimeout(resolve, 2000 + Math.random() * 1000),
    );

    // Realistic mock data representative of a European road freight RC.
    const mock: ParsedRateResponseDto = ParsedRateResponseSchema.parse({
      reference_id:     `LKW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      pickup_address:   'Berliner Allee 42, 10115 Berlin, DE',
      pickup_date:      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      delivery_address: 'Maximilianstraße 12, 80331 Munich, DE',
      delivery_date:    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      cargo_weight_kg:  24500,
      cargo_type:       'Pallets (Euro)',
      rate_amount:      1250.00,
      currency:         'EUR',
      confidence:       0.94,
    });

    return mock;
  }
}

export const documentAiService = new DocumentAiService();
