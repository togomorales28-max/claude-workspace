import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Check, CalendarPlus, Clock } from 'lucide-react'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import { ahoraEnZona, diaSemana, horasDisponibles, sumarDias, aMinutos } from '../lib/tiempoReserva'
import { conMayuscula, fechaCorta, fechaLarga, hora12, precio, duracion } from '../lib/formato'
import { telefonoValido } from '../lib/telefono'
import { Logo } from '../components/AuthCard.jsx'
import { Cargando } from '../components/ProtectedRoute.jsx'

const DIAS_VISIBLES = 21
const NO_DISPONIBLE = 'ya no está disponible' // texto que devuelve book_appointment

// Página pública: /barbero/:slug. El cliente reserva sin crear cuenta.
export default function PublicBooking() {
  const { slug } = useParams()
  const [datos, setDatos] = useState(undefined) // undefined = cargando, null = no existe
  const [servicio, setServicio] = useState(null)
  const [fecha, setFecha] = useState(null)
  const [ocupadas, setOcupadas] = useState(null)
  const [hora, setHora] = useState(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', notas: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reservada, setReservada] = useState(null)

  useEffect(() => {
    supabase.rpc('get_public_booking_data', { p_slug: slug }).then(({ data, error }) => {
      setDatos(error ? null : data)
      if (data?.barbero?.name) document.title = `Reservar con ${data.barbero.name}`
    })
  }, [slug])

  const zona = datos?.barbero.timezone || 'America/Hermosillo'
  const tramosDe = (f) => (datos?.horarios || []).filter((h) => h.day_of_week === diaSemana(f))

  // Días a mostrar: los abiertos de las próximas 3 semanas.
  const dias = useMemo(() => {
    if (!datos) return []
    const hoy = ahoraEnZona(zona).fecha
    return Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(hoy, i)).map((f) => ({ fecha: f, abierto: tramosDe(f).length > 0 }))
  }, [datos]) // eslint-disable-line

  // Al elegir día se piden las horas ocupadas (solo inicio y fin, sin datos de clientes).
  useEffect(() => {
    if (!fecha || !datos) return
    setOcupadas(null)
    supabase.rpc('get_booked_slots', { p_user_id: datos.barbero.user_id, p_date: fecha })
      .then(({ data }) => setOcupadas(data || []))
  }, [fecha, datos])

  const horas = useMemo(() => {
    if (!servicio || !fecha || !ocupadas) return null
    return horasDisponibles({
      fecha, tramos: tramosDe(fecha), duracion: servicio.duration_minutes, ocupadas, zona,
      anticipacionMin: datos.barbero.minimum_booking_notice_minutes,
    })
  }, [servicio, fecha, ocupadas]) // eslint-disable-line

  async function reservar(e) {
    e.preventDefault()
    const err = {}
    if (form.nombre.trim().length < 2) err.nombre = 'Escribe tu nombre.'
    if (!telefonoValido(form.telefono)) err.telefono = 'Escribe tu teléfono a 10 dígitos.'
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) err.email = 'Revisa tu correo.'
    setErrores(err)
    if (Object.keys(err).length) return
    setEnviando(true); setError('')
    const { data, error } = await supabase.rpc('book_appointment', {
      p_slug: slug, p_service_id: servicio.id, p_date: fecha, p_start_time: hora,
      p_customer_name: form.nombre.trim(), p_customer_phone: form.telefono.trim(),
      p_customer_email: form.email.trim() || null, p_notes: form.notas.trim() || null,
    })
    setEnviando(false)
    if (error) {
      if ((error.message || '').includes(NO_DISPONIBLE)) {
        // Alguien la ganó o pasó la anticipación: se refrescan las horas.
        setError('Esa hora se acaba de ocupar. Elige otra.')
        setHora(null)
        const { data: occ } = await supabase.rpc('get_booked_slots', { p_user_id: datos.barbero.user_id, p_date: fecha })
        setOcupadas(occ || [])
      } else setError(error.message === 'Failed to fetch' ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : error.message)
      return
    }
    setReservada(data)
    window.scrollTo(0, 0)
    // Aviso por correo al barbero (y al cliente si dejó su correo). Si falla, el
    // recordatorio programado lo reintenta, así que no se bloquea al cliente.
    supabase.functions.invoke('send-appointment-email', { body: { job: 'booked', appointment_id: data.id } }).catch(() => {})
  }

  if (datos === undefined) return <Cargando />
  if (!datos) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="font-display text-3xl">No encontramos esta barbería</p>
          <p className="mt-2 text-sm text-tinta-suave">{supabaseConfigurado ? 'Revisa que el enlace esté bien escrito.' : 'Falta configurar Supabase (archivo .env).'}</p>
        </div>
      </div>
    )
  }

  const { barbero, servicios } = datos

  if (reservada) return <Confirmacion cita={reservada} barbero={barbero} nombre={form.nombre} email={form.email} />

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-tinta-linea bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-5 pt-[max(20px,env(safe-area-inset-top))]">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-marca font-display text-xl text-white">{barbero.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Reserva tu cita</p>
            <h1 className="truncate font-display text-2xl font-semibold">{barbero.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pt-6">
        <Paso n="1" titulo="Elige el servicio">
          {servicios.length === 0 ? <p className="text-sm text-tinta-suave">Esta barbería todavía no tiene servicios publicados.</p> : (
            <div className="grid gap-2">
              {servicios.map((s) => (
                <button key={s.id} onClick={() => { setServicio(s); setHora(null) }} aria-pressed={servicio?.id === s.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-left transition ${servicio?.id === s.id ? 'border-marca ring-2 ring-marca/20' : 'border-tinta-linea hover:border-tinta-suave'}`}>
                  <span className="min-w-0">
                    <span className="block break-words font-semibold">{s.name}</span>
                    <span className="flex items-center gap-1 text-sm text-tinta-suave"><Clock size={13} /> {duracion(s.duration_minutes)}</span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-sm font-medium">{precio(s.price)}</span>
                </button>
              ))}
            </div>
          )}
        </Paso>

        {servicio && (
          <Paso n="2" titulo="Elige día y hora">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Día">
              {dias.map(({ fecha: f, abierto }) => {
                const c = fechaCorta(f)
                return (
                  <button key={f} disabled={!abierto} onClick={() => { setFecha(f); setHora(null) }} aria-pressed={fecha === f}
                    aria-label={`${fechaLarga(f)}${abierto ? '' : ', cerrado'}`}
                    className={`flex w-16 flex-none flex-col items-center rounded-2xl border py-2 transition disabled:opacity-35 ${fecha === f ? 'border-tinta bg-tinta text-white' : 'border-tinta-linea bg-white'}`}>
                    <span className="text-[11px] font-semibold uppercase">{c.dia}</span>
                    <span className="font-display text-2xl leading-tight">{c.numero}</span>
                    <span className="text-[11px]">{c.mes}</span>
                  </button>
                )
              })}
            </div>
            {fecha && (
              <div className="mt-4">
                {horas === null ? <p className="text-sm text-tinta-suave">Buscando horas libres…</p>
                  : horas.length === 0 ? <p className="rounded-2xl border border-dashed border-tinta-linea p-4 text-center text-sm text-tinta-suave">No quedan horas libres este día. Prueba otro.</p>
                  : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {horas.map((h) => (
                        <button key={h} onClick={() => setHora(h)} aria-pressed={hora === h}
                          className={`rounded-xl border py-2.5 font-mono text-sm transition ${hora === h ? 'border-marca bg-marca text-white' : 'border-tinta-linea bg-white hover:border-marca'}`}>
                          {hora12(h)}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </Paso>
        )}

        {servicio && fecha && hora && (
          <Paso n="3" titulo="Tus datos">
            <form onSubmit={reservar} className="space-y-4" noValidate>
              <div className="rounded-2xl bg-marca-claro p-4 text-sm text-marca">
                <b>{servicio.name}</b> · <span>{fechaLarga(fecha)}</span> a las <b>{hora12(hora)}</b>
                <span className="block text-xs opacity-80">Termina a las {hora12(`${Math.floor((aMinutos(hora) + servicio.duration_minutes) / 60)}:${(aMinutos(hora) + servicio.duration_minutes) % 60}`)} · {precio(servicio.price)}</span>
              </div>
              <Campo id="nombre" etiqueta="Nombre" error={errores.nombre}>
                <input id="nombre" autoComplete="name" maxLength={80} className="campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </Campo>
              <Campo id="telefono" etiqueta="Teléfono (WhatsApp)" error={errores.telefono}>
                <input id="telefono" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className="campo" placeholder="662 123 4567" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </Campo>
              <Campo id="email" etiqueta="Correo (opcional, para tu confirmación y recordatorio)" error={errores.email}>
                <input id="email" type="email" autoComplete="email" maxLength={120} className="campo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Campo>
              <Campo id="notas" etiqueta="Nota para el barbero (opcional)">
                <textarea id="notas" rows={2} maxLength={500} className="campo" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </Campo>
              {error && <p className="rounded-xl bg-alerta-claro p-3 text-sm text-alerta" role="alert">{error}</p>}
              <button className="btn-primario w-full !py-3.5 text-base" disabled={enviando}>{enviando ? 'Reservando…' : 'Confirmar cita'}</button>
              <p className="text-center text-xs text-tinta-suave">Pagas en la barbería. Puedes cancelar desde el enlace que te damos al reservar.</p>
            </form>
          </Paso>
        )}
      </main>
      <Pie />
    </div>
  )
}

function Paso({ n, titulo, children }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 font-display text-xl font-semibold"><span className="text-marca">{n}.</span> {titulo}</h2>
      {children}
    </section>
  )
}

function Campo({ id, etiqueta, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">{etiqueta}</label>
      {children}
      {error && <p className="error-texto">{error}</p>}
    </div>
  )
}

function Pie() {
  return (
    <p className="mt-12 flex items-center justify-center gap-1.5 text-xs text-tinta-suave">
      Reservas con <Logo className="h-4 w-4" /> <span className="font-semibold">Turnex</span>
    </p>
  )
}

export function enlaceCalendario({ titulo, fecha, inicio, fin, detalle }) {
  const f = (h) => `${fecha.replace(/-/g, '')}T${h.slice(0, 5).replace(':', '')}00`
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: `${f(inicio)}/${f(fin)}`, details: detalle })
  return `https://calendar.google.com/calendar/render?${p}`
}

function Confirmacion({ cita, barbero, nombre, email }) {
  const enlaceCita = `${window.location.origin}/cita/${cita.cancel_token}`
  return (
    <div className="min-h-screen px-4 pb-16 pt-[max(40px,env(safe-area-inset-top))]">
      <div className="tarjeta mx-auto max-w-md p-6 text-center sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-marca text-white"><Check size={28} /></div>
        <h1 className="mt-4 font-display text-3xl font-semibold">¡Listo, {nombre.trim().split(' ')[0]}!</h1>
        <p className="mt-2 text-tinta-suave">Tu cita con <b className="text-tinta">{barbero.name}</b> quedó confirmada.</p>
        <div className="my-6 rounded-2xl bg-fondo p-4">
          <p className="font-semibold">{cita.service_name}</p>
          <p>{conMayuscula(fechaLarga(cita.appointment_date))}</p>
          <p className="font-mono text-lg">{hora12(cita.start_time)} – {hora12(cita.end_time)}</p>
        </div>
        <div className="grid gap-2">
          <a className="btn-primario" target="_blank" rel="noopener noreferrer"
            href={enlaceCalendario({ titulo: `${cita.service_name} · ${barbero.name}`, fecha: cita.appointment_date, inicio: cita.start_time, fin: cita.end_time, detalle: `Para ver o cancelar tu cita: ${enlaceCita}` })}>
            <CalendarPlus size={16} /> Añadir a mi calendario
          </a>
          <a className="btn-secundario" href={`/cita/${cita.cancel_token}`}>Ver o cancelar mi cita</a>
        </div>
        <p className="mt-4 text-xs text-tinta-suave">
          {email ? `Te enviamos la confirmación a ${email}. ` : ''}Guarda el enlace de tu cita para cancelarla si lo necesitas.
        </p>
      </div>
      <a href={`/barbero/${barbero.slug}`} className="mx-auto mt-6 flex w-fit items-center gap-1 text-sm text-tinta-suave"><ArrowLeft size={14} /> Reservar otra cita</a>
    </div>
  )
}
