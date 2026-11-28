/**
 * Cálculo de presupuestos de herrería (MXN).
 *
 *   Materiales       = Σ cantidad × precio unitario
 *   Desperdicio      = Σ (materiales con «aplicar desperdicio») × % desperdicio
 *                      (las barras que vienen del optimizador ya incluyen su sobrante:
 *                       se compran completas, así que no se les suma otro porcentaje)
 *   Mano de obra     = Σ personas × horas × costo por hora   (o importe fijo)
 *   Gastos           = Σ cantidad × precio unitario, agrupados por categoría
 *   COSTO REAL       = Materiales + Desperdicio + Mano de obra + Gastos
 *   Utilidad         = Costo × % utilidad          (modo «sobre costo», recargo)
 *                    o Precio = Costo ÷ (1 − %)    (modo «margen sobre venta»)
 *   Subtotal         = Costo + Utilidad (+ ajuste por redondeo, que se suma a la utilidad)
 *   IVA              = Subtotal × % IVA (opcional)
 *   PRECIO FINAL     = Subtotal + IVA
 *
 * El dinero se redondea a centavos solo al final de cada concepto.
 */

export type ExpenseCategory = 'soldadura' | 'discos' | 'pintura' | 'transporte' | 'otros';

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; hint: string }[] = [
  { id: 'soldadura', label: 'Consumibles de soldadura', hint: 'Electrodo, microalambre, gas, puntas' },
  { id: 'discos', label: 'Discos de corte y desbaste', hint: 'Corte, desbaste, laminado, cepillo' },
  { id: 'pintura', label: 'Pintura', hint: 'Primario, esmalte, thinner, brochas' },
  { id: 'transporte', label: 'Transporte', hint: 'Flete, gasolina, casetas' },
  { id: 'otros', label: 'Otros gastos', hint: 'Tornillería, bisagras, chapas, renta de equipo' },
];

export interface MaterialLine {
  id: string;
  description: string;
  /** Unidad de compra: barra, kg, m, pieza, hoja… */
  unit: string;
  qty: number;
  unitPrice: number;
  /** Aplicar el % de desperdicio general a esta línea */
  applyWaste: boolean;
  /** Referencia opcional al material del catálogo */
  materialId?: string | null;
  /** Peso total de la línea en kg (informativo) */
  weightKg?: number | null;
  /** Valor del material sobrante calculado por el optimizador (informativo, ya incluido en el costo) */
  offcutValue?: number | null;
}

export interface LaborLine {
  id: string;
  description: string;
  mode: 'horas' | 'fijo';
  workers: number;
  hours: number;
  rate: number;
  amount: number;
}

export interface ExpenseLine {
  id: string;
  category: ExpenseCategory;
  description: string;
  qty: number;
  unitPrice: number;
}

export type ProfitMode = 'recargo' | 'margen';

export interface BudgetInput {
  materials: MaterialLine[];
  labor: LaborLine[];
  expenses: ExpenseLine[];
  wastePct: number;
  profitPct: number;
  profitMode: ProfitMode;
  ivaEnabled: boolean;
  ivaPct: number;
  /** Redondeo del subtotal hacia arriba: 0 = sin redondeo, 1, 10, 50, 100… */
  roundTo: number;
}

export interface BudgetTotals {
  materials: number;
  waste: number;
  /** Valor del sobrante ya incluido en las barras compradas (informativo) */
  offcutValue: number;
  labor: number;
  laborHours: number;
  expenses: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  cost: number;
  profit: number;
  rounding: number;
  subtotal: number;
  iva: number;
  total: number;
  /** Utilidad / subtotal (0–1) */
  margin: number;
  /** Utilidad / costo (0–1) */
  markup: number;
  weightKg: number;
}

export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

export function laborLineAmount(l: LaborLine): number {
  return l.mode === 'fijo' ? cents(num(l.amount)) : cents(num(l.workers) * num(l.hours) * num(l.rate));
}

export function computeBudget(b: BudgetInput): BudgetTotals {
  const materials = cents(b.materials.reduce((s, m) => s + num(m.qty) * num(m.unitPrice), 0));
  const wasteBase = b.materials.filter((m) => m.applyWaste).reduce((s, m) => s + num(m.qty) * num(m.unitPrice), 0);
  const waste = cents(wasteBase * (num(b.wastePct) / 100));
  const offcutValue = cents(b.materials.reduce((s, m) => s + num(m.offcutValue), 0));
  const labor = cents(b.labor.reduce((s, l) => s + laborLineAmount(l), 0));
  const laborHours = b.labor.reduce((s, l) => s + (l.mode === 'horas' ? num(l.workers) * num(l.hours) : 0), 0);
  const byCat = { soldadura: 0, discos: 0, pintura: 0, transporte: 0, otros: 0 } as Record<ExpenseCategory, number>;
  for (const e of b.expenses) byCat[e.category] = (byCat[e.category] ?? 0) + num(e.qty) * num(e.unitPrice);
  (Object.keys(byCat) as ExpenseCategory[]).forEach((k) => (byCat[k] = cents(byCat[k])));
  const expenses = cents(Object.values(byCat).reduce((s, v) => s + v, 0));
  const cost = cents(materials + waste + labor + expenses);

  const p = num(b.profitPct) / 100;
  let profit: number;
  if (b.profitMode === 'margen') {
    if (p >= 1) throw new RangeError('El margen sobre venta debe ser menor que 100 %.');
    profit = cents(cost / (1 - p) - cost);
  } else {
    profit = cents(cost * p);
  }
  let subtotal = cents(cost + profit);
  let rounding = 0;
  if (b.roundTo > 0 && subtotal > 0) {
    const r = Math.ceil(subtotal / b.roundTo - 1e-9) * b.roundTo;
    rounding = cents(r - subtotal);
    subtotal = cents(r);
  }
  const totalProfit = cents(profit + rounding);
  const iva = b.ivaEnabled ? cents(subtotal * (num(b.ivaPct) / 100)) : 0;
  const total = cents(subtotal + iva);
  const weightKg = b.materials.reduce((s, m) => s + num(m.weightKg), 0);

  return {
    materials, waste, offcutValue, labor, laborHours, expenses, expensesByCategory: byCat,
    cost, profit: totalProfit, rounding, subtotal, iva, total,
    margin: subtotal > 0 ? totalProfit / subtotal : 0,
    markup: cost > 0 ? totalProfit / cost : 0,
    weightKg,
  };
}

/** Precio de una barra a partir del precio por kg, o al revés. Devuelve null si falta un dato. */
export function priceFromKg(pricePerKg: number | null | undefined, kgPerBar: number): number | null {
  if (pricePerKg == null || !Number.isFinite(pricePerKg) || pricePerKg <= 0) return null;
  return cents(pricePerKg * kgPerBar);
}
export function kgPriceFromBar(pricePerBar: number | null | undefined, kgPerBar: number): number | null {
  if (pricePerBar == null || !Number.isFinite(pricePerBar) || pricePerBar <= 0 || kgPerBar <= 0) return null;
  return cents(pricePerBar / kgPerBar);
}

export interface SaleLine {
  section: 'Materiales' | 'Mano de obra' | 'Consumibles y otros';
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

/**
 * Reparte el subtotal de venta entre las partidas en proporción a su costo, para mostrar precios
 * por partida al cliente. La suma de importes es exactamente igual al subtotal: los centavos
 * de diferencia por redondeo se asignan a la mayor partida de cantidad 1.
 */
export function allocateSale(b: BudgetInput, t: BudgetTotals): SaleLine[] {
  if (t.cost <= 0) return [];
  const f = t.subtotal / t.cost;
  const lines: SaleLine[] = [];
  for (const m of b.materials) {
    if (num(m.qty) * num(m.unitPrice) === 0) continue;
    const unitPrice = cents(num(m.unitPrice) * f);
    lines.push({ section: 'Materiales', description: m.description || 'Material', qty: num(m.qty), unit: m.unit, unitPrice, amount: cents(unitPrice * num(m.qty)) });
  }
  if (t.waste > 0) lines.push({ section: 'Materiales', description: 'Mermas y desperdicio', qty: 1, unit: 'lote', unitPrice: cents(t.waste * f), amount: cents(t.waste * f) });
  for (const l of b.labor) {
    const a = laborLineAmount(l);
    if (a === 0) continue;
    lines.push({ section: 'Mano de obra', description: l.description || 'Mano de obra', qty: 1, unit: 'servicio', unitPrice: cents(a * f), amount: cents(a * f) });
  }
  for (const c of EXPENSE_CATEGORIES) {
    const a = t.expensesByCategory[c.id];
    if (!a) continue;
    lines.push({ section: 'Consumibles y otros', description: c.label, qty: 1, unit: 'lote', unitPrice: cents(a * f), amount: cents(a * f) });
  }
  const diff = cents(t.subtotal - lines.reduce((s, l) => s + l.amount, 0));
  if (diff !== 0 && lines.length) {
    const ones = lines.filter((l) => l.qty === 1);
    const target = (ones.length ? ones : lines).reduce((a, l) => (l.amount > a.amount ? l : a));
    target.amount = cents(target.amount + diff);
    target.unitPrice = cents(target.amount / target.qty);
  }
  return lines;
}
