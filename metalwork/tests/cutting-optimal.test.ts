import { it, expect } from 'vitest';
import { optimizeCuts, verifyLayout } from '../src/domain/cutting';
function brute(w0: number[], cap: number) {
  const w = [...w0].sort((a, b) => b - a); let best = w.length; const bins: number[] = [];
  const rec = (i: number) => { if (bins.length >= best) return; if (i === w.length) { best = bins.length; return; }
    const seen = new Set<number>(); for (let b = 0; b < bins.length; b++) if (bins[b] + w[i] <= cap && !seen.has(bins[b])) { seen.add(bins[b]); bins[b] += w[i]; rec(i + 1); bins[b] -= w[i]; }
    bins.push(w[i]); rec(i + 1); bins.pop(); };
  rec(0); return best;
}
it('600 casos con piezas de varias medidas: siempre el mínimo exacto de barras', () => {
  let seed = 99; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let worse = 0, n = 600;
  for (let t = 0; t < n; t++) {
    const L = 6000, k = 3;
    const pieces = Array.from({ length: 2 + Math.floor(rnd() * 4) }, (_, i) => ({ id: `p${i}`, label: `P${i}`, length: Math.round(200 + rnd() * 2800), qty: 1 + Math.floor(rnd() * 4) }));
    const r = optimizeCuts(pieces, [{ id: 's', label: 's', length: L, qty: null }], { kerf: k, trimStart: 0, minReusable: 0 });
    r.bars.forEach((b) => expect(verifyLayout(b, { kerf: k, trimStart: 0, minReusable: 0 })).toBeNull());
    const opt = brute(pieces.flatMap((p) => Array(p.qty).fill(p.length + k)), L + k);
    if (r.totals.bars > opt) worse++;
    expect(r.totals.bars).toBeGreaterThanOrEqual(opt);
  }
  expect(worse).toBe(0);
});
