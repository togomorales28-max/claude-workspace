import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker, useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronUp,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Hammer,
  FileQuestion,
  Info,
} from 'lucide-react';
import { db } from '@/data/db';
import { clientsRepo, quotesRepo } from '@/data/repo';
import { blankLine, lineFromMaterial, newQuote } from '@/data/factory';
import { calculate, derivedMeasures, marginToMarkup, markupToMargin } from '@/domain/calc';
import { JOB_TYPES, ROUND_OPTIONS, UNITS, unitShort } from '@/domain/constants';
import { decimal, money, pct } from '@/domain/format';
import type { Quote, QuoteLine } from '@/domain/types';
import { stepForErrorKey, validateClient, validateQuote, type Errors } from '@/domain/validation';
import { useClients, useMaterials, useSettings } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  NumberInput,
  Segmented,
  Select,
  Textarea,
  Toggle,
} from '@/components/ui';
import { CostSummary } from './CostSummary';
import { MaterialPicker } from './MaterialPicker';

const STEPS = ['Trabajo', 'Medidas', 'Materiales', 'Mano de obra', 'Gastos', 'Ganancia', 'Revisión', 'Documento'];

export function QuoteEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const settings = useSettings();
  const existing = useLiveQuery(async () => (id ? ((await db.quotes.get(id)) ?? null) : null), [id]);

  if (!settings || (id && existing === undefined)) return <div className="h-64" />;
  if (id && existing === null)
    return (
      <EmptyState
        icon={FileQuestion}
        title="Cotización no encontrada"
        description="Puede que haya sido eliminada."
        action={
          <Link to="/cotizaciones">
            <Button>Ver cotizaciones</Button>
          </Link>
        }
      />
    );
  const prefill = (location.state as { prefill?: Quote } | null)?.prefill;
  const initial = existing ?? prefill ?? newQuote(settings);
  return <QuoteEditor key={initial.id} initial={initial} isNew={!existing} />;
}

type NewClient = { name: string; phone: string };

function QuoteEditor({ initial, isNew }: { initial: Quote; isNew: boolean }) {
  const navigate = useNavigate();
  const clients = useClients();
  const materials = useMaterials();
  const [q, setQ] = useState<Quote>(initial);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(isNew && !!initial.lines.length);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState<NewClient | null>(null);
  const [picker, setPicker] = useState<null | 'material' | 'consumable'>(null);
  const [sheet, setSheet] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const b = useMemo(() => calculate(q), [q]);
  const update = useCallback((patch: Partial<Quote> | ((q: Quote) => Partial<Quote>)) => {
    setQ((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
    setDirty(true);
  }, []);

  // Advertir al salir con cambios sin guardar
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Después de un intento fallido de guardar, revalidar en vivo para que los errores desaparezcan al corregirlos.
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    if (!attempted) return;
    const candidate = newClient ? { ...q, clientName: newClient.name.trim(), clientPhone: newClient.phone.trim() } : q;
    const e = validateQuote(candidate);
    if (newClient) for (const [k, v] of Object.entries(validateClient(newClient))) e[`newClient.${k}`] = v;
    setErrors(e);
  }, [q, newClient, attempted]);

  const goStep = (i: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = useCallback(
    async (then?: 'view') => {
      let candidate = q;
      if (newClient) candidate = { ...q, clientName: newClient.name.trim(), clientPhone: newClient.phone.trim() };
      const e = validateQuote(candidate);
      if (newClient) Object.assign(e, Object.fromEntries(Object.entries(validateClient({ ...newClient })).map(([k, v]) => [`newClient.${k}`, v])));
      setErrors(e);
      setAttempted(true);
      const keys = Object.keys(e);
      if (keys.length) {
        const first = keys[0];
        goStep(first.startsWith('newClient') ? 0 : stepForErrorKey(first));
        toast.error('Revisa los campos marcados', { description: e[first] });
        return;
      }
      setSaving(true);
      try {
        if (newClient) {
          const c = await clientsRepo.create({ name: newClient.name.trim(), phone: newClient.phone.trim() });
          candidate = { ...candidate, clientId: c.id };
          setNewClient(null);
        }
        const saved = await quotesRepo.save(candidate);
        setQ(saved);
        setDirty(false);
        toast.success(isNew ? `Cotización ${saved.number} creada` : 'Cambios guardados');
        // Navegar después de que React aplique dirty=false (para no activar el bloqueo)
        setTimeout(() => {
          if (then === 'view') navigate(`/cotizaciones/${saved.id}`);
          else if (isNew) navigate(`/cotizaciones/${saved.id}/editar`, { replace: true });
        }, 0);
      } catch (err) {
        toast.error('No se pudo guardar', { description: (err as Error).message });
      } finally {
        setSaving(false);
      }
    },
    [q, newClient, isNew, navigate],
  );

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save]);

  const priceMap = useMemo(() => new Map((materials ?? []).map((m) => [m.id, m])), [materials]);
  const stale = q.lines.filter((l) => l.materialId && priceMap.has(l.materialId) && priceMap.get(l.materialId)!.price !== l.unitPrice);

  const setLine = (id: string, patch: Partial<QuoteLine>) =>
    update((p) => ({ lines: p.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const removeLine = (id: string) => update((p) => ({ lines: p.lines.filter((l) => l.id !== id) }));
  const refreshPrices = () => {
    update((p) => ({
      lines: p.lines.map((l) => (l.materialId && priceMap.has(l.materialId) ? { ...l, unitPrice: priceMap.get(l.materialId)!.price } : l)),
    }));
    toast.success('Precios actualizados con el catálogo');
  };

  const stepHasError = (i: number) =>
    Object.keys(errors).some((k) => (k.startsWith('newClient') ? 0 : stepForErrorKey(k)) === i);

  return (
    <div ref={topRef} className="scroll-mt-20">
      {/* Encabezado */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton icon={ArrowLeft} label="Volver" onClick={() => navigate(isNew ? '/cotizaciones' : `/cotizaciones/${q.id}`)} />
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-ember-400">
              {isNew ? 'Nueva cotización' : q.number}
            </div>
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{q.title || 'Sin título'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="hidden text-xs text-ink-400 sm:inline">Cambios sin guardar</span>}
          <Button icon={Save} onClick={() => save()} disabled={saving}>
            Guardar
          </Button>
          <Button variant="primary" icon={FileText} onClick={() => save('view')} disabled={saving} className="hidden sm:inline-flex">
            Guardar y ver documento
          </Button>
        </div>
      </div>

      {/* Pasos */}
      <nav aria-label="Pasos" className="scrollbar-none -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-1 border-b border-ink-750">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => goStep(i)}
                aria-current={step === i ? 'step' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-2 px-3 text-[13px] font-medium transition-colors',
                  step === i ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
                )}
              >
                <span
                  className={cn(
                    'num grid size-5 place-items-center rounded-full text-[11px]',
                    stepHasError(i) ? 'bg-bad text-ink-950' : step === i ? 'bg-ember-500 text-ink-950' : 'bg-ink-750 text-ink-300',
                  )}
                >
                  {i + 1}
                </span>
                {s}
                {step === i && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ember-500" />}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div key={step} className="anim-rise min-w-0">
          {step === 0 && (
            <StepJob q={q} update={update} errors={errors} clients={clients ?? []} newClient={newClient} setNewClient={(c) => { setNewClient(c); setDirty(true); }} />
          )}
          {step === 1 && <StepDimensions q={q} update={update} errors={errors} />}
          {step === 2 && (
            <StepMaterials
              q={q}
              update={update}
              errors={errors}
              b={b}
              setLine={setLine}
              removeLine={removeLine}
              openPicker={setPicker}
              staleCount={stale.length}
              priceMap={priceMap}
              refreshPrices={refreshPrices}
            />
          )}
          {step === 3 && <StepLabor q={q} update={update} errors={errors} b={b} />}
          {step === 4 && <StepExtras q={q} update={update} errors={errors} b={b} />}
          {step === 5 && <StepProfit q={q} update={update} errors={errors} b={b} />}
          {step === 6 && <StepReview q={q} b={b} goStep={goStep} />}
          {step === 7 && <StepDocument q={q} update={update} errors={errors} onFinish={() => save('view')} saving={saving} />}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button icon={ArrowLeft} variant="ghost" onClick={() => goStep(step - 1)} disabled={step === 0}>
              Anterior
            </Button>
            {step < STEPS.length - 1 ? (
              <Button iconRight={ArrowRight} variant="primary" onClick={() => goStep(step + 1)}>
                {STEPS[step + 1]}
              </Button>
            ) : (
              <Button icon={FileText} variant="primary" onClick={() => save('view')} disabled={saving}>
                Guardar y generar
              </Button>
            )}
          </div>
        </div>

        {/* Resumen lateral (escritorio) */}
        <aside className="hidden xl:block">
          <div className="sticky top-6 rounded-xl border border-ink-750 bg-ink-850 p-5">
            <PriceHeader b={b} q={q} />
            <div className="mt-4 border-t border-ink-750 pt-4">
              <CostSummary b={b} quantity={q.dimensions.quantity} taxPct={q.taxPct} />
            </div>
          </div>
        </aside>
      </div>

      {/* Barra de precio (móvil/tablet) */}
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t border-ink-700 bg-ink-850/95 px-4 py-2.5 backdrop-blur lg:bottom-0 lg:left-60 xl:hidden">
        <button type="button" onClick={() => setSheet(true)} className="flex w-full items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-[11px] uppercase tracking-wider text-ink-400">Precio de venta</span>
            <span className="num text-xl font-semibold text-ink-100">{money(b.total)}</span>
          </span>
          <span className="flex items-center gap-3 text-right">
            <span>
              <span className="block text-[11px] text-ink-400">Costo {money(b.cost)}</span>
              <span className={cn('num text-xs', b.profit >= 0 ? 'text-ok' : 'text-bad')}>Ganancia {money(b.profit)}</span>
            </span>
            <ChevronUp className="size-5 text-ink-400" />
          </span>
        </button>
      </div>
      <div className="h-20 xl:hidden" />
      <Modal open={sheet} onClose={() => setSheet(false)} title="Desglose de costos">
        <PriceHeader b={b} q={q} />
        <div className="mt-4 border-t border-ink-750 pt-4">
          <CostSummary b={b} quantity={q.dimensions.quantity} taxPct={q.taxPct} />
        </div>
      </Modal>

      <MaterialPicker
        open={!!picker}
        kind={picker ?? 'material'}
        onClose={() => setPicker(null)}
        onPick={(m) =>
          update((p) => {
            const found = p.lines.find((l) => l.materialId === m.id);
            if (found) return { lines: p.lines.map((l) => (l.id === found.id ? { ...l, qty: l.qty + 1 } : l)) };
            return { lines: [...p.lines, lineFromMaterial(m)] };
          })
        }
      />

      {dirty && <UnsavedGuard />}
    </div>
  );
}

/** Solo se monta con cambios pendientes, para no registrar un bloqueo de navegación innecesario. */
function UnsavedGuard() {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname);
  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      size="sm"
      title="¿Salir sin guardar?"
      description="Tienes cambios en esta cotización que se perderán."
      footer={
        <>
          <Button variant="ghost" onClick={() => blocker.reset?.()}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            Salir sin guardar
          </Button>
        </>
      }
    >
      <span />
    </Modal>
  );
}

function PriceHeader({ b, q }: { b: ReturnType<typeof calculate>; q: Quote }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {q.taxEnabled ? 'Total con IVA' : 'Precio de venta'}
      </div>
      <div className="num mt-1 text-[32px] font-semibold leading-none tracking-tight text-ink-100">{money(b.total)}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
        <span>
          Costo <span className="num text-ink-200">{money(b.cost)}</span>
        </span>
        <span>
          Ganancia <span className={cn('num', b.profit >= 0 ? 'text-ok' : 'text-bad')}>{money(b.profit)}</span>
        </span>
        <span>
          Margen <span className="num text-ink-200">{pct(b.marginPct)}</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Pasos
type StepProps = { q: Quote; update: (p: Partial<Quote> | ((q: Quote) => Partial<Quote>)) => void; errors: Errors };

function Section({ title, description, children, aside }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-750 bg-ink-850 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-100">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-400">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StepJob({
  q,
  update,
  errors,
  clients,
  newClient,
  setNewClient,
}: StepProps & { clients: { id: string; name: string; phone: string }[]; newClient: NewClient | null; setNewClient: (c: NewClient | null) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Tipo de trabajo" description="Elige la categoría que mejor describe el trabajo.">
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {JOB_TYPES.map((j) => (
            <button
              key={j.id}
              type="button"
              role="radio"
              aria-checked={q.jobType === j.id}
              onClick={() => update({ jobType: j.id, title: q.title || j.label })}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors',
                q.jobType === j.id ? 'border-ember-500 bg-ember-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-600',
              )}
            >
              <span className={cn('block text-sm font-medium', q.jobType === j.id ? 'text-ember-300' : 'text-ink-100')}>{j.label}</span>
              <span className="mt-0.5 block text-[11px] leading-tight text-ink-500">{j.hint}</span>
            </button>
          ))}
        </div>
        {errors.jobType && <p className="mt-2 text-xs text-bad">{errors.jobType}</p>}
      </Section>

      <Section title="Datos del trabajo">
        <div className="grid gap-4">
          <Field label="Título" required error={errors.title} htmlFor="title">
            <Input id="title" value={q.title} onChange={(e) => update({ title: e.target.value })} placeholder="Ej. Barandal de balcón 3.6 m" invalid={!!errors.title} maxLength={120} />
          </Field>
          <Field label="Descripción para el cliente" hint="Aparece en el documento. Describe acabados, diseño, alcance." htmlFor="desc">
            <Textarea id="desc" value={q.description} onChange={(e) => update({ description: e.target.value })} placeholder="Ej. Barandal con postes de PTR 2×2, pasamanos de PTR 4×2 y barrotes verticales a 10 cm, acabado en pintura negra mate." rows={3} />
          </Field>
        </div>
      </Section>

      <Section title="Cliente" description="Selecciona un cliente registrado o registra uno nuevo.">
        {newClient ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del cliente" required error={errors['newClient.name'] || errors.client} htmlFor="nc-name">
              <Input id="nc-name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} invalid={!!(errors['newClient.name'] || errors.client)} />
            </Field>
            <Field label="Teléfono / WhatsApp" error={errors['newClient.phone']} htmlFor="nc-phone">
              <Input id="nc-phone" type="tel" inputMode="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="10 dígitos" invalid={!!errors['newClient.phone']} />
            </Field>
            <div className="sm:col-span-2">
              <Button size="sm" variant="ghost" onClick={() => setNewClient(null)}>
                Elegir un cliente registrado
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Cliente" required error={errors.client} className="flex-1" htmlFor="client">
              <Select
                id="client"
                value={q.clientId ?? ''}
                invalid={!!errors.client}
                onChange={(e) => {
                  const c = clients.find((x) => x.id === e.target.value);
                  update({ clientId: c?.id ?? null, clientName: c?.name ?? '', clientPhone: c?.phone ?? '' });
                }}
              >
                <option value="">{q.clientId === null && q.clientName ? `${q.clientName} (no registrado)` : 'Selecciona…'}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Button icon={Plus} onClick={() => setNewClient({ name: '', phone: '' })}>
              Cliente nuevo
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}

function StepDimensions({ q, update, errors }: StepProps) {
  const d = q.dimensions;
  const set = (k: keyof Quote['dimensions'], v: number) => update({ dimensions: { ...d, [k]: v } });
  const m = derivedMeasures(d);
  return (
    <Section title="Medidas" description="En metros. Úsalas como referencia para calcular materiales.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label="Ancho">
          <NumberInput value={d.width} onChange={(v) => set('width', v)} suffix="m" aria-label="Ancho en metros" />
        </Field>
        <Field label="Alto">
          <NumberInput value={d.height} onChange={(v) => set('height', v)} suffix="m" aria-label="Alto en metros" />
        </Field>
        <Field label="Largo / fondo">
          <NumberInput value={d.length} onChange={(v) => set('length', v)} suffix="m" aria-label="Largo en metros" />
        </Field>
        <Field label="Cantidad de piezas" error={errors.quantity}>
          <NumberInput value={d.quantity} onChange={(v) => set('quantity', v)} integer suffix="pzas" invalid={!!errors.quantity} aria-label="Cantidad de piezas" />
        </Field>
      </div>
      {errors.dimensions && <p className="mt-2 text-xs text-bad">{errors.dimensions}</p>}

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-750 bg-ink-750 sm:grid-cols-4">
        {[
          ['Área por pieza', m.area ? `${decimal(m.area)} m²` : '—'],
          ['Perímetro', m.perimeter ? `${decimal(m.perimeter)} m` : '—'],
          ['Área total', m.totalArea ? `${decimal(m.totalArea)} m²` : '—'],
          ['Volumen', m.volume ? `${decimal(m.volume)} m³` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="bg-ink-900 px-3 py-2.5">
            <div className="text-[11px] text-ink-500">{k}</div>
            <div className="num text-sm text-ink-200">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-ink-750 bg-ink-900 px-4 py-3">
        <Toggle
          checked={q.perPiece}
          onChange={(v) => update({ perPiece: v })}
          label="Materiales y mano de obra por pieza"
          description={
            d.quantity > 1
              ? `Captura lo que lleva UNA pieza; se multiplicará × ${d.quantity}. Transporte e instalación no se multiplican.`
              : 'Útil cuando fabricas varias piezas iguales (p. ej. 3 protecciones).'
          }
        />
      </div>
    </Section>
  );
}

function LineRows({
  lines,
  errors,
  allLines,
  setLine,
  removeLine,
  priceMap,
}: {
  lines: QuoteLine[];
  allLines: QuoteLine[];
  errors: Errors;
  setLine: (id: string, p: Partial<QuoteLine>) => void;
  removeLine: (id: string) => void;
  priceMap: Map<string, { price: number }>;
}) {
  return (
    <div className="flex flex-col divide-y divide-ink-750">
      <div className="hidden grid-cols-[minmax(0,1fr)_88px_104px_120px_110px_36px] gap-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500 md:grid">
        <span>Concepto</span>
        <span className="text-right">Cantidad</span>
        <span>Unidad</span>
        <span className="text-right">P. unitario</span>
        <span className="text-right">Subtotal</span>
        <span />
      </div>
      {lines.map((l) => {
        const idx = allLines.indexOf(l);
        const err = errors[`line.${idx}`];
        const cat = l.materialId ? priceMap.get(l.materialId) : undefined;
        const isStale = cat && cat.price !== l.unitPrice;
        return (
          <div key={l.id} className="anim-fade py-3 md:py-2">
            <div className="grid grid-cols-[1fr_1fr] gap-2 md:grid-cols-[minmax(0,1fr)_88px_104px_120px_110px_36px] md:items-center">
              <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                <Input value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} placeholder="Nombre del material" invalid={!!err && !l.name.trim()} aria-label="Concepto" />
                <span className="md:hidden">
                  <IconButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => removeLine(l.id)} />
                </span>
              </div>
              <NumberInput value={l.qty} onChange={(v) => setLine(l.id, { qty: v })} aria-label="Cantidad" />
              <Select value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} aria-label="Unidad">
                {!UNITS.some((u) => u.id === l.unit) && <option value={l.unit}>{l.unit}</option>}
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {unitShort(u.id)}
                  </option>
                ))}
              </Select>
              <NumberInput value={l.unitPrice} onChange={(v) => setLine(l.id, { unitPrice: v })} prefix="$" aria-label="Precio unitario" invalid={l.unitPrice === 0} />
              <div className="num flex h-10 items-center justify-end text-sm text-ink-100">
                <span className="mr-auto text-xs text-ink-500 md:hidden">Subtotal</span>
                {money(l.qty * l.unitPrice)}
              </div>
              <span className="hidden md:block">
                <IconButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => removeLine(l.id)} />
              </span>
            </div>
            {(isStale || l.unitPrice === 0 || err) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                {err && <span className="text-bad">{err}</span>}
                {l.unitPrice === 0 && !err && <span className="text-warn">Sin precio: captura el precio unitario.</span>}
                {isStale && (
                  <button type="button" onClick={() => setLine(l.id, { unitPrice: cat.price })} className="inline-flex items-center gap-1 text-info hover:underline">
                    <RefreshCw className="size-3" /> Catálogo: {money(cat.price)} — usar este precio
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepMaterials({
  q,
  update,
  errors,
  b,
  setLine,
  removeLine,
  openPicker,
  staleCount,
  priceMap,
  refreshPrices,
}: StepProps & {
  b: ReturnType<typeof calculate>;
  setLine: (id: string, p: Partial<QuoteLine>) => void;
  removeLine: (id: string) => void;
  openPicker: (k: 'material' | 'consumable') => void;
  staleCount: number;
  priceMap: Map<string, { price: number }>;
  refreshPrices: () => void;
}) {
  const mats = q.lines.filter((l) => l.kind === 'material');
  const cons = q.lines.filter((l) => l.kind === 'consumable');
  const per = q.perPiece && q.dimensions.quantity > 1 ? ` (por pieza, × ${q.dimensions.quantity})` : '';
  return (
    <div className="flex flex-col gap-5">
      {errors.costs && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{errors.costs}</p>}
      {staleCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm">
          <span className="text-info">
            {staleCount} {staleCount === 1 ? 'material tiene' : 'materiales tienen'} un precio distinto en el catálogo.
          </span>
          <Button size="sm" icon={RefreshCw} onClick={refreshPrices}>
            Actualizar precios
          </Button>
        </div>
      )}
      {(['material', 'consumable'] as const).map((kind) => {
        const list = kind === 'material' ? mats : cons;
        return (
          <Section
            key={kind}
            title={kind === 'material' ? `Materiales${per}` : `Consumibles${per}`}
            description={
              kind === 'material'
                ? 'Perfiles, tubulares, PTR, lámina, placa, varilla, herrajes…'
                : 'Electrodos, discos de corte y desbaste, pintura, thinner…'
            }
            aside={
              <div className="flex gap-2">
                <Button size="sm" icon={Package} onClick={() => openPicker(kind)}>
                  Del catálogo
                </Button>
                <Button size="sm" icon={Plus} variant="ghost" onClick={() => update((p) => ({ lines: [...p.lines, blankLine(kind)] }))}>
                  Línea libre
                </Button>
              </div>
            }
          >
            {list.length ? (
              <LineRows lines={list} allLines={q.lines} errors={errors} setLine={setLine} removeLine={removeLine} priceMap={priceMap} />
            ) : (
              <p className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-500">
                Sin {kind === 'material' ? 'materiales' : 'consumibles'}. Agrégalos desde tu catálogo o con una línea libre.
              </p>
            )}
            <div className="mt-3 flex justify-end border-t border-ink-750 pt-3 text-sm">
              <span className="text-ink-400">Subtotal&nbsp;</span>
              <span className="num font-medium text-ink-100">{money(kind === 'material' ? b.materials : b.consumables)}</span>
            </div>
          </Section>
        );
      })}
      <Section title="Desperdicio de material" description="Recortes y mermas. Se aplica solo sobre materiales (no consumibles).">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Desperdicio" className="w-36">
            <NumberInput value={q.wastePct} onChange={(v) => update({ wastePct: v })} suffix="%" aria-label="Porcentaje de desperdicio" />
          </Field>
          <div className="pb-2.5 text-sm text-ink-400">
            = <span className="num text-ink-100">{money(b.waste)}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}

function StepLabor({ q, update, errors, b }: StepProps & { b: ReturnType<typeof calculate> }) {
  const l = q.labor;
  const set = (k: keyof Quote['labor'], v: number) => update({ labor: { ...l, [k]: v } });
  return (
    <Section title="Mano de obra" description="Horas estimadas de fabricación (sin contar instalación si la cobras aparte).">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Trabajadores">
          <NumberInput value={l.workers} onChange={(v) => set('workers', v)} integer suffix="pers." aria-label="Trabajadores" />
        </Field>
        <Field label={q.perPiece && q.dimensions.quantity > 1 ? 'Horas por trabajador (por pieza)' : 'Horas por trabajador'}>
          <NumberInput value={l.hours} onChange={(v) => set('hours', v)} suffix="h" aria-label="Horas" />
        </Field>
        <Field label="Costo por hora" hint="Predeterminado en Configuración.">
          <NumberInput value={l.rate} onChange={(v) => set('rate', v)} prefix="$" suffix="/h" aria-label="Costo por hora" />
        </Field>
      </div>
      {errors.labor && <p className="mt-2 text-xs text-bad">{errors.labor}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-ink-900 px-4 py-3 text-sm">
        <span className="text-ink-400">
          Horas-hombre totales <span className="num text-ink-100">{decimal(b.laborHours)} h</span>
        </span>
        <span className="text-ink-400">
          Jornadas de 8 h <span className="num text-ink-100">{decimal(b.laborHours / 8)}</span>
        </span>
        <span className="ml-auto text-ink-400">
          Mano de obra <span className="num font-semibold text-ink-100">{money(b.labor)}</span>
        </span>
      </div>
      {l.rate === 0 && l.hours > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-warn">
          <Info className="size-3.5" /> El costo por hora está en $0. Configúralo para que la mano de obra cuente.
        </p>
      )}
    </Section>
  );
}

function StepExtras({ q, update, errors, b }: StepProps & { b: ReturnType<typeof calculate> }) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Gastos adicionales" description="Costos que no son material ni mano de obra de taller.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transporte / flete">
            <NumberInput value={q.transport} onChange={(v) => update({ transport: v })} prefix="$" aria-label="Transporte" />
          </Field>
          <Field label="Instalación">
            <NumberInput value={q.installation} onChange={(v) => update({ installation: v })} prefix="$" aria-label="Instalación" />
          </Field>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-300">Otros gastos</span>
            <Button
              size="sm"
              icon={Plus}
              variant="ghost"
              onClick={() => update((p) => ({ extras: [...p.extras, { id: crypto.randomUUID?.() ?? String(Date.now()), label: '', amount: 0 }] }))}
            >
              Agregar gasto
            </Button>
          </div>
          {q.extras.length === 0 ? (
            <p className="text-sm text-ink-500">Ej. renta de andamio, grúa, galvanizado externo, viáticos.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {q.extras.map((x) => (
                <div key={x.id} className="anim-fade flex items-center gap-2">
                  <Input
                    value={x.label}
                    onChange={(e) => update((p) => ({ extras: p.extras.map((y) => (y.id === x.id ? { ...y, label: e.target.value } : y)) }))}
                    placeholder="Descripción"
                    invalid={!!errors.extras && !x.label.trim()}
                    aria-label="Descripción del gasto"
                  />
                  <NumberInput
                    className="w-36 shrink-0"
                    value={x.amount}
                    prefix="$"
                    onChange={(v) => update((p) => ({ extras: p.extras.map((y) => (y.id === x.id ? { ...y, amount: v } : y)) }))}
                    aria-label="Monto"
                  />
                  <IconButton icon={Trash2} tone="danger" label="Eliminar gasto" onClick={() => update((p) => ({ extras: p.extras.filter((y) => y.id !== x.id) }))} />
                </div>
              ))}
            </div>
          )}
          {errors.extras && <p className="mt-2 text-xs text-bad">{errors.extras}</p>}
        </div>
        <div className="mt-4 flex justify-end border-t border-ink-750 pt-3 text-sm">
          <span className="text-ink-400">Total adicionales&nbsp;</span>
          <span className="num font-medium text-ink-100">{money(b.additional)}</span>
        </div>
      </Section>
      <Section title="Imprevistos" description="Colchón sobre el costo directo para cubrir errores, retrabajos o alzas de precio.">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Imprevistos" className="w-36">
            <NumberInput value={q.contingencyPct} onChange={(v) => update({ contingencyPct: v })} suffix="%" aria-label="Porcentaje de imprevistos" />
          </Field>
          <div className="pb-2.5 text-sm text-ink-400">
            de <span className="num text-ink-200">{money(b.direct)}</span> = <span className="num text-ink-100">{money(b.contingency)}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}

function StepProfit({ q, update, errors, b }: StepProps & { b: ReturnType<typeof calculate> }) {
  const equivalent = q.profitMode === 'margin' ? marginToMarkup(q.profitPct) : markupToMargin(q.profitPct);
  return (
    <div className="flex flex-col gap-5">
      <Section title="Ganancia" description="Elige cómo calcular la ganancia. No son lo mismo.">
        <Segmented
          value={q.profitMode}
          onChange={(v) => update({ profitMode: v })}
          options={[
            { value: 'margin', label: 'Margen sobre venta' },
            { value: 'markup', label: 'Recargo sobre costo' },
          ]}
          className="w-full sm:w-auto"
        />
        <p className="mt-3 text-sm text-ink-400">
          {q.profitMode === 'margin'
            ? 'Precio = Costo ÷ (1 − margen). Un 30 % de margen significa que 30 de cada 100 pesos cobrados son ganancia.'
            : 'Precio = Costo × (1 + recargo). Un 30 % de recargo suma 30 pesos por cada 100 de costo.'}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={q.profitMode === 'margin' ? 'Margen' : 'Recargo'} className="w-36" error={errors.profit}>
            <NumberInput value={q.profitPct} onChange={(v) => update({ profitPct: v, manualPrice: null })} suffix="%" invalid={!!errors.profit || !!b.error} aria-label="Porcentaje de ganancia" />
          </Field>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {[15, 20, 25, 30, 35, 40, 50].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ profitPct: p, manualPrice: null })}
                className={cn(
                  'num h-8 rounded-md border px-2.5 text-xs transition-colors',
                  q.profitPct === p ? 'border-ember-500 bg-ember-500/15 text-ember-300' : 'border-ink-700 text-ink-300 hover:border-ink-600',
                )}
              >
                {p} %
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Equivale a {Number.isFinite(equivalent) ? pct(equivalent) : '—'} {q.profitMode === 'margin' ? 'de recargo sobre costo' : 'de margen sobre venta'}.
        </p>
      </Section>

      <Section title="Precio final">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Redondear precio" hint="Siempre hacia arriba.">
            <Select value={q.roundTo} onChange={(e) => update({ roundTo: Number(e.target.value) })}>
              {ROUND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Precio manual (opcional)" hint={q.manualPrice !== null ? `Recomendado: ${money(b.roundedPrice)}` : 'Fija un precio y revisa tu margen real.'}>
            <div className="flex gap-2">
              <NumberInput
                className="flex-1"
                value={q.manualPrice ?? 0}
                prefix="$"
                onChange={(v) => update({ manualPrice: v > 0 ? v : null })}
                aria-label="Precio manual"
              />
              {q.manualPrice !== null && (
                <Button variant="ghost" onClick={() => update({ manualPrice: null })}>
                  Quitar
                </Button>
              )}
            </div>
          </Field>
        </div>
        <div className="mt-5 rounded-lg border border-ink-750 bg-ink-900 px-4 py-3">
          <Toggle
            checked={q.taxEnabled}
            onChange={(v) => update({ taxEnabled: v })}
            label={`Agregar IVA (${q.taxPct} %)`}
            description="Actívalo si vas a facturar. El IVA no es ganancia: se suma al precio de venta."
          />
        </div>
      </Section>
    </div>
  );
}

function StepReview({ q, b, goStep }: { q: Quote; b: ReturnType<typeof calculate>; goStep: (i: number) => void }) {
  const m = derivedMeasures(q.dimensions);
  const qty = Math.max(1, q.dimensions.quantity);
  const metrics = [
    m.totalArea > 0 && { k: 'Precio por m²', v: money(b.price / m.totalArea) },
    (q.dimensions.length || q.dimensions.width) > 0 && { k: 'Precio por metro lineal', v: money(b.price / m.linear) },
    qty > 1 && { k: 'Precio por pieza', v: money(b.price / qty) },
    b.laborHours > 0 && { k: 'Ganancia por hora-hombre', v: money(b.profit / b.laborHours) },
  ].filter(Boolean) as { k: string; v: string }[];
  return (
    <div className="flex flex-col gap-5">
      <Section title="Revisión del desglose" description="Verifica cada concepto antes de generar el documento.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 rounded-lg bg-ink-900 p-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-400">COSTO TOTAL</div>
              <div className="mt-1 text-xs text-ink-500">Materiales + desperdicio + consumibles + mano de obra + adicionales + imprevistos</div>
              <div className="num mt-2 text-2xl font-semibold">{money(b.cost)}</div>
            </div>
            <div className="rounded-lg bg-ember-500/10 p-4 ring-1 ring-ember-500/25">
              <div className="text-[11px] uppercase tracking-wider text-ember-300">PRECIO DE VENTA</div>
              <div className="mt-1 text-xs text-ink-400">Costo total + ganancia ({pct(b.marginPct)} margen · {pct(b.markupPct)} recargo)</div>
              <div className="num mt-2 text-2xl font-semibold">{money(b.price)}</div>
              {b.tax > 0 && <div className="num mt-1 text-sm text-ink-300">Total con IVA: {money(b.total)}</div>}
            </div>
          </div>
          <CostSummary b={b} quantity={qty} taxPct={q.taxPct} />
        </div>
      </Section>
      {metrics.length > 0 && (
        <Section title="Indicadores" description="Útiles para comparar con otros trabajos o con la competencia.">
          <div className="flex flex-wrap gap-px overflow-hidden rounded-lg border border-ink-750 bg-ink-750">
            {metrics.map((x) => (
              <div key={x.k} className="min-w-[45%] flex-1 bg-ink-900 px-3 py-3 sm:min-w-0">
                <div className="text-[11px] text-ink-500">{x.k}</div>
                <div className="num text-sm font-medium text-ink-100">{x.v}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon={Hammer} onClick={() => goStep(2)}>
          Editar materiales
        </Button>
        <Button size="sm" variant="ghost" icon={Check} onClick={() => goStep(5)}>
          Ajustar ganancia
        </Button>
      </div>
    </div>
  );
}

function StepDocument({ q, update, errors, onFinish, saving }: StepProps & { onFinish: () => void; saving: boolean }) {
  return (
    <Section title="Datos del documento" description="Lo que verá tu cliente en la cotización.">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Tiempo estimado de entrega">
            <Input value={q.deliveryTime} onChange={(e) => update({ deliveryTime: e.target.value })} maxLength={140} />
          </Field>
          <Field label="Vigencia" error={errors.validity}>
            <NumberInput value={q.validityDays} onChange={(v) => update({ validityDays: v })} integer suffix="días" invalid={!!errors.validity} aria-label="Vigencia en días" />
          </Field>
        </div>
        <Field label="Condiciones de pago">
          <Textarea value={q.paymentTerms} onChange={(e) => update({ paymentTerms: e.target.value })} rows={2} />
        </Field>
        <Field label="Notas para el cliente" hint="Garantía, exclusiones, colores, etc.">
          <Textarea value={q.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} />
        </Field>
        <Field label="Detalle en el documento">
          <Segmented
            value={q.docDetail}
            onChange={(v) => update({ docDetail: v })}
            options={[
              { value: 'quantities', label: 'Lista de materiales' },
              { value: 'summary', label: 'Solo resumen' },
            ]}
          />
          <p className="text-xs text-ink-400">
            Tus costos y ganancia nunca aparecen en el documento. La lista muestra materiales con cantidades, sin precios unitarios.
          </p>
        </Field>
        <div className="pt-2">
          <Button variant="primary" size="lg" icon={FileText} onClick={onFinish} disabled={saving} className="w-full sm:w-auto">
            Guardar y ver documento
          </Button>
        </div>
      </div>
    </Section>
  );
}
