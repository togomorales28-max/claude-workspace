import {
  cloneElement,
  isValidElement,
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { QuoteStatus } from '@/domain/types';
import { statusLabel } from '@/domain/constants';

// ---------------- Button ----------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-ember-500 text-ink-950 hover:bg-ember-400 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.18)]',
  secondary: 'bg-ink-750 text-ink-100 hover:bg-ink-700 border border-ink-600/70',
  ghost: 'text-ink-200 hover:bg-ink-750 hover:text-ink-100',
  danger: 'bg-bad/10 text-bad hover:bg-bad/20 border border-bad/30',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100 select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} aria-hidden />}
      {children}
      {IconR && <IconR className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} aria-hidden />}
    </button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  className,
  tone = 'default',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: 'default' | 'danger' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors active:scale-95 disabled:opacity-40',
        tone === 'danger' ? 'hover:bg-bad/15 hover:text-bad' : 'hover:bg-ink-750 hover:text-ink-100',
        className,
      )}
      {...rest}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

// ---------------- Field & inputs ----------------
export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  required,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  // Asocia automáticamente la etiqueta con el control (accesibilidad y pruebas)
  const autoId = useId();
  let id = htmlFor;
  let content = children;
  if (!id && isValidElement<{ id?: string }>(children)) {
    id = children.props.id ?? autoId;
    if (!children.props.id) content = cloneElement(children, { id });
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink-300">
          {label}
          {required && <span className="ml-0.5 text-ember-400">*</span>}
        </label>
      )}
      {content}
      {error ? (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'w-full min-w-0 rounded-lg border bg-ink-850 px-3 text-ink-100 placeholder:text-ink-500 transition-colors focus:outline-none focus:border-ember-500 focus:ring-2 focus:ring-ember-500/20 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(inputBase, 'h-10', invalid ? 'border-bad/70' : 'border-ink-700 hover:border-ink-600', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(inputBase, 'min-h-20 py-2 leading-relaxed', invalid ? 'border-bad/70' : 'border-ink-700 hover:border-ink-600', className)}
      {...rest}
    />
  );
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        inputBase,
        'h-10 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2385858d%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8',
        invalid ? 'border-bad/70' : 'border-ink-700 hover:border-ink-600',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/**
 * Campo numérico que mantiene el texto escrito (permite "1." o vacío) y
 * entrega números válidos. Vacío = 0. Acepta coma decimal.
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  step,
  prefix,
  suffix,
  integer,
  className,
  invalid,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix' | 'min'> & {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  prefix?: string;
  suffix?: string;
  integer?: boolean;
  invalid?: boolean;
}) {
  const fmt = (n: number) => (Number.isFinite(n) && n !== 0 ? String(n) : '');
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);

  const parse = (t: string) => {
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  return (
    <div className={cn('relative flex items-center', className)}>
      {prefix && <span className="pointer-events-none absolute left-3 text-sm text-ink-400">{prefix}</span>}
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={text}
        placeholder="0"
        aria-invalid={invalid || undefined}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setText(fmt(value));
        }}
        onChange={(e) => {
          const t = e.target.value;
          if (!/^-?\d*[.,]?\d*$/.test(t)) return;
          setText(t);
          if (t === '' || t === '-') return onChange(0);
          let n = parse(t);
          if (Number.isNaN(n)) return;
          if (integer) n = Math.trunc(n);
          if (n < min) n = min;
          onChange(n);
        }}
        step={step}
        className={cn(
          inputBase,
          'num h-10 text-right',
          prefix && 'pl-7',
          suffix && 'pr-11',
          invalid ? 'border-bad/70' : 'border-ink-700 hover:border-ink-600',
        )}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-3 text-xs text-ink-400">{suffix}</span>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm text-ink-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-400">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-ink-600 transition-colors peer-checked:bg-ember-500 peer-focus-visible:ring-2 peer-focus-visible:ring-ember-500/50" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-ink-100 shadow transition-transform duration-200 peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-lg border border-ink-700 bg-ink-850 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-md px-3 font-medium transition-colors',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
            value === o.value ? 'bg-ink-700 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Status ----------------
const statusStyles: Record<QuoteStatus, string> = {
  draft: 'text-ink-300 bg-ink-700/60 before:bg-ink-400',
  sent: 'text-info bg-info/10 before:bg-info',
  accepted: 'text-ok bg-ok/10 before:bg-ok',
  rejected: 'text-bad bg-bad/10 before:bg-bad',
  completed: 'text-ember-300 bg-ember-500/12 before:bg-ember-400',
};

export function StatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium before:size-1.5 before:rounded-full',
        statusStyles[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

// ---------------- Layout helpers ----------------
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-ember-400">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ children, className, title, actions, description }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; description?: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-ink-750 bg-ink-850', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-ink-750 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink-100">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-400">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-xl border border-ink-700 bg-ink-800 text-ember-400">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold text-ink-100">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>('input, select, textarea, button[data-autofocus]');
      el?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          'anim-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-ink-700 bg-ink-850 shadow-2xl sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
          <div>
            <h2 className="text-base font-semibold text-ink-100">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="overflow-y-auto px-5 py-3">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-ink-750 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
