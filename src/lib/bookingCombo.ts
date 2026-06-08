import {
  getBookingSpanMinutes,
  getOccupiedSegmentsForBooking,
  type OccupiedSegment,
} from '@/lib/bookingOccupancy'

export type BookingServiceLine = {
  id: string
  durationMinutes: number
}

/** Tramos ocupados encadenando varios servicios en el mismo hueco (misma visita). */
export function getChainedBookingSegments(
  services: readonly BookingServiceLine[],
  startMinutes: number,
): OccupiedSegment[] {
  let cursor = startMinutes
  const all: OccupiedSegment[] = []

  for (const service of services) {
    const segments = getOccupiedSegmentsForBooking(
      service.id,
      cursor,
      service.durationMinutes,
    )
    all.push(...segments)
    cursor = Math.max(...segments.map((s) => s.startMinutes + s.durationMinutes))
  }

  return all
}

export function getChainedBookingSpanMinutes(services: readonly BookingServiceLine[]): number {
  if (services.length === 0) return 0
  const segments = getChainedBookingSegments(services, 0)
  return Math.max(...segments.map((s) => s.startMinutes + s.durationMinutes))
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Hora de inicio de cada servicio al encadenarlos desde `startTime`. */
export function getChainedServiceStartTimes(
  services: readonly BookingServiceLine[],
  startTime: string,
): string[] {
  return buildFlexibleServiceStartTimes(services, startTime, [])
}

/**
 * Horas de inicio por tratamiento: encadenado desde `visitStartTime`, con aplazamientos
 * puntuales en `overrides[i]` (el resto sigue en cadena desde el anterior).
 */
export function buildFlexibleServiceStartTimes(
  services: readonly BookingServiceLine[],
  visitStartTime: string,
  overrides: ReadonlyArray<string | undefined> = [],
): string[] {
  const times: string[] = []
  let cursor = timeToMinutes(visitStartTime)

  for (let i = 0; i < services.length; i++) {
    const override = overrides[i]
    if (override !== undefined) {
      cursor = timeToMinutes(override)
    }
    times.push(minutesToTime(cursor))
    cursor += getBookingSpanMinutes(services[i].id, services[i].durationMinutes)
  }

  return times
}

export function formatChainedAppointmentTimeRange(
  services: readonly BookingServiceLine[],
  startTime: string,
  locale: 'es' | 'en' = 'es',
): string {
  if (services.length === 0) return startTime
  const endMinutes =
    timeToMinutes(startTime) + getChainedBookingSpanMinutes(services)
  const connector = locale === 'en' ? ' to ' : ' a '
  return `${startTime}${connector}${minutesToTime(endMinutes)}`
}
