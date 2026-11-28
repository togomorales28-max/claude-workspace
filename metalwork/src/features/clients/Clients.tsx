import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Pencil, Trash2, Search, Phone, Mail } from 'lucide-react';
import { Button, Empty, Field, IconButton, Modal, PageHeader, TextArea, TextInput, useUi } from '../../components/ui';
import { useClients, useQuotes } from '../../data/hooks';
import { nowIso, repos, uid } from '../../data/repo';
import type { Client } from '../../data/types';
import { money } from '../../lib/format';

export const blankClient = (): Client => ({ id: uid(), createdAt: nowIso(), updatedAt: nowIso(), name: '', phone: '', email: '', address: '', rfc: '', notes: '' });

export function Clients() {
  const clients = useClients();
  const quotes = useQuotes();
  const { confirm, toast } = useUi();
  const [edit, setEdit] = useState<Client | null>(null);
  const [q, setQ] = useState('');
  const list = useMemo(() => (clients ?? [])
    .filter((c) => !q.trim() || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')), [clients, q]);

  const remove = async (c: Client) => {
    const n = quotes?.filter((x) => x.clientId === c.id).length ?? 0;
    if (await confirm({ title: 'Eliminar cliente', text: n ? `«${c.name}» tiene ${n} presupuesto(s); quedarán como «Público en general».` : `Se eliminará «${c.name}».`, confirmLabel: 'Eliminar', danger: true })) {
      await repos.clients.remove(c.id);
      for (const x of quotes?.filter((x) => x.clientId === c.id) ?? []) await repos.quotes.save({ ...x, clientId: null });
      toast('Cliente eliminado');
    }
  };

  return (
    <div className="rise">
      <PageHeader eyebrow="Registro" title="Clientes" subtitle="Datos de contacto que aparecen en tus cotizaciones."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit(blankClient())}>Nuevo cliente</Button>} />
      {clients && clients.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <input className="field pl-9" placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </div>
      )}
      {clients === undefined ? null : clients.length === 0 ? (
        <Empty icon={<Users className="size-8" />} title="Sin clientes" text="Registra a tus clientes para usarlos en presupuestos y planes de corte."
          action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit(blankClient())}>Agregar cliente</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const qs = quotes?.filter((x) => x.clientId === c.id) ?? [];
            const won = qs.filter((x) => x.status === 'aceptada' || x.status === 'terminada').reduce((s, x) => s + (x.snapshot?.total ?? 0), 0);
            return (
              <div key={c.id} className="rounded-lg border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    {c.rfc && <div className="num text-xs text-mute">RFC {c.rfc}</div>}
                  </div>
                  <div className="flex shrink-0">
                    <IconButton label="Editar" onClick={() => setEdit(c)}><Pencil className="size-4" /></IconButton>
                    <IconButton label="Eliminar" onClick={() => remove(c)} className="hover:!text-bad"><Trash2 className="size-4" /></IconButton>
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-ink-2">
                  {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-volt-2"><Phone className="size-3.5 text-mute" />{c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 truncate hover:text-volt-2"><Mail className="size-3.5 text-mute" />{c.email}</a>}
                  {c.address && <div className="truncate text-xs text-mute">{c.address}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs">
                  <span className="text-mute">{qs.length} presupuesto(s)</span>
                  <span className="num text-ink-2">Aceptado: {money(won)}</span>
                </div>
                {qs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {qs.slice(0, 4).map((x) => <Link key={x.id} to={`/presupuestos/${x.id}`} className="num rounded border border-line-2 px-1.5 py-0.5 text-[11px] text-ink-2 hover:border-volt hover:text-volt-2">{x.number}</Link>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {edit && <ClientModal initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function ClientModal({ initial, onClose, onSaved }: { initial: Client; onClose: () => void; onSaved?: (c: Client) => void }) {
  const [c, setC] = useState(initial);
  const [touched, setTouched] = useState(false);
  const { toast } = useUi();
  const save = async () => {
    setTouched(true);
    if (!c.name.trim()) return;
    const saved = await repos.clients.save({ ...c, name: c.name.trim() });
    toast('Cliente guardado');
    onSaved?.(saved);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial.name ? 'Editar cliente' : 'Nuevo cliente'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre o razón social" className="sm:col-span-2" error={touched && !c.name.trim() ? 'Escribe el nombre.' : null}>{(id) => <TextInput id={id} value={c.name} onChange={(v) => setC({ ...c, name: v })} autoFocus />}</Field>
        <Field label="Teléfono">{(id) => <TextInput id={id} type="tel" inputMode="tel" value={c.phone} onChange={(v) => setC({ ...c, phone: v })} />}</Field>
        <Field label="Correo">{(id) => <TextInput id={id} type="email" inputMode="email" value={c.email} onChange={(v) => setC({ ...c, email: v })} />}</Field>
        <Field label="Dirección" className="sm:col-span-2">{(id) => <TextInput id={id} value={c.address} onChange={(v) => setC({ ...c, address: v })} />}</Field>
        <Field label="RFC" hint="Opcional, si requiere factura">{(id) => <TextInput id={id} value={c.rfc} onChange={(v) => setC({ ...c, rfc: v.toUpperCase() })} maxLength={13} />}</Field>
        <Field label="Notas" className="sm:col-span-2">{(id) => <TextArea id={id} value={c.notes} onChange={(v) => setC({ ...c, notes: v })} />}</Field>
      </div>
    </Modal>
  );
}
