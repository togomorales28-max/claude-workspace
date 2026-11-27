import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Check, FileText, Plus, Ruler, Package, Settings as Cog, FlaskConical } from 'lucide-react';
import { useMaterials, useQuotes, useSettings } from '@/lib/hooks';
import { Button, EmptyState, StatusBadge } from '@/components/ui';
import { dateShort, money, moneyShort, pct } from '@/domain/format';
import { jobTypeLabel, STATUSES } from '@/domain/constants';
import { db } from '@/data/db';
import { cn } from '@/lib/cn';

export function Dashboard() {
  const quotes = useQuotes();
  const settings = useSettings();
  const materials = useMaterials();
  const demoCount = useLiveQuery(() => db.quotes.filter((q) => !!q.isDemo).count(), []);

  const stats = useMemo(() => {
    const list = quotes ?? [];
    const won = list.filter((q) => q.status === 'accepted' || q.status === 'completed');
    const pending = list.filter((q) => q.status === 'draft' || q.status === 'sent');
    const decided = list.filter((q) => ['accepted', 'completed', 'rejected'].includes(q.status));
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: list.length,
      thisMonth: list.filter((q) => q.createdAt.startsWith(month)).length,
      pending: pending.length,
      pendingValue: pending.reduce((a, q) => a + q.totals.total, 0),
      won: won.length,
      quoted: list.filter((q) => q.status !== 'rejected').reduce((a, q) => a + q.totals.total, 0),
      wonValue: won.reduce((a, q) => a + q.totals.total, 0),
      profit: won.reduce((a, q) => a + q.totals.profit, 0),
      conversion: decided.length ? (won.length / decided.length) * 100 : null,
      byStatus: STATUSES.map((s) => ({ ...s, n: list.filter((q) => q.status === s.id).length })),
    };
  }, [quotes]);

  if (!quotes || !settings || !materials) return <div className="h-64" />;

  const setup = [
    { done: !!settings.shopName, label: 'Datos del taller y logotipo', to: '/configuracion', icon: Cog },
    { done: settings.laborRate > 0, label: 'Costo de mano de obra por hora', to: '/configuracion', icon: Cog },
    { done: materials.some((m) => m.price > 0 && !m.isDemo), label: 'Tus materiales con precios reales', to: '/materiales', icon: Package },
    { done: quotes.some((q) => !q.isDemo), label: 'Tu primera cotización', to: '/cotizaciones/nueva', icon: FileText },
  ];
  const setupLeft = setup.filter((s) => !s.done).length;
  const recent = quotes.slice(0, 6);
  const greeting = settings.ownerName ? `Hola, ${settings.ownerName.split(' ')[0]}` : 'Panel';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-ember-400">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{greeting}</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/estimador">
            <Button icon={Ruler}>Estimar por medida</Button>
          </Link>
          <Link to="/cotizaciones/nueva" className="hidden sm:block">
            <Button variant="primary" icon={Plus}>
              Nueva cotización
            </Button>
          </Link>
        </div>
      </header>

      {!!demoCount && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-warn">
            <FlaskConical className="size-4" /> Estás viendo datos de demostración con precios ilustrativos.
          </span>
          <Link to="/configuracion" className="font-medium text-warn underline">
            Eliminar demostración
          </Link>
        </div>
      )}

      {/* Indicadores */}
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-ink-750 bg-ink-750 lg:grid-cols-5" style={{ gap: 1 }}>
        <Stat label="Cotizaciones" value={String(stats.total)} sub={`${stats.thisMonth} este mes`} />
        <Stat label="Pendientes" value={String(stats.pending)} sub={`${moneyShort(stats.pendingValue)} por cerrar`} />
        <Stat label="Aceptadas" value={String(stats.won)} sub={stats.conversion === null ? 'Sin decisiones aún' : `${pct(stats.conversion, 0)} de cierre`} />
        <Stat label="Total cotizado" value={moneyShort(stats.quoted)} sub="Sin contar rechazadas" />
        <Stat label="Ganancia estimada" value={moneyShort(stats.profit)} sub={`de ${moneyShort(stats.wonValue)} aceptado`} accent className="col-span-2 lg:col-span-1" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-ink-750 bg-ink-850">
          <div className="flex items-center justify-between border-b border-ink-750 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Trabajos recientes</h2>
            {quotes.length > 0 && (
              <Link to="/cotizaciones" className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100">
                Ver todas <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Todavía no hay cotizaciones"
              description="Calcula tu primer trabajo: materiales, mano de obra, gastos y ganancia en un solo flujo."
              action={
                <Link to="/cotizaciones/nueva">
                  <Button variant="primary" icon={Plus}>
                    Crear cotización
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-750">
              {recent.map((q) => (
                <li key={q.id}>
                  <Link to={`/cotizaciones/${q.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{q.title}</div>
                      <div className="truncate text-xs text-ink-500">
                        <span className="font-mono">{q.number}</span> · {q.clientName} · {jobTypeLabel(q.jobType)}
                      </div>
                    </div>
                    <StatusBadge status={q.status} className="hidden sm:inline-flex" />
                    <div className="text-right">
                      <div className="num text-sm font-semibold">{money(q.totals.total)}</div>
                      <div className="text-[11px] text-ink-500">{dateShort(q.createdAt)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {setupLeft > 0 && (
            <section className="rounded-xl border border-ink-750 bg-ink-850 p-5">
              <h2 className="text-sm font-semibold">Prepara tu taller</h2>
              <p className="mt-0.5 text-xs text-ink-400">
                {setupLeft} {setupLeft === 1 ? 'paso pendiente' : 'pasos pendientes'} para cotizar con tus números reales.
              </p>
              <ol className="mt-4 flex flex-col gap-1">
                {setup.map((s) => (
                  <li key={s.label}>
                    <Link to={s.to} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-ink-800">
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full border',
                          s.done ? 'border-ok bg-ok text-ink-950' : 'border-ink-600',
                        )}
                      >
                        {s.done && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={cn(s.done ? 'text-ink-500 line-through' : 'text-ink-200')}>{s.label}</span>
                      {!s.done && <ArrowRight className="ml-auto size-3.5 text-ink-500" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="rounded-xl border border-ink-750 bg-ink-850 p-5">
            <h2 className="mb-4 text-sm font-semibold">Por estado</h2>
            {stats.total === 0 ? (
              <p className="text-sm text-ink-500">Sin datos todavía.</p>
            ) : (
              <>
                <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-ink-750">
                  {stats.byStatus.map(
                    (s) =>
                      s.n > 0 && (
                        <div
                          key={s.id}
                          className={cn({ draft: 'bg-ink-400', sent: 'bg-info', accepted: 'bg-ok', rejected: 'bg-bad', completed: 'bg-ember-400' }[s.id])}
                          style={{ width: `${(s.n / stats.total) * 100}%` }}
                        />
                      ),
                  )}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {stats.byStatus.map((s) => (
                    <li key={s.id}>
                      <Link to={`/cotizaciones?estado=${s.id}`} className="flex items-center justify-between rounded-md py-0.5 text-sm hover:text-ink-100">
                        <StatusBadge status={s.id} />
                        <span className="num text-ink-300">{s.n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent, className }: { label: string; value: string; sub: string; accent?: boolean; className?: string }) {
  return (
    <div className={cn('bg-ink-850 px-4 py-4 sm:px-5', className)}>
      <div className="text-xs text-ink-400">{label}</div>
      <div className={cn('num mt-1.5 truncate text-2xl font-semibold tracking-tight', accent ? 'text-ember-400' : 'text-ink-100')}>{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-ink-500">{sub}</div>
    </div>
  );
}
