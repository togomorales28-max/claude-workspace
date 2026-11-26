export function soloDigitos(tel) {
  return String(tel || '').replace(/\D/g, '')
}

// Enlace de WhatsApp. Un número de 10 dígitos se toma como mexicano (+52).
export function enlaceWhatsApp(tel, texto = '') {
  let d = soloDigitos(tel)
  if (d.length === 10) d = '52' + d
  if (d.length < 10) return null
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

export function telefonoValido(tel) {
  return soloDigitos(tel).length >= 10
}
