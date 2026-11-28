import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileDown, FileSpreadsheet, FileText, Plus, Trash2, Layers, CheckCircle2, Package, Zap } from 'lucide-react';
import { Badge, Button, Empty, Field, IconButton, Notice, NumberInput, Panel, Select, Stat, TextArea, TextInput, cx, useUi } from '../../components/ui';
import { BarDiagram, DiagramLegend, pieceColor } from '../../components/BarDiagram';
import { useClients, useMaterials, useSettings } from '../../data/hooks';
import { repos, uid } from '../../data/repo';
import type { CutGroup, CutPlan, Material, Settings } from '../../data/types';
import { commercialStock, groupMoney, newGroup, planSummary, runGroup } from '../../lib/cutPlan';
import { useDraft } from '../../lib/useDraft';
import { fixed, kg, meters, money, num, pct } from '../../lib/format';
import { parsePieces } from '../../domain/parse';
import { materialInfo } from '../../lib/materialCalc';
import { PROFILE_MAP } from '../../domain/profiles';
import { cutListCsv, downloadText } from '../../lib/csv';
import { cutListPdf } from '../../lib/pdf';
import { createQuoteFromPlan } from '../../lib/quoteFactory';

export function CutPlanEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const materials = useMaterials();
  const clients = useClients();
  const { toast, confirm } = useUi();
  const { draft, setDraft, status, flush } = useDraft<CutPlan>(
    () => repos.cutPlans.get(id),
    (p) => repos.cutPlans.save({ ...p, summary: planSummary(p) }),
    [id],
  );
  const [active, setActive] = useState(0);

  if (draft === undefined || !settings) return null;
  if (draft === null) return <Empty icon={<Layers className="size-8" />} title="Plan no encontrado" action={<Link to="/cortes"><Button>Volver</Button></Link>} />;

  const plan = draft;
  const gi = Math.min(active, plan.groups.length - 1);
  const group = plan.groups[gi];
  const updateGroup = (fn: (g: CutGroup) => CutGroup) =>
    setDraft((p) => ({ ...p, groups: p.groups.map((g, i) => (i === gi ? fn(g) : g)) }));

  const addGroup = () => {
    setDraft((p) => ({ ...p, groups: [...p.groups, newGroup(settings, `Material ${p.groups.length + 1}`)] }));
    setActive(plan.groups.length);
  };
  const removeGroup = async () => {
    if (plan.groups.length === 1) return;
    if (await confirm({ title: 'Quitar material', text: `Se quitará «${group.label}» y sus piezas de este plan.`, confirmLabel: 'Quitar', danger: true })) {
      setDraft((p) => ({ ...p, groups: p.groups.filter((_, i) => i !== gi) }));
      setActive(Math.max(0, gi - 1));
    }
  };

  const exportPdf = async () => {
    await flush();
    try { await cutListPdf(plan, settings, clients?.find((c) => c.id === plan.clientId) ?? null); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const exportCsv = () => downloadText(`${safeName(plan.name)}-cortes.csv`, cutListCsv(plan), 'text/csv;charset=utf-8').catch((e) => toast((e as Error).message, 'bad'));
  const toQuote = async () => {
    await flush();
    const { quote, warnings } = await createQuoteFromPlan(plan, settings);
    toast(warnings.length ? `Presupuesto creado. ${warnings.length} aviso(s): revisa los precios.` : 'Presupuesto creado', warnings.length ? 'info' : 'ok');
    nav(`/presupuestos/${quote.id}`);
  };

  return (
    <div className="rise">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/cortes" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink"><ArrowLeft className="size-4" />Planes de corte</Link>
        <span className="ml-auto text-xs text-mute">{status === 'pending' ? 'Guardando…' : status === 'saved' ? 'Guardado' : status === 'error' ? <span className="text-bad">Error al guardar</span> : ''}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <div className="eyebrow mb-1 text-volt-2">Plan de corte</div>
          <input value={plan.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} aria-label="Nombre del plan"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none border-b border-transparent hover:border-line focus:border-volt pb-0.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FileDown className="size-4" />} onClick={exportPdf}>PDF</Button>
          <Button icon={<FileSpreadsheet className="size-4" />} onClick={exportCsv}>CSV</Button>
          <Button variant="primary" icon={<FileText className="size-4" />} onClick={toQuote}>Crear presupuesto</Button>
        </div>
      </div>

      {/* Pestañas de materiales */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {plan.groups.map((g, i) => (
          <button key={g.id} type="button" onClick={() => setActive(i)}
            className={cx('relative h-11 shrink-0 px-3.5 text-sm transition-colors', i === gi ? 'text-ink' : 'text-mute hover:text-ink-2')}>
            {g.label || `Material ${i + 1}`}
            <span className="num ml-1.5 text-xs text-mute">{g.pieces.reduce((s, p) => s + p.qty, 0)}</span>
            {i === gi && <span className="absolute inset-x-2 -bottom-px h-[2px] bg-volt" />}
          </button>
        ))}
        <button type="button" onClick={addGroup} className="inline-flex h-11 shrink-0 items-center gap-1 px-3 text-sm text-volt-2 hover:text-volt">
          <Plus className="size-4" />Material
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(380px,460px)_1fr]">
        <div className="space-y-5">
          <GroupSetup group={group} update={updateGroup} materials={materials ?? []} settings={settings}
            onRemove={plan.groups.length > 1 ? removeGroup : undefined} />
          <PiecesEditor group={group} update={updateGroup} />
          <Panel title="Datos del plan">
            <div className="grid gap-3">
              <Field label="Cliente">{(fid) => (
                <Select id={fid} value={plan.clientId ?? ''} onChange={(v) => setDraft((p) => ({ ...p, clientId: v || null }))}
                  options={[{ value: '', label: 'Sin cliente' }, ...(clients ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
              )}</Field>
              <Field label="Notas">{(fid) => <TextArea id={fid} value={plan.notes} onChange={(v) => setDraft((p) => ({ ...p, notes: v }))} placeholder="Obra, ubicación, observaciones…" />}</Field>
            </div>
          </Panel>
        </div>
        <GroupResults group={group} />
      </div>
    </div>
  );
}

const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'plan';

/* ───────── Configuración del material ───────── */
function GroupSetup({ group, update, materials, settings, onRemove }:
  { group: CutGroup; update: (fn: (g: CutGroup) => CutGroup) => void; materials: Material[]; settings: Settings; onRemove?: () => void }) {
  const commercial = group.stock.find((s) => !s.isOffcut) ?? null;
  const offcuts = group.stock.filter((s) => s.isOffcut);
  const linear = materials.filter((m) => PROFILE_MAP[m.profile].cuttable);

  const pickMaterial = (mid: string) => {
    if (!mid) { update((g) => ({ ...g, materialId: null })); return; }
    const m = materials.find((x) => x.id === mid)!;
    const info = materialInfo(m, settings);
    update((g) => ({
      ...g, materialId: m.id, label: m.name, kgm: info.kgm != null ? Math.round(info.kgm * 10000) / 10000 : null, pricePerBar: info.barPrice,
      stock: g.stock.map((s) => (!s.isOffcut ? { ...s, length: m.stockLength } : s)),
    }));
  };
  const setCommercial = (len: number | null) =>
    update((g) => {
      const has = g.stock.some((s) => !s.isOffcut);
      const stock = has ? g.stock.map((s) => (!s.isOffcut ? { ...s, length: len ?? 0 } : s)) : [commercialStock(len ?? 0), ...g.stock];
      return { ...g, stock };
    });

  return (
    <Panel title="Material y barra" eyebrow="Configuración"
      actions={onRemove && <IconButton label="Quitar material" onClick={onRemove} className="hover:!text-bad"><Trash2 className="size-4" /></IconButton>}>
      <div className="grid gap-3">
        <Field label="Del catálogo" hint={linear.length === 0 ? <>Aún no hay perfiles en el catálogo. <Link to="/catalogo" className="text-volt-2">Agregar</Link></> : 'Copia longitud, peso por metro y precio.'}>
          {(fid) => (
            <Select id={fid} value={group.materialId ?? ''} onChange={pickMaterial}
              options={[{ value: '', label: 'Captura manual' }, ...linear.map((m) => ({ value: m.id, label: m.name }))]} />
          )}
        </Field>
        <Field label="Descripción del material">{(fid) => <TextInput id={fid} value={group.label} onChange={(v) => update((g) => ({ ...g, label: v }))} placeholder='PTR 2" cal. 14' />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Longitud comercial" unit="mm">{(fid) => <NumberInput id={fid} value={commercial?.length ?? null} onChange={setCommercial} min={1} invalid={!commercial?.length} />}</Field>
          <Field label="Ancho de corte (kerf)" unit="mm">{(fid) => <NumberInput id={fid} value={group.kerf} onChange={(v) => update((g) => ({ ...g, kerf: v ?? 0 }))} min={0} />}</Field>
          <Field label="Despunte inicial" unit="mm" hint="Para emparejar el extremo">{(fid) => <NumberInput id={fid} value={group.trimStart} onChange={(v) => update((g) => ({ ...g, trimStart: v ?? 0 }))} min={0} />}</Field>
          <Field label="Sobrante reutilizable desde" unit="mm">{(fid) => <NumberInput id={fid} value={group.minReusable} onChange={(v) => update((g) => ({ ...g, minReusable: v ?? 0 }))} min={0} />}</Field>
          <Field label="Peso por metro" unit="kg/m" hint="Opcional, para calcular kg">{(fid) => <NumberInput id={fid} value={group.kgm} onChange={(v) => update((g) => ({ ...g, kgm: v }))} min={0} />}</Field>
          <Field label="Precio por barra" unit="MXN" hint="Opcional, para costos">{(fid) => <NumberInput id={fid} value={group.pricePerBar} onChange={(v) => update((g) => ({ ...g, pricePerBar: v }))} min={0} />}</Field>
        </div>

        <div className="mt-1 rounded-md border border-line bg-base/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Retazos en inventario</div>
              <div className="text-xs text-mute">Se usan antes de comprar barras nuevas.</div>
            </div>
            <Button size="sm" icon={<Plus className="size-3.5" />}
              onClick={() => update((g) => ({ ...g, stock: [...g.stock, { id: uid(), label: 'Retazo', length: 0, qty: 1, isOffcut: true }] }))}>Retazo</Button>
          </div>
          {offcuts.length === 0 ? <p className="text-xs text-mute">Sin retazos.</p> : (
            <div className="space-y-2">
              {offcuts.map((o) => (
                <div key={o.id} className="grid grid-cols-[1fr_88px_36px] gap-2">
                  <NumberInput ariaLabel="Longitud del retazo (mm)" value={o.length || null} suffix="mm" min={1} invalid={!o.length}
                    onChange={(v) => update((g) => ({ ...g, stock: g.stock.map((s) => (s.id === o.id ? { ...s, length: v ?? 0 } : s)) }))} />
                  <NumberInput ariaLabel="Cantidad de retazos" value={o.qty} suffix="pz" integer min={0}
                    onChange={(v) => update((g) => ({ ...g, stock: g.stock.map((s) => (s.id === o.id ? { ...s, qty: Math.max(0, Math.floor(v ?? 0)) } : s)) }))} />
                  <IconButton label="Quitar retazo" onClick={() => update((g) => ({ ...g, stock: g.stock.filter((s) => s.id !== o.id) }))}><Trash2 className="size-4" /></IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ───────── Captura de piezas ───────── */
function PiecesEditor({ group, update }: { group: CutGroup; update: (fn: (g: CutGroup) => CutGroup) => void }) {
  const [quick, setQuick] = useState('');
  const [quickErr, setQuickErr] = useState<string[]>([]);
  const { toast } = useUi();
  const totalQty = group.pieces.reduce((s, p) => s + p.qty, 0);
  const totalLen = group.pieces.reduce((s, p) => s + p.length * p.qty, 0);

  const addQuick = () => {
    const r = parsePieces(quick);
    setQuickErr(r.errors);
    if (r.pieces.length) {
      update((g) => {
        const start = g.pieces.length;
        return { ...g, pieces: [...g.pieces, ...r.pieces.map((p, i) => ({ id: uid(), label: p.label || `Pieza ${start + i + 1}`, length: p.length, qty: p.qty }))] };
      });
      if (!r.errors.length) setQuick('');
      toast(`${r.pieces.length} medida(s) agregada(s)`);
    }
  };
  const setPiece = (pid: string, patch: Partial<CutGroup['pieces'][number]>) =>
    update((g) => ({ ...g, pieces: g.pieces.map((p) => (p.id === pid ? { ...p, ...patch } : p)) }));

  return (
    <Panel title="Piezas a cortar" eyebrow="Lista de corte"
      actions={<span className="num text-xs text-mute">{totalQty} pz · {meters(totalLen)}</span>}>
      <div className="mb-3">
        <div className="flex gap-2">
          <input className="field num" value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="Captura rápida"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuick(); } }}
            placeholder="1200 x 4; 850 x 2 travesaño" />
          <Button variant="primary" onClick={addQuick} disabled={!quick.trim()} icon={<Zap className="size-4" />}>Agregar</Button>
        </div>
        {quickErr.length > 0
          ? <p className="mt-1 text-xs text-bad">{quickErr.join(' ')}</p>
          : <p className="mt-1 text-xs text-mute">Medida × cantidad, separadas por «;». Acepta mm, cm, m y pulgadas (47 1/4").</p>}
      </div>

      {group.pieces.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-2 px-3 py-6 text-center text-sm text-mute">Sin piezas. Usa la captura rápida o agrega una fila.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[14px_1fr_104px_68px_32px] gap-2 px-0.5 eyebrow !text-[10px]">
            <span /><span>Etiqueta</span><span>Largo (mm)</span><span>Cant.</span><span />
          </div>
          {group.pieces.map((p) => (
            <div key={p.id} className="grid grid-cols-[14px_1fr_104px_68px_32px] items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: pieceColor(p.id, [...group.pieces].sort((a, b) => b.length - a.length).map((x) => x.id)) }} />
              <TextInput value={p.label} onChange={(v) => setPiece(p.id, { label: v })} aria-label="Etiqueta" />
              <NumberInput ariaLabel="Largo en mm" value={p.length || null} onChange={(v) => setPiece(p.id, { length: v ?? 0 })} min={0.01} invalid={!p.length} />
              <NumberInput ariaLabel="Cantidad" value={p.qty} onChange={(v) => setPiece(p.id, { qty: v == null ? 0 : v })} integer min={1} invalid={!p.qty} />
              <IconButton label="Quitar pieza" className="!size-8" onClick={() => update((g) => ({ ...g, pieces: g.pieces.filter((x) => x.id !== p.id) }))}><Trash2 className="size-4" /></IconButton>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" icon={<Plus className="size-3.5" />}
          onClick={() => update((g) => ({ ...g, pieces: [...g.pieces, { id: uid(), label: `Pieza ${g.pieces.length + 1}`, length: 0, qty: 1 }] }))}>Fila</Button>
        {group.pieces.length > 0 && <Button size="sm" variant="ghost" onClick={() => update((g) => ({ ...g, pieces: [] }))}>Vaciar lista</Button>}
      </div>
    </Panel>
  );
}

/* ───────── Resultados ───────── */
function GroupResults({ group }: { group: CutGroup }) {
  const deferred = useDeferredValue(group);
  const run = useMemo(() => runGroup(deferred), [deferred]);

  if (group.pieces.length === 0) {
    return <Empty icon={<Package className="size-8" />} title="Captura las piezas" text="El resultado se calcula al instante conforme escribes." />;
  }
  if (!run.ok) return <div><Notice tone="warn">{run.error}</Notice></div>;
  const r = run.result;
  const t = r.totals;
  const m = groupMoney(deferred, r);
  const order = [...deferred.pieces].sort((a, b) => b.length - a.length).map((p) => p.id);
  const newBars = t.purchased.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-5 min-w-0">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Barras a comprar" value={num(newBars, 0)} tone="volt"
          sub={t.purchased.map((p) => `${p.count} × ${num(p.length)} mm`).join(' · ') + (t.offcutsUsed ? ` + ${t.offcutsUsed} retazo(s)` : '')} />
        <Stat label="Aprovechamiento" value={pct(t.utilization)} tone={t.utilization >= 0.85 ? 'ok' : t.utilization >= 0.7 ? 'default' : 'warn'}
          sub={`${meters(t.piecesLength)} en piezas de ${meters(t.stockLength)}`} />
        <Stat label="Desperdicio total" value={`${fixed(t.waste / 1000, 3)} m`}
          sub={`${pct(1 - t.utilization)}${m.wasteKg != null ? ` · ${kg(m.wasteKg)}` : ''}${m.wasteValue != null ? ` · ${money(m.wasteValue)}` : ''}`} />
        <Stat label="Costo de material" value={m.cost != null ? money(m.cost) : '—'}
          sub={m.kg != null ? `${kg(m.kg)} de material` : 'Captura precio y kg/m'} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {r.provenOptimal
          ? <Badge tone="ok"><CheckCircle2 className="size-3" />Mínimo de barras comprobado</Badge>
          : r.lowerBound != null && <Badge>Cota inferior: {r.lowerBound} barras</Badge>}
        <Badge>Método: {r.strategy}</Badge>
        <span className="text-mute num">Cortes: {fixed(t.kerfLoss, 1)} mm · Despunte: {fixed(t.trimLoss, 1)} mm · Reutilizable: {fixed(t.reusableOffcut, 0)} mm · Desecho: {fixed(t.scrapOffcut, 0)} mm</span>
      </div>

      {r.unplaced.length > 0 && (
        <Notice tone="bad">
          <div className="font-medium">Piezas sin colocar</div>
          {r.unplaced.map((u) => <div key={u.pieceId} className="num">{u.label}: {num(u.length)} mm × {u.qty} — {u.reason}</div>)}
        </Notice>
      )}
      {r.warnings.filter((w) => !w.startsWith('Hay piezas')).map((w) => <Notice key={w} tone="warn">{w}</Notice>)}

      <Panel title="Distribución por barra" eyebrow="Diagrama de corte"
        actions={<span className="num text-xs text-mute">{t.bars} barras · {r.patterns.length} patrones</span>}>
        <div className="mb-4"><DiagramLegend items={deferred.pieces.map((p) => ({ id: p.id, label: p.label, length: p.length, qty: p.qty, color: pieceColor(p.id, order) }))} /></div>
        <div className="space-y-3">
          {r.patterns.map((pt, i) => (
            <BarDiagram key={pt.key} bar={pt.bar} kerf={deferred.kerf} trim={deferred.trimStart} order={order} count={pt.count} index={i + 1} />
          ))}
        </div>
      </Panel>

      <Panel title="Lista de corte" eyebrow="Para el taller" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-line text-left eyebrow">
              <th className="px-4 py-2 font-normal">Patrón</th><th className="px-2 py-2 font-normal text-right">Barras</th>
              <th className="px-2 py-2 font-normal">Cortes (mm)</th><th className="px-4 py-2 font-normal text-right">Sobrante</th>
            </tr></thead>
            <tbody>
              {r.patterns.map((pt, i) => (
                <tr key={pt.key} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-2.5 num text-mute">#{i + 1}<div className="text-[11px]">{pt.bar.isOffcut ? 'Retazo' : ''} {num(pt.bar.stockLength)}</div></td>
                  <td className="px-2 py-2.5 num text-right">{pt.count}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {pt.bar.cuts.map((c, k) => (
                        <span key={k} className="num rounded border border-line-2 px-1.5 py-0.5 text-xs" title={c.label}>
                          <span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ background: pieceColor(c.pieceId, order) }} />{num(c.length)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={cx('px-4 py-2.5 num text-right', pt.bar.reusable ? 'text-ok' : 'text-ink-2')}>{num(pt.bar.offcut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
