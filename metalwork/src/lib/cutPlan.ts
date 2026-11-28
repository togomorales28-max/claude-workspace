import { optimizeCuts, type CutResult, type StockBar } from '../domain/cutting';
import { cents, type MaterialLine } from '../domain/budget';
import type { CutGroup, CutPlan, CutSummary, Settings } from '../data/types';
import { uid } from '../data/repo';

export type GroupRun = { ok: true; result: CutResult } | { ok: false; error: string };

export function runGroup(g: CutGroup): GroupRun {
  try {
    const pieces = g.pieces.map((p, i) => ({ ...p, label: p.label?.trim() || `Pieza ${i + 1}` }));
    return { ok: true, result: optimizeCuts(pieces, g.stock, { kerf: g.kerf, trimStart: g.trimStart, minReusable: g.minReusable }) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface GroupMoney {
  kg: number | null;
  wasteKg: number | null;
  cost: number | null;
  /** Valor del material que no termina en piezas (sobrante + cortes), ya incluido en el costo */
  wasteValue: number | null;
  missingPrice: boolean;
}

export function groupMoney(g: CutGroup, r: CutResult): GroupMoney {
  const kg = g.kgm != null ? (r.totals.stockLength / 1000) * g.kgm : null;
  const wasteKg = g.kgm != null ? (r.totals.waste / 1000) * g.kgm : null;
  const newBars = r.bars.filter((b) => !b.isOffcut);
  const newLen = newBars.reduce((s, b) => s + b.stockLength, 0);
  const newWaste = newBars.reduce((s, b) => s + (b.stockLength - b.piecesLength), 0);
  // Costo: barras nuevas × precio. Si hay varias longitudes, se prorratea el precio por longitud.
  const commercial = g.stock.find((s) => !s.isOffcut && s.qty === null) ?? g.stock.find((s) => !s.isOffcut);
  const missingPrice = g.pricePerBar == null || !commercial;
  const pricePerMm = !missingPrice ? g.pricePerBar! / commercial!.length : null;
  const cost = pricePerMm != null ? cents(newLen * pricePerMm) : null;
  const wasteValue = pricePerMm != null ? cents(newWaste * pricePerMm) : null;
  return { kg, wasteKg, cost, wasteValue, missingPrice };
}

export function planSummary(plan: CutPlan): CutSummary | null {
  let any = false;
  const s: CutSummary = { bars: 0, newBars: 0, stockLength: 0, piecesLength: 0, waste: 0, scrap: 0, kg: 0, wasteKg: 0, cost: 0 };
  for (const g of plan.groups) {
    const run = runGroup(g);
    if (!run.ok) continue;
    any = true;
    const t = run.result.totals;
    const m = groupMoney(g, run.result);
    s.bars += t.bars;
    s.newBars += t.purchased.reduce((a, p) => a + p.count, 0);
    s.stockLength += t.stockLength;
    s.piecesLength += t.piecesLength;
    s.waste += t.waste;
    s.scrap += t.waste - t.reusableOffcut;
    s.kg += m.kg ?? 0;
    s.wasteKg += m.wasteKg ?? 0;
    s.cost = s.cost == null || m.cost == null ? null : s.cost + m.cost;
  }
  return any ? s : null;
}

export function newGroup(settings: Settings, label = 'Material 1'): CutGroup {
  return {
    id: uid(), materialId: null, label, kgm: null, pricePerBar: null,
    stock: [commercialStock(settings.cut.stockLength)],
    kerf: settings.cut.kerf, trimStart: settings.cut.trimStart, minReusable: settings.cut.minReusable,
    pieces: [],
  };
}

export function commercialStock(length: number): StockBar {
  return { id: uid(), label: 'Barra comercial', length, qty: null, cost: null, isOffcut: false };
}

/** Convierte un plan de corte en líneas de material para un presupuesto. */
export function planToMaterialLines(plan: CutPlan): { lines: MaterialLine[]; warnings: string[] } {
  const lines: MaterialLine[] = [];
  const warnings: string[] = [];
  for (const g of plan.groups) {
    const run = runGroup(g);
    if (!run.ok) { warnings.push(`«${g.label}»: ${run.error}`); continue; }
    const r = run.result;
    const m = groupMoney(g, r);
    for (const p of r.totals.purchased) {
      lines.push({
        id: uid(), description: `${g.label} — barra de ${(p.length / 1000).toFixed(2)} m`,
        unit: 'barra', qty: p.count,
        unitPrice: g.pricePerBar != null ? cents(g.pricePerBar * (p.length / (g.stock.find((s) => !s.isOffcut && s.qty === null)?.length ?? p.length))) : 0,
        applyWaste: false, materialId: g.materialId,
        weightKg: g.kgm != null ? (p.count * p.length / 1000) * g.kgm : null,
        offcutValue: null,
      });
    }
    if (lines.length && m.wasteValue != null) lines[lines.length - 1].offcutValue = m.wasteValue;
    if (m.missingPrice) warnings.push(`«${g.label}» no tiene precio por barra: captúralo en el presupuesto.`);
    if (r.unplaced.length) warnings.push(`«${g.label}» tiene piezas sin colocar.`);
  }
  return { lines, warnings };
}
