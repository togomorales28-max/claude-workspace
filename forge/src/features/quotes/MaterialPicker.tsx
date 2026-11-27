import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Search, Package } from 'lucide-react';
import { Modal, Input, Button, EmptyState } from '@/components/ui';
import { useMaterials } from '@/lib/hooks';
import type { Material } from '@/domain/types';
import { money } from '@/domain/format';
import { unitShort } from '@/domain/constants';
import { cn } from '@/lib/cn';

export function MaterialPicker({
  open,
  onClose,
  onPick,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: Material) => void;
  kind: 'material' | 'consumable';
}) {
  const materials = useMaterials();
  const [q, setQ] = useState('');
  const [added, setAdded] = useState<Record<string, number>>({});

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (materials ?? [])
      .filter((m) => m.kind === kind)
      .filter((m) => !term || m.name.toLowerCase().includes(term) || m.category.toLowerCase().includes(term));
  }, [materials, q, kind]);

  const close = () => {
    setQ('');
    setAdded({});
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={kind === 'material' ? 'Agregar materiales del catálogo' : 'Agregar consumibles del catálogo'}
      description="Toca un material para agregarlo. Puedes agregar varios."
      footer={
        <Button variant="primary" onClick={close}>
          Listo
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o categoría…" className="pl-9" />
      </div>
      {materials && list.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q ? 'Sin resultados' : 'No hay materiales en esta categoría'}
          description={
            q ? 'Prueba con otro nombre o agrega una línea libre.' : 'Registra tus materiales con tus precios reales en el catálogo.'
          }
          action={
            <Link to="/materiales" onClick={close}>
              <Button>Ir al catálogo</Button>
            </Link>
          }
          className="py-8"
        />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(m);
                  setAdded((a) => ({ ...a, [m.id]: (a[m.id] ?? 0) + 1 }));
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink-800 active:bg-ink-750"
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-md border text-xs transition-colors',
                    added[m.id] ? 'border-ember-500 bg-ember-500 text-ink-950' : 'border-ink-600 text-transparent',
                  )}
                >
                  {added[m.id] ? added[m.id] > 1 ? added[m.id] : <Check className="size-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-100">{m.name}</span>
                  <span className="text-xs text-ink-500">{m.category}</span>
                </span>
                <span className="num shrink-0 text-right text-sm">
                  {m.price > 0 ? (
                    <span className="text-ink-200">
                      {money(m.price)}
                      <span className="text-ink-500"> /{unitShort(m.unit)}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-warn">Sin precio</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
