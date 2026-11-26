import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import { supabase, mensajeError } from '../lib/supabase'

export default function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError(''); setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/restablecer-password`,
    })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    setEnviado(true)
  }

  return (
    <AuthCard titulo="Recupera tu contraseña"
      subtitulo={enviado ? `Si ${email} tiene cuenta, te llegará un enlace para crear una nueva contraseña.` : 'Te enviaremos un enlace a tu correo.'}
      pie={<Link to="/login" className="font-semibold text-marca">Volver a iniciar sesión</Link>}>
      {!enviado && (
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label htmlFor="email" className="etiqueta">Correo</label>
            <input id="email" type="email" autoComplete="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="error-texto text-sm" role="alert">{error}</p>}
          <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>
        </form>
      )}
    </AuthCard>
  )
}
