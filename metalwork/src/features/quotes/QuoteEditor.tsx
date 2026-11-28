import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown, Plus, Trash2, Package, Scissors, UserPlus, Copy } from 'lucide-react';
import { Button, Empty, Field, IconButton, Modal, Notice, NumberInput, Panel, Segmented, Select, TextArea, TextInput, Toggle, cx, useUi } from '../../components/ui';
import { useClients, useCutPlans, useMaterials, useSettings } from '../../data/hooks';
import { nowIso, repos, todayIso, uid } from '../../data/repo';
import { QUOTE_STATUS, type Client, type Quote, type Settings } from '../../data/types';
import { computeBudget, EXPENSE_CATEGORIES, laborLineAmount, type BudgetTotals, type ExpenseCategory, type MaterialLine } from '../../domain/budget';
import { PROFILE_MAP } from '../../domain/profiles';
import { useDraft } from '../../lib/useDraft';
import { quoteSnapshot } from '../../lib/quoteFactory';
import { planToMaterialLines } from '../../lib/cutPlan';
import { materialInfo } from '../../lib/materialCalc';
import { addDays, dateMx, fixed, kg, money, num, pct } from '../../lib/format';
import { quotePdf } from '../../lib/pdf';
import { ClientModal, blankClient } from '../clients/Clients';

export function QuoteEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const clients = useClients();
  const { toast, confirm } = useUi();
  const { draft, setDraft, status, flush } = useDraft<Quote>(
    () => repos.quotes.get(id),
    (q) => repos.quotes.save({ ...q, snapshot: quoteSnapshot(q) }),
    [id],
  );
  const [pickMat, setPickMat] = useState(false);
  const [pickPlan, setPickPlan] = useState(false);
  const [newClient, setNewClient] = useState<Client | null>(null);

  const totals = useMemo(() => {
    if (!draft) return null;
    try { return { ok: true as const, t: computeBudget(draft) }; } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  }, [draft]);

  if (draft === undefined || !settings) return null;
  if (draft === null) return <Empty icon={<Package className="size-8" />} title="Presupuesto no encontrado" action={<Link to="/presupuestos"><Button>Volver</Button></Link>} />;
  const q = draft;
  const set = (patch: Partial<Quote>) => setDraft((d) => ({ ...d, ...patch }));
  const client = clients?.find((c) => c.id === q.clientId) ?? null;

  const exportPdf = async () => {
    if (!totals?.ok) { toast('Corrige los datos antes de exportar', 'bad'); return; }
    await flush();
    try { await quotePdf(q, settings, client); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const duplicate = async () => {
    await flush();
    const number = await repos.nextQuoteNumber();
    const copy = await repos.quotes.save({ ...structuredClone(q), id: uid(), number, status: 'borrador', date: todayIso(), createdAt: nowIso(), title: `${q.title} (copia)` });
    toast(`Duplicado como ${number}`);
    nav(`/presupuestos/${copy.id}`);
  };
  const remove = async () => {
    if (await confirm({ title: 'Eliminar presupuesto', text: `Se eliminará ${q.number}. Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })) {
      await repos.quotes.remove(q.id); nav('/presupuestos'); toast('Presupuesto eliminado');
    }
  };

  const setMat = (mid: string, patch: Partial<MaterialLine>) => set({ materials: q.materials.map((m) => (m.id === mid ? { ...m, ...patch } : m)) });

  return (
    <div className="rise">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/presupuestos" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink"><ArrowLeft className="size-4" />Presupuestos</Link>
        <span className="ml-auto text-xs text-mute">{status === 'pending' ? 'Guardando…' : status === 'saved' ? 'Guardado' : status === 'error' ? <span className="text-bad">Error al guardar</span> : ''}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <div className="eyebrow mb-1 text-volt-2">Presupuesto {q.number}</div>
          <input value={q.title} onChange={(e) => set({ title: e.target.value })} aria-label="Nombre del trabajo"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none border-b border-transparent hover:border-line focus:border-volt pb-0.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={q.status} onChange={(v) => set({ status: v })} options={QUOTE_STATUS.map((s) => ({ value: s.id, label: s.label }))} className="w-auto" ariaLabel="Estado" />
          <IconButton label="Duplicar" onClick={duplicate} className="border border-line"><Copy className="size-4" /></IconButton>
          <IconButton label="Eliminar" onClick={remove} className="border border-line hover:!text-bad"><Trash2 className="size-4" /></IconButton>
          <Button variant="primary" icon={<FileDown className="size-4" />} onClick={exportPdf}>Cotización PDF</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5 min-w-0">
          {/* Datos generales */}
          <Panel title="Cliente y trabajo" eyebrow="Datos generales">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cliente">{(fid) => (
                <div className="flex gap-2">
                  <Select id={fid} value={q.clientId ?? ''} onChange={(v) => set({ clientId: v || null })} options={[{ value: '', label: 'Público en general' }, ...(clients ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
                  <IconButton label="Nuevo cliente" className="border border-line shrink-0 !size-10" onClick={() => setNewClient(blankClient())}><UserPlus className="size-4" /></IconButton>
                </div>
              )}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha">{(fid) => <input id={fid} type="date" className="field" value={q.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />}</Field>
                <Field label="Vigencia" unit="días" hint={`Hasta ${dateMx(addDays(q.date, q.validDays || 0))}`}>{(fid) => <NumberInput id={fid} value={q.validDays} integer min={0} onChange={(v) => set({ validDays: Math.max(0, Math.floor(v ?? 0)) })} />}</Field>
              </div>
              <Field label="Descripción del trabajo" className="sm:col-span-2">{(fid) => <TextArea id={fid} value={q.description} onChange={(v) => set({ description: v })} placeholder="Ej.: Portón corredizo de 4.00 × 2.20 m en PTR 2&quot; con lámina cal. 20, primario y esmalte negro, incluye instalación." />}</Field>
            </div>
          </Panel>

          {/* Materiales */}
          <Panel title="Materiales" eyebrow="Costos"
            actions={<>
              <Button size="sm" icon={<Scissors className="size-3.5" />} onClick={() => setPickPlan(true)}>De plan de corte</Button>
              <Button size="sm" icon={<Package className="size-3.5" />} onClick={() => setPickMat(true)}>Del catálogo</Button>
            </>}>
            {q.materials.length === 0 ? <p className="text-sm text-mute">Sin materiales. Agrega desde el catálogo, desde un plan de corte o como línea libre.</p> : (
              <div className="space-y-3">
                {q.materials.map((m) => (
                  <div key={m.id} className="rounded-md border border-line bg-base/40 p-3">
                    <div className="grid grid-cols-[1fr_32px] gap-2">
                      <TextInput value={m.description} onChange={(v) => setMat(m.id, { description: v })} placeholder="Descripción" aria-label="Descripción" />
                      <IconButton label="Quitar" className="!size-10" onClick={() => set({ materials: q.materials.filter((x) => x.id !== m.id) })}><Trash2 className="size-4" /></IconButton>
                    </div>
                    <div className="mt-2 grid grid-cols-[1fr_1fr_1.3fr] sm:grid-cols-[110px_110px_140px_1fr] gap-2 items-center">
                      <NumberInput ariaLabel="Cantidad" value={m.qty} min={0} onChange={(v) => setMat(m.id, { qty: v ?? 0 })} />
                      <Select ariaLabel="Unidad" value={m.unit} onChange={(v) => setMat(m.id, { unit: v })} options={unitOptions(m.unit)} />
                      <NumberInput ariaLabel="Precio unitario" value={m.unitPrice} min={0} suffix="$" onChange={(v) => setMat(m.id, { unitPrice: v ?? 0 })} invalid={!m.unitPrice} />
                      <div className="col-span-3 sm:col-span-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer select-none">
                          <input type="checkbox" checked={m.applyWaste} onChange={(e) => setMat(m.id, { applyWaste: e.target.checked })} className="accent-[#2f8cff] size-4" />
                          + desperdicio
                        </label>
                        <span className="num text-sm">{money(m.qty * m.unitPrice)}</span>
                      </div>
                    </div>
                    {!m.unitPrice && <p className="mt-1.5 text-xs text-warn">Sin precio: captúralo con el dato de tu proveedor.</p>}
                    {m.offcutValue != null && m.offcutValue > 0 && <p className="mt-1.5 text-xs text-mute">Incluye {money(m.offcutValue)} de sobrante y cortes (calculado por el optimizador).</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set({ materials: [...q.materials, { id: uid(), description: '', unit: 'pieza', qty: 1, unitPrice: 0, applyWaste: true }] })}>Línea libre</Button>
              <span className="text-xs text-mute">«+ desperdicio» aplica el {fixed(q.wastePct, 1)} % de merma. Las barras del optimizador ya incluyen su sobrante.</span>
            </div>
          </Panel>

          {/* Mano de obra */}
          <Panel title="Mano de obra" eyebrow="Costos">
            <div className="space-y-3">
              {q.labor.map((l) => (
                <div key={l.id} className="rounded-md border border-line bg-base/40 p-3">
                  <div className="grid grid-cols-[1fr_auto_32px] gap-2 items-center">
                    <TextInput value={l.description} onChange={(v) => set({ labor: q.labor.map((x) => (x.id === l.id ? { ...x, description: v } : x)) })} placeholder="Concepto" aria-label="Concepto" />
                    <Segmented value={l.mode} onChange={(v) => set({ labor: q.labor.map((x) => (x.id === l.id ? { ...x, mode: v } : x)) })} options={[{ value: 'horas', label: 'Horas' }, { value: 'fijo', label: 'Fijo' }]} />
                    <IconButton label="Quitar" onClick={() => set({ labor: q.labor.filter((x) => x.id !== l.id) })}><Trash2 className="size-4" /></IconButton>
                  </div>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    {l.mode === 'horas' ? <>
                      <Field label="Personas">{(fid) => <NumberInput id={fid} value={l.workers} min={0} onChange={(v) => set({ labor: q.labor.map((x) => (x.id === l.id ? { ...x, workers: v ?? 0 } : x)) })} />}</Field>
                      <Field label="Horas c/u">{(fid) => <NumberInput id={fid} value={l.hours} min={0} onChange={(v) => set({ labor: q.labor.map((x) => (x.id === l.id ? { ...x, hours: v ?? 0 } : x)) })} />}</Field>
                      <Field label="$ por hora">{(fid) => <NumberInput id={fid} value={l.rate} min={0} onChange={(v) => set({ labor: q.labor.map((x) => (x.id === l.id ? { ...x, rate: v ?? 0 } : x)) })} invalid={!l.rate} />}</Field>
                    </> : (
                      <Field label="Importe" unit="MXN" className="col-span-3 sm:col-span-3">{(fid) => <NumberInput id={fid} value={l.amount} min={0} onChange={(v) => set({ labor: q.labor.map((x) => (x.id === l.id ? { ...x, amount: v ?? 0 } : x)) })} />}</Field>
                    )}
                    <div className="col-span-3 sm:col-span-1 num pb-2.5 text-right text-sm">{money(laborLineAmount(l))}</div>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" className="mt-3" icon={<Plus className="size-3.5" />}
              onClick={() => set({ labor: [...q.labor, { id: uid(), description: '', mode: 'horas', workers: 1, hours: 0, rate: settings.budget.laborRate, amount: 0 }] })}>Mano de obra</Button>
          </Panel>

          {/* Gastos */}
          <Panel title="Consumibles y gastos" eyebrow="Costos">
            <div className="space-y-4">
              {EXPENSE_CATEGORIES.map((c) => {
                const rows = q.expenses.filter((e) => e.category === c.id);
                return (
                  <div key={c.id}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-xs text-mute">{c.hint}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {totals?.ok && <span className="num text-sm text-ink-2">{money(totals.t.expensesByCategory[c.id])}</span>}
                        <IconButton label={`Agregar a ${c.label}`} className="border border-line !size-8"
                          onClick={() => set({ expenses: [...q.expenses, { id: uid(), category: c.id as ExpenseCategory, description: '', qty: 1, unitPrice: 0 }] })}><Plus className="size-4" /></IconButton>
                      </div>
                    </div>
                    {rows.map((e) => (
                      <div key={e.id} className="mb-2 grid grid-cols-[1fr_72px_100px_32px] gap-2">
                        <TextInput value={e.description} onChange={(v) => set({ expenses: q.expenses.map((x) => (x.id === e.id ? { ...x, description: v } : x)) })} placeholder="Concepto" aria-label="Concepto" />
                        <NumberInput ariaLabel="Cantidad" value={e.qty} min={0} onChange={(v) => set({ expenses: q.expenses.map((x) => (x.id === e.id ? { ...x, qty: v ?? 0 } : x)) })} />
                        <NumberInput ariaLabel="Precio unitario" value={e.unitPrice} min={0} suffix="$" onChange={(v) => set({ expenses: q.expenses.map((x) => (x.id === e.id ? { ...x, unitPrice: v ?? 0 } : x)) })} />
                        <IconButton label="Quitar" className="!size-10" onClick={() => set({ expenses: q.expenses.filter((x) => x.id !== e.id) })}><Trash2 className="size-4" /></IconButton>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Cotización para el cliente" eyebrow="Documento">
            <div className="grid gap-3">
              <Field label="Detalle en el PDF">{() => (
                <Segmented value={q.pdfDetail} onChange={(v) => set({ pdfDetail: v })} className="w-full sm:w-auto"
                  options={[{ value: 'conceptos', label: 'Conceptos y total' }, { value: 'precios', label: 'Precio por partida' }]} />
              )}</Field>
              <p className="text-xs text-mute">{q.pdfDetail === 'conceptos' ? 'El cliente ve materiales, mano de obra y el precio final; tus costos y utilidad no aparecen.' : 'El cliente ve el precio de cada partida; la utilidad se reparte proporcionalmente y las partidas suman el subtotal exacto.'}</p>
              <Field label="Condiciones">{(fid) => <TextArea id={fid} value={q.terms} onChange={(v) => set({ terms: v })} />}</Field>
            </div>
          </Panel>
        </div>

        {/* Resumen */}
        <aside className="xl:sticky xl:top-6 self-start space-y-4">
          <Panel title="Utilidad y precio" eyebrow="Parámetros">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desperdicio" unit="%">{(fid) => <NumberInput id={fid} value={q.wastePct} min={0} onChange={(v) => set({ wastePct: v ?? 0 })} />}</Field>
                <Field label="Utilidad" unit="%">{(fid) => <NumberInput id={fid} value={q.profitPct} min={0} onChange={(v) => set({ profitPct: v ?? 0 })} invalid={q.profitMode === 'margen' && q.profitPct >= 100} />}</Field>
              </div>
              <Segmented value={q.profitMode} onChange={(v) => set({ profitMode: v })} className="w-full"
                options={[{ value: 'recargo', label: 'Sobre el costo' }, { value: 'margen', label: 'Margen de venta' }]} />
              <Field label="Redondear precio hacia arriba">{(fid) => (
                <Select id={fid} value={String(q.roundTo)} onChange={(v) => set({ roundTo: Number(v) })}
                  options={[{ value: '0', label: 'Sin redondeo' }, { value: '1', label: 'Al peso' }, { value: '10', label: 'A $10' }, { value: '50', label: 'A $50' }, { value: '100', label: 'A $100' }, { value: '500', label: 'A $500' }]} />
              )}</Field>
              <Toggle checked={q.ivaEnabled} onChange={(v) => set({ ivaEnabled: v })} label="Agregar IVA" hint="Para clientes que requieren factura" />
              {q.ivaEnabled && <Field label="Tasa de IVA" unit="%">{(fid) => <NumberInput id={fid} value={q.ivaPct} min={0} onChange={(v) => set({ ivaPct: v ?? 0 })} />}</Field>}
            </div>
          </Panel>
          {totals && (totals.ok ? <Summary t={totals.t} q={q} /> : <Notice tone="bad">{totals.error}</Notice>)}
        </aside>
      </div>

      {pickMat && <CatalogPicker settings={settings} onClose={() => setPickMat(false)} onPick={(line) => { set({ materials: [...q.materials, line] }); setPickMat(false); toast('Material agregado'); }} />}
      {pickPlan && <PlanPicker onClose={() => setPickPlan(false)} onPick={(lines, warnings, planId) => {
        set({ materials: [...q.materials, ...lines], cutPlanId: planId });
        setPickPlan(false);
        toast(warnings.length ? warnings[0] : `${lines.length} línea(s) agregada(s)`, warnings.length ? 'info' : 'ok');
      }} />}
      {newClient && <ClientModal initial={newClient} onClose={() => setNewClient(null)} onSaved={(c) => set({ clientId: c.id })} />}
    </div>
  );
}

const UNITS = ['barra', 'kg', 'm', 'm²', 'hoja', 'pieza', 'lote'];
const unitOptions = (cur: string) => [...new Set([...UNITS, cur])].map((u) => ({ value: u, label: u }));

function Summary({ t, q }: { t: BudgetTotals; q: Quote }) {
  const parts = [
    { k: 'Materiales', v: t.materials, c: '#2f8cff' },
    { k: 'Desperdicio', v: t.waste, c: '#5aa6ff' },
    { k: 'Mano de obra', v: t.labor, c: '#22b3a6' },
    { k: 'Consumibles y gastos', v: t.expenses, c: '#e0a43a' },
    { k: 'Utilidad', v: t.profit, c: '#2fc08a' },
  ];
  const sum = parts.reduce((s, p) => s + p.v, 0);
  const lowMargin = t.cost > 0 && t.margin < 0.1;
  return (
    <Panel title="Resumen" eyebrow="Resultado">
      {sum > 0 && (
        <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-raised" aria-hidden>
          {parts.map((p) => p.v > 0 && <div key={p.k} style={{ width: `${(p.v / sum) * 100}%`, background: p.c }} />)}
        </div>
      )}
      <dl className="space-y-1.5 text-sm">
        {parts.slice(0, 4).map((p, i) => (
          <div key={p.k}>
            <Line k={<><i className="mr-2 inline-block size-2 rounded-sm align-middle" style={{ background: p.c }} />{p.k}</>} v={money(p.v)} />
            {i === 0 && t.offcutValue > 0 && <Line k={<span className="pl-4 text-xs">incluye sobrante y cortes de barras</span>} v={<span className="text-xs">{money(t.offcutValue)}</span>} muted />}
          </div>
        ))}
        <div className="!mt-3 border-t border-line pt-2.5"><Line k={<b className="text-ink">Costo real de fabricación</b>} v={<b className="text-ink">{money(t.cost)}</b>} /></div>
        <Line k={<><i className="mr-2 inline-block size-2 rounded-sm align-middle bg-ok" />Ganancia estimada</>} v={<span className="text-ok">{money(t.profit)}</span>} />
        {t.rounding > 0 && <Line k={<span className="pl-4 text-xs">incluye redondeo</span>} v={<span className="text-xs">{money(t.rounding)}</span>} muted />}
        <Line k="Margen de utilidad" v={pct(t.margin)} />
        <Line k="Recargo sobre costo" v={pct(t.markup)} muted />
        <div className="!mt-3 border-t border-line pt-2.5"><Line k="Subtotal" v={money(t.subtotal)} /></div>
        {q.ivaEnabled && <Line k={`IVA ${fixed(q.ivaPct, 0)} %`} v={money(t.iva)} />}
      </dl>
      <div className="mt-4 rounded-md border border-volt/40 bg-volt/10 px-4 py-3">
        <div className="eyebrow text-volt-2">Precio final de venta</div>
        <div className="num mt-1 text-3xl font-medium text-ink">{money(t.total)}</div>
        <div className="mt-0.5 text-xs text-mute">MXN{q.ivaEnabled ? ', IVA incluido' : ', sin IVA'}{t.weightKg > 0 ? ` · ${kg(t.weightKg, 1)} de acero` : ''}{t.laborHours > 0 ? ` · ${num(t.laborHours)} h-hombre` : ''}</div>
      </div>
      {lowMargin && <div className="mt-3"><Notice tone="warn">El margen es menor al 10 %. Revisa la utilidad.</Notice></div>}
    </Panel>
  );
}

function Line({ k, v, muted }: { k: ReactNode; v: ReactNode; muted?: boolean }) {
  return <div className={cx('flex justify-between gap-3', muted ? 'text-mute' : 'text-ink-2')}><dt>{k}</dt><dd className="num">{v}</dd></div>;
}

function CatalogPicker({ settings, onClose, onPick }: { settings: Settings; onClose: () => void; onPick: (l: MaterialLine) => void }) {
  const materials = useMaterials();
  const [mid, setMid] = useState('');
  const [unit, setUnit] = useState<'barra' | 'kg' | 'm'>('barra');
  const [qty, setQty] = useState<number | null>(1);
  const m = materials?.find((x) => x.id === mid);
  const info = m ? materialInfo(m, settings) : null;
  const plate = m ? PROFILE_MAP[m.profile].kind === 'superficie' : false;
  const price = !info ? null : unit === 'barra' ? info.barPrice : unit === 'kg' ? info.kgPrice : info.pricePerMeter;
  const weight = !info || qty == null ? null : unit === 'barra' ? (info.kgBar ?? 0) * qty : unit === 'kg' ? qty : (info.kgm ?? 0) * qty;
  const add = () => {
    if (!m || qty == null || qty <= 0) return;
    onPick({ id: uid(), description: m.name, unit: unit === 'barra' && plate ? 'hoja' : unit, qty, unitPrice: price ?? 0, applyWaste: unit !== 'barra', materialId: m.id, weightKg: weight });
  };
  return (
    <Modal open onClose={onClose} title="Agregar del catálogo"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={add} disabled={!m || !qty}>Agregar</Button></>}>
      {!materials?.length ? <Empty icon={<Package className="size-7" />} title="Catálogo vacío" action={<Link to="/catalogo"><Button>Ir al catálogo</Button></Link>} /> : (
        <div className="grid gap-3">
          <Field label="Material">{(id) => <Select id={id} value={mid} onChange={setMid} options={[{ value: '', label: 'Elige un material' }, ...materials.map((x) => ({ value: x.id, label: x.name }))]} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad">{(id) => <NumberInput id={id} value={qty} min={0} onChange={setQty} />}</Field>
            <Field label="Unidad">{(id) => <Select id={id} value={unit} onChange={setUnit} options={[{ value: 'barra', label: plate ? 'Hojas' : 'Barras' }, { value: 'kg', label: 'Kilogramos' }, { value: 'm', label: 'Metros' }]} />}</Field>
          </div>
          {m && (price == null
            ? <Notice tone="warn">Este material no tiene precio capturado. Se agregará con precio $0 para que lo completes.</Notice>
            : <Notice>Precio: {money(price)} por {unit}{weight != null ? ` · ${kg(weight)}` : ''}{m.priceDate ? ` · actualizado ${dateMx(m.priceDate)}` : ''}</Notice>)}
        </div>
      )}
    </Modal>
  );
}

function PlanPicker({ onClose, onPick }: { onClose: () => void; onPick: (l: MaterialLine[], w: string[], planId: string) => void }) {
  const plans = useCutPlans();
  return (
    <Modal open onClose={onClose} title="Importar desde plan de corte">
      {!plans?.length ? <Empty icon={<Scissors className="size-7" />} title="No hay planes de corte" action={<Link to="/cortes"><Button>Ir al optimizador</Button></Link>} /> : (
        <div className="space-y-1.5">
          <p className="mb-2 text-sm text-mute">Se agregan las barras a comprar de cada material con su precio por barra.</p>
          {plans.map((p) => (
            <button key={p.id} type="button" onClick={() => { const r = planToMaterialLines(p); onPick(r.lines, r.warnings, p.id); }}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-left hover:border-volt/60 hover:bg-raised">
              <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="text-xs text-mute">{p.groups.map((g) => g.label).join(', ')}</span></span>
              <span className="num shrink-0 text-sm text-ink-2">{p.summary ? `${p.summary.newBars} barras` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
