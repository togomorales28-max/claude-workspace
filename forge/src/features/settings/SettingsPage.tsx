import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { Download, FlaskConical, ImagePlus, Save, Trash2, Upload, AlertTriangle } from 'lucide-react';
import { useSettings, downloadBlob } from '@/lib/hooks';
import { settingsRepo } from '@/data/repo';
import { exportBackup, importBackup, wipeAll } from '@/data/backup';
import { clearDemo, loadDemo } from '@/data/demo';
import { db } from '@/data/db';
import { fileToLogo } from '@/lib/image';
import { Button, Field, Input, NumberInput, PageHeader, Segmented, Select, Textarea, Toggle } from '@/components/ui';
import { useConfirm } from '@/components/ui/confirm';
import { ROUND_OPTIONS } from '@/domain/constants';
import type { Settings } from '@/domain/types';

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-ink-750 py-8 first:pt-0 last:border-0 lg:grid-cols-[260px_1fr] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  if (!settings) return <div className="h-64" />;
  return <SettingsForm initial={settings} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const confirm = useConfirm();
  const [s, setS] = useState<Settings>(initial);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const demoCount = useLiveQuery(() => db.quotes.filter((q) => !!q.isDemo).count(), []);

  // Si otra parte de la app cambia la configuración (p. ej. el folio), sincronizar cuando no haya edición pendiente.
  useEffect(() => {
    if (!dirty) setS(initial);
  }, [initial, dirty]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const errors: Record<string, string> = {};
  if (s.defaultProfitMode === 'margin' && s.defaultProfitPct >= 100) errors.profit = 'El margen debe ser menor a 100 %.';
  if (!/^[A-Za-z0-9-]{0,8}$/.test(s.quotePrefix)) errors.prefix = 'Solo letras, números o guion (máx. 8).';
  if (!Number.isInteger(s.nextQuoteNumber) || s.nextQuoteNumber < 1) errors.next = 'Debe ser un entero mayor a 0.';
  if (!Number.isInteger(s.defaultValidityDays) || s.defaultValidityDays < 1) errors.validity = 'Mínimo 1 día.';

  const save = async () => {
    if (Object.keys(errors).length) {
      toast.error('Revisa los campos marcados');
      return;
    }
    await settingsRepo.save({ ...s, shopName: s.shopName.trim(), onboarded: true });
    setDirty(false);
    toast.success('Configuración guardada');
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Configuración"
        subtitle="Datos del taller y valores predeterminados para nuevas cotizaciones."
        actions={
          <Button variant="primary" icon={Save} onClick={save} disabled={!dirty}>
            Guardar cambios
          </Button>
        }
      />

      <div className="rounded-xl border border-ink-750 bg-ink-850 px-4 py-8 sm:px-8">
        <Group title="Taller" description="Aparece en el encabezado de tus cotizaciones.">
          <div className="flex items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-ink-600 bg-white/95">
              {s.logo ? <img src={s.logo} alt="Logotipo" className="max-h-full max-w-full object-contain p-1" /> : <ImagePlus className="size-6 text-ink-500" />}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                  {s.logo ? 'Cambiar logotipo' : 'Subir logotipo'}
                </Button>
                {s.logo && (
                  <Button size="sm" variant="ghost" onClick={() => set('logo', null)}>
                    Quitar
                  </Button>
                )}
              </div>
              <p className="text-xs text-ink-500">PNG, JPG o SVG. Se ajusta automáticamente.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  set('logo', await fileToLogo(f));
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del taller">
              <Input value={s.shopName} onChange={(e) => set('shopName', e.target.value)} placeholder="Ej. Herrería Morales" maxLength={80} />
            </Field>
            <Field label="Responsable">
              <Input value={s.ownerName} onChange={(e) => set('ownerName', e.target.value)} maxLength={80} />
            </Field>
            <Field label="Teléfono">
              <Input type="tel" value={s.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Correo">
              <Input type="email" value={s.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Dirección (opcional)" className="sm:col-span-2">
              <Input value={s.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="RFC (opcional)">
              <Input value={s.rfc} onChange={(e) => set('rfc', e.target.value.toUpperCase())} maxLength={13} />
            </Field>
            <Field label="Moneda">
              <Input value="MXN — Peso mexicano" disabled />
            </Field>
          </div>
        </Group>

        <Group title="Costos y ganancia" description="Valores con los que inicia cada nueva cotización. Puedes cambiarlos en cada trabajo.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mano de obra por hora" hint="Lo que te cuesta una hora de trabajo (sueldo + prestaciones).">
              <NumberInput value={s.laborRate} onChange={(v) => set('laborRate', v)} prefix="$" suffix="/h" aria-label="Mano de obra por hora" />
            </Field>
            <Field label="Redondeo del precio">
              <Select value={s.defaultRoundTo} onChange={(e) => set('defaultRoundTo', Number(e.target.value))}>
                {ROUND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de ganancia" className="sm:col-span-2">
              <Segmented
                value={s.defaultProfitMode}
                onChange={(v) => set('defaultProfitMode', v)}
                options={[
                  { value: 'margin', label: 'Margen sobre venta' },
                  { value: 'markup', label: 'Recargo sobre costo' },
                ]}
              />
            </Field>
            <Field label="Ganancia predeterminada" error={errors.profit}>
              <NumberInput value={s.defaultProfitPct} onChange={(v) => set('defaultProfitPct', v)} suffix="%" invalid={!!errors.profit} aria-label="Ganancia predeterminada" />
            </Field>
            <Field label="Desperdicio de material">
              <NumberInput value={s.defaultWastePct} onChange={(v) => set('defaultWastePct', v)} suffix="%" aria-label="Desperdicio" />
            </Field>
            <Field label="Imprevistos">
              <NumberInput value={s.defaultContingencyPct} onChange={(v) => set('defaultContingencyPct', v)} suffix="%" aria-label="Imprevistos" />
            </Field>
            <Field label="Tasa de IVA">
              <NumberInput value={s.taxPct} onChange={(v) => set('taxPct', v)} suffix="%" aria-label="IVA" />
            </Field>
          </div>
          <div className="rounded-lg border border-ink-750 bg-ink-900 px-4 py-3">
            <Toggle checked={s.taxEnabledByDefault} onChange={(v) => set('taxEnabledByDefault', v)} label="Agregar IVA por defecto" description="Para talleres que facturan todos sus trabajos." />
          </div>
        </Group>

        <Group title="Cotizaciones" description="Folios y textos predeterminados del documento.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefijo del folio" error={errors.prefix}>
              <Input value={s.quotePrefix} onChange={(e) => set('quotePrefix', e.target.value.toUpperCase())} invalid={!!errors.prefix} />
            </Field>
            <Field label="Siguiente número" error={errors.next}>
              <NumberInput value={s.nextQuoteNumber} onChange={(v) => set('nextQuoteNumber', v)} integer invalid={!!errors.next} min={1} aria-label="Siguiente número" />
            </Field>
            <Field label="Vigencia" error={errors.validity}>
              <NumberInput value={s.defaultValidityDays} onChange={(v) => set('defaultValidityDays', v)} integer suffix="días" invalid={!!errors.validity} aria-label="Vigencia" />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink-500">
            Próximo folio: <span className="font-mono text-ink-300">{`${s.quotePrefix || 'COT'}-${new Date().getFullYear().toString().slice(-2)}-${String(s.nextQuoteNumber).padStart(4, '0')}`}</span>
          </p>
          <Field label="Tiempo de entrega predeterminado">
            <Input value={s.defaultDeliveryTime} onChange={(e) => set('defaultDeliveryTime', e.target.value)} />
          </Field>
          <Field label="Condiciones de pago">
            <Textarea value={s.defaultPaymentTerms} onChange={(e) => set('defaultPaymentTerms', e.target.value)} rows={2} />
          </Field>
          <Field label="Pie de página del documento">
            <Textarea value={s.quoteFooter} onChange={(e) => set('quoteFooter', e.target.value)} rows={2} />
          </Field>
        </Group>

        <Group title="Datos y respaldo" description="Tu información se guarda solo en este dispositivo. Descarga un respaldo con regularidad.">
          <div className="flex flex-wrap gap-2">
            <Button
              icon={Download}
              onClick={async () => {
                downloadBlob(await exportBackup(), `forge-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
                toast.success('Respaldo descargado');
              }}
            >
              Descargar respaldo
            </Button>
            <Button icon={Upload} onClick={() => backupRef.current?.click()}>
              Restaurar respaldo
            </Button>
            <input
              ref={backupRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                if (!(await confirm({ title: '¿Restaurar respaldo?', description: 'Se reemplazarán TODOS los datos actuales por los del archivo.', confirmLabel: 'Restaurar', danger: true }))) return;
                try {
                  await importBackup(f);
                  setDirty(false);
                  toast.success('Respaldo restaurado');
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
          </div>

          <div className="rounded-lg border border-ink-750 bg-ink-900 p-4">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Modo demostración</div>
                <p className="mt-0.5 text-xs text-ink-400">
                  Carga clientes, materiales y cotizaciones de ejemplo marcados como "[Demo]" con precios ilustrativos (no son precios reales). Puedes
                  eliminarlos sin afectar tus datos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {demoCount ? (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={async () => {
                        await clearDemo();
                        toast.success('Datos de demostración eliminados');
                      }}
                    >
                      Eliminar demostración
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      icon={FlaskConical}
                      onClick={async () => {
                        await loadDemo();
                        toast.success('Datos de demostración cargados');
                      }}
                    >
                      Cargar demostración
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-bad/25 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
              <div>
                <div className="text-sm font-medium">Borrar todo</div>
                <p className="mt-0.5 text-xs text-ink-400">Elimina cotizaciones, clientes, materiales y configuración de este dispositivo.</p>
                <Button
                  size="sm"
                  variant="danger"
                  className="mt-3"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: '¿Borrar todos los datos?',
                        description: 'Esta acción no se puede deshacer. Descarga un respaldo antes si lo necesitas.',
                        confirmLabel: 'Borrar todo',
                        danger: true,
                      })
                    ) {
                      await wipeAll();
                      setDirty(false);
                      toast.success('Datos borrados');
                    }
                  }}
                >
                  Borrar todos los datos
                </Button>
              </div>
            </div>
          </div>
        </Group>
      </div>

      {dirty && (
        <div className="anim-rise fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 shadow-2xl lg:inset-x-auto lg:bottom-6 lg:right-10 lg:w-96">
          <span className="text-sm text-ink-200">Tienes cambios sin guardar</span>
          <Button variant="primary" size="sm" icon={Save} onClick={save}>
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}
