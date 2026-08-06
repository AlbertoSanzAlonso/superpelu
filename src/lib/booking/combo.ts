import {
  findColorIndexReplacedByService,
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
  staffAssignments?: readonly (string | null | undefined)[],
): OccupiedSegment[] {
  const startTimes = buildChainStartMinutes(services, startMinutes, overrides, staffAssignments)
  const all: OccupiedSegment[] = []
  for (let i = 0; i < services.length; i++) {
    all.push(
      ...getOccupiedSegmentsForChainService(services, i, startTimes[i], staffAssignments),
    )
  }
  return all
}

export function getChainedBookingSpanMinutes(
  services: readonly BookingServiceWithCategory[],
  staffAssignments?: readonly (string | null | undefined)[],
): number {
  if (services.length === 0) return 0
  const segments = getChainedBookingSegments(services, 0, [], staffAssignments)
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
  staffAssignments?: readonly (string | null | undefined)[],
): string[] {
  return buildFlexibleServiceStartTimes(services, startTime, [], staffAssignments)
}

/**
 * Horas de inicio por tratamiento: encadenado desde `visitStartTime`, con aplazamientos
 * puntuales en `overrides[i]` (el resto sigue en cadena desde el anterior).
 */
function endMinutesAfterChainService(
  services: readonly BookingServiceWithCategory[],
  serviceIndex: number,
  startMinutes: number,
  staffAssignments?: readonly (string | null | undefined)[],
): number {
  const segments = getOccupiedSegmentsForChainService(
    services,
    serviceIndex,
    startMinutes,
    staffAssignments,
  )
  return Math.max(...segments.map((segment) => segment.startMinutes + segment.durationMinutes))
}

function buildChainStartMinutes(
  services: readonly BookingServiceWithCategory[],
  visitStartMinutes: number,
  overrides: ReadonlyArray<number | undefined>,
  staffAssignments?: readonly (string | null | undefined)[],
): number[] {
  const starts: number[] = []

  for (let i = 0; i < services.length; i++) {
    let start: number

    if (overrides[i] !== undefined) {
      start = overrides[i]!
    } else if (i === 0) {
      start = visitStartMinutes
    } else {
      const replacedColorIdx = findColorIndexReplacedByService(services, i, staffAssignments)
      if (replacedColorIdx != null) {
        // Sustituye el aclarado de esa coloración (mismo profesional).
        start = getWashPhaseStartMinutes(starts[replacedColorIdx]!)
      } else {
        // Encadenar justo al terminar el tratamiento anterior.
        start = endMinutesAfterChainService(services, i - 1, starts[i - 1]!, staffAssignments)
      }
    }

    starts.push(start)
  }

  return starts
}

export function buildFlexibleServiceStartTimes(
  services: readonly BookingServiceWithCategory[],
  visitStartTime: string,
  overrides: ReadonlyArray<string | undefined> = [],
  staffAssignments?: readonly (string | null | undefined)[],
): string[] {
  const numericOverrides = overrides.map((override) =>
    override !== undefined && override !== '' ? timeToMinutes(override) : undefined,
  )
  return buildChainStartMinutes(
    services,
    timeToMinutes(visitStartTime),
    numericOverrides,
    staffAssignments,
  ).map(minutesToTime)
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
  staffAssignments?: readonly (string | null | undefined)[],
): string[] {
  return services.map((_, index) => {
    const cleared = overrides.map((override, j) => (j === index ? undefined : override))
    return buildFlexibleServiceStartTimes(
      services,
      visitStartTime,
      cleared,
      staffAssignments,
    )[index]!
  })
}

export function formatChainedAppointmentTimeRange(
  services: readonly BookingServiceWithCategory[],
  startTime: string,
  locale: 'es' | 'en' = 'es',
  staffAssignments?: readonly (string | null | undefined)[],
): string {
  if (services.length === 0) return startTime
  const endMinutes =
    timeToMinutes(startTime) + getChainedBookingSpanMinutes(services, staffAssignments)
  const connector = locale === 'en' ? ' to ' : ' a '
  return `${startTime}${connector}${minutesToTime(endMinutes)}`
}
