import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quote, Settings } from '@/domain/types';
import { buildDocument } from './document';
import { decimal, money } from '@/domain/format';

const INK: [number, number, number] = [28, 28, 32];
const MUTED: [number, number, number] = [112, 112, 120];
const LINE: [number, number, number] = [226, 226, 230];
const ACCENT: [number, number, number] = [200, 97, 26];
const SOFT: [number, number, number] = [247, 246, 244];

/** Helvetica estándar de jsPDF solo cubre Latin-1: reemplaza símbolos fuera de ese rango. */
const safe = (t: string) =>
  (t || '')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[•·]/g, '·')
    .replace(/[^\x00-\xFF]/g, '');

export function generateQuotePdf(q: Quote, s: Settings): jsPDF {
  const doc = buildDocument(q, s);
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  // ---- Encabezado ----
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 0, W, 5, 'F');

  let textX = M;
  if (doc.shop.logo) {
    try {
      const props = pdf.getImageProperties(doc.shop.logo);
      const ratio = props.width / props.height;
      let h = 52;
      let w = h * ratio;
      if (w > 130) {
        w = 130;
        h = w / ratio;
      }
      pdf.addImage(doc.shop.logo, 'PNG', M, y - 4, w, h);
      textX = M + w + 14;
    } catch {
      /* logo inválido: se omite */
    }
  }
  pdf.setTextColor(...INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(safe(doc.shop.name), textX, y + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  const contact = [doc.shop.owner, doc.shop.phone && `Tel. ${doc.shop.phone}`, doc.shop.email, doc.shop.rfc && `RFC ${doc.shop.rfc}`]
    .filter(Boolean)
    .join('   ');
  if (contact) pdf.text(safe(contact), textX, y + 27);
  if (doc.shop.address) pdf.text(pdf.splitTextToSize(safe(doc.shop.address), 260), textX, y + 39);

  // Bloque derecho: folio
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...ACCENT);
  pdf.text('C O T I Z A C I Ó N', W - M, y + 4, { align: 'right' });
  pdf.setTextColor(...INK);
  pdf.setFontSize(15);
  pdf.text(safe(doc.number), W - M, y + 22, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text(`Fecha: ${safe(doc.date)}`, W - M, y + 36, { align: 'right' });
  pdf.text(`Vigente hasta: ${safe(doc.validUntil)}`, W - M, y + 48, { align: 'right' });

  y += 72;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.8);
  pdf.line(M, y, W - M, y);
  y += 22;

  // ---- Cliente / Trabajo ----
  const colW = (W - M * 2 - 24) / 2;
  const label = (t: string, x: number, yy: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(t.toUpperCase(), x, yy, { charSpace: 1 });
  };
  label('Cliente', M, y);
  label('Trabajo', M + colW + 24, y);
  pdf.setTextColor(...INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(safe(doc.client.name), colW), M, y + 16);
  const titleLines = pdf.splitTextToSize(safe(doc.job.title), colW);
  pdf.text(titleLines, M + colW + 24, y + 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  if (doc.client.phone) pdf.text(`Tel. ${safe(doc.client.phone)}`, M, y + 31);
  let jy = y + 16 + titleLines.length * 13 + 2;
  pdf.text(safe(doc.job.type), M + colW + 24, jy);
  if (doc.job.dims) {
    jy += 12;
    pdf.text(safe(doc.job.dims), M + colW + 24, jy);
  }
  if (doc.job.qty > 1) {
    jy += 12;
    pdf.text(`Cantidad: ${doc.job.qty} piezas`, M + colW + 24, jy);
  }
  y = Math.max(y + 40, jy + 10) + 8;

  if (doc.job.description) {
    label('Descripción', M, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    const lines = pdf.splitTextToSize(safe(doc.job.description), W - M * 2);
    pdf.text(lines, M, y + 15, { lineHeightFactor: 1.4 });
    y += 15 + lines.length * 13.3 + 10;
  }

  // ---- Materiales ----
  const head = { fillColor: SOFT, textColor: MUTED, fontStyle: 'bold' as const, fontSize: 7.5, cellPadding: { top: 7, bottom: 7, left: 8, right: 8 } };
  if (doc.items.length) {
    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M },
      head: [['MATERIALES Y CONSUMIBLES', 'CANTIDAD', 'UNIDAD']],
      body: doc.items.map((i) => [safe(i.name), decimal(i.qty), safe(i.unit)]),
      theme: 'plain',
      headStyles: head,
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }, lineColor: LINE },
      columnStyles: { 1: { halign: 'right', cellWidth: 70 }, 2: { cellWidth: 60 } },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          pdf.setDrawColor(...LINE);
          pdf.setLineWidth(0.5);
          pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  if (doc.services.length) {
    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M },
      head: [['SERVICIOS INCLUIDOS']],
      body: doc.services.map((sv) => [safe(sv)]),
      theme: 'plain',
      headStyles: head,
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 } },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          pdf.setDrawColor(...LINE);
          pdf.setLineWidth(0.5);
          pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // ---- Totales ----
  const rows: [string, string, boolean][] = [];
  if (doc.unitPrice) rows.push([`Precio por pieza (${doc.job.qty} pzas)`, money(doc.unitPrice), false]);
  if (doc.totals.tax) {
    rows.push(['Subtotal', doc.totals.subtotal, false]);
    rows.push([doc.totals.taxLabel, doc.totals.tax, false]);
  }
  const boxH = 22 + rows.length * 16 + 34;
  if (y + boxH > H - 150) {
    pdf.addPage();
    y = M;
  }
  const bx = W - M - 250;
  pdf.setFillColor(...SOFT);
  pdf.roundedRect(bx, y, 250, boxH, 4, 4, 'F');
  let ty = y + 22;
  pdf.setFontSize(9);
  for (const [k, v] of rows) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...MUTED);
    pdf.text(safe(k), bx + 14, ty);
    pdf.setTextColor(...INK);
    pdf.text(safe(v), W - M - 14, ty, { align: 'right' });
    ty += 16;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...ACCENT);
  pdf.text(doc.totals.tax ? 'TOTAL CON IVA' : 'TOTAL', bx + 14, ty + 8, { charSpace: 1 });
  pdf.setTextColor(...INK);
  pdf.setFontSize(17);
  pdf.text(safe(doc.totals.total), W - M - 14, ty + 10, { align: 'right' });
  if (!doc.totals.tax) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text('Precio en pesos mexicanos (MXN)', bx + 14, y - 8 + boxH + 18);
  }

  // ---- Condiciones (columna izquierda) ----
  const cx = M;
  const cw = W - M * 2 - 250 - 24;
  let cy = y + 6;
  const cond = (title: string, text: string) => {
    if (!text) return;
    label(title, cx, cy);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    const lines = pdf.splitTextToSize(safe(text), cw);
    pdf.text(lines, cx, cy + 13, { lineHeightFactor: 1.35 });
    cy += 13 + lines.length * 12.2 + 10;
  };
  cond('Tiempo de entrega', doc.deliveryTime);
  cond('Condiciones de pago', doc.paymentTerms);
  cond('Vigencia', `${doc.validityDays} días (hasta el ${doc.validUntil})`);
  y = Math.max(cy, y + boxH + 24);

  if (doc.notes) {
    if (y > H - 120) {
      pdf.addPage();
      y = M;
    }
    label('Notas', M, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    const lines = pdf.splitTextToSize(safe(doc.notes), W - M * 2);
    pdf.text(lines, M, y + 13, { lineHeightFactor: 1.35 });
    y += 13 + lines.length * 12.2 + 10;
  }

  // Firma
  if (y < H - 140) {
    const sy = H - 120;
    pdf.setDrawColor(...LINE);
    pdf.line(M, sy, M + 180, sy);
    pdf.line(W - M - 180, sy, W - M, sy);
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text('Acepto la cotización (cliente)', M, sy + 12);
    pdf.text(safe(doc.shop.name), W - M, sy + 12, { align: 'right' });
  }

  // ---- Pie en todas las páginas ----
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE);
    pdf.line(M, H - 52, W - M, H - 52);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    if (doc.shop.footer) pdf.text(pdf.splitTextToSize(safe(doc.shop.footer), W - M * 2 - 80), M, H - 38);
    pdf.text(`${safe(doc.number)}  ·  ${i}/${pages}`, W - M, H - 38, { align: 'right' });
  }
  return pdf;
}

export const pdfFileName = (q: Quote) =>
  `${q.number || 'cotizacion'}-${(q.clientName || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.pdf`;
