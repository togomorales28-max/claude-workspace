import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Plus, Trash2, ImagePlus, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button, Field, IconButton, Notice, NumberInput, PageHeader, Panel, Segmented, Select, TextArea, TextInput, Toggle, useUi } from '../../components/ui';
import { repos, uid } from '../../data/repo';
import type { Settings } from '../../data/types';
import { useDraft } from '../../lib/useDraft';
import { exportBackup, parseBackup, restoreBackup } from '../../data/backup';
import { downloadText } from '../../lib/csv';
import { requestPersistence } from '../../data/db';
import { useMaterials } from '../../data/hooks';

export function SettingsPage() {
  const { draft, setDraft, status, flush } = useDraft<Settings>(() => repos.getSettings(), (s) => repos.saveSettings(s), []);
  const { toast, confirm } = useUi();
  const materials = useMaterials();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);

  if (!draft) return null;
  const s = draft;
  const set = (fn: (s: Settings) => Settings) => setDraft(fn);

  const backup = async () => {
    await flush();
    const b = await exportBackup();
    const d = new Date();
    try { await downloadText(`metalwork-respaldo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`, JSON.stringify(b, null, 1), 'application/json'); toast('Respaldo listo'); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const restore = async (file: File) => {
    try {
      const b = parseBackup(await file.text());
      const n = b.data.materials.length + b.data.quotes.length + b.data.cutPlans.length + b.data.clients.length;
      if (!(await confirm({ title: 'Restaurar respaldo', text: `Se reemplazarán TODOS los datos actuales por los del respaldo (${n} registros, del ${new Date(b.exportedAt).toLocaleDateString('es-MX')}). Descarga un respaldo antes si no estás seguro.`, confirmLabel: 'Reemplazar datos', danger: true }))) return;
      await restoreBackup(b);
      toast('Respaldo restaurado');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  };
  const loadLogo = async (file: File) => {
    try {
      const url = await resizeImage(file, 480);
      set((x) => ({ ...x, shop: { ...x.shop, logo: url } }));
    } catch { toast('No se pudo leer la imagen', 'bad'); }
  };
  const usedDensity = (id: string) => materials?.some((m) => m.densityId === id);

  return (
    <div className="rise">
      <PageHeader eyebrow="Sistema" title="Configuración" subtitle="Datos del taller, valores predeterminados y respaldo de información."
        actions={<span className="text-xs text-mute">{status === 'pending' ? 'Guardando…' : status === 'saved' ? 'Cambios guardados' : ''}</span>} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Datos del taller" eyebrow="Aparecen en las cotizaciones">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del taller" className="sm:col-span-2">{(id) => <TextInput id={id} value={s.shop.name} onChange={(v) => set((x) => ({ ...x, shop: { ...x.shop, name: v } }))} placeholder="Herrería …" />}</Field>
            <Field label="Responsable">{(id) => <TextInput id={id} value={s.shop.owner} onChange={(v) => set((x) => ({ ...x, shop: { ...x.shop, owner: v } }))} />}</Field>
            <Field label="RFC">{(id) => <TextInput id={id} value={s.shop.rfc} onChange={(v) => set((x) => ({ ...x, shop: { ...x.shop, rfc: v.toUpperCase() } }))} maxLength={13} />}</Field>
            <Field label="Teléfono / WhatsApp">{(id) => <TextInput id={id} type="tel" value={s.shop.phone} onChange={(v) => set((x) => ({ ...x, shop: { ...x.shop, phone: v } }))} />}</Field>
            <Field label="Correo">{(id) => <TextInput id={id} type="email" value={s.shop.email} onChange={(v) => set((x) => ({ ...x, shop: { ...x.shop, email: v } }))} />}</Field>
            <Field label="Dirección" className="sm:col-span-2">{(id) => <TextInput id={id} value={s.shop.address} onChange={(v) => set((x) => ({ ...x, shop: { ...x.shop, address: v } }))} />}</Field>
            <div className="sm:col-span-2 flex items-center gap-3">
              <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border border-line bg-white/95">
                {s.shop.logo ? <img src={s.shop.logo} alt="Logotipo" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-mute" />}
              </div>
              <Button size="sm" onClick={() => logoRef.current?.click()}>{s.shop.logo ? 'Cambiar logotipo' : 'Subir logotipo'}</Button>
              {s.shop.logo && <Button size="sm" variant="ghost" onClick={() => set((x) => ({ ...x, shop: { ...x.shop, logo: null } }))}>Quitar</Button>}
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadLogo(f); e.target.value = ''; }} />
            </div>
          </div>
        </Panel>

        <Panel title="Presupuestos" eyebrow="Valores predeterminados">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Costo de mano de obra" unit="$/hora">{(id) => <NumberInput id={id} value={s.budget.laborRate} min={0} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, laborRate: v ?? 0 } }))} />}</Field>
            <Field label="Desperdicio" unit="%">{(id) => <NumberInput id={id} value={s.budget.wastePct} min={0} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, wastePct: v ?? 0 } }))} />}</Field>
            <Field label="Utilidad" unit="%">{(id) => <NumberInput id={id} value={s.budget.profitPct} min={0} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, profitPct: v ?? 0 } }))} />}</Field>
            <Field label="Cálculo de utilidad">{() => <Segmented value={s.budget.profitMode} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, profitMode: v } }))} className="w-full" options={[{ value: 'recargo', label: 'Sobre costo' }, { value: 'margen', label: 'Margen' }]} />}</Field>
            <Field label="IVA" unit="%">{(id) => <NumberInput id={id} value={s.budget.ivaPct} min={0} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, ivaPct: v ?? 0 } }))} />}</Field>
            <Field label="Vigencia" unit="días">{(id) => <NumberInput id={id} value={s.budget.validDays} integer min={0} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, validDays: Math.floor(v ?? 0) } }))} />}</Field>
            <Field label="Redondeo">{(id) => <Select id={id} value={String(s.budget.roundTo)} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, roundTo: Number(v) } }))} options={[{ value: '0', label: 'Sin redondeo' }, { value: '1', label: 'Al peso' }, { value: '10', label: 'A $10' }, { value: '50', label: 'A $50' }, { value: '100', label: 'A $100' }]} />}</Field>
            <div className="flex items-end pb-2"><Toggle checked={s.budget.ivaEnabled} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, ivaEnabled: v } }))} label="Agregar IVA por defecto" /></div>
            <Field label="Prefijo de folio">{(id) => <TextInput id={id} value={s.quotePrefix} onChange={(v) => set((x) => ({ ...x, quotePrefix: v }))} maxLength={10} />}</Field>
            <Field label="Siguiente número" hint={`Próximo folio: ${s.quotePrefix}${String(s.nextQuoteNumber).padStart(4, '0')}`}>{(id) => <NumberInput id={id} value={s.nextQuoteNumber} integer min={1} onChange={(v) => set((x) => ({ ...x, nextQuoteNumber: Math.max(1, Math.floor(v ?? 1)) }))} />}</Field>
            <Field label="Condiciones predeterminadas" className="sm:col-span-2">{(id) => <TextArea id={id} value={s.budget.terms} onChange={(v) => set((x) => ({ ...x, budget: { ...x.budget, terms: v } }))} />}</Field>
          </div>
        </Panel>

        <Panel title="Optimizador de cortes" eyebrow="Valores predeterminados">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Longitud comercial" unit="mm">{(id) => <NumberInput id={id} value={s.cut.stockLength} min={1} onChange={(v) => set((x) => ({ ...x, cut: { ...x.cut, stockLength: v ?? 6100 } }))} />}</Field>
            <Field label="Ancho de corte (kerf)" unit="mm" hint="Disco de 14&quot;: 2.5–3.2 mm">{(id) => <NumberInput id={id} value={s.cut.kerf} min={0} onChange={(v) => set((x) => ({ ...x, cut: { ...x.cut, kerf: v ?? 0 } }))} />}</Field>
            <Field label="Despunte inicial" unit="mm">{(id) => <NumberInput id={id} value={s.cut.trimStart} min={0} onChange={(v) => set((x) => ({ ...x, cut: { ...x.cut, trimStart: v ?? 0 } }))} />}</Field>
            <Field label="Sobrante reutilizable desde" unit="mm">{(id) => <NumberInput id={id} value={s.cut.minReusable} min={0} onChange={(v) => set((x) => ({ ...x, cut: { ...x.cut, minReusable: v ?? 0 } }))} />}</Field>
          </div>
        </Panel>

        <Panel title="Densidades de materiales" eyebrow="kg/m³"
          actions={<Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set((x) => ({ ...x, densities: [...x.densities, { id: uid(), name: 'Nuevo material', value: 7850 }] }))}>Agregar</Button>}>
          <div className="space-y-2">
            {s.densities.map((d) => (
              <div key={d.id} className="grid grid-cols-[1fr_110px_auto_36px] items-center gap-2">
                <TextInput value={d.name} onChange={(v) => set((x) => ({ ...x, densities: x.densities.map((y) => (y.id === d.id ? { ...y, name: v } : y)) }))} aria-label="Material" />
                <NumberInput ariaLabel="Densidad kg/m³" value={d.value} min={1} onChange={(v) => set((x) => ({ ...x, densities: x.densities.map((y) => (y.id === d.id ? { ...y, value: v ?? 0 } : y)) }))} invalid={!d.value} />
                <label className="flex items-center gap-1.5 text-xs text-mute"><input type="radio" name="defdens" checked={s.defaultDensityId === d.id} onChange={() => set((x) => ({ ...x, defaultDensityId: d.id }))} className="accent-[#2f8cff]" />Predet.</label>
                <IconButton label="Quitar" disabled={s.densities.length === 1 || s.defaultDensityId === d.id || usedDensity(d.id)}
                  title={usedDensity(d.id) ? 'Hay materiales del catálogo que la usan' : 'Quitar'}
                  onClick={() => set((x) => ({ ...x, densities: x.densities.filter((y) => y.id !== d.id) }))}><Trash2 className="size-4" /></IconButton>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Datos y respaldo" eyebrow="Almacenamiento local" className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2 text-sm text-ink-2">
              <p>Toda la información se guarda en este dispositivo (IndexedDB) y se conserva al cerrar la aplicación. Descarga un respaldo con frecuencia y guárdalo en otro lugar (correo, Drive, USB). Con él puedes pasar tus datos a otro celular o computadora.</p>
              {persisted === true
                ? <div className="flex items-center gap-2 text-ok"><ShieldCheck className="size-4" />El navegador protege estos datos contra borrado automático.</div>
                : <div className="flex flex-wrap items-center gap-2 text-warn"><ShieldAlert className="size-4" />El navegador podría borrar los datos si se queda sin espacio.
                    <Button size="sm" onClick={async () => { const ok = await requestPersistence(); setPersisted(ok); toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo permitió; instala la app para mayor protección', ok ? 'ok' : 'info'); }}>Proteger datos</Button></div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Download className="size-4" />} onClick={backup}>Descargar respaldo</Button>
              <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Restaurar</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
            </div>
          </div>
          <div className="mt-4"><Notice>Los precios de materiales siempre los capturas tú en el catálogo; la aplicación no incluye precios de referencia.</Notice></div>
        </Panel>
      </div>
    </div>
  );
}

function resizeImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')); };
    img.src = url;
  });
}
