import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle, Phone, Check, X, RotateCcw } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { Cargando } from '../components/ProtectedRoute.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, mensajeError } from '../lib/supabase'
import { ahoraEnZona, sumarDias } from '../lib/tiempoReserva'
import { conMayuscula, fechaLarga, hora12, precio } from '../lib/formato'
import { enlaceWhatsApp } from '../lib/telefono'
import { citasVistas, marcarVistas } from '../lib/citasVistas'

const ESTADOS = {
  confirmed: { texto: 'Confirmada', clase: 'bg-marca-claro text-marca' },
  completed: { texto: 'Atendida', clase: 'bg-emerald-50 text-emerald-700' },
  cancelled: { texto: 'Cancelada', clase: 'bg-fondo text-tinta-suave line-through' },
}

export default function Dashboard() {
  const { usuario, perfil } = useAuth()
  const zona = perfil?.timezone || 'America/Hermosillo'
  const hoy = ahoraEnZona(zona).fecha
  const [fecha, setFecha] = useState(hoy)
  const [citas, setCitas] = useState(null)
  const [semana, setSemana] = useState(0)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(null)
  const [vistas, setVistas] = useState(() => citasVistas(usuario.id))

  const cargar = useCallback(async () => {
    const [dia, prox] = await Promise.all([
      supabase.from('appointments').select('*').eq('appointment_date', fecha).order('start_time'),
      supabase.from('appointments').select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed').gte('appointment_date', hoy).lte('appointment_date', sumarDias(hoy, 6)),
    ])
    if (dia.error) { setError(mensajeError(dia.error)); setCitas([]); return }
    setError('')
    setCitas(dia.data)
    setSemana(prox.count ?? 0)
  }, [fecha, hoy])

  // Recarga al cambiar de día, cada minuto y al volver a la pestaña,
  // para que las reservas nuevas aparezcan sin refrescar.
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60000)
    const alVolver = () => document.visibilityState === 'visible' && cargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [cargar])

  // Las citas nuevas se marcan como vistas unos segundos después de mostrarse.
  useEffect(() => {
    if (!citas?.length) return
    const t = setTimeout(() => { marcarVistas(usuario.id, citas.map((c) => c.id)); setVistas(citasVistas(usuario.id)) }, 4000)
    return () => clearTimeout(t)
  }, [citas, usuario.id])

  async function cambiarEstado(cita, status) {
    setConfirmando(null)
    const anterior = citas
    setCitas(citas.map((c) => (c.id === cita.id ? { ...c, status } : c)))
    const { error } = await supabase.from('appointments').update({ status }).eq('id', cita.id)
    if (error) {
      setCitas(anterior)
      setError(error.code === '23P01' ? 'No se puede reactivar: ese horario ya lo ocupa otra cita.' : mensajeError(error))
    }
  }

  const activas = useMemo(() => (citas || []).filter((c) => c.status !== 'cancelled'), [citas])
  const ingresos = activas.reduce((s, c) => s + (Number(c.service_price) || 0), 0)

  return (
    <>
      <PageHeader titulo="Citas" descripcion={`${semana} ${semana === 1 ? 'cita confirmada' : 'citas confirmadas'} en los próximos 7 días.`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-secundario btn-sm h-9 w-9 !p-0" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior"><ChevronLeft size={18} /></button>
        <button className={`btn-sm ${fecha === hoy ? 'btn-primario' : 'btn-secundario'}`} onClick={() => setFecha(hoy)}>Hoy</button>
        <button className="btn-secundario btn-sm h-9 w-9 !p-0" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente"><ChevronRight size={18} /></button>
        <input type="date" className="campo !w-auto !py-1.5 text-sm" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Elegir fecha" />
      </div>

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">{conMayuscula(fechaLarga(fecha))}</h2>
        {citas && <p className="text-sm text-tinta-suave">{activas.length} {activas.length === 1 ? 'cita' : 'citas'}{ingresos > 0 && <> · <span className="font-mono">{precio(ingresos)}</span> previstos</>}</p>}
      </div>

      {error && <p className="mb-4 rounded-xl bg-alerta-claro p-3 text-sm text-alerta" role="alert">{error}</p>}

      {citas === null ? <Cargando /> : citas.length === 0 ? (
        <div className="tarjeta p-8 text-center">
          <p className="font-medium">No hay citas este día.</p>
          <p className="mt-1 text-sm text-tinta-suave">Comparte tu enlace para que tus clientes reserven solos.</p>
          <Link to="/dashboard/enlace" className="btn-primario mt-4">Ver mi enlace</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {citas.map((c) => {
            const wa = enlaceWhatsApp(c.customer_phone, `Hola ${c.customer_name}, te escribo de ${perfil?.name || 'la barbería'} sobre tu cita del ${fechaLarga(c.appointment_date)} a las ${hora12(c.start_time)}.`)
            const nueva = !vistas.has(c.id) && c.status === 'confirmed'
            return (
              <li key={c.id} className={`tarjeta grid gap-3 p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center ${c.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <div className="font-mono text-sm">
                  <span className="block text-base font-medium text-tinta">{hora12(c.start_time)}</span>
                  <span className="text-tinta-suave">a {hora12(c.end_time)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-semibold">{c.customer_name}</span>
                    {nueva && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Nueva</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADOS[c.status].clase}`}>{ESTADOS[c.status].texto}</span>
                  </div>
                  <p className="text-sm text-tinta-suave">{c.service_name}{c.service_price ? ` · ${precio(c.service_price)}` : ''}</p>
                  <p className="font-mono text-sm text-tinta-suave">{c.customer_phone}{c.customer_email ? ` · ${c.customer_email}` : ''}</p>
                  {c.notes && <p className="mt-1 break-words text-sm italic text-tinta-suave">“{c.notes}”</p>}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {confirmando === c.id ? (
                    <>
                      <button className="btn-peligro btn-sm" onClick={() => cambiarEstado(c, 'cancelled')}>Sí, cancelar</button>
                      <button className="btn-secundario btn-sm" onClick={() => setConfirmando(null)}>No</button>
                    </>
                  ) : (
                    <>
                      {wa && <a className="btn-secundario btn-sm" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
                      <a className="btn-secundario btn-sm" href={`tel:${c.customer_phone}`}><Phone size={14} /> Llamar</a>
                      {c.status === 'confirmed' && <button className="btn-primario btn-sm" onClick={() => cambiarEstado(c, 'completed')}><Check size={14} /> Atendida</button>}
                      {c.status === 'confirmed' && <button className="btn-secundario btn-sm" onClick={() => setConfirmando(c.id)}><X size={14} /> Cancelar</button>}
                      {c.status !== 'confirmed' && <button className="btn-secundario btn-sm" onClick={() => cambiarEstado(c, 'confirmed')}><RotateCcw size={14} /> Reactivar</button>}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
