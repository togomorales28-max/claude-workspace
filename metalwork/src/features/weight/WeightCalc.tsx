import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, RotateCcw, Scissors } from 'lucide-react';
import { Button, Field, Notice, NumberInput, PageHeader, Panel, Segmented, Select } from '../../components/ui';
import { ProfileDimsForm, type SecUnit, type ThickUnit } from '../../components/ProfileForm';
import { ProfileSketch } from '../../components/ProfileSketch';
import { MaterialModal, blankMaterial } from '../catalog/Catalog';
import { useMaterials, useSettings } from '../../data/hooks';
import { kgPerMeter, plateKgPerM2, plateWeight, PROFILES, PROFILE_MAP, sectionArea, describeProfile, FOOT_MM, type ProfileDims, type ProfileType } from '../../domain/profiles';
import { optimizeCuts } from '../../domain/cutting';
import { cents } from '../../domain/budget';
import { materialInfo, densityOf } from '../../lib/materialCalc';
import { fixed, money, num } from '../../lib/format';
import type { Material } from '../../data/types';

type LenUnit = 'mm' | 'm' | 'ft';
type PriceMode = 'kg' | 'm' | 'barra' | 'm2' | 'none';
const LEN_F: Record<LenUnit, number> = { mm: 1, m: 1000, ft: FOOT_MM };

interface State {
  profile: ProfileType;
  dims: ProfileDims;
  densityId: string;
  lengthMm: number | null;
  plateLengthMm: number | null;
  qty: number | null;
  stockLength: number | null;
  priceMode: PriceMode;
  price: number | null;
  materialId: string;
}

const KEY = 'mwc.weightcalc.v1';
const loadState = (): Partial<State> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};

export function WeightCalc() {
  const settings = useSettings();
  const materials = useMaterials();
  const [s, setS] = useState<State>(() => ({
    profile: 'ptr_cuadrado', dims: {}, densityId: 'acero', lengthMm: 1000, plateLengthMm: 2440, qty: 1, stockLength: 6100,
    priceMode: 'none', price: null, materialId: '', ...loadState(),
  }));
  const [secUnit, setSecUnit] = useState<SecUnit>('mm');
  const [thickUnit, setThickUnit] = useState<ThickUnit>('mm');
  const [lenUnit, setLenUnit] = useState<LenUnit>('mm');
  const [saveModal, setSaveModal] = useState<Material | null>(null);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } }, [s]);

  const plate = PROFILE_MAP[s.profile].kind === 'superficie';
  const dens = settings ? densityOf(settings, s.densityId) : null;

  const calc = useMemo(() => {
    if (!dens || !settings) return null;
    try {
      const n = s.qty ?? 0;
      if (plate) {
        const W = s.dims.a ?? 0, L = s.plateLengthMm ?? 0, t = s.dims.t ?? 0;
        const kgPiece = plateWeight(W, L, t, dens.value);
        const area = (W * L) / 1e6;
        const kgm2 = plateKgPerM2(t, dens.value);
        const pricePiece = s.price == null ? null : s.priceMode === 'kg' ? s.price * kgPiece : s.priceMode === 'm2' ? s.price * area : null;
        return { plate: true as const, kgPiece, area, kgm2, total: kgPiece * n, areaTotal: area * n, pricePiece, priceTotal: pricePiece == null ? null : cents(pricePiece * n), n };
      }
      const kgm = kgPerMeter(s.profile, s.dims, dens.value);
      const area = s.profile === 'personalizado' ? null : sectionArea(s.profile, s.dims);
      const L = s.lengthMm ?? 0;
      const kgPiece = kgm * (L / 1000);
      const totalLen = L * n;
      let bars: number | null = null, barsNote = '';
      const SL = s.stockLength ?? 0;
      if (SL > 0 && L > 0 && n > 0) {
        try {
          const r = optimizeCuts([{ id: 'p', label: 'Pieza', length: L, qty: n }], [{ id: 's', label: 'Barra', length: SL, qty: null }],
            { kerf: settings.cut.kerf, trimStart: settings.cut.trimStart, minReusable: 0 });
          bars = r.unplaced.length ? null : r.totals.bars;
          barsNote = r.unplaced.length ? 'La pieza es más larga que la barra.' : `Con corte de ${num(settings.cut.kerf)} mm: ${Math.floor((SL - (settings.cut.trimStart > 0 ? settings.cut.trimStart + settings.cut.kerf : 0) + settings.cut.kerf) / (L + settings.cut.kerf))} piezas por barra`;
        } catch { bars = null; }
      }
      const pricePiece = s.price == null ? null
        : s.priceMode === 'kg' ? s.price * kgPiece
        : s.priceMode === 'm' ? s.price * (L / 1000)
        : s.priceMode === 'barra' && SL > 0 ? s.price * (L / SL) : null;
      const priceBars = s.priceMode === 'barra' && s.price != null && bars != null ? cents(s.price * bars)
        : s.priceMode === 'kg' && s.price != null && bars != null ? cents(s.price * kgm * (SL / 1000) * bars)
        : s.priceMode === 'm' && s.price != null && bars != null ? cents(s.price * (SL / 1000) * bars) : null;
      return { plate: false as const, kgm, area, kgPiece, total: kgPiece * n, totalLen, bars, barsNote, pricePiece, priceTotal: pricePiece == null ? null : cents(pricePiece * n), priceBars, n, kgBar: kgm * SL / 1000 };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [s, dens, plate, settings]);

  if (!settings) return null;

  const loadMaterial = (id: string) => {
    if (!id) { setS({ ...s, materialId: '' }); return; }
    const m = materials?.find((x) => x.id === id);
    if (!m) return;
    const i = materialInfo(m, settings);
    const isPlate = PROFILE_MAP[m.profile].kind === 'superficie';
    setS({
      ...s, materialId: id, profile: m.profile, dims: { ...m.dims }, densityId: m.densityId,
      stockLength: isPlate ? s.stockLength : m.stockLength, plateLengthMm: isPlate ? m.stockLength : s.plateLengthMm,
      priceMode: i.kgPrice != null ? 'kg' : 'none', price: i.kgPrice,
    });
  };

  const lenField = (label: string, v: number | null, set: (n: number | null) => void) => (
    <Field label={label} unit={lenUnit === 'ft' ? 'pies' : lenUnit}>
      {(id) => <NumberInput id={id} value={v == null ? null : Math.round((v / LEN_F[lenUnit]) * 10000) / 10000} min={0}
        onChange={(n) => set(n == null ? null : Math.round(n * LEN_F[lenUnit] * 100) / 100)} />}
    </Field>
  );

  const priceModes: { value: PriceMode; label: string }[] = plate
    ? [{ value: 'none', label: 'Sin precio' }, { value: 'kg', label: '$/kg' }, { value: 'm2', label: '$/m²' }]
    : [{ value: 'none', label: 'Sin precio' }, { value: 'kg', label: '$/kg' }, { value: 'm', label: '$/m' }, { value: 'barra', label: '$/barra' }];

  return (
    <div className="rise">
      <PageHeader eyebrow="Módulo 02" title="Peso y material"
        subtitle="Peso por metro, por pieza y total de cualquier perfil, con la cantidad de material y su costo."
        actions={<Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setS({ ...s, dims: {}, materialId: '', price: null, priceMode: 'none' })}>Limpiar</Button>} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Perfil" eyebrow="Entrada">
            <div className="mb-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {PROFILES.map((p) => (
                <button key={p.type} type="button" onClick={() => setS({ ...s, profile: p.type, materialId: '', priceMode: p.kind === 'superficie' && s.priceMode === 'barra' ? 'none' : s.priceMode })}
                  className={`rounded-md border px-2 py-2 text-left text-xs leading-tight transition-colors ${s.profile === p.type ? 'border-volt bg-volt/10 text-ink' : 'border-line bg-base/50 text-ink-2 hover:border-line-2'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Material (densidad)">{(id) => <Select id={id} value={s.densityId} onChange={(v) => setS({ ...s, densityId: v })} options={settings.densities.map((d) => ({ value: d.id, label: `${d.name} · ${num(d.value, 0)} kg/m³` }))} />}</Field>
              <Field label="Cargar del catálogo">{(id) => <Select id={id} value={s.materialId} onChange={loadMaterial} options={[{ value: '', label: materials?.length ? 'Elegir…' : 'Catálogo vacío' }, ...(materials ?? []).map((m) => ({ value: m.id, label: m.name }))]} />}</Field>
            </div>
            <div className="mt-4">
              <ProfileDimsForm type={s.profile} dims={s.dims} onChange={(dims) => setS({ ...s, dims, materialId: '' })} secUnit={secUnit} thickUnit={thickUnit} setSecUnit={setSecUnit} setThickUnit={setThickUnit} />
            </div>
          </Panel>

          <Panel title="Cantidad y precio" eyebrow="Entrada"
            actions={<Segmented value={lenUnit} onChange={setLenUnit} options={[{ value: 'mm', label: 'mm' }, { value: 'm', label: 'm' }, { value: 'ft', label: 'pies' }]} />}>
            <div className="grid grid-cols-2 gap-3">
              {plate ? lenField('Largo de la placa', s.plateLengthMm, (n) => setS({ ...s, plateLengthMm: n })) : lenField('Largo de cada pieza', s.lengthMm, (n) => setS({ ...s, lengthMm: n }))}
              <Field label="Piezas" unit="pz">{(id) => <NumberInput id={id} value={s.qty} integer min={1} onChange={(v) => setS({ ...s, qty: v })} />}</Field>
              {!plate && lenField('Longitud de barra comercial', s.stockLength, (n) => setS({ ...s, stockLength: n }))}
              <div className={plate ? 'col-span-2' : ''}>
                <div className="mb-1.5 text-[13px] font-medium text-ink-2">Precio</div>
                <Select value={s.priceMode} onChange={(v) => setS({ ...s, priceMode: v })} options={priceModes} ariaLabel="Tipo de precio" />
              </div>
              {s.priceMode !== 'none' && (
                <Field label={`Precio ${priceModes.find((p) => p.value === s.priceMode)?.label}`} unit="MXN" className="col-span-2">
                  {(id) => <NumberInput id={id} value={s.price} min={0} onChange={(v) => setS({ ...s, price: v })} placeholder="Precio de tu proveedor" />}
                </Field>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title={describeProfile(s.profile, s.dims)} eyebrow="Sección transversal · mm" pad={false}>
            <div className="grid-bg flex justify-center bg-base/40"><ProfileSketch type={s.profile} dims={s.dims} className="w-full max-w-[320px]" /></div>
          </Panel>

          <Panel title="Resultados" eyebrow={`${dens?.name} · ${num(dens?.value, 0)} kg/m³`}>
            {!calc ? null : 'error' in calc ? <Notice tone="info">{calc.error}</Notice> : calc.plate ? (
              <dl className="divide-y divide-line">
                <ResRow k="Peso por m²" v={fixed(calc.kgm2, 3)} u="kg/m²" />
                <ResRow k="Área por placa" v={fixed(calc.area, 4)} u="m²" />
                <ResRow k="Peso por placa" v={fixed(calc.kgPiece, 3)} u="kg" strong />
                <ResRow k={`Peso total (${calc.n} pz)`} v={fixed(calc.total, 3)} u="kg" strong />
                <ResRow k="Área total" v={fixed(calc.areaTotal, 4)} u="m²" />
                <ResRow k="Costo por placa" v={money(calc.pricePiece)} u="MXN" />
                <ResRow k="Costo total" v={money(calc.priceTotal)} u="MXN" strong />
              </dl>
            ) : (
              <>
                <dl className="divide-y divide-line">
                  {calc.area != null && <ResRow k="Área de sección" v={fixed(calc.area, 2)} u="mm²" />}
                  <ResRow k="Peso por metro" v={fixed(calc.kgm, 3)} u="kg/m" strong />
                  <ResRow k="Peso por barra comercial" v={fixed(calc.kgBar, 2)} u="kg" />
                  <ResRow k="Peso por pieza" v={fixed(calc.kgPiece, 3)} u="kg" />
                  <ResRow k={`Peso total (${calc.n} pz)`} v={fixed(calc.total, 3)} u="kg" strong />
                  <ResRow k="Material lineal total" v={fixed(calc.totalLen / 1000, 3)} u="m" />
                  <ResRow k="Barras comerciales" v={calc.bars == null ? '—' : String(calc.bars)} u="barras" hint={calc.barsNote} />
                  <ResRow k="Costo por pieza" v={money(calc.pricePiece)} u="MXN" hint={s.priceMode === 'barra' ? 'Prorrateado por longitud' : undefined} />
                  <ResRow k="Costo del material en piezas" v={money(calc.priceTotal)} u="MXN" />
                  <ResRow k="Costo comprando barras completas" v={money(calc.priceBars)} u="MXN" strong />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/cortes"><Button size="sm" icon={<Scissors className="size-3.5" />}>Optimizar varias medidas</Button></Link>
                </div>
              </>
            )}
            {calc && !('error' in calc) && (
              <div className="mt-4">
                <Button size="sm" icon={<Save className="size-3.5" />} onClick={() => setSaveModal(blankMaterial(settings, {
                  name: describeProfile(s.profile, s.dims), profile: s.profile, dims: { ...s.dims }, densityId: s.densityId,
                  stockLength: (plate ? s.plateLengthMm : s.stockLength) ?? settings.cut.stockLength,
                  pricePerKg: s.priceMode === 'kg' ? s.price : null,
                  pricePerBar: s.priceMode === 'barra' ? s.price : null,
                }))}>Guardar en catálogo</Button>
              </div>
            )}
          </Panel>
          <p className="text-xs leading-relaxed text-mute">
            Fórmula: peso (kg/m) = área de sección (mm²) × 10⁻⁶ × densidad (kg/m³). Placa: ancho × largo × espesor (m) × densidad.
            Perfiles tubulares calculados con esquina viva salvo que indiques el radio; las tablas de fabricante pueden variar ±3 %.
          </p>
        </div>
      </div>
      {saveModal && <MaterialModal initial={saveModal} settings={settings} onClose={() => setSaveModal(null)} />}
    </div>
  );
}

function ResRow({ k, v, u, strong, hint }: { k: string; v: string; u: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-sm text-ink-2">{k}{hint && <div className="text-[11px] text-mute">{hint}</div>}</dt>
      <dd className={`num text-right ${strong ? 'text-lg text-ink' : 'text-ink-2'}`}>{v} <span className="text-xs text-mute">{u}</span></dd>
    </div>
  );
}
