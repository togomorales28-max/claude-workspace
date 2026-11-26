const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export { DIAS, DIAS_CORTOS }

function partes(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()
  return { a, m, d, dia }
}

// 'jueves 26 de noviembre'
export function fechaLarga(fecha) {
  const { m, d, dia } = partes(fecha)
  return `${DIAS[dia]} ${d} de ${MESES[m - 1]}`
}

// Primera letra en mayúscula ('Jueves 26 de noviembre'), sin tocar el resto.
export const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

export function fechaCorta(fecha) {
  const { m, d, dia } = partes(fecha)
  return { dia: DIAS_CORTOS[dia], numero: d, mes: MESES_CORTOS[m - 1] }
}

// '14:30:00' → '2:30 pm' (formato de 12 horas, como se usa en México)
export function hora12(hora) {
  const [h, m] = String(hora).split(':').map(Number)
  const sufijo = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

// NULL = sin precio fijo.
export function precio(valor) {
  if (valor === null || valor === undefined) return 'Precio a consultar'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor)
}

export function duracion(minutos) {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
