import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { LayoutDashboard, FileText, Package, Users, Settings as Cog, Plus, Ruler } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSettings } from '@/lib/hooks';

const NAV = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/estimador', label: 'Estimador', icon: Ruler },
  { to: '/materiales', label: 'Materiales', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/configuracion', label: 'Configuración', icon: Cog },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#26262a" />
        <path d="M9 8h14v4H13v3h8v4h-8v5H9z" fill="#e8792b" />
      </svg>
      <span className="text-[17px] font-bold tracking-[0.2em] text-ink-100">FORGE</span>
    </div>
  );
}

export function AppShell() {
  const settings = useSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const hideFab = pathname.startsWith('/cotizaciones/') || pathname === '/configuracion';

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Sidebar escritorio */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-750 bg-ink-950 lg:flex">
        <div className="px-5 pb-6 pt-6">
          <Logo />
          {settings?.shopName && <div className="mt-3 truncate text-xs text-ink-400">{settings.shopName}</div>}
        </div>
        <div className="px-3 pb-4">
          <button
            onClick={() => navigate('/cotizaciones/nueva')}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ember-500 text-sm font-semibold text-ink-950 transition-colors hover:bg-ember-400 active:scale-[0.98]"
          >
            <Plus className="size-4" /> Nueva cotización
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Principal">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                  isActive
                    ? 'bg-ink-800 font-medium text-ink-100 before:absolute before:left-0 before:top-2 before:h-5 before:w-0.5 before:rounded-full before:bg-ember-500'
                    : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200',
                )
              }
            >
              <Icon className="size-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-750 px-5 py-4 text-[11px] leading-relaxed text-ink-500">
          Datos guardados en este dispositivo.
          <br />
          Respalda desde Configuración.
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-750 bg-ink-900/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <NavLink to="/configuracion" aria-label="Configuración" className="grid size-9 place-items-center rounded-lg text-ink-300 hover:bg-ink-800">
          <Cog className="size-5" />
        </NavLink>
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <Outlet />
      </main>

      {/* Navegación inferior móvil */}
      <nav
        aria-label="Principal móvil"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-750 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex h-15 flex-col items-center justify-center gap-1 text-[10.5px] font-medium', isActive ? 'text-ember-400' : 'text-ink-400')
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      {!hideFab && (
        <button
          onClick={() => navigate('/cotizaciones/nueva')}
          aria-label="Nueva cotización"
          className="no-print fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-2xl bg-ember-500 text-ink-950 shadow-lg shadow-black/40 transition-transform active:scale-95 lg:hidden"
        >
          <Plus className="size-6" />
        </button>
      )}
    </div>
  );
}
