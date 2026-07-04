// Omni-Document Engine — intermodal freight documents, generalising the CMR
// generator's jsPDF box-drawing approach (apps/cmr/src/lib/cmrGenerator.ts) to
// rail consignment and irregularity notes:
//   CIM  — Rail consignment note (COTIF/CIM)
//   CUV  — Wagon note (contract of use of wagons)
//   CIT7 — Commercial irregularity report
//   CIT20 — Delivery record / handover note
//   PORT_LOADING — dynamic port loading / sequence list (table)
//
// Each doc is a set of numbered boxes (mirroring the CMR layout) drawn with the
// same `drawBox` primitive, plus an optional goods/sequence table. Runs
// client-side and returns a Blob, same as createCmrPdf.

import { jsPDF } from 'jspdf';

export type OmniDocType = 'CIM' | 'CUV' | 'CIT7' | 'CIT20' | 'PORT_LOADING';

export interface OmniDocData {
  reference: string;
  date: string;
  sender?: string;
  consignee?: string;
  carrier?: string;
  origin?: string;
  destination?: string;
  wagonNumber?: string;
  cargo?: string;
  weightKg?: number;
  notes?: string;
  /** For PORT_LOADING and goods tables. */
  items?: { position: string; wagon: string; cargo: string; weightKg: number }[];
}

export const OMNI_DOC_META: Record<OmniDocType, { title: string; subtitle: string; accent: [number, number, number] }> = {
  CIM: { title: 'CIM', subtitle: 'Rail Consignment Note (COTIF/CIM)', accent: [37, 99, 235] },
  CUV: { title: 'CUV', subtitle: 'Wagon Note — Contract of Use', accent: [16, 185, 129] },
  CIT7: { title: 'CIT7', subtitle: 'Commercial Irregularity Report', accent: [220, 38, 38] },
  CIT20: { title: 'CIT20', subtitle: 'Delivery Record / Handover Note', accent: [139, 92, 246] },
  PORT_LOADING: { title: 'Port Loading List', subtitle: 'Loading / Sequence List', accent: [234, 88, 12] },
};

const PW = 210, PH = 297, M = 12;

/** The reusable numbered-box primitive (mirrors cmrGenerator.drawBox). */
function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, content: string, color: [number, number, number]) {
  doc.setDrawColor(...color).setLineWidth(0.3).rect(x, y, w, h);
  doc.setFontSize(7).setTextColor(120).text(label, x + 1.5, y + 4);
  if (content) {
    doc.setTextColor(0).setFontSize(9);
    doc.text(doc.splitTextToSize(content, w - 4), x + 2, y + 10);
  }
}

function header(doc: jsPDF, type: OmniDocType, data: OmniDocData) {
  const meta = OMNI_DOC_META[type];
  doc.setFillColor(...meta.accent).rect(0, 0, PW, 22, 'F');
  doc.setTextColor(255).setFontSize(18).setFont('helvetica', 'bold').text(meta.title, M, 12);
  doc.setFontSize(9).setFont('helvetica', 'normal').text(meta.subtitle, M, 18);
  doc.setFontSize(9).text(`Ref: ${data.reference}`, PW - M, 10, { align: 'right' });
  doc.text(`Date: ${data.date}`, PW - M, 16, { align: 'right' });
  doc.setTextColor(0);
}

/** Two-column box grid used by CIM/CUV/CIT20. */
function partyGrid(doc: jsPDF, type: OmniDocType, data: OmniDocData, startY: number): number {
  const meta = OMNI_DOC_META[type];
  const colW = (PW - M * 2 - 4) / 2;
  let y = startY;
  const rowH = 26;
  drawBox(doc, M, y, colW, rowH, '1 · Consignor (sender)', data.sender ?? '—', meta.accent);
  drawBox(doc, M + colW + 4, y, colW, rowH, '2 · Consignee', data.consignee ?? '—', meta.accent);
  y += rowH + 3;
  drawBox(doc, M, y, colW, rowH, '3 · Station of departure', data.origin ?? '—', meta.accent);
  drawBox(doc, M + colW + 4, y, colW, rowH, '4 · Station of destination', data.destination ?? '—', meta.accent);
  y += rowH + 3;
  drawBox(doc, M, y, colW, rowH, '5 · Carrier / RU', data.carrier ?? '—', meta.accent);
  drawBox(doc, M + colW + 4, y, colW, rowH, '6 · Wagon number', data.wagonNumber ?? '—', meta.accent);
  y += rowH + 3;
  return y;
}

function goodsTable(doc: jsPDF, type: OmniDocType, data: OmniDocData, startY: number): number {
  const meta = OMNI_DOC_META[type];
  let y = startY;
  const w = PW - M * 2;
  doc.setFillColor(...meta.accent).rect(M, y, w, 8, 'F');
  doc.setTextColor(255).setFontSize(8).setFont('helvetica', 'bold');
  doc.text('Pos', M + 2, y + 5.5);
  doc.text('Wagon', M + 20, y + 5.5);
  doc.text('Cargo / description', M + 70, y + 5.5);
  doc.text('Weight (kg)', PW - M - 2, y + 5.5, { align: 'right' });
  doc.setTextColor(0).setFont('helvetica', 'normal');
  y += 8;
  const items = data.items ?? [];
  let total = 0;
  for (const it of items) {
    doc.setDrawColor(220).setLineWidth(0.2).line(M, y + 6.5, PW - M, y + 6.5);
    doc.setFontSize(8);
    doc.text(String(it.position), M + 2, y + 5);
    doc.text((it.wagon || '—').slice(0, 22), M + 20, y + 5);
    doc.text((it.cargo || '—').slice(0, 40), M + 70, y + 5);
    doc.text((it.weightKg || 0).toLocaleString(), PW - M - 2, y + 5, { align: 'right' });
    total += it.weightKg || 0;
    y += 6.5;
  }
  doc.setDrawColor(...meta.accent).setLineWidth(0.4).rect(M, startY + 8, w, y - startY - 8);
  y += 4;
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text(`TOTAL: ${items.length} position(s)`, M + 2, y);
  doc.text(`${total.toLocaleString()} kg`, PW - M - 2, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

function signatures(doc: jsPDF, type: OmniDocType, y: number) {
  const meta = OMNI_DOC_META[type];
  const colW = (PW - M * 2 - 4) / 2;
  drawBox(doc, M, y, colW, 24, 'Consignor / handover signature', '', meta.accent);
  drawBox(doc, M + colW + 4, y, colW, 24, 'Carrier / receiving signature', '', meta.accent);
}

export function createOmniDoc(type: OmniDocType, data: OmniDocData): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  header(doc, type, data);
  let y = 28;

  if (type === 'PORT_LOADING') {
    drawBox(doc, M, y, PW - M * 2, 20, 'Terminal / vessel', `${data.origin ?? '—'}  →  ${data.destination ?? '—'}`, OMNI_DOC_META[type].accent);
    y += 24;
    y = goodsTable(doc, type, data, y);
    if (data.notes) { doc.setFontSize(8).setTextColor(80).text(doc.splitTextToSize(`Notes: ${data.notes}`, PW - M * 2), M, y + 4); }
    return doc.output('blob');
  }

  if (type === 'CIT7') {
    // Irregularity report: parties + a large findings box.
    y = partyGrid(doc, type, data, y);
    drawBox(doc, M, y, PW - M * 2, 20, '7 · Goods concerned', `${data.cargo ?? '—'}${data.weightKg ? ` · ${data.weightKg.toLocaleString()} kg` : ''}`, OMNI_DOC_META[type].accent);
    y += 24;
    drawBox(doc, M, y, PW - M * 2, 55, '8 · Description of irregularity / damage', data.notes ?? '—', OMNI_DOC_META[type].accent);
    y += 60;
    signatures(doc, type, y);
    return doc.output('blob');
  }

  // CIM / CUV / CIT20 — party grid + goods + notes + signatures.
  y = partyGrid(doc, type, data, y);
  if (data.items && data.items.length > 0) {
    y = goodsTable(doc, type, data, y);
  } else {
    drawBox(doc, M, y, PW - M * 2, 22, '7 · Description of goods', `${data.cargo ?? '—'}${data.weightKg ? ` · ${data.weightKg.toLocaleString()} kg` : ''}`, OMNI_DOC_META[type].accent);
    y += 26;
  }
  if (data.notes) {
    drawBox(doc, M, y, PW - M * 2, 26, '8 · Special agreements / declarations', data.notes, OMNI_DOC_META[type].accent);
    y += 30;
  }
  signatures(doc, type, Math.min(y, PH - 40));
  return doc.output('blob');
}
