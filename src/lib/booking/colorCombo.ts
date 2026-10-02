import {
  COLOR_SPLIT_SEGMENT_MINUTES,
  getBookingSpanMinutes,
  getOccupiedSegmentsForBooking,
  serviceUsesLinkedWorkSegments,
  usesColorSplitBooking,
  type OccupiedSegment,
} from '@/lib/booking/occupancy'
import {
  findReplaceableWorkStepIndex,
  patternHasReplaceableWork,
  patternSpanBeforeReplaceable,
  patternToOccupiedSegmentsBeforeReplaceable,
  type ServiceBookingPattern,
} from '@/lib/booking/servicePattern'

export type BookingServiceLine = {
  id: string
  durationMinutes: number
  categoryId?: string | null
  bookingPattern?: ServiceBookingPattern | null
}

export type BookingServiceWithCategory = BookingServiceLine

/** Estética: no sustituye el tramo de lavado/aclarado del color. */
export const ESTHETIC_CATEGORY_IDS = new Set([
  'beauty-waxing',
  'beauty-hands-feet',
  'beauty-facial',
  'beauty-eyes',
])

export function isEstheticCategory(categoryId: string | null | undefined): boolean {
  return categoryId != null && ESTHETIC_CATEGORY_IDS.has(categoryId)
}

function serviceCanHaveWashReplacement(service: BookingServiceWithCategory): boolean {
  if (patternHasReplaceableWork(service.bookingPattern)) return true
  return usesColorSplitBooking(service.id)
}

export function findColorServiceIndex(services: readonly BookingServiceWithCategory[]): number {
  return services.findIndex((service) => serviceCanHaveWashReplacement(service))
}

/**
 * Índice del servicio que sustituye el lavado/aclarado en `colorIndex`,
 * o null si esa coloración debe llevar su propio tramo sustituible.
 *
 * Reglas:
 * - Solo peluquería (no estética) puede sustituir el lavado.
 * - Otro servicio con tramo sustituible no sustituye (necesita el suyo).
 * - Con `staffAssignments`: cualquier tratamiento posterior de peluquería puede
 *   sustituir el lavado, sea del mismo o de otro profesional.
 * - Sin `staffAssignments`: solo el tratamiento inmediatamente siguiente.
 */
export function getColorWashReplacementIndex(
  services: readonly BookingServiceWithCategory[],
  colorIndex: number = findColorServiceIndex(services),
  staffAssignments?: readonly (string | null | undefined)[],
): number | null {
  if (colorIndex < 0 || colorIndex >= services.length) return null
  const colorService = services[colorIndex]!
  if (!serviceCanHaveWashReplacement(colorService)) return null

  const hasStaff = Boolean(staffAssignments?.length)

  for (let nextIndex = colorIndex + 1; nextIndex < services.length; nextIndex++) {
    if (!hasStaff) {
      if (nextIndex !== colorIndex + 1) break
    }

    const next = services[nextIndex]!
    if (isEstheticCategory(next.categoryId)) {
      if (!hasStaff) return null
      continue
    }
    if (serviceCanHaveWashReplacement(next)) return null
    return nextIndex
  }
  return null
}

/** Coloración cuyo lavado sustituye el servicio en `serviceIndex`, si aplica. */
export function findColorIndexReplacedByService(
  services: readonly BookingServiceWithCategory[],
  serviceIndex: number,
  staffAssignments?: readonly (string | null | undefined)[],
): number | null {
  for (let colorIndex = 0; colorIndex < serviceIndex; colorIndex++) {
    if (getColorWashReplacementIndex(services, colorIndex, staffAssignments) === serviceIndex) {
      return colorIndex
    }
  }
  return null
}

export function usesColorWashReplacement(
  services: readonly BookingServiceWithCategory[],
  staffAssignments?: readonly (string | null | undefined)[],
): boolean {
  return services.some((_, i) => getColorWashReplacementIndex(services, i, staffAssignments) != null)
}

function applicationOnlyDuration(service: BookingServiceWithCategory): number {
  const pattern = service.bookingPattern
  if (pattern && findReplaceableWorkStepIndex(pattern) >= 0) {
    // Solo el primer tramo de work antes del sustituible (sin contar pausas en ocupación).
    const segs = patternToOccupiedSegmentsBeforeReplaceable(pattern, 0)
    return segs.reduce((sum, seg) => sum + seg.durationMinutes, 0) || COLOR_SPLIT_SEGMENT_MINUTES
  }
  return COLOR_SPLIT_SEGMENT_MINUTES
}

export function getOccupiedSegmentsForChainService(
  services: readonly BookingServiceWithCategory[],
  serviceIndex: number,
  startMinutes: number,
  staffAssignments?: readonly (string | null | undefined)[],
): OccupiedSegment[] {
  const service = services[serviceIndex]!
  if (
    serviceCanHaveWashReplacement(service) &&
    getColorWashReplacementIndex(services, serviceIndex, staffAssignments) != null
  ) {
    const pattern = service.bookingPattern
    if (pattern && findReplaceableWorkStepIndex(pattern) >= 0) {
      return patternToOccupiedSegmentsBeforeReplaceable(pattern, startMinutes)
    }
    return [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  }

  return getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes, {
    bookingPattern: service.bookingPattern,
  })
}

export function getFirstServiceBookingSpan(
  services: readonly BookingServiceWithCategory[],
  staffAssignments?: readonly (string | null | undefined)[],
): number {
  if (services.length === 0) return 0
  const first = services[0]!
  if (
    serviceCanHaveWashReplacement(first) &&
    getColorWashReplacementIndex(services, 0, staffAssignments) != null
  ) {
    const pattern = first.bookingPattern
    if (pattern && findReplaceableWorkStepIndex(pattern) >= 0) {
      return patternSpanBeforeReplaceable(pattern)
    }
    return COLOR_SPLIT_SEGMENT_MINUTES
  }
  return getBookingSpanMinutes(first.id, first.durationMinutes, first.bookingPattern)
}

export { serviceUsesLinkedWorkSegments, applicationOnlyDuration }
