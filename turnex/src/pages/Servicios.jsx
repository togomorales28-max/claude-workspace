import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { Cargando } from '../components/ProtectedRoute.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, mensajeError } from '../lib/supabase'
import { duracion, precio } from '../lib/formato'

const DURACIONES = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180]
const VACIO = { id: null, name: '', duration_minutes: 30, price: '' }

export default function Servicios() {
  const { usuario } = useAuth()
  const [servicios, setServicios] = useState(null)
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data, error } = await supabase.from('services').select('*').order('sort').order('created_at')
    if (error) setError(mensajeError(error))
    setServicios(data || [])
  }
  useEffect(() => { cargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    const nombre = editando.name.trim()
    if (!nombre) return setError('Escribe el nombre del servicio.')
    // Precio vacío o 0 = sin precio fijo (NULL), nunca se guarda 0.
    const p = editando.price === '' ? null : Number(editando.price)
    if (p !== null && (Number.isNaN(p) || p < 0)) return setError('El precio no es válido.')
    const fila = { name: nombre, duration_minutes: Number(editando.duration_minutes), price: p > 0 ? p : null }
    setGuardando(true); setError('')
    const res = editando.id
      ? await supabase.from('services').update(fila).eq('id', editando.id)
      : await supabase.from('services').insert({ ...fila, user_id: usuario.id, sort: (servicios?.length || 0) + 1 })
    setGuardando(false)
    if (res.error) return setError(mensajeError(res.error))
    setEditando(null)
    cargar()
  }

  async function alternar(s) {
    const { error } = await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    if (error) return setError(mensajeError(error))
    cargar()
  }

  async function borrar(s) {
    setBorrando(null)
    // Las citas guardan una copia del nombre, así que borrar el servicio no las afecta.
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) return setError(mensajeError(error))
    cargar()
  }

  const formulario = (
    <form onSubmit={guardar} className="tarjeta grid gap-4 border-marca p-4 sm:grid-cols-[1fr_160px_160px]">
      <div>
        <label htmlFor="s-nombre" className="etiqueta">Servicio</label>
        <input id="s-nombre" autoFocus maxLength={80} className="campo" placeholder="Ej.: Corte con diseño" value={editando?.name || ''} onChange={(e) => setEditando({ ...editando, name: e.target.value })} />
      </div>
      <div>
        <label htmlFor="s-duracion" className="etiqueta">Duración</label>
        <select id="s-duracion" className="campo" value={editando?.duration_minutes} onChange={(e) => setEditando({ ...editando, duration_minutes: e.target.value })}>
          {DURACIONES.map((d) => <option key={d} value={d}>{duracion(d)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="s-precio" className="etiqueta">Precio (opcional)</label>
        <input id="s-precio" type="number" inputMode="decimal" min="0" step="1" className="campo" placeholder="Sin precio fijo" value={editando?.price ?? ''} onChange={(e) => setEditando({ ...editando, price: e.target.value })} />
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <button className="btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn-secundario" onClick={() => { setEditando(null); setError('') }}>Cancelar</button>
      </div>
    </form>
  )

  return (
    <>
      <PageHeader titulo="Servicios" descripcion="Lo que tus clientes pueden reservar. Los ocultos no aparecen en tu página."
        accion={!editando && <button className="btn-primario" onClick={() => setEditando({ ...VACIO })}><Plus size={16} /> Añadir servicio</button>} />
      {error && <p className="mb-4 rounded-xl bg-alerta-claro p-3 text-sm text-alerta" role="alert">{error}</p>}
      {editando && !editando.id && <div className="mb-3">{formulario}</div>}
      {servicios === null ? <Cargando /> : servicios.length === 0 && !editando ? (
        <div className="tarjeta p-8 text-center text-sm text-tinta-suave">Aún no tienes servicios. Añade el primero.</div>
      ) : (
        <ul className="space-y-3">
          {servicios.map((s) => editando?.id === s.id ? <li key={s.id}>{formulario}</li> : (
            <li key={s.id} className={`tarjeta flex flex-wrap items-center gap-3 p-4 ${s.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{s.name}{!s.active && <span className="ml-2 text-xs font-normal text-tinta-suave">(oculto)</span>}</p>
                <p className="font-mono text-sm text-tinta-suave">{duracion(s.duration_minutes)} · {precio(s.price)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {borrando === s.id ? (
                  <>
                    <button className="btn-peligro btn-sm" onClick={() => borrar(s)}>Sí, eliminar</button>
                    <button className="btn-secundario btn-sm" onClick={() => setBorrando(null)}>No</button>
                  </>
                ) : (
                  <>
                    <button className="btn-secundario btn-sm" onClick={() => setEditando({ ...s, price: s.price ?? '' })}><Pencil size={14} /> Editar</button>
                    <button className="btn-secundario btn-sm" onClick={() => alternar(s)}>{s.active ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Mostrar</>}</button>
                    <button className="btn-secundario btn-sm" onClick={() => setBorrando(s.id)} aria-label={`Eliminar ${s.name}`}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
