import { useMemo, useState } from 'react';
import { Plus, Package, Pencil, Trash2, Search, Copy, AlertTriangle } from 'lucide-react';
import { Badge, Button, Empty, Field, IconButton, Modal, Notice, NumberInput, PageHeader, Select, TextArea, TextInput, cx, useUi } from '../../components/ui';
import { ProfileDimsForm, ProfileTypeSelect, type SecUnit, type ThickUnit } from '../../components/ProfileForm';
import { ProfileSketch } from '../../components/ProfileSketch';
import { useMaterials, useSettings } from '../../data/hooks';
import { nowIso, repos, todayIso, uid } from '../../data/repo';
import type { Material, Settings } from '../../data/types';
import { describeProfile, PROFILE_MAP, PROFILES, type ProfileType } from '../../domain/profiles';
import { materialInfo } from '../../lib/materialCalc';
import { dateMx, daysSince, fixed, money, num } from '../../lib/format';

export function blankMaterial(settings: Settings, patch: Partial<Material> = {}): Material {
  return {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(), name: '', profile: 'ptr_cuadrado', dims: {},
    densityId: settings.defaultDensityId, stockLength: settings.cut.stockLength,
    pricePerBar: null, pricePerKg: null, supplier: '', priceDate: null, notes: '', ...patch,
  };
}

export function Catalog() {
  const materials = useMaterials();
  const settings = useSettings();
  const { confirm, toast } = useUi();
  const [edit, setEdit] = useState<Material | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | ProfileType>('');

  const list = useMemo(() => (materials ?? [])
    .filter((m) => !type || m.profile === type)
    .filter((m) => !q.trim() || `${m.name} ${m.supplier} ${describeProfile(m.profile, m.dims)}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')), [materials, q, type]);

  if (!settings) return null;

  const remove = async (m: Material) => {
    if (await confirm({ title: 'Eliminar material', text: `Se eliminará «${m.name}» del catálogo. Los presupuestos y planes ya guardados no cambian.`, confirmLabel: 'Eliminar', danger: true })) {
      await repos.materials.remove(m.id);
      toast('Material eliminado');
    }
  };

  return (
    <div className="rise">
      <PageHeader eyebrow="Módulo 04" title="Catálogo y precios"
        subtitle="Tus materiales con los precios de tu proveedor. La aplicación nunca inventa precios: solo convierte entre precio por barra y por kilogramo con el peso calculado."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit(blankMaterial(settings))}>Agregar material</Button>} />

      {materials && materials.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
            <input className="field pl-9" placeholder="Buscar por nombre, medida o proveedor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          </div>
          <Select value={type} onChange={setType} className="w-auto min-w-[190px]" ariaLabel="Filtrar por perfil"
            options={[{ value: '' as const, label: 'Todos los perfiles' }, ...PROFILES.map((p) => ({ value: p.type, label: p.label }))]} />
        </div>
      )}

      {materials === undefined ? null : materials.length === 0 ? (
        <Empty icon={<Package className="size-8" />} title="El catálogo está vacío"
          text="Registra los perfiles que compras con su longitud comercial y el precio de tu proveedor. Después los usarás en el optimizador y en los presupuestos."
          action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit(blankMaterial(settings))}>Agregar primer material</Button>} />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-mute">Ningún material coincide con la búsqueda.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_100px_90px_110px_110px_minmax(0,1fr)_110px] gap-3 border-b border-line px-4 py-2.5 eyebrow">
            <span>Material</span><span className="text-right">kg/m</span><span className="text-right">Largo</span><span className="text-right">$ / barra</span><span className="text-right">$ / kg</span><span>Proveedor · fecha</span><span />
          </div>
          {list.map((m) => {
            const i = materialInfo(m, settings);
            const age = daysSince(m.priceDate);
            const noPrice = i.barPrice == null;
            return (
              <div key={m.id} className="grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,1.6fr)_100px_90px_110px_110px_minmax(0,1fr)_110px] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 hover:bg-panel-2 transition-colors">
                <button type="button" onClick={() => setEdit(m)} className="min-w-0 text-left">
                  <div className="truncate font-medium hover:text-volt-2">{m.name || describeProfile(m.profile, m.dims)}</div>
                  <div className="truncate text-xs text-mute">{PROFILE_MAP[m.profile].label} · {describeProfile(m.profile, m.dims)} · {i.density.name}</div>
                  <div className="num mt-1 flex flex-wrap gap-x-3 text-xs text-ink-2 lg:hidden">
                    <span>{i.kgm != null ? `${fixed(i.kgm, 3)} kg/m` : '—'}</span>
                    <span>{money(i.barPrice)} / {PROFILE_MAP[m.profile].kind === 'superficie' ? 'hoja' : 'barra'}</span>
                    <span>{money(i.kgPrice)} / kg</span>
                  </div>
                </button>
                <span className="num hidden lg:block text-right text-ink-2">{i.kgm != null ? fixed(i.kgm, 3) : <span className="text-bad">error</span>}</span>
                <span className="num hidden lg:block text-right text-ink-2">{fixed(m.stockLength / 1000, 2)} m</span>
                <span className={cx('num hidden lg:block text-right', i.barPriceDerived && 'text-ink-2 italic')} title={i.barPriceDerived ? 'Calculado desde el precio por kg' : undefined}>{money(i.barPrice)}</span>
                <span className={cx('num hidden lg:block text-right', i.kgPriceDerived && 'text-ink-2 italic')} title={i.kgPriceDerived ? 'Calculado desde el precio por barra' : undefined}>{money(i.kgPrice)}</span>
                <span className="hidden lg:block min-w-0 truncate text-xs text-mute">
                  {m.supplier || '—'} · {m.priceDate ? dateMx(m.priceDate) : 'sin fecha'}
                  {age != null && age > 30 && <span className="ml-1.5 text-warn">({age} días)</span>}
                </span>
                <div className="row-span-2 lg:row-span-1 flex items-center justify-end gap-0.5">
                  {noPrice && <span title="Sin precio capturado" className="mr-1 text-warn"><AlertTriangle className="size-4" /></span>}
                  <IconButton label="Editar" onClick={() => setEdit(m)}><Pencil className="size-4" /></IconButton>
                  <IconButton label="Duplicar" onClick={() => setEdit({ ...structuredClone(m), id: uid(), name: `${m.name} (copia)`, createdAt: nowIso() })}><Copy className="size-4" /></IconButton>
                  <IconButton label="Eliminar" onClick={() => remove(m)} className="hover:!text-bad"><Trash2 className="size-4" /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && <MaterialModal initial={edit} settings={settings} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function MaterialModal({ initial, settings, onClose }: { initial: Material; settings: Settings; onClose: () => void }) {
  const [m, setM] = useState<Material>(initial);
  const [secUnit, setSecUnit] = useState<SecUnit>('mm');
  const [thickUnit, setThickUnit] = useState<ThickUnit>('mm');
  const [touched, setTouched] = useState(false);
  const { toast } = useUi();
  const info = materialInfo(m, settings);
  const isPlate = PROFILE_MAP[m.profile].kind === 'superficie';
  const priceChanged = m.pricePerBar !== initial.pricePerBar || m.pricePerKg !== initial.pricePerKg;
  const nameErr = touched && !m.name.trim() ? 'Escribe un nombre.' : null;
  const lenErr = touched && !(m.stockLength > 0) ? 'Indica la longitud.' : null;

  const save = async () => {
    setTouched(true);
    if (!m.name.trim() || !(m.stockLength > 0) || info.error) return;
    const priceDate = priceChanged && (m.pricePerBar != null || m.pricePerKg != null) && m.priceDate === initial.priceDate ? todayIso() : m.priceDate;
    await repos.materials.save({ ...m, name: m.name.trim(), priceDate });
    toast('Material guardado');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={initial.name ? 'Editar material' : 'Nuevo material'} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar</Button></>}>
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <Field label="Nombre" error={nameErr}>{(id) => <TextInput id={id} value={m.name} onChange={(v) => setM({ ...m, name: v })} placeholder='PTR 2" × 2" cal. 14' autoFocus />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de perfil">{(id) => <ProfileTypeSelect id={id} value={m.profile} onChange={(v) => setM({ ...m, profile: v, stockLength: PROFILE_MAP[v].kind === 'superficie' && m.stockLength === settings.cut.stockLength ? 2440 : m.stockLength })} />}</Field>
            <Field label="Material">{(id) => <Select id={id} value={m.densityId} onChange={(v) => setM({ ...m, densityId: v })} options={settings.densities.map((d) => ({ value: d.id, label: `${d.name} (${num(d.value, 0)} kg/m³)` }))} />}</Field>
          </div>
          <ProfileDimsForm type={m.profile} dims={m.dims} onChange={(dims) => setM({ ...m, dims })} secUnit={secUnit} thickUnit={thickUnit} setSecUnit={setSecUnit} setThickUnit={setThickUnit} />
          <Field label={isPlate ? 'Largo de la hoja' : 'Longitud comercial'} unit="mm" error={lenErr} hint={isPlate ? 'Ancho y espesor arriba. Ej.: 1220 × 2440' : 'Ej.: 6100 mm (PTR), 6000 mm'}>
            {(id) => <NumberInput id={id} value={m.stockLength || null} onChange={(v) => setM({ ...m, stockLength: v ?? 0 })} min={1} />}
          </Field>

          <div className="rounded-md border border-line bg-base/50 p-3">
            <div className="mb-2 text-sm font-medium">Precio de tu proveedor</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={isPlate ? 'Precio por hoja' : 'Precio por barra'} unit="MXN" hint={m.pricePerBar == null && info.barPrice != null ? `Equivale a ${money(info.barPrice)}` : undefined}>
                {(id) => <NumberInput id={id} value={m.pricePerBar} onChange={(v) => setM({ ...m, pricePerBar: v })} min={0} placeholder="Sin capturar" />}
              </Field>
              <Field label="Precio por kg" unit="MXN" hint={m.pricePerKg == null && info.kgPrice != null ? `Equivale a ${money(info.kgPrice)}` : undefined}>
                {(id) => <NumberInput id={id} value={m.pricePerKg} onChange={(v) => setM({ ...m, pricePerKg: v })} min={0} placeholder="Sin capturar" />}
              </Field>
              <Field label="Proveedor">{(id) => <TextInput id={id} value={m.supplier} onChange={(v) => setM({ ...m, supplier: v })} />}</Field>
              <Field label="Fecha del precio" hint={priceChanged ? 'Se actualizará a hoy al guardar' : undefined}>
                {(id) => <input id={id} type="date" className="field" value={m.priceDate ?? ''} onChange={(e) => setM({ ...m, priceDate: e.target.value || null })} />}
              </Field>
            </div>
            {m.pricePerBar != null && m.pricePerKg != null && info.kgBar != null && Math.abs(m.pricePerBar - m.pricePerKg * info.kgBar) > Math.max(1, m.pricePerBar * 0.03) && (
              <div className="mt-3"><Notice tone="warn">El precio por barra ({money(m.pricePerBar)}) no coincide con el precio por kg × peso de la barra ({money(m.pricePerKg * info.kgBar)}). Se usará el precio por barra en los cálculos.</Notice></div>
            )}
          </div>
          <Field label="Notas">{(id) => <TextArea id={id} value={m.notes} onChange={(v) => setM({ ...m, notes: v })} />}</Field>
        </div>

        <aside className="space-y-3">
          <div className="rounded-md border border-line bg-base grid-bg"><ProfileSketch type={m.profile} dims={m.dims} className="w-full" /></div>
          {info.error ? <Notice tone="warn">{info.error}</Notice> : (
            <dl className="space-y-1.5 text-sm">
              <Row k="Peso por metro" v={`${fixed(info.kgm, 3)} kg/m`} />
              <Row k={isPlate ? 'Peso por hoja' : 'Peso por barra'} v={`${fixed(info.kgBar, 2)} kg`} />
              <Row k="Precio por metro" v={money(info.pricePerMeter)} />
              <Row k="Densidad" v={`${num(info.density.value, 0)} kg/m³`} />
            </dl>
          )}
          {!info.error && info.barPrice == null && <Badge tone="warn">Sin precio</Badge>}
        </aside>
      </div>
    </Modal>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3 border-b border-line/70 pb-1.5"><dt className="text-mute">{k}</dt><dd className="num">{v}</dd></div>
);
