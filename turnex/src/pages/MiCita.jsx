import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { conMayuscula, fechaLarga, hora12, precio } from '../lib/formato'
import { Cargando } from '../components/ProtectedRoute.jsx'
import { enlaceCalendario } from './PublicBooking.jsx'

// /cita/:token — el cliente ve y cancela su cita sin cuenta.
export default function MiCita() {
  const { token } = useParams()
  const [cita, setCita] = useState(undefined)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function cargar() {
    const { data, error } = await supabase.rpc('get_appointment_by_token', { p_token: token })
    setCita(error ? null : data)
  }
  useEffect(() => { cargar() }, [token]) // eslint-disable-line

  async function cancelar() {
    setEnviando(true); setError('')
    const { error } = await supabase.rpc('cancel_appointment_by_token', { p_token: token })
    setEnviando(false); setConfirmando(false)
    if (error) return setError(error.message)
    cargar()
  }

  if (cita === undefined) return <Cargando />
  if (!cita) return <div className="grid min-h-screen place-items-center p-6 text-center"><p className="font-display text-2xl">No encontramos esta cita.</p></div>

  const cancelada = cita.status === 'cancelled'
  return (
    <div className="min-h-screen px-4 pt-[max(40px,env(safe-area-inset-top))]">
      <div className="tarjeta mx-auto max-w-md p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Tu cita en</p>
        <h1 className="font-display text-3xl font-semibold">{cita.barbero.name}</h1>
        <div className={`my-6 rounded-2xl p-4 ${cancelada ? 'bg-fondo text-tinta-suave' : 'bg-marca-claro'}`}>
          <p className="font-semibold">{cita.service_name}{cita.service_price ? ` · ${precio(cita.service_price)}` : ''}</p>
          <p>{conMayuscula(fechaLarga(cita.appointment_date))}</p>
          <p className="font-mono text-lg">{hora12(cita.start_time)} – {hora12(cita.end_time)}</p>
          <p className="mt-2 text-sm font-semibold">{cancelada ? 'Cancelada' : cita.status === 'completed' ? 'Atendida' : 'Confirmada'}</p>
        </div>
        {error && <p className="mb-3 rounded-xl bg-alerta-claro p-3 text-sm text-alerta" role="alert">{error}</p>}
        <div className="grid gap-2">
          {!cancelada && cita.status === 'confirmed' && (
            <a className="btn-secundario" target="_blank" rel="noopener noreferrer"
              href={enlaceCalendario({ titulo: `${cita.service_name} · ${cita.barbero.name}`, fecha: cita.appointment_date, inicio: cita.start_time, fin: cita.end_time, detalle: window.location.href })}>
              <CalendarPlus size={16} /> Añadir a mi calendario
            </a>
          )}
          {cita.se_puede_cancelar && (confirmando ? (
            <div className="rounded-2xl border border-alerta/30 p-4 text-center">
              <p className="mb-3 text-sm font-medium">¿Seguro que quieres cancelar?</p>
              <div className="flex justify-center gap-2">
                <button className="btn-peligro" onClick={cancelar} disabled={enviando}>{enviando ? 'Cancelando…' : 'Sí, cancelar'}</button>
                <button className="btn-secundario" onClick={() => setConfirmando(false)}>No</button>
              </div>
            </div>
          ) : <button className="btn-secundario text-alerta" onClick={() => setConfirmando(true)}>Cancelar cita</button>)}
          <a className="btn-primario" href={`/barbero/${cita.barbero.slug}`}>{cancelada ? 'Reservar otra hora' : 'Reservar otra cita'}</a>
        </div>
      </div>
    </div>
  )
}
