import {
  COLOR_SPLIT_SEGMENT_MINUTES,
  getBookingSpanMinutes,
  getOccupiedSegmentsForBooking,
  usesColorSplitBooking,
  type OccupiedSegment,
} from '@/lib/booking/occupancy'

export type BookingServiceLine = {
  id: string
  durationMinutes: number
  categoryId?: string | null
  bookingPattern?: import('@/lib/booking/servicePattern').ServiceBookingPattern | null
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

export function findColorServiceIndex(services: readonly { id: string }[]): number {
  return services.findIndex((service) => usesColorSplitBooking(service.id))
}

/**
 * Índice del servicio que sustituye el lavado de la coloración en `colorIndex`,
 * o null si esa coloración debe llevar su propio lavado.
 *
 * Reglas:
 * - Solo peluquería (no estética) puede sustituir el lavado.
 * - Otra coloración split no sustituye (necesita su propio lavado o sustituto).
 * - Con `staffAssignments`: cualquier tratamiento posterior de peluquería puede
 *   sustituir el lavado, sea del mismo o de otro profesional. Ej: color con Olga
 *   + peinado con Mónica → no se crea fila de lavado de Olga.
 * - Sin `staffAssignments`: solo el tratamiento inmediatamente siguiente (reserva clásica).
 */
export function getColorWashReplacementIndex(
  services: readonly BookingServiceWithCategory[],
  colorIndex: number = findColorServiceIndex(services),
  staffAssignments?: readonly (string | null | undefined)[],
): number | null {
  if (colorIndex < 0 || colorIndex >= services.length) return null
  if (!usesColorSplitBooking(services[colorIndex]!.id)) return null

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
    if (usesColorSplitBooking(next.id)) return null
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

export function getOccupiedSegmentsForChainService(
  services: readonly BookingServiceWithCategory[],
  serviceIndex: number,
  startMinutes: number,
  staffAssignments?: readonly (string | null | undefined)[],
): OccupiedSegment[] {
  const service = services[serviceIndex]
  if (
    usesColorSplitBooking(service.id) &&
    getColorWashReplacementIndex(services, serviceIndex, staffAssignments) != null
  ) {
    // Mismo profesional continúa con peluquería: sin fila de lavado; solo aplicación.
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
  const first = services[0]
  if (
    usesColorSplitBooking(first.id) &&
    getColorWashReplacementIndex(services, 0, staffAssignments) != null
  ) {
    return COLOR_SPLIT_SEGMENT_MINUTES
  }
  return getBookingSpanMinutes(first.id, first.durationMinutes, first.bookingPattern)
}
