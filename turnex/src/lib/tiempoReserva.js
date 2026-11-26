// Cálculos de fecha y hora en la zona del barbero, con Intl y sin librerías.
// Las fechas se manejan como texto 'YYYY-MM-DD' y las horas como minutos desde
// medianoche, así nunca interviene la zona horaria del navegador del cliente.

export function ahoraEnZona(zona) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return { fecha: `${v.year}-${v.month}-${v.day}`, minutos: Number(v.hour) * 60 + Number(v.minute) }
}

export function aMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number)
  return h * 60 + (m || 0)
}

export function aHora(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

// Se usa mediodía UTC para que sumar días nunca cruce un cambio de horario.
const aFechaUTC = (fecha) => new Date(`${fecha}T12:00:00Z`)
const deFechaUTC = (d) => d.toISOString().slice(0, 10)

export function sumarDias(fecha, n) {
  const d = aFechaUTC(fecha)
  d.setUTCDate(d.getUTCDate() + n)
  return deFechaUTC(d)
}

export function diaSemana(fecha) {
  return aFechaUTC(fecha).getUTCDay() // 0 = domingo, igual que business_hours
}

export function diasEntre(desde, hasta) {
  return Math.round((aFechaUTC(hasta) - aFechaUTC(desde)) / 86400000)
}

// Horas de inicio disponibles para un servicio en una fecha.
// tramos: [{start_time, end_time}] del día; ocupadas: [{start_time, end_time}].
export function horasDisponibles({ fecha, tramos, duracion, ocupadas, zona, anticipacionMin }) {
  const ahora = ahoraEnZona(zona)
  const diasDesdeHoy = diasEntre(ahora.fecha, fecha)
  if (diasDesdeHoy < 0) return []
  // Minutos "absolutos" desde la medianoche de hoy, para que la anticipación
  // mínima funcione aunque abarque varios días.
  const minimo = ahora.minutos + anticipacionMin - diasDesdeHoy * 1440
  const bloqueos = ocupadas.map((o) => [aMinutos(o.start_time), aMinutos(o.end_time)])

  // Pasos de 30 min si todo cuadra en medias horas; si no, de 15.
  const cuadra = duracion % 30 === 0 && tramos.every((t) => aMinutos(t.start_time) % 30 === 0)
  const paso = cuadra ? 30 : 15

  const horas = []
  for (const t of tramos) {
    const ini = aMinutos(t.start_time)
    const fin = aMinutos(t.end_time)
    for (let m = ini; m + duracion <= fin; m += paso) {
      if (m < minimo) continue
      const choca = bloqueos.some(([a, b]) => m < b && m + duracion > a)
      if (!choca) horas.push(aHora(m))
    }
  }
  return [...new Set(horas)].sort()
}
