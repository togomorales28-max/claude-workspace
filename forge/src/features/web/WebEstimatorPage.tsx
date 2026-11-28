import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Globe, Save, Sparkles, Monitor, Smartphone, MessageCircle } from 'lucide-react';
import { useQuotes, useReferences, useSettings } from '@/lib/hooks';
import { settingsRepo } from '@/data/repo';
import { encodeConfig, methodUnit, type WebEstimatorConfig, type WebItem } from '@/domain/webEstimator';
import { toMeters } from '@/domain/scale';
import { money } from '@/domain/format';
import { ROUND_OPTIONS } from '@/domain/constants';
import type { Quote, ReferencePrice, ScaleMethod, Settings } from '@/domain/types';
import { Button, Field, Input, NumberInput, PageHeader, Panel, Segmented, Select, Textarea, Toggle } from '@/components/ui';
import { EstimatorWidget } from '@/widget/EstimatorWidget';
import { cn } from '@/lib/cn';
import { IS_SINGLE_FILE, PUBLIC_URL } from '@/lib/platform';

/** URL base donde está publicada esta copia de FORGE (sin hash ni index.html). */
export const currentBaseUrl = () => IS_SINGLE_FILE ? PUBLIC_URL : location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
const isLocal = () => !IS_SINGLE_FILE && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';

function measureOf(q: Quote, m: ScaleMethod) {
  const d = q.dimensions;
  const qty = Math.max(1, d.quantity);
  if (m === 'linear') return (d.length || d.width) * qty;
  if (m === 'area') return d.width * d.height * qty;
  return qty;
}

/** Tarifa sugerida a partir de tus cotizaciones (no rechazadas) y precios de referencia. */
function suggestion(item: WebItem, quotes: Quote[], refs: ReferencePrice[]) {
  const rates: number[] = [];
  for (const q of quotes) {
    if (q.jobType !== item.jobType || q.status === 'rejected' || q.totals.price <= 0) continue;
    const m = measureOf(q, item.method);
    if (m > 0) rates.push(q.totals.price / m);
  }
  for (const r of refs) {
    if (r.jobType !== item.jobType || r.method !== item.method || r.price <= 0) continue;
    const variable = r.price * (1 - r.fixedPct / 100);
    const m = r.method === 'linear' ? toMeters(r.refLength, r.unit) : r.method === 'area' ? toMeters(r.refLength, r.unit) * toMeters(r.refHeight, r.unit) : 1;
    if (m > 0) rates.push(variable / m);
  }
  if (!rates.length) return null;
  return { rate: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length), n: rates.length };
}

export function WebEstimatorPage() {
  const settings = useSettings();
  if (!settings) return <div className="h-64" />;
  return <WebEstimatorForm settings={settings} />;
}

function WebEstimatorForm({ settings }: { settings: Settings }) {
  const quotes = useQuotes() ?? [];
  const refs = useReferences() ?? [];
  const initial = useMemo<WebEstimatorConfig>(
    () => ({
      ...settings.web,
      shopName: settings.web.shopName || settings.shopName,
      whatsapp: settings.web.whatsapp || settings.phone,
      appUrl: settings.web.appUrl || (isLocal() ? '' : currentBaseUrl()),
    }),
    [settings],
  );
  const [c, setC] = useState<WebEstimatorConfig>(initial);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) setC(initial);
  }, [initial, dirty]);

  const set = <K extends keyof WebEstimatorConfig>(k: K, v: WebEstimatorConfig[K]) => {
    setC((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };
  const setItem = (jobType: string, patch: Partial<WebItem>) =>
    set(
      'items',
      c.items.map((i) => (i.jobType === jobType ? { ...i, ...patch } : i)),
    );

  const active = c.items.filter((i) => i.enabled && i.rate > 0);
  const previewConfig = { ...c, items: active };
  const base = (c.appUrl || currentBaseUrl()).replace(/#.*$/, '').replace(/index\.html$/, '');
  const baseSlash = base.endsWith('/') ? base : `${base}/`;
  const link = `${baseSlash}widget.html#c=${encodeConfig(c)}`;
  const embed = `<iframe id="forge-estimador" src="${link}" title="Estimador de precios" loading="lazy" style="width:100%;min-height:720px;border:0;display:block"></iframe>
<script>addEventListener("message",function(e){if(e.data&&e.data.type==="forge-widget-height"){document.getElementById("forge-estimador").style.height=e.data.height+"px"}});</script>`;

  const errors: string[] = [];
  if (!active.length) errors.push('Activa al menos un trabajo con precio.');
  if (!c.whatsapp.replace(/\D/g, '')) errors.push('Sin WhatsApp, tus clientes no podrán enviarte la solicitud.');
  if (c.items.some((i) => i.enabled && i.rate <= 0)) errors.push('Hay trabajos activos sin precio: no se mostrarán.');

  const save = async () => {
    await settingsRepo.save({ web: { ...c, appUrl: c.appUrl.trim() } });
    setDirty(false);
    toast.success('Estimador web guardado');
  };
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
      if (dirty) void save();
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
    }
  };

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Para tu página web"
        title="Estimador web"
        subtitle="Un cotizador público para que tus clientes calculen un precio aproximado y te escriban por WhatsApp."
        actions={
          <Button variant="primary" icon={Save} onClick={save} disabled={!dirty}>
            Guardar
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Precios por tipo de trabajo" description="Tu cliente verá un rango calculado con estas tarifas. Usa tus precios de venta (no de costo).">
            <ul className="divide-y divide-ink-750">
              {c.items.map((i) => {
                const sug = suggestion(i, quotes, refs);
                return (
                  <li key={i.jobType} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <Toggle checked={i.enabled} onChange={(v) => setItem(i.jobType, { enabled: v })} label={<span className="font-medium">{i.label}</span>} />
                    </div>
                    {i.enabled && (
                      <div className="anim-fade mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_140px_1fr_1fr]">
                        <Field label="Nombre visible" className="col-span-2 sm:col-span-1">
                          <Input value={i.label} onChange={(e) => setItem(i.jobType, { label: e.target.value })} maxLength={60} />
                        </Field>
                        <Field label="Se cobra por">
                          <Select value={i.method} onChange={(e) => setItem(i.jobType, { method: e.target.value as ScaleMethod })}>
                            <option value="linear">Metro lineal</option>
                            <option value="area">Metro cuadrado</option>
                            <option value="unit">Pieza</option>
                          </Select>
                        </Field>
                        <Field label={`Precio por ${methodUnit(i.method)}`}>
                          <NumberInput value={i.rate} onChange={(v) => setItem(i.jobType, { rate: v })} prefix="$" invalid={i.rate <= 0} aria-label={`Precio por ${methodUnit(i.method)} de ${i.label}`} />
                        </Field>
                        <Field label="Mínimo">
                          <NumberInput value={i.minimum} onChange={(v) => setItem(i.jobType, { minimum: v })} prefix="$" aria-label={`Precio mínimo de ${i.label}`} />
                        </Field>
                        {sug && sug.rate !== i.rate && (
                          <button
                            type="button"
                            onClick={() => setItem(i.jobType, { rate: sug.rate })}
                            className="col-span-2 inline-flex items-center gap-1.5 justify-self-start text-xs text-info hover:underline sm:col-span-4"
                          >
                            <Sparkles className="size-3.5" /> Usar {money(sug.rate)} por {methodUnit(i.method)} (promedio de {sug.n} {sug.n === 1 ? 'trabajo tuyo' : 'trabajos tuyos'})
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Textos y contacto">
            <div className="grid gap-4 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre del taller">
                  <Input value={c.shopName} onChange={(e) => set('shopName', e.target.value)} maxLength={80} />
                </Field>
                <Field label="WhatsApp que recibe solicitudes">
                  <Input type="tel" value={c.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="10 dígitos" />
                </Field>
              </div>
              <Field label="Título">
                <Input value={c.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
              </Field>
              <Field label="Introducción">
                <Textarea value={c.intro} onChange={(e) => set('intro', e.target.value)} rows={2} maxLength={400} />
              </Field>
              <Field label="Aviso" hint="Aclara que es un precio aproximado.">
                <Textarea value={c.disclaimer} onChange={(e) => set('disclaimer', e.target.value)} rows={2} maxLength={400} />
              </Field>
            </div>
          </Panel>

          <Panel title="Apariencia y rango">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <Field label="Tema">
                <Segmented
                  value={c.theme}
                  onChange={(v) => set('theme', v)}
                  options={[
                    { value: 'light', label: 'Claro' },
                    { value: 'dark', label: 'Oscuro' },
                  ]}
                />
              </Field>
              <Field label="Color principal">
                <div className="flex items-center gap-2">
                  <input type="color" value={c.accent} onChange={(e) => set('accent', e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-ink-700 bg-ink-850 p-1" aria-label="Color principal" />
                  <Input value={c.accent} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set('accent', e.target.value)} className="font-mono" aria-label="Color en hexadecimal" />
                </div>
              </Field>
              <Field label="Rango mostrado" hint="Ej. 10 % muestra $9,000 – $11,000 para $10,000.">
                <NumberInput value={c.rangePct} onChange={(v) => set('rangePct', Math.min(50, v))} suffix="± %" aria-label="Rango" />
              </Field>
              <Field label="Redondeo">
                <Select value={c.roundTo} onChange={(e) => set('roundTo', Number(e.target.value))}>
                  {ROUND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {errors.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <Panel
            title="Vista previa"
            description="Así lo verán tus clientes."
            actions={
              <Segmented
                size="sm"
                value={device}
                onChange={setDevice}
                options={[
                  { value: 'desktop', label: <Monitor className="size-3.5" aria-label="Escritorio" /> },
                  { value: 'mobile', label: <Smartphone className="size-3.5" aria-label="Celular" /> },
                ]}
              />
            }
          >
            <div className="bg-ink-950/60 p-3 sm:p-4">
              <div className={cn('mx-auto overflow-hidden rounded-xl border border-ink-700 transition-[max-width] duration-300', device === 'mobile' ? 'max-w-[380px]' : 'max-w-full')}>
                <EstimatorWidget config={previewConfig} preview />
              </div>
            </div>
          </Panel>

          <Panel title="Publicar en tu página" description="Copia el código y pégalo en tu sitio (WordPress, Wix, Google Sites, HTML…).">
            <div className="grid gap-4 p-4 sm:p-5">
              <Field
                label="Dirección donde está publicado FORGE"
                hint={
                  isLocal() && !c.appUrl
                    ? 'Estás usando FORGE en esta computadora (localhost). Publica FORGE en internet y escribe aquí su dirección para que el enlace funcione para tus clientes.'
                    : 'También permite que las solicitudes de WhatsApp traigan un enlace que abre la cotización ya llenada en tu FORGE.'
                }
              >
                <Input value={c.appUrl} onChange={(e) => set('appUrl', e.target.value)} placeholder="https://tu-usuario.github.io/forge/" />
              </Field>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink-300">Código para insertar</span>
                  <Button size="sm" icon={copied === 'embed' ? Check : Copy} onClick={() => copy(embed, 'embed')} disabled={!active.length}>
                    {copied === 'embed' ? 'Copiado' : 'Copiar código'}
                  </Button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-ink-300">{embed}</pre>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-medium text-ink-300">Enlace directo</div>
                <p className="mb-2 text-xs text-ink-500">Para Facebook, Instagram, Google Maps o tu estado de WhatsApp.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" icon={copied === 'link' ? Check : Copy} onClick={() => copy(link, 'link')} disabled={!active.length}>
                    {copied === 'link' ? 'Copiado' : 'Copiar enlace'}
                  </Button>
                  <a href={active.length ? link : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!active.length} onClick={() => dirty && void save()}>
                    <Button size="sm" icon={ExternalLink} disabled={!active.length}>
                      Abrir
                    </Button>
                  </a>
                  <a href={active.length ? `https://wa.me/?text=${encodeURIComponent(`Calcula el precio de tu trabajo de herrería aquí: ${link}`)}` : undefined} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" icon={MessageCircle} disabled={!active.length}>
                      Compartir
                    </Button>
                  </a>
                </div>
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-xs leading-relaxed text-ink-400">
                <Globe className="mt-0.5 size-3.5 shrink-0" />
                Las tarifas van dentro del enlace. Si cambias precios, vuelve a copiar el código y reemplázalo en tu página.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
