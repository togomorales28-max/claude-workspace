import type { QuoteInput } from './types';

/** Redondeo a centavos que evita errores de coma flotante (p. ej. 1.005 → 1.01). */
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

export interface Breakdown {
  multiplier: number; // piezas si perPiece, 1 si no
  materials: number; // materiales (sin desperdicio)
  waste: number; // desperdicio sobre materiales
  consumables: number;
  labor: number;
  laborHours: number; // horas-hombre totales
  transport: number;
  installation: number;
  extras: number;
  additional: number; // transporte + instalación + extras
  direct: number; // costo directo antes de imprevistos
  contingency: number;
  cost: number; // COSTO TOTAL
  recommendedPrice: number; // costo + ganancia (antes de redondeo)
  roundedPrice: number; // recomendado redondeado hacia arriba
  price: number; // PRECIO DE VENTA (sin impuesto)
  profit: number; // precio - costo
  marginPct: number; // ganancia / precio
  markupPct: number; // ganancia / costo
  tax: number;
  total: number; // precio + impuesto
  isManual: boolean;
  /** Error de configuración (p. ej. margen ≥ 100 %). */
  error: string | null;
}

/**
 * Precio de venta a partir del costo.
 * - margin: margen sobre el PRECIO de venta → precio = costo / (1 − m)
 * - markup: recargo sobre el COSTO → precio = costo × (1 + k)
 */
export function priceFromCost(cost: number, mode: 'margin' | 'markup', pct: number): number {
  const p = num(pct) / 100;
  if (mode === 'margin') {
    if (p >= 1) return NaN;
    return cost / (1 - p);
  }
  return cost * (1 + p);
}

export function roundUp(value: number, step: number): number {
  if (!step || step <= 0) return r2(value);
  // Pequeña tolerancia para que 1200.0000001 no suba a 1300
  return Math.ceil(r2(value) / step - 1e-9) * step;
}

export function calculate(q: QuoteInput): Breakdown {
  const multiplier = q.perPiece ? Math.max(0, num(q.dimensions.quantity)) : 1;

  const sumKind = (kind: 'material' | 'consumable') =>
    q.lines.filter((l) => l.kind === kind).reduce((acc, l) => acc + num(l.qty) * num(l.unitPrice), 0);

  const materials = r2(sumKind('material') * multiplier);
  const consumables = r2(sumKind('consumable') * multiplier);
  const waste = r2((materials * num(q.wastePct)) / 100);

  const laborHours = num(q.labor.workers) * num(q.labor.hours) * multiplier;
  const labor = r2(laborHours * num(q.labor.rate));

  const transport = r2(num(q.transport));
  const installation = r2(num(q.installation));
  const extras = r2(q.extras.reduce((a, e) => a + num(e.amount), 0));
  const additional = r2(transport + installation + extras);

  const direct = r2(materials + waste + consumables + labor + additional);
  const contingency = r2((direct * num(q.contingencyPct)) / 100);
  const cost = r2(direct + contingency);

  let error: string | null = null;
  let recommended = priceFromCost(cost, q.profitMode, q.profitPct);
  if (!Number.isFinite(recommended)) {
    error = 'El margen sobre precio de venta debe ser menor a 100 %.';
    recommended = cost;
  }
  const recommendedPrice = r2(recommended);
  const roundedPrice = r2(roundUp(recommendedPrice, num(q.roundTo)));

  const isManual = q.manualPrice !== null && q.manualPrice !== undefined && Number.isFinite(q.manualPrice);
  const price = r2(isManual ? num(q.manualPrice) : roundedPrice);

  const profit = r2(price - cost);
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  const markupPct = cost > 0 ? (profit / cost) * 100 : 0;

  const tax = q.taxEnabled ? r2((price * num(q.taxPct)) / 100) : 0;
  const total = r2(price + tax);

  return {
    multiplier,
    materials,
    waste,
    consumables,
    labor,
    laborHours,
    transport,
    installation,
    extras,
    additional,
    direct,
    contingency,
    cost,
    recommendedPrice,
    roundedPrice,
    price,
    profit,
    marginPct,
    markupPct,
    tax,
    total,
    isManual,
    error,
  };
}

/** Conversión entre margen y recargo (útil para mostrar ambas cifras). */
export const marginToMarkup = (m: number) => (m >= 100 ? Infinity : (m / (100 - m)) * 100);
export const markupToMargin = (k: number) => (k <= -100 ? -Infinity : (k / (100 + k)) * 100);

/** Medidas derivadas útiles para referencia (por pieza). */
export function derivedMeasures(d: { width: number; height: number; length: number; quantity: number }) {
  const w = num(d.width);
  const h = num(d.height);
  const l = num(d.length);
  const qty = Math.max(1, num(d.quantity));
  const area = w * h; // m² de cara (ancho × alto)
  const perimeter = w > 0 && h > 0 ? 2 * (w + h) : 0;
  const volume = w * h * l;
  return { area, perimeter, volume, totalArea: area * qty, linear: (l || w) * qty };
}
