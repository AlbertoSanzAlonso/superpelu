import {
  getColorWashReplacementIndex,
  getOccupiedSegmentsForChainService,
  type BookingServiceWithCategory,
} from '@/lib/booking/colorCombo'
import { getWashPhaseStartMinutes, type OccupiedSegment } from '@/lib/booking/occupancy'

export type { BookingServiceLine } from '@/lib/booking/colorCombo'

/** Tramos ocupados encadenando varios servicios en el mismo hueco (misma visita). */
export function getChainedBookingSegments(
  services: readonly BookingServiceWithCategory[],
  startMinutes: number,
  overrides: ReadonlyArray<number | undefined> = [],
): OccupiedSegment[] {
  const startTimes = buildChainStartMinutes(services, startMinutes, overrides)
  const all: OccupiedSegment[] = []
  for (let i = 0; i < services.length; i++) {
    all.push(...getOccupiedSegmentsForChainService(services, i, startTimes[i]))
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
function endMinutesAfterChainService(
  services: readonly BookingServiceWithCategory[],
  serviceIndex: number,
  startMinutes: number,
): number {
  const segments = getOccupiedSegmentsForChainService(services, serviceIndex, startMinutes)
  return Math.max(...segments.map((segment) => segment.startMinutes + segment.durationMinutes))
}

function buildChainStartMinutes(
  services: readonly BookingServiceWithCategory[],
  visitStartMinutes: number,
  overrides: ReadonlyArray<number | undefined>,
): number[] {
  const replacementIndex = getColorWashReplacementIndex(services)
  const starts: number[] = []

  for (let i = 0; i < services.length; i++) {
    let start: number

    if (overrides[i] !== undefined) {
      start = overrides[i]!
    } else if (i === 0) {
      start = visitStartMinutes
    } else if (replacementIndex != null && i === replacementIndex) {
      // Sustituye el aclarado: misma hora en que iría el lavado (30 min aplicación + 30 min pausa).
      start = getWashPhaseStartMinutes(starts[replacementIndex - 1]!)
    } else {
      // Encadenar justo al terminar el tratamiento anterior (sin saltar a huecos libres del día).
      start = endMinutesAfterChainService(services, i - 1, starts[i - 1]!)
    }

    starts.push(start)
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

/**
 * Hora mínima editable de cada tratamiento: encadena desde la visita y los
 * aplazamientos de los demás, pero ignora el override del propio índice.
 * Así, un peinado fijado a las 15:00 sigue pudiendo atrasarse a las 12:00
 * si el anterior termina antes.
 */
export function buildEarliestEditableServiceStartTimes(
  services: readonly BookingServiceWithCategory[],
  visitStartTime: string,
  overrides: ReadonlyArray<string | undefined> = [],
): string[] {
  return services.map((_, index) => {
    const cleared = overrides.map((override, j) => (j === index ? undefined : override))
    return buildFlexibleServiceStartTimes(services, visitStartTime, cleared)[index]!
  })
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
