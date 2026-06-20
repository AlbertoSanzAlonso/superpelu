import {
  getColorWashReplacementIndex,
  getOccupiedSegmentsForChainService,
  type BookingServiceWithCategory,
} from '@/lib/booking/colorCombo'
import {
  COLOR_SPLIT_SEGMENT_MINUTES,
  getBookingSpanMinutes,
  getOccupiedSegmentsForBooking,
  type OccupiedSegment,
} from '@/lib/booking/occupancy'

export type { BookingServiceLine } from '@/lib/booking/colorCombo'

/** Tramos ocupados encadenando varios servicios en el mismo hueco (misma visita). */
export function getChainedBookingSegments(
  services: readonly BookingServiceWithCategory[],
  startMinutes: number,
): OccupiedSegment[] {
  const replacementIndex = getColorWashReplacementIndex(services)

  if (replacementIndex != null) {
    const startTimes = buildChainStartMinutes(services, startMinutes, [])
    const all: OccupiedSegment[] = []
    for (let i = 0; i < services.length; i++) {
      all.push(...getOccupiedSegmentsForChainService(services, i, startTimes[i]))
    }
    return all
  }

  let cursor = startMinutes
  const all: OccupiedSegment[] = []

  for (const service of services) {
    const segments = getOccupiedSegmentsForBooking(
      service.id,
      cursor,
      service.durationMinutes,
    )
    all.push(...segments)
    cursor = Math.max(...segments.map((segment) => segment.startMinutes + segment.durationMinutes))
  }

  return all
}

export function getChainedBookingSpanMinutes(services: readonly BookingServiceWithCategory[]): number {
  if (services.length === 0) return 0
  const segments = getChainedBookingSegments(services, 0)
  return Math.max(...segments.map((segment) => segment.startMinutes + segment.durationMinutes))
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
  services: readonly BookingServiceWithCategory[],
  startTime: string,
): string[] {
  return buildFlexibleServiceStartTimes(services, startTime, [])
}

/**
 * Horas de inicio por tratamiento: encadenado desde `visitStartTime`, con aplazamientos
 * puntuales en `overrides[i]` (el resto sigue en cadena desde el anterior).
 */
function buildChainStartMinutes(
  services: readonly BookingServiceWithCategory[],
  visitStartMinutes: number,
  overrides: ReadonlyArray<number | undefined>,
): number[] {
  const replacementIndex = getColorWashReplacementIndex(services)
  const starts: number[] = []
  let cursor = visitStartMinutes

  for (let i = 0; i < services.length; i++) {
    const override = overrides[i]
    if (override !== undefined) {
      cursor = override
    }

    if (replacementIndex != null && i === replacementIndex) {
      // Si el siguiente servicio reemplaza el lavado, empieza justo al terminar el color (30 min).
      cursor = starts[replacementIndex - 1]! + COLOR_SPLIT_SEGMENT_MINUTES
    }

    starts.push(cursor)

    if (replacementIndex != null) {
      const colorIndex = replacementIndex - 1
      if (i < colorIndex) {
        cursor += services[i].durationMinutes
      } else if (i === colorIndex) {
        // El servicio que reemplaza el lavado arranca justo al terminar el tramo de color.
      } else if (i === replacementIndex) {
        cursor += services[i].durationMinutes
      } else if (i > replacementIndex) {
        cursor += services[i].durationMinutes
      }
    } else {
      cursor += getBookingSpanMinutes(services[i].id, services[i].durationMinutes)
    }
  }

  return starts
}

export function buildFlexibleServiceStartTimes(
  services: readonly BookingServiceWithCategory[],
  visitStartTime: string,
  overrides: ReadonlyArray<string | undefined> = [],
): string[] {
  const numericOverrides = overrides.map((override) =>
    override !== undefined && override !== '' ? timeToMinutes(override) : undefined,
  )
  return buildChainStartMinutes(services, timeToMinutes(visitStartTime), numericOverrides).map(
    minutesToTime,
  )
}

export function formatChainedAppointmentTimeRange(
  services: readonly BookingServiceWithCategory[],
  startTime: string,
  locale: 'es' | 'en' = 'es',
): string {
  if (services.length === 0) return startTime
  const endMinutes =
    timeToMinutes(startTime) + getChainedBookingSpanMinutes(services)
  const connector = locale === 'en' ? ' to ' : ' a '
  return `${startTime}${connector}${minutesToTime(endMinutes)}`
}
