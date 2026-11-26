import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si faltan las variables usamos un cliente de repuesto para que la app
// cargue y muestre un aviso, en lugar de quedar en blanco.
export const supabaseConfigurado = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'https://sin-configurar.supabase.co',
  anonKey || 'sin-configurar',
)

// Mensaje legible para errores de Supabase/Postgres.
export function mensajeError(error, porDefecto = 'Algo salió mal. Inténtalo de nuevo.') {
  if (!error) return porDefecto
  if (!supabaseConfigurado) return 'Falta configurar Supabase (archivo .env).'
  const m = error.message || ''
  if (m === 'Failed to fetch') return 'Sin conexión. Revisa tu internet.'
  return m || porDefecto
}
