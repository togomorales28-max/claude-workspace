import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Copy, Trash2 } from 'lucide-react';
import { Badge, Button, Empty, IconButton, PageHeader, Select, useUi } from '../../components/ui';
import { useClients, useQuotes, useSettings } from '../../data/hooks';
import { nowIso, repos, todayIso, uid } from '../../data/repo';
import { QUOTE_STATUS, type Quote, type QuoteStatus } from '../../data/types';
import { createQuote } from '../../lib/quoteFactory';
import { dateMx, money, pct } from '../../lib/format';

export const statusTone = (s: QuoteStatus) =>
  s === 'aceptada' ? 'ok' : s === 'terminada' ? 'volt' : s === 'rechazada' ? 'bad' : s === 'enviada' ? 'warn' : 'default';

export function Quotes() {
  const quotes = useQuotes();
  const clients = useClients();
  const settings = useSettings();
  const nav = useNavigate();
  const { confirm, toast } = useUi();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'' | QuoteStatus>('');

  const list = useMemo(() => (quotes ?? []).filter((x) => !st || x.status === st).filter((x) => {
    if (!q.trim()) return true;
    const c = clients?.find((c) => c.id === x.clientId)?.name ?? '';
    return `${x.number} ${x.title} ${c}`.toLowerCase().includes(q.trim().toLowerCase());
  }).sort((a, b) => b.number.localeCompare(a.number, 'es', { numeric: true })), [quotes, clients, q, st]);

  if (!settings) return null;
  const create = async () => { const x = await createQuote(settings); nav(`/presupuestos/${x.id}`); };
  const duplicate = async (x: Quote) => {
    const number = await repos.nextQuoteNumber();
    const copy = await repos.quotes.save({ ...structuredClone(x), id: uid(), number, status: 'borrador', date: todayIso(), createdAt: nowIso(), title: `${x.title} (copia)` });
    toast(`Duplicado como ${number}`);
    nav(`/presupuestos/${copy.id}`);
  };
  const remove = async (x: Quote) => {
    if (await confirm({ title: 'Eliminar presupuesto', text: `Se eliminará ${x.number} «${x.title}». Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })) {
      await repos.quotes.remove(x.id); toast('Presupuesto eliminado');
    }
  };

  return (
    <div className="rise">
      <PageHeader eyebrow="Módulo 03" title="Presupuestos"
        subtitle="Costo real de fabricación, utilidad y precio final. Cada presupuesto se convierte en una cotización en PDF."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>Nuevo presupuesto</Button>} />

      {quotes && quotes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
            <input className="field pl-9" placeholder="Buscar por folio, trabajo o cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          </div>
          <Select value={st} onChange={setSt} className="w-auto min-w-[160px]" ariaLabel="Estado"
            options={[{ value: '' as const, label: 'Todos los estados' }, ...QUOTE_STATUS.map((s) => ({ value: s.id, label: s.label }))]} />
        </div>
      )}

      {quotes === undefined ? null : quotes.length === 0 ? (
        <Empty icon={<FileText className="size-8" />} title="Sin presupuestos"
          text="Crea un presupuesto desde cero o desde un plan de corte para que los materiales se llenen solos."
          action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>Crear presupuesto</Button>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="hidden md:grid grid-cols-[100px_1fr_110px_120px_120px_90px_76px] gap-3 border-b border-line px-4 py-2.5 eyebrow">
            <span>Folio</span><span>Trabajo · cliente</span><span>Estado</span><span className="text-right">Costo</span><span className="text-right">Precio</span><span className="text-right">Margen</span><span />
          </div>
          {list.map((x) => {
            const c = clients?.find((c) => c.id === x.clientId);
            const s = x.snapshot;
            return (
              <div key={x.id} className="group grid grid-cols-[1fr_auto] md:grid-cols-[100px_1fr_110px_120px_120px_90px_76px] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 hover:bg-panel-2 transition-colors">
                <span className="num hidden md:block text-sm text-volt-2">{x.number}</span>
                <Link to={`/presupuestos/${x.id}`} className="min-w-0">
                  <div className="truncate font-medium group-hover:text-volt-2 transition-colors"><span className="num md:hidden text-volt-2 mr-2 text-sm">{x.number}</span>{x.title}</div>
                  <div className="truncate text-xs text-mute">{c?.name ?? 'Sin cliente'} · {dateMx(x.date)}</div>
                  <div className="mt-1 flex items-center gap-2 md:hidden">
                    <Badge tone={statusTone(x.status)}>{QUOTE_STATUS.find((s) => s.id === x.status)?.label}</Badge>
                    <span className="num text-sm">{money(s?.total)}</span>
                  </div>
                </Link>
                <span className="hidden md:block"><Badge tone={statusTone(x.status)}>{QUOTE_STATUS.find((s) => s.id === x.status)?.label}</Badge></span>
                <span className="num hidden md:block text-right text-ink-2">{money(s?.cost)}</span>
                <span className="num hidden md:block text-right">{money(s?.total)}</span>
                <span className="num hidden md:block text-right text-ink-2">{s && s.cost + s.profit > 0 ? pct(s.profit / (s.cost + s.profit)) : '—'}</span>
                <div className="flex justify-end">
                  <IconButton label="Duplicar" onClick={() => duplicate(x)}><Copy className="size-4" /></IconButton>
                  <IconButton label="Eliminar" onClick={() => remove(x)} className="hover:!text-bad"><Trash2 className="size-4" /></IconButton>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p className="py-8 text-center text-sm text-mute">Ningún presupuesto coincide.</p>}
        </div>
      )}
    </div>
  );
}
