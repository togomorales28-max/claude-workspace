import { describe, it, expect } from 'vitest';
import { calculate, priceFromCost, roundUp, marginToMarkup, markupToMargin } from '../src/domain/calc';
import { scaleEstimate, scaleQuoteInput, toMeters } from '../src/domain/scale';
import type { QuoteInput } from '../src/domain/types';

const base = (): QuoteInput => ({
  jobType: 'barandal', title: 't', description: '',
  dimensions: { width: 3, height: 1, length: 3, quantity: 1 }, perPiece: false,
  lines: [
    { id: '1', kind: 'material', name: 'PTR', unit: 'tramo', unitPrice: 450, qty: 2 }, // 900
    { id: '2', kind: 'material', name: 'Solera', unit: 'tramo', unitPrice: 100, qty: 1 }, // 100
    { id: '3', kind: 'consumable', name: 'Disco', unit: 'pza', unitPrice: 25, qty: 4 }, // 100
  ],
  labor: { workers: 2, hours: 5, rate: 60 }, // 600
  transport: 150, installation: 250, extras: [{ id: 'e', label: 'Grúa', amount: 100 }], // 500
  wastePct: 10, contingencyPct: 5, profitMode: 'margin', profitPct: 25,
  roundTo: 0, manualPrice: null, taxEnabled: false, taxPct: 16,
});

describe('calculate', () => {
  it('separa costo total y precio de venta con margen sobre venta', () => {
    const b = calculate(base());
    expect(b.materials).toBe(1000);
    expect(b.waste).toBe(100);
    expect(b.consumables).toBe(100);
    expect(b.labor).toBe(600);
    expect(b.laborHours).toBe(10);
    expect(b.additional).toBe(500);
    expect(b.direct).toBe(2300);
    expect(b.contingency).toBe(115);
    expect(b.cost).toBe(2415);
    expect(b.price).toBe(3220); // 2415 / 0.75
    expect(b.profit).toBe(805);
    expect(b.marginPct).toBeCloseTo(25, 6);
    expect(b.markupPct).toBeCloseTo(33.333, 2);
  });
  it('recargo sobre costo es distinto al margen', () => {
    const b = calculate({ ...base(), profitMode: 'markup', profitPct: 25 });
    expect(b.price).toBe(3018.75);
    expect(b.marginPct).toBeCloseTo(20, 6);
  });
  it('multiplica por piezas solo materiales, consumibles y mano de obra', () => {
    const q = base(); q.perPiece = true; q.dimensions.quantity = 3;
    const b = calculate(q);
    expect(b.materials).toBe(3000);
    expect(b.consumables).toBe(300);
    expect(b.labor).toBe(1800);
    expect(b.additional).toBe(500);
  });
  it('redondea hacia arriba, aplica IVA y precio manual', () => {
    const b = calculate({ ...base(), roundTo: 100, taxEnabled: true });
    expect(b.price).toBe(3300);
    expect(b.tax).toBe(528);
    expect(b.total).toBe(3828);
    const m = calculate({ ...base(), manualPrice: 3000 });
    expect(m.price).toBe(3000);
    expect(m.profit).toBe(585);
    expect(m.isManual).toBe(true);
  });
  it('reporta error con margen >= 100 %', () => {
    const b = calculate({ ...base(), profitPct: 100 });
    expect(b.error).not.toBeNull();
    expect(b.price).toBe(b.cost);
  });
  it('helpers', () => {
    expect(priceFromCost(100, 'margin', 50)).toBe(200);
    expect(roundUp(1200.0000001, 100)).toBe(1200);
    expect(roundUp(1201, 100)).toBe(1300);
    expect(marginToMarkup(20)).toBeCloseTo(25);
    expect(markupToMargin(25)).toBeCloseTo(20);
  });
});

describe('scaleEstimate', () => {
  it('ejemplo del plano: 10 ft a $200 → 12 ft = $240', () => {
    const r = scaleEstimate({ method: 'linear', refPrice: 200, refLength: 10, refHeight: 0, newLength: 12, newHeight: 0, newQty: 1, fixedPct: 0 });
    expect(r.estimate).toBe(240);
    expect(r.ratePerUnit).toBe(20);
    expect(r.differencePct).toBeCloseTo(20);
  });
  it('parte fija no escala', () => {
    const r = scaleEstimate({ method: 'linear', refPrice: 200, refLength: 10, refHeight: 0, newLength: 12, newHeight: 0, newQty: 1, fixedPct: 25 });
    expect(r.estimate).toBe(50 + 150 * 1.2);
  });
  it('por área y por pieza', () => {
    expect(scaleEstimate({ method: 'area', refPrice: 1000, refLength: 2, refHeight: 1, newLength: 3, newHeight: 2, newQty: 1, fixedPct: 0 }).estimate).toBe(3000);
    expect(scaleEstimate({ method: 'unit', refPrice: 500, refLength: 0, refHeight: 0, newLength: 0, newHeight: 0, newQty: 4, fixedPct: 0 }).estimate).toBe(2000);
  });
  it('valida entradas', () => {
    expect(scaleEstimate({ method: 'linear', refPrice: 0, refLength: 10, refHeight: 0, newLength: 12, newHeight: 0, newQty: 1, fixedPct: 0 }).valid).toBe(false);
  });
  it('convierte unidades y escala cotizaciones', () => {
    expect(toMeters(10, 'ft')).toBeCloseTo(3.048);
    const s = scaleQuoteInput(base(), 1.2);
    expect(s.lines[0].qty).toBe(2.4);
    expect(s.labor.hours).toBe(6);
    expect(s.transport).toBe(150);
  });
});
