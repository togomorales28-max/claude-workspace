import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Phone, ChevronRight } from 'lucide-react';
import { useClients, useQuotes } from '@/lib/hooks';
import { Button, EmptyState, Input, PageHeader } from '@/components/ui';
import { moneyShort } from '@/domain/format';
import { ClientForm } from './ClientForm';

export function ClientsPage() {
  const clients = useClients();
  const quotes = useQuotes();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; won: number }>();
    for (const x of quotes ?? []) {
      if (!x.clientId) continue;
      const s = m.get(x.clientId) ?? { n: 0, won: 0 };
      s.n++;
      if (x.status === 'accepted' || x.status === 'completed') s.won += x.totals.total;
      m.set(x.clientId, s);
    }
    return m;
  }, [quotes]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (clients ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || c.phone.includes(t));
  }, [clients, q]);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={clients ? `${clients.length} registrados` : ' '}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setForm(true)}>
            Nuevo cliente
          </Button>
        }
      />
      {!clients ? (
        <div className="h-40" />
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-ink-750 bg-ink-850">
          <EmptyState
            icon={Users}
            title="Sin clientes todavía"
            description="Registra clientes aquí o directamente al crear una cotización."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setForm(true)}>
                Registrar cliente
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="relative mb-4 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono…" className="pl-9" aria-label="Buscar cliente" />
          </div>
          <ul className="divide-y divide-ink-750 overflow-hidden rounded-xl border border-ink-750 bg-ink-850">
            {filtered.map((c) => {
              const s = stats.get(c.id);
              return (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-ink-800/60 sm:px-5">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-750 text-sm font-semibold text-ink-200">
                      {c.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="flex items-center gap-1 text-xs text-ink-500">
                        {c.phone ? (
                          <>
                            <Phone className="size-3" /> {c.phone}
                          </>
                        ) : (
                          'Sin teléfono'
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-ink-400">
                      <div>{s?.n ?? 0} cotizaciones</div>
                      {!!s?.won && <div className="num text-ok">{moneyShort(s.won)} ganado</div>}
                    </div>
                    <ChevronRight className="size-4 text-ink-600" />
                  </Link>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-500">Sin resultados.</li>}
          </ul>
        </>
      )}
      <ClientForm open={form} onClose={() => setForm(false)} />
    </div>
  );
}
