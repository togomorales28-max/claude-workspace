import type { Breakdown } from '@/domain/calc';
import { money, pct, decimal } from '@/domain/format';
import { cn } from '@/lib/cn';

function Row({ label, value, sub, strong, muted }: { label: string; value: string; sub?: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5 text-sm', muted && 'text-ink-400')}>
      <span className={cn('min-w-0', strong ? 'font-semibold text-ink-100' : 'text-ink-300')}>
        {label}
        {sub && <span className="ml-1.5 text-xs text-ink-500">{sub}</span>}
      </span>
      <span className={cn('num shrink-0', strong ? 'font-semibold text-ink-100' : 'text-ink-200')}>{value}</span>
    </div>
  );
}

/** Desglose completo de costos y precio — se actualiza en tiempo real. */
export function CostSummary({ b, quantity, taxPct }: { b: Breakdown; quantity: number; taxPct: number }) {
  const costParts = [
    { k: 'Materiales', v: b.materials, c: 'bg-ember-500' },
    { k: 'Desperdicio', v: b.waste, c: 'bg-ember-300' },
    { k: 'Consumibles', v: b.consumables, c: 'bg-warn' },
    { k: 'Mano de obra', v: b.labor, c: 'bg-info' },
    { k: 'Adicionales', v: b.additional, c: 'bg-ok' },
    { k: 'Imprevistos', v: b.contingency, c: 'bg-ink-400' },
  ];
  return (
    <div>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-ink-750" aria-hidden>
        {b.cost > 0 &&
          costParts.map((p) => p.v > 0 && <div key={p.k} className={cn(p.c, 'transition-[width] duration-300')} style={{ width: `${(p.v / b.cost) * 100}%` }} />)}
      </div>
      <div className="divide-y divide-ink-750/70">
        <div className="pb-2">
          {costParts.map((p) => (
            <div key={p.k} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="flex items-center gap-2 text-ink-300">
                <span className={cn('size-2 rounded-sm', p.c)} />
                {p.k}
                {p.k === 'Mano de obra' && b.laborHours > 0 && <span className="text-xs text-ink-500">{decimal(b.laborHours)} h</span>}
              </span>
              <span className="num text-ink-200">{money(p.v)}</span>
            </div>
          ))}
        </div>
        <div className="py-2">
          <Row label="Costo total" value={money(b.cost)} strong />
          <Row label="Ganancia" value={money(b.profit)} sub={`${pct(b.marginPct)} s/venta · ${pct(b.markupPct)} s/costo`} />
          {!b.isManual && b.roundedPrice !== b.recommendedPrice && (
            <Row label="Redondeo" value={`+ ${money(b.roundedPrice - b.recommendedPrice)}`} muted />
          )}
          {b.isManual && <Row label="Precio recomendado" value={money(b.roundedPrice)} muted />}
        </div>
        <div className="pt-2">
          <Row label={b.isManual ? 'Precio de venta (manual)' : 'Precio de venta'} value={money(b.price)} strong />
          {b.tax > 0 && <Row label={`IVA ${taxPct} %`} value={money(b.tax)} />}
          {quantity > 1 && <Row label="Precio por pieza" value={money(b.price / quantity)} muted />}
        </div>
      </div>
      {b.profit < 0 && (
        <p className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
          El precio está por debajo del costo: perderías {money(-b.profit)}.
        </p>
      )}
      {b.error && <p className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{b.error}</p>}
    </div>
  );
}
