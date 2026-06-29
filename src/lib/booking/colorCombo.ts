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
  allStartMinutes?: readonly number[],
): OccupiedSegment[] {
  const service = services[serviceIndex]
  const replacementIndex = getColorWashReplacementIndex(services)

  if (
    replacementIndex != null &&
    serviceIndex === replacementIndex - 1 &&
    usesColorSplitBooking(service.id)
  ) {
    // El reemplazo sólo aplica cuando el siguiente servicio empieza exactamente en el slot del lavado.
    // Si tiene un tiempo diferente (override posterior al lavado), el color ocupa los 90 min completos.
    if (allStartMinutes) {
      const washTime = startMinutes + COLOR_SPLIT_SEGMENT_MINUTES
      if (allStartMinutes[replacementIndex] !== washTime) {
        return getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
      }
    }
    return [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  }

  return getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
}

export function getFirstServiceBookingSpan(services: readonly BookingServiceWithCategory[]): number {
  if (services.length === 0) return 0
  const first = services[0]
  if (usesColorSplitBooking(first.id) && getColorWashReplacementIndex(services) === 1) {
    return COLOR_SPLIT_SEGMENT_MINUTES
  }
  return getBookingSpanMinutes(first.id, first.durationMinutes)
}
