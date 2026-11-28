import { describe, it, expect } from 'vitest';
import { optimizeCuts, verifyLayout, CutPiece, StockBar, CutOptions, CutInputError } from '../src/domain/cutting';

const bar = (length: number, qty: number | null = null, extra: Partial<StockBar> = {}): StockBar =>
  ({ id: `s${length}${extra.isOffcut ? 'o' : ''}`, label: `${length}`, length, qty, ...extra });
const opt = (kerf = 3, trimStart = 0, minReusable = 300): CutOptions => ({ kerf, trimStart, minReusable });

function checkAll(res: ReturnType<typeof optimizeCuts>, o: CutOptions, pieces: CutPiece[]) {
  for (const b of res.bars) {
    expect(verifyLayout(b, o)).toBeNull();
    // balance de material exacto por barra
    const sum = b.piecesLength + b.kerfLoss + b.trimLoss + b.offcut;
    expect(sum).toBeCloseTo(b.stockLength, 6);
    expect(b.offcut).toBeGreaterThanOrEqual(0);
  }
  // todas las piezas colocadas o reportadas
  const placed = res.bars.reduce((s, b) => s + b.cuts.length, 0);
  const missing = res.unplaced.reduce((s, u) => s + u.qty, 0);
  expect(placed + missing).toBe(pieces.reduce((s, p) => s + p.qty, 0));
}

/** Mínimo exacto de barras por búsqueda exhaustiva (instancias pequeñas). */
function bruteMinBars(lengths: number[], L: number, kerf: number): number {
  const cap = L + kerf;
  const w = [...lengths].map((x) => x + kerf).sort((a, b) => b - a);
  let best = w.length;
  const bins: number[] = [];
  const rec = (i: number) => {
    if (bins.length >= best) return;
    if (i === w.length) { best = bins.length; return; }
    const seen = new Set<number>();
    for (let b = 0; b < bins.length; b++) {
      if (bins[b] + w[i] <= cap + 1e-9 && !seen.has(bins[b])) {
        seen.add(bins[b]); bins[b] += w[i]; rec(i + 1); bins[b] -= w[i];
      }
    }
    bins.push(w[i]); rec(i + 1); bins.pop();
  };
  rec(0);
  return best;
}

describe('optimizador de cortes', () => {
  it('ejemplo del taller: 6000 mm, 4×1200, 2×850, 3×600, kerf 3', () => {
    const pieces: CutPiece[] = [
      { id: 'a', label: 'A', length: 1200, qty: 4 },
      { id: 'b', label: 'B', length: 850, qty: 2 },
      { id: 'c', label: 'C', length: 600, qty: 3 },
    ];
    const o = opt(3);
    const r = optimizeCuts(pieces, [bar(6000)], o);
    checkAll(r, o, pieces);
    // total 8300 mm de piezas: necesita 2 barras (cota inferior = 2)
    expect(r.totals.bars).toBe(2);
    expect(r.lowerBound).toBe(2);
    expect(r.provenOptimal).toBe(true);
    expect(r.totals.piecesLength).toBe(8300);
    expect(r.totals.stockLength).toBe(12000);
    expect(r.totals.utilization).toBeCloseTo(8300 / 12000, 10);
    expect(r.totals.waste).toBe(3700);
  });

  it('el kerf sí cuenta: 5 × 1200 caben en 6000 sin kerf, pero no con kerf 3', () => {
    const p: CutPiece[] = [{ id: 'a', label: 'A', length: 1200, qty: 5 }];
    const sin = optimizeCuts(p, [bar(6000)], opt(0));
    expect(sin.totals.bars).toBe(1);
    expect(sin.bars[0].offcut).toBe(0);
    expect(sin.bars[0].kerfLoss).toBe(0);
    const con = optimizeCuts(p, [bar(6000)], opt(3));
    expect(con.totals.bars).toBe(2);
    checkAll(con, opt(3), p);
  });

  it('pieza que llega justo al final no necesita corte final', () => {
    // 2 × 2998.5 + 1 kerf de 3 = 6000 exacto
    const p: CutPiece[] = [{ id: 'a', label: 'A', length: 2998.5, qty: 2 }];
    const r = optimizeCuts(p, [bar(6000)], opt(3));
    expect(r.totals.bars).toBe(1);
    expect(r.bars[0].offcut).toBe(0);
    expect(r.bars[0].kerfLoss).toBe(3);
    expect(r.bars[0].cuts[1].start).toBe(3001.5);
  });

  it('resto menor que el kerf lo consume el corte final', () => {
    const p: CutPiece[] = [{ id: 'a', label: 'A', length: 2997.5, qty: 2 }]; // 5995 + 3 = 5998 → resto 2 mm
    const r = optimizeCuts(p, [bar(6000)], opt(3));
    expect(r.bars[0].offcut).toBe(0);
    expect(r.bars[0].kerfLoss).toBe(5);
  });

  it('respeta el despunte inicial', () => {
    const p: CutPiece[] = [{ id: 'a', label: 'A', length: 1000, qty: 6 }];
    const o = opt(3, 10);
    const r = optimizeCuts(p, [bar(6100)], o);
    checkAll(r, o, p);
    expect(r.bars[0].cuts[0].start).toBe(13);
    // 13 + 6×1000 + 5×3 = 6028 → sobrante 6100 − 6028 − 3 = 69
    expect(r.totals.bars).toBe(1);
    expect(r.bars[0].offcut).toBe(69);
    expect(r.bars[0].trimLoss).toBe(10);
  });

  it('pieza más larga que la barra se reporta, no se acomoda', () => {
    const p: CutPiece[] = [{ id: 'a', label: 'Larguero', length: 6500, qty: 1 }, { id: 'b', label: 'B', length: 500, qty: 2 }];
    const r = optimizeCuts(p, [bar(6000)], opt(3));
    expect(r.unplaced).toHaveLength(1);
    expect(r.unplaced[0].label).toBe('Larguero');
    expect(r.totals.bars).toBe(1);
    checkAll(r, opt(3), p);
  });

  it('usa primero los retazos de inventario', () => {
    const p: CutPiece[] = [{ id: 'a', label: 'A', length: 900, qty: 2 }, { id: 'b', label: 'B', length: 2000, qty: 3 }];
    const r = optimizeCuts(p, [bar(6000), bar(1850, 1, { isOffcut: true })], opt(3));
    checkAll(r, opt(3), p);
    expect(r.totals.offcutsUsed).toBe(1);
    expect(r.bars[0].isOffcut).toBe(true);
    expect(r.bars[0].cuts.map((c) => c.length)).toEqual([900, 900]);
    expect(r.totals.purchased[0].count).toBe(2); // 3 × 2000 + 2 kerf > 6000
  });

  it('stock limitado: lo que no alcanza queda reportado', () => {
    const p: CutPiece[] = [{ id: 'a', label: 'A', length: 2000, qty: 5 }];
    const r = optimizeCuts(p, [bar(6000, 1)], opt(3));
    expect(r.totals.bars).toBe(1);
    expect(r.unplaced[0].qty).toBe(3);
  });

  it('valida entradas', () => {
    expect(() => optimizeCuts([], [bar(6000)], opt())).toThrow(CutInputError);
    expect(() => optimizeCuts([{ id: 'a', label: 'A', length: 100, qty: 1.5 }], [bar(6000)], opt())).toThrow(CutInputError);
    expect(() => optimizeCuts([{ id: 'a', label: 'A', length: 100, qty: 1 }], [bar(6000)], opt(-1))).toThrow(CutInputError);
  });

  it('coincide con el mínimo exacto en 400 casos aleatorios', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 400; t++) {
      const L = [3000, 6000, 6100][Math.floor(rnd() * 3)];
      const kerf = [0, 1.5, 2.5, 3][Math.floor(rnd() * 4)];
      const nTypes = 1 + Math.floor(rnd() * 4);
      const pieces: CutPiece[] = [];
      for (let i = 0; i < nTypes; i++) {
        pieces.push({ id: `p${i}`, label: `P${i}`, length: Math.round((150 + rnd() * (L * 0.7)) * 2) / 2, qty: 1 + Math.floor(rnd() * 3) });
      }
      const o = opt(kerf);
      const r = optimizeCuts(pieces, [bar(L)], o);
      checkAll(r, o, pieces);
      const lengths = pieces.flatMap((p) => Array(p.qty).fill(p.length));
      expect(r.totals.bars, `caso ${t}: ${JSON.stringify({ L, kerf, pieces })}`).toBe(bruteMinBars(lengths, L, kerf));
    }
  });

  it('instancia grande se resuelve rápido y sin errores', () => {
    const pieces: CutPiece[] = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, length: 237.5 + i * 97.3, qty: 8 + (i % 5) }));
    const o = opt(2.5, 5);
    const t0 = Date.now();
    const r = optimizeCuts(pieces, [bar(6100)], o);
    expect(Date.now() - t0).toBeLessThan(5000);
    checkAll(r, o, pieces);
    expect(r.totals.bars).toBeLessThanOrEqual(r.lowerBound! + 2);
  });
});
