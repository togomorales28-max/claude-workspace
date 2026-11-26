import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Clock, Link2, LogOut, Scissors } from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'
import { Logo } from '../components/AuthCard.jsx'

const NAV = [
  { to: '/dashboard', texto: 'Citas', icono: CalendarDays, end: true },
  { to: '/dashboard/servicios', texto: 'Servicios', icono: Scissors },
  { to: '/dashboard/horarios', texto: 'Horario', icono: Clock },
  { to: '/dashboard/enlace', texto: 'Mi enlace', icono: Link2 },
]

export default function DashboardLayout() {
  const { perfil, salir } = useAuth()
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      {/* Barra lateral en escritorio */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-tinta-linea bg-white p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Logo />
          <span className="font-display text-xl font-semibold">Turnex</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-marca-claro text-marca' : 'text-tinta-suave hover:bg-fondo'}`}>
              <n.icono size={18} /> {n.texto}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-tinta-linea pt-4">
          <p className="truncate px-2 text-sm font-semibold">{perfil?.name || 'Tu barbería'}</p>
          <button onClick={salir} className="mt-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-tinta-suave hover:bg-fondo">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Cabecera en móvil */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-tinta-linea bg-white px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="truncate font-display text-lg font-semibold">{perfil?.name || 'Turnex'}</span>
        </div>
        <button onClick={salir} className="rounded-full p-2 text-tinta-suave" aria-label="Cerrar sesión"><LogOut size={18} /></button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10">
        <Outlet />
      </main>

      {/* Barra inferior en móvil, como una app */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-tinta-linea bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium ${isActive ? 'text-marca' : 'text-tinta-suave'}`}>
            <n.icono size={22} /> {n.texto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
