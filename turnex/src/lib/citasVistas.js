// Marca "Nueva" en las citas que el barbero todavía no ha visto.
// Se guarda en localStorage por barbero: es solo una ayuda visual.
const clave = (userId) => `turnex-citas-vistas-${userId}`

export function citasVistas(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(clave(userId)) || '[]')) } catch { return new Set() }
}

export function marcarVistas(userId, ids) {
  try {
    const set = citasVistas(userId)
    ids.forEach((id) => set.add(id))
    // Se guardan solo las últimas 500 para no crecer sin límite.
    localStorage.setItem(clave(userId), JSON.stringify([...set].slice(-500)))
  } catch { /* sin almacenamiento disponible: no pasa nada */ }
}
