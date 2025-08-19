// Corte "mañana" 06:00–12:59, "tarde" 13:00–23:59
export function getCorte(now = new Date()) {
  const h = now.getHours()
  if (h >= 6 && h <= 12) {
    return { label: 'AM', canonical: '06:30', inWindow: true }
  }
  if (h >= 13 && h <= 23) {
    return { label: 'PM', canonical: '14:30', inWindow: true }
  }
  return { label: null, canonical: null, inWindow: false }
}

// Mantengo computeNovelties como estaba
export function computeNovelties({ OF_effective, SO_effective, PT_effective, OF_available, SO_available, PT_available }) {
  const clamp = (x) => Math.max(x, 0)
  return {
    OF_nov: clamp(OF_effective - OF_available),
    SO_nov: clamp(SO_effective - SO_available),
    PT_nov: clamp(PT_effective - PT_available)
  }
}
