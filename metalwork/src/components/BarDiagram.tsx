import type { BarLayout } from '../domain/cutting';
import { num } from '../lib/format';

/** Paleta para distinguir tipos de pieza sobre fondo oscuro (y legible en impresión). */
export const PIECE_COLORS = ['#2f8cff', '#22b3a6', '#e0a43a', '#9b7bff', '#e86f8a', '#5cc46b', '#3fb6e8', '#d9824a', '#b4c24a', '#c46fd0'];

export function pieceColor(pieceId: string, order: string[]) {
  const i = order.indexOf(pieceId);
  return PIECE_COLORS[(i < 0 ? 0 : i) % PIECE_COLORS.length];
}

/**
 * Diagrama técnico de una barra a escala: despunte, piezas, cortes (kerf) y sobrante.
 * Las posiciones se calculan como porcentaje de la longitud real.
 */
export function BarDiagram({ bar, kerf, trim, order, count, index }:
  { bar: BarLayout; kerf: number; trim: number; order: string[]; count?: number; index?: number }) {
  const L = bar.stockLength;
  const pct = (v: number) => `${(v / L) * 100}%`;
  const segs: { kind: 'trim' | 'kerf' | 'piece' | 'off'; start: number; len: number; label?: string; id?: string }[] = [];
  if (trim > 0) {
    segs.push({ kind: 'trim', start: 0, len: trim });
    segs.push({ kind: 'kerf', start: trim, len: kerf });
  }
  bar.cuts.forEach((c, i) => {
    if (i > 0) segs.push({ kind: 'kerf', start: c.start - kerf, len: kerf });
    segs.push({ kind: 'piece', start: c.start, len: c.length, label: c.label, id: c.pieceId });
  });
  const last = bar.cuts[bar.cuts.length - 1];
  const end = last ? last.start + last.length : (trim > 0 ? trim + kerf : 0);
  const rest = L - end;
  if (rest > 0) {
    const k = Math.min(kerf, rest);
    if (k > 0 && bar.cuts.length) segs.push({ kind: 'kerf', start: end, len: k });
    if (bar.offcut > 0) segs.push({ kind: 'off', start: L - bar.offcut, len: bar.offcut });
  }
  const util = bar.piecesLength / L;

  return (
    <div className="rounded-md border border-line bg-base/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-2">
          {index !== undefined && <span className="num text-mute">#{index}</span>}
          <span className="font-medium text-ink">{bar.isOffcut ? 'Retazo' : bar.stockLabel} · <span className="num">{num(L)} mm</span></span>
          {count && count > 1 && <span className="num rounded bg-volt/15 px-1.5 py-0.5 text-volt-2">× {count} barras</span>}
        </div>
        <div className="num flex gap-3 text-mute">
          <span>Uso <span className="text-ink-2">{(util * 100).toFixed(1)} %</span></span>
          <span>Sobrante <span className={bar.reusable ? 'text-ok' : 'text-ink-2'}>{num(bar.offcut)} mm</span></span>
        </div>
      </div>
      <div className="relative h-11 overflow-hidden rounded-[3px] bg-raised ring-1 ring-line-2" role="img"
        aria-label={`Barra de ${L} mm con ${bar.cuts.length} piezas y ${bar.offcut} mm de sobrante`}>
        {segs.map((s, i) => {
          const style = { left: pct(s.start), width: pct(s.len) } as const;
          if (s.kind === 'kerf') return <div key={i} className="absolute inset-y-0 bg-bad min-w-[1.5px]" style={style} title={`Corte ${num(s.len)} mm`} />;
          if (s.kind === 'trim') return <div key={i} className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,#3a4757_0_3px,transparent_3px_6px)]" style={style} title={`Despunte ${num(s.len)} mm`} />;
          if (s.kind === 'off') return (
            <div key={i} className={`absolute inset-y-0 flex items-center justify-center overflow-hidden ${bar.reusable ? 'bg-[repeating-linear-gradient(135deg,rgba(47,192,138,.22)_0_4px,transparent_4px_8px)] ring-1 ring-inset ring-ok/40' : 'bg-[repeating-linear-gradient(135deg,#2a3644_0_4px,transparent_4px_8px)]'}`}
              style={style} title={`Sobrante ${num(s.len)} mm${bar.reusable ? ' (reutilizable)' : ''}`}>
              {s.len / L >= 0.075 && <span className="num whitespace-nowrap px-1 text-[10px] text-ink-2">{num(s.len)}</span>}
            </div>
          );
          const c = pieceColor(s.id!, order);
          return (
            <div key={i} className="absolute inset-y-0 flex flex-col items-center justify-center overflow-hidden border-x border-black/25 leading-none"
              style={{ ...style, background: `linear-gradient(180deg, ${c}, color-mix(in srgb, ${c} 78%, #000))` }}
              title={`${s.label}: ${num(s.len)} mm (inicia en ${num(s.start)} mm)`}>
              {s.len / L >= 0.075 && <span className="num whitespace-nowrap px-0.5 text-[11px] font-medium text-[#04101f]">{num(s.len)}</span>}
              {s.len / L >= 0.12 && <span className="truncate px-0.5 text-[9px] text-[#04101f]/75 max-sm:hidden">{s.label}</span>}
            </div>
          );
        })}
      </div>
      {/* regla de cotas */}
      <div className="relative mt-1 h-3.5 text-[10px] text-mute num">
        <span className="absolute left-0">0</span>
        {bar.cuts.length > 0 && end / L < 0.9 && end / L > 0.08 && (
          <span className="absolute -translate-x-1/2" style={{ left: pct(end) }}>{num(end)}</span>
        )}
        <span className="absolute right-0">{num(L)}</span>
      </div>
    </div>
  );
}

export function DiagramLegend({ items }: { items: { id: string; label: string; length: number; qty: number; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.id} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label} <span className="num text-mute">{num(i.length)} × {i.qty}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-[2px] bg-bad" />Corte</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm ring-1 ring-ok/50 bg-ok/20" />Sobrante reutilizable</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#2a3644]" />Desperdicio</span>
    </div>
  );
}
