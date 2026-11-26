import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext.jsx'

// Supabase abre esta página con una sesión temporal desde el enlace del correo.
export default function RestablecerPassword() {
  const { session, cargando } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setError(''); setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    navigate('/dashboard', { replace: true })
  }

  if (!cargando && !session) {
    return (
      <AuthCard titulo="El enlace caducó" subtitulo="Pide uno nuevo para cambiar tu contraseña."
        pie={<Link to="/recuperar-password" className="font-semibold text-marca">Pedir otro enlace</Link>} />
    )
  }

  return (
    <AuthCard titulo="Nueva contraseña">
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label htmlFor="password" className="etiqueta">Contraseña nueva</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} className="campo" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error-texto text-sm" role="alert">{error}</p>}
        <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar y entrar'}</button>
      </form>
    </AuthCard>
  )
}
