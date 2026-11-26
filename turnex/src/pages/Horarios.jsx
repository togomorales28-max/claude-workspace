import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { Cargando } from '../components/ProtectedRoute.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, mensajeError } from '../lib/supabase'
import { aMinutos } from '../lib/tiempoReserva'
import { DIAS } from '../lib/formato'

const ORDEN = [1, 2, 3, 4, 5, 6, 0] // lunes primero
const ANTICIPACION = [
  [0, 'Sin mínimo'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 día'],
]
const ZONAS = [
  ['America/Hermosillo', 'Sonora (Hermosillo)'], ['America/Tijuana', 'Baja California (Tijuana)'],
  ['America/Mazatlan', 'Pacífico (Mazatlán, Culiacán)'], ['America/Mexico_City', 'Centro (CDMX, Guadalajara, Monterrey)'],
  ['America/Cancun', 'Quintana Roo (Cancún)'], ['America/Bogota', 'Colombia'], ['America/Lima', 'Perú'],
  ['America/Santiago', 'Chile'], ['America/Argentina/Buenos_Aires', 'Argentina'], ['America/Los_Angeles', 'EE. UU. Pacífico'],
  ['Europe/Madrid', 'España'],
]

export default function Horarios() {
  const { usuario, perfil, recargarPerfil } = useAuth()
  const [dias, setDias] = useState(null) // { 0: [{start,end}], ... }
  const [anticipacion, setAnticipacion] = useState(perfil?.minimum_booking_notice_minutes ?? 120)
  const [zona, setZona] = useState(perfil?.timezone || 'America/Hermosillo')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [idsPrevios, setIdsPrevios] = useState([])

  useEffect(() => {
    supabase.from('business_hours').select('*').order('start_time').then(({ data, error }) => {
      if (error) setError(mensajeError(error))
      const porDia = Object.fromEntries(ORDEN.map((d) => [d, []]))
      ;(data || []).filter((h) => h.is_working).forEach((h) => porDia[h.day_of_week].push({ start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) }))
      setIdsPrevios((data || []).map((h) => h.id))
      setDias(porDia)
    })
  }, [])

  useEffect(() => {
    if (perfil) { setAnticipacion(perfil.minimum_booking_notice_minutes); setZona(perfil.timezone) }
  }, [perfil])

  const cambiar = (d, i, campo, valor) => setDias({ ...dias, [d]: dias[d].map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) })
  const alternarDia = (d) => setDias({ ...dias, [d]: dias[d].length ? [] : [{ start: '09:00', end: '19:00' }] })
  const agregarTramo = (d) => {
    const ultimo = dias[d][dias[d].length - 1]
    setDias({ ...dias, [d]: [...dias[d], { start: ultimo ? ultimo.end : '09:00', end: '20:00' }] })
  }
  const quitarTramo = (d, i) => setDias({ ...dias, [d]: dias[d].filter((_, j) => j !== i) })

  function validar() {
    for (const d of ORDEN) {
      const tramos = [...dias[d]].sort((a, b) => aMinutos(a.start) - aMinutos(b.start))
      for (let i = 0; i < tramos.length; i++) {
        if (!tramos[i].start || !tramos[i].end || aMinutos(tramos[i].end) <= aMinutos(tramos[i].start)) return `Revisa el ${DIAS[d]}: la hora de cierre debe ser después de la de apertura.`
        if (i > 0 && aMinutos(tramos[i].start) < aMinutos(tramos[i - 1].end)) return `Revisa el ${DIAS[d]}: hay horarios que se enciman.`
      }
    }
    return ''
  }

  async function guardar() {
    const problema = validar()
    if (problema) return setError(problema)
    setError(''); setAviso(''); setGuardando(true)
    const filas = ORDEN.flatMap((d) => dias[d].map((t) => ({ user_id: usuario.id, day_of_week: d, is_working: true, start_time: t.start, end_time: t.end })))
    // Primero se insertan los nuevos y luego se borran los anteriores:
    // si algo falla a medias, el barbero no se queda sin horario.
    const ins = filas.length ? await supabase.from('business_hours').insert(filas).select('id') : { data: [] }
    if (ins.error) { setGuardando(false); return setError(mensajeError(ins.error)) }
    if (idsPrevios.length) await supabase.from('business_hours').delete().in('id', idsPrevios)
    setIdsPrevios(ins.data.map((f) => f.id))
    const perf = await supabase.from('profiles').update({ minimum_booking_notice_minutes: Number(anticipacion), timezone: zona }).eq('user_id', usuario.id)
    setGuardando(false)
    if (perf.error) return setError(mensajeError(perf.error))
    recargarPerfil()
    setAviso('Horario guardado. Tu página de reservas ya lo usa.')
  }

  if (!dias) return <Cargando />

  return (
    <>
      <PageHeader titulo="Horario" descripcion="Los días y horas en que tus clientes pueden reservar. Puedes partir el día, por ejemplo para la comida." />
      <div className="tarjeta divide-y divide-tinta-linea">
        {ORDEN.map((d) => (
          <div key={d} className="grid gap-3 p-4 sm:grid-cols-[150px_1fr] sm:items-start">
            <label className="flex cursor-pointer items-center gap-3 pt-2 font-medium capitalize">
              <input type="checkbox" className="h-5 w-5 accent-marca" checked={dias[d].length > 0} onChange={() => alternarDia(d)} />
              {DIAS[d]}
            </label>
            {dias[d].length === 0 ? <p className="pt-2 text-sm text-tinta-suave">Cerrado</p> : (
              <div className="space-y-2">
                {dias[d].map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input type="time" step="900" className="campo !w-auto !py-1.5 font-mono text-sm" value={t.start} onChange={(e) => cambiar(d, i, 'start', e.target.value)} aria-label={`Abre ${DIAS[d]}`} />
                    <span className="text-sm text-tinta-suave">a</span>
                    <input type="time" step="900" className="campo !w-auto !py-1.5 font-mono text-sm" value={t.end} onChange={(e) => cambiar(d, i, 'end', e.target.value)} aria-label={`Cierra ${DIAS[d]}`} />
                    {dias[d].length > 1 && <button className="rounded-full p-1.5 text-tinta-suave hover:bg-fondo" onClick={() => quitarTramo(d, i)} aria-label="Quitar este horario"><X size={16} /></button>}
                  </div>
                ))}
                <button className="flex items-center gap-1 text-xs font-semibold text-marca" onClick={() => agregarTramo(d)}><Plus size={14} /> Añadir otro horario este día</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="tarjeta mt-6 grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="anticipacion" className="etiqueta">Anticipación mínima para reservar</label>
          <select id="anticipacion" className="campo" value={anticipacion} onChange={(e) => setAnticipacion(e.target.value)}>
            {ANTICIPACION.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <p className="mt-1 text-xs text-tinta-suave">Así nadie te reserva para dentro de 5 minutos.</p>
        </div>
        <div>
          <label htmlFor="zona" className="etiqueta">Zona horaria de tu barbería</label>
          <select id="zona" className="campo" value={zona} onChange={(e) => setZona(e.target.value)}>
            {!ZONAS.some(([z]) => z === zona) && <option value={zona}>{zona}</option>}
            {ZONAS.map(([z, t]) => <option key={z} value={z}>{t}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-alerta-claro p-3 text-sm text-alerta" role="alert">{error}</p>}
      {aviso && <p className="mt-4 rounded-xl bg-marca-claro p-3 text-sm text-marca" role="status">{aviso}</p>}
      <button className="btn-primario mt-4" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar horario'}</button>
    </>
  )
}
