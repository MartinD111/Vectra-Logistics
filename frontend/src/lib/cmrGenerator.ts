import { jsPDF } from 'jspdf';

export type CargoType = 'general' | 'adr' | 'frigo' | 'high_value' | 'oversized';

export interface GoodsItem {
  id: string;
  marks: string;
  description: string;
  quantity: number;
  unit: string;
  weight: number;
  hsCode: string;
}

export interface TemplateField {
  id: string;
  name: string;
  fieldKey: string;
  x: number; // % of page width
  y: number; // % of page height
  fontSize: number;
  bold?: boolean;
}

export interface CmrData {
  sender: string;
  consignee: string;
  delivery: string;
  loading: string;
  carrier: string;
  instr: string;
  date: string;
  plate?: string;
  cmrId: string;
  cargoType?: CargoType;
  // ADR
  unNumber?: string;
  officialName?: string;
  hazardLabel?: string;
  packingGroup?: string;
  tunnelCode?: string;
  netWeightADR?: string;
  grossWeightADR?: string;
  // Frigo
  temperature?: string;
  coolingInstructions?: string;
  loadingTime?: string;
  unloadingTime?: string;
  // High Value
  declaredValue?: string;
  // Oversized
  dimensions?: { l: string; w: string; h: string };
  permitNumber?: string;
  specialNotes?: string;
}

export interface Settings {
  logo?: string | null;
  sign?: string | null;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  nextCmr: number;
}

// Kept for backwards compatibility
export interface Vehicle {
  vin: string;
  model: string;
  weight: number;
  hs?: string; mrn?: string; diz?: string; vcp?: string;
  damage?: string; plate?: string; effectivePlate?: string;
  _cmrId?: string; selected?: boolean;
}

export const CARGO_TYPE_LABELS: Record<CargoType, string> = {
  general: 'General Cargo',
  adr: 'Dangerous Goods (ADR)',
  frigo: 'Perishable (Frigo/Termo)',
  high_value: 'High Value Cargo',
  oversized: 'Oversized Cargo',
};

export const TEMPLATE_FIELD_KEYS = [
  { key: 'sender', label: 'Sender' },
  { key: 'consignee', label: 'Consignee' },
  { key: 'delivery', label: 'Place of Delivery' },
  { key: 'loading', label: 'Place of Loading' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'date', label: 'Date' },
  { key: 'cmrId', label: 'CMR Number' },
  { key: 'plate', label: 'Vehicle Plate' },
  { key: 'goodsDescription', label: 'Goods Description' },
  { key: 'weight', label: 'Total Weight' },
  { key: 'packages', label: 'Total Packages' },
  { key: 'marks', label: 'Marks' },
  { key: 'hsCode', label: 'HS Code' },
  { key: 'instructions', label: 'Instructions' },
  { key: 'unNumber', label: 'UN Number' },
  { key: 'officialName', label: 'Official Transport Name' },
  { key: 'hazardLabel', label: 'Hazard Label' },
  { key: 'packingGroup', label: 'Packing Group' },
  { key: 'tunnelCode', label: 'Tunnel Code' },
  { key: 'temperature', label: 'Required Temperature' },
  { key: 'coolingInstructions', label: 'Cooling Instructions' },
  { key: 'declaredValue', label: 'Declared Value' },
  { key: 'permitNumber', label: 'Permit Number' },
  { key: 'specialNotes', label: 'Special Notes' },
];

function drawBox(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  label: string, content: string, color: [number, number, number],
  _bold = false, fontSizeOverride = 0
) {
  doc.setDrawColor(...color).setLineWidth(0.3).rect(x, y, w, h);
  doc.setFontSize(7).setTextColor(100).text(label, x + 1, y + 3);
  if (content) {
    doc.setTextColor(0).setFontSize(fontSizeOverride || 9);
    doc.text(doc.splitTextToSize(content, w - 4), x + 2, y + 8);
  }
}

function drawLoadingListPage(
  doc: jsPDF, cmrId: string, goods: GoodsItem[],
  data: CmrData, settings: Settings, currentUser: User | null
) {
  const m = 15, pw = 210, cw = pw - 2 * m;

  doc.setFontSize(11).setTextColor(0)
    .text('LOADING ORDER / CARGO LIST', pw / 2, 12, { align: 'center' });
  doc.setFontSize(8)
    .text(`CMR No: ${cmrId}`, m, 18)
    .text(`Date: ${data.date}`, pw - m, 18, { align: 'right' });
  doc.setFontSize(7).setTextColor(100)
    .text(`Sender: ${(data.sender || '').split('\n')[0]}`, m, 24)
    .text(`Consignee: ${(data.consignee || '').split('\n')[0]}`, m, 28)
    .text(`Place of delivery: ${(data.delivery || '').split('\n')[0]}`, m, 32);

  if (data.cargoType && data.cargoType !== 'general') {
    doc.setFontSize(8).setTextColor(60, 60, 180)
      .text(`Cargo type: ${CARGO_TYPE_LABELS[data.cargoType]}`, m, 37);
  }

  const tableY = 43;
  const rowH = 7;
  doc.setFillColor(225, 235, 255).rect(m, tableY, cw, rowH, 'F');
  doc.setFontSize(8).setTextColor(30);
  doc.text('Marks', m + 2, tableY + 5);
  doc.text('Description', m + 28, tableY + 5);
  doc.text('Qty', m + 100, tableY + 5);
  doc.text('Unit', m + 114, tableY + 5);
  doc.text('HS Code', m + 132, tableY + 5);
  doc.text('Weight kg', pw - m - 2, tableY + 5, { align: 'right' });

  let y = tableY + rowH;
  let totalW = 0, totalQ = 0;

  goods.forEach((item, idx) => {
    if (idx % 2 === 1) doc.setFillColor(250, 252, 255).rect(m, y, cw, rowH, 'F');
    doc.setFontSize(7).setTextColor(0);
    doc.text((item.marks || '-').substring(0, 13), m + 2, y + 5);
    doc.text((item.description || '-').substring(0, 36), m + 28, y + 5);
    doc.text(String(item.quantity || 0), m + 100, y + 5);
    doc.text((item.unit || '-').substring(0, 10), m + 114, y + 5);
    doc.text((item.hsCode || '-').substring(0, 13), m + 132, y + 5);
    doc.text((item.weight || 0).toFixed(1), pw - m - 2, y + 5, { align: 'right' });
    doc.setDrawColor(220, 220, 220).line(m, y + rowH, pw - m, y + rowH);
    totalW += item.weight || 0;
    totalQ += item.quantity || 0;
    y += rowH;
  });

  doc.setFillColor(235, 235, 235).rect(m, y, cw, rowH + 2, 'F');
  doc.setFontSize(8).setTextColor(0);
  doc.text(`TOTAL: ${goods.length} item(s), ${totalQ} packages`, m + 2, y + 6);
  doc.text(totalW.toFixed(1) + ' kg', pw - m - 2, y + 6, { align: 'right' });
  doc.setDrawColor(0).rect(m, tableY, cw, y - tableY + rowH + 2);
  y += rowH + 8;

  if (data.cargoType === 'adr' && data.unNumber) {
    doc.setFontSize(8).setTextColor(200, 0, 0).text(`ADR: ${data.unNumber} ${data.officialName || ''}`, m, y); y += 7;
  }
  if (data.cargoType === 'frigo' && data.temperature) {
    doc.setFontSize(8).setTextColor(0, 80, 200).text(`Temperature: ${data.temperature}`, m, y); y += 7;
  }
  if (data.cargoType === 'oversized' && (data.specialNotes || data.dimensions)) {
    let txt = 'Special: ';
    if (data.dimensions) txt += `${data.dimensions.l}x${data.dimensions.w}x${data.dimensions.h}m `;
    txt += (data.specialNotes || '');
    doc.setFontSize(8).setTextColor(120, 0, 180).text(txt, m, y);
  }

  const yFoot = 280;
  doc.setFontSize(8).setTextColor(0)
    .text(`Prepared by: ${currentUser ? currentUser.name : 'Unknown'}`, m, yFoot);
  if (data.plate) doc.text(`Vehicle plate: ${data.plate}`, m, yFoot + 5);
  if (settings.logo) {
    try { doc.addImage(settings.logo, 'PNG', pw / 2 - 18, yFoot - 25, 36, 18); } catch (e) { console.error(e); }
  }
}

function drawGoodsCMR(
  doc: jsPDF, cmrId: string, goods: GoodsItem[],
  cp: { n: string; c: [number, number, number] },
  data: CmrData, settings: Settings, currentUser: User | null
) {
  const m = 10, pw = 210, ph = 297, cw = (pw - 2 * m) / 2;

  doc.setDrawColor(...cp.c).setLineWidth(0.4).rect(m, m, pw - 2 * m, ph - 2 * m);
  doc.setTextColor(...cp.c).setFontSize(9).text(cp.n, pw - m - 2, m - 3, { align: 'right' });

  // Header
  doc.setTextColor(180, 0, 0).setFontSize(14).text('CMR', m + 10, m + 8);
  doc.setFontSize(9).setTextColor(50).text('INTERNATIONAL CONSIGNMENT NOTE', m + 34, m + 8);
  doc.setTextColor(0).setFontSize(12).text(`No: ${cmrId}`, pw - m - 35, m + 8);

  if (data.cargoType && data.cargoType !== 'general') {
    const badgeColors: Record<string, [number,number,number]> = {
      adr: [200, 20, 20], frigo: [0, 90, 200], oversized: [90, 20, 160], high_value: [210, 150, 0]
    };
    const bc = badgeColors[data.cargoType] || [80,80,80];
    doc.setFontSize(7).setTextColor(...bc)
      .text(`[${CARGO_TYPE_LABELS[data.cargoType].toUpperCase()}]`, pw - m - 35, m + 14);
    doc.setTextColor(0);
  }

  const yS = m + 12;
  if (settings.logo) {
    try { doc.addImage(settings.logo, 'PNG', m + cw + 10, m + 1, 20, 10); } catch (e) { /* noop */ }
  }

  drawBox(doc, m, yS, cw, 20, '1. Sender / Shipper', data.sender || '', cp.c);
  drawBox(doc, m, yS + 20, cw, 25, '2. Consignee', data.consignee, cp.c, true);
  drawBox(doc, m, yS + 45, cw, 30, '3. Place of delivery', data.delivery, cp.c, true, 8);
  drawBox(doc, m, yS + 75, cw, 15, '4. Place and date of loading', `${data.loading} — ${data.date}`, cp.c);

  const adrSummary = data.cargoType === 'adr'
    ? `${data.unNumber || ''} ${data.officialName || ''}\nLabel: ${data.hazardLabel || ''}, PG: ${data.packingGroup || ''}, Tunnel: ${data.tunnelCode || ''}`
    : '';
  const docs5 = data.cargoType === 'adr'
    ? `Loading list\nADR: ${adrSummary}`
    : 'Loading list';
  drawBox(doc, m, yS + 90, cw, 15, '5. Documents attached', docs5, cp.c);

  const carrierTxt = data.plate ? `Plate: ${data.plate}\n${data.carrier}` : data.carrier;
  drawBox(doc, m + cw, yS, cw, 60, '16. Carrier', carrierTxt, cp.c, true, 11);
  drawBox(doc, m + cw, yS + 60, cw, 15, '17. Successive carriers', '', cp.c);
  drawBox(doc, m + cw, yS + 75, cw, 15, "18. Carrier's reservations", '', cp.c);

  let box19 = '';
  if (data.cargoType === 'frigo') {
    if (data.temperature) box19 += `Target Temp: ${data.temperature}\n`;
    if (data.coolingInstructions) box19 += `${data.coolingInstructions}\n`;
    if (data.loadingTime || data.unloadingTime) box19 += `Times: L:${data.loadingTime || '-'} / U:${data.unloadingTime || '-'}`;
  } else if (data.cargoType === 'high_value' && data.declaredValue) {
    box19 = `DECLARED VALUE: ${data.declaredValue}`;
  }
  drawBox(doc, m + cw, yS + 90, cw, 15, '19. Special agreements', box19.trim(), cp.c, false, 7);

  // Goods table
  const hList = 75, yList = yS + 105;
  doc.rect(m, yList, pw - 2 * m, hList);
  doc.setFontSize(7).setTextColor(...cp.c);
  doc.text('6. Marks', m + 2, yList + 3);
  doc.text('7. No.', m + 28, yList + 3);
  doc.text('8. Packing', m + 42, yList + 3);
  doc.text('9. Nature of goods', m + 72, yList + 3);
  doc.text('10. HS Code', m + 128, yList + 3);
  doc.text('11. Gross wt (kg)', pw - m - 30, yList + 3);

  doc.setFontSize(8).setTextColor(0);
  let cy = yList + 8;
  let totalW = 0;
  goods.forEach(item => {
    if (cy > yList + hList - 12) return;
    doc.text((item.marks || '-').substring(0, 11), m + 2, cy);
    doc.text(String(item.quantity || 0), m + 30, cy);
    doc.text((item.unit || '-').substring(0, 12), m + 42, cy);
    doc.text((item.description || '-').substring(0, 28), m + 72, cy);
    doc.text((item.hsCode || '-').substring(0, 12), m + 128, cy);
    doc.text((item.weight || 0).toFixed(1), pw - m - 4, cy, { align: 'right' });
    totalW += item.weight || 0;
    cy += 4;
  });
  const totalQ = goods.reduce((s, g) => s + (g.quantity || 0), 0);
  doc.setFontSize(9).text(
    `Total: ${goods.length} item(s), ${totalQ} packages — ${totalW.toFixed(1)} kg`,
    m + 55, cy + 5
  );

  if (data.cargoType === 'oversized' && (data.specialNotes || data.dimensions) && cy + 10 < yList + hList - 2) {
    let txt = 'Oversized: ';
    if (data.dimensions) txt += `${data.dimensions.l}x${data.dimensions.w}x${data.dimensions.h}m `;
    txt += (data.specialNotes || '');
    doc.setFontSize(7).setTextColor(120, 0, 180).text(txt, m + 2, cy + 10);
    doc.setTextColor(0);
  }

  const yBot = yList + hList;
  let instrTxt = data.instr || '';
  if (data.cargoType === 'adr' && data.unNumber) {
    const adrRow = `ADR: ${data.unNumber} ${data.officialName || ''}, Class ${data.hazardLabel || ''}, PG ${data.packingGroup || ''}, Tunnel ${data.tunnelCode || ''}`;
    const netRow = data.netWeightADR ? `Net ADR Weight: ${data.netWeightADR}` : '';
    const grossRow = data.grossWeightADR ? `Gross ADR Weight: ${data.grossWeightADR}` : '';
    const weightInfo = [netRow, grossRow].filter(Boolean).join(' | ');
    instrTxt = `DANGEROUS GOODS (ADR)\n${adrRow}\n${weightInfo}\n\n${instrTxt}`;
  }
  if (data.cargoType === 'oversized') {
    const perm = data.permitNumber ? `Permit No: ${data.permitNumber}\n` : '';
    const dims = data.dimensions ? `Dimensions: ${data.dimensions.l}x${data.dimensions.w}x${data.dimensions.h}m\n` : '';
    instrTxt = `SPECIAL TRANSPORT:\n${perm}${dims}${data.specialNotes || ''}\n\n${instrTxt}`;
  }
  if (data.cargoType === 'frigo' && (data.loadingTime || data.unloadingTime)) {
    instrTxt = `COLD CHAIN RECORD:\nLoaded at: ${data.loadingTime || '-'}\nUnloaded at: ${data.unloadingTime || '-'}\n\n${instrTxt}`;
  }

  drawBox(doc, m, yBot, cw, 35, "13. Sender's instructions", instrTxt, cp.c, false, 7);
  drawBox(doc, m + cw, yBot, cw / 2, 35, '14. Reimbursements', '', cp.c);
  drawBox(doc, m + cw + cw / 2, yBot, cw / 2, 35, '15. Payment terms', '', cp.c);

  const ySig = yBot + 35;
  drawBox(doc, m, ySig, cw, 15, '21. Established in', `${data.loading || ''}, ${data.date}`, cp.c);
  drawBox(doc, m, ySig + 15, cw, 35, "22. Sender's signature / stamp",
    `${currentUser?.name || ''}\n${(data.sender || '').split('\n')[0]}`, cp.c);
  if (settings.sign) {
    try { doc.addImage(settings.sign, 'PNG', m + 10, ySig + 25, 40, 15); } catch (e) { /* noop */ }
  }
  drawBox(doc, m + cw, ySig, cw / 2, 50, "23. Carrier's signature", '', cp.c);
  doc.setLineWidth(1.2).rect(m + cw, ySig, cw / 2, 50).setLineWidth(0.4);
  drawBox(doc, m + cw + cw / 2, ySig, cw / 2, 50, "24. Receiver's signature", '', cp.c);
}

export const createCmrPdf = async (
  goods: GoodsItem[],
  cmrId: string,
  data: CmrData,
  settings: Settings,
  currentUser: User | null,
  printLoadingList = true,
): Promise<Blob> => {
  const doc = new jsPDF();
  doc.setFont('Helvetica');
  let first = true;

  if (printLoadingList) {
    for (let i = 0; i < 3; i++) {
      if (!first) doc.addPage();
      first = false;
      drawLoadingListPage(doc, cmrId, goods, data, settings, currentUser);
    }
  }

  const copies = [
    { n: '1 (Pošiljatelj - Sender)',         c: [220, 38, 38]  as [number,number,number] },
    { n: '2 (Prejemnik - Consignee)',        c: [37, 99, 235]  as [number,number,number] },
    { n: '3 (Prevoznik - Carrier)',         c: [22, 163, 74]  as [number,number,number] },
    { n: '4 Copy',                          c: [50, 50, 50]   as [number,number,number] },
  ];
  copies.forEach(cp => {
    if (!first) doc.addPage();
    first = false;
    drawGoodsCMR(doc, cmrId, goods, cp, data, settings, currentUser);
  });

  return doc.output('blob');
};

export const createCustomTemplatePdf = async (
  fields: TemplateField[],
  data: CmrData,
  goods: GoodsItem[],
): Promise<Blob> => {
  const doc = new jsPDF();
  doc.setFont('Helvetica');

  const totalW = goods.reduce((s, g) => s + (g.weight || 0), 0);
  const totalQ = goods.reduce((s, g) => s + (g.quantity || 0), 0);

  const vals: Record<string, string> = {
    sender: data.sender,
    consignee: data.consignee,
    delivery: data.delivery,
    loading: data.loading,
    carrier: data.carrier,
    date: data.date,
    cmrId: data.cmrId,
    plate: data.plate || '',
    instructions: data.instr,
    goodsDescription: goods.map(g => g.description).join('\n'),
    weight: totalW.toFixed(1) + ' kg',
    packages: String(totalQ),
    marks: goods.map(g => g.marks).filter(Boolean).join(', '),
    hsCode: goods.map(g => g.hsCode).filter(Boolean).join(', '),
    unNumber: data.unNumber || '',
    officialName: data.officialName || '',
    hazardLabel: data.hazardLabel || '',
    packingGroup: data.packingGroup || '',
    tunnelCode: data.tunnelCode || '',
    temperature: data.temperature || '',
    coolingInstructions: data.coolingInstructions || '',
    declaredValue: data.declaredValue || '',
    permitNumber: data.permitNumber || '',
    specialNotes: data.specialNotes || '',
  };

  const pw = 210, ph = 297;
  fields.forEach(f => {
    const val = vals[f.fieldKey] || '';
    if (!val) return;
    const x = (f.x / 100) * pw;
    const y = (f.y / 100) * ph;
    doc.setFontSize(f.fontSize || 9);
    doc.setTextColor(0);
    doc.setFont('Helvetica', f.bold ? 'bold' : 'normal');
    doc.text(doc.splitTextToSize(val, pw - x - 5), x, y);
  });

  return doc.output('blob');
};

// Legacy export kept for any remaining references
export const createPdfBlob = createCmrPdf as unknown as (...args: unknown[]) => Promise<unknown>;
