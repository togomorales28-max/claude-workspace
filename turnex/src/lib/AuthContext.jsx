import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (userId) => {
    if (!userId) { setPerfil(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    setPerfil(data ?? null)
  }, [])

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSession(data.session)
      await cargarPerfil(data.session?.user.id)
      setCargando(false)
    }).catch(() => setCargando(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      // Se difiere para no llamar a Supabase dentro del callback (evita bloqueos del cliente).
      setTimeout(() => cargarPerfil(nueva?.user.id), 0)
    })
    return () => { activo = false; sub.subscription.unsubscribe() }
  }, [cargarPerfil])

  const valor = {
    session,
    usuario: session?.user ?? null,
    perfil,
    cargando,
    recargarPerfil: () => cargarPerfil(session?.user.id),
    salir: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
