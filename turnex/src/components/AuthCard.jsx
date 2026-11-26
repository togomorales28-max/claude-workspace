import { Link } from 'react-router-dom'
import { supabaseConfigurado } from '../lib/supabase'

// Marco común de las pantallas de acceso.
export default function AuthCard({ titulo, subtitulo, children, pie }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/login" className="mb-8 flex items-center gap-2">
        <Logo />
        <span className="font-display text-2xl font-semibold">Turnex</span>
      </Link>
      <div className="tarjeta w-full max-w-sm p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-tinta-suave">{subtitulo}</p>}
        {!supabaseConfigurado && (
          <p className="mt-4 rounded-xl bg-alerta-claro p-3 text-xs text-alerta">
            Falta configurar Supabase: copia <code>.env.example</code> a <code>.env</code> y pon tus claves.
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      {pie && <div className="mt-6 text-sm text-tinta-suave">{pie}</div>}
    </div>
  )
}

export function Logo({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0F5C52" />
      <path d="M18 20h28M32 20v26" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <circle cx="46" cy="44" r="5" fill="#F2B84B" />
    </svg>
  )
}
