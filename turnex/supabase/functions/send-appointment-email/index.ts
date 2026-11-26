// Edge Function: send-appointment-email
// Envía con Resend:
//   { job: 'booked', appointment_id }  → confirmación al cliente (si dejó correo) y aviso al barbero.
//   { job: 'pendientes' }              → lo que llama pg_cron cada 15 min: reintenta avisos de
//                                         citas nuevas que no salieron y manda recordatorios
//                                         ~24 h antes.
// Secretos: RESEND_API_KEY (obligatorio), RESEND_FROM y APP_URL (recomendados).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('RESEND_FROM') ?? 'Turnex <onboarding@resend.dev>'
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
const BLOQUEO_MIN = 10 // un envío "reclamado" se considera abandonado tras 10 min

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))
  try {
    if (!RESEND_API_KEY) throw new Error('Falta el secreto RESEND_API_KEY')
    let resultado
    if (body.job === 'booked' && typeof body.appointment_id === 'string') {
      resultado = { agendadas: [await procesarAgendada(body.appointment_id)] }
    } else if (body.job === 'pendientes' || body.job === 'reminders') {
      resultado = { agendadas: await reintentarAgendadas(), recordatorios: await procesarRecordatorios() }
    } else {
      return json({ error: 'job no válido' }, 400)
    }
    return json(resultado)
  } catch (e) {
    console.error(e)
    return json({ error: String(e?.message ?? e) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const haceMinutos = (m: number) => new Date(Date.now() - m * 60000).toISOString()

// ---------- Citas nuevas ----------

async function procesarAgendada(id: string) {
  // Reclamo atómico: solo un proceso a la vez puede enviar el aviso de esta cita.
  const { data: filas } = await supabase.from('appointments')
    .update({ booked_claimed_at: new Date().toISOString() })
    .eq('id', id).is('booked_email_sent_at', null)
    .or(`booked_claimed_at.is.null,booked_claimed_at.lt.${haceMinutos(BLOQUEO_MIN)}`)
    .select('*')
  const cita = filas?.[0]
  if (!cita) return { id, estado: 'ya enviado o en proceso' }

  const perfil = await perfilDe(cita.user_id)
  const correoBarbero = await correoDe(cita.user_id)
  const envios: boolean[] = []
  if (cita.customer_email) envios.push(await enviar(cita.customer_email, `Cita confirmada en ${perfil.name}`, htmlCliente(cita, perfil, 'confirmada')))
  if (correoBarbero) envios.push(await enviar(correoBarbero, `Nueva cita: ${cita.customer_name}, ${fechaLarga(cita.appointment_date)} ${hora12(cita.start_time)}`, htmlBarbero(cita)))

  // _sent_at solo se llena si Resend confirmó al menos un envío; si todo falló
  // se libera el reclamo para que el cron lo reintente.
  if (envios.some(Boolean) || envios.length === 0) {
    await supabase.from('appointments').update({ booked_email_sent_at: new Date().toISOString() }).eq('id', id)
    return { id, estado: 'enviado' }
  }
  await supabase.from('appointments').update({ booked_claimed_at: null }).eq('id', id)
  return { id, estado: 'falló, se reintentará' }
}

async function reintentarAgendadas() {
  const { data } = await supabase.from('appointments').select('id')
    .is('booked_email_sent_at', null).eq('status', 'confirmed')
    .gte('created_at', haceMinutos(48 * 60)).lt('created_at', haceMinutos(2))
    .limit(50)
  const res = []
  for (const f of data ?? []) res.push(await procesarAgendada(f.id))
  return res
}

// ---------- Recordatorios ----------

async function procesarRecordatorios() {
  const enDosDias = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const { data: candidatas } = await supabase.from('appointments')
    .select('id, user_id, appointment_date, start_time')
    .eq('status', 'confirmed').is('reminder_email_sent_at', null).not('customer_email', 'is', null)
    .gte('appointment_date', ayer).lte('appointment_date', enDosDias)
    .limit(200)

  const zonas = new Map<string, string>()
  const res = []
  for (const c of candidatas ?? []) {
    if (!zonas.has(c.user_id)) zonas.set(c.user_id, (await perfilDe(c.user_id)).timezone)
    const inicio = instanteEnZona(c.appointment_date, c.start_time, zonas.get(c.user_id)!)
    const faltan = inicio - Date.now()
    // Se manda cuando faltan 24 h o menos (y la cita no ha empezado).
    if (faltan <= 0 || faltan > 24 * 3600000) continue

    const { data: filas } = await supabase.from('appointments')
      .update({ reminder_claimed_at: new Date().toISOString() })
      .eq('id', c.id).is('reminder_email_sent_at', null)
      .or(`reminder_claimed_at.is.null,reminder_claimed_at.lt.${haceMinutos(BLOQUEO_MIN)}`)
      .select('*')
    const cita = filas?.[0]
    if (!cita) continue
    const perfil = await perfilDe(cita.user_id)
    const ok = await enviar(cita.customer_email, `Recordatorio: tu cita en ${perfil.name} es ${esHoy(cita, perfil.timezone) ? 'hoy' : 'mañana'}`, htmlCliente(cita, perfil, 'recordatorio'))
    await supabase.from('appointments').update(ok ? { reminder_email_sent_at: new Date().toISOString() } : { reminder_claimed_at: null }).eq('id', cita.id)
    res.push({ id: cita.id, estado: ok ? 'enviado' : 'falló, se reintentará' })
  }
  return res
}

// ---------- Utilidades ----------

const perfiles = new Map<string, { name: string; slug: string; timezone: string }>()
async function perfilDe(userId: string) {
  if (!perfiles.has(userId)) {
    const { data } = await supabase.from('profiles').select('name, slug, timezone').eq('user_id', userId).single()
    perfiles.set(userId, data ?? { name: 'tu barbería', slug: '', timezone: 'America/Hermosillo' })
  }
  return perfiles.get(userId)!
}

async function correoDe(userId: string) {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

async function enviar(to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!r.ok) console.error('Resend', r.status, await r.text())
  return r.ok
}

// Convierte fecha y hora locales de una zona a un instante (ms UTC).
function instanteEnZona(fecha: string, hora: string, zona: string) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, mi] = hora.split(':').map(Number)
  const supuesto = Date.UTC(a, m - 1, d, h, mi)
  const desfase = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t
  }
  return supuesto - desfase(supuesto - desfase(supuesto))
}

function esHoy(cita: { appointment_date: string }, zona: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date()) === cita.appointment_date
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fechaLarga(f: string) {
  const [a, m, d] = f.split('-').map(Number)
  return `${DIAS[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]} ${d} de ${MESES[m - 1]}`
}
function hora12(h: string) {
  const [hh, mm] = h.split(':').map(Number)
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function marco(contenido: string) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14171C">${contenido}
  <p style="margin-top:32px;font-size:12px;color:#5A6270">Reservas con Turnex</p></div>`
}

function htmlCliente(c: any, perfil: { name: string; slug: string }, tipo: 'confirmada' | 'recordatorio') {
  const enlace = APP_URL ? `${APP_URL}/cita/${c.cancel_token}` : ''
  return marco(`
    <h1 style="font-size:22px">${tipo === 'confirmada' ? '¡Tu cita está confirmada!' : 'Te esperamos pronto'}</h1>
    <p>Hola ${esc(c.customer_name)}, ${tipo === 'confirmada' ? 'reservaste' : 'te recordamos tu cita en'} <b>${esc(perfil.name)}</b>:</p>
    <div style="background:#E3F1EE;border-radius:14px;padding:16px;margin:16px 0">
      <b>${esc(c.service_name)}</b><br>${fechaLarga(c.appointment_date)}<br>
      <span style="font-size:18px">${hora12(c.start_time)} – ${hora12(c.end_time)}</span>
    </div>
    ${enlace ? `<p><a href="${enlace}" style="color:#0F5C52;font-weight:600">Ver o cancelar mi cita</a></p>` : ''}`)
}

function htmlBarbero(c: any) {
  return marco(`
    <h1 style="font-size:22px">Nueva cita</h1>
    <div style="background:#F5F6F7;border-radius:14px;padding:16px;margin:16px 0">
      <b>${esc(c.customer_name)}</b> · ${esc(c.customer_phone)}<br>
      ${esc(c.service_name)}<br>${fechaLarga(c.appointment_date)}, ${hora12(c.start_time)} – ${hora12(c.end_time)}
      ${c.notes ? `<br><i>“${esc(c.notes)}”</i>` : ''}
    </div>
    ${APP_URL ? `<p><a href="${APP_URL}/dashboard" style="color:#0F5C52;font-weight:600">Abrir mi agenda</a></p>` : ''}`)
}
