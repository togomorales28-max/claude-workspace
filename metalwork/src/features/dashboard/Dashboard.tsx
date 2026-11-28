import { Link, useNavigate } from 'react-router-dom';
import { Scissors, Weight, FileText, Package, ArrowUpRight, Check, Circle } from 'lucide-react';
import { Badge, Panel, Stat, cx } from '../../components/ui';
import { useClients, useCutPlans, useMaterials, useQuotes, useSettings } from '../../data/hooks';
import { QUOTE_STATUS } from '../../data/types';
import { createPlan } from '../cutter/CutPlans';
import { createQuote } from '../../lib/quoteFactory';
import { dateMx, fixed, kg, money, num, pct } from '../../lib/format';
import { statusTone } from '../quotes/Quotes';

export function Dashboard() {
  const quotes = useQuotes();
  const plans = useCutPlans();
  const materials = useMaterials();
  const clients = useClients();
  const settings = useSettings();
  const nav = useNavigate();
  if (!quotes || !plans || !materials || !settings) return null;

  const won = quotes.filter((q) => q.status === 'aceptada' || q.status === 'terminada');
  const open = quotes.filter((q) => q.status === 'borrador' || q.status === 'enviada');
  const profitWon = won.reduce((s, q) => s + (q.snapshot?.profit ?? 0), 0);
  const profitOpen = open.reduce((s, q) => s + (q.snapshot?.profit ?? 0), 0);
  const sold = won.reduce((s, q) => s + (q.snapshot?.total ?? 0), 0);
  const sum = plans.reduce((a, p) => {
    const s = p.summary;
    if (!s) return a;
    return { len: a.len + s.stockLength, pieces: a.pieces + s.piecesLength, waste: a.waste + s.waste, kg: a.kg + s.kg, wasteKg: a.wasteKg + s.wasteKg, bars: a.bars + s.newBars };
  }, { len: 0, pieces: 0, waste: 0, kg: 0, wasteKg: 0, bars: 0 });

  const recent = [
    ...quotes.map((q) => ({ kind: 'q' as const, id: q.id, title: q.title, sub: `${q.number} · ${clients?.find((c) => c.id === q.clientId)?.name ?? 'Sin cliente'}`, at: q.updatedAt, status: q.status, value: q.snapshot?.total })),
    ...plans.map((p) => ({ kind: 'p' as const, id: p.id, title: p.name, sub: `${p.groups.length} material(es) · ${p.summary ? `${p.summary.newBars} barras` : 'sin calcular'}`, at: p.updatedAt, status: null, value: null })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);

  const setup = [
    { done: !!settings.shop.name.trim(), label: 'Escribe el nombre de tu taller', to: '/ajustes' },
    { done: settings.budget.laborRate > 0, label: 'Define tu costo de mano de obra por hora', to: '/ajustes' },
    { done: materials.length > 0, label: 'Registra tus materiales con precios', to: '/catalogo' },
    { done: plans.length > 0, label: 'Optimiza tu primer plan de corte', to: '/cortes' },
    { done: quotes.length > 0, label: 'Crea tu primer presupuesto', to: '/presupuestos' },
  ];
  const pending = setup.filter((s) => !s.done).length;
  const staleMaterials = materials.filter((m) => m.pricePerBar == null && m.pricePerKg == null).length;

  const quick = [
    { label: 'Nuevo plan de corte', hint: 'Optimizar barras', icon: Scissors, run: async () => nav(`/cortes/${(await createPlan(settings)).id}`) },
    { label: 'Calcular peso', hint: 'Perfiles y placa', icon: Weight, run: async () => nav('/peso') },
    { label: 'Nuevo presupuesto', hint: 'Costos y precio', icon: FileText, run: async () => nav(`/presupuestos/${(await createQuote(settings)).id}`) },
    { label: 'Catálogo de precios', hint: `${materials.length} materiales`, icon: Package, run: async () => nav('/catalogo') },
  ];

  return (
    <div className="rise">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1 text-volt-2">Panel principal</div>
          <h1 className="text-2xl font-semibold tracking-tight">{settings.shop.name || 'Metalwork Calculator'}</h1>
          <p className="mt-1 text-sm text-ink-2">Cálculo de materiales, optimización de cortes y presupuestos.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {quick.map((q) => (
          <button key={q.label} type="button" onClick={q.run}
            className="group flex items-center gap-3 rounded-lg border border-line bg-panel px-3.5 py-3 text-left transition-[border-color,background-color,transform] hover:border-volt/60 hover:bg-panel-2 active:scale-[0.98]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-volt/12 text-volt-2 ring-1 ring-volt/25"><q.icon className="size-[18px]" strokeWidth={1.8} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug">{q.label}</span>
              <span className="block truncate text-xs text-mute">{q.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cotizaciones" value={num(quotes.length, 0)} sub={`${open.length} abiertas · ${won.length} aceptadas`} />
        <Stat label="Material calculado" value={sum.kg > 0 ? kg(sum.kg, 0) : `${fixed(sum.len / 1000, 1)} m`}
          sub={`${num(sum.bars, 0)} barras · ${fixed(sum.len / 1000, 1)} m en ${plans.length} plan(es)`} />
        <Stat label="Desperdicio calculado" value={sum.len ? pct(sum.waste / sum.len) : '—'} tone={sum.len && sum.waste / sum.len > 0.2 ? 'warn' : 'default'}
          sub={`${fixed(sum.waste / 1000, 2)} m${sum.wasteKg > 0 ? ` · ${kg(sum.wasteKg, 1)}` : ''}`} />
        <Stat label="Ganancia estimada" value={money(profitWon)} tone="ok" sub={`de ${money(sold)} vendido · ${money(profitOpen)} por cerrar`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Últimos proyectos" eyebrow="Actividad" pad={false}>
          {recent.length === 0 ? <p className="px-4 py-10 text-center text-sm text-mute">Aún no hay proyectos. Usa los accesos rápidos para empezar.</p> : (
            <ul>
              {recent.map((r) => (
                <li key={r.kind + r.id}>
                  <Link to={r.kind === 'q' ? `/presupuestos/${r.id}` : `/cortes/${r.id}`} className="group flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-panel-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-mute">
                      {r.kind === 'q' ? <FileText className="size-4" /> : <Scissors className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium group-hover:text-volt-2">{r.title}</span>
                      <span className="block truncate text-xs text-mute">{r.sub} · {dateMx(r.at)}</span>
                    </span>
                    {r.status && <span className="hidden sm:inline"><Badge tone={statusTone(r.status)}>{QUOTE_STATUS.find((s) => s.id === r.status)?.label}</Badge></span>}
                    {r.value != null && <span className="num text-sm">{money(r.value)}</span>}
                    <ArrowUpRight className="size-4 text-mute opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-5">
          {pending > 0 && (
            <Panel title="Preparar el taller" eyebrow={`${setup.length - pending} de ${setup.length}`}>
              <ul className="space-y-1">
                {setup.map((s) => (
                  <li key={s.label}>
                    <Link to={s.to} className={cx('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-raised', s.done ? 'text-mute line-through' : 'text-ink')}>
                      {s.done ? <Check className="size-4 text-ok" /> : <Circle className="size-4 text-mute" />}{s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Estado de cotizaciones" eyebrow="Resumen">
            {quotes.length === 0 ? <p className="text-sm text-mute">Sin cotizaciones.</p> : (
              <>
                <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-raised">
                  {QUOTE_STATUS.map((s, i) => {
                    const n = quotes.filter((q) => q.status === s.id).length;
                    return n ? <div key={s.id} style={{ width: `${(n / quotes.length) * 100}%`, background: ['#74839a', '#f0b03a', '#2fc08a', '#f2594b', '#2f8cff'][i] }} /> : null;
                  })}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {QUOTE_STATUS.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-2 text-ink-2"><i className="size-2 rounded-sm" style={{ background: ['#74839a', '#f0b03a', '#2fc08a', '#f2594b', '#2f8cff'][i] }} />{s.label}</dt>
                      <dd className="num">{quotes.filter((q) => q.status === s.id).length}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </Panel>
          {staleMaterials > 0 && (
            <Link to="/catalogo" className="block rounded-lg border border-warn/35 bg-warn/8 px-4 py-3 text-sm text-warn hover:bg-warn/12">
              {staleMaterials} material(es) del catálogo sin precio. Captúralos para presupuestar con exactitud.
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
