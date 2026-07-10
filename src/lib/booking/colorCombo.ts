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
 * Si hay coloración y el tratamiento inmediatamente posterior es de peluquería (no estética),
 * ese servicio ocupa el slot de lavado/aclarado en lugar de encadenarse tras los 90 min.
 */
export function getColorWashReplacementIndex(
  services: readonly BookingServiceWithCategory[],
): number | null {
  const colorIndex = findColorServiceIndex(services)
  if (colorIndex < 0) return null
  const nextIndex = colorIndex + 1
  if (nextIndex >= services.length) return null
  if (isEstheticCategory(services[nextIndex].categoryId)) return null
  return nextIndex
}

export function usesColorWashReplacement(services: readonly BookingServiceWithCategory[]): boolean {
  return getColorWashReplacementIndex(services) != null
}

export function getOccupiedSegmentsForChainService(
  services: readonly BookingServiceWithCategory[],
  serviceIndex: number,
  startMinutes: number,
): OccupiedSegment[] {
  const service = services[serviceIndex]
  const replacementIndex = getColorWashReplacementIndex(services)

  if (
    replacementIndex != null &&
    serviceIndex === replacementIndex - 1 &&
    usesColorSplitBooking(service.id)
  ) {
    // Cuando hay un servicio de peluquería concatenado tras el color,
    // el lavado se elimina siempre. El color solo bloquea la aplicación (30 min).
    // La profesional lava implícitamente antes de iniciar el siguiente servicio.
    return [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  }

  return getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes, {
    bookingPattern: service.bookingPattern,
  })
}

export function getFirstServiceBookingSpan(services: readonly BookingServiceWithCategory[]): number {
  if (services.length === 0) return 0
  const first = services[0]
  if (usesColorSplitBooking(first.id) && getColorWashReplacementIndex(services) === 1) {
    return COLOR_SPLIT_SEGMENT_MINUTES
  }
  return getBookingSpanMinutes(first.id, first.durationMinutes, first.bookingPattern)
}
