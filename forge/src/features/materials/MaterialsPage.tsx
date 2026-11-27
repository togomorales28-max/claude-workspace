import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { History, Package, Pencil, Plus, Search, Trash2, ListPlus, TrendingUp, TrendingDown } from 'lucide-react';
import { useMaterials } from '@/lib/hooks';
import { materialsRepo } from '@/data/repo';
import { Button, EmptyState, Field, IconButton, Input, Modal, NumberInput, PageHeader, Segmented, Select, Textarea } from '@/components/ui';
import { useConfirm } from '@/components/ui/confirm';
import { CATEGORY_KIND, MATERIAL_CATEGORIES, UNITS, unitShort } from '@/domain/constants';
import { dateShort, money, pct } from '@/domain/format';
import { validateMaterial, type Errors } from '@/domain/validation';
import type { Material, MaterialKind } from '@/domain/types';
import { cn } from '@/lib/cn';

type Draft = { id?: string; name: string; category: string; kind: MaterialKind; unit: string; price: number; notes: string };
const emptyDraft = (): Draft => ({ name: '', category: 'Tubular', kind: 'material', unit: 'tramo', price: 0, notes: '' });

export function MaterialsPage() {
  const materials = useMaterials();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [history, setHistory] = useState<Material | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (materials ?? []).filter((m) => (!cat || m.category === cat) && (!term || m.name.toLowerCase().includes(term)));
  }, [materials, q, cat]);
  const noPrice = (materials ?? []).filter((m) => m.price === 0).length;
  const usedCats = useMemo(() => [...new Set((materials ?? []).map((m) => m.category))], [materials]);

  const save = async () => {
    if (!draft) return;
    const e = validateMaterial(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = { name: draft.name.trim(), category: draft.category, kind: draft.kind, unit: draft.unit, price: draft.price, notes: draft.notes.trim() };
    try {
      if (draft.id) {
        await materialsRepo.update(draft.id, data);
        toast.success('Material actualizado');
      } else {
        await materialsRepo.create(data);
        toast.success('Material agregado');
      }
      setDraft(null);
    } catch (err) {
      toast.error('No se pudo guardar', { description: (err as Error).message });
    }
  };

  const open = (m?: Material) => {
    setErrors({});
    setDraft(m ? { id: m.id, name: m.name, category: m.category, kind: m.kind, unit: m.unit, price: m.price, notes: m.notes ?? '' } : emptyDraft());
  };

  return (
    <div>
      <PageHeader
        title="Catálogo de materiales"
        subtitle="Tus precios reales. Se usan al armar cada cotización."
        actions={
          <>
            {materials && materials.length > 0 && (
              <Button
                icon={ListPlus}
                variant="ghost"
                onClick={async () => {
                  const n = await materialsRepo.addStarter();
                  toast.success(n ? `${n} materiales comunes agregados sin precio` : 'Ya tienes todos los materiales comunes');
                }}
              >
                Agregar comunes
              </Button>
            )}
            <Button variant="primary" icon={Plus} onClick={() => open()}>
              Nuevo material
            </Button>
          </>
        }
      />

      {noPrice > 0 && (
        <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {noPrice} {noPrice === 1 ? 'material no tiene' : 'materiales no tienen'} precio. Captura tus precios reales para que tus cotizaciones sean exactas.
        </div>
      )}

      {!materials ? (
        <div className="h-40" />
      ) : materials.length === 0 ? (
        <div className="rounded-xl border border-ink-750 bg-ink-850">
          <EmptyState
            icon={Package}
            title="Tu catálogo está vacío"
            description="FORGE no inventa precios. Registra tus materiales con lo que pagas a tu proveedor, o empieza con una lista de materiales comunes sin precio."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  icon={ListPlus}
                  onClick={async () => {
                    const n = await materialsRepo.addStarter();
                    toast.success(`${n} materiales agregados. Ahora captura sus precios.`);
                  }}
                >
                  Agregar materiales comunes
                </Button>
                <Button variant="primary" icon={Plus} onClick={() => open()}>
                  Nuevo material
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar material…" className="pl-9" aria-label="Buscar material" />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-48" aria-label="Filtrar categoría">
              <option value="">Todas las categorías</option>
              {usedCats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="overflow-hidden rounded-xl border border-ink-750 bg-ink-850">
            <ul className="divide-y divide-ink-750">
              {filtered.map((m) => {
                const prev = m.priceHistory.length > 1 ? m.priceHistory[m.priceHistory.length - 2].price : null;
                const change = prev && prev > 0 ? ((m.price - prev) / prev) * 100 : null;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink-100">{m.name}</span>
                        {m.kind === 'consumable' && <span className="shrink-0 rounded bg-warn/12 px-1.5 text-[10px] font-medium text-warn">Consumible</span>}
                      </div>
                      <div className="text-xs text-ink-500">
                        {m.category} · actualizado {dateShort(m.updatedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      {m.price > 0 ? (
                        <div className="num text-sm font-semibold">
                          {money(m.price)}
                          <span className="font-normal text-ink-500"> /{unitShort(m.unit)}</span>
                        </div>
                      ) : (
                        <button type="button" onClick={() => open(m)} className="text-xs font-medium text-warn hover:underline">
                          Capturar precio
                        </button>
                      )}
                      {change !== null && change !== 0 && (
                        <div className={cn('num inline-flex items-center gap-1 text-[11px]', change > 0 ? 'text-bad' : 'text-ok')}>
                          {change > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {pct(change)} vs. anterior
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0">
                      <IconButton icon={History} label="Historial de precios" onClick={() => setHistory(m)} className="hidden sm:inline-flex" />
                      <IconButton icon={Pencil} label="Editar" onClick={() => open(m)} />
                      <IconButton
                        icon={Trash2}
                        label="Eliminar"
                        tone="danger"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: `¿Eliminar "${m.name}"?`,
                              description: 'Las cotizaciones existentes conservan el precio con el que se hicieron.',
                              confirmLabel: 'Eliminar',
                              danger: true,
                            })
                          ) {
                            await materialsRepo.remove(m.id);
                            toast.success('Material eliminado');
                          }
                        }}
                      />
                    </div>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-500">Sin resultados.</li>}
            </ul>
          </div>
        </>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar material' : 'Nuevo material'}
        description={draft?.id ? 'Si cambias el precio, el anterior queda en el historial.' : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save}>
              Guardar
            </Button>
          </>
        }
      >
        {draft && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label="Nombre" required error={errors.name}>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder='Ej. PTR 2" x 2" cal. 14' invalid={!!errors.name} maxLength={100} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Categoría" error={errors.category}>
                <Select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value, kind: CATEGORY_KIND[e.target.value] ?? 'material' })}
                >
                  {MATERIAL_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Unidad de medida" error={errors.unit}>
                <Select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                  {UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Precio unitario" required error={errors.price} hint="Lo que te cuesta a ti (MXN).">
                <NumberInput value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} prefix="$" suffix={`/${unitShort(draft.unit)}`} invalid={!!errors.price} aria-label="Precio unitario" />
              </Field>
              <Field label="Tipo">
                <Segmented
                  size="sm"
                  className="h-10 w-full items-center"
                  value={draft.kind}
                  onChange={(v) => setDraft({ ...draft, kind: v })}
                  options={[
                    { value: 'material', label: 'Material' },
                    { value: 'consumable', label: 'Consumible' },
                  ]}
                />
              </Field>
            </div>
            <Field label="Notas" hint="Proveedor, calibre, medidas del tramo…">
              <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
            </Field>
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>

      <Modal open={!!history} onClose={() => setHistory(null)} title="Historial de precios" description={history?.name} size="sm">
        {history && (
          <ol className="flex flex-col divide-y divide-ink-750">
            {[...history.priceHistory].reverse().map((p, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="text-ink-400">{new Date(p.date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span className={cn('num', i === 0 ? 'font-semibold text-ink-100' : 'text-ink-300')}>{money(p.price)}</span>
              </li>
            ))}
            {history.priceHistory.length === 0 && <li className="py-4 text-sm text-ink-500">Sin precios registrados todavía.</li>}
          </ol>
        )}
      </Modal>
    </div>
  );
}
