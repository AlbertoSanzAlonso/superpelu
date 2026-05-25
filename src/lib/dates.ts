/** Fecha local YYYY-MM-DD */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Próximos N días laborables del salón (mar–sáb) */
export function getBookableDates(count = 28): string[] {
  const openDays = new Set([2, 3, 4, 5, 6])
  const dates: string[] = []
  let cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (dates.length < count) {
    if (openDays.has(cursor.getDay())) {
      dates.push(toDateString(cursor))
    }
    cursor = addDays(cursor, 1)
    if (dates.length === 0 && cursor.getTime() - Date.now() > 90 * 24 * 60 * 60 * 1000) break
  }

  return dates
}

export function formatTimeRange(start: string, durationMinutes: number): string {
  const [h, m] = start.split(':').map(Number)
  const endMinutes = h * 60 + m + durationMinutes
  const endH = Math.floor(endMinutes / 60)
  const endM = endMinutes % 60
  const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  return `${start} – ${end}`
}
