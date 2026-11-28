import { describe, it, expect } from 'vitest';
import { computeBudget, BudgetInput, priceFromKg, kgPriceFromBar } from '../src/domain/budget';

const base = (): BudgetInput => ({
  materials: [
    { id: 'm1', description: 'PTR 2"', unit: 'barra', qty: 3, unitPrice: 450, applyWaste: false, offcutValue: 120 },
    { id: 'm2', description: 'Lámina', unit: 'hoja', qty: 1, unitPrice: 1000, applyWaste: true },
  ],
  labor: [
    { id: 'l1', description: 'Soldador', mode: 'horas', workers: 2, hours: 8, rate: 75, amount: 0 },
    { id: 'l2', description: 'Instalación', mode: 'fijo', workers: 0, hours: 0, rate: 0, amount: 500 },
  ],
  expenses: [
    { id: 'e1', category: 'soldadura', description: 'Electrodo', qty: 2, unitPrice: 95.5 },
    { id: 'e2', category: 'discos', description: 'Disco corte', qty: 3, unitPrice: 35 },
    { id: 'e3', category: 'pintura', description: 'Esmalte', qty: 1, unitPrice: 320 },
    { id: 'e4', category: 'transporte', description: 'Flete', qty: 1, unitPrice: 250 },
  ],
  wastePct: 10, profitPct: 30, profitMode: 'recargo', ivaEnabled: false, ivaPct: 16, roundTo: 0,
});

describe('presupuesto', () => {
  it('suma cada concepto correctamente', () => {
    const t = computeBudget(base());
    expect(t.materials).toBe(2350);          // 1350 + 1000
    expect(t.waste).toBe(100);               // solo la lámina: 1000 × 10 %
    expect(t.offcutValue).toBe(120);         // informativo, no suma al costo
    expect(t.labor).toBe(1700);              // 2×8×75 + 500
    expect(t.laborHours).toBe(16);
    expect(t.expensesByCategory.soldadura).toBe(191);
    expect(t.expenses).toBe(191 + 105 + 320 + 250);
    expect(t.cost).toBe(2350 + 100 + 1700 + 866); // 5016
    expect(t.profit).toBe(1504.8);
    expect(t.total).toBe(6520.8);
    expect(t.margin).toBeCloseTo(1504.8 / 6520.8, 10);
    expect(t.markup).toBeCloseTo(0.3, 10);
  });
  it('modo margen sobre venta', () => {
    const t = computeBudget({ ...base(), profitMode: 'margen' });
    expect(t.subtotal).toBeCloseTo(5016 / 0.7, 2);
    expect(t.margin).toBeCloseTo(0.3, 3);
  });
  it('redondeo hacia arriba se suma a la utilidad, e IVA sobre el subtotal', () => {
    const t = computeBudget({ ...base(), roundTo: 100, ivaEnabled: true });
    expect(t.subtotal).toBe(6600);
    expect(t.rounding).toBe(79.2);
    expect(t.profit).toBe(1584);
    expect(t.iva).toBe(1056);
    expect(t.total).toBe(7656);
  });
  it('maneja centavos sin errores de punto flotante', () => {
    const t = computeBudget({ ...base(), materials: [{ id: 'x', description: '', unit: 'kg', qty: 3, unitPrice: 0.1, applyWaste: false }], labor: [], expenses: [], profitPct: 0 });
    expect(t.materials).toBe(0.3);
    expect(t.total).toBe(0.3);
  });
  it('presupuesto vacío da cero', () => {
    const t = computeBudget({ ...base(), materials: [], labor: [], expenses: [] });
    expect(t.total).toBe(0);
    expect(t.margin).toBe(0);
  });
  it('rechaza margen de 100 %', () => {
    expect(() => computeBudget({ ...base(), profitMode: 'margen', profitPct: 100 })).toThrow();
  });
  it('conversión precio barra ↔ kg', () => {
    expect(priceFromKg(28.5, 17.48)).toBe(498.18);
    expect(kgPriceFromBar(498.18, 17.48)).toBe(28.5);
    expect(priceFromKg(null, 10)).toBeNull();
  });
});

import { allocateSale } from '../src/domain/budget';
describe('precio por partida', () => {
  it('las partidas suman exactamente el subtotal', () => {
    for (const roundTo of [0, 10, 100]) for (const profitPct of [0, 17, 30, 45.5]) {
      const b = { ...base(), roundTo, profitPct };
      const t = computeBudget(b);
      const lines = allocateSale(b, t);
      const sum = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
      expect(sum).toBe(t.subtotal);
      for (const l of lines) if (l.qty !== 1) expect(Math.round(l.unitPrice * l.qty * 100) / 100).toBe(l.amount);
    }
  });
});
