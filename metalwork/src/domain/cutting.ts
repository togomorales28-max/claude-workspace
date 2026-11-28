/**
 * Optimizador de cortes unidimensional (cutting stock 1D) con ancho de corte (kerf).
 *
 * Modelo físico de una barra de longitud L:
 *   - Despunte inicial T (opcional): se cortan T mm del extremo para emparejarlo, y ese corte consume un kerf k.
 *   - Cada pieza se separa de la siguiente con un corte, que consume k.
 *   - Al final queda un resto r = L − inicio − Σpiezas − (n−1)·k.
 *       r = 0      → la última pieza llega justo al final y no hay corte final.
 *       0 < r ≤ k  → el corte final se come el resto; el sobrante es 0.
 *       r > k      → el sobrante útil es r − k.
 *   Restricción: inicio + Σpiezas + (n−1)·k ≤ L. Nunca se excede la longitud real.
 *
 * Para la búsqueda se usan pesos w = pieza + k y capacidad C = L − inicio + k,
 * que equivale exactamente a la restricción anterior.
 *
 * Toda la aritmética se hace en enteros de 0.01 mm para evitar errores de redondeo.
 */

export interface CutPiece {
  id: string;
  label: string;
  /** Longitud de la pieza en mm */
  length: number;
  qty: number;
}

export interface StockBar {
  id: string;
  label: string;
  /** Longitud en mm */
  length: number;
  /** Cantidad disponible; null = ilimitada (barra comercial) */
  qty: number | null;
  /** Costo por barra (MXN). Opcional: solo sirve para comparar soluciones con varias longitudes comerciales. */
  cost?: number | null;
  /** Retazo de inventario: se usa antes que las barras nuevas. */
  isOffcut?: boolean;
}

export interface CutOptions {
  /** Ancho de corte del disco (mm) */
  kerf: number;
  /** Despunte del extremo inicial de cada barra (mm) */
  trimStart: number;
  /** Longitud mínima para considerar reutilizable un sobrante (mm) */
  minReusable: number;
}

export interface PlacedCut {
  pieceId: string;
  label: string;
  length: number;
  /** Posición de inicio en mm, medida desde el extremo izquierdo de la barra */
  start: number;
}

export interface BarLayout {
  stockId: string;
  stockLabel: string;
  stockLength: number;
  isOffcut: boolean;
  cuts: PlacedCut[];
  /** Σ longitudes de piezas */
  piecesLength: number;
  /** Material perdido en cortes (incluye el kerf del despunte) */
  kerfLoss: number;
  /** Material del despunte */
  trimLoss: number;
  /** Sobrante al final de la barra, después del último corte */
  offcut: number;
  /** El sobrante alcanza la longitud mínima reutilizable */
  reusable: boolean;
}

export interface BarPattern {
  key: string;
  count: number;
  bar: BarLayout;
}

export interface UnplacedPiece {
  pieceId: string;
  label: string;
  length: number;
  qty: number;
  reason: string;
}

export interface CutTotals {
  bars: number;
  /** Barras nuevas (no retazos) por tipo de stock */
  purchased: { stockId: string; label: string; length: number; count: number; cost: number | null }[];
  offcutsUsed: number;
  piecesCount: number;
  piecesLength: number;
  stockLength: number;
  kerfLoss: number;
  trimLoss: number;
  reusableOffcut: number;
  scrapOffcut: number;
  /** stockLength − piecesLength */
  waste: number;
  /** piecesLength / stockLength (0–1) */
  utilization: number;
  /** Desperdicio real (excluyendo sobrantes reutilizables) / stockLength */
  scrapRatio: number;
}

export interface CutResult {
  bars: BarLayout[];
  patterns: BarPattern[];
  unplaced: UnplacedPiece[];
  totals: CutTotals;
  strategy: string;
  /** Cota inferior de barras (solo con un tipo de barra comercial y sin retazos) */
  lowerBound: number | null;
  /** Se demostró que el número de barras es mínimo */
  provenOptimal: boolean;
  warnings: string[];
}

export class CutInputError extends Error {}

const SCALE = 100; // 0.01 mm
const toU = (mm: number) => Math.round(mm * SCALE);
const toMm = (u: number) => u / SCALE;

interface PieceType { idx: number; id: string; label: string; len: number /* u */; w: number /* u */; count: number }
interface StockType { id: string; label: string; length: number; cap: number; startU: number; qty: number | null; cost: number | null; isOffcut: boolean }

interface RawBar { stock: StockType; pieces: number[] /* índices de tipo */ }

export function validateCutInput(pieces: CutPiece[], stock: StockBar[], opt: CutOptions): string[] {
  const errs: string[] = [];
  if (!Number.isFinite(opt.kerf) || opt.kerf < 0) errs.push('El ancho de corte debe ser 0 o mayor.');
  if (!Number.isFinite(opt.trimStart) || opt.trimStart < 0) errs.push('El despunte debe ser 0 o mayor.');
  if (!Number.isFinite(opt.minReusable) || opt.minReusable < 0) errs.push('El sobrante mínimo reutilizable debe ser 0 o mayor.');
  if (pieces.length === 0) errs.push('Agrega al menos una pieza.');
  for (const p of pieces) {
    if (!Number.isFinite(p.length) || p.length <= 0) errs.push(`La pieza «${p.label || 'sin nombre'}» necesita una longitud mayor que 0.`);
    if (!Number.isInteger(p.qty) || p.qty < 1) errs.push(`La pieza «${p.label || 'sin nombre'}» necesita una cantidad entera de 1 o más.`);
  }
  if (stock.length === 0) errs.push('Define al menos una longitud de barra.');
  for (const s of stock) {
    if (!Number.isFinite(s.length) || s.length <= 0) errs.push(`La barra «${s.label}» necesita una longitud mayor que 0.`);
    if (s.qty !== null && (!Number.isInteger(s.qty) || s.qty < 0)) errs.push(`La cantidad de «${s.label}» debe ser un entero.`);
  }
  return errs;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Llenado máximo de una barra: subconjunto de piezas restantes que deja el menor resto posible
 * (mochila acotada por alcanzabilidad, con descomposición binaria de cantidades).
 * Devuelve las cantidades por tipo de pieza.
 */
function bestFill(types: PieceType[], remaining: number[], cap: number): number[] {
  const res = new Array(types.length).fill(0);
  // Elementos 0/1 por descomposición binaria
  const itemType: number[] = [];
  const itemMult: number[] = [];
  const itemW: number[] = [];
  for (let i = 0; i < types.length; i++) {
    let c = Math.min(remaining[i], Math.floor(cap / types[i].w));
    let m = 1;
    while (c > 0) {
      const take = Math.min(m, c);
      itemType.push(i); itemMult.push(take); itemW.push(take * types[i].w);
      c -= take; m *= 2;
    }
  }
  if (itemW.length === 0) return res;

  // Reducción por máximo común divisor. Si la capacidad sigue siendo muy grande,
  // se redondean los pesos hacia arriba y la capacidad hacia abajo: es conservador y
  // nunca produce una combinación que no quepa.
  let g = cap;
  for (const w of itemW) g = gcd(g, w);
  let step = g;
  const MAX_CAP = 120_000;
  if (cap / step > MAX_CAP) step = Math.ceil(cap / MAX_CAP);
  const C = Math.floor(cap / step);
  const W = itemW.map((w) => Math.ceil(w / step));

  const from = new Int32Array(C + 1).fill(-1);
  from[0] = -2; // alcanzable sin elementos
  let best = 0;
  for (let it = 0; it < W.length; it++) {
    const w = W[it];
    if (w > C) continue;
    for (let s = C; s >= w; s--) {
      if (from[s] === -1 && from[s - w] !== -1) {
        from[s] = it;
        if (s > best) best = s;
      }
    }
    if (best === C) break;
  }
  let s = best;
  while (s > 0) {
    const it = from[s];
    res[itemType[it]] += itemMult[it];
    s -= W[it];
  }
  return res;
}

function makeTypes(pieces: CutPiece[], kerfU: number): PieceType[] {
  // Fusiona piezas iguales (misma etiqueta y longitud) y ordena de mayor a menor
  const map = new Map<string, PieceType>();
  pieces.forEach((p) => {
    const len = toU(p.length);
    const key = `${p.id}`;
    const ex = map.get(key);
    if (ex) ex.count += p.qty;
    else map.set(key, { idx: 0, id: p.id, label: p.label, len, w: len + kerfU, count: p.qty });
  });
  const arr = [...map.values()].sort((a, b) => b.len - a.len || a.label.localeCompare(b.label));
  arr.forEach((t, i) => (t.idx = i));
  return arr;
}

function makeStock(stock: StockBar[], kerfU: number, trimU: number): StockType[] {
  return stock
    .filter((s) => s.qty === null || s.qty > 0)
    .map((s) => {
      const L = toU(s.length);
      const startU = trimU > 0 ? trimU + kerfU : 0;
      return {
        id: s.id, label: s.label, length: L, startU,
        cap: L - startU + kerfU,
        qty: s.qty, cost: s.cost ?? null, isOffcut: !!s.isOffcut,
      };
    });
}

/** Estrategia 1: llenado máximo barra por barra, con repetición de patrones. */
function solveMaxFill(types: PieceType[], stocks: StockType[]): RawBar[] {
  const remaining = types.map((t) => t.count);
  const avail = stocks.map((s) => (s.qty === null ? Infinity : s.qty));
  const bars: RawBar[] = [];
  const left = () => remaining.some((r) => r > 0);

  // Fase 1: retazos de inventario, del más largo al más corto
  const offIdx = stocks.map((_, i) => i).filter((i) => stocks[i].isOffcut).sort((a, b) => stocks[b].length - stocks[a].length);
  for (const si of offIdx) {
    while (avail[si] > 0 && left()) {
      const fill = bestFill(types, remaining, stocks[si].cap);
      if (fill.every((f) => f === 0)) break;
      applyFill(fill, si);
    }
  }
  // Fase 2: barras nuevas; en cada paso se elige la barra con mejor aprovechamiento
  const newIdx = stocks.map((_, i) => i).filter((i) => !stocks[i].isOffcut);
  while (left()) {
    let bestSi = -1, bestFillV: number[] = [], bestScore = -1;
    for (const si of newIdx) {
      if (avail[si] <= 0) continue;
      const fill = bestFill(types, remaining, stocks[si].cap);
      const used = fill.reduce((a, f, i) => a + f * types[i].len, 0);
      if (used === 0) continue;
      const score = used / stocks[si].length;
      if (score > bestScore + 1e-12) { bestScore = score; bestSi = si; bestFillV = fill; }
    }
    if (bestSi < 0) break;
    // Repetir el patrón mientras alcance: el resultado es el mismo que recalcular y es mucho más rápido
    let rep = Infinity;
    bestFillV.forEach((f, i) => { if (f > 0) rep = Math.min(rep, Math.floor(remaining[i] / f)); });
    rep = Math.max(1, Math.min(rep, avail[bestSi]));
    for (let r = 0; r < rep; r++) applyFill(bestFillV, bestSi);
  }
  return bars;

  function applyFill(fill: number[], si: number) {
    const ps: number[] = [];
    fill.forEach((f, i) => { for (let k = 0; k < f; k++) ps.push(i); remaining[i] -= f; });
    avail[si] -= 1;
    bars.push({ stock: stocks[si], pieces: ps });
  }
}

/** Estrategias 2 y 3: First Fit Decreasing / Best Fit Decreasing. */
function solveFitDecreasing(types: PieceType[], stocks: StockType[], mode: 'first' | 'best'): RawBar[] {
  const order: number[] = [];
  types.forEach((t, i) => { for (let k = 0; k < t.count; k++) order.push(i); });
  const avail = stocks.map((s) => (s.qty === null ? Infinity : s.qty));
  const open: { bar: RawBar; free: number }[] = [];
  const offFirst = stocks.map((_, i) => i).sort((a, b) =>
    Number(stocks[b].isOffcut) - Number(stocks[a].isOffcut) || stocks[b].length - stocks[a].length);

  for (const pi of order) {
    const w = types[pi].w;
    let target = -1;
    if (mode === 'first') {
      target = open.findIndex((o) => o.free >= w);
    } else {
      let bestFree = Infinity;
      open.forEach((o, i) => { if (o.free >= w && o.free - w < bestFree) { bestFree = o.free - w; target = i; } });
    }
    if (target < 0) {
      const si = offFirst.find((i) => avail[i] > 0 && stocks[i].cap >= w);
      if (si === undefined) continue; // queda sin colocar
      avail[si] -= 1;
      open.push({ bar: { stock: stocks[si], pieces: [] }, free: stocks[si].cap });
      target = open.length - 1;
    }
    open[target].bar.pieces.push(pi);
    open[target].free -= w;
  }
  return open.map((o) => o.bar);
}

/**
 * Estrategia 4: mejora local sobre una solución. Intenta vaciar la barra menos aprovechada
 * repartiendo sus piezas en el espacio libre de las demás.
 */
function improve(types: PieceType[], bars: RawBar[]): RawBar[] {
  const sol = bars.map((b) => ({ stock: b.stock, pieces: [...b.pieces] }));
  const free = (b: RawBar) => b.stock.cap - b.pieces.reduce((a, p) => a + types[p].w, 0);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    // barra con menos material usado
    const idx = sol.map((_, i) => i).sort((a, b) =>
      sol[a].pieces.reduce((s, p) => s + types[p].len, 0) - sol[b].pieces.reduce((s, p) => s + types[p].len, 0));
    for (const victim of idx) {
      const pieces = [...sol[victim].pieces].sort((a, b) => types[b].w - types[a].w);
      const frees = sol.map((b, i) => (i === victim ? -1 : free(b)));
      const placement: number[] = [];
      let ok = true;
      for (const p of pieces) {
        let best = -1, bestRest = Infinity;
        frees.forEach((f, i) => { if (f >= types[p].w && f - types[p].w < bestRest) { bestRest = f - types[p].w; best = i; } });
        if (best < 0) { ok = false; break; }
        frees[best] -= types[p].w;
        placement.push(best);
      }
      if (ok) {
        pieces.forEach((p, k) => sol[placement[k]].pieces.push(p));
        sol.splice(victim, 1);
        changed = true;
        break;
      }
    }
  }
  return sol;
}

/**
 * Estrategia 5: búsqueda exacta (ramificación y acotamiento) para un solo tipo de barra.
 * Solo se ejecuta si la heurística no alcanzó la cota inferior. Tiene un límite de nodos,
 * así que en instancias grandes se queda con la mejor solución heurística.
 */
function exactSearch(types: PieceType[], stock: StockType, target: number, lb: number, nodeLimit = 300_000): { bars: RawBar[] | null; complete: boolean } {
  const items: number[] = [];
  types.forEach((t, i) => { for (let k = 0; k < t.count; k++) items.push(i); });
  items.sort((a, b) => types[b].w - types[a].w);
  const cap = stock.cap;
  let bestBins: number[][] | null = null;
  let best = target; // buscamos estrictamente menos que la heurística
  const loads: number[] = [];
  const bins: number[][] = [];
  let nodes = 0;
  let remainingW = items.reduce((s, i) => s + types[i].w, 0);
  const rec = (k: number): boolean => {
    if (++nodes > nodeLimit) return true;
    if (k === items.length) {
      if (bins.length < best) { best = bins.length; bestBins = bins.map((b) => [...b]); }
      return best <= lb;
    }
    const free = loads.reduce((s, l) => s + (cap - l), 0);
    const extra = Math.max(0, Math.ceil((remainingW - free) / cap));
    if (bins.length + extra >= best) return false;
    const it = items[k], w = types[it].w;
    const seen = new Set<number>();
    remainingW -= w;
    for (let b = 0; b < bins.length; b++) {
      if (loads[b] + w <= cap && !seen.has(loads[b])) {
        seen.add(loads[b]);
        loads[b] += w; bins[b].push(it);
        const stop = rec(k + 1);
        loads[b] -= w; bins[b].pop();
        if (stop) { remainingW += w; return true; }
      }
    }
    if (bins.length + 1 < best) {
      loads.push(w); bins.push([it]);
      const stop = rec(k + 1);
      loads.pop(); bins.pop();
      if (stop) { remainingW += w; return true; }
    }
    remainingW += w;
    return false;
  };
  rec(0);
  const found = bestBins as number[][] | null;
  return { bars: found ? found.map((p) => ({ stock, pieces: p })) : null, complete: nodes <= nodeLimit };
}

function layout(types: PieceType[], raw: RawBar, kerfU: number, trimU: number, minReusableU: number): BarLayout {
  const s = raw.stock;
  const ps = [...raw.pieces].sort((a, b) => types[b].len - types[a].len || a - b);
  let pos = s.startU;
  const cuts: PlacedCut[] = [];
  let piecesU = 0;
  ps.forEach((pi, k) => {
    if (k > 0) pos += kerfU;
    cuts.push({ pieceId: types[pi].id, label: types[pi].label, length: toMm(types[pi].len), start: toMm(pos) });
    pos += types[pi].len;
    piecesU += types[pi].len;
  });
  const r = s.length - pos;
  if (r < 0) throw new Error('Error interno: la distribución excede la longitud de la barra.');
  const interKerf = Math.max(0, ps.length - 1) * kerfU;
  const trimKerf = trimU > 0 ? kerfU : 0;
  let finalKerf = 0, offU = 0;
  if (ps.length === 0) { offU = s.length - s.startU; }
  else if (r > kerfU) { finalKerf = kerfU; offU = r - kerfU; }
  else { finalKerf = r; offU = 0; }
  return {
    stockId: s.id, stockLabel: s.label, stockLength: toMm(s.length), isOffcut: s.isOffcut,
    cuts, piecesLength: toMm(piecesU),
    kerfLoss: toMm(interKerf + trimKerf + finalKerf),
    trimLoss: toMm(trimU > 0 ? trimU : 0),
    offcut: toMm(offU),
    reusable: offU > 0 && offU >= minReusableU,
  };
}

interface Scored { name: string; raw: RawBar[] }

function compare(types: PieceType[], a: Scored, b: Scored): number {
  const placed = (x: Scored) => x.raw.reduce((s, r) => s + r.pieces.length, 0);
  const newLen = (x: Scored) => x.raw.filter((r) => !r.stock.isOffcut).reduce((s, r) => s + r.stock.length, 0);
  const allCosted = (x: Scored) => x.raw.every((r) => r.stock.isOffcut || r.stock.cost != null);
  const cost = (x: Scored) => x.raw.reduce((s, r) => s + (r.stock.isOffcut ? 0 : r.stock.cost ?? 0), 0);
  const newBars = (x: Scored) => x.raw.filter((r) => !r.stock.isOffcut).length;
  const offUsed = (x: Scored) => x.raw.filter((r) => r.stock.isOffcut).reduce((s, r) => s + r.stock.length, 0);
  const maxOff = (x: Scored) => Math.max(0, ...x.raw.map((r) => r.stock.cap - r.pieces.reduce((s, p) => s + types[p].w, 0)));
  return (
    placed(b) - placed(a) ||
    (allCosted(a) && allCosted(b) ? cost(a) - cost(b) : 0) ||
    newLen(a) - newLen(b) ||
    newBars(a) - newBars(b) ||
    offUsed(b) - offUsed(a) || // a igual compra, aprovechar retazos del inventario
    a.raw.length - b.raw.length ||
    maxOff(b) - maxOff(a) // a igual consumo, mejor un sobrante grande que varios chicos
  );
}

export function optimizeCuts(pieces: CutPiece[], stock: StockBar[], opt: CutOptions): CutResult {
  const errs = validateCutInput(pieces, stock, opt);
  if (errs.length) throw new CutInputError(errs.join(' '));

  const kerfU = toU(opt.kerf);
  const trimU = toU(opt.trimStart);
  const minReusableU = toU(opt.minReusable);
  const types = makeTypes(pieces, kerfU);
  const stocks = makeStock(stock, kerfU, trimU);
  const warnings: string[] = [];

  const maxCap = Math.max(0, ...stocks.map((s) => s.cap));
  const tooLong = types.filter((t) => t.w > maxCap);
  const fitTypes = types.filter((t) => t.w <= maxCap);
  const usable = fitTypes.map((t, i) => ({ ...t, idx: i }));

  const candidates: Scored[] = [];
  if (usable.length) {
    const mf = solveMaxFill(usable, stocks);
    candidates.push({ name: 'Llenado óptimo por barra', raw: mf });
    const ffd = solveFitDecreasing(usable, stocks, 'first');
    candidates.push({ name: 'First Fit Decreasing', raw: ffd });
    const bfd = solveFitDecreasing(usable, stocks, 'best');
    candidates.push({ name: 'Best Fit Decreasing', raw: bfd });
    const best0 = [...candidates].sort((a, b) => compare(usable, a, b))[0];
    candidates.push({ name: `${best0.name} + mejora local`, raw: improve(usable, best0.raw) });
  }
  let best = candidates.sort((a, b) => compare(usable, a, b))[0] ?? { name: '—', raw: [] };

  // Búsqueda exacta cuando hay un solo tipo de barra nueva y la heurística no llegó a la cota
  let exhaustive = false;
  const single = stocks.length === 1 && !stocks[0].isOffcut && stocks[0].qty === null;
  if (single && usable.length && best.raw.length) {
    const lb0 = Math.ceil(usable.reduce((s, t) => s + t.w * t.count, 0) / stocks[0].cap);
    if (best.raw.length > lb0) {
      const ex = exactSearch(usable, stocks[0], best.raw.length, lb0);
      if (ex.bars && ex.bars.length < best.raw.length) best = { name: 'Búsqueda exacta', raw: ex.bars };
      // búsqueda completa: ninguna solución usa menos barras que la encontrada
      exhaustive = ex.complete;
    }
  }

  // Barras ordenadas: retazos primero, luego por aprovechamiento descendente
  const bars = best.raw
    .map((r) => layout(usable, r, kerfU, trimU, minReusableU))
    .sort((a, b) => Number(b.isOffcut) - Number(a.isOffcut) || b.piecesLength / b.stockLength - a.piecesLength / a.stockLength);

  // Piezas sin colocar
  const placedCount = new Map<string, number>();
  bars.forEach((b) => b.cuts.forEach((c) => placedCount.set(c.pieceId, (placedCount.get(c.pieceId) ?? 0) + 1)));
  const unplaced: UnplacedPiece[] = [];
  for (const t of types) {
    const missing = t.count - (placedCount.get(t.id) ?? 0);
    if (missing > 0) {
      unplaced.push({
        pieceId: t.id, label: t.label, length: toMm(t.len), qty: missing,
        reason: tooLong.includes(t)
          ? 'Es más larga que la longitud útil de cualquier barra (considerando despunte).'
          : 'No hay suficientes barras disponibles.',
      });
    }
  }

  // Totales
  const stockLength = bars.reduce((s, b) => s + b.stockLength, 0);
  const piecesLength = bars.reduce((s, b) => s + b.piecesLength, 0);
  const reusableOffcut = bars.reduce((s, b) => s + (b.reusable ? b.offcut : 0), 0);
  const scrapOffcut = bars.reduce((s, b) => s + (b.reusable ? 0 : b.offcut), 0);
  const kerfLoss = bars.reduce((s, b) => s + b.kerfLoss, 0);
  const trimLoss = bars.reduce((s, b) => s + b.trimLoss, 0);
  const purchasedMap = new Map<string, CutTotals['purchased'][number]>();
  bars.filter((b) => !b.isOffcut).forEach((b) => {
    const st = stock.find((s) => s.id === b.stockId)!;
    const e = purchasedMap.get(b.stockId) ?? { stockId: b.stockId, label: b.stockLabel, length: b.stockLength, count: 0, cost: st.cost ?? null };
    e.count += 1;
    purchasedMap.set(b.stockId, e);
  });
  const round = (n: number) => Math.round(n * SCALE) / SCALE;
  const waste = round(stockLength - piecesLength);

  // Cota inferior: un solo tipo de barra nueva, sin retazos, sin límite
  let lowerBound: number | null = null;
  if (stocks.length === 1 && !stocks[0].isOffcut && stocks[0].qty === null && usable.length) {
    const sumW = usable.reduce((s, t) => s + t.w * t.count, 0);
    // piezas que necesitan barra propia (más de la mitad) también acotan
    const half = usable.filter((t) => t.w * 2 > stocks[0].cap).reduce((s, t) => s + t.count, 0);
    lowerBound = Math.max(Math.ceil(sumW / stocks[0].cap), half);
  }
  const newBars = bars.filter((b) => !b.isOffcut).length;
  const provenOptimal = unplaced.length === 0 && ((lowerBound !== null && newBars === lowerBound) || exhaustive);

  if (opt.kerf === 0) warnings.push('El ancho de corte es 0: el resultado no considera el material que se pierde en cada corte.');
  if (unplaced.length) warnings.push('Hay piezas sin colocar. Revisa las longitudes o agrega barras.');

  // Patrones repetidos
  const patMap = new Map<string, BarPattern>();
  for (const b of bars) {
    const key = `${b.stockId}|${b.cuts.map((c) => `${c.pieceId}:${c.length}`).join(',')}`;
    const ex = patMap.get(key);
    if (ex) ex.count++;
    else patMap.set(key, { key, count: 1, bar: b });
  }

  return {
    bars,
    patterns: [...patMap.values()],
    unplaced,
    strategy: best.name,
    lowerBound,
    provenOptimal,
    warnings,
    totals: {
      bars: bars.length,
      purchased: [...purchasedMap.values()],
      offcutsUsed: bars.filter((b) => b.isOffcut).length,
      piecesCount: bars.reduce((s, b) => s + b.cuts.length, 0),
      piecesLength: round(piecesLength),
      stockLength: round(stockLength),
      kerfLoss: round(kerfLoss),
      trimLoss: round(trimLoss),
      reusableOffcut: round(reusableOffcut),
      scrapOffcut: round(scrapOffcut),
      waste,
      utilization: stockLength > 0 ? piecesLength / stockLength : 0,
      scrapRatio: stockLength > 0 ? (stockLength - piecesLength - reusableOffcut) / stockLength : 0,
    },
  };
}

/** Verificación independiente de una solución: se usa en pruebas y como salvaguarda. */
export function verifyLayout(bar: BarLayout, opt: CutOptions): string | null {
  const eps = 1e-6;
  const startMin = opt.trimStart > 0 ? opt.trimStart + opt.kerf : 0;
  let prevEnd = -Infinity;
  for (let i = 0; i < bar.cuts.length; i++) {
    const c = bar.cuts[i];
    if (i === 0 && c.start < startMin - eps) return 'La primera pieza invade el despunte.';
    if (i > 0 && c.start < prevEnd + opt.kerf - eps) return 'Dos piezas no respetan el ancho de corte.';
    prevEnd = c.start + c.length;
    if (prevEnd > bar.stockLength + eps) return 'Una pieza excede la longitud de la barra.';
  }
  return null;
}
