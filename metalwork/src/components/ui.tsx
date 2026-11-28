import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { parseNum } from '../lib/format';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

/* ───────── Botones ───────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-volt text-volt-ink hover:bg-volt-2',
        variant === 'secondary' && 'bg-raised text-ink border border-line hover:border-line-2 hover:bg-[#212d3b]',
        variant === 'ghost' && 'text-ink-2 hover:text-ink hover:bg-raised',
        variant === 'danger' && 'bg-bad/12 text-bad border border-bad/30 hover:bg-bad/20',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-raised transition-colors active:scale-95 disabled:opacity-40', className)}>
      {children}
    </button>
  );
}

/* ───────── Paneles ───────── */
export function Panel({ title, eyebrow, actions, children, className, pad = true }:
  { title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-lg border border-line bg-panel', className)}>
      {(title || actions || eyebrow) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 min-h-[52px]">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
            {title && <h2 className="text-[15px] font-semibold text-ink truncate">{title}</h2>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1 text-volt-2">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ───────── Campos ───────── */
export function Field({ label, unit, hint, error, children, className }:
  { label: string; unit?: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
        <span>{label}</span>
        {unit && <span className="font-mono text-[11px] text-mute">{unit}</span>}
      </label>
      {children(id)}
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : hint ? <p className="mt-1 text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

/**
 * Campo numérico que acepta coma o punto decimal y no pierde lo que el usuario está escribiendo.
 * Llama onChange con null cuando el campo queda vacío.
 */
export function NumberInput({ value, onChange, id, placeholder, min, className, invalid, suffix, ariaLabel, integer }:
  { value: number | null | undefined; onChange: (v: number | null) => void; id?: string; placeholder?: string; min?: number; className?: string; invalid?: boolean; suffix?: string; ariaLabel?: string; integer?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      if (parseNum(text) !== value) setText(value == null ? '' : String(value));
    }
  }, [value, text]);
  const parsed = parseNum(text);
  const bad = invalid || (text.trim() !== '' && parsed === null) || (parsed !== null && min !== undefined && parsed < min) || (integer && parsed !== null && !Number.isInteger(parsed));
  return (
    <div className={cx('relative', className)}>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        className={cx('field num', bad && 'field-err', suffix && 'pr-12')}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const n = parseNum(t);
          last.current = n;
          onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-mute">{suffix}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, className, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={cx('field', className)} />;
}

export function TextArea({ value, onChange, className, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return <textarea {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={cx('field h-auto min-h-[84px] py-2 leading-relaxed', className)} />;
}

export function Select<T extends string>({ value, onChange, options, id, className, ariaLabel }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; id?: string; className?: string; ariaLabel?: string }) {
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx('field', className)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-md border border-line bg-base p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('h-8 flex-1 rounded px-3 text-[13px] font-medium transition-colors whitespace-nowrap',
            value === o.value ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]' : 'text-mute hover:text-ink-2')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('mt-0.5 relative h-5 w-9 shrink-0 rounded-full border transition-colors', checked ? 'bg-volt border-volt' : 'bg-base border-line-2')}>
        <span className={cx('absolute top-0.5 size-3.5 rounded-full bg-ink transition-transform duration-150', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
    </label>
  );
}

/* ───────── Datos ───────── */
export function Stat({ label, value, sub, tone = 'default', className }:
  { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'volt' | 'ok' | 'warn' | 'bad'; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-line bg-panel px-4 py-3', className)}>
      <div className="eyebrow">{label}</div>
      <div className={cx('num mt-1.5 text-xl font-medium leading-tight',
        tone === 'volt' && 'text-volt-2', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'volt' | 'ok' | 'warn' | 'bad' }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide border',
      tone === 'default' && 'border-line-2 text-ink-2',
      tone === 'volt' && 'border-volt/40 text-volt-2 bg-volt/10',
      tone === 'ok' && 'border-ok/40 text-ok bg-ok/10',
      tone === 'warn' && 'border-warn/40 text-warn bg-warn/10',
      tone === 'bad' && 'border-bad/40 text-bad bg-bad/10')}>{children}</span>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad'; children: ReactNode }) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={cx('flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-snug',
      tone === 'info' && 'border-volt/30 bg-volt/8 text-ink-2',
      tone === 'warn' && 'border-warn/35 bg-warn/8 text-warn',
      tone === 'bad' && 'border-bad/35 bg-bad/8 text-bad')}>
      <Icon className="size-4 shrink-0 mt-px" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-2 px-6 py-12 text-center">
      <div className="mb-3 text-mute">{icon}</div>
      <div className="font-medium text-ink">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-mute">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────── Modal ───────── */
export function Modal({ open, onClose, title, children, footer, wide }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center fade" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div className={cx('relative flex max-h-[92dvh] w-full flex-col rounded-t-xl sm:rounded-xl border border-line-2 bg-panel shadow-2xl rise',
        wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}><X className="size-4" /></IconButton>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

/* ───────── Confirmación y avisos ───────── */
type Toast = { id: number; text: string; tone: 'ok' | 'bad' | 'info' };
interface UiCtx {
  toast: (text: string, tone?: Toast['tone']) => void;
  confirm: (o: { title: string; text: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}
const Ctx = createContext<UiCtx | null>(null);
export const useUi = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('UiProvider faltante');
  return c;
};

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<null | { title: string; text: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }>(null);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const confirm = useCallback<UiCtx['confirm']>((o) => new Promise((resolve) => setDlg({ ...o, resolve })), []);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="rise pointer-events-auto flex items-center gap-2 rounded-md border border-line-2 bg-raised px-3.5 py-2.5 text-sm shadow-xl">
            {t.tone === 'ok' && <CheckCircle2 className="size-4 text-ok" />}
            {t.tone === 'bad' && <AlertTriangle className="size-4 text-bad" />}
            {t.tone === 'info' && <Info className="size-4 text-volt-2" />}
            {t.text}
          </div>
        ))}
      </div>
      <Modal open={!!dlg} onClose={() => close(false)} title={dlg?.title ?? ''}
        footer={<>
          <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
          <Button variant={dlg?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{dlg?.confirmLabel ?? 'Aceptar'}</Button>
        </>}>
        <p className="text-sm text-ink-2">{dlg?.text}</p>
      </Modal>
    </Ctx.Provider>
  );
}
