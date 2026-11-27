import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useQuotes } from '@/lib/hooks';
import { quotesRepo } from '@/data/repo';
import { Button, EmptyState, IconButton, Input, PageHeader, StatusBadge } from '@/components/ui';
import { useConfirm } from '@/components/ui/confirm';
import { STATUSES, jobTypeLabel } from '@/domain/constants';
import { dateShort, money } from '@/domain/format';
import type { Quote, QuoteStatus } from '@/domain/types';
import { cn } from '@/lib/cn';

export function QuotesList() {
  const quotes = useQuotes();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const status = (params.get('estado') as QuoteStatus | null) ?? null;
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (quotes ?? []).filter(
      (x) =>
        (!status || x.status === status) &&
        (!term || [x.number, x.title, x.clientName, jobTypeLabel(x.jobType)].some((f) => f.toLowerCase().includes(term))),
    );
  }, [quotes, q, status]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of quotes ?? []) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [quotes]);

  const duplicate = async (x: Quote) => {
    const c = await quotesRepo.duplicate(x.id);
    toast.success(`Duplicada como ${c.number}`);
    navigate(`/cotizaciones/${c.id}/editar`);
  };
  const remove = async (x: Quote) => {
    if (await confirm({ title: `¿Eliminar ${x.number}?`, description: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true })) {
      await quotesRepo.remove(x.id);
      toast.success('Cotización eliminada');
    }
  };

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={quotes ? `${quotes.length} en total` : ' '}
        actions={
          <Link to="/cotizaciones/nueva">
            <Button variant="primary" icon={Plus}>
              Nueva cotización
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio, cliente o trabajo…" className="pl-9" aria-label="Buscar" />
        </div>
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ id: null, label: 'Todas' }, ...STATUSES].map((s) => (
            <button
              key={s.id ?? 'all'}
              type="button"
              onClick={() => setParams(s.id ? { estado: s.id } : {}, { replace: true })}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                status === s.id ? 'border-ember-500 bg-ember-500/12 text-ember-300' : 'border-ink-700 text-ink-300 hover:border-ink-600',
              )}
            >
              {s.label}
              <span className="num ml-1.5 text-ink-500">{s.id ? (counts[s.id] ?? 0) : (quotes?.length ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>

      {!quotes ? (
        <div className="h-40" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-ink-750 bg-ink-850">
          <EmptyState
            icon={FileText}
            title={quotes.length ? 'Sin resultados' : 'Aún no tienes cotizaciones'}
            description={quotes.length ? 'Cambia el filtro o la búsqueda.' : 'Crea tu primera cotización y calcula cuánto cobrar.'}
            action={
              !quotes.length && (
                <Link to="/cotizaciones/nueva">
                  <Button variant="primary" icon={Plus}>
                    Nueva cotización
                  </Button>
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-750 bg-ink-850">
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-ink-750 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3 font-medium">Folio</th>
                <th className="px-4 py-3 font-medium">Trabajo</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Costo</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="w-24 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-750">
              {filtered.map((x) => (
                <tr key={x.id} className="group cursor-pointer transition-colors hover:bg-ink-800/60" onClick={() => navigate(`/cotizaciones/${x.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-ink-300">{x.number}</td>
                  <td className="max-w-64 px-4 py-3">
                    <div className="truncate font-medium text-ink-100">{x.title}</div>
                    <div className="text-xs text-ink-500">{jobTypeLabel(x.jobType)}</div>
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 text-ink-300">{x.clientName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={x.status} />
                  </td>
                  <td className="num px-4 py-3 text-right text-ink-400">{money(x.totals.cost)}</td>
                  <td className="num px-4 py-3 text-right font-medium text-ink-100">{money(x.totals.total)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-400">{dateShort(x.createdAt)}</td>
                  <td className="px-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end opacity-60 transition-opacity group-hover:opacity-100">
                      <IconButton icon={Copy} label="Duplicar" onClick={() => duplicate(x)} />
                      <IconButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => remove(x)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-ink-750 md:hidden">
            {filtered.map((x) => (
              <li key={x.id}>
                <Link to={`/cotizaciones/${x.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5 active:bg-ink-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-ink-500">{x.number}</span>
                      <StatusBadge status={x.status} className="h-5 px-2 text-[11px]" />
                    </div>
                    <div className="mt-1 truncate font-medium">{x.title}</div>
                    <div className="truncate text-xs text-ink-400">
                      {x.clientName} · {dateShort(x.createdAt)}
                    </div>
                  </div>
                  <div className="num shrink-0 text-right font-semibold">{money(x.totals.total)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
