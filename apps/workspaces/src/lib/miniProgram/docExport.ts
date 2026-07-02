// Turning a filled HTML template into deliverables: an .eml Outlook draft, a
// print dialog, or a PDF. Client-only (touches window / DOM). HTML passed here
// must already be sanitised by the caller (see DOMPurify usage in BlockView).

/** Build an Outlook-openable draft. `X-Unsent: 1` makes Outlook open it as a draft. */
export function emlBlob(html: string, headers: { to?: string; cc?: string; subject?: string }): Blob {
  const lines: string[] = [];
  if (headers.to) lines.push(`To: ${headers.to}`);
  if (headers.cc) lines.push(`Cc: ${headers.cc}`);
  if (headers.subject) lines.push(`Subject: ${headers.subject}`);
  lines.push('X-Unsent: 1');
  lines.push('Content-Type: text/html; charset=utf-8');
  lines.push('');
  lines.push(`<html><body>${html}</body></html>`);
  return new Blob([lines.join('\r\n')], { type: 'message/rfc822' });
}

/** Open a print dialog with the given HTML in an isolated window. */
export function printHtml(html: string, title = 'Document'): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><title>${title}</title>` +
    `<meta charset="utf-8"><style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#111}</style>` +
    `</head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.setTimeout(() => w.print(), 250);
}

/** Render HTML to a PDF blob via html2canvas + jsPDF (both already installed). */
export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;padding:32px;background:#fff;font-family:Inter,Arial,sans-serif;color:#111';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const imgH = (canvas.height * pageW) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, pageW, imgH);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(holder);
  }
}
