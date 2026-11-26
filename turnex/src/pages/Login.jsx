import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext.jsx'

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to={location.state?.desde || '/dashboard'} replace />

  async function entrar(e) {
    e.preventDefault()
    setError(''); setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setEnviando(false)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.'
        : error.message === 'Email not confirmed' ? 'Confirma tu correo: te enviamos un enlace al registrarte.'
        : mensajeError(error))
      return
    }
    navigate(location.state?.desde || '/dashboard', { replace: true })
  }

  return (
    <AuthCard titulo="Entra a tu panel" subtitulo="Tu agenda de citas, siempre al día."
      pie={<>¿Aún no tienes cuenta? <Link to="/registro" className="font-semibold text-marca">Regístrate gratis</Link></>}>
      <form onSubmit={entrar} className="space-y-4">
        <div>
          <label htmlFor="email" className="etiqueta">Correo</label>
          <input id="email" type="email" autoComplete="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="etiqueta">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" required className="campo" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error-texto text-sm" role="alert">{error}</p>}
        <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <Link to="/recuperar-password" className="block text-center text-sm text-tinta-suave hover:text-tinta">Olvidé mi contraseña</Link>
      </form>
    </AuthCard>
  )
}
