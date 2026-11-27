import type { Client, Material, Quote } from './types';
import { calculate } from './calc';

export type Errors = Record<string, string>;

const isNonNeg = (n: number) => Number.isFinite(n) && n >= 0;

export function validateMaterial(m: Pick<Material, 'name' | 'unit' | 'price' | 'category'>): Errors {
  const e: Errors = {};
  if (!m.name.trim()) e.name = 'Escribe el nombre del material.';
  if (!m.unit) e.unit = 'Elige una unidad.';
  if (!m.category) e.category = 'Elige una categoría.';
  if (!isNonNeg(m.price)) e.price = 'El precio debe ser 0 o mayor.';
  return e;
}

export function validateClient(c: Pick<Client, 'name' | 'phone' | 'email'>): Errors {
  const e: Errors = {};
  if (!c.name.trim()) e.name = 'Escribe el nombre del cliente.';
  const digits = c.phone.replace(/\D/g, '');
  if (c.phone.trim() && (digits.length < 10 || digits.length > 13)) e.phone = 'Teléfono de 10 dígitos (puede incluir lada 52).';
  if (c.email && c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = 'Correo no válido.';
  return e;
}

/** Validación para guardar una cotización. Devuelve errores agrupados por paso del asistente. */
export function validateQuote(q: Quote): Errors {
  const e: Errors = {};
  if (!q.jobType) e.jobType = 'Selecciona el tipo de trabajo.';
  if (!q.title.trim()) e.title = 'Escribe un título corto para el trabajo.';
  if (!q.clientName.trim()) e.client = 'Selecciona o registra un cliente.';
  const d = q.dimensions;
  if (![d.width, d.height, d.length].every(isNonNeg)) e.dimensions = 'Las medidas no pueden ser negativas.';
  if (!Number.isInteger(d.quantity) || d.quantity < 1) e.quantity = 'La cantidad debe ser un entero mayor a 0.';
  q.lines.forEach((l, i) => {
    if (!l.name.trim()) e[`line.${i}`] = 'Cada material necesita un nombre.';
    else if (!isNonNeg(l.qty) || !isNonNeg(l.unitPrice)) e[`line.${i}`] = 'Cantidad y precio deben ser 0 o mayores.';
  });
  if (![q.labor.workers, q.labor.hours, q.labor.rate].every(isNonNeg)) e.labor = 'La mano de obra no puede tener valores negativos.';
  if (![q.transport, q.installation].every(isNonNeg) || q.extras.some((x) => !isNonNeg(x.amount)))
    e.extras = 'Los gastos adicionales no pueden ser negativos.';
  if (q.extras.some((x) => !x.label.trim())) e.extras = 'Cada gasto adicional necesita una descripción.';
  if (![q.wastePct, q.contingencyPct, q.profitPct].every(isNonNeg)) e.profit = 'Los porcentajes deben ser 0 o mayores.';
  if (q.profitMode === 'margin' && q.profitPct >= 100) e.profit = 'El margen sobre venta debe ser menor a 100 %.';
  if (q.manualPrice !== null && !isNonNeg(q.manualPrice)) e.profit = 'El precio manual no puede ser negativo.';
  const b = calculate(q);
  if (b.cost <= 0 && !(q.manualPrice && q.manualPrice > 0)) e.costs = 'Agrega al menos un material, mano de obra o gasto.';
  if (!Number.isInteger(q.validityDays) || q.validityDays < 1) e.validity = 'Vigencia mínima de 1 día.';
  return e;
}

export const STEP_FOR_ERROR: Record<string, number> = {
  jobType: 0, title: 0, client: 0,
  dimensions: 1, quantity: 1,
  costs: 2,
  labor: 3,
  extras: 4,
  profit: 5,
  validity: 7,
};
export const stepForErrorKey = (k: string) => (k.startsWith('line.') ? 2 : STEP_FOR_ERROR[k] ?? 0);
