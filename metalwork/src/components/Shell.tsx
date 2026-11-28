import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Scissors, Weight, FileText, Package, Users, Settings2, MoreHorizontal, X } from 'lucide-react';
import { cx } from './ui';
import { useSettings } from '../data/hooks';

export const NAV = [
  { to: '/', label: 'Panel', icon: LayoutGrid, end: true },
  { to: '/cortes', label: 'Optimizador de cortes', short: 'Cortes', icon: Scissors },
  { to: '/peso', label: 'Peso y material', short: 'Peso', icon: Weight },
  { to: '/presupuestos', label: 'Presupuestos', short: 'Presup.', icon: FileText },
  { to: '/catalogo', label: 'Catálogo y precios', short: 'Catálogo', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/ajustes', label: 'Configuración', icon: Settings2 },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#10161e" stroke="#2e3e52" />
      <rect x="8" y="8" width="16" height="16" rx="2" fill="none" stroke="#2f8cff" strokeWidth="2.4" />
      <rect x="11.6" y="11.6" width="8.8" height="8.8" rx=".6" fill="none" stroke="#5aa6ff" strokeOpacity=".45" strokeWidth="1" />
      <path d="M4 27 27 4" stroke="#e4ebf3" strokeWidth="1.4" strokeDasharray="2.2 2" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const shop = settings?.shop.name?.trim();
  const mobileMain = NAV.slice(0, 4);
  const mobileMore = NAV.slice(4);
  const moreActive = mobileMore.some((n) => loc.pathname.startsWith(n.to));

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {/* Barra lateral de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-panel lg:flex">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line">
          <BrandMark className="size-8" />
          <div className="leading-tight min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Metalwork</div>
            <div className="eyebrow !text-[10px] truncate">{shop || 'Calculator'}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx('group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                isActive ? 'bg-raised text-ink' : 'text-ink-2 hover:bg-raised/60 hover:text-ink')}>
              {({ isActive }) => (<>
                <span className={cx('absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-colors', isActive ? 'bg-volt' : 'bg-transparent')} />
                <n.icon className={cx('size-[18px]', isActive ? 'text-volt-2' : 'text-mute group-hover:text-ink-2')} strokeWidth={1.8} />
                {n.label}
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-3 text-[11px] text-mute leading-relaxed">
          Datos guardados en este dispositivo.<br />Respalda desde Configuración.
        </div>
      </aside>

      {/* Encabezado móvil */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur pt-[env(safe-area-inset-top)] lg:hidden">
        <BrandMark className="size-7" />
        <div className="text-[15px] font-semibold tracking-tight truncate">{shop || 'Metalwork Calculator'}</div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8 pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-10">
        {children}
      </main>

      {/* Navegación inferior móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-panel/97 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        {mobileMain.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cx('flex h-[60px] flex-col items-center justify-center gap-1 text-[11px]', isActive ? 'text-volt-2' : 'text-mute')}>
            <n.icon className="size-5" strokeWidth={1.8} />
            {n.short ?? n.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)}
          className={cx('flex h-[60px] flex-col items-center justify-center gap-1 text-[11px]', moreActive ? 'text-volt-2' : 'text-mute')}>
          <MoreHorizontal className="size-5" strokeWidth={1.8} />
          Más
        </button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 lg:hidden fade" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-line-2 bg-panel p-3 pb-[calc(12px+env(safe-area-inset-bottom))] rise" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="eyebrow">Más secciones</span>
              <button className="p-2 text-mute" aria-label="Cerrar" onClick={() => setMore(false)}><X className="size-4" /></button>
            </div>
            {mobileMore.map((n) => (
              <NavLink key={n.to} to={n.to} onClick={() => setMore(false)}
                className={({ isActive }) => cx('flex h-12 items-center gap-3 rounded-md px-3 text-[15px]', isActive ? 'bg-raised text-ink' : 'text-ink-2')}>
                <n.icon className="size-5 text-mute" strokeWidth={1.8} />{n.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
