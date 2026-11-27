import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Bookmark, FileText, Trash2, Scaling } from 'lucide-react';
import { useQuotes, useReferences, useSettings } from '@/lib/hooks';
import { referencesRepo, uid } from '@/data/repo';
import { newQuote } from '@/data/factory';
import { calculate, r2 } from '@/domain/calc';
import { LENGTH_UNITS, SCALE_METHODS, scaleEstimate, scaleQuoteInput, toMeters } from '@/domain/scale';
import { JOB_TYPES, jobTypeLabel } from '@/domain/constants';
import { decimal, money, pct } from '@/domain/format';
import type { LengthUnit, Quote, ScaleMethod } from '@/domain/types';
import { Button, EmptyState, Field, IconButton, Input, NumberInput, PageHeader, Segmented, Select } from '@/components/ui';
import { useConfirm } from '@/components/ui/confirm';
import { cn } from '@/lib/cn';

export function EstimatorPage() {
  const location = useLocation();
  const presetQuote = (location.state as { quoteId?: string } | null)?.quoteId;
  const [mode, setMode] = useState<'reference' | 'quote'>(presetQuote ? 'quote' : 'reference');
  return (
    <div>
      <PageHeader
        eyebrow="Estimador por medida"
        title="¿Cuánto cobro si cambia el tamaño?"
        subtitle="Parte de un trabajo que ya cobraste y calcula el precio proporcional para otra medida."
      />
      <Segmented
        className="mb-6 w-full sm:w-auto"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'reference', label: 'Precio de referencia' },
          { value: 'quote', label: 'Escalar cotización' },
        ]}
      />
      {mode === 'reference' ? <ReferenceEstimator /> : <QuoteScaler presetId={presetQuote} />}
    </div>
  );
}

const unitAbbr = (u: LengthUnit) => (u === 'ft' ? 'ft' : u === 'in' ? 'in' : u);

function ReferenceEstimator() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const settings = useSettings();
  const refs = useReferences();
  const [name, setName] = useState('');
  const [jobType, setJobType] = useState('barandal');
  const [method, setMethod] = useState<ScaleMethod>('linear');
  const [unit, setUnit] = useState<LengthUnit>('ft');
  const [refPrice, setRefPrice] = useState(0);
  const [refLength, setRefLength] = useState(0);
  const [refHeight, setRefHeight] = useState(0);
  const [newLength, setNewLength] = useState(0);
  const [newHeight, setNewHeight] = useState(0);
  const [newQty, setNewQty] = useState(1);
  const [fixedPct, setFixedPct] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const r = scaleEstimate({ method, refPrice, refLength, refHeight, newLength, newHeight, newQty, fixedPct });
  const u = unitAbbr(unit);
  const measureLabel = method === 'area' ? 'Ancho' : 'Largo';

  const loadExample = () => {
    setName('Barandal de balcón (plano 10 ft)');
    setJobType('barandal');
    setMethod('linear');
    setUnit('ft');
    setRefPrice(200);
    setRefLength(10);
    setRefHeight(0);
    setNewLength(12);
    setNewQty(1);
    setFixedPct(0);
    setLoadedId(null);
  };

  const createQuote = () => {
    if (!settings || !r.valid) return;
    const base = newQuote(settings);
    const L = r2(toMeters(newLength, unit));
    const H = r2(toMeters(newHeight, unit));
    const q: Quote = {
      ...base,
      jobType,
      title: `${jobTypeLabel(jobType)} ${decimal(newLength)}${method === 'area' ? ` × ${decimal(newHeight)}` : ''} ${u}`,
      description: '',
      dimensions: {
        width: method === 'area' ? L : 0,
        height: method === 'area' ? H : 0,
        length: method === 'linear' ? L : 0,
        quantity: Math.max(1, Math.floor(newQty)),
      },
      manualPrice: r.estimate,
      notes: '',
    };
    navigate('/cotizaciones/nueva', { state: { prefill: q } });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <section className="rounded-xl border border-ink-750 bg-ink-850 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">1. Trabajo de referencia</h2>
              <p className="text-sm text-ink-400">Uno que ya cobraste y cuyo precio te funcionó.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={loadExample}>
              Ver ejemplo (10 ft → 12 ft)
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de trabajo">
              <Select
                value={jobType}
                onChange={(e) => {
                  setJobType(e.target.value);
                  const jt = JOB_TYPES.find((j) => j.id === e.target.value);
                  if (jt) setMethod(jt.scale);
                }}
              >
                {JOB_TYPES.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unidad de medida">
              <Select value={unit} onChange={(e) => setUnit(e.target.value as LengthUnit)}>
                {LENGTH_UNITS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-300">¿Cómo crece el precio?</span>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
              {SCALE_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={method === m.id}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left transition-colors',
                    method === m.id ? 'border-ember-500 bg-ember-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-600',
                  )}
                >
                  <span className={cn('block text-sm font-medium', method === m.id ? 'text-ember-300' : 'text-ink-100')}>{m.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Precio cobrado">
              <NumberInput value={refPrice} onChange={setRefPrice} prefix="$" aria-label="Precio de referencia" />
            </Field>
            {method !== 'unit' && (
              <Field label={measureLabel}>
                <NumberInput value={refLength} onChange={setRefLength} suffix={u} aria-label={`${measureLabel} de referencia`} />
              </Field>
            )}
            {method === 'area' && (
              <Field label="Alto">
                <NumberInput value={refHeight} onChange={setRefHeight} suffix={u} aria-label="Alto de referencia" />
              </Field>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-ink-750 bg-ink-850 p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold">2. Nuevo trabajo</h2>
          <p className="mb-4 text-sm text-ink-400">La medida que pide tu cliente.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {method !== 'unit' && (
              <Field label={`${measureLabel} nuevo`}>
                <NumberInput value={newLength} onChange={setNewLength} suffix={u} aria-label={`${measureLabel} nuevo`} />
              </Field>
            )}
            {method === 'area' && (
              <Field label="Alto nuevo">
                <NumberInput value={newHeight} onChange={setNewHeight} suffix={u} aria-label="Alto nuevo" />
              </Field>
            )}
            <Field label="Piezas">
              <NumberInput value={newQty} onChange={setNewQty} integer min={1} suffix="pzas" aria-label="Piezas" />
            </Field>
          </div>
          <details className="group mt-4 rounded-lg border border-ink-750 bg-ink-900 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm text-ink-300 marker:hidden">
              <span className="group-open:text-ink-100">Ajuste avanzado: parte fija del precio</span>
              <span className="ml-2 text-xs text-ink-500">{fixedPct ? `${fixedPct} %` : 'opcional'}</span>
            </summary>
            <p className="mt-2 text-xs text-ink-400">
              Algunos costos no cambian con el tamaño (traslado, instalación, postes de arranque, tiempo de preparación). Indica qué porcentaje del precio de
              referencia es fijo: esa parte no se escala.
            </p>
            <Field label="Porcentaje fijo" className="mt-3 w-36">
              <NumberInput value={fixedPct} onChange={(v) => setFixedPct(Math.min(100, v))} suffix="%" aria-label="Porcentaje fijo" />
            </Field>
          </details>
        </section>
      </div>

      {/* Resultado */}
      <aside className="flex flex-col gap-5">
        <section className="rounded-xl border border-ink-750 bg-ink-850 p-5 lg:sticky lg:top-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">Precio estimado</div>
          {r.valid ? (
            <>
              <div className="num mt-1 text-[40px] font-semibold leading-none tracking-tight text-ink-100">{money(r.estimate)}</div>
              <div className={cn('num mt-2 text-sm', r.difference >= 0 ? 'text-ok' : 'text-info')}>
                {r.difference >= 0 ? '+' : ''}
                {money(r.difference)} ({r.differencePct >= 0 ? '+' : ''}
                {pct(r.differencePct)}) vs. referencia
              </div>
              <dl className="mt-5 flex flex-col gap-2 border-t border-ink-750 pt-4 text-sm">
                {method !== 'unit' && (
                  <div className="flex justify-between">
                    <dt className="text-ink-400">Precio por {method === 'area' ? `${u}²` : `${u} lineal`}</dt>
                    <dd className="num">{money(r.ratePerUnit)}</dd>
                  </div>
                )}
                {method !== 'unit' && (
                  <div className="flex justify-between">
                    <dt className="text-ink-400">Factor de tamaño</dt>
                    <dd className="num">× {decimal(r.factor)}</dd>
                  </div>
                )}
                {fixedPct > 0 && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Parte fija</dt>
                      <dd className="num">{money(r.fixed)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-400">Parte escalada</dt>
                      <dd className="num">{money(r.variable)}</dd>
                    </div>
                  </>
                )}
                {method !== 'unit' && unit !== 'm' && (
                  <div className="flex justify-between text-xs text-ink-500">
                    <dt>Medida nueva en metros</dt>
                    <dd className="num">
                      {decimal(toMeters(newLength, unit))}
                      {method === 'area' && ` × ${decimal(toMeters(newHeight, unit))}`} m
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 rounded-lg bg-ink-900 px-3 py-2 text-xs leading-relaxed text-ink-400">
                {method === 'linear' &&
                  `${money(refPrice)} ÷ ${decimal(refLength)} ${u} = ${money(r.ratePerUnit)} por ${u}${fixedPct ? ' (parte variable)' : ''}. × ${decimal(newLength)} ${u}${newQty > 1 ? ` × ${newQty} pzas` : ''}${fixedPct ? ` + ${money(r.fixed)} fijo` : ''} = ${money(r.estimate)}.`}
                {method === 'area' &&
                  `Área de referencia ${decimal(refLength * refHeight)} ${u}² → nueva ${decimal(newLength * newHeight)} ${u}². Factor × ${decimal(r.factor)}${newQty > 1 ? ` × ${newQty} pzas` : ''}.`}
                {method === 'unit' && `${money(refPrice)} por pieza × ${newQty} pzas${fixedPct ? ` (con ${money(r.fixed)} fijo una sola vez)` : ''}.`}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="primary" icon={FileText} onClick={createQuote} disabled={!settings}>
                  Crear cotización con este precio
                </Button>
                <Button
                  icon={Bookmark}
                  onClick={async () => {
                    const label = name.trim() || `${jobTypeLabel(jobType)} ${decimal(refLength)} ${u}`;
                    const saved = await referencesRepo.save({
                      id: loadedId ?? undefined,
                      name: label,
                      jobType,
                      method,
                      unit,
                      refLength,
                      refHeight,
                      price: refPrice,
                      fixedPct,
                    });
                    setLoadedId(saved.id);
                    setName(label);
                    toast.success(loadedId ? 'Referencia actualizada' : 'Referencia guardada');
                  }}
                >
                  {loadedId ? 'Actualizar referencia' : 'Guardar como referencia'}
                </Button>
              </div>
              {!loadedId && (
                <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la referencia (opcional)" aria-label="Nombre de la referencia" />
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-400">{r.error}</p>
          )}
        </section>

        <section className="rounded-xl border border-ink-750 bg-ink-850">
          <h2 className="border-b border-ink-750 px-5 py-3 text-sm font-semibold">Precios de referencia guardados</h2>
          {refs && refs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Guarda trabajos típicos (ej. "barandal 10 ft = $X") para estimar más rápido.</p>
          ) : (
            <ul className="divide-y divide-ink-750">
              {(refs ?? []).map((x) => (
                <li key={x.id} className={cn('flex items-center gap-2 px-3 py-2', loadedId === x.id && 'bg-ink-800')}>
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-ink-800"
                    onClick={() => {
                      setLoadedId(x.id);
                      setName(x.name);
                      setJobType(x.jobType);
                      setMethod(x.method);
                      setUnit(x.unit);
                      setRefPrice(x.price);
                      setRefLength(x.refLength);
                      setRefHeight(x.refHeight);
                      setFixedPct(x.fixedPct);
                    }}
                  >
                    <div className="truncate text-sm">{x.name}</div>
                    <div className="num text-xs text-ink-500">
                      {money(x.price)} ·{' '}
                      {x.method === 'unit'
                        ? 'por pieza'
                        : x.method === 'area'
                          ? `${decimal(x.refLength)} × ${decimal(x.refHeight)} ${unitAbbr(x.unit)}`
                          : `${decimal(x.refLength)} ${unitAbbr(x.unit)}`}
                    </div>
                  </button>
                  <IconButton
                    icon={Trash2}
                    tone="danger"
                    label="Eliminar referencia"
                    onClick={async () => {
                      if (await confirm({ title: `¿Eliminar "${x.name}"?`, confirmLabel: 'Eliminar', danger: true })) {
                        await referencesRepo.remove(x.id);
                        if (loadedId === x.id) setLoadedId(null);
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function QuoteScaler({ presetId }: { presetId?: string }) {
  const quotes = useQuotes();
  const navigate = useNavigate();
  const [id, setId] = useState(presetId ?? '');
  const q = quotes?.find((x) => x.id === id);
  const [method, setMethod] = useState<'linear' | 'area'>('linear');
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  useEffect(() => {
    if (!q) return;
    const jt = JOB_TYPES.find((j) => j.id === q.jobType);
    const m = jt?.scale === 'area' ? 'area' : 'linear';
    setMethod(m);
    setW(m === 'linear' ? q.dimensions.length || q.dimensions.width : q.dimensions.width);
    setH(q.dimensions.height);
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  type ScaleOk = { error: null; factor: number; scaled: Quote; before: ReturnType<typeof calculate>; after: ReturnType<typeof calculate> };
  const result = useMemo((): { error: string } | ScaleOk | null => {
    if (!q) return null;
    const oldMain = method === 'linear' ? q.dimensions.length || q.dimensions.width : q.dimensions.width;
    const oldArea = q.dimensions.width * q.dimensions.height;
    let factor = NaN;
    let error: string | null = null;
    if (method === 'linear') {
      if (!(oldMain > 0)) error = 'La cotización original no tiene largo ni ancho capturado.';
      else if (!(w > 0)) error = 'Captura el nuevo largo.';
      else factor = w / oldMain;
    } else {
      if (!(oldArea > 0)) error = 'La cotización original no tiene ancho y alto capturados.';
      else if (!(w > 0 && h > 0)) error = 'Captura el nuevo ancho y alto.';
      else factor = (w * h) / oldArea;
    }
    if (error) return { error };
    const scaled = scaleQuoteInput(q, factor);
    scaled.dimensions =
      method === 'linear'
        ? { ...q.dimensions, length: q.dimensions.length ? w : q.dimensions.length, width: q.dimensions.length ? q.dimensions.width : w }
        : { ...q.dimensions, width: w, height: h };
    const before = calculate(q);
    const after = calculate(scaled);
    return { error: null, factor, scaled, before, after };
  }, [q, method, w, h]);

  if (!quotes) return <div className="h-40" />;
  if (quotes.length === 0)
    return (
      <div className="rounded-xl border border-ink-750 bg-ink-850">
        <EmptyState
          icon={Scaling}
          title="No hay cotizaciones para escalar"
          description="Cuando tengas una cotización con materiales, podrás recalcularla a otra medida automáticamente."
          action={
            <Link to="/cotizaciones/nueva">
              <Button variant="primary">Nueva cotización</Button>
            </Link>
          }
        />
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-ink-750 bg-ink-850 p-4 sm:p-5">
        <p className="mb-4 text-sm text-ink-400">
          Multiplica las cantidades de material, consumibles y horas de mano de obra según el cambio de tamaño. Transporte, instalación y otros gastos se
          mantienen. Después revisa las cantidades (tramos y hojas completas).
        </p>
        <div className="grid gap-4">
          <Field label="Cotización base">
            <Select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Selecciona…</option>
              {quotes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.number} · {x.title} · {money(x.totals.total)}
                </option>
              ))}
            </Select>
          </Field>
          {q && (
            <>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ink-750 bg-ink-750 text-sm">
                {[
                  ['Ancho', q.dimensions.width],
                  ['Alto', q.dimensions.height],
                  ['Largo', q.dimensions.length],
                ].map(([k, v]) => (
                  <div key={k as string} className="bg-ink-900 px-3 py-2">
                    <div className="text-[11px] text-ink-500">{k} actual</div>
                    <div className="num">{v ? `${decimal(v as number)} m` : '—'}</div>
                  </div>
                ))}
              </div>
              <Field label="Escalar por">
                <Segmented
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: 'linear', label: 'Longitud' },
                    { value: 'area', label: 'Área (ancho × alto)' },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={method === 'linear' ? 'Nuevo largo' : 'Nuevo ancho'}>
                  <NumberInput value={w} onChange={setW} suffix="m" aria-label="Nueva medida" />
                </Field>
                {method === 'area' && (
                  <Field label="Nuevo alto">
                    <NumberInput value={h} onChange={setH} suffix="m" aria-label="Nuevo alto" />
                  </Field>
                )}
              </div>
              <p className="text-xs text-ink-500">¿Tienes la medida en pies? 1 ft = 0.3048 m (12 ft = 3.66 m).</p>
            </>
          )}
        </div>
      </section>
      <aside>
        <section className="rounded-xl border border-ink-750 bg-ink-850 p-5 lg:sticky lg:top-6">
          {!q ? (
            <p className="text-sm text-ink-400">Selecciona una cotización para escalarla.</p>
          ) : result && result.error !== null ? (
            <p className="text-sm text-ink-400">{result.error}</p>
          ) : (
            result && result.error === null && (
              <>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">Nuevo precio estimado</div>
                <div className="num mt-1 text-[36px] font-semibold leading-none tracking-tight">{money(result.after.total)}</div>
                <div className="num mt-2 text-sm text-ink-400">
                  Antes {money(result.before.total)} · factor × {decimal(result.factor)}
                </div>
                <dl className="mt-5 flex flex-col gap-2 border-t border-ink-750 pt-4 text-sm">
                  {[
                    ['Materiales', result.before.materials, result.after.materials],
                    ['Mano de obra', result.before.labor, result.after.labor],
                    ['Adicionales', result.before.additional, result.after.additional],
                    ['Costo total', result.before.cost, result.after.cost],
                  ].map(([k, a, b]) => (
                    <div key={k as string} className="flex justify-between gap-2">
                      <dt className="text-ink-400">{k}</dt>
                      <dd className="num text-right">
                        <span className="text-ink-500">{money(a as number)}</span> <ArrowRight className="inline size-3 text-ink-600" />{' '}
                        {money(b as number)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Button
                  variant="primary"
                  icon={FileText}
                  className="mt-5 w-full"
                  onClick={() => {
                    const t = new Date().toISOString();
                    const prefill: Quote = {
                      ...result.scaled,
                      id: uid(),
                      number: '',
                      status: 'draft',
                      title: `${q.title} (${decimal(w)}${method === 'area' ? ` × ${decimal(h)}` : ''} m)`,
                      statusHistory: [{ status: 'draft', date: t }],
                      isDemo: false,
                      createdAt: t,
                      updatedAt: t,
                    };
                    navigate('/cotizaciones/nueva', { state: { prefill } });
                  }}
                >
                  Crear cotización escalada
                </Button>
              </>
            )
          )}
        </section>
      </aside>
    </div>
  );
}
