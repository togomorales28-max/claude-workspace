import type { jsPDF as JsPDF } from 'jspdf';
import type { Client, CutPlan, Quote, Settings } from '../data/types';
import { allocateSale, computeBudget, EXPENSE_CATEGORIES } from '../domain/budget';
import { groupMoney, runGroup } from './cutPlan';
import { addDays, dateMx, fixed, kg, money, num, pct } from './format';
import { PIECE_COLORS } from '../components/BarDiagram';

const INK: [number, number, number] = [20, 26, 34];
const MUTE: [number, number, number] = [110, 120, 134];
const LINE: [number, number, number] = [214, 220, 228];
const VOLT: [number, number, number] = [26, 110, 230];
const M = 40; // margen (pt)

async function load() {
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable: at.default };
}

const lastY = (doc: JsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

function imageFormat(dataUrl: string) {
  return /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG';
}

function header(doc: JsPDF, s: Settings, title: string, rightLines: string[]) {
  const W = doc.internal.pageSize.getWidth();
  let x = M;
  if (s.shop.logo) {
    try {
      const p = doc.getImageProperties(s.shop.logo);
      const h = 46, w = Math.min(120, (p.width / p.height) * h);
      doc.addImage(s.shop.logo, imageFormat(s.shop.logo), M, M - 6, w, h);
      x = M + w + 12;
    } catch { /* logotipo inválido: se omite */ }
  }
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(15);
  doc.text(s.shop.name || 'Taller de herrería', x, M + 8);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTE);
  const info = [s.shop.owner, s.shop.address, [s.shop.phone, s.shop.email].filter(Boolean).join('  ·  '), s.shop.rfc ? `RFC: ${s.shop.rfc}` : ''].filter(Boolean);
  info.forEach((l, i) => doc.text(doc.splitTextToSize(l, W / 2 - 20)[0], x, M + 22 + i * 11));

  doc.setTextColor(...VOLT).setFont('helvetica', 'bold').setFontSize(16);
  doc.text(title, W - M, M + 8, { align: 'right' });
  doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(9);
  rightLines.forEach((l, i) => doc.text(l, W - M, M + 24 + i * 12, { align: 'right' }));
  const y = M + 30 + Math.max(info.length * 11, rightLines.length * 12);
  doc.setDrawColor(...VOLT).setLineWidth(1.4).line(M, y, W - M, y);
  return y + 18;
}

function footer(doc: JsPDF, label: string) {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(...MUTE).setFont('helvetica', 'normal');
    doc.text(label, M, H - 22);
    doc.text(`Página ${i} de ${n}`, W - M, H - 22, { align: 'right' });
  }
}

function sectionTitle(doc: JsPDF, text: string, y: number) {
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK);
  doc.text(text.toUpperCase(), M, y);
  return y + 6;
}

const tableBase = {
  margin: { left: M, right: M },
  styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
  headStyles: { fillColor: [238, 242, 247] as [number, number, number], textColor: INK, fontStyle: 'bold' as const },
  theme: 'grid' as const,
};

function ensureSpace(doc: JsPDF, y: number, need: number) {
  if (y + need > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); return M; }
  return y;
}

function save(doc: JsPDF, filename: string) {
  doc.save(filename);
}

const fileSafe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'documento';

/* ═════════ Cotización ═════════ */
export async function quotePdf(q: Quote, s: Settings, client: Client | null) {
  const { jsPDF, autoTable } = await load();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const t = computeBudget(q);

  let y = header(doc, s, 'COTIZACIÓN', [`No. ${q.number}`, `Fecha: ${dateMx(q.date)}`, `Vigencia: ${dateMx(addDays(q.date, q.validDays))}`]);

  // Cliente y trabajo
  doc.setFontSize(8).setTextColor(...MUTE).setFont('helvetica', 'bold');
  doc.text('CLIENTE', M, y);
  doc.text('TRABAJO', W / 2 + 10, y);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...INK);
  const cl = client ? [client.name, client.phone, client.email, client.address, client.rfc ? `RFC: ${client.rfc}` : ''].filter(Boolean) : ['Público en general'];
  cl.forEach((l, i) => doc.text(doc.splitTextToSize(l, W / 2 - M - 10)[0], M, y + 14 + i * 12));
  doc.setFont('helvetica', 'bold').text(doc.splitTextToSize(q.title || 'Trabajo de herrería', W / 2 - M - 10), W / 2 + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  const desc = q.description ? doc.splitTextToSize(q.description, W / 2 - M - 10) as string[] : [];
  doc.setFontSize(8.5).setTextColor(...MUTE);
  desc.slice(0, 8).forEach((l, i) => doc.text(l, W / 2 + 10, y + 28 + i * 11));
  y += 24 + Math.max(cl.length * 12, 14 + Math.min(desc.length, 8) * 11);

  if (q.pdfDetail === 'precios') {
    const lines = allocateSale(q, t);
    for (const section of ['Materiales', 'Mano de obra', 'Consumibles y otros'] as const) {
      const rows = lines.filter((l) => l.section === section);
      if (!rows.length) continue;
      y = ensureSpace(doc, y, 60);
      y = sectionTitle(doc, section, y + 8);
      autoTable(doc, {
        ...tableBase, startY: y,
        head: [['Descripción', 'Cant.', 'Unidad', 'P. unitario', 'Importe']],
        body: rows.map((l) => [l.description, num(l.qty), l.unit, money(l.unitPrice), money(l.amount)]),
        columnStyles: { 1: { halign: 'right', cellWidth: 46 }, 2: { cellWidth: 56 }, 3: { halign: 'right', cellWidth: 78 }, 4: { halign: 'right', cellWidth: 84 } },
      });
      y = lastY(doc) + 6;
    }
  } else {
    if (q.materials.length) {
      y = sectionTitle(doc, 'Materiales', y + 8);
      autoTable(doc, {
        ...tableBase, startY: y,
        head: [['Descripción', 'Cantidad', 'Unidad']],
        body: q.materials.map((m) => [m.description || 'Material', num(m.qty), m.unit]),
        columnStyles: { 1: { halign: 'right', cellWidth: 70 }, 2: { cellWidth: 80 } },
      });
      y = lastY(doc) + 6;
    }
    if (q.labor.length) {
      y = ensureSpace(doc, y, 60);
      y = sectionTitle(doc, 'Mano de obra', y + 8);
      autoTable(doc, {
        ...tableBase, startY: y,
        head: [['Concepto', 'Detalle']],
        body: q.labor.map((l) => [l.description || 'Mano de obra', l.mode === 'horas' ? `${num(l.workers)} persona(s) × ${num(l.hours)} h` : 'Por trabajo']),
        columnStyles: { 1: { cellWidth: 150 } },
      });
      y = lastY(doc) + 6;
    }
    const cats = EXPENSE_CATEGORIES.filter((c) => t.expensesByCategory[c.id] > 0).map((c) => c.label);
    if (cats.length) {
      y = ensureSpace(doc, y, 30);
      doc.setFontSize(8.5).setTextColor(...MUTE).setFont('helvetica', 'normal');
      doc.text(`Incluye: ${cats.join(', ').toLowerCase()}.`, M, y + 12);
      y += 18;
    }
  }

  // Totales
  y = ensureSpace(doc, y, 110);
  const bx = W - M - 230;
  const rows: [string, string, boolean?][] = [['Subtotal', money(t.subtotal)]];
  if (q.ivaEnabled) rows.push([`IVA (${fixed(q.ivaPct, 0)} %)`, money(t.iva)]);
  rows.push(['TOTAL', `${money(t.total)} MXN`, true]);
  y += 14;
  rows.forEach(([l, v, strong], i) => {
    const yy = y + i * 20;
    if (strong) {
      doc.setFillColor(...VOLT).rect(bx, yy - 13, 230, 22, 'F');
      doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(11);
    } else {
      doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(9.5);
    }
    doc.text(l, bx + 10, yy + 2);
    doc.text(v, W - M - 10, yy + 2, { align: 'right' });
  });
  y += rows.length * 20 + 18;

  // Condiciones
  if (q.terms?.trim()) {
    y = ensureSpace(doc, y, 60);
    y = sectionTitle(doc, 'Condiciones', y);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTE);
    const tl = doc.splitTextToSize(q.terms, W - 2 * M) as string[];
    tl.forEach((l) => { y = ensureSpace(doc, y, 14); doc.text(l, M, y + 8); y += 11; });
  }
  y = ensureSpace(doc, y + 40, 50);
  doc.setDrawColor(...LINE).setLineWidth(0.8).line(W - M - 200, y + 20, W - M, y + 20);
  doc.setFontSize(8).setTextColor(...MUTE).text('Acepto cotización — nombre y firma', W - M - 100, y + 32, { align: 'center' });

  footer(doc, `${s.shop.name || 'Cotización'} · ${q.number}`);
  save(doc, `${fileSafe(q.number)}-${fileSafe(q.title)}.pdf`);
}

/* ═════════ Lista de cortes ═════════ */
export async function cutListPdf(plan: CutPlan, s: Settings, client: Client | null) {
  const { jsPDF, autoTable } = await load();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const today = new Date();
  let y = header(doc, s, 'LISTA DE CORTES', [plan.name, `Fecha: ${today.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`, client ? `Cliente: ${client.name}` : ''].filter(Boolean));

  for (const g of plan.groups) {
    y = ensureSpace(doc, y, 120);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK).text(g.label || 'Material', M, y + 4);
    const run = runGroup(g);
    if (!run.ok) {
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(200, 40, 40).text(run.error, M, y + 20);
      y += 40; continue;
    }
    const r = run.result, tt = r.totals, mo = groupMoney(g, r);
    const comm = g.stock.find((x) => !x.isOffcut);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTE);
    doc.text(`Barra comercial: ${comm ? num(comm.length) + ' mm' : '—'}   ·   Ancho de corte: ${num(g.kerf)} mm   ·   Despunte: ${num(g.trimStart)} mm   ·   Sobrante útil desde: ${num(g.minReusable)} mm`, M, y + 18);
    y += 26;
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [['Barras a comprar', 'Retazos usados', 'Aprovechamiento', 'Desperdicio', 'Peso', 'Costo material']],
      body: [[
        tt.purchased.map((p) => `${p.count} × ${num(p.length)} mm`).join(', ') || '0',
        String(tt.offcutsUsed), pct(tt.utilization), `${fixed(tt.waste / 1000, 3)} m (${pct(1 - tt.utilization)})`,
        mo.kg != null ? kg(mo.kg) : '—', mo.cost != null ? money(mo.cost) : '—',
      ]],
    });
    y = lastY(doc) + 10;

    // Piezas requeridas
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [['', 'Pieza', 'Largo (mm)', 'Cantidad']],
      body: [...g.pieces].sort((a, b) => b.length - a.length).map((p) => ['', p.label, num(p.length), String(p.qty)]),
      columnStyles: { 0: { cellWidth: 14 }, 2: { halign: 'right', cellWidth: 80 }, 3: { halign: 'right', cellWidth: 64 } },
      didDrawCell: (d) => {
        if (d.section === 'body' && d.column.index === 0) {
          const id = [...g.pieces].sort((a, b) => b.length - a.length)[d.row.index]?.id;
          const order = [...g.pieces].sort((a, b) => b.length - a.length).map((p) => p.id);
          const c = hex(PIECE_COLORS[order.indexOf(id) % PIECE_COLORS.length]);
          doc.setFillColor(...c).rect(d.cell.x + 4, d.cell.y + d.cell.height / 2 - 3, 6, 6, 'F');
        }
      },
    });
    y = lastY(doc) + 14;

    // Diagramas por patrón
    const order = [...g.pieces].sort((a, b) => b.length - a.length).map((p) => p.id);
    r.patterns.forEach((pt, i) => {
      y = ensureSpace(doc, y, 62);
      y = drawBar(doc, pt.bar, g.kerf, g.trimStart, order, `Patrón ${i + 1}  ·  ${pt.count} ${pt.count === 1 ? 'barra' : 'barras'}  ·  ${pt.bar.isOffcut ? 'retazo ' : ''}${num(pt.bar.stockLength)} mm`, y, W);
    });

    if (r.unplaced.length) {
      y = ensureSpace(doc, y, 40);
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(200, 40, 40);
      r.unplaced.forEach((u) => { doc.text(`Sin colocar: ${u.label} ${num(u.length)} mm × ${u.qty} — ${u.reason}`, M, y + 10); y += 13; });
    }
    y += 14;
  }
  if (plan.notes?.trim()) {
    y = ensureSpace(doc, y, 50);
    y = sectionTitle(doc, 'Notas', y);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTE);
    (doc.splitTextToSize(plan.notes, W - 2 * M) as string[]).forEach((l) => { y = ensureSpace(doc, y, 14); doc.text(l, M, y + 8); y += 11; });
  }
  footer(doc, `${plan.name} · Medidas en milímetros`);
  save(doc, `${fileSafe(plan.name)}-lista-de-cortes.pdf`);
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawBar(doc: JsPDF, bar: import('../domain/cutting').BarLayout, kerf: number, trim: number, order: string[], title: string, y: number, W: number) {
  const x0 = M, w = W - 2 * M, h = 22;
  const sc = w / bar.stockLength;
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...INK).text(title, x0, y + 8);
  doc.setFont('helvetica', 'normal').setTextColor(...MUTE).text(`Sobrante: ${num(bar.offcut)} mm${bar.reusable ? ' (reutilizable)' : ''}`, x0 + w, y + 8, { align: 'right' });
  const top = y + 14;
  doc.setFillColor(240, 243, 247).setDrawColor(...LINE).setLineWidth(0.6).rect(x0, top, w, h, 'FD');
  if (trim > 0) {
    doc.setFillColor(190, 196, 204).rect(x0, top, trim * sc, h, 'F');
  }
  bar.cuts.forEach((c) => {
    const cx = x0 + c.start * sc, cw = c.length * sc;
    const col = hex(PIECE_COLORS[order.indexOf(c.pieceId) % PIECE_COLORS.length]);
    doc.setFillColor(...col).rect(cx, top, cw, h, 'F');
    doc.setDrawColor(255, 255, 255).setLineWidth(0.6).rect(cx, top, cw, h, 'S');
    const label = num(c.length);
    doc.setFontSize(7.5).setTextColor(10, 16, 31);
    if (doc.getTextWidth(label) + 4 < cw) doc.text(label, cx + cw / 2, top + h / 2 + 2.6, { align: 'center' });
    // marca de corte
    if (kerf > 0) { doc.setDrawColor(220, 50, 50).setLineWidth(Math.max(0.8, kerf * sc)).line(cx + cw + (kerf * sc) / 2, top - 2, cx + cw + (kerf * sc) / 2, top + h + 2); }
  });
  if (bar.offcut > 0) {
    const ox = x0 + (bar.stockLength - bar.offcut) * sc;
    doc.setFontSize(7).setTextColor(...MUTE);
    const label = num(bar.offcut);
    if (doc.getTextWidth(label) + 4 < bar.offcut * sc) doc.text(label, ox + (bar.offcut * sc) / 2, top + h / 2 + 2.5, { align: 'center' });
  }
  // cotas de inicio de cada corte
  doc.setFontSize(6.5).setTextColor(...MUTE);
  let lastX = -100;
  bar.cuts.forEach((c) => {
    const px = x0 + (c.start + c.length) * sc;
    const t = num(c.start + c.length);
    if (px - lastX > doc.getTextWidth(t) + 6 && px < x0 + w - 14) { doc.text(t, px, top + h + 9, { align: 'center' }); lastX = px; }
  });
  doc.text('0', x0, top + h + 9);
  doc.text(num(bar.stockLength), x0 + w, top + h + 9, { align: 'right' });
  return top + h + 20;
}

