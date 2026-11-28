import { Link, useNavigate } from 'react-router-dom';
import { Plus, Scissors, Trash2, Copy, ChevronRight } from 'lucide-react';
import { Button, Empty, IconButton, PageHeader, useUi } from '../../components/ui';
import { useClients, useCutPlans, useSettings } from '../../data/hooks';
import { nowIso, repos, uid } from '../../data/repo';
import type { CutPlan, Settings } from '../../data/types';
import { newGroup } from '../../lib/cutPlan';
import { dateMx, kg, meters, num, pct } from '../../lib/format';

export async function createPlan(settings: Settings, name = 'Plan de corte nuevo'): Promise<CutPlan> {
  const plan: CutPlan = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(), name, clientId: null, notes: '',
    groups: [newGroup(settings)], summary: null,
  };
  return repos.cutPlans.save(plan);
}

export function CutPlans() {
  const plans = useCutPlans();
  const clients = useClients();
  const settings = useSettings();
  const nav = useNavigate();
  const { confirm, toast } = useUi();

  const create = async () => {
    if (!settings) return;
    const p = await createPlan(settings);
    nav(`/cortes/${p.id}`);
  };
  const duplicate = async (p: CutPlan) => {
    const copy = await repos.cutPlans.save({ ...structuredClone(p), id: uid(), name: `${p.name} (copia)`, createdAt: nowIso() });
    toast('Plan duplicado');
    nav(`/cortes/${copy.id}`);
  };
  const remove = async (p: CutPlan) => {
    if (await confirm({ title: 'Eliminar plan de corte', text: `Se eliminará «${p.name}». Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })) {
      await repos.cutPlans.remove(p.id);
      toast('Plan eliminado');
    }
  };

  return (
    <div className="rise">
      <PageHeader eyebrow="Módulo 01" title="Optimizador de cortes"
        subtitle="Distribuye las piezas en barras comerciales considerando el ancho de corte del disco, el despunte y los retazos que ya tienes."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>Nuevo plan</Button>} />

      {plans === undefined ? null : plans.length === 0 ? (
        <Empty icon={<Scissors className="size-8" />} title="Sin planes de corte"
          text="Crea un plan, captura las piezas que necesitas y obtén cuántas barras comprar y cómo cortarlas."
          action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>Crear primer plan</Button>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="hidden md:grid grid-cols-[1fr_120px_110px_110px_120px_96px] gap-3 border-b border-line px-4 py-2.5 eyebrow">
            <span>Plan</span><span className="text-right">Barras</span><span className="text-right">Material</span><span className="text-right">Peso</span><span className="text-right">Aprovech.</span><span />
          </div>
          {plans.map((p) => {
            const s = p.summary;
            const client = clients?.find((c) => c.id === p.clientId);
            return (
              <div key={p.id} className="group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_110px_110px_120px_96px] items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-panel-2 transition-colors">
                <Link to={`/cortes/${p.id}`} className="min-w-0">
                  <div className="truncate font-medium text-ink group-hover:text-volt-2 transition-colors">{p.name}</div>
                  <div className="truncate text-xs text-mute">
                    {p.groups.length} {p.groups.length === 1 ? 'material' : 'materiales'} · {client ? `${client.name} · ` : ''}{dateMx(p.updatedAt)}
                  </div>
                  {s && <div className="num mt-1 text-xs text-ink-2 md:hidden">{s.newBars} barras · {meters(s.stockLength)} · {pct(s.stockLength ? s.piecesLength / s.stockLength : 0)}</div>}
                </Link>
                <span className="num hidden md:block text-right">{s ? num(s.newBars, 0) : '—'}</span>
                <span className="num hidden md:block text-right text-ink-2">{s ? meters(s.stockLength) : '—'}</span>
                <span className="num hidden md:block text-right text-ink-2">{s && s.kg ? kg(s.kg, 1) : '—'}</span>
                <span className="num hidden md:block text-right">{s && s.stockLength ? pct(s.piecesLength / s.stockLength) : '—'}</span>
                <div className="flex justify-end">
                  <IconButton label="Duplicar" onClick={() => duplicate(p)}><Copy className="size-4" /></IconButton>
                  <IconButton label="Eliminar" onClick={() => remove(p)} className="hover:!text-bad"><Trash2 className="size-4" /></IconButton>
                  <Link to={`/cortes/${p.id}`} className="md:hidden inline-flex size-9 items-center justify-center text-mute" aria-label="Abrir"><ChevronRight className="size-4" /></Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
