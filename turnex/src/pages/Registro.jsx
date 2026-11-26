import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext.jsx'

export default function Registro() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [revisarCorreo, setRevisarCorreo] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  async function registrar(e) {
    e.preventDefault()
    setError('')
    if (nombre.trim().length < 2) return setError('Escribe el nombre de tu barbería o el tuyo.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // El trigger handle_new_user lee este nombre para crear el perfil y el enlace.
      options: { data: { name: nombre.trim() }, emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setEnviando(false)
    if (error) return setError(error.message === 'User already registered' ? 'Ese correo ya tiene cuenta. Inicia sesión.' : mensajeError(error))
    // Si Supabase pide confirmar el correo, no hay sesión todavía.
    if (!data.session) setRevisarCorreo(true)
    else navigate('/dashboard', { replace: true })
  }

  if (revisarCorreo) {
    return (
      <AuthCard titulo="Revisa tu correo" subtitulo={`Te enviamos un enlace a ${email} para activar tu cuenta.`}
        pie={<Link to="/login" className="font-semibold text-marca">Volver a iniciar sesión</Link>} />
    )
  }

  return (
    <AuthCard titulo="Crea tu cuenta" subtitulo="En 2 minutos tendrás tu enlace de reservas."
      pie={<>¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-marca">Inicia sesión</Link></>}>
      <form onSubmit={registrar} className="space-y-4">
        <div>
          <label htmlFor="nombre" className="etiqueta">Nombre de tu barbería</label>
          <input id="nombre" required maxLength={80} className="campo" placeholder="Ej.: Barbería Don Chuy" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="etiqueta">Correo</label>
          <input id="email" type="email" autoComplete="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="etiqueta">Contraseña</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} className="campo" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-tinta-suave">Mínimo 8 caracteres.</p>
        </div>
        {error && <p className="error-texto text-sm" role="alert">{error}</p>}
        <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
    </AuthCard>
  )
}
