import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Check } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, mensajeError } from '../lib/supabase'

const limpiarSlug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40)

export default function EnlacePublico() {
  const { usuario, perfil, recargarPerfil } = useAuth()
  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [copiado, setCopiado] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (perfil) { setNombre(perfil.name); setSlug(perfil.slug) } }, [perfil])

  const url = perfil ? `${window.location.origin}/barbero/${perfil.slug}` : ''
  const boton = `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#0F5C52;color:#fff;font:600 16px system-ui,sans-serif;text-decoration:none">Reservar cita</a>`

  async function copiar(texto, cual) {
    try { await navigator.clipboard.writeText(texto); setCopiado(cual); setTimeout(() => setCopiado(''), 2000) }
    catch { setError('No se pudo copiar. Selecciona el texto y cópialo a mano.') }
  }

  async function guardar(e) {
    e.preventDefault()
    const nuevo = slug.replace(/-+$/, '')
    if (nombre.trim().length < 2) return setError('Escribe el nombre de tu barbería.')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nuevo) || nuevo.length < 3) return setError('El enlace debe tener al menos 3 letras o números, sin espacios.')
    setGuardando(true); setError(''); setAviso('')
    const { error } = await supabase.from('profiles').update({ name: nombre.trim(), slug: nuevo }).eq('user_id', usuario.id)
    setGuardando(false)
    if (error) return setError(error.code === '23505' ? 'Ese enlace ya lo usa otra barbería. Prueba con otro.' : mensajeError(error))
    setAviso(nuevo !== perfil.slug ? 'Guardado. Ojo: el enlace anterior ya no funciona, actualízalo donde lo hayas puesto.' : 'Guardado.')
    recargarPerfil()
  }

  if (!perfil) return null

  return (
    <>
      <PageHeader titulo="Mi enlace" descripcion="Ponlo en tu web, Instagram, WhatsApp o Google. Tus clientes entran directo a reservar contigo, sin crear cuenta." />

      <section className="tarjeta p-5">
        <p className="etiqueta">Tu página de reservas</p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="campo min-w-0 flex-1 bg-fondo font-mono text-sm" aria-label="Tu enlace" />
          <button className="btn-primario" onClick={() => copiar(url, 'url')}>{copiado === 'url' ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}</button>
          <a className="btn-secundario" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Abrir</a>
        </div>
      </section>

      <section className="tarjeta mt-4 p-5">
        <p className="etiqueta">Botón para tu página web</p>
        <p className="mb-3 text-sm text-tinta-suave">Copia este código y pégalo en tu web (en un bloque de “HTML” o “código”).</p>
        <div className="mb-3 rounded-xl border border-dashed border-tinta-linea p-4">
          <span className="inline-block rounded-full bg-marca px-6 py-3 font-semibold text-white">Reservar cita</span>
        </div>
        <textarea readOnly rows={3} value={boton} onFocus={(e) => e.target.select()} className="campo bg-fondo font-mono text-xs" aria-label="Código HTML del botón" />
        <button className="btn-secundario mt-2" onClick={() => copiar(boton, 'html')}>{copiado === 'html' ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar código</>}</button>
      </section>

      <form onSubmit={guardar} className="tarjeta mt-4 grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className="etiqueta">Nombre que ven tus clientes</label>
          <input id="nombre" maxLength={80} className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label htmlFor="slug" className="etiqueta">Personaliza tu enlace</label>
          <div className="flex items-center rounded-xl border border-tinta-linea bg-white focus-within:border-marca">
            <span className="whitespace-nowrap pl-3.5 font-mono text-sm text-tinta-suave">/barbero/</span>
            <input id="slug" className="w-full min-w-0 rounded-xl bg-transparent px-1 py-2.5 font-mono text-base outline-none" value={slug} onChange={(e) => setSlug(limpiarSlug(e.target.value))} />
          </div>
        </div>
        {error && <p className="rounded-xl bg-alerta-claro p-3 text-sm text-alerta sm:col-span-2" role="alert">{error}</p>}
        {aviso && <p className="rounded-xl bg-marca-claro p-3 text-sm text-marca sm:col-span-2" role="status">{aviso}</p>}
        <div className="sm:col-span-2"><button className="btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </>
  )
}
