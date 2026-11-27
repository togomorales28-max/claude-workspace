import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, Pencil, Plus, Trash2, UserX, FileText } from 'lucide-react';
import { db } from '@/data/db';
import { clientsRepo } from '@/data/repo';
import { Button, EmptyState, IconButton, StatusBadge } from '@/components/ui';
import { useConfirm } from '@/components/ui/confirm';
import { dateShort, money, waPhone } from '@/domain/format';
import { jobTypeLabel } from '@/domain/constants';
import { ClientForm } from './ClientForm';
import { newQuote } from '@/data/factory';
import { useSettings } from '@/lib/hooks';

export function ClientDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const settings = useSettings();
  const client = useLiveQuery(async () => (await db.clients.get(id)) ?? null, [id]);
  const quotes = useLiveQuery(() => db.quotes.where('clientId').equals(id).reverse().sortBy('createdAt'), [id]);
  const [edit, setEdit] = useState(false);

  if (client === undefined || !quotes) return <div className="h-64" />;
  if (client === null)
    return (
      <EmptyState
        icon={UserX}
        title="Cliente no encontrado"
        action={
          <Link to="/clientes">
            <Button>Ver clientes</Button>
          </Link>
        }
      />
    );

  const won = quotes.filter((q) => q.status === 'accepted' || q.status === 'completed');
  const done = quotes.filter((q) => q.status === 'completed');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton icon={ArrowLeft} label="Volver" onClick={() => navigate('/clientes')} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-ink-400">
              {[client.phone, client.email, client.address].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {client.phone && (
            <a href={`https://wa.me/${waPhone(client.phone)}`} target="_blank" rel="noopener noreferrer">
              <Button icon={MessageCircle}>WhatsApp</Button>
            </a>
          )}
          <Button icon={Pencil} onClick={() => setEdit(true)}>
            Editar
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            disabled={!settings}
            onClick={() =>
              settings &&
              navigate('/cotizaciones/nueva', {
                state: { prefill: { ...newQuote(settings), clientId: client.id, clientName: client.name, clientPhone: client.phone } },
              })
            }
          >
            Cotizar
          </Button>
          <IconButton
            icon={Trash2}
            tone="danger"
            label="Eliminar cliente"
            onClick={async () => {
              if (
                await confirm({
                  title: `¿Eliminar a ${client.name}?`,
                  description: 'Sus cotizaciones se conservan con el nombre guardado.',
                  confirmLabel: 'Eliminar',
                  danger: true,
                })
              ) {
                await clientsRepo.remove(client.id);
                toast.success('Cliente eliminado');
                navigate('/clientes');
              }
            }}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-ink-750 bg-ink-750" style={{ gap: 1 }}>
        {[
          ['Cotizaciones', String(quotes.length)],
          ['Aceptadas', `${won.length} · ${money(won.reduce((a, q) => a + q.totals.total, 0))}`],
          ['Trabajos realizados', String(done.length)],
        ].map(([k, v]) => (
          <div key={k} className="bg-ink-850 px-4 py-3">
            <div className="text-xs text-ink-400">{k}</div>
            <div className="num mt-1 truncate text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>
      {client.notes && <p className="mb-6 rounded-lg bg-ink-850 px-4 py-3 text-sm text-ink-300">{client.notes}</p>}

      <h2 className="mb-3 text-sm font-semibold">Historial de cotizaciones</h2>
      {quotes.length === 0 ? (
        <div className="rounded-xl border border-ink-750 bg-ink-850">
          <EmptyState icon={FileText} title="Sin cotizaciones" description="Crea la primera cotización para este cliente." />
        </div>
      ) : (
        <ul className="divide-y divide-ink-750 overflow-hidden rounded-xl border border-ink-750 bg-ink-850">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link to={`/cotizaciones/${q.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-ink-800/60 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{q.title}</div>
                  <div className="text-xs text-ink-500">
                    <span className="font-mono">{q.number}</span> · {jobTypeLabel(q.jobType)} · {dateShort(q.createdAt)}
                  </div>
                </div>
                <StatusBadge status={q.status} />
                <div className="num w-28 text-right text-sm font-semibold">{money(q.totals.total)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ClientForm open={edit} onClose={() => setEdit(false)} client={client} />
    </div>
  );
}
