import type { LengthUnit, QuoteInput, ScaleMethod } from './types';
import { r2 } from './calc';

export const LENGTH_UNITS: { id: LengthUnit; label: string; toMeters: number }[] = [
  { id: 'm', label: 'metros', toMeters: 1 },
  { id: 'cm', label: 'centímetros', toMeters: 0.01 },
  { id: 'ft', label: 'pies', toMeters: 0.3048 },
  { id: 'in', label: 'pulgadas', toMeters: 0.0254 },
];

export const toMeters = (v: number, u: LengthUnit) => v * (LENGTH_UNITS.find((x) => x.id === u)?.toMeters ?? 1);

export const SCALE_METHODS: { id: ScaleMethod; label: string; hint: string }[] = [
  { id: 'linear', label: 'Por longitud', hint: 'Barandales, cercos, rejas: el precio crece con el largo.' },
  { id: 'area', label: 'Por área', hint: 'Portones, puertas, protecciones, techos: crece con ancho × alto.' },
  { id: 'unit', label: 'Por pieza', hint: 'Muebles, escaleras: mismo precio por cada pieza.' },
];

export interface ScaleInput {
  method: ScaleMethod;
  refPrice: number;
  refLength: number; // en la unidad elegida
  refHeight: number; // solo para área
  newLength: number;
  newHeight: number;
  newQty: number;
  /** % del precio de referencia que NO depende del tamaño (traslado, instalación, postes de arranque…). */
  fixedPct: number;
}

export interface ScaleResult {
  valid: boolean;
  error: string | null;
  factor: number; // relación de tamaño por pieza (nuevo / referencia)
  fixed: number;
  variable: number;
  estimate: number;
  difference: number;
  differencePct: number;
  /** Precio de la parte variable por unidad de medida (por m / ft lineal o por m² / ft²). */
  ratePerUnit: number;
}

const pos = (n: number) => Number.isFinite(n) && n > 0;

export function scaleEstimate(i: ScaleInput): ScaleResult {
  const empty = (error: string): ScaleResult => ({
    valid: false, error, factor: 0, fixed: 0, variable: 0, estimate: 0, difference: 0, differencePct: 0, ratePerUnit: 0,
  });
  if (!pos(i.refPrice)) return empty('Captura el precio que cobraste por el trabajo de referencia.');
  const qty = pos(i.newQty) ? Math.floor(i.newQty) : 1;
  const fixedPct = Math.min(100, Math.max(0, Number.isFinite(i.fixedPct) ? i.fixedPct : 0));

  let factor = 1;
  let refMeasure = 1;
  if (i.method === 'linear') {
    if (!pos(i.refLength)) return empty('Captura el largo del trabajo de referencia.');
    if (!pos(i.newLength)) return empty('Captura el largo del nuevo trabajo.');
    factor = i.newLength / i.refLength;
    refMeasure = i.refLength;
  } else if (i.method === 'area') {
    if (!pos(i.refLength) || !pos(i.refHeight)) return empty('Captura ancho y alto del trabajo de referencia.');
    if (!pos(i.newLength) || !pos(i.newHeight)) return empty('Captura ancho y alto del nuevo trabajo.');
    refMeasure = i.refLength * i.refHeight;
    factor = (i.newLength * i.newHeight) / refMeasure;
  }

  const fixed = (i.refPrice * fixedPct) / 100;
  const variablePerRef = i.refPrice - fixed;
  // La parte fija se cobra una vez; la variable escala con el tamaño y la cantidad de piezas.
  const variable = variablePerRef * factor * qty;
  const estimate = r2(fixed + variable);
  const difference = r2(estimate - i.refPrice);

  return {
    valid: true,
    error: null,
    factor,
    fixed: r2(fixed),
    variable: r2(variable),
    estimate,
    difference,
    differencePct: (difference / i.refPrice) * 100,
    ratePerUnit: r2(variablePerRef / refMeasure),
  };
}

/**
 * Escala una cotización guardada a un nuevo tamaño: multiplica cantidades de material,
 * consumibles y horas de mano de obra por el factor. Transporte, instalación y extras se conservan.
 * Las cantidades se redondean a 2 decimales (el usuario debe revisar tramos/hojas completas).
 */
export function scaleQuoteInput<T extends QuoteInput>(q: T, factor: number): T {
  return {
    ...q,
    lines: q.lines.map((l) => ({ ...l, qty: r2(l.qty * factor) })),
    labor: { ...q.labor, hours: r2(q.labor.hours * factor) },
    manualPrice: null,
  };
}
