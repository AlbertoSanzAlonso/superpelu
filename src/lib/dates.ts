import { salonSchedule } from '@/data/schedule'

/** Comprueba que una cadena sea YYYY-MM-DD y una fecha de calendario válida */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** Fecha local YYYY-MM-DD a partir de un Date */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Hoy según la zona horaria del salón (Benalmádena) */
export function todaySalon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: salonSchedule.timezone,
  }).format(new Date())
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(y, m - 1, d)
  next.setDate(next.getDate() + days)
  return toDateString(next)
}

/** Día de la semana (0–6) para una fecha YYYY-MM-DD */
export function dayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function isSalonOpenDay(dateStr: string): boolean {
  return (salonSchedule.openDays as readonly number[]).includes(dayOfWeekFromDateString(dateStr))
}

export function isWithinSalonBookingWindow(dateStr: string): boolean {
  const today = todaySalon()
  const maxDate = addDaysToDateString(today, salonSchedule.maxDaysAhead)
  return dateStr >= today && dateStr <= maxDate
}

/** Minutos desde medianoche en la zona horaria del salón */
export function nowSalonMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: salonSchedule.timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/**
 * "Ahora" como reloj de pared del salón (Madrid), en ms tratados como UTC.
 * Sirve para medir horas hasta una cita comparando hora local con hora local,
 * evitando matemática de offset/DST (error máx ±1h el día del cambio de hora).
 */
export function salonNowWallMs(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: salonSchedule.timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const hour = get('hour') % 24
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
}

/** Horas que faltan hasta una cita (fecha YYYY-MM-DD + hora HH:mm, hora del salón). */
export function hoursUntilAppointment(dateStr: string, startTime: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = startTime.split(':').map(Number)
  const aptMs = Date.UTC(y, m - 1, d, hh, mm)
  return (aptMs - salonNowWallMs()) / 3_600_000
}

export function formatDisplayDate(dateStr: string, locale: 'es' | 'en' = 'es'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', {
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
export function getBookableDates(count = 35): string[] {
  const dates: string[] = []
  let cursor = todaySalon()
  const lastDate = addDaysToDateString(cursor, salonSchedule.maxDaysAhead)

  while (dates.length < count && cursor <= lastDate) {
    if ((salonSchedule.openDays as readonly number[]).includes(dayOfWeekFromDateString(cursor))) {
      dates.push(cursor)
    }
    cursor = addDaysToDateString(cursor, 1)
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
