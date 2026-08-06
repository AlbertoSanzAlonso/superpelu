import { schedule } from '@server/config.js'
import { todaySalon } from '@/lib/core/dates'

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  return !Number.isNaN(new Date(y, m - 1, d).getTime())
}

function nowSalonMinutesFromSchedule(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: schedule.timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/**
 * Quita horas ya pasadas del día en curso.
 * Reserva pública: exige al menos un slot (30 min) de antelación.
 * Agenda staff/admin: no filtra (libertad total al citar).
 */
export function filterPastSlotsForToday(
  date: string,
  slots: string[],
  options?: { forStaffPortal?: boolean },
): string[] {
  if (options?.forStaffPortal) return slots
  if (date !== todaySalon()) return slots
  const now = nowSalonMinutesFromSchedule()
  const minStart = now + schedule.slotMinutes
  return slots.filter((slot) => timeToMinutes(slot) >= minStart)
}
