import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { encodeRequest, methodUnit, webEstimate, type WebEstimatorConfig } from '@/domain/webEstimator';
import { waPhone } from '@/domain/format';

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const money = (n: number) => fmt.format(n);
const FT = 0.3048;

type Unit = 'm' | 'ft';

/** Campo numérico simple para el widget (acepta coma decimal). */
function Num({ label, value, onChange, suffix, integer }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; integer?: boolean }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium" style={{ color: 'var(--w-muted)' }}>
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={value}
          placeholder="0"
          onChange={(e) => {
            const t = e.target.value;
            if (integer ? /^\d*$/.test(t) : /^\d*[.,]?\d*$/.test(t)) onChange(t);
          }}
          className="h-12 w-full rounded-xl border px-3.5 text-right text-base tabular-nums outline-none transition-shadow focus:ring-4"
          style={{ background: 'var(--w-input)', borderColor: 'var(--w-border)', color: 'var(--w-text)', ['--tw-ring-color' as string]: 'var(--w-ring)', paddingRight: suffix ? 44 : undefined }}
          aria-label={label}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 text-sm" style={{ color: 'var(--w-muted)' }}>
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${className}`} style={{ background: 'var(--w-card)', borderColor: 'var(--w-border)' }}>
      {children}
    </div>
  );
}

const toNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function EstimatorWidget({ config, preview = false }: { config: WebEstimatorConfig; preview?: boolean }) {
  const items = config.items;
  const [sel, setSel] = useState(items[0]?.jobType ?? '');
  const [unit, setUnit] = useState<Unit>('m');
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [l, setL] = useState('');
  const [qty, setQty] = useState('1');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!items.some((i) => i.jobType === sel)) setSel(items[0]?.jobType ?? '');
  }, [items, sel]);

  const item = items.find((i) => i.jobType === sel);
  const k = unit === 'ft' ? FT : 1;
  const dims = { width: toNum(w) * k, height: toNum(h) * k, length: toNum(l) * k, qty: Math.max(1, toNum(qty)) };
  const est = useMemo(() => (item ? webEstimate(item, dims, config.rangePct, config.roundTo) : null), [item, dims.width, dims.height, dims.length, dims.qty, config.rangePct, config.roundTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const dark = config.theme === 'dark';
  const vars = {
    '--w-accent': config.accent,
    '--w-ring': `${config.accent}33`,
    '--w-bg': dark ? '#141415' : '#f6f5f3',
    '--w-card': dark ? '#1c1c1f' : '#ffffff',
    '--w-input': dark ? '#141415' : '#ffffff',
    '--w-border': dark ? '#2e2e33' : '#e3e1dc',
    '--w-text': dark ? '#ececef' : '#1c1c20',
    '--w-muted': dark ? '#9a9aa2' : '#6b6b73',
    '--w-chip': dark ? '#26262a' : '#f1efeb',
  } as CSSProperties;

  const rangeText = est?.valid ? (est.low === est.high ? money(est.low) : `${money(est.low)} – ${money(est.high)}`) : '';
  const fmtDim = (v: string) => `${v.replace(',', '.')} ${unit}`;
  const dimsText = !item
    ? ''
    : item.method === 'linear'
      ? `Largo: ${fmtDim(l)}`
      : item.method === 'area'
        ? `Medidas: ${fmtDim(w)} × ${fmtDim(h)}`
        : '';

  const send = () => {
    if (!item || !est?.valid) return;
    const req = encodeRequest({
      jobType: item.jobType,
      label: item.label,
      method: item.method,
      width: Math.round(dims.width * 1000) / 1000,
      height: Math.round(dims.height * 1000) / 1000,
      length: Math.round(dims.length * 1000) / 1000,
      qty: dims.qty,
      low: est.low,
      high: est.high,
      name: name.trim(),
      phone: phone.trim(),
      comment: comment.trim(),
    });
    const lines = [
      `Hola${config.shopName ? ` ${config.shopName}` : ''}, me interesa una cotización:`,
      `• Trabajo: ${item.label}`,
      dimsText && `• ${dimsText}`,
      dims.qty > 1 && `• Cantidad: ${dims.qty}`,
      `• Estimado en su página: ${rangeText}`,
      comment.trim() && `• Detalles: ${comment.trim()}`,
      name.trim() && `Nombre: ${name.trim()}`,
      phone.trim() && `Teléfono: ${phone.trim()}`,
      config.appUrl && `\nAbrir en FORGE: ${config.appUrl.replace(/#.*$/, '')}#/solicitud?d=${req}`,
    ].filter(Boolean);
    const url = `https://wa.me/${waPhone(config.whatsapp)}?text=${encodeURIComponent(lines.join('\n'))}`;
    if (!preview) window.open(url, '_blank', 'noopener');
    setSent(true);
  };

  if (!items.length)
    return (
      <div style={vars} className="p-6 text-center text-sm" >
        <span style={{ color: 'var(--w-muted)' }}>El estimador aún no tiene trabajos configurados.</span>
      </div>
    );

  return (
    <div style={{ ...vars, background: 'var(--w-bg)', color: 'var(--w-text)' }} className="font-sans antialiased">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:py-8">
        <header className="px-1">
          {config.shopName && (
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--w-accent)' }}>
              {config.shopName}
            </div>
          )}
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{config.title}</h1>
          {config.intro && (
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--w-muted)' }}>
              {config.intro}
            </p>
          )}
        </header>

        <Card>
          <div className="mb-3 text-sm font-semibold">1. ¿Qué necesitas?</div>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {items.map((i) => {
              const on = i.jobType === sel;
              return (
                <button
                  key={i.jobType}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setSel(i.jobType);
                    setSent(false);
                  }}
                  className="h-11 rounded-xl border px-4 text-sm font-medium transition-colors active:scale-[0.98]"
                  style={
                    on
                      ? { background: 'var(--w-accent)', borderColor: 'var(--w-accent)', color: '#fff' }
                      : { background: 'var(--w-chip)', borderColor: 'transparent', color: 'var(--w-text)' }
                  }
                >
                  {i.label}
                </button>
              );
            })}
          </div>
        </Card>

        {item && (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">2. Medidas</div>
              {item.method !== 'unit' && (
                <div role="radiogroup" className="inline-flex rounded-lg p-0.5" style={{ background: 'var(--w-chip)' }}>
                  {(['m', 'ft'] as Unit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={unit === u}
                      onClick={() => setUnit(u)}
                      className="h-8 rounded-md px-3 text-xs font-semibold transition-colors"
                      style={unit === u ? { background: 'var(--w-card)', color: 'var(--w-text)', boxShadow: '0 1px 2px rgba(0,0,0,.12)' } : { color: 'var(--w-muted)' }}
                    >
                      {u === 'm' ? 'Metros' : 'Pies'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {item.method === 'linear' && <Num label="Largo" value={l} onChange={(v) => { setL(v); setSent(false); }} suffix={unit} />}
              {item.method === 'area' && (
                <>
                  <Num label="Ancho" value={w} onChange={(v) => { setW(v); setSent(false); }} suffix={unit} />
                  <Num label="Alto" value={h} onChange={(v) => { setH(v); setSent(false); }} suffix={unit} />
                </>
              )}
              <Num label="Cantidad" value={qty} onChange={(v) => { setQty(v); setSent(false); }} suffix="pzas" integer />
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--w-muted)' }}>
            Precio estimado
          </div>
          {est?.valid ? (
            <>
              <div className="mt-1.5 text-[34px] font-bold leading-none tracking-tight tabular-nums sm:text-[40px]" aria-live="polite">
                {rangeText}
              </div>
              <div className="mt-2 text-sm" style={{ color: 'var(--w-muted)' }}>
                {item && item.method !== 'unit' && `${est.measure.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${methodUnit(item.method)} en total · `}
                {est.appliedMinimum ? 'Incluye precio mínimo de trabajo' : 'IVA no incluido'}
              </div>
            </>
          ) : (
            <div className="mt-2 text-[15px]" style={{ color: 'var(--w-muted)' }}>
              {est?.error ?? 'Elige un trabajo.'}
            </div>
          )}
          {config.disclaimer && (
            <p className="mt-4 border-t pt-3 text-xs leading-relaxed" style={{ borderColor: 'var(--w-border)', color: 'var(--w-muted)' }}>
              {config.disclaimer}
            </p>
          )}
        </Card>

        {config.whatsapp && (
          <Card>
            <div className="mb-3 text-sm font-semibold">3. Pide tu cotización formal</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: 'var(--w-muted)' }}>
                  Nombre
                </span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-12 rounded-xl border px-3.5 text-base outline-none focus:ring-4" style={{ background: 'var(--w-input)', borderColor: 'var(--w-border)', color: 'var(--w-text)', ['--tw-ring-color' as string]: 'var(--w-ring)' }} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: 'var(--w-muted)' }}>
                  Teléfono (opcional)
                </span>
                <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="h-12 rounded-xl border px-3.5 text-base outline-none focus:ring-4" style={{ background: 'var(--w-input)', borderColor: 'var(--w-border)', color: 'var(--w-text)', ['--tw-ring-color' as string]: 'var(--w-ring)' }} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[13px] font-medium" style={{ color: 'var(--w-muted)' }}>
                  Detalles (color, diseño, ubicación…)
                </span>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={400} rows={2} className="rounded-xl border px-3.5 py-2.5 text-base outline-none focus:ring-4" style={{ background: 'var(--w-input)', borderColor: 'var(--w-border)', color: 'var(--w-text)', ['--tw-ring-color' as string]: 'var(--w-ring)' }} />
              </label>
            </div>
            <button
              type="button"
              disabled={!est?.valid}
              onClick={send}
              className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-[opacity,transform] active:scale-[0.99] disabled:opacity-40"
              style={{ background: '#1fa855' }}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.5 5 5.2-1.4A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
              </svg>
              Enviar por WhatsApp
            </button>
            {sent && (
              <p className="mt-3 text-center text-sm" style={{ color: 'var(--w-muted)' }} role="status">
                {preview ? 'Vista previa: aquí se abriría WhatsApp con la solicitud.' : 'Se abrió WhatsApp con tu solicitud. ¡Gracias!'}
              </p>
            )}
          </Card>
        )}
        <div className="pb-2 text-center text-[11px]" style={{ color: 'var(--w-muted)' }}>
          Estimador hecho con FORGE
        </div>
      </div>
    </div>
  );
}
